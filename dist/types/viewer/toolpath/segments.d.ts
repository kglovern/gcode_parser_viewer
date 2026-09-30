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
 * re-uploads any vertex data.
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
    uSegRapidOpacity: Uniform<number>;
    uSegCutOpacity: Uniform<number>;
    uSegMaxPower: Uniform<number>;
};
type ChunkUniforms = {
    uSegCursor: Uniform<number>;
    uSegHiddenCount: Uniform<number>;
    uSegHidden: Uniform<THREE.Vector2[]>;
};
export type SegmentsChunkState = {
    line: THREE.LineSegments;
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
/** Theme and palette colours/opacities into the shared uniforms. */
export declare function applySegmentsTheme(state: Pick<SegmentsToolpathState, "shared" | "paletteHex">, options: Readonly<GCodeViewerOptions>): void;
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
/** Draw every vertex again (progress "hide" undone); greying is kept. */
export declare function showAllSegments(state: SegmentsToolpathState): void;
/** Clear progress greying. */
export declare function resetSegmentsColors(state: SegmentsToolpathState): void;
export declare function setSegmentsLineGroupVisible(state: SegmentsToolpathState, groupIndex: number, visible: boolean): void;
export declare function showAllSegmentsLineGroups(state: SegmentsToolpathState): void;
export declare function setSegmentsVisible(state: SegmentsToolpathState, visible: boolean): void;
export {};
