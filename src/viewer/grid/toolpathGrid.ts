import * as THREE from "three";
import type { GCodeViewerTheme, GridUnits } from "../types";
import { createTextSprite } from "../render/textSprite";

const MM_PER_INCH = 25.4;
const EPSILON = 1e-6;

/** Draw order: grid lines under the toolpath, labels over everything but markers. */
const GRID_RENDER_ORDER = -1;
const LABEL_RENDER_ORDER = 998;

/** Every Nth major line gets the "decade" weight and survives thinning. */
const DECADE = 10;

// Ruler tick lengths as a fraction of the major step, so they scale with the
// grid rather than needing a per-frame update.
const MAJOR_TICK = 0.35;
const MINOR_TICK = 0.18;

/** Label gap from the ruler tick, in CSS pixels. */
const LABEL_GAP_PX = 4;

export type ToolpathGridExtent = { minX: number; maxX: number; minY: number; maxY: number };

export type ToolpathGridLabel = {
  object: THREE.Object3D;
  axis: "x" | "y";
  /** World position along its axis. */
  world: number;
  /** Index in major steps from 0, used for thinning. */
  index: number;
  /** Label width / height. */
  aspect: number;
};

export type ToolpathGrid = {
  group: THREE.Group;
  extent: ToolpathGridExtent;
  majorStep: number;
  majorTick: number;
  labels: ToolpathGridLabel[];
  /** Major lines not on a decade; hidden when crowded. */
  majorLines: THREE.LineSegments;
  /** Minor (half-step) ruler ticks; hidden when crowded. */
  minorTicks: THREE.LineSegments;
};

export function toolpathGridSteps(units: GridUnits): { major: number; minor: number } {
  const major = units === "in" ? MM_PER_INCH : 10;
  return { major, minor: major / 2 };
}

/**
 * The toolpath's X/Y extent snapped outward to the nearest major line, so the
 * grid starts at the toolpath rather than beyond it. A toolpath that spans no
 * width on an axis still gets one step.
 */
export function toolpathGridExtent(
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
  majorStep: number
): ToolpathGridExtent {
  const snapDown = (v: number) => Math.floor(v / majorStep + EPSILON) * majorStep;
  const snapUp = (v: number) => Math.ceil(v / majorStep - EPSILON) * majorStep;
  const span = (lo: number, hi: number): [number, number] => {
    const min = snapDown(lo);
    const max = snapUp(hi);
    return max - min < majorStep - EPSILON ? [min, min + majorStep] : [min, max];
  };
  const [minX, maxX] = span(bounds.min.x, bounds.max.x);
  const [minY, maxY] = span(bounds.min.y, bounds.max.y);
  return { minX, maxX, minY, maxY };
}

/** Value shown for a major line, in display units. */
export function formatToolpathGridLabel(index: number, units: GridUnits): string {
  const value = units === "in" ? index : index * 10;
  return String(value === 0 ? 0 : value);
}

/**
 * Show every Nth label (N from 1, 2, 5, 10, 20, 50...) so labels are at least
 * `minSpacingPx` apart on screen.
 */
