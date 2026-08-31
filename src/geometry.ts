import { ArcMoveCallback, LinearMoveCallback, PlaneMode, Position, WorkerGeometryData, LoadWorkerDataOptions } from "./types";
import { GCodeParser } from "./parser";
import { GCodeVirtualizer } from "./virtualizer";

export type VertexCollector = {
  onLinearMove?: (args: Parameters<LinearMoveCallback>[0], vertices: number[]) => void;
  onArcMove?: (args: Parameters<ArcMoveCallback>[0], vertices: number[]) => void;
};

export type VertexBuildOptions = {
  arcSegments?: number;
  collector?: VertexCollector;
};

export type BatchBuildOptions = {
  onProgress?: (processed: number, total: number) => void;
  everyLines?: number;
  yieldEveryLines?: number;
  shouldAbort?: () => boolean;
};

export type MovementVertices = {
  rapid: Float32Array;
  cutting: Float32Array;
};

export type LaserBucket = {
  opacity: number;
  vertices: Float32Array;
};

export type LaserVertices = {
  rapid: Float32Array;
  buckets: LaserBucket[];
  minPower: number;
  maxPower: number;
};

export function buildVerticesFromLines(
  lines: Iterable<string>,
  options: VertexBuildOptions = {}
): Float32Array {
  const vertices: number[] = [];
  const arcSegments = options.arcSegments ?? 30;
  const collector = options.collector ?? {};
  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const handler = collector.onLinearMove ?? defaultLinearCollector;
      handler(args, vertices);
    },
    onArcMove: (args) => {
      const handler =
        collector.onArcMove ??
        ((payload, list) => {
          tessellateArc(payload, list, arcSegments);
        });
      handler(args, vertices);
    },
  });

  for (const line of lines) {
    if (!line) {
      continue;
    }
    virtualizer.processLine(line);
  }

  return Float32Array.from(vertices);
}

export function buildMovementVerticesFromLines(
  lines: Iterable<string>,
  options: Omit<VertexBuildOptions, "collector"> = {}
): MovementVertices {
  const rapidVertices: number[] = [];
  const cuttingVertices: number[] = [];
  const arcSegments = options.arcSegments ?? 30;
  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const start = args.transformedStart ?? args.start;
      const end = args.transformedEnd ?? args.end;
      const target = args.modals.motion === "G0" ? rapidVertices : cuttingVertices;
      target.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
    },
    onArcMove: (args) => {
      const target = args.modals.motion === "G0" ? rapidVertices : cuttingVertices;
      tessellateArc(args, target, arcSegments);
    },
  });

  for (const line of lines) {
    if (!line) {
      continue;
    }
    virtualizer.processLine(line);
  }

  return {
    rapid: Float32Array.from(rapidVertices),
    cutting: Float32Array.from(cuttingVertices),
  };
}

export async function buildMovementVerticesFromLinesBatched(
  lines: readonly string[],
  options: Omit<VertexBuildOptions, "collector"> & { batch?: BatchBuildOptions } = {}
): Promise<MovementVertices> {
  const rapidVertices: number[] = [];
  const cuttingVertices: number[] = [];
  const arcSegments = options.arcSegments ?? 30;
  const batch = options.batch;
  const everyLines = Math.max(1, Math.floor(batch?.everyLines ?? 5000));
  const yieldEveryLines = Math.max(0, Math.floor(batch?.yieldEveryLines ?? 50000));
  let nextProgressAt = everyLines;
  let nextYieldAt = yieldEveryLines > 0 ? yieldEveryLines : Number.POSITIVE_INFINITY;
  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const start = args.transformedStart ?? args.start;
      const end = args.transformedEnd ?? args.end;
      const target = args.modals.motion === "G0" ? rapidVertices : cuttingVertices;
      target.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
    },
    onArcMove: (args) => {
      const target = args.modals.motion === "G0" ? rapidVertices : cuttingVertices;
      tessellateArc(args, target, arcSegments);
    },
  });

  const total = lines.length;
  for (let index = 0; index < total; index += 1) {
    if (batch?.shouldAbort?.()) {
      throw new Error("Aborted.");
    }
    const line = lines[index];
    if (!line) {
      if (batch?.onProgress && (index + 1 === total || index + 1 === nextProgressAt)) {
        batch.onProgress(index + 1, total);
        nextProgressAt += everyLines;
      }
      if (yieldEveryLines > 0 && (index + 1 === total || index + 1 === nextYieldAt)) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        nextYieldAt += yieldEveryLines;
      }
      continue;
    }
    virtualizer.processLine(line);
    if (batch?.onProgress && (index + 1 === total || index + 1 === nextProgressAt)) {
      batch.onProgress(index + 1, total);
      nextProgressAt += everyLines;
    }
    if (yieldEveryLines > 0 && (index + 1 === total || index + 1 === nextYieldAt)) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      nextYieldAt += yieldEveryLines;
    }
  }

  return {
    rapid: Float32Array.from(rapidVertices),
    cutting: Float32Array.from(cuttingVertices),
  };
}

