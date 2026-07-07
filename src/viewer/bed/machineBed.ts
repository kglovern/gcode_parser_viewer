import * as THREE from "three";
import type { GCodeViewerOptions } from "../types";

function createRectOutline(
  min: { x: number; y: number },
  max: { x: number; y: number },
  color: string
): THREE.LineLoop {
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
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  return new THREE.LineLoop(geometry, material);
}

// Diagonal (45 degree) hatch lines clipped to the rectangle, "no-go zone"
// striping. Spacing is in scene units (mm).
function createHatchLines(
  min: { x: number; y: number },
  max: { x: number; y: number },
  color: string,
  spacing = 10
): THREE.LineSegments {
  const positions: number[] = [];
  // Diagonal lines have the form y = x - c; c ranges across the rect's
  // diagonal extent so every stripe crossing the rectangle is covered.
  const cMin = min.x - max.y;
  const cMax = max.x - min.y;
  for (let c = cMin; c <= cMax; c += spacing) {
    const xStart = Math.max(min.x, min.y + c);
    const xEnd = Math.min(max.x, max.y + c);
    if (xEnd > xStart) {
      positions.push(xStart, xStart - c, 0, xEnd, xEnd - c, 0);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));

  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  return new THREE.LineSegments(geometry, material);
}

export function createMachineBedGroup(
  min: { x: number; y: number },
  max: { x: number; y: number },
  options: GCodeViewerOptions,
  keepout?: { min: { x: number; y: number }; max: { x: number; y: number } } | null
): THREE.Group {
  const group = new THREE.Group();

  group.add(createRectOutline(min, max, options.render.theme.colors.machineBed));

  if (keepout) {
    const keepoutColor = options.render.theme.colors.machineBedKeepout;
    group.add(createRectOutline(keepout.min, keepout.max, keepoutColor));
    group.add(createHatchLines(keepout.min, keepout.max, keepoutColor));
  }

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
