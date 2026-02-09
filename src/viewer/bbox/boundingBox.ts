import * as THREE from "three";
import type { GCodeViewerOptions } from "../types";
import { createTextSprite } from "../render/textSprite";

const MM_PER_INCH = 25.4;

export function createBoundingBoxGroup(bounds: any, options: GCodeViewerOptions): any {
  const group = new THREE.Group();
  const helper = new THREE.Box3Helper(
    bounds.clone(),
    new THREE.Color(options.render.theme.colors.boundingBox)
  );
  const helperMaterial = helper.material as any;
  helperMaterial.transparent = true;
  helperMaterial.opacity = 0.12;
  helperMaterial.depthWrite = false;
  group.add(helper);

  if (options.boundingBox.labels) {
    group.add(...createBoundingBoxLabels(bounds.clone(), options));
  }

  return group;
}

function createBoundingBoxLabels(bounds: any, options: GCodeViewerOptions): any[] {
  const color = options.render.theme.colors.boundingBox;
  const labelOpacity = 0.32;

  const format = (value: number) => {
    if (Math.abs(value) < 1e-9) {
      return "0";
    }
    return value.toFixed(3);
  };

  const formatWithUnits = (valueMm: number) => {
    if (options.units === "in") {
      return `${format(valueMm / MM_PER_INCH)} in`;
    }
    return `${format(valueMm)} mm`;
  };

  const min = bounds.min;
  const max = bounds.max;
  const make = (text: string) =>
    createTextSprite(text, color, { size: 4, opacity: labelOpacity });

  const xMinLabel = make(formatWithUnits(min.x));
  const xMaxLabel = make(formatWithUnits(max.x));
  const yMinLabel = make(formatWithUnits(min.y));
  const yMaxLabel = make(formatWithUnits(max.y));
  const zMinLabel = make(formatWithUnits(min.z));
  const zMaxLabel = make(formatWithUnits(max.z));

  const size = new THREE.Vector3();
  bounds.getSize(size);
  const offset = Math.max(2, Math.max(size.x, size.y, size.z) * 0.02);
  const centerX = (min.x + max.x) / 2;
  const centerY = (min.y + max.y) / 2;
  const centerZ = (min.z + max.z) / 2;

  xMinLabel.position.set(min.x - offset, centerY, min.z - offset);
  xMaxLabel.position.set(max.x + offset, centerY, min.z - offset);
  yMinLabel.position.set(centerX, min.y - offset, min.z - offset);
  yMaxLabel.position.set(centerX, max.y + offset, min.z - offset);
  zMinLabel.position.set(centerX, centerY, min.z - offset);
  zMaxLabel.position.set(centerX, centerY, max.z + offset);

  return [xMinLabel, xMaxLabel, yMinLabel, yMaxLabel, zMinLabel, zMaxLabel];
}

export function disposeBoundingBoxGroup(group: any): void {
  group.traverse((child: any) => {
    if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material as any;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      return;
    }
    if (child instanceof THREE.Sprite) {
      const material = child.material as any;
      material.map?.dispose();
      material.dispose();
    }
  });
}