export type MovementGeometryLineKind = 0 | 1 | 2 | 3;

export type MovementGeometry = {
  positions: Float32Array;
  lineStartVertex: Int32Array;
  lineEndVertex: Int32Array;
  lineKind: Uint8Array;
  prefixEndVertex: Int32Array;
};

export async function buildMovementGeometryFromLinesBatched(
  lines: readonly string[],
  options: Omit<VertexBuildOptions, "collector"> & { batch?: BatchBuildOptions } = {}
): Promise<MovementGeometry> {
  const vertices: number[] = [];
  const arcSegments = options.arcSegments ?? 30;
  const batch = options.batch;
  const everyLines = Math.max(1, Math.floor(batch?.everyLines ?? 5000));
  const yieldEveryLines = Math.max(0, Math.floor(batch?.yieldEveryLines ?? 50000));
  let nextProgressAt = everyLines;
  let nextYieldAt = yieldEveryLines > 0 ? yieldEveryLines : Number.POSITIVE_INFINITY;

  const lineStartVertex = new Int32Array(lines.length);
  lineStartVertex.fill(-1);
  const lineEndVertex = new Int32Array(lines.length);
  lineEndVertex.fill(-1);
  const lineKind = new Uint8Array(lines.length);
  const prefixEndVertex = new Int32Array(lines.length);

  let activeLineIndex = -1;
  let activeLineKind: MovementGeometryLineKind = 0;

  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const kind: MovementGeometryLineKind = args.modals.motion === "G0" ? 1 : 2;
      if (activeLineIndex >= 0) {
        if (activeLineKind === 0) {
          activeLineKind = kind;
        } else if (activeLineKind !== kind) {
          activeLineKind = 3;
        }
      }
      defaultLinearCollector(args, vertices);
    },
    onArcMove: (args) => {
      const kind: MovementGeometryLineKind = args.modals.motion === "G0" ? 1 : 2;
      if (activeLineIndex >= 0) {
        if (activeLineKind === 0) {
          activeLineKind = kind;
        } else if (activeLineKind !== kind) {
          activeLineKind = 3;
        }
      }
      tessellateArc(args, vertices, arcSegments);
    },
  });

  const total = lines.length;
  for (let index = 0; index < total; index += 1) {
    if (batch?.shouldAbort?.()) {
      throw new Error("Aborted.");
    }

    const startVertex = vertices.length / 3;
    activeLineIndex = index;
    activeLineKind = 0;

    const line = lines[index];
    if (line) {
      virtualizer.processLine(line);
    }

    activeLineIndex = -1;
    const endVertex = vertices.length / 3;

    if (endVertex > startVertex) {
      lineStartVertex[index] = startVertex;
      lineEndVertex[index] = endVertex;
      lineKind[index] = activeLineKind;
    }
    prefixEndVertex[index] = endVertex;

    if (batch?.onProgress && (index + 1 === total || index + 1 === nextProgressAt)) {
      batch.onProgress(index + 1, total);
      nextProgressAt += everyLines;
    }
    if (yieldEveryLines > 0 && (index + 1 === total || index + 1 === nextYieldAt)) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      nextYieldAt += yieldEveryLines;
    }
  }

  return {
    positions: Float32Array.from(vertices),
    lineStartVertex,
    lineEndVertex,
    lineKind,
    prefixEndVertex,
  };
}

