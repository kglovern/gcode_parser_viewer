import type { GCodeViewerCameraView } from "../types";
export declare function ensureContainerOverlayLayout(container: HTMLElement): void;
export declare function easeInOutCubic(t: number): number;
export declare function viewDirection(view: GCodeViewerCameraView): any;
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
    camera: any;
    target: any;
    deltaX: number;
    deltaY: number;
    speed?: number;
}): void;
