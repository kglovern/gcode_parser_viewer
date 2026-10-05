import type { SegmentsToolpathState } from "./segments";
import { segmentsCursorForLine } from "./segments";

/**
 * Finding the bit on a segments toolpath.
 *
 * Progress greying used to follow a line count (an estimate of the line being
 * executed). Here it follows geometry instead: the live bit position is
 * matched against the segments of the lines that may be executing, so the
 * processed/planned boundary sits under the bit, part-way along a segment if
 * need be, whatever the feed override or estimate quality.
 *
 * Positions are in vertex units: segment `k` spans vertices `2k` and `2k+1`,
 * and a point at fraction `t` along it is vertex position `2k + 2t`. Whole
 * values are the vertex counts `prefixEndVertex` uses, so line boundaries and
 * located positions compare directly.
 */

export type LocatePoint = { x: number; y: number; z: number };

export type LocateOptions = {
  /** Allowed distance from the toolpath (mm) on short segments. */
  tolerance: number;
  /**
   * Extra allowance per mm of segment length, for arcs drawn as chords (a
   * chord bows away from the real arc by up to ~3% of its length when the
   * tessellation hits its division cap).
   */
  tolerancePerLength: number;
  /** Upper bound on the allowance, however long the segment. */
  maxTolerance: number;
  /** A later segment wins only when this much closer (mm). */
  epsilon: number;
};

export const defaultLocateOptions: LocateOptions = {
  tolerance: 0.5,
  tolerancePerLength: 0.035,
  maxTolerance: 3,
  epsilon: 0.05,
};

export type LocateResult = {
  /** Fractional global vertex position (`2k + 2t`). */
  vertex: number;
  distance: number;
};

/**
 * Closest point on the toolpath to `point` among the segments that overlap
 * vertex positions `[fromVertex, toVertex]`. Ties go to the earliest segment:
 * where the path revisits a spot (plunge and retract, repeated passes) it is
 * better to lag the bit than to grey a cut that has not happened yet.
 * Returns null when no segment is within tolerance.
 */
export function locateOnSegments(
  state: Pick<SegmentsToolpathState, "chunks">,
  point: LocatePoint,
  fromVertex: number,
  toVertex: number,
  options: LocateOptions = defaultLocateOptions
): LocateResult | null {
  // Segments touching the window: the one ending at `fromVertex` counts too,
  // so a bit parked exactly on a boundary is still found.
  const firstSegment = Math.max(0, Math.ceil(fromVertex / 2) - 1);
  const endSegment = Math.ceil(toVertex / 2);
  if (endSegment <= firstSegment) {
    return null;
  }

  let best: LocateResult | null = null;
  for (const chunk of state.chunks) {
    const chunkFirst = chunk.base / 2;
    const chunkEnd = (chunk.base + chunk.count) / 2;
    const from = Math.max(firstSegment, Math.ceil(chunkFirst));
    const to = Math.min(endSegment, Math.floor(chunkEnd));
    if (to <= from) {
      continue;
    }
    const positions = chunk.geometry.getAttribute("position").array as ArrayLike<number>;
    for (let segment = from; segment < to; segment += 1) {
      const o = (segment * 2 - chunk.base) * 3;
      const ax = positions[o];
      const ay = positions[o + 1];
      const az = positions[o + 2];
      const dx = positions[o + 3] - ax;
      const dy = positions[o + 4] - ay;
      const dz = positions[o + 5] - az;
      const lengthSq = dx * dx + dy * dy + dz * dz;
      if (lengthSq <= 0) {
        continue;
      }
      const t = Math.max(
        0,
        Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy + (point.z - az) * dz) / lengthSq)
      );
      const ex = ax + dx * t - point.x;
      const ey = ay + dy * t - point.y;
      const ez = az + dz * t - point.z;
      const distance = Math.sqrt(ex * ex + ey * ey + ez * ez);
      const allowed = Math.min(
        options.maxTolerance,
        options.tolerance + options.tolerancePerLength * Math.sqrt(lengthSq)
      );
      if (distance > allowed) {
        continue;
      }
      if (!best || distance < best.distance - options.epsilon) {
        best = { vertex: segment * 2 + t * 2, distance };
      }
    }
  }
  return best;
}

/** Vertex position where line `lineIndex` starts. */
export function segmentsLineStartVertex(state: SegmentsToolpathState, lineIndex: number): number {
  const index = Math.floor(lineIndex);
  return index <= 0 ? 0 : segmentsCursorForLine(state, index - 1);
}

/** The line a vertex position falls in (the last line for positions at the very end). */
export function segmentsLineForVertex(state: SegmentsToolpathState, vertex: number): number {
  const prefix = state.prefixEndVertex;
  let lo = 0;
  let hi = prefix.length - 1;
  if (hi < 0) {
    return 0;
  }
  // First line whose end is past `vertex`.
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid] > vertex) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

export type RunProgressState = {
  /** Processed boundary (fractional vertex position); only ever moves forward. */
  cursorVertex: number;
  /** Consecutive updates the bit was not found on the window. */
  misses: number;
};

export function createRunProgressState(): RunProgressState {
  return { cursorVertex: 0, misses: 0 };
}

export type RunProgressArgs = {
  /** First line of this run (start-from-line); 0 for a whole-file run. */
  minLine: number;
  /** Last line sent to the controller: the planned span ends with it. */
  plannedLine: number;
  /** Line-based processed edge to fall back on while the bit is off the path. */
  fallbackLine?: number;
  /** Consecutive misses before `fallbackLine` is used. */
  fallbackAfterMisses: number;
  locate: LocateOptions;
};

/**
 * Move the processed boundary to the bit, searching only between the current
 * boundary and the end of the planned lines. When the bit is not on that
 * stretch (approach moves, tool changes, a position that does not match the
 * file) the boundary holds, then follows `fallbackLine` once it has missed
 * `fallbackAfterMisses` times in a row. It never moves backwards.
 */
export function advanceRunProgress(
  state: SegmentsToolpathState,
  run: RunProgressState,
  point: LocatePoint,
  args: RunProgressArgs
): { located: boolean; cursorVertex: number; plannedEndVertex: number } {
  const lower = Math.max(run.cursorVertex, segmentsLineStartVertex(state, args.minLine));
  const plannedEndVertex =
    args.plannedLine < 0 ? 0 : segmentsCursorForLine(state, args.plannedLine);
  const hit = locateOnSegments(state, point, lower, Math.max(lower, plannedEndVertex), args.locate);

  if (hit) {
    run.cursorVertex = Math.max(lower, hit.vertex);
    run.misses = 0;
  } else {
    run.misses += 1;
    let next = lower;
    if (args.fallbackLine !== undefined && run.misses >= args.fallbackAfterMisses) {
      next = Math.max(next, args.fallbackLine < 0 ? 0 : segmentsCursorForLine(state, args.fallbackLine));
    }
    run.cursorVertex = next;
  }
  return { located: Boolean(hit), cursorVertex: run.cursorVertex, plannedEndVertex };
}
