import type { GCodeViewerOptions } from "../types";
export type ToolpathStreamKind = "rapid" | "cut";
export type ToolpathStreamState = {
    line: any;
    baseColors: Float32Array;
    simColors: Float32Array;
    prefixEndVertex: Int32Array;
    totalVertices: number;
    greyCursorVertex: number;
    kind: ToolpathStreamKind;
    cutBucketIndex: number | null;
};
export type ToolpathStreamSpec = {
    kind: ToolpathStreamKind;
    cutBucketIndex: number | null;
    positions: Float32Array;
    prefixEndVertex: Int32Array;
    opacity: number;
};
export declare function createToolpathStreams(args: {
    specs: readonly ToolpathStreamSpec[];
    options: Readonly<GCodeViewerOptions>;
    scene: any;
}): {
    streams: ToolpathStreamState[];
    bounds: any | null;
};
export declare function disposeToolpathStreams(scene: any, streams: readonly ToolpathStreamState[]): void;
export declare function refreshToolpathStreamColors(streams: readonly ToolpathStreamState[], options: Readonly<GCodeViewerOptions>): void;
export declare function refreshToolpathStreamOpacities(args: {
    streams: readonly ToolpathStreamState[];
    options: Readonly<GCodeViewerOptions>;
    cutBucketCount: number;
}): void;
export declare function applyStreamGreyCursor(args: {
    stream: ToolpathStreamState;
    nextCursorVertex: number;
    options: Readonly<GCodeViewerOptions>;
}): void;
export declare function buildStreamBaseColors(kind: ToolpathStreamKind, totalVertices: number, options: Readonly<GCodeViewerOptions>): Float32Array;
export declare function processedRgb(options: Readonly<GCodeViewerOptions>): {
    r: number;
    g: number;
    b: number;
};
export declare function cutBucketOpacity(args: {
    bucketIndex: number;
    bucketCount: number;
    baseOpacity: number;
}): number;
