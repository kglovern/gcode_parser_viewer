import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GCodeViewerCameraView } from "../types";

/** Either projection the viewer can render through. */
export type GCodeViewerCameraLike = THREE.PerspectiveCamera | THREE.OrthographicCamera;

// Stock OrbitControls' vertical drag direction (drag down orbits the camera
// toward the top pole) reads as inverted to this viewer's users, and there's
// no public per-axis rotate speed to flip just that axis. `_rotateUp` is a
// real prototype method but isn't part of OrbitControls' public .d.ts (it's
// only underscore-prefixed-private by convention), so calling it needs a
// type assertion; a future three.js release could rename or remove it
// without a compile error, so re-check this override after upgrading three.
type OrbitControlsWithPrivateRotate = OrbitControls & { _rotateUp(angle: number): void };

export class VerticalInvertOrbitControls extends OrbitControls {
  _rotateUp(angle: number): void {
    (OrbitControls.prototype as unknown as OrbitControlsWithPrivateRotate)._rotateUp.call(this, -angle);
  }
}

export function ensureContainerOverlayLayout(container: HTMLElement): void {
  const style = window.getComputedStyle(container);
  if (style.position === "static" || !style.position) {
    container.style.position = "relative";
  }
  if (!container.style.overflow) {
    container.style.overflow = "hidden";
  }
}

export function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const inv = -2 * t + 2;
  return 1 - (inv * inv * inv) / 2;
}

export function viewDirection(view: GCodeViewerCameraView): THREE.Vector3 {
  const dir = new THREE.Vector3();
  const axes = {
    right: new THREE.Vector3(1, 0, 0),
    left: new THREE.Vector3(-1, 0, 0),
    front: new THREE.Vector3(0, -1, 0),
    back: new THREE.Vector3(0, 1, 0),
    top: new THREE.Vector3(0, 0, 1),
    bottom: new THREE.Vector3(0, 0, -1),
  };

  switch (view) {
    case "front":
      dir.copy(axes.front);
      break;
    case "back":
      dir.copy(axes.back);
      break;
    case "left":
      dir.copy(axes.left);
      break;
    case "right":
      dir.copy(axes.right);
      break;
    case "top":
      dir.copy(axes.top);
      break;
    case "bottom":
      dir.copy(axes.bottom);
      break;
    case "front-top-left":
      dir.copy(axes.front).add(axes.top).add(axes.left);
      break;
    case "front-top-right":
      dir.copy(axes.front).add(axes.top).add(axes.right);
      break;
    case "front-bottom-left":
      dir.copy(axes.front).add(axes.bottom).add(axes.left);
      break;
    case "front-bottom-right":
      dir.copy(axes.front).add(axes.bottom).add(axes.right);
      break;
    case "back-top-left":
      dir.copy(axes.back).add(axes.top).add(axes.left);
      break;
    case "back-top-right":
      dir.copy(axes.back).add(axes.top).add(axes.right);
      break;
    case "back-bottom-left":
      dir.copy(axes.back).add(axes.bottom).add(axes.left);
      break;
    case "back-bottom-right":
      dir.copy(axes.back).add(axes.bottom).add(axes.right);
      break;
    default:
      dir.copy(axes.front);
      break;
  }

  return dir.normalize();
}

export function dominantCameraFace(
  cameraPosition: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): "front" | "back" | "left" | "right" | "top" | "bottom" {
  const dx = cameraPosition.x - target.x;
  const dy = cameraPosition.y - target.y;
  const dz = cameraPosition.z - target.z;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const az = Math.abs(dz);
  if (az >= ax && az >= ay) {
    return dz >= 0 ? "top" : "bottom";
  }
  if (ax >= ay) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "back" : "front";
}

