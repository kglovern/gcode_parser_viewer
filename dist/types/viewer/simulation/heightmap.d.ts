export type CuttingMove = {
    lineIndex: number;
    x0: number;
    y0: number;
    z0: number;
    x1: number;
    y1: number;
    z1: number;
};
export type SlabBounds = {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zTop: number;
    zBot: number;
};
export type Sim3dData = {
    moves: CuttingMove[];
    checkpoints: Map<number, Float32Array>;
    slabBounds: SlabBounds;
    resolution: number;
    toolRadius: number;
};
export declare function buildSim3dData(lines: readonly string[], toolRadius: number, resolution: number, options?: {
    arcSegments?: number;
    checkpointEveryLines?: number;
    batch?: {
        yieldEveryLines?: number;
        shouldAbort?: () => boolean;
        onProgress?: (processed: number, total: number) => void;
    };
}): Promise<Sim3dData>;
export declare function applyMoveToHeightmap(move: CuttingMove, heightmap: Float32Array, bounds: SlabBounds, toolRadius: number, resolution: number): void;
export declare function seekHeightmap(targetLine: number, sim: Sim3dData): Float32Array;
export declare function erodeHeightmap(hm: Float32Array, resolution: number, passes: number, zTop: number): void;