export function labelStride(stepPx: number, minSpacingPx: number): number {
  if (!(stepPx > 0)) {
    return Number.POSITIVE_INFINITY;
  }
  for (let decade = 1; decade < 1e9; decade *= 10) {
    for (const factor of [1, 2, 5]) {
      const stride = factor * decade;
      if (stepPx * stride >= minSpacingPx) {
        return stride;
      }
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function createToolpathGrid(args: {
  bounds: THREE.Box3;
  units: GridUnits;
  theme: GCodeViewerTheme;
}): ToolpathGrid {
  const { major, minor } = toolpathGridSteps(args.units);
  const extent = toolpathGridExtent(args.bounds, major);
  const { minX, maxX, minY, maxY } = extent;
  const color = args.theme.colors.toolpathGrid ?? args.theme.colors.boundingBox;
  // Just under the toolpath so it wins the depth test where they overlap.
  const z = Math.min(0, args.bounds.min.z) - 0.01;
  const majorTick = major * MAJOR_TICK;
  const minorTick = major * MINOR_TICK;

  const decadeVertices: number[] = [];
  const majorVertices: number[] = [];
  const edgeVertices: number[] = [];
  const minorVertices: number[] = [];
  const push = (target: number[], x1: number, y1: number, x2: number, y2: number) => {
    target.push(x1, y1, z, x2, y2, z);
  };

  const labels: ToolpathGridLabel[] = [];
  const addLabel = (axis: "x" | "y", index: number, world: number) => {
    const object = createTextSprite(formatToolpathGridLabel(index, args.units), color, { size: 1, opacity: 0.95 });
    const sprite = object.children[0] as THREE.Sprite;
    sprite.renderOrder = LABEL_RENDER_ORDER;
    const material = sprite.material as THREE.SpriteMaterial;
    material.depthTest = false;
    material.depthWrite = false;
    labels.push({ object, axis, world, index, aspect: sprite.scale.x / Math.max(EPSILON, sprite.scale.y) });
  };

  // Steps are counted as integers from 0 so lines stay on absolute world
  // positions and labels don't pick up float drift.
  const firstX = Math.round(minX / major);
  const lastX = Math.round(maxX / major);
  for (let i = firstX; i <= lastX; i += 1) {
    const x = i * major;
    if (i !== firstX && i !== lastX) {
      push(i % DECADE === 0 ? decadeVertices : majorVertices, x, minY, x, maxY);
    }
    push(edgeVertices, x, minY, x, minY - majorTick);
    addLabel("x", i, x);
    if (i < lastX) {
      push(minorVertices, x + minor, minY, x + minor, minY - minorTick);
    }
  }

  const firstY = Math.round(minY / major);
  const lastY = Math.round(maxY / major);
  for (let i = firstY; i <= lastY; i += 1) {
    const y = i * major;
    if (i !== firstY && i !== lastY) {
      push(i % DECADE === 0 ? decadeVertices : majorVertices, minX, y, maxX, y);
    }
    push(edgeVertices, minX, y, minX - majorTick, y);
    addLabel("y", i, y);
    if (i < lastY) {
      push(minorVertices, minX, y + minor, minX - minorTick, y + minor);
    }
  }

  // Extent outline doubles as the ruler edges.
  push(edgeVertices, minX, minY, maxX, minY);
  push(edgeVertices, maxX, minY, maxX, maxY);
  push(edgeVertices, maxX, maxY, minX, maxY);
  push(edgeVertices, minX, maxY, minX, minY);

  const majorLines = createGridLines(majorVertices, color, 0.18);
  const minorTicks = createGridLines(minorVertices, color, 0.8);
  const group = new THREE.Group();
  group.name = "gviewer:toolpath-grid";
  group.add(
    createGridLines(decadeVertices, color, 0.35),
    majorLines,
    createGridLines(edgeVertices, color, 0.9),
    minorTicks,
    ...labels.map((label) => label.object)
  );

  return { group, extent, majorStep: major, majorTick, labels, majorLines, minorTicks };
}

function createGridLines(vertices: number[], color: string, opacity: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = GRID_RENDER_ORDER;
  return lines;
}

/**
 * Sizes labels to `labelSizePx` on screen, keeps them a fixed pixel gap
 * outside the ruler, and thins labels / minor ticks / plain major lines that
 * would be too crowded at the current zoom.
 */
export function updateToolpathGridScale(grid: ToolpathGrid, worldPerPixel: number, labelSizePx: number): void {
  const stepPx = grid.majorStep / worldPerPixel;
  const stride = labelStride(stepPx, Math.max(labelSizePx * 3, 36));
  const height = labelSizePx * worldPerPixel;
  const gap = LABEL_GAP_PX * worldPerPixel;
  const { minX, minY } = grid.extent;

  for (const label of grid.labels) {
    label.object.visible = label.index % stride === 0;
    label.object.scale.setScalar(height);
    if (label.axis === "x") {
      label.object.position.set(label.world, minY - grid.majorTick - gap - height / 2, 0);
    } else {
      label.object.position.set(minX - grid.majorTick - gap - (label.aspect * height) / 2, label.world, 0);
    }
  }
  grid.minorTicks.visible = stepPx / 2 >= 4;
  grid.majorLines.visible = stepPx >= 6;
}

/**
 * What a top-down fit must keep on screen to show the whole grid: the world
 * box (extent plus ruler ticks) and the pixel-sized label overhang per side.
 */
export function toolpathGridFrame(
  grid: ToolpathGrid,
  labelSizePx: number
): {
  box: ToolpathGridExtent;
  paddingPx: { left: number; right: number; top: number; bottom: number };
} {
  const { minX, maxX, minY, maxY } = grid.extent;
  let yAspect = 0;
  let lastXAspect = 0;
  for (const label of grid.labels) {
    if (label.axis === "y") {
      yAspect = Math.max(yAspect, label.aspect);
    } else if (Math.abs(label.world - maxX) < EPSILON) {
      lastXAspect = label.aspect;
    }
  }
  return {
    box: { minX: minX - grid.majorTick, maxX, minY: minY - grid.majorTick, maxY },
    paddingPx: {
      left: LABEL_GAP_PX + yAspect * labelSizePx,
      right: (lastXAspect * labelSizePx) / 2,
      top: labelSizePx / 2,
      bottom: LABEL_GAP_PX + labelSizePx,
    },
  };
}

export function disposeToolpathGrid(grid: ToolpathGrid): void {
  grid.group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      return;
    }
    if (child instanceof THREE.Sprite) {
      const material = child.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }
  });
}
