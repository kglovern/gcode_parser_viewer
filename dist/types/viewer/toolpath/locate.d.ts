import type { SegmentsToolpathState } from "./segments";
/**
 * Finding the bit on a segments toolpath.
 *
 * Progress greying used to follow a line count (an estimate of the line being
 * executed). Here it follows geometry instead: the live bit position is
 * matched against the segments of the lines that may be executing, so the
 * processed/planned boundary sits under the bit, part-way along a segment if
 * need be, whatever the feed override or estimate quality.
 *
 * Positions are in vertex units: segment `k` spans vertices `2k` and `2k+1`,
 * and a point at fraction `t` along it is vertex position `2k + 2t`. Whole
 * values are the vertex counts `prefixEndVertex` uses, so line boundaries and
 * located positions compare directly.
 */
export type LocatePoint = {
    x: number;
    y: number;
    z: number;
};
export type LocateOptions = {
    /** Allowed distance from the toolpath (mm) on short segments. */
    tolerance: number;
    /**
     * Extra allowance per mm of segment length, for arcs drawn as chords (a
     * chord bows away from the real arc by up to ~3% of its length when the
     * tessellation hits its division cap).
     */
    tolerancePerLength: number;
    /** Upper bound on the allowance, however long the segment. */
    maxTolerance: number;
    /** A later segment wins only when this much closer (mm). */
    epsilon: number;
};
export declare const defaultLocateOptions: LocateOptions;
export type LocateResult = {
    /** Fractional global vertex position (`2k + 2t`). */
    vertex: number;
    distance: number;
};
/**
 * Closest point on the toolpath to `point` among the segments that overlap
 * vertex positions `[fromVertex, toVertex]`. Ties go to the earliest segment:
 * where the path revisits a spot (plunge and retract, repeated passes) it is
 * better to lag the bit than to grey a cut that has not happened yet.
 * Returns null when no segment is within tolerance.
 */
export declare function locateOnSegments(state: Pick<SegmentsToolpathState, "chunks">, point: LocatePoint, fromVertex: number, toVertex: number, options?: LocateOptions): LocateResult | null;
/** Vertex position where line `lineIndex` starts. */
export declare function segmentsLineStartVertex(state: SegmentsToolpathState, lineIndex: number): number;
/** The line a vertex position falls in (the last line for positions at the very end). */
export declare function segmentsLineForVertex(state: SegmentsToolpathState, vertex: number): number;
export type RunProgressState = {
    /** Processed boundary (fractional vertex position); only ever moves forward. */
    cursorVertex: number;
    /** Consecutive updates the bit was not found on the window. */
    misses: number;
};
export declare function createRunProgressState(): RunProgressState;
export type RunProgressArgs = {
    /** First line of this run (start-from-line); 0 for a whole-file run. */
    minLine: number;
    /** Last line sent to the controller: the planned span ends with it. */
    plannedLine: number;
    /** Line-based processed edge to fall back on while the bit is off the path. */
    fallbackLine?: number;
    /** Consecutive misses before `fallbackLine` is used. */
    fallbackAfterMisses: number;
    locate: LocateOptions;
};
/**
 * Move the processed boundary to the bit, searching only between the current
 * boundary and the end of the planned lines. When the bit is not on that
 * stretch (approach moves, tool changes, a position that does not match the
 * file) the boundary holds, then follows `fallbackLine` once it has missed
 * `fallbackAfterMisses` times in a row. It never moves backwards.
 */
export declare function advanceRunProgress(state: SegmentsToolpathState, run: RunProgressState, point: LocatePoint, args: RunProgressArgs): {
    located: boolean;
    cursorVertex: number;
    plannedEndVertex: number;
};
