import * as THREE from "three";
import type { GCodeViewerOptions, GridUnits } from "../types";
import { disposeSpriteGroup } from "../render/textSprite";
type GridBounds = {
    min: {
        x: number;
        y: number;
    };
    max: {
        x: number;
        y: number;
    };
} | null;
export declare function createUnitGrid(args: {
    units: GridUnits;
    sizeXMm: number;
    sizeYMm: number;
    bounds?: GridBounds;
    theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group;
export declare function disposeLineSegmentsGroup(group: THREE.Object3D): void;
export declare function createAxes(args: {
    sizeXWorld: number;
    sizeYWorld: number;
    depthWorld: number;
    bounds?: GridBounds;
    theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group;
export declare function disposeAxesGroup(group: THREE.Object3D): void;
export declare function createGridLabels(args: {
    sizeXMm: number;
    sizeYMm: number;
    bounds?: GridBounds;
    units: GridUnits;
    theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group;
export { disposeSpriteGroup };
