import * as THREE from "three";
import { type LineRangeGroup, type WorkerSegmentsData } from "../../types";
import type { GCodeViewerOptions } from "../types";
/**
 * Toolpath drawn straight from worker "segments-v1" buffers.
 *
 * Unlike the stream path (streams.ts) nothing is copied or re-packed: each
 * worker chunk becomes one `LineSegments` whose attributes are the transferred
 * buffers. Colour comes from a per-vertex byte (rapid bit + palette slot) and,
 * for laser files, a per-vertex power value; progress greying and line-group
 * hiding are uniforms compared against `gl_VertexID`, so neither rewrites or
 * re-uploads any vertex data. The processed and planned boundaries are
 * compared per fragment against a position interpolated along each segment,
 * so either can fall part-way along one (see locate.ts).
 *
 * Each chunk is drawn in two passes over the same geometry: cuts, then rapids
 * (renderOrder). Drawn in file order in one pass, an early rapid would write
 * depth and hide the cuts under it, instead of the translucent rapid blending
 * over them as the separate rapid/cut streams always did.
 */
/** Palette slots the shader can colour; higher slots reuse the last one. */
export declare const SEGMENT_PALETTE_SLOTS = 32;
/** Hidden vertex ranges per chunk (line groups hidden at once). */
export declare const SEGMENT_MAX_HIDDEN_RANGES = 64;
type Uniform<T> = {
    value: T;
};
type SharedUniforms = {
    uSegSlotColors: Uniform<THREE.Color[]>;
    uSegRapidColor: Uniform<THREE.Color>;
    uSegProcessedColor: Uniform<THREE.Color>;
    uSegPlannedColor: Uniform<THREE.Color>;
    uSegRapidOpacity: Uniform<number>;
    uSegCutOpacity: Uniform<number>;
    uSegMaxPower: Uniform<number>;
    /** Length of the planned span in vertex positions (at least 1). */
    uSegPlannedSpan: Uniform<number>;
    /** How far the far end of the planned span fades toward the toolpath colour. */
    uSegPlannedFade: Uniform<number>;
    /** Strength of the pulse swept along the planned span; 0 turns it off. */
    uSegPulse: Uniform<number>;
    /** Seconds, wrapping every minute; drives the pulse. */
    uSegTime: Uniform<number>;
};
type ChunkUniforms = {
    /** Processed boundary, chunk-local vertex position; may be fractional. */
    uSegCursor: Uniform<number>;
    /** 1 to discard the processed part ("hide" progress) rather than grey it. */
    uSegCursorHides: Uniform<number>;
    /** End of the planned (sent but not yet cut) span, chunk-local; exclusive. */
    uSegPlannedEnd: Uniform<number>;
    /**
     * Start of the planned span, chunk-local: negative for chunks after it.
     * Chunk-local rather than global so the gradient keeps its precision far
     * into big files.
     */
    uSegPlannedFrom: Uniform<number>;
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
    /** Processed boundary, global vertex position; where the planned span starts. */
    cursorVertex: number;
};
/** Draws rapids after all cuts, so their opacity blends over the cuts below. */
export declare const SEGMENT_RAPID_RENDER_ORDER = 1;
/** Theme and palette colours/opacities into the shared uniforms. */
export declare function applySegmentsTheme(state: Pick<SegmentsToolpathState, "shared" | "paletteHex">, options: Readonly<GCodeViewerOptions>): void;
/**
 * Advance the planned-span pulse to `nowMs`. Wraps every minute, which the
 * pulse period divides, so the sweep is seamless and the value stays small.
 */
export declare function setSegmentsTime(state: Pick<SegmentsToolpathState, "shared">, nowMs: number): void;
export declare function createSegmentsToolpath(args: {
    data: WorkerSegmentsData;
    options: Readonly<GCodeViewerOptions>;
    parent: THREE.Object3D;
    lineGroups?: readonly LineRangeGroup[];
}): {
    state: SegmentsToolpathState;
    bounds: THREE.Box3 | null;
};
export declare function disposeSegmentsToolpath(parent: THREE.Object3D, state: SegmentsToolpathState): void;
/** Vertex count through line `lineIndex` (inclusive); 0 before the first line. */
export declare function segmentsCursorForLine(state: SegmentsToolpathState, lineIndex: number): number;
/**
 * Progress through line `lineIndex`: "grey" recolours everything up to it with
 * the processed colour, "hide" stops drawing it.
 */
export declare function setSegmentsProgress(state: SegmentsToolpathState, lineIndex: number, mode: "hide" | "grey"): void;
/**
 * Progress up to vertex position `vertex`, which may fall part-way along a
 * segment (`2k + 2t`). "hide" skips whole segments with the draw range and
 * discards the processed part of the segment the boundary falls in.
 */
export declare function setSegmentsCursorVertex(state: SegmentsToolpathState, vertex: number, mode: "hide" | "grey"): void;
/**
 * Colour vertices through line `toLine` as "planned" (sent, not yet cut),
 * wherever they fall beyond the chunk's current processed cursor — the
 * shader's `else if` ordering (see FRAGMENT_BODY) means the processed cursor
 * always wins on overlap, so this never needs to know the lower bound
 * itself. Pass a line before the processed cursor (or < 0) to clear it.
 */
export declare function setSegmentsPlannedEnd(state: SegmentsToolpathState, toLine: number): void;
/**
 * `setSegmentsPlannedEnd` by vertex position. The planned gradient runs from
 * the processed cursor to here, so set the cursor first.
 */
export declare function setSegmentsPlannedEndVertex(state: SegmentsToolpathState, vertex: number): void;
/** Draw every vertex again (progress "hide" undone); greying is kept. */
export declare function showAllSegments(state: SegmentsToolpathState): void;
/** Clear progress greying and planned colouring. */
export declare function resetSegmentsColors(state: SegmentsToolpathState): void;
export declare function setSegmentsLineGroupVisible(state: SegmentsToolpathState, groupIndex: number, visible: boolean): void;
export declare function showAllSegmentsLineGroups(state: SegmentsToolpathState): void;
export declare function setSegmentsVisible(state: SegmentsToolpathState, visible: boolean): void;
export {};
