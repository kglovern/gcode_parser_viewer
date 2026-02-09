import type { GCodeViewerOptions, GridUnits } from "../types";
import { disposeSpriteGroup } from "../render/textSprite";
export declare function createUnitGrid(args: {
    units: GridUnits;
    sizeMm: number;
    theme: GCodeViewerOptions["render"]["theme"];
}): any;
export declare function disposeLineSegmentsGroup(group: any): void;
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
export { disposeSpriteGroup };
