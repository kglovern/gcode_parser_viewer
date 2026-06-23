import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { GCodeViewerBitPosition, GCodeViewerOptions } from "../types";
import { DRILL_STL_BASE64 } from "./drill-stl-data";

export type BitMarker = {
  object: THREE.Object3D;
  update(nowMs: number): void;
  dispose(): void;
  setVisible(visible: boolean): void;
  setOptions(options: GCodeViewerOptions): void;
  setTarget(position: GCodeViewerBitPosition, options?: { immediate?: boolean }): void;
};

type TweenState = {
  startedAt: number;
  duration: number;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
};

const BIT_COLOR = "#c9883d";
const DRILL_COLOR = "#eef1f4";   // very light grey
const LASER_COLOR = "#a855f7";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function createTriangleGeometry(size: number): THREE.BufferGeometry {
  const clampedSize = Math.max(0.001, size);
  const height = clampedSize * 1.6;
  const radius = clampedSize * 0.7;

  const geometry = new THREE.ConeGeometry(radius, height, 3, 1, false);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, height / 2);
  return geometry;
}

function createCircleGeometry(size: number): THREE.BufferGeometry {
  const clampedSize = Math.max(0.001, size);
  const radius = clampedSize * 0.65;

  const geometry = new THREE.SphereGeometry(radius, 18, 12);
  geometry.translate(0, 0, radius);
  return geometry;
}

function createDrillGeometry(size: number): THREE.BufferGeometry {
  const binary = atob(DRILL_STL_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const loader = new STLLoader();
  const geometry = loader.parse(bytes.buffer);

  // STL is Y-oriented (horizontal) — rotate so the drill axis aligns with Z (vertical)
  geometry.rotateX(-Math.PI / 2);

  geometry.computeBoundingBox();
  const bbox0 = geometry.boundingBox!;
  const dims = new THREE.Vector3();
  bbox0.getSize(dims);
  const scale = (Math.max(0.001, size) * 1.6) / Math.max(dims.x, dims.y, dims.z, 0.001);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  const bbox1 = geometry.boundingBox!;
  geometry.translate(
    -(bbox1.min.x + bbox1.max.x) / 2,
    -(bbox1.min.y + bbox1.max.y) / 2,
    -bbox1.min.z
  );
  return geometry;
}

function createLaserObject(size: number, opacity: number): THREE.Group {
  const clampedSize = Math.max(0.001, size);
  const height = clampedSize * 3.0;
  const innerRadius = clampedSize * 0.15;
  const outerRadius = clampedSize * 0.35;
  const clampedOpacity = clamp01(opacity);

  // radiusTop=0 ends up at z=0 (workpiece/tip) after rotateX + translate
  const innerGeo = new THREE.CylinderGeometry(0, innerRadius, height, 8, 1, false);
  innerGeo.rotateX(-Math.PI / 2);
  innerGeo.translate(0, 0, height / 2);

  const outerGeo = new THREE.CylinderGeometry(0, outerRadius, height, 8, 1, true);
  outerGeo.rotateX(-Math.PI / 2);
  outerGeo.translate(0, 0, height / 2);

  const innerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(LASER_COLOR),
    transparent: true,
    opacity: clampedOpacity,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const outerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(LASER_COLOR),
    transparent: true,
    opacity: clampedOpacity * 0.3,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.renderOrder = 1000;

  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.renderOrder = 1000;

  const group = new THREE.Group();
  group.add(innerMesh);
  group.add(outerMesh);
  return group;
}

function createBitGeometry(options: GCodeViewerOptions): THREE.BufferGeometry {
  const size = Math.max(0.001, options.bit.size);
  if (options.bit.type === "triangle") {
    return createTriangleGeometry(size);
  }
  if (options.bit.type === "drill") {
    return createDrillGeometry(size);
  }
  return createCircleGeometry(size);
}

function resolveDrillColor(options: GCodeViewerOptions): string {
  return options.bit.colorSource === "custom" ? options.bit.color : DRILL_COLOR;
}

function createDrillMesh(options: GCodeViewerOptions): THREE.Mesh {
  const opacity = clamp01(options.bit.opacity);
  const geometry = createDrillGeometry(Math.max(0.001, options.bit.size));
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolveDrillColor(options)),
    metalness: 0.75,
    roughness: 0.3,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1000;
  return mesh;
}

