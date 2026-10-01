import * as THREE from "three";
import {
  SEGMENT_ATTR_RAPID,
  type LineRangeGroup,
  type WorkerSegmentsData,
} from "../../types";
import type { GCodeViewerOptions } from "../types";
import { plannedRgb, processedRgb } from "./streams";

/**
 * Toolpath drawn straight from worker "segments-v1" buffers.
 *
 * Unlike the stream path (streams.ts) nothing is copied or re-packed: each
 * worker chunk becomes one `LineSegments` whose attributes are the transferred
 * buffers. Colour comes from a per-vertex byte (rapid bit + palette slot) and,
 * for laser files, a per-vertex power value; progress greying and line-group
 * hiding are uniforms compared against `gl_VertexID`, so neither rewrites or
 * re-uploads any vertex data.
 *
 * Each chunk is drawn in two passes over the same geometry: cuts, then rapids
 * (renderOrder). Drawn in file order in one pass, an early rapid would write
 * depth and hide the cuts under it, instead of the translucent rapid blending
 * over them as the separate rapid/cut streams always did.
 */

/** Palette slots the shader can colour; higher slots reuse the last one. */
export const SEGMENT_PALETTE_SLOTS = 32;
/** Hidden vertex ranges per chunk (line groups hidden at once). */
export const SEGMENT_MAX_HIDDEN_RANGES = 64;

type Uniform<T> = { value: T };

type SharedUniforms = {
  uSegSlotColors: Uniform<THREE.Color[]>;
  uSegRapidColor: Uniform<THREE.Color>;
  uSegProcessedColor: Uniform<THREE.Color>;
  uSegPlannedColor: Uniform<THREE.Color>;
  uSegRapidOpacity: Uniform<number>;
  uSegCutOpacity: Uniform<number>;
  uSegMaxPower: Uniform<number>;
};

type ChunkUniforms = {
  uSegCursor: Uniform<number>;
  /** Vertex index through the acked-but-not-cut ("planned") boundary; exclusive. */
  uSegPlannedEnd: Uniform<number>;
  uSegHiddenCount: Uniform<number>;
  uSegHidden: Uniform<THREE.Vector2[]>;
};

export type SegmentsChunkState = {
  geometry: THREE.BufferGeometry;
  /** Draws only the cutting segments. */
  cutLine: THREE.LineSegments;
  /** Draws only the rapid segments, after every cut pass. */
  rapidLine: THREE.LineSegments;
  /** Index of this chunk's first vertex in the whole toolpath. */
  base: number;
  count: number;
  uniforms: ChunkUniforms;
};

export type SegmentsToolpathState = {
  chunks: SegmentsChunkState[];
  prefixEndVertex: Uint32Array;
  totalVertices: number;
  shared: SharedUniforms;
  paletteHex: readonly string[] | null;
  /** Vertex range [start, end) of each load-time line group. */
  lineGroupRanges: readonly (readonly [number, number])[];
  hiddenGroups: Set<number>;
};

const VERTEX_DECLARATIONS = /* glsl */ `
attribute float aSegAttr;
#ifdef SEG_USE_POWER
attribute float aSegPower;
#endif
uniform vec3 uSegSlotColors[ ${SEGMENT_PALETTE_SLOTS} ];
uniform vec3 uSegRapidColor;
uniform vec3 uSegProcessedColor;
uniform vec3 uSegPlannedColor;
uniform float uSegRapidOpacity;
uniform float uSegCutOpacity;
uniform float uSegMaxPower;
uniform float uSegCursor;
uniform float uSegPlannedEnd;
uniform int uSegHiddenCount;
uniform vec2 uSegHidden[ ${SEGMENT_MAX_HIDDEN_RANGES} ];
varying vec4 vSegColor;
varying float vSegHidden;
`;

