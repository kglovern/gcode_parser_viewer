import * as THREE from "three";
import type { GCodeViewerOptions, GridUnits } from "../types";
import { createTextSprite, disposeSpriteGroup } from "../render/textSprite";

const MM_PER_INCH = 25.4;

export function createUnitGrid(args: {
  units: GridUnits;
  sizeMm: number;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const sizeWorld = Math.max(1, args.sizeMm);
  const half = sizeWorld / 2;
  const stepWorld = args.units === "mm" ? 10 : MM_PER_INCH;
  const count = Math.max(0, Math.floor(half / stepWorld));

  const centerVertices: number[] = [];
  const gridVertices: number[] = [];

  const pushLineXY = (x1: number, y1: number, x2: number, y2: number, target: number[]) => {
    target.push(x1, y1, 0, x2, y2, 0);
  };

  for (let i = -count; i <= count; i += 1) {
    const y = i * stepWorld;
    pushLineXY(-half, y, half, y, i === 0 ? centerVertices : gridVertices);
  }

  for (let i = -count; i <= count; i += 1) {
    const x = i * stepWorld;
    pushLineXY(x, -half, x, half, i === 0 ? centerVertices : gridVertices);
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
  sizeWorld: number;
  depthWorld: number;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const group = new THREE.Group();
  const half = Math.max(1, args.sizeWorld) / 2;
  const depth = Math.max(1, args.depthWorld);
  const dashSize = Math.max(1, Math.min(half / 12, 30));
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
      new THREE.Vector3(-half, 0, 0),
      new THREE.Vector3(half, 0, 0),
    ]),
    lineMaterial(args.theme.colors.axes.x)
  );
  xLine.computeLineDistances();

  const yLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -half, 0),
      new THREE.Vector3(0, half, 0),
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
  xLabel.position.set(half + labelOffset, 0, 0);
  const yLabel = createTextSprite("Y", args.theme.colors.axes.y, { size: 5 });
  yLabel.position.set(0, half + labelOffset, 0);
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
  sizeMm: number;
  units: GridUnits;
  theme: GCodeViewerOptions["render"]["theme"];
}): THREE.Group {
  const group = new THREE.Group();
  const halfWorld = Math.max(1, args.sizeMm) / 2;
  const displayStep = args.units === "mm" ? 10 : 1;
  const displayStart = displayStep;
  const displayMax = args.units === "mm" ? halfWorld : halfWorld / MM_PER_INCH;
  const displayIncrement = displayStep * 2;
  const unitScale = args.units === "mm" ? 1 : MM_PER_INCH;

  const opacity = 0.5;
  const size = 4;
  const z = 0.1;
  const axisOffset = 5;

  for (let value = displayStart; value <= displayMax + 1e-6; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (worldValue > halfWorld + 1e-6) {
      continue;
    }

    const xColor = args.theme.colors.axes.x;
    const yColor = args.theme.colors.axes.y;

    const spriteOptions = { opacity, size };

    const xPos = createTextSprite(String(value), xColor, spriteOptions);
    xPos.position.set(worldValue, axisOffset, z);
    const xNeg = createTextSprite(String(-value), xColor, spriteOptions);
    xNeg.position.set(-worldValue, axisOffset, z);

    const yPos = createTextSprite(String(value), yColor, spriteOptions);
    yPos.position.set(-axisOffset, worldValue, z);
    const yNeg = createTextSprite(String(-value), yColor, spriteOptions);
    yNeg.position.set(-axisOffset, -worldValue, z);

    group.add(xPos, xNeg, yPos, yNeg);
  }

  return group;
}

export { disposeSpriteGroup };
