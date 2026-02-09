import { GCodeViewerOptions, GridUnits } from "./types";
export declare function createUnitGrid(args: {
    units: GridUnits;
    sizeMm: number;
    theme: GCodeViewerOptions["render"]["theme"];
}): any;
export declare function disposeLineSegmentsGroup(group: any): void;
export declare function createTextSprite(text: string, color: string, options?: {
    font?: string;
    padding?: number;
    opacity?: number;
}): any;
export declare function disposeSpriteGroup(group: any): void;
export declare function createAxes(args: {
    sizeWorld: number;
    depthWorld: number;
    theme: GCodeViewerOptions["render"]["theme"];
}): any;
export declare function disposeAxesGroup(group: any): void;
export declare function createGridLabels(args: {
    sizeMm: number;
    units: GridUnits;
    theme: GCodeViewerOptions["render"]["theme"];
}): any;
export declare function disposeBoundingBoxGroup(group: any): void;
