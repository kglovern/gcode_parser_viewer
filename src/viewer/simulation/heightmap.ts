import { GCodeVirtualizer } from "../../virtualizer";
import type { PlaneMode, MotionMode } from "../../types";

export type CuttingMove = {
  lineIndex: number;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
};

export type SlabBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zTop: number;
  zBot: number;
};

export type Sim3dData = {
  moves: CuttingMove[];
  checkpoints: Map<number, Float32Array>;
  slabBounds: SlabBounds;
  resolution: number;
  toolRadius: number;
};

export async function buildSim3dData(
  lines: readonly string[],
  toolRadius: number,
  resolution: number,
  options?: {
    arcSegments?: number;
    checkpointEveryLines?: number;
    batch?: {
      yieldEveryLines?: number;
      shouldAbort?: () => boolean;
      onProgress?: (processed: number, total: number) => void;
    };
  }
): Promise<Sim3dData> {
  const safeResolution = Math.max(2, Math.floor(resolution));
  const arcSegments = options?.arcSegments ?? 30;
  const checkpointEvery = options?.checkpointEveryLines ?? 2000;
  const yieldEvery = options?.batch?.yieldEveryLines ?? 10000;
  const shouldAbort = options?.batch?.shouldAbort ?? (() => false);
  const onProgress = options?.batch?.onProgress;

  // Degenerate empty input
  if (lines.length === 0) {
    const bounds: SlabBounds = {
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      zTop: 1,
      zBot: 0,
    };
    const heightmap = new Float32Array(safeResolution * safeResolution).fill(bounds.zTop);
    const checkpoints = new Map<number, Float32Array>();
    checkpoints.set(0, new Float32Array(heightmap));
    return { moves: [], checkpoints, slabBounds: bounds, resolution: safeResolution, toolRadius };
  }

  // Pass 1: compute SlabBounds.
  // XY bounds: all moves (G0+G1+G2+G3) — but only within the cutting-Z range so a distant
  //   machine-home rapid doesn't inflate the slab footprint.
  // Z bounds: cutting moves (G1/G2/G3) only — G0 is at clearance height, not cut depth.
  //   zMax is the stock surface (the highest Z the tool actually cuts).
  //   zMin is the deepest cut.
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity,
    zMin = Infinity,
    zMax = -Infinity;

  const pass1 = new GCodeVirtualizer({
    onLinearMove(args) {
      // Slab XY footprint and Z range are based on cutting moves only.
      // G0 XY is excluded: a machine-home rapid (e.g. G0 X0 Y0 at the end of a job)
      // would inflate the slab to cover the whole machine envelope.
      // G0 Z is excluded: it's the clearance height, not a cut depth.
      // (G0 moves ARE applied in Pass 2 for material removal — they just don't
      // set the slab size. Out-of-slab G0 portions are simply clipped by
      // applyMoveToHeightmap's bounds check.)
      if (args.modals.motion === "G0") return;
      const s = args.transformedStart ?? args.start;
      const e = args.transformedEnd ?? args.end;
      for (const p of [s, e]) {
        if (p.X < xMin) xMin = p.X;
        if (p.X > xMax) xMax = p.X;
        if (p.Y < yMin) yMin = p.Y;
        if (p.Y > yMax) yMax = p.Y;
        if (p.Z < zMin) zMin = p.Z;
        if (p.Z > zMax) zMax = p.Z;
      }
    },
    onArcMove(args) {
      const s = args.transformedStart ?? args.start;
      const e = args.transformedEnd ?? args.end;
      const m = args.transformedMax ?? args.max;
      for (const p of [s, e, m]) {
        if (p.X < xMin) xMin = p.X;
        if (p.X > xMax) xMax = p.X;
        if (p.Y < yMin) yMin = p.Y;
        if (p.Y > yMax) yMax = p.Y;
        if (p.Z < zMin) zMin = p.Z;
        if (p.Z > zMax) zMax = p.Z;
      }
    },
  });

  for (const line of lines) {
    pass1.processLine(line);
  }

  // Handle degenerate cases where no cutting moves found
  if (!isFinite(xMin)) {
    xMin = -1;
    xMax = 1;
    yMin = -1;
    yMax = 1;
    zMin = 0;
    zMax = 0;
  }

  // Pad XY for degenerate 1D case
  if (xMin === xMax) {
    xMin -= toolRadius * 2;
    xMax += toolRadius * 2;
  }
  if (yMin === yMax) {
    yMin -= toolRadius * 2;
    yMax += toolRadius * 2;
  }

  // Add toolRadius margin so cuts near edge don't clip
  xMin -= toolRadius;
  xMax += toolRadius;
  yMin -= toolRadius;
  yMax += toolRadius;

  // zTop = the stock surface = the highest Z the tool actually cuts.
  // Adding toolRadius would put the stock "above" the shallowest cut and create
  // artificial islands (every uncut cell would be toolRadius proud of adjacent
  // surfaces). Using zMax directly means uncut stock is flush with the shallowest
  // cut, which is the correct 2.5D assumption.
  const zTop = zMax;
  let zBot = zMin - toolRadius;
  // Ensure minimum slab thickness
  if (zBot >= zTop) {
    zBot = zTop - 1;
  }

  const slabBounds: SlabBounds = { xMin, xMax, yMin, yMax, zTop, zBot };

  // Allocate active heightmap filled to zTop (pristine stock)
  const activeHeightmap = new Float32Array(safeResolution * safeResolution).fill(zTop);

  // Store checkpoint at line 0
  const checkpoints = new Map<number, Float32Array>();
  checkpoints.set(0, new Float32Array(activeHeightmap));

  const moves: CuttingMove[] = [];
  let lastCheckpointLine = 0;

  // Pass 2: build moves, apply to heightmap, take checkpoints.
  // ALL linear moves (G0 and G1) are included in material removal.
  // G0 at clearance height: pz > heightmap value everywhere → min() is a no-op (correct).
  // G0 at cutting depth crossing an uncut area: lowers the cell, eliminating "islands"
  //   that would not exist in reality (the tool physically traverses that space).
  // The GCode XY position is treated as the tool CENTER; removal is a circular footprint
  // of radius toolRadius (flat-end mill model). No G41/G42 compensation is applied.
  let lineIndex = 0;
  const pass2 = new GCodeVirtualizer({
    onLinearMove(args) {
      const s = args.transformedStart ?? args.start;
      const e = args.transformedEnd ?? args.end;
      const move: CuttingMove = {
        lineIndex,
        x0: s.X,
        y0: s.Y,
        z0: s.Z,
        x1: e.X,
        y1: e.Y,
        z1: e.Z,
      };
      moves.push(move);
      applyMoveToHeightmap(move, activeHeightmap, slabBounds, toolRadius, safeResolution);
    },
    onArcMove(args) {
      // Tessellate arc into linear segments
      const s = args.transformedStart ?? args.start;
      const e = args.transformedEnd ?? args.end;
      const c = args.transformedCenter ?? args.center;
      const segs = tessellateArc(s, e, c, args.plane, args.motion, arcSegments);
      for (const seg of segs) {
        const move: CuttingMove = { lineIndex, ...seg };
        moves.push(move);
        applyMoveToHeightmap(move, activeHeightmap, slabBounds, toolRadius, safeResolution);
      }
    },
  });

  for (let i = 0; i < lines.length; i++) {
    if (shouldAbort()) break;
    lineIndex = i;
    const line = lines[i];
    if (line !== undefined) {
      pass2.processLine(line);
    }

    // Checkpoint
    if (i - lastCheckpointLine >= checkpointEvery) {
      checkpoints.set(i, new Float32Array(activeHeightmap));
      lastCheckpointLine = i;
    }

    // Yield
    if (i % yieldEvery === 0 && i > 0) {
      onProgress?.(i, lines.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(lines.length, lines.length);

  return { moves, checkpoints, slabBounds, resolution: safeResolution, toolRadius };
}

export function applyMoveToHeightmap(
  move: CuttingMove,
  heightmap: Float32Array,
  bounds: SlabBounds,
  toolRadius: number,
  resolution: number
): void {
  const cellW = (bounds.xMax - bounds.xMin) / resolution;
  const cellH = (bounds.yMax - bounds.yMin) / resolution;
  const segLen2D = Math.hypot(move.x1 - move.x0, move.y1 - move.y0);
  const marchStep = Math.max(0.001, Math.min(cellW, cellH) * 0.5);
  const steps = Math.max(1, Math.ceil(segLen2D / marchStep));
  const toolCellsX = Math.ceil(toolRadius / cellW);
  const toolCellsY = Math.ceil(toolRadius / cellH);
  const toolRadius2 = toolRadius * toolRadius;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = move.x0 + (move.x1 - move.x0) * t;
    const py = move.y0 + (move.y1 - move.y0) * t;
    const pz = move.z0 + (move.z1 - move.z0) * t;

    const cx = Math.floor((px - bounds.xMin) / cellW);
    const cy = Math.floor((py - bounds.yMin) / cellH);

    for (let dx = -toolCellsX; dx <= toolCellsX; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= resolution) continue;
      const worldCx = bounds.xMin + (nx + 0.5) * cellW;
      const distX2 = (worldCx - px) * (worldCx - px);
      if (distX2 > toolRadius2) continue;

      for (let dy = -toolCellsY; dy <= toolCellsY; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= resolution) continue;
        const worldCy = bounds.yMin + (ny + 0.5) * cellH;
        const dist2 = distX2 + (worldCy - py) * (worldCy - py);
        if (dist2 > toolRadius2) continue;

        const idx = ny * resolution + nx;
        if (heightmap[idx] > pz) {
          heightmap[idx] = pz;
        }
      }
    }
  }
}