const VERTEX_BODY = /* glsl */ `
float segVertex = float( gl_VertexID );
bool segRapid = aSegAttr >= ${(SEGMENT_ATTR_RAPID - 0.5).toFixed(1)};
int segSlot = min( int( mod( aSegAttr, ${SEGMENT_ATTR_RAPID.toFixed(1)} ) + 0.5 ), ${SEGMENT_PALETTE_SLOTS - 1} );
vec3 segColor = segRapid ? uSegRapidColor : uSegSlotColors[ segSlot ];
float segAlpha = segRapid ? uSegRapidOpacity : uSegCutOpacity;
vSegHidden = 0.0;
#ifdef SEG_USE_POWER
if ( !segRapid ) {
  // Laser-off moves are travel, not cuts: not drawn (as in the text-loading path).
  if ( aSegPower <= 0.0 ) {
    vSegHidden = 1.0;
  } else {
    segAlpha *= clamp( aSegPower / uSegMaxPower, 0.0, 1.0 );
  }
}
#endif
if ( segVertex < uSegCursor ) {
  segColor = uSegProcessedColor;
} else if ( segVertex < uSegPlannedEnd ) {
  segColor = uSegPlannedColor;
}
for ( int i = 0; i < ${SEGMENT_MAX_HIDDEN_RANGES}; i++ ) {
  if ( i >= uSegHiddenCount ) break;
  if ( segVertex >= uSegHidden[ i ].x && segVertex < uSegHidden[ i ].y ) {
    vSegHidden = 1.0;
  }
}
vSegColor = vec4( segColor, segAlpha );
// Each pass draws one kind; the other kind's segments are moved outside the
// clip volume so they are dropped before rasterising.
#ifdef SEG_PASS_RAPID
if ( !segRapid ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
#else
if ( segRapid ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
#endif
`;

const FRAGMENT_DECLARATIONS = /* glsl */ `
varying vec4 vSegColor;
varying float vSegHidden;
`;

const FRAGMENT_DIFFUSE = "vec4 diffuseColor = vec4( diffuse, opacity );";

/** Draws rapids after all cuts, so their opacity blends over the cuts below. */
export const SEGMENT_RAPID_RENDER_ORDER = 1;

function createSegmentsMaterial(
  shared: SharedUniforms,
  chunk: ChunkUniforms,
  usePower: boolean,
  pass: "cut" | "rapid"
): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true });
  const defines: Record<string, string> = {};
  if (usePower) {
    defines.SEG_USE_POWER = "";
  }
  if (pass === "rapid") {
    defines.SEG_PASS_RAPID = "";
  }
  material.defines = defines;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, chunk);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_DECLARATIONS}`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_DECLARATIONS}`)
      .replace(FRAGMENT_DIFFUSE, "if ( vSegHidden > 0.5 ) discard;\n\tvec4 diffuseColor = vSegColor;");
  };
  // Every chunk compiles to one program per pass; only uniform values differ.
  const cacheKey = `gviewer-segments-v1-${pass}${usePower ? "-power" : ""}`;
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

