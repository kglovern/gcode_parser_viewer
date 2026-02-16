import * as THREE from "three";
import type { GCodeViewerOptions, GridUnits } from "../types";
import { disposeSpriteGroup } from "../render/textSprite";
export declare function createUnitGrid(args: {
    units: GridUnits;
    sizeMm: number;
    theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group;
export declare function disposeLineSegmentsGroup(group: THREE.Object3D): void;
export declare function createAxes(args: {
    sizeWorld: number;
    depthWorld: number;
    theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group;
export declare function disposeAxesGroup(group: THREE.Object3D): void;
export declare function createGridLabels(args: {
    sizeMm: number;
    units: GridUnits;
    theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group;
export { disposeSpriteGroup };
