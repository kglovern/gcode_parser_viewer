import { buildMovementVerticesFromLines } from "@src/geometry";
import type { PrecomputedSegmentGroup } from "@src/viewer/types";

export type PendantData = {
  groups: PrecomputedSegmentGroup[];
  meta: { minZ: number; maxZ: number };
  /** X/Y extent of the kept segments, or null when nothing was kept. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  stats: { rawSegments: number; kept: number; duplicates: number; degenerate: number; buildMs: number };
};

// Mirror of the sender worker's `svgOnly` path (Visualize.worker.ts): 2D
// segments [x1,y1,x2,y2] per colour, deduped on a 0.01 mm grid, so repeated
// depth passes and pure-Z moves collapse to one line. Kept in step by hand;
// the demo only needs the same shape and roughly the same reduction.
export function buildPendantData(
  text: string,
  colors: { rapid: string; cut: string },
  rapidOpacity = 0.35
): PendantData {
  const started = performance.now();
  const { rapid, cutting } = buildMovementVerticesFromLines(text.split(/\r?\n/));

  let minZ = Infinity;
  let maxZ = -Infinity;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const stats = { rawSegments: 0, kept: 0, duplicates: 0, degenerate: 0 };

  const dedupe = (verts: Float32Array): Float32Array => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i + 5 < verts.length; i += 6) {
      stats.rawSegments++;
      const x1 = verts[i], y1 = verts[i + 1], z1 = verts[i + 2];
      const x2 = verts[i + 3], y2 = verts[i + 4], z2 = verts[i + 5];
      minZ = Math.min(minZ, z1, z2);
      maxZ = Math.max(maxZ, z1, z2);
      let qx1 = Math.round(x1 * 100), qy1 = Math.round(y1 * 100);
      let qx2 = Math.round(x2 * 100), qy2 = Math.round(y2 * 100);
      if (qx1 === qx2 && qy1 === qy2) {
        stats.degenerate++;
        continue;
      }
      if (qx1 > qx2 || (qx1 === qx2 && qy1 > qy2)) {
        [qx1, qx2] = [qx2, qx1];
        [qy1, qy2] = [qy2, qy1];
      }
      const key = mixHash2(qx1, qy1) * 0x200000 + (mixHash2(qx2, qy2) >>> 11);
      if (seen.has(key)) {
        stats.duplicates++;
        continue;
      }
      seen.add(key);
      stats.kept++;
      out.push(x1, y1, x2, y2);
      minX = Math.min(minX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxX = Math.max(maxX, x1, x2);
      maxY = Math.max(maxY, y1, y2);
    }
    return Float32Array.from(out);
  };

  const cutVerts = dedupe(cutting);
  const rapidVerts = dedupe(rapid);
  const group = (hexColor: string, opacity: number, verts: Float32Array): PrecomputedSegmentGroup => ({
    hexColor,
    opacity,
    positionsBuffer: verts.buffer as ArrayBuffer,
    positionsLen: verts.length,
    stride: 4,
  });

  return {
    groups: [group(colors.cut, 1, cutVerts), group(colors.rapid, rapidOpacity, rapidVerts)],
    meta: { minZ: Number.isFinite(minZ) ? minZ : 0, maxZ: Number.isFinite(maxZ) ? maxZ : 0 },
    bounds: Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null,
    stats: { ...stats, buildMs: performance.now() - started },
  };
}

function mixHash2(a: number, b: number): number {
  let h = Math.imul(a, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 13;
  return h >>> 0;
}