function cuttingColorHex(options: Readonly<GCodeViewerOptions>): string {
  const colors = options.render.theme.colors;
  return options.mode.laser ? colors.laser ?? colors.cutting : colors.cutting;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/** Theme and palette colours/opacities into the shared uniforms. */
export function applySegmentsTheme(
  state: Pick<SegmentsToolpathState, "shared" | "paletteHex">,
  options: Readonly<GCodeViewerOptions>
): void {
  const { shared, paletteHex } = state;
  const cutting = new THREE.Color(cuttingColorHex(options));
  for (let slot = 0; slot < SEGMENT_PALETTE_SLOTS; slot += 1) {
    const hex = paletteHex?.[slot];
    shared.uSegSlotColors.value[slot].set(hex ?? cutting);
  }
  shared.uSegRapidColor.value.set(options.render.theme.colors.rapid);
  const processed = processedRgb(options);
  shared.uSegProcessedColor.value.setRGB(processed.r, processed.g, processed.b);
  const planned = plannedRgb(options);
  shared.uSegPlannedColor.value.setRGB(planned.r, planned.g, planned.b);
  shared.uSegRapidOpacity.value = clamp01(options.render.theme.rapidOpacity ?? 0.3);
  shared.uSegCutOpacity.value = clamp01(options.render.theme.opacity);
}

function lineGroupVertexRanges(
  prefixEndVertex: Uint32Array,
  lineGroups: readonly LineRangeGroup[] | undefined
): [number, number][] {
  if (!lineGroups || prefixEndVertex.length === 0) {
    return [];
  }
  const last = prefixEndVertex.length - 1;
  return lineGroups.map(({ start, end }) => {
    const first = Math.max(0, Math.floor(start));
    const final = Math.min(last, Math.floor(end));
    if (final < first) {
      return [0, 0];
    }
    const from = first === 0 ? 0 : prefixEndVertex[first - 1];
    return [from, prefixEndVertex[final]];
  });
}

export function createSegmentsToolpath(args: {
  data: WorkerSegmentsData;
  options: Readonly<GCodeViewerOptions>;
  parent: THREE.Object3D;
  lineGroups?: readonly LineRangeGroup[];
}): { state: SegmentsToolpathState; bounds: THREE.Box3 | null } {
  const { data, options, parent } = args;
  const usePower = Boolean(data.isLaser) && data.chunks.some((chunk) => chunk.power);
  const hasToolchanges = (data.toolchangeCount ?? 0) > 0;

  const shared: SharedUniforms = {
    uSegSlotColors: { value: Array.from({ length: SEGMENT_PALETTE_SLOTS }, () => new THREE.Color()) },
    uSegRapidColor: { value: new THREE.Color() },
    uSegProcessedColor: { value: new THREE.Color() },
    uSegPlannedColor: { value: new THREE.Color() },
    uSegRapidOpacity: { value: 0.3 },
    uSegCutOpacity: { value: 1 },
    // Fractional S (e.g. $30=1 lasers) is valid, so no floor of 1 here.
    uSegMaxPower: { value: (data.maxPower ?? 0) > 0 ? data.maxPower! : 1 },
  };
  const paletteHex = hasToolchanges && data.paletteHex ? data.paletteHex : null;
  applySegmentsTheme({ shared, paletteHex }, options);

  const chunks: SegmentsChunkState[] = [];
  let bounds: THREE.Box3 | null = null;
  let base = 0;
  for (const chunk of data.chunks) {
    const count = chunk.vertexCount;
    if (count <= 0) {
      continue;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(chunk.positions, 0, count * 3), 3));
    geometry.setAttribute("aSegAttr", new THREE.BufferAttribute(new Uint8Array(chunk.attrs, 0, count), 1));
    if (usePower && chunk.power) {
      geometry.setAttribute("aSegPower", new THREE.BufferAttribute(new Float32Array(chunk.power, 0, count), 1));
    } else if (usePower) {
      // A chunk without power data in a laser file draws nothing but its rapids.
      geometry.setAttribute("aSegPower", new THREE.BufferAttribute(new Float32Array(count), 1));
    }
    geometry.computeBoundingBox();

    const uniforms: ChunkUniforms = {
      uSegCursor: { value: 0 },
      uSegPlannedEnd: { value: 0 },
      uSegHiddenCount: { value: 0 },
      uSegHidden: {
        value: Array.from({ length: SEGMENT_MAX_HIDDEN_RANGES }, () => new THREE.Vector2()),
      },
    };
    const cutLine = new THREE.LineSegments(geometry, createSegmentsMaterial(shared, uniforms, usePower, "cut"));
    const rapidLine = new THREE.LineSegments(geometry, createSegmentsMaterial(shared, uniforms, usePower, "rapid"));
    rapidLine.renderOrder = SEGMENT_RAPID_RENDER_ORDER;
    parent.add(cutLine, rapidLine);
    chunks.push({ geometry, cutLine, rapidLine, base, count, uniforms });

    if (geometry.boundingBox) {
      bounds = bounds ? bounds.union(geometry.boundingBox) : geometry.boundingBox.clone();
    }
    base += count;
  }

  const prefixEndVertex = new Uint32Array(data.prefixEndVertex);
  const state: SegmentsToolpathState = {
    chunks,
    prefixEndVertex,
    totalVertices: base,
    shared,
    paletteHex,
    lineGroupRanges: lineGroupVertexRanges(prefixEndVertex, args.lineGroups),
    hiddenGroups: new Set(),
  };
  return { state, bounds };
}

export function disposeSegmentsToolpath(parent: THREE.Object3D, state: SegmentsToolpathState): void {
  for (const chunk of state.chunks) {
    parent.remove(chunk.cutLine, chunk.rapidLine);
    chunk.geometry.dispose();
    (chunk.cutLine.material as THREE.Material).dispose();
    (chunk.rapidLine.material as THREE.Material).dispose();
  }
  state.chunks = [];
}

