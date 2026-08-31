import * as THREE from "three";
import type { GCodeViewerOptions } from "../types";

export type ToolpathStreamKind = "rapid" | "cut";

export type ToolpathStreamState = {
  line: THREE.LineSegments;
  baseColors: Float32Array;
  simColors: Float32Array;
  prefixEndVertex: Int32Array;
  totalVertices: number;
  greyCursorVertex: number;
  kind: ToolpathStreamKind;
  cutBucketIndex: number | null;
  /** Which of the load's `lineGroups` this stream holds, or null for the always-visible
   *  catch-all and for ungrouped loads. Drives setLineGroupVisible. */
  lineGroupIndex: number | null;
  /** Set when colors came from the worker's pre-baked colorArrayBuffer (e.g. toolchange palette).
   *  refreshToolpathStreamColors skips these streams so theme changes don't flatten per-tool colors. */
  workerColors?: Float32Array;
};

export type ToolpathStreamSpec = {
  kind: ToolpathStreamKind;
  cutBucketIndex: number | null;
  lineGroupIndex?: number | null;
  positions: Float32Array;
  prefixEndVertex: Int32Array;
  opacity: number;
  colors?: Float32Array;
};

export function createToolpathStreams(args: {
  specs: readonly ToolpathStreamSpec[];
  options: Readonly<GCodeViewerOptions>;
  scene: THREE.Scene;
}): { streams: ToolpathStreamState[]; bounds: THREE.Box3 | null } {
  const streams: ToolpathStreamState[] = [];
  let bounds: THREE.Box3 | null = null;

  for (const spec of args.specs) {
    if (spec.positions.length === 0 || spec.opacity <= 0) {
      continue;
    }

    const totalVertices = spec.positions.length / 3;
    const baseColors = spec.colors ? spec.colors.slice() : buildStreamBaseColors(spec.kind, totalVertices, args.options);
    const simColors = new Float32Array(baseColors.length);
    simColors.set(baseColors);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(spec.positions, 3));
    const colorAttr = new THREE.BufferAttribute(simColors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", colorAttr);
    geometry.computeBoundingBox();

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: spec.opacity,
    });

    const line = new THREE.LineSegments(geometry, material);
    args.scene.add(line);

    streams.push({
      line,
      baseColors,
      simColors,
      prefixEndVertex: spec.prefixEndVertex,
      totalVertices,
      greyCursorVertex: 0,
      kind: spec.kind,
      cutBucketIndex: spec.cutBucketIndex,
      lineGroupIndex: spec.lineGroupIndex ?? null,
      workerColors: spec.colors ? baseColors : undefined,
    });

    if (geometry.boundingBox) {
      bounds = bounds ? bounds.union(geometry.boundingBox) : geometry.boundingBox.clone();
    }
  }

  return { streams, bounds };
}

export function disposeToolpathStreams(scene: THREE.Scene, streams: readonly ToolpathStreamState[]): void {
  for (const stream of streams) {
    scene.remove(stream.line);
    stream.line.geometry.dispose();
    (stream.line.material as THREE.Material).dispose();
  }
}

export function refreshToolpathStreamColors(
  streams: readonly ToolpathStreamState[],
  options: Readonly<GCodeViewerOptions>
): void {
  for (const stream of streams) {
    // Worker-baked streams carry per-tool palette colors — don't flatten them to a uniform theme color.
    if (stream.workerColors) continue;
    const nextBase = buildStreamBaseColors(stream.kind, stream.totalVertices, options);
    stream.baseColors = nextBase;
    stream.simColors.set(nextBase);
    stream.greyCursorVertex = 0;
    const attr = stream.line.geometry.getAttribute("color") as THREE.BufferAttribute;
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, stream.simColors.length);
    attr.needsUpdate = true;
  }
}

export function refreshToolpathStreamOpacities(args: {
  streams: readonly ToolpathStreamState[];
  options: Readonly<GCodeViewerOptions>;
  cutBucketCount: number;
}): void {
  const rapidOpacity = clamp01(args.options.render.theme.rapidOpacity ?? 0.3);
  for (const stream of args.streams) {
    const material = stream.line.material as THREE.LineBasicMaterial;
    if (stream.kind === "rapid") {
      material.opacity = rapidOpacity;
      continue;
    }
    material.opacity = cutBucketOpacity({
      bucketIndex: stream.cutBucketIndex ?? 0,
      bucketCount: args.cutBucketCount,
      baseOpacity: args.options.render.theme.opacity,
    });
  }
}

export function applyStreamGreyCursor(args: {
  stream: ToolpathStreamState;
  nextCursorVertex: number;
  options: Readonly<GCodeViewerOptions>;
}): void {
  const total = args.stream.totalVertices;
  const next = Math.max(0, Math.min(total, Math.floor(args.nextCursorVertex)));
  const previous = Math.max(0, Math.min(total, Math.floor(args.stream.greyCursorVertex)));
  if (next === previous) {
    return;
  }

  const attr = args.stream.line.geometry.getAttribute("color") as THREE.BufferAttribute;
  const processed = processedRgb(args.options);

  const startVertex = Math.min(previous, next);
  const endVertex = Math.max(previous, next);

  if (next > previous) {
    for (let v = previous; v < next; v += 1) {
      const off = v * 3;
      args.stream.simColors[off] = processed.r;
      args.stream.simColors[off + 1] = processed.g;
      args.stream.simColors[off + 2] = processed.b;
    }
  } else {
    const startOff = next * 3;
    const endOff = previous * 3;
    args.stream.simColors.set(args.stream.baseColors.subarray(startOff, endOff), startOff);
  }

  attr.clearUpdateRanges();
  attr.addUpdateRange(startVertex * 3, (endVertex - startVertex) * 3);
  attr.needsUpdate = true;
  args.stream.greyCursorVertex = next;
}

export function buildStreamBaseColors(
  kind: ToolpathStreamKind,
  totalVertices: number,
  options: Readonly<GCodeViewerOptions>
): Float32Array {
  const themeColors = options.render.theme.colors;
  const cutColor = options.mode.laser ? themeColors.laser ?? themeColors.cutting : themeColors.cutting;
  const color = new THREE.Color(kind === "rapid" ? themeColors.rapid : cutColor);
  const base = new Float32Array(totalVertices * 3);
  for (let v = 0; v < totalVertices; v += 1) {
    const off = v * 3;
    base[off] = color.r;
    base[off + 1] = color.g;
    base[off + 2] = color.b;
  }
  return base;
}

export function processedRgb(options: Readonly<GCodeViewerOptions>): { r: number; g: number; b: number } {
  const themeColors = options.render.theme.colors;
  const background = new THREE.Color(options.render.theme.background);
  const processedColor = new THREE.Color(themeColors.processed ?? themeColors.cutting);
  const processed = background.clone().lerp(processedColor, 0.65);
  return { r: processed.r, g: processed.g, b: processed.b };
}

export function cutBucketOpacity(args: { bucketIndex: number; bucketCount: number; baseOpacity: number }): number {
  if (args.bucketCount <= 1) {
    return clamp01(args.baseOpacity);
  }
  const normalized = args.bucketIndex / (args.bucketCount - 1);
  return clamp01(args.baseOpacity * normalized);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
