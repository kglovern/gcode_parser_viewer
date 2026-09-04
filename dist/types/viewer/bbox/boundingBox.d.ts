import * as THREE from "three";
import type { GCodeViewerOptions } from "../types";
export declare function createBoundingBoxGroup(bounds: THREE.Box3, options: GCodeViewerOptions): THREE.Group;
export declare function disposeBoundingBoxGroup(group: THREE.Object3D): void;