export function buildLaserVerticesFromLines(
  lines: Iterable<string>,
  options: { arcSegments?: number; bucketCount?: number; baseOpacity?: number } = {}
): LaserVertices {
  const arcSegments = options.arcSegments ?? 30;
  const bucketCount = Math.max(1, Math.floor(options.bucketCount ?? 16));
  const baseOpacity = options.baseOpacity ?? 0.9;

  const { minPower, maxPower } = findPowerRange(lines);
  const rapidVertices: number[] = [];
  const bucketVertices: number[][] = Array.from({ length: bucketCount }, () => []);

  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const start = args.transformedStart ?? args.start;
      const end = args.transformedEnd ?? args.end;
      if (args.modals.motion === "G0") {
        rapidVertices.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
        return;
      }
      const index = bucketIndex(args.modals.spindleSpeed, minPower, maxPower, bucketCount);
      const target = bucketVertices[index];
      target.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
    },
    onArcMove: (args) => {
      if (args.modals.motion === "G0") {
        return;
      }
      const index = bucketIndex(args.modals.spindleSpeed, minPower, maxPower, bucketCount);
      const target = bucketVertices[index];
      tessellateArc(args, target, arcSegments);
    },
  });

  for (const line of lines) {
    if (!line) {
      continue;
    }
    virtualizer.processLine(line);
  }

  const buckets: LaserBucket[] = bucketVertices.map((vertices, index) => ({
    opacity: bucketOpacity(index, bucketCount, baseOpacity),
    vertices: Float32Array.from(vertices),
  }));

  return {
    rapid: Float32Array.from(rapidVertices),
    buckets,
    minPower,
    maxPower,
  };
}

export async function buildLaserVerticesFromLinesBatched(
  lines: readonly string[],
  options: {
    arcSegments?: number;
    bucketCount?: number;
    baseOpacity?: number;
    batch?: BatchBuildOptions;
  } = {}
): Promise<LaserVertices> {
  const result = await buildLaserGeometryFromLinesBatched(lines, options);
  return {
    rapid: result.rapidPositions,
    buckets: result.buckets.map((bucket) => ({ opacity: bucket.opacity, vertices: bucket.positions })),
    minPower: result.minPower,
    maxPower: result.maxPower,
  };
}

export type LaserGeometryBucket = {
  opacity: number;
  positions: Float32Array;
  prefixEndVertex: Int32Array;
};

export type LaserGeometry = {
  rapidPositions: Float32Array;
  rapidPrefixEndVertex: Int32Array;
  buckets: LaserGeometryBucket[];
  minPower: number;
  maxPower: number;
};

export type ToolpathGeometryStream = {
  positions: Float32Array;
  prefixEndVertex: Int32Array;
};

export type ToolpathGeometry = {
  rapid: ToolpathGeometryStream;
  cuts: ToolpathGeometryStream[];
  cutBucketCount: number;
  minPower: number;
  maxPower: number;
};

