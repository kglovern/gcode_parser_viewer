import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GCodeViewerCameraView } from "../types";
export declare class VerticalInvertOrbitControls extends OrbitControls {
    _rotateUp(angle: number): void;
}
export declare function ensureContainerOverlayLayout(container: HTMLElement): void;
export declare function easeInOutCubic(t: number): number;
export declare function viewDirection(view: GCodeViewerCameraView): THREE.Vector3;
export declare function dominantCameraFace(cameraPosition: {
    x: number;
    y: number;
    z: number;
}, target: {
    x: number;
    y: number;
    z: number;
}): "front" | "back" | "left" | "right" | "top" | "bottom";
export declare function orbitCameraByPixels(args: {
    camera: THREE.PerspectiveCamera;
    target: THREE.Vector3;
    deltaX: number;
    deltaY: number;
    speed?: number;
}): void;