function createBitMesh(options: GCodeViewerOptions): THREE.Mesh {
  const opacity = clamp01(options.bit.opacity);
  const geometry = createBitGeometry(options);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(BIT_COLOR),
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1000;
  return mesh;
}

function createBitObject(options: GCodeViewerOptions): THREE.Object3D {
  if (options.bit.type === "laser") {
    return createLaserObject(options.bit.size, options.bit.opacity);
  }
  if (options.bit.type === "drill") {
    return createDrillMesh(options);
  }
  return createBitMesh(options);
}

function disposeBitObject(obj: THREE.Object3D): void {
  if (obj instanceof THREE.Mesh) {
    obj.geometry.dispose();
    (obj.material as THREE.Material).dispose();
  } else if (obj instanceof THREE.Group) {
    for (const child of obj.children) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }
}

export function createBitMarker(initialOptions: GCodeViewerOptions): BitMarker {
  const root = new THREE.Group();
  root.name = "gviewer:bit-marker";
  root.visible = Boolean(initialOptions.bit.enabled);

  let currentOptions = initialOptions;
  let bitObject = createBitObject(currentOptions);
  root.add(bitObject);

  let tween: TweenState | null = null;

  const setMeshOptions = (nextOptions: GCodeViewerOptions): void => {
    const nextType = nextOptions.bit.type;
    const prevType = currentOptions.bit.type;
    const nextSize = nextOptions.bit.size;
    const prevSize = currentOptions.bit.size;

    const typeChanged = nextType !== prevType;
    const sizeChanged = nextSize !== prevSize;

    const nextOpacity = clamp01(nextOptions.bit.opacity);

    const needsRebuild = typeChanged || sizeChanged;
    if (needsRebuild) {
      root.remove(bitObject);
      disposeBitObject(bitObject);
      bitObject = createBitObject(nextOptions);
      root.add(bitObject);
    } else if (nextType === "laser") {
      // Update laser opacity in place
      const group = bitObject as THREE.Group;
      const [innerMesh, outerMesh] = group.children as THREE.Mesh[];
      const innerMat = innerMesh.material as THREE.MeshBasicMaterial;
      const outerMat = outerMesh.material as THREE.MeshBasicMaterial;
      innerMat.opacity = nextOpacity;
      innerMat.needsUpdate = true;
      outerMat.opacity = nextOpacity * 0.3;
      outerMat.needsUpdate = true;
    } else {
      const mesh = bitObject as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
      material.color = new THREE.Color(nextType === "drill" ? resolveDrillColor(nextOptions) : BIT_COLOR);
      material.opacity = nextOpacity;
      material.transparent = nextOpacity < 1;
      material.needsUpdate = true;
    }

    currentOptions = nextOptions;
    root.visible = Boolean(nextOptions.bit.enabled);
  };

  const setTarget = (position: GCodeViewerBitPosition, options?: { immediate?: boolean }): void => {
    const immediate = Boolean(options?.immediate);
    const x = Number(position.x) || 0;
    const y = Number(position.y) || 0;
    const z = Number(position.z) || 0;
    void position.a;

    if (immediate || currentOptions.bit.tweenMs <= 0) {
      tween = null;
      root.position.set(x, y, z);
      return;
    }

    tween = {
      startedAt: performance.now(),
      duration: Math.max(1, currentOptions.bit.tweenMs),
      from: { x: root.position.x, y: root.position.y, z: root.position.z },
      to: { x, y, z },
    };
  };

  return {
    object: root,
    setVisible: (visible) => {
      root.visible = Boolean(visible);
    },
    setOptions: (options) => setMeshOptions(options),
    setTarget,
    update: (nowMs) => {
      if (!tween) return;
      const t = (nowMs - tween.startedAt) / tween.duration;
      const eased = easeOutCubic(t);

      root.position.set(
        THREE.MathUtils.lerp(tween.from.x, tween.to.x, eased),
        THREE.MathUtils.lerp(tween.from.y, tween.to.y, eased),
        THREE.MathUtils.lerp(tween.from.z, tween.to.z, eased)
      );

      if (t >= 1) {
        root.position.set(tween.to.x, tween.to.y, tween.to.z);
        tween = null;
      }
    },
    dispose: () => {
      root.remove(bitObject);
      disposeBitObject(bitObject);
    },
  };
}