export async function buildToolpathGeometryFromLinesBatched(
  lines: readonly string[],
  options: {
    arcSegments?: number;
    bucketCount?: number;
    laserMode?: boolean;
    batch?: BatchBuildOptions;
  } = {}
): Promise<ToolpathGeometry> {
  const arcSegments = options.arcSegments ?? 30;
  const bucketCount = Math.max(1, Math.floor(options.bucketCount ?? 16));
  const laserMode = Boolean(options.laserMode);
  const batch = options.batch;

  const total = lines.length * (laserMode ? 2 : 1);
  const everyLines = Math.max(1, Math.floor(batch?.everyLines ?? 5000));
  const yieldEveryLines = Math.max(0, Math.floor(batch?.yieldEveryLines ?? 50000));
  let nextProgressAt = everyLines;
  let nextYieldAt = yieldEveryLines > 0 ? yieldEveryLines : Number.POSITIVE_INFINITY;

  let maxPower = Number.NEGATIVE_INFINITY;

  let assumeLaserOnWithoutSpindleCommands = false;
  if (laserMode) {
    const parser = new GCodeParser();
    for (const line of lines) {
      if (!line) {
        continue;
      }
      const parsed = parser.parseLine(line);
      const hasSpindleCommand = parsed.gcodes.some((word) => {
        if (word.letter !== "M") {
          return false;
        }
        const m = Math.trunc(word.value);
        return m === 3 || m === 4 || m === 5;
      });
      if (hasSpindleCommand) {
        assumeLaserOnWithoutSpindleCommands = false;
        break;
      }
      assumeLaserOnWithoutSpindleCommands = true;
    }
  }

  const isLaserOn = (modals: { spindle: "M3" | "M4" | "M5" | null; spindleSpeed: number | null }): boolean => {
    if (modals.spindle === "M5") {
      return false;
    }
    const spindleEnabled =
      modals.spindle === "M3" ||
      modals.spindle === "M4" ||
      (assumeLaserOnWithoutSpindleCommands && modals.spindle === null);
    if (!spindleEnabled) {
      return false;
    }
    if (modals.spindleSpeed === null) {
      return true;
    }
    return modals.spindleSpeed > 0;
  };

  if (laserMode) {
    const rangeVirtualizer = new GCodeVirtualizer({
      onLinearMove: (args) => {
        if (!isLaserOn(args.modals)) {
          return;
        }
        const power = args.modals.spindleSpeed;
        if (power === null || power <= 0) {
          return;
        }
        maxPower = Math.max(maxPower, power);
      },
      onArcMove: (args) => {
        if (!isLaserOn(args.modals)) {
          return;
        }
        const power = args.modals.spindleSpeed;
        if (power === null || power <= 0) {
          return;
        }
        maxPower = Math.max(maxPower, power);
      },
    });

    for (let index = 0; index < lines.length; index += 1) {
      if (batch?.shouldAbort?.()) {
        throw new Error("Aborted.");
      }
      const line = lines[index];
      if (line) {
        rangeVirtualizer.processLine(line);
      }
      const processed = index + 1;
      if (batch?.onProgress && (processed === total || processed === nextProgressAt)) {
        batch.onProgress(processed, total);
        nextProgressAt += everyLines;
      }
      if (yieldEveryLines > 0 && (processed === total || processed === nextYieldAt)) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        nextYieldAt += yieldEveryLines;
      }
    }

    if (!Number.isFinite(maxPower)) {
      maxPower = 0;
    }
  } else {
    maxPower = 0;
  }

  const bucketIndexLaser = (spindleSpeed: number | null): number => {
    if (bucketCount <= 1) {
      return 0;
    }
    if (spindleSpeed === null) {
      return bucketCount - 1;
    }
    const power = spindleSpeed;
    if (power <= 0) {
      return 0;
    }
    if (maxPower <= 0) {
      return bucketCount - 1;
    }
    // Reserve bucket 0 for S=0 (laser off). S>0 maps to [1..bucketCount-1].
    const normalized = Math.min(1, Math.max(0, power / maxPower));
    const index = 1 + Math.floor(normalized * (bucketCount - 2));
    return Math.min(bucketCount - 1, Math.max(1, index));
  };

  const rapidVertices: number[] = [];
  const cutVertices: number[][] = laserMode
    ? Array.from({ length: bucketCount }, () => [])
    : [new Array<number>()];

  const rapidPrefixEndVertex = new Int32Array(lines.length);
  const cutPrefixEndVertex: Int32Array[] = Array.from(
    { length: laserMode ? bucketCount : 1 },
    () => new Int32Array(lines.length)
  );

  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const start = args.transformedStart ?? args.start;
      const end = args.transformedEnd ?? args.end;

      if (args.modals.motion === "G0") {
        rapidVertices.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
        return;
      }

      if (laserMode && !isLaserOn(args.modals)) {
        return;
      }

      const bucketIndexValue = laserMode
        ? bucketIndexLaser(args.modals.spindleSpeed)
        : 0;
      const target = cutVertices[bucketIndexValue];
      target.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
    },
    onArcMove: (args) => {
      if (args.modals.motion === "G0") {
        return;
      }
      if (laserMode && !isLaserOn(args.modals)) {
        return;
      }
      const bucketIndexValue = laserMode
        ? bucketIndexLaser(args.modals.spindleSpeed)
        : 0;
      const target = cutVertices[bucketIndexValue];
      tessellateArc(args, target, arcSegments);
    },
  });

  for (let index = 0; index < lines.length; index += 1) {
    if (batch?.shouldAbort?.()) {
      throw new Error("Aborted.");
    }

    const line = lines[index];
    if (line) {
      virtualizer.processLine(line);
    }

    rapidPrefixEndVertex[index] = rapidVertices.length / 3;
    for (let bucket = 0; bucket < cutVertices.length; bucket += 1) {
      cutPrefixEndVertex[bucket][index] = cutVertices[bucket].length / 3;
    }

    const processed = laserMode ? lines.length + index + 1 : index + 1;
    if (batch?.onProgress && (processed === total || processed === nextProgressAt)) {
      batch.onProgress(processed, total);
      nextProgressAt += everyLines;
    }
    if (yieldEveryLines > 0 && (processed === total || processed === nextYieldAt)) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      nextYieldAt += yieldEveryLines;
    }
  }

  return {
    rapid: { positions: Float32Array.from(rapidVertices), prefixEndVertex: rapidPrefixEndVertex },
    cuts: cutVertices.map((verts, idx) => ({
      positions: Float32Array.from(verts),
      prefixEndVertex: cutPrefixEndVertex[idx],
    })),
    cutBucketCount: cutVertices.length,
    minPower: 0,
    maxPower,
  };
}

