import { ArcMoveCallback, LinearMoveCallback, Position, WorkerGeometryData } from "./types";
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
