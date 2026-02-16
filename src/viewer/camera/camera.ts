import * as THREE from "three";
import type { GCodeViewerCameraView } from "../types";

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
  camera: THREE.PerspectiveCamera;
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