export async function buildLaserGeometryFromLinesBatched(
  lines: readonly string[],
  options: {
    arcSegments?: number;
    bucketCount?: number;
    baseOpacity?: number;
    batch?: BatchBuildOptions;
  } = {}
): Promise<LaserGeometry> {
  const bucketCount = Math.max(1, Math.floor(options.bucketCount ?? 16));
  const baseOpacity = options.baseOpacity ?? 0.9;

  const result = await buildToolpathGeometryFromLinesBatched(lines, {
    arcSegments: options.arcSegments,
    bucketCount,
    laserMode: true,
    batch: options.batch,
  });

  const buckets: LaserGeometryBucket[] = result.cuts.map((stream, index) => ({
    opacity: bucketOpacity(index, bucketCount, baseOpacity),
    positions: stream.positions,
    prefixEndVertex: stream.prefixEndVertex,
  }));

  return {
    rapidPositions: result.rapid.positions,
    rapidPrefixEndVertex: result.rapid.prefixEndVertex,
    buckets,
    minPower: 0,
    maxPower: result.maxPower,
  };
}

export function pushXYZ(vertices: number[], position: Position): void {
  vertices.push(position.X, position.Y, position.Z);
}

function defaultLinearCollector(
  args: Parameters<LinearMoveCallback>[0],
  vertices: number[]
): void {
  const start = args.transformedStart ?? args.start;
  const end = args.transformedEnd ?? args.end;
  vertices.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
}

