import * as THREE from "three";
import type { GCodeViewerOptions, GridUnits } from "../types";
import { createTextSprite, disposeSpriteGroup } from "../render/textSprite";

const MM_PER_INCH = 25.4;

export function createUnitGrid(args: {
  units: GridUnits;
  sizeXMm: number;
  sizeYMm: number;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  // Half-extents are independent per axis so each quadrant reflects the
  // machine's actual width/depth rather than a single square span.
  const halfX = Math.max(1, args.sizeXMm) / 2;
  const halfY = Math.max(1, args.sizeYMm) / 2;
  const stepWorld = args.units === "mm" ? 10 : MM_PER_INCH;
  const countX = Math.max(0, Math.floor(halfX / stepWorld));
  const countY = Math.max(0, Math.floor(halfY / stepWorld));

  const centerVertices: number[] = [];
  const gridVertices: number[] = [];

  const pushLineXY = (x1: number, y1: number, x2: number, y2: number, target: number[]) => {
    target.push(x1, y1, 0, x2, y2, 0);
  };

  // Horizontal lines (constant y, spanning the X extent).
  for (let i = -countY; i <= countY; i += 1) {
    const y = i * stepWorld;
    pushLineXY(-halfX, y, halfX, y, i === 0 ? centerVertices : gridVertices);
  }

  // Vertical lines (constant x, spanning the Y extent).
  for (let i = -countX; i <= countX; i += 1) {
    const x = i * stepWorld;
    pushLineXY(x, -halfY, x, halfY, i === 0 ? centerVertices : gridVertices);
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
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const group = new THREE.Group();
  const halfX = Math.max(1, args.sizeXWorld) / 2;
  const halfY = Math.max(1, args.sizeYWorld) / 2;
  const depth = Math.max(1, args.depthWorld);
  const dashSize = Math.max(1, Math.min(Math.max(halfX, halfY) / 12, 30));
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
      new THREE.Vector3(-halfX, 0, 0),
      new THREE.Vector3(halfX, 0, 0),
    ]),
    lineMaterial(args.theme.colors.axes.x)
  );
  xLine.computeLineDistances();

  const yLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -halfY, 0),
      new THREE.Vector3(0, halfY, 0),
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
  xLabel.position.set(halfX + labelOffset, 0, 0);
  const yLabel = createTextSprite("Y", args.theme.colors.axes.y, { size: 5 });
  yLabel.position.set(0, halfY + labelOffset, 0);
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
  units: GridUnits;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const group = new THREE.Group();
  const halfXWorld = Math.max(1, args.sizeXMm) / 2;
  const halfYWorld = Math.max(1, args.sizeYMm) / 2;
  const displayStep = args.units === "mm" ? 10 : 1;
  const displayStart = displayStep;
  const displayIncrement = displayStep * 2;
  const unitScale = args.units === "mm" ? 1 : MM_PER_INCH;
  const displayMaxX = args.units === "mm" ? halfXWorld : halfXWorld / MM_PER_INCH;
  const displayMaxY = args.units === "mm" ? halfYWorld : halfYWorld / MM_PER_INCH;

  const opacity = 0.5;
  const size = 4;
  const z = 0.1;
  const axisOffset = 5;

  const xColor = args.theme.colors.axes.x;
  const yColor = args.theme.colors.axes.y;
  const spriteOptions = { opacity, size };

  for (let value = displayStart; value <= displayMaxX + 1e-6; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (worldValue > halfXWorld + 1e-6) {
      continue;
    }
    const xPos = createTextSprite(String(value), xColor, spriteOptions);
    xPos.position.set(worldValue, axisOffset, z);
    const xNeg = createTextSprite(String(-value), xColor, spriteOptions);
    xNeg.position.set(-worldValue, axisOffset, z);
    group.add(xPos, xNeg);
  }

  for (let value = displayStart; value <= displayMaxY + 1e-6; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (worldValue > halfYWorld + 1e-6) {
      continue;
    }
    const yPos = createTextSprite(String(value), yColor, spriteOptions);
    yPos.position.set(-axisOffset, worldValue, z);
    const yNeg = createTextSprite(String(-value), yColor, spriteOptions);
    yNeg.position.set(-axisOffset, -worldValue, z);
    group.add(yPos, yNeg);
  }

  return group;
}

export { disposeSpriteGroup };
