import * as THREE from "three";
import type { GCodeViewerOptions, GridUnits } from "../types";
import { createTextSprite, disposeSpriteGroup } from "../render/textSprite";

const MM_PER_INCH = 25.4;

type GridBounds = { min: { x: number; y: number }; max: { x: number; y: number } } | null;

// Resolves the box grid/axes/labels are drawn within. With no bounds, it's
// the usual symmetric square centered on the origin; with bounds (the "trim
// to machine bed" option), it's the literal (possibly off-center) box.
function resolveBounds(args: {
  sizeXMm: number;
  sizeYMm: number;
  bounds?: GridBounds;
}): { minX: number; maxX: number; minY: number; maxY: number } {
  if (args.bounds) {
    return {
      minX: args.bounds.min.x,
      maxX: args.bounds.max.x,
      minY: args.bounds.min.y,
      maxY: args.bounds.max.y,
    };
  }
  const halfX = Math.max(1, args.sizeXMm) / 2;
  const halfY = Math.max(1, args.sizeYMm) / 2;
  return { minX: -halfX, maxX: halfX, minY: -halfY, maxY: halfY };
}

export function createUnitGrid(args: {
  units: GridUnits;
  sizeXMm: number;
  sizeYMm: number;
  bounds?: GridBounds;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  // Half-extents (or explicit bounds) are independent per axis so each
  // quadrant reflects the machine's actual width/depth rather than a single
  // square span.
  const { minX, maxX, minY, maxY } = resolveBounds(args);
  const stepWorld = args.units === "mm" ? 10 : MM_PER_INCH;

  const centerVertices: number[] = [];
  const gridVertices: number[] = [];

  const pushLineXY = (x1: number, y1: number, x2: number, y2: number, target: number[]) => {
    target.push(x1, y1, 0, x2, y2, 0);
  };

  // Horizontal lines (constant y, spanning the X extent), step-aligned to
  // absolute world positions so trimmed bounds clip the same grid rather
  // than re-tiling it from the box corner.
  const startY = Math.ceil(minY / stepWorld) * stepWorld;
  const endY = Math.floor(maxY / stepWorld) * stepWorld;
  for (let y = startY; y <= endY + 1e-6; y += stepWorld) {
    pushLineXY(minX, y, maxX, y, Math.abs(y) < 1e-6 ? centerVertices : gridVertices);
  }

  // Vertical lines (constant x, spanning the Y extent).
  const startX = Math.ceil(minX / stepWorld) * stepWorld;
  const endX = Math.floor(maxX / stepWorld) * stepWorld;
  for (let x = startX; x <= endX + 1e-6; x += stepWorld) {
    pushLineXY(x, minY, x, maxY, Math.abs(x) < 1e-6 ? centerVertices : gridVertices);
  }

  const group = new THREE.Group();
  if (gridVertices.length > 0) {
    group.add(createLineSegments(gridVertices, args.theme.colors.grid.minor, 0.25));
  }
  if (centerVertices.length > 0) {
    group.add(createLineSegments(centerVertices, args.theme.colors.grid.major, 0.4));
  }
  return group;
}

function createLineSegments(vertices: number[], color: string, opacity: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineSegments(geometry, material);
}

export function disposeLineSegmentsGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.LineSegments)) {
      return;
    }
    child.geometry.dispose();
    const material = child.material as THREE.Material | THREE.Material[];
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material.dispose();
    }
  });
}

export function createAxes(args: {
  sizeXWorld: number;
  sizeYWorld: number;
  depthWorld: number;
  bounds?: GridBounds;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const group = new THREE.Group();
  const { minX, maxX, minY, maxY } = resolveBounds({
    sizeXMm: args.sizeXWorld,
    sizeYMm: args.sizeYWorld,
    bounds: args.bounds,
  });
  const depth = Math.max(1, args.depthWorld);
  const dashSize = Math.max(1, Math.min(Math.max(maxX - minX, maxY - minY) / 24, 30));
  const gapSize = dashSize * 0.6;

  const lineMaterial = (color: string) =>
    new THREE.LineDashedMaterial({
      color: new THREE.Color(color),
      dashSize,
      gapSize,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

  const xLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(minX, 0, 0),
      new THREE.Vector3(maxX, 0, 0),
    ]),
    lineMaterial(args.theme.colors.axes.x)
  );
  xLine.computeLineDistances();

  const yLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, minY, 0),
      new THREE.Vector3(0, maxY, 0),
    ]),
    lineMaterial(args.theme.colors.axes.y)
  );
  yLine.computeLineDistances();

  const zLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, depth),
    ]),
    lineMaterial(args.theme.colors.axes.z)
  );
  zLine.computeLineDistances();

  group.add(xLine, yLine, zLine);

  const labelOffset = Math.max(2, dashSize);
  const xLabel = createTextSprite("X", args.theme.colors.axes.x, { size: 5 });
  xLabel.position.set(maxX + labelOffset, 0, 0);
  const yLabel = createTextSprite("Y", args.theme.colors.axes.y, { size: 5 });
  yLabel.position.set(0, maxY + labelOffset, 0);
  const zLabel = createTextSprite("Z", args.theme.colors.axes.z, { size: 5 });
  zLabel.position.set(0, 0, depth + labelOffset);

  group.add(xLabel, yLabel, zLabel);
  return group;
}

export function disposeAxesGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      return;
    }
    if (child instanceof THREE.Sprite) {
      const material = child.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }
  });
}

export function createGridLabels(args: {
  sizeXMm: number;
  sizeYMm: number;
  bounds?: GridBounds;
  units: GridUnits;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const group = new THREE.Group();
  const { minX, maxX, minY, maxY } = resolveBounds(args);
  const displayStep = args.units === "mm" ? 10 : 1;
  const displayIncrement = displayStep * 2;
  const unitScale = args.units === "mm" ? 1 : MM_PER_INCH;

  const opacity = 0.5;
  const size = 4;
  const z = 0.1;
  const axisOffset = 5;

  const xColor = args.theme.colors.axes.x;
  const yColor = args.theme.colors.axes.y;
  const spriteOptions = { opacity, size };

  // Independent per-direction loops (not paired +/-value) so an off-center
  // trimmed box only emits labels that actually fall within it.
  for (let value = displayStep; ; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (worldValue > maxX + 1e-6) {
      break;
    }
    const xPos = createTextSprite(String(value), xColor, spriteOptions);
    xPos.position.set(worldValue, axisOffset, z);
    group.add(xPos);
  }
  for (let value = displayStep; ; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (-worldValue < minX - 1e-6) {
      break;
    }
    const xNeg = createTextSprite(String(-value), xColor, spriteOptions);
    xNeg.position.set(-worldValue, axisOffset, z);
    group.add(xNeg);
  }

  for (let value = displayStep; ; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (worldValue > maxY + 1e-6) {
      break;
    }
    const yPos = createTextSprite(String(value), yColor, spriteOptions);
    yPos.position.set(-axisOffset, worldValue, z);
    group.add(yPos);
  }
  for (let value = displayStep; ; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (-worldValue < minY - 1e-6) {
      break;
    }
    const yNeg = createTextSprite(String(-value), yColor, spriteOptions);
    yNeg.position.set(-axisOffset, -worldValue, z);
    group.add(yNeg);
  }

  return group;
}

export { disposeSpriteGroup };