function tessellateArc(
  args: Parameters<ArcMoveCallback>[0],
  vertices: number[],
  segments: number
): void {
  const count = Math.max(1, Math.floor(segments));
  const { primary, secondary } = planeAxes(args.plane);
  const radius = distance2d(
    args.start[primary],
    args.start[secondary],
    args.center[primary],
    args.center[secondary]
  );
  const startAngle = Math.atan2(
    args.start[secondary] - args.center[secondary],
    args.start[primary] - args.center[primary]
  );
  const endAngle = Math.atan2(
    args.end[secondary] - args.center[secondary],
    args.end[primary] - args.center[primary]
  );

  const tau = Math.PI * 2;
  let s = normalizeAngle(startAngle);
  let e = normalizeAngle(endAngle);
  if (args.motion === "G2") {
    if (s <= e) {
      s += tau;
    }
  } else if (e <= s) {
    e += tau;
  }

  const total = args.motion === "G2" ? s - e : e - s;
  let previous = { ...args.start };
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    const angle = args.motion === "G2" ? s - total * t : s + total * t;
    const position = lerpPosition(args.start, args.end, t);
    position[primary] = args.center[primary] + radius * Math.cos(angle);
    position[secondary] = args.center[secondary] + radius * Math.sin(angle);
    const rotatedPrevious = applyARotationX(previous);
    const rotatedPosition = applyARotationX(position);
    vertices.push(
      rotatedPrevious.X,
      rotatedPrevious.Y,
      rotatedPrevious.Z,
      rotatedPosition.X,
      rotatedPosition.Y,
      rotatedPosition.Z
    );
    previous = position;
  }
}