export function orbitCameraByPixels(args: {
  camera: GCodeViewerCameraLike;
  target: THREE.Vector3;
  deltaX: number;
  deltaY: number;
  speed?: number;
}): void {
  const speed = args.speed ?? 0.007;
  const target = args.target;
  const offset = args.camera.position.clone().sub(target);
  const radius = Math.max(1e-6, offset.length());
  let theta = Math.atan2(offset.y, offset.x);
  let phi = Math.acos(Math.min(1, Math.max(-1, offset.z / radius)));

  theta -= args.deltaX * speed;
  phi += args.deltaY * speed;
  const epsilon = 1e-4;
  phi = Math.min(Math.PI - epsilon, Math.max(epsilon, phi));

  const sinPhi = Math.sin(phi);
  const next = new THREE.Vector3(
    radius * sinPhi * Math.cos(theta),
    radius * sinPhi * Math.sin(theta),
    radius * Math.cos(phi)
  );

  args.camera.position.copy(target.clone().add(next));
  args.camera.lookAt(target);
}

/**
 * Vertical world-space extent visible at `distance` under a perspective camera
 * of vertical field of view `fovDeg`. The bridge between the two projections:
 * an orthographic frustum of this height frames the same content as the
 * perspective camera does at that distance.
 */
export function frustumHeightAtDistance(distance: number, fovDeg: number): number {
  return 2 * distance * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
}

/** Inverse of frustumHeightAtDistance: the standoff that frames `height`. */
export function distanceForFrustumHeight(height: number, fovDeg: number): number {
  return height / 2 / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
}

/**
 * How far back to sit to frame a model of the given size. `size.z` is added
 * rather than folded into the fit because the camera generally looks down at
 * the model from above, so the model's height eats into the standoff.
 */
export function fitDistanceForBounds(
  size: { x: number; y: number; z: number },
  fovDeg: number,
  margin = 1.25
): number {
  const halfMax = Math.max(size.x, size.y, 1) / 2;
  return distanceForFrustumHeight(halfMax * 2, fovDeg) * margin + size.z;
}

/** Symmetric orthographic frustum framing `height` world units vertically. */
export function orthoFrustumFor(
  height: number,
  aspect: number
): { left: number; right: number; top: number; bottom: number } {
  const halfHeight = Math.max(1e-6, height) / 2;
  const halfWidth = halfHeight * Math.max(1e-6, aspect);
  return { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight };
}

/** Perspective near/far for a model of extent `maxDim`. */
export function perspectiveDepthRange(maxDim: number): { near: number; far: number } {
  const dim = Math.max(1, maxDim);
  return { near: dim / 1000, far: dim * 50 };
}

/**
 * Orthographic near/far. Ortho depth is linear — there's no divide-by-z eating
 * precision near the camera — so a negative near costs nothing and guarantees
 * geometry behind the camera plane still draws, which matters because an ortho
 * camera is routinely positioned inside or below the model it is framing.
 */
export function orthoDepthRange(distance: number, maxDim: number): { near: number; far: number } {
  const span = Math.max(1, Math.max(distance, maxDim)) * 4;
  return { near: -span, far: span };
}

/**
 * Intersect a ray with the horizontal plane at `planeZ`.
 *
 * THREE.Ray.intersectPlane rejects hits behind the ray origin. Under a
 * perspective camera that origin is the eye, and a backward hit really is a
 * miss. Under ortho the origin sits on the camera plane, but the negative near
 * from orthoDepthRange means geometry *behind* that plane is still on screen —
 * so a pick plane above a camera dollied down into the model is a legitimate
 * hit that intersectPlane would silently drop. Hence `allowBehind`.
 */
export function intersectRayWithZPlane(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  planeZ: number,
  allowBehind: boolean
): THREE.Vector3 | null {
  const denominator = direction.z;
  if (Math.abs(denominator) < 1e-9) {
    return null;
  }
  const t = (planeZ - origin.z) / denominator;
  if (t < 0 && !allowBehind) {
    return null;
  }
  return origin.clone().addScaledVector(direction, t);
}
