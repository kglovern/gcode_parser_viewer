import { ArcMoveCallback, LinearMoveCallback, Position, WorkerGeometryData, LoadWorkerDataOptions } from "./types";
export type VertexCollector = {
    onLinearMove?: (args: Parameters<LinearMoveCallback>[0], vertices: number[]) => void;
    onArcMove?: (args: Parameters<ArcMoveCallback>[0], vertices: number[]) => void;
};
export type VertexBuildOptions = {
    arcSegments?: number;
    collector?: VertexCollector;
};
export type BatchBuildOptions = {
    onProgress?: (processed: number, total: number) => void;
    everyLines?: number;
    yieldEveryLines?: number;
    shouldAbort?: () => boolean;
};
export type MovementVertices = {
    rapid: Float32Array;
    cutting: Float32Array;
};
export type LaserBucket = {
    opacity: number;
    vertices: Float32Array;
};
export type LaserVertices = {
    rapid: Float32Array;
    buckets: LaserBucket[];
    minPower: number;
    maxPower: number;
};
export declare function buildVerticesFromLines(lines: Iterable<string>, options?: VertexBuildOptions): Float32Array;
export declare function buildMovementVerticesFromLines(lines: Iterable<string>, options?: Omit<VertexBuildOptions, "collector">): MovementVertices;
export declare function buildMovementVerticesFromLinesBatched(lines: readonly string[], options?: Omit<VertexBuildOptions, "collector"> & {
    batch?: BatchBuildOptions;
}): Promise<MovementVertices>;
export type MovementGeometryLineKind = 0 | 1 | 2 | 3;
export type MovementGeometry = {
    positions: Float32Array;
    lineStartVertex: Int32Array;
    lineEndVertex: Int32Array;
    lineKind: Uint8Array;
    prefixEndVertex: Int32Array;
};
export declare function buildMovementGeometryFromLinesBatched(lines: readonly string[], options?: Omit<VertexBuildOptions, "collector"> & {
    batch?: BatchBuildOptions;
}): Promise<MovementGeometry>;
export declare function buildLaserVerticesFromLines(lines: Iterable<string>, options?: {
    arcSegments?: number;
    bucketCount?: number;
    baseOpacity?: number;
}): LaserVertices;
export declare function buildLaserVerticesFromLinesBatched(lines: readonly string[], options?: {
    arcSegments?: number;
    bucketCount?: number;
    baseOpacity?: number;
    batch?: BatchBuildOptions;
}): Promise<LaserVertices>;
export type LaserGeometryBucket = {
    opacity: number;
    positions: Float32Array;
    prefixEndVertex: Int32Array;
};
export type LaserGeometry = {
    rapidPositions: Float32Array;
    rapidPrefixEndVertex: Int32Array;
    buckets: LaserGeometryBucket[];
    minPower: number;
    maxPower: number;
};
export type ToolpathGeometryStream = {
    positions: Float32Array;
    prefixEndVertex: Int32Array;
};
export type ToolpathGeometry = {
    rapid: ToolpathGeometryStream;
    cuts: ToolpathGeometryStream[];
    cutBucketCount: number;
    minPower: number;
    maxPower: number;
};
export declare function buildToolpathGeometryFromLinesBatched(lines: readonly string[], options?: {
    arcSegments?: number;
    bucketCount?: number;
    laserMode?: boolean;
    batch?: BatchBuildOptions;
}): Promise<ToolpathGeometry>;
export declare function buildLaserGeometryFromLinesBatched(lines: readonly string[], options?: {
    arcSegments?: number;
    bucketCount?: number;
    baseOpacity?: number;
    batch?: BatchBuildOptions;
}): Promise<LaserGeometry>;
export declare function pushXYZ(vertices: number[], position: Position): void;
export type WorkerSegmentGroup = {
    hexColor: string;
    opacity: number;
    positions: Float32Array;
    rgbColors: Float32Array;
};
export declare function buildWorkerSegmentGroups(data: WorkerGeometryData): WorkerSegmentGroup[];
export type WorkerToolpathStream = {
    positions: Float32Array;
    colors: Float32Array;
    prefixEndVertex: Int32Array;
    /**
     * Index into the `lineGroups` this stream was built for, or null for the
     * catch-all stream holding lines that fell in no group.
     */
    lineGroupIndex: number | null;
};
export type WorkerToolpathStreams = {
    rapids: WorkerToolpathStream[];
    cuts: WorkerToolpathStream[];
};
/**
 * Builds line-ordered toolpath streams (rapid + cut) from worker geometry,
 * preserving per-vertex colours and producing per-stream `prefixEndVertex`
 * arrays (indexed by source line) so `hideUntilLine`/progress greying works on
 * the worker-data path.
 *
 * Unlike `buildWorkerSegmentGroups`, segments are appended in source-line order
 * (driven by `frames`) rather than grouped by colour, which is what the
 * cumulative `prefixEndVertex` cursor requires.
 *
 * With no `lineGroups`, the result is exactly one rapid stream and one cut
 * stream, both with a null `lineGroupIndex`. Passing `lineGroups` splits both by
 * source-line range instead - one rapid and one cut stream per group, plus a
 * trailing pair for the lines in no group - so a host can hide an interior span
 * by flipping those streams' visibility, which a single contiguous draw range
 * (all `hideUntilLine` can offer) cannot express. Each group keeps its own
 * carry-forward `prefixEndVertex`, so progress greying stays correct within
 * every stream.
 *
 * Grouping costs an `Int32Array(framesLen)` per stream, so memory grows with
 * lines x groups. It is meant for interactive review of a file already held in
 * memory, not for the live job path.
 */
export declare function buildWorkerToolpathStreams(data: WorkerGeometryData, options?: LoadWorkerDataOptions): WorkerToolpathStreams;
