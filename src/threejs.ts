import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { ArcMoveCallback, LinearMoveCallback, PlaneMode, Position } from "./types";
import { VertexBuildOptions, VertexCollector } from "./threejs-core";
import { GCodeVirtualizer } from "./virtualizer";

export async function buildVerticesFromFile(
  filePath: string,
  options: VertexBuildOptions = {}
): Promise<Float32Array> {
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

  await streamLines(filePath, (line) => {
    if (!line) {
      return;
    }
    virtualizer.processLine(line);
  });

  return Float32Array.from(vertices);
}

export {
  buildVerticesFromLines,
  buildMovementVerticesFromLines,
  buildMovementVerticesFromLinesBatched,
  buildMovementGeometryFromLinesBatched,
  buildLaserVerticesFromLines,
  buildLaserVerticesFromLinesBatched,
  buildLaserGeometryFromLinesBatched,
  buildToolpathGeometryFromLinesBatched,
  VertexBuildOptions,
  BatchBuildOptions,
  VertexCollector,
  MovementVertices,
  MovementGeometry,
  LaserVertices,
  LaserGeometry,
  ToolpathGeometry,
  ToolpathGeometryStream,
  LaserBucket,
  pushXYZ,
} from "./threejs-core";

function streamLines(filePath: string, onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", onLine);
    rl.on("close", () => resolve());
    rl.on("error", reject);
    stream.on("error", reject);
  });
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

function applyARotationX(position: Position): Position {
  const angle = (position.A * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const y = position.Y * cos - position.Z * sin;
  const z = position.Y * sin + position.Z * cos;
  return { ...position, Y: y, Z: z };
}