export function seekHeightmap(targetLine: number, sim: Sim3dData): Float32Array {
  // Find largest checkpoint key <= targetLine
  let checkpointLine = 0;
  for (const key of sim.checkpoints.keys()) {
    if (key <= targetLine && key > checkpointLine) {
      checkpointLine = key;
    }
  }

  const base = sim.checkpoints.get(checkpointLine);
  const heightmap = base ? new Float32Array(base) : new Float32Array(sim.resolution * sim.resolution).fill(sim.slabBounds.zTop);

  // Apply all moves from (checkpointLine, targetLine]
  for (const move of sim.moves) {
    if (move.lineIndex > checkpointLine && move.lineIndex <= targetLine) {
      applyMoveToHeightmap(move, heightmap, sim.slabBounds, sim.toolRadius, sim.resolution);
    }
  }

  return heightmap;
}

export function erodeHeightmap(
  hm: Float32Array,
  resolution: number,
  passes: number,
  zTop: number
): void {
  if (passes <= 0) return;
  const EPSILON = 0.001;
  const size = resolution * resolution;
  const tmp = new Float32Array(size);

  for (let pass = 0; pass < passes; pass++) {
    tmp.set(hm);
    for (let iy = 0; iy < resolution; iy++) {
      for (let ix = 0; ix < resolution; ix++) {
        const v = tmp[iy * resolution + ix];
        if (v < zTop - EPSILON) continue; // already cut
        let minNeighbor = zTop;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = iy + dy;
          if (ny < 0 || ny >= resolution) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = ix + dx;
            if (nx < 0 || nx >= resolution) continue;
            const n = tmp[ny * resolution + nx];
            if (n < minNeighbor) minNeighbor = n;
          }
        }
        if (minNeighbor < zTop - EPSILON) {
          hm[iy * resolution + ix] = minNeighbor;
        }
      }
    }
  }
}