function applyARotationX(position: Position): Position {
  const angle = (position.A * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const y = position.Y * cos - position.Z * sin;
  const z = position.Y * sin + position.Z * cos;
  return { ...position, Y: y, Z: z };
}

function planeAxes(plane: PlaneMode): { primary: "X" | "Y" | "Z"; secondary: "X" | "Y" | "Z" } {
  if (plane === "G18") {
    return { primary: "Z", secondary: "X" };
  }
  if (plane === "G19") {
    return { primary: "Y", secondary: "Z" };
  }
  return { primary: "X", secondary: "Y" };
}

function normalizeAngle(angle: number): number {
  const tau = Math.PI * 2;
  let a = angle % tau;
  if (a < 0) {
    a += tau;
  }
  return a;
}

function distance2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function lerpPosition(start: Position, end: Position, t: number): Position {
  return {
    X: start.X + (end.X - start.X) * t,
    Y: start.Y + (end.Y - start.Y) * t,
    Z: start.Z + (end.Z - start.Z) * t,
    A: start.A + (end.A - start.A) * t,
    B: start.B + (end.B - start.B) * t,
    C: start.C + (end.C - start.C) * t,
  };
}

function findPowerRange(lines: Iterable<string>): { minPower: number; maxPower: number } {
  let minPower = Number.POSITIVE_INFINITY;
  let maxPower = Number.NEGATIVE_INFINITY;
  const virtualizer = new GCodeVirtualizer({
    onLinearMove: (args) => {
      const power = args.modals.spindleSpeed;
      if (power === null) {
        return;
      }
      minPower = Math.min(minPower, power);
      maxPower = Math.max(maxPower, power);
    },
    onArcMove: (args) => {
      const power = args.modals.spindleSpeed;
      if (power === null) {
        return;
      }
      minPower = Math.min(minPower, power);
      maxPower = Math.max(maxPower, power);
    },
  });

  for (const line of lines) {
    if (!line) {
      continue;
    }
    virtualizer.processLine(line);
  }

  if (!Number.isFinite(minPower) || !Number.isFinite(maxPower)) {
    return { minPower: 0, maxPower: 0 };
  }
  return { minPower, maxPower };
}

function bucketIndex(
  spindleSpeed: number | null,
  minPower: number,
  maxPower: number,
  bucketCount: number
): number {
  if (bucketCount <= 1) {
    return 0;
  }
  const power = spindleSpeed ?? minPower;
  if (maxPower <= minPower) {
    return bucketCount - 1;
  }
  const normalized = (power - minPower) / (maxPower - minPower);
  const index = Math.floor(normalized * (bucketCount - 1));
  return Math.min(bucketCount - 1, Math.max(0, index));
}

function bucketOpacity(index: number, bucketCount: number, baseOpacity: number): number {
  if (bucketCount <= 1) {
    return baseOpacity;
  }
  const normalized = index / (bucketCount - 1);
  return baseOpacity * normalized;
}

// ── Worker geometry conversion ────────────────────────────────────────────────

export type WorkerSegmentGroup = {
  hexColor: string;
  opacity: number;
  positions: Float32Array;
  rgbColors: Float32Array;
};

export function buildWorkerSegmentGroups(data: WorkerGeometryData): WorkerSegmentGroup[] {
  const vertices = new Float32Array(data.vertices);
  const frames = new Uint32Array(data.frames);
  const colorArray = new Float32Array(data.colorArrayBuffer);
  const { verticesLen, framesLen } = data;

  const groupData = new Map<string, { hexColor: string; opacity: number; pos: number[]; rgb: number[] }>();

  for (let i = 0; i < framesLen; i++) {
    const startVtx = frames[i];
    const endVtx = i < framesLen - 1 ? frames[i + 1] : verticesLen / 3;
    if (endVtx <= startVtx + 1) continue;

    const ci = startVtx * 4;
    const r = colorArray[ci], g = colorArray[ci + 1], b = colorArray[ci + 2], a = colorArray[ci + 3];
    const hexColor = workerRgbToHex(r, g, b);
    const key = `${hexColor}|${Math.round(a * 100)}`;

    let group = groupData.get(key);
    if (!group) {
      group = { hexColor, opacity: a, pos: [], rgb: [] };
      groupData.set(key, group);
    }

    for (let j = startVtx; j < endVtx - 1; j++) {
      const j0 = j * 3, j1 = (j + 1) * 3;
      group.pos.push(vertices[j0], vertices[j0 + 1], vertices[j0 + 2], vertices[j1], vertices[j1 + 1], vertices[j1 + 2]);
      group.rgb.push(r, g, b, r, g, b);
    }
  }

  return Array.from(groupData.values()).map(({ hexColor, opacity, pos, rgb }) => ({
    hexColor,
    opacity,
    positions: new Float32Array(pos),
    rgbColors: new Float32Array(rgb),
  }));
}

function workerRgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export type WorkerToolpathStream = {
  positions: Float32Array;
  colors: Float32Array;
  prefixEndVertex: Int32Array;
  /**
   * Index into the `lineGroups` this stream was built for, or null for the
   * catch-all stream holding lines that fell in no group.
   */
  lineGroupIndex: number | null;
};

export type WorkerToolpathStreams = {
  rapids: WorkerToolpathStream[];
  cuts: WorkerToolpathStream[];
};

/**
 * Builds line-ordered toolpath streams (rapid + cut) from worker geometry,
 * preserving per-vertex colours and producing per-stream `prefixEndVertex`
 * arrays (indexed by source line) so `hideUntilLine`/progress greying works on
 * the worker-data path.
 *
 * Unlike `buildWorkerSegmentGroups`, segments are appended in source-line order
 * (driven by `frames`) rather than grouped by colour, which is what the
 * cumulative `prefixEndVertex` cursor requires.
 *
 * With no `lineGroups`, the result is exactly one rapid stream and one cut
 * stream, both with a null `lineGroupIndex`. Passing `lineGroups` splits both by
 * source-line range instead - one rapid and one cut stream per group, plus a
 * trailing pair for the lines in no group - so a host can hide an interior span
 * by flipping those streams' visibility, which a single contiguous draw range
 * (all `hideUntilLine` can offer) cannot express. Each group keeps its own
 * carry-forward `prefixEndVertex`, so progress greying stays correct within
 * every stream.
 *
 * Grouping costs an `Int32Array(framesLen)` per stream, so memory grows with
 * lines x groups. It is meant for interactive review of a file already held in
 * memory, not for the live job path.
 */
export function buildWorkerToolpathStreams(
  data: WorkerGeometryData,
  options?: LoadWorkerDataOptions
): WorkerToolpathStreams {
  const vertices = new Float32Array(data.vertices);
  const frames = new Uint32Array(data.frames);
  const colorArray = new Float32Array(data.colorArrayBuffer); // RGBA, stride 4 — used for rapid/cut classification
  // In laser mode the worker bakes power-proportional opacity into savedColorsBuffer;
  // use it for display colors while keeping colorArray for rapid/cut routing.
  const savedColorArray = (data.isLaser && data.savedColorsBuffer && data.savedColorLen)
    ? new Float32Array(data.savedColorsBuffer)
    : null;
  const srcColor = savedColorArray ?? colorArray;
  const { verticesLen, framesLen } = data;

  // One bucket per line group, plus a trailing catch-all for lines in no group
  // (typically the preamble before the first toolchange). The catch-all carries
  // a null group index, so a host can never hide it.
  const lineGroups = options?.lineGroups ?? [];
  const ungroupedBucket = lineGroups.length;
  const bucketCount = ungroupedBucket + 1;

  const bucketForLine = new Int32Array(framesLen).fill(ungroupedBucket);
  // Walk groups back to front so that where ranges overlap the earliest group
  // wins, matching the documented first-match rule.
  for (let g = lineGroups.length - 1; g >= 0; g--) {
    const start = Math.max(0, Math.floor(lineGroups[g].start));
    const end = Math.min(framesLen - 1, Math.floor(lineGroups[g].end));
    for (let i = start; i <= end; i++) {
      bucketForLine[i] = g;
    }
  }

  const perBucket = <T>(create: () => T): T[] => Array.from({ length: bucketCount }, create);
  const rapidPos = perBucket<number[]>(() => []);
  const rapidRgb = perBucket<number[]>(() => []);
  const cutPos = perBucket<number[]>(() => []);
  const cutRgb = perBucket<number[]>(() => []);
  const rapidPrefixEndVertex = perBucket(() => new Int32Array(framesLen));
  const cutPrefixEndVertex = perBucket(() => new Int32Array(framesLen));

  for (let i = 0; i < framesLen; i++) {
    const startVtx = frames[i];
    const endVtx = i < framesLen - 1 ? frames[i + 1] : verticesLen / 3;

    if (endVtx > startVtx + 1) {
      // Route the whole line by its first vertex's opacity (rapid moves are dimmer).
      const isRapid = colorArray[startVtx * 4 + 3] < 0.75;
      const bucket = bucketForLine[i];
      const pos = isRapid ? rapidPos[bucket] : cutPos[bucket];
      const rgb = isRapid ? rapidRgb[bucket] : cutRgb[bucket];

      for (let j = startVtx; j < endVtx - 1; j++) {
        const j0 = j * 3;
        const j1 = (j + 1) * 3;
        pos.push(vertices[j0], vertices[j0 + 1], vertices[j0 + 2], vertices[j1], vertices[j1 + 1], vertices[j1 + 2]);
        const c0 = j * 4;
        const c1 = (j + 1) * 4;
        rgb.push(srcColor[c0], srcColor[c0 + 1], srcColor[c0 + 2], srcColor[c1], srcColor[c1 + 1], srcColor[c1 + 2]);
      }
    }

    // Cumulative vertex count per stream through this line (carry-forward for
    // lines that contributed nothing to a given stream). Every bucket is written
    // on every line, including lines outside its own range, so each stream's
    // progress cursor stays valid across the whole file.
    for (let b = 0; b < bucketCount; b++) {
      rapidPrefixEndVertex[b][i] = rapidPos[b].length / 3;
      cutPrefixEndVertex[b][i] = cutPos[b].length / 3;
    }
  }

  const toStreams = (
    pos: number[][],
    rgb: number[][],
    prefixEndVertex: Int32Array[]
  ): WorkerToolpathStream[] =>
    pos.map((bucketPos, b) => ({
      positions: Float32Array.from(bucketPos),
      colors: Float32Array.from(rgb[b]),
      prefixEndVertex: prefixEndVertex[b],
      lineGroupIndex: b === ungroupedBucket ? null : b,
    }));

  return {
    rapids: toStreams(rapidPos, rapidRgb, rapidPrefixEndVertex),
    cuts: toStreams(cutPos, cutRgb, cutPrefixEndVertex),
  };
}
