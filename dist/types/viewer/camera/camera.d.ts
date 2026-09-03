import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GCodeViewerCameraView } from "../types";
/** Either projection the viewer can render through. */
export type GCodeViewerCameraLike = THREE.PerspectiveCamera | THREE.OrthographicCamera;
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
    camera: GCodeViewerCameraLike;
    target: THREE.Vector3;
    deltaX: number;
    deltaY: number;
    speed?: number;
}): void;
/**
 * Vertical world-space extent visible at `distance` under a perspective camera
 * of vertical field of view `fovDeg`. The bridge between the two projections:
 * an orthographic frustum of this height frames the same content as the
 * perspective camera does at that distance.
 */
export declare function frustumHeightAtDistance(distance: number, fovDeg: number): number;
/** Inverse of frustumHeightAtDistance: the standoff that frames `height`. */
export declare function distanceForFrustumHeight(height: number, fovDeg: number): number;
/**
 * How far back to sit to frame a model of the given size. `size.z` is added
 * rather than folded into the fit because the camera generally looks down at
 * the model from above, so the model's height eats into the standoff.
 */
export declare function fitDistanceForBounds(size: {
    x: number;
    y: number;
    z: number;
}, fovDeg: number, margin?: number): number;
/** Symmetric orthographic frustum framing `height` world units vertically. */
export declare function orthoFrustumFor(height: number, aspect: number): {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
/** Perspective near/far for a model of extent `maxDim`. */
export declare function perspectiveDepthRange(maxDim: number): {
    near: number;
    far: number;
};
/**
 * Orthographic near/far. Ortho depth is linear — there's no divide-by-z eating
 * precision near the camera — so a negative near costs nothing and guarantees
 * geometry behind the camera plane still draws, which matters because an ortho
 * camera is routinely positioned inside or below the model it is framing.
 */
export declare function orthoDepthRange(distance: number, maxDim: number): {
    near: number;
    far: number;
};
/**
 * Intersect a ray with the horizontal plane at `planeZ`.
 *
 * THREE.Ray.intersectPlane rejects hits behind the ray origin, which is wrong
 * for an orthographic camera: Raycaster.setFromCamera puts the ortho ray origin
 * at NDC z = (near + far) / (near - far), i.e. mid-frustum for the symmetric
 * range orthoDepthRange returns, so roughly half of all picks land behind it.
 * Under perspective the origin is the eye and a backward hit really is a miss,
 * hence the `allowBehind` switch.
 */
export declare function intersectRayWithZPlane(origin: THREE.Vector3, direction: THREE.Vector3, planeZ: number, allowBehind: boolean): THREE.Vector3 | null;
