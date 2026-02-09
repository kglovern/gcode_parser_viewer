import * as THREE from "three";
import type { GCodeViewerBitPosition, GCodeViewerOptions } from "../types";

export type BitMarker = {
  object: any;
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function createTriangleGeometry(size: number): any {
  const clampedSize = Math.max(0.001, size);
  const height = clampedSize * 1.6;
  const radius = clampedSize * 0.7;

  const geometry = new THREE.ConeGeometry(radius, height, 3, 1, false);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, height / 2);
  return geometry;
}

function createCircleGeometry(size: number): any {
  const clampedSize = Math.max(0.001, size);
  const radius = clampedSize * 0.65;

  const geometry = new THREE.SphereGeometry(radius, 18, 12);
  geometry.translate(0, 0, radius);
  return geometry;
}

function createBitGeometry(options: GCodeViewerOptions): any {
  const size = Math.max(0.001, options.bit.size);
  if (options.bit.type === "triangle") {
    return createTriangleGeometry(size);
  }
  return createCircleGeometry(size);
}

function createBitMesh(options: GCodeViewerOptions): any {
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

export function createBitMarker(initialOptions: GCodeViewerOptions): BitMarker {
  const root = new THREE.Group();
  root.name = "gviewer:bit-marker";
  root.visible = Boolean(initialOptions.bit.enabled);

  let currentOptions = initialOptions;
  let mesh = createBitMesh(currentOptions);
  root.add(mesh);

  let tween: TweenState | null = null;

  const setMeshOptions = (nextOptions: GCodeViewerOptions): void => {
    const nextType = nextOptions.bit.type;
    const prevType = currentOptions.bit.type;
    const nextSize = nextOptions.bit.size;
    const prevSize = currentOptions.bit.size;

    const typeChanged = nextType !== prevType;
    const sizeChanged = nextSize !== prevSize;

    const nextOpacity = clamp01(nextOptions.bit.opacity);

    const material = mesh.material as any;
    const needsRebuild = typeChanged || sizeChanged;
    if (needsRebuild) {
      root.remove(mesh);
      mesh.geometry.dispose?.();
      material?.dispose?.();
      mesh = createBitMesh(nextOptions);
      root.add(mesh);
    } else {
      if (material?.color) {
        material.color = new THREE.Color(BIT_COLOR);
      }
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
      root.remove(mesh);
      mesh.geometry.dispose?.();
      const material = mesh.material as any;
      material?.dispose?.();
    },
  };
}
