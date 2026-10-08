import * as THREE from "three";

/**
 * Segment groups already reduced to draw-ready line pairs, one group per
 * colour. stride 6 = 3D segments [x1,y1,z1,x2,y2,z2]; stride 4 = 2D top-down
 * segments [x1,y1,x2,y2] (what a worker's Z-deduped output emits).
 */
export type PrecomputedSegmentGroup = {
  hexColor: string;
  opacity: number;
  positionsBuffer: ArrayBuffer;
  positionsLen: number;
  stride?: 4 | 6;
};

export type PrecomputedSegmentMeta = { minZ?: number; maxZ?: number };

export type PrecomputedToolpathState = {
  group: THREE.Group;
  lines: THREE.LineSegments[];
};

/**
 * xyz vertex positions for one group. Stride 6 is already xyz and is viewed,
 * not copied; stride 4 is expanded with z = 0.
 */
export function precomputedGroupPositions(group: PrecomputedSegmentGroup): Float32Array {
  const verts = new Float32Array(group.positionsBuffer, 0, group.positionsLen);
  if ((group.stride ?? 6) === 6) {
    return verts;
  }
  const vertexCount = Math.floor(verts.length / 2);
  const out = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    out[v * 3] = verts[v * 2];
    out[v * 3 + 1] = verts[v * 2 + 1];
  }
  return out;
}

/**
 * Bounds over every group's xyz positions, or null when there are none. When
 * the data is 2D, `meta` supplies the Z extent the flattening threw away.
 */
export function precomputedBounds(
  positions: readonly Float32Array[],
  meta?: PrecomputedSegmentMeta
): THREE.Box3 | null {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  let any = false;
  for (const p of positions) {
    for (let i = 0; i + 2 < p.length; i += 3) {
      const x = p[i];
      const y = p[i + 1];
      const z = p[i + 2];
      if (x < min.x) min.x = x;
      if (y < min.y) min.y = y;
      if (z < min.z) min.z = z;
      if (x > max.x) max.x = x;
      if (y > max.y) max.y = y;
      if (z > max.z) max.z = z;
      any = true;
    }
  }
  if (!any) {
    return null;
  }
  if (meta?.minZ !== undefined && meta?.maxZ !== undefined) {
    min.z = meta.minZ;
    max.z = meta.maxZ;
  }
  return new THREE.Box3(min, max);
}

/** One LineSegments per group, each in its own colour and opacity. */
export function createPrecomputedToolpath(args: {
  groups: readonly PrecomputedSegmentGroup[];
  meta?: PrecomputedSegmentMeta;
  parent: THREE.Object3D;
}): { state: PrecomputedToolpathState; bounds: THREE.Box3 | null } {
  const group = new THREE.Group();
  group.name = "gviewer:precomputed-toolpath";
  const lines: THREE.LineSegments[] = [];
  const allPositions: Float32Array[] = [];

  for (const g of args.groups) {
    const positions = precomputedGroupPositions(g);
    if (positions.length < 6) {
      continue;
    }
    allPositions.push(positions);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const opacity = Math.max(0, Math.min(1, g.opacity));
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(g.hexColor),
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    const line = new THREE.LineSegments(geometry, material);
    // Every vertex is static, so skip the per-frame bounding-sphere frustum test.
    line.frustumCulled = false;
    // Translucent groups (rapids) draw after the opaque cuts.
    line.renderOrder = opacity < 1 ? 1 : 0;
    group.add(line);
    lines.push(line);
  }

  args.parent.add(group);
  return { state: { group, lines }, bounds: precomputedBounds(allPositions, args.meta) };
}

export function disposePrecomputedToolpath(parent: THREE.Object3D, state: PrecomputedToolpathState): void {
  parent.remove(state.group);
  for (const line of state.lines) {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }
  state.lines = [];
}