// --- Arc tessellation ---

type SegXYZ = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };

function tessellateArc(
  start: { X: number; Y: number; Z: number },
  end: { X: number; Y: number; Z: number },
  center: { X: number; Y: number; Z: number },
  plane: PlaneMode,
  motion: MotionMode,
  arcSegments: number
): SegXYZ[] {
  const N = Math.max(1, arcSegments);

  // Determine primary/secondary/tertiary axes for the plane
  let pa: "X" | "Y" | "Z", sa: "X" | "Y" | "Z", ta: "X" | "Y" | "Z";
  if (plane === "G18") {
    pa = "Z"; sa = "X"; ta = "Y";
  } else if (plane === "G19") {
    pa = "Y"; sa = "Z"; ta = "X";
  } else {
    pa = "X"; sa = "Y"; ta = "Z";
  }

  const r = Math.hypot(start[pa] - center[pa], start[sa] - center[sa]);
  const startAngle = Math.atan2(start[sa] - center[sa], start[pa] - center[pa]);
  const endAngle = Math.atan2(end[sa] - center[sa], end[pa] - center[pa]);

  // Compute sweep angle
  let sweep: number;
  if (motion === "G2") {
    // CW: sweep negative
    sweep = endAngle - startAngle;
    if (sweep > 0) sweep -= Math.PI * 2;
  } else {
    // CCW: sweep positive
    sweep = endAngle - startAngle;
    if (sweep < 0) sweep += Math.PI * 2;
  }

  const segments: SegXYZ[] = [];
  let prevPoint = { ...start };

  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const angle = startAngle + sweep * t;
    const tZ = t;

    const curPrimary = center[pa] + r * Math.cos(angle);
    const curSecondary = center[sa] + r * Math.sin(angle);
    const curTertiary = start[ta] + (end[ta] - start[ta]) * tZ;

    const curPoint: { X: number; Y: number; Z: number } = { X: 0, Y: 0, Z: 0 };
    curPoint[pa] = curPrimary;
    curPoint[sa] = curSecondary;
    curPoint[ta] = curTertiary;

    segments.push({
      x0: prevPoint.X,
      y0: prevPoint.Y,
      z0: prevPoint.Z,
      x1: curPoint.X,
      y1: curPoint.Y,
      z1: curPoint.Z,
    });

    prevPoint = curPoint;
  }

  return segments;
}
