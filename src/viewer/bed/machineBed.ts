import * as THREE from "three";
import type { GCodeViewerOptions } from "../types";

export function createMachineBedGroup(
  min: { x: number; y: number },
  max: { x: number; y: number },
  options: GCodeViewerOptions
): THREE.Group {
  const group = new THREE.Group();

  const positions = new Float32Array([
    min.x, min.y, 0,
    max.x, min.y, 0,
    max.x, max.y, 0,
    min.x, max.y, 0,
    min.x, min.y, 0,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(options.render.theme.colors.machineBed),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  group.add(new THREE.LineLoop(geometry, material));

  return group;
}

export function disposeMachineBedGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }
  });
}
