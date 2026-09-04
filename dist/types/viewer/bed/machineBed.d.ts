import * as THREE from "three";
import type { GCodeViewerOptions } from "../types";
export declare function createMachineBedGroup(min: {
    x: number;
    y: number;
}, max: {
    x: number;
    y: number;
}, options: GCodeViewerOptions, keepout?: {
    min: {
        x: number;
        y: number;
    };
    max: {
        x: number;
        y: number;
    };
} | null): THREE.Group;
export declare function disposeMachineBedGroup(group: THREE.Object3D): void;