/** Vertex count through line `lineIndex` (inclusive); 0 before the first line. */
export function segmentsCursorForLine(state: SegmentsToolpathState, lineIndex: number): number {
  const index = Math.floor(lineIndex);
  const prefix = state.prefixEndVertex;
  if (index < 0 || prefix.length === 0) {
    return 0;
  }
  return prefix[Math.min(index, prefix.length - 1)];
}

/**
 * Progress through line `lineIndex`: "grey" recolours everything up to it with
 * the processed colour, "hide" stops drawing it.
 */
export function setSegmentsProgress(
  state: SegmentsToolpathState,
  lineIndex: number,
  mode: "hide" | "grey"
): void {
  const cursor = segmentsCursorForLine(state, lineIndex);
  for (const chunk of state.chunks) {
    const local = Math.max(0, Math.min(chunk.count, cursor - chunk.base));
    if (mode === "grey") {
      chunk.geometry.setDrawRange(0, chunk.count);
      chunk.uniforms.uSegCursor.value = local;
    } else {
      chunk.geometry.setDrawRange(local, chunk.count - local);
    }
  }
}

/**
 * Colour vertices through line `toLine` as "planned" (acked, not yet cut),
 * wherever they fall beyond the chunk's current processed cursor — the
 * shader's `else if` ordering (see VERTEX_BODY) means the processed cursor
 * always wins on overlap, so this never needs to know the lower bound
 * itself. Pass a line before the processed cursor (or < 0) to clear it.
 */
export function setSegmentsPlannedEnd(state: SegmentsToolpathState, toLine: number): void {
  const cursor = toLine < 0 ? 0 : segmentsCursorForLine(state, toLine);
  for (const chunk of state.chunks) {
    chunk.uniforms.uSegPlannedEnd.value = Math.max(0, Math.min(chunk.count, cursor - chunk.base));
  }
}

/** Draw every vertex again (progress "hide" undone); greying is kept. */
export function showAllSegments(state: SegmentsToolpathState): void {
  for (const chunk of state.chunks) {
    chunk.geometry.setDrawRange(0, chunk.count);
  }
}

/** Clear progress greying and planned colouring. */
export function resetSegmentsColors(state: SegmentsToolpathState): void {
  for (const chunk of state.chunks) {
    chunk.uniforms.uSegCursor.value = 0;
    chunk.uniforms.uSegPlannedEnd.value = 0;
  }
}

function applyHiddenRanges(state: SegmentsToolpathState): void {
  const ranges: (readonly [number, number])[] = [];
  for (const group of state.hiddenGroups) {
    const range = state.lineGroupRanges[group];
    if (range && range[1] > range[0]) {
      ranges.push(range);
    }
  }
  for (const chunk of state.chunks) {
    const end = chunk.base + chunk.count;
    let n = 0;
    for (const [from, to] of ranges) {
      if (n >= SEGMENT_MAX_HIDDEN_RANGES) {
        break;
      }
      const a = Math.max(from, chunk.base);
      const b = Math.min(to, end);
      if (b > a) {
        chunk.uniforms.uSegHidden.value[n].set(a - chunk.base, b - chunk.base);
        n += 1;
      }
    }
    chunk.uniforms.uSegHiddenCount.value = n;
  }
}

export function setSegmentsLineGroupVisible(
  state: SegmentsToolpathState,
  groupIndex: number,
  visible: boolean
): void {
  if (groupIndex < 0 || groupIndex >= state.lineGroupRanges.length) {
    return;
  }
  if (visible) {
    state.hiddenGroups.delete(groupIndex);
  } else {
    state.hiddenGroups.add(groupIndex);
  }
  applyHiddenRanges(state);
}

export function showAllSegmentsLineGroups(state: SegmentsToolpathState): void {
  state.hiddenGroups.clear();
  applyHiddenRanges(state);
}

export function setSegmentsVisible(state: SegmentsToolpathState, visible: boolean): void {
  for (const chunk of state.chunks) {
    chunk.cutLine.visible = visible;
    chunk.rapidLine.visible = visible;
  }
}
