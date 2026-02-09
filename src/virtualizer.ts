import {
  ArcMoveCallback,
  Axis,
  LinearMoveCallback,
  ModalState,
  MovementCallbacks,
  MotionMode,
  ParsedLine,
  PlaneMode,
  Position,
  VirtualizeResult,
} from "./types";
import { GCodeParser } from "./parser";

const AXES: Axis[] = ["X", "Y", "Z", "A", "B", "C"];

const DEFAULT_MODALS: ModalState = {
  motion: "G0",
  distance: "G90",
  plane: "G17",
  units: "G21",
  feedMode: "G94",
  feedRate: null,
  spindleSpeed: null,
  tool: null,
  coolant: null,
  spindle: null,
  coordinateSystem: "G54",
};

export class GCodeVirtualizer {
  private readonly parser: GCodeParser;
  private modals: ModalState;
  private position: Position;
  private callbacks: MovementCallbacks;
  private feedRates: Set<number>;
  private spindleSpeeds: Set<number>;
  private tools: Set<number>;

  constructor(callbacks: MovementCallbacks = {}) {
    this.parser = new GCodeParser();
    this.modals = { ...DEFAULT_MODALS };
    this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
    this.callbacks = callbacks;
    this.feedRates = new Set();
    this.spindleSpeeds = new Set();
    this.tools = new Set();
  }

  setCallbacks(callbacks: MovementCallbacks): void {
    this.callbacks = callbacks;
  }

  getModals(): ModalState {
    return { ...this.modals };
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getUniqueFeedRates(): number[] {
    return Array.from(this.feedRates);
  }

  getUniqueSpindleSpeeds(): number[] {
    return Array.from(this.spindleSpeeds);
  }

  getUniqueTools(): number[] {
    return Array.from(this.tools);
  }

  reset(): void {
    this.modals = { ...DEFAULT_MODALS };
    this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
    this.feedRates.clear();
    this.spindleSpeeds.clear();
    this.tools.clear();
  }

  processLine(line: string): VirtualizeResult {
    const parsed = this.parser.parseLine(line);
    const start = { ...this.position };

    this.updateModals(parsed);

    const movement = this.modals.motion;
    const plane = this.modals.plane;
    let end = this.applyAxes(parsed, start);
    let arcMax: Position | undefined;
    let arcCenter: Position | undefined;
    let moveType: "none" | "linear" | "arc" = "none";

    if (movement === "G0" || movement === "G1") {
      if (!positionsEqual(start, end)) {
        moveType = "linear";
        this.position = { ...end };
        this.emitLinear({ start, end });
      }
    } else if (movement === "G2" || movement === "G3") {
      if (!positionsEqual(start, end)) {
        moveType = "arc";
        arcCenter = this.arcCenter(parsed, start, end, plane);
        arcMax = this.computeArcMax(start, end, movement, plane, arcCenter);
        this.position = { ...end };
        this.emitArc({ start, end, max: arcMax, center: arcCenter, plane, motion: movement });
      }
    }

    return {
      parsed,
      modals: { ...this.modals },
      start,
      end,
      movement: moveType,
      arcMax,
    };
  }

  private unitsScale(): number {
    return this.modals.units === "G20" ? 25.4 : 1;
  }

  private updateModals(parsed: ParsedLine): void {
    for (const word of parsed.gcodes) {
      if (word.letter.toUpperCase() === "G") {
        const gcode = `G${Math.trunc(word.value)}`;
        if (gcode === "G0" || gcode === "G1" || gcode === "G2" || gcode === "G3") {
          this.modals.motion = gcode as MotionMode;
        }
        if (gcode === "G90" || gcode === "G91") {
          this.modals.distance = gcode as ModalState["distance"];
        }
        if (gcode === "G17" || gcode === "G18" || gcode === "G19") {
          this.modals.plane = gcode as PlaneMode;
        }
        if (gcode === "G20" || gcode === "G21") {
          this.modals.units = gcode as ModalState["units"];
        }
        if (gcode === "G93" || gcode === "G94") {
          this.modals.feedMode = gcode as ModalState["feedMode"];
        }
        if (
          gcode === "G54" ||
          gcode === "G55" ||
          gcode === "G56" ||
          gcode === "G57" ||
          gcode === "G58" ||
          gcode === "G59"
        ) {
          this.modals.coordinateSystem = gcode as ModalState["coordinateSystem"];
        }
      }

      if (word.letter.toUpperCase() === "M") {
        const mcode = `M${Math.trunc(word.value)}`;
        if (mcode === "M7" || mcode === "M8" || mcode === "M9") {
          this.modals.coolant = mcode as ModalState["coolant"];
        }
        if (mcode === "M3" || mcode === "M4" || mcode === "M5") {
          this.modals.spindle = mcode as ModalState["spindle"];
        }
      }
    }

    for (const word of parsed.params) {
      const letter = word.letter.toUpperCase();
      if (letter === "F") {
        this.modals.feedRate = word.value;
        this.feedRates.add(word.value);
      }
      if (letter === "S") {
        this.modals.spindleSpeed = word.value;
        this.spindleSpeeds.add(word.value);
      }
      if (letter === "T") {
        this.modals.tool = word.value;
        this.tools.add(word.value);
      }
    }
  }

  private applyAxes(parsed: ParsedLine, start: Position): Position {
    const end: Position = { ...start };
    const scale = this.unitsScale();
    for (const axis of AXES) {
      const word = parsed.params.find((param) => param.letter.toUpperCase() === axis);
      if (!word) {
        continue;
      }
      const value = axis === "X" || axis === "Y" || axis === "Z" ? word.value * scale : word.value;
      if (this.modals.distance === "G90") {
        end[axis] = value;
      } else {
        end[axis] = end[axis] + value;
      }
    }

    return end;
  }

  private computeArcMax(
    start: Position,
    end: Position,
    motion: MotionMode,
    plane: PlaneMode,
    center: Position
  ): Position {
    const { primary, secondary, tertiary } = planeAxes(plane);
    const radius = distance2d(
      start[primary],
      start[secondary],
      center[primary],
      center[secondary]
    );
    const startAngle = Math.atan2(
      start[secondary] - center[secondary],
      start[primary] - center[primary]
    );
    const endAngle = Math.atan2(
      end[secondary] - center[secondary],
      end[primary] - center[primary]
    );

    const candidateAngles = arcCandidateAngles(startAngle, endAngle, motion);
    let maxPrimary = Number.NEGATIVE_INFINITY;
    let maxSecondary = Number.NEGATIVE_INFINITY;

    for (const angle of candidateAngles) {
      const p = center[primary] + radius * Math.cos(angle);
      const s = center[secondary] + radius * Math.sin(angle);
      if (p > maxPrimary) {
        maxPrimary = p;
      }
      if (s > maxSecondary) {
        maxSecondary = s;
      }
    }

    const max: Position = { ...start };
    max[primary] = maxPrimary;
    max[secondary] = maxSecondary;
    max[tertiary] = Math.max(start[tertiary], end[tertiary]);
    for (const axis of AXES) {
      if (axis !== primary && axis !== secondary && axis !== tertiary) {
        max[axis] = Math.max(start[axis], end[axis]);
      }
    }

    return max;
  }

  private arcCenter(
    parsed: ParsedLine,
    start: Position,
    end: Position,
    plane: PlaneMode
  ): Position {
    const { primary, secondary } = planeAxes(plane);
    const center: Position = { ...start };
    const scale = this.unitsScale();
    const r = findParam(parsed, "R");
    const offsets = arcOffsets(parsed, plane);

    const primaryOffset = offsets.primary === null ? null : offsets.primary * scale;
    const secondaryOffset = offsets.secondary === null ? null : offsets.secondary * scale;

    if (primaryOffset !== null || secondaryOffset !== null) {
      center[primary] = start[primary] + (primaryOffset ?? 0);
      center[secondary] = start[secondary] + (secondaryOffset ?? 0);
      return center;
    }

    if (r === null) {
      return center;
    }

    const scaledR = r * scale;
    const sx = start[primary];
    const sy = start[secondary];
    const ex = end[primary];
    const ey = end[secondary];
    const dx = ex - sx;
    const dy = ey - sy;
    const chord = Math.hypot(dx, dy);
    if (chord === 0) {
      return center;
    }

    const radius = Math.abs(scaledR);
    const h = Math.sqrt(Math.max(0, radius * radius - (chord / 2) * (chord / 2)));
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const ux = -dy / chord;
    const uy = dx / chord;
    const sign = scaledR >= 0 ? 1 : -1;
    center[primary] = mx + sign * ux * h;
    center[secondary] = my + sign * uy * h;
    return center;
  }

  private emitLinear(args: { start: Position; end: Position }): void {
    const callback: LinearMoveCallback | undefined = this.callbacks.onLinearMove;
    if (!callback) {
      return;
    }
    const deltaA = args.end.A - args.start.A;
    const steps = Math.max(1, Math.ceil(Math.abs(deltaA) / MAX_ROTATION_DEGREES_PER_STEP));
    let previous = { ...args.start };
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const current = lerpPosition(args.start, args.end, t);
      const transformedStart = applyARotationX(previous);
      const transformedEnd = applyARotationX(current);
      callback({
        modals: { ...this.modals },
        start: { ...previous },
        end: { ...current },
        transformedStart,
        transformedEnd,
      });
      previous = current;
    }
  }

  private emitArc(args: {
    start: Position;
    end: Position;
    max: Position;
    center: Position;
    plane: PlaneMode;
    motion: MotionMode;
  }): void {
    const callback: ArcMoveCallback | undefined = this.callbacks.onArcMove;
    if (!callback) {
      return;
    }
    const transformedStart = applyARotationX(args.start);
    const transformedEnd = applyARotationX(args.end);
    const transformedMax = applyARotationX(args.max);
    const transformedCenter = applyARotationX(args.center);
    callback({
      modals: { ...this.modals },
      start: { ...args.start },
      end: { ...args.end },
      max: { ...args.max },
      center: { ...args.center },
      plane: args.plane,
      motion: args.motion,
      transformedStart,
      transformedEnd,
      transformedMax,
      transformedCenter,
    });
  }
}

function findParam(parsed: ParsedLine, letter: string): number | null {
  const found = parsed.params.find((param) => param.letter.toUpperCase() === letter);
  return found ? found.value : null;
}

function planeAxes(plane: PlaneMode): { primary: Axis; secondary: Axis; tertiary: Axis } {
  if (plane === "G18") {
    return { primary: "Z", secondary: "X", tertiary: "Y" };
  }
  if (plane === "G19") {
    return { primary: "Y", secondary: "Z", tertiary: "X" };
  }
  return { primary: "X", secondary: "Y", tertiary: "Z" };
}

function arcOffsets(
  parsed: ParsedLine,
  plane: PlaneMode
): { primary: number | null; secondary: number | null } {
  const i = findParam(parsed, "I");
  const j = findParam(parsed, "J");
  const k = findParam(parsed, "K");

  if (plane === "G18") {
    return { primary: k, secondary: i };
  }
  if (plane === "G19") {
    return { primary: j, secondary: k };
  }
  return { primary: i, secondary: j };
}

function arcCandidateAngles(startAngle: number, endAngle: number, motion: MotionMode): number[] {
  const tau = Math.PI * 2;
  let s = normalizeAngle(startAngle);
  let e = normalizeAngle(endAngle);
  const baseAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, tau];

  if (motion === "G2") {
    if (s < e) {
      s += tau;
    }
    const angles = [s, e];
    for (const a of baseAngles) {
      let test = a;
      if (test < e) {
        test += tau;
      }
      if (test <= s && test >= e) {
        angles.push(test);
      }
    }
    return angles;
  }

  if (e < s) {
    e += tau;
  }
  const angles = [s, e];
  for (const a of baseAngles) {
    let test = a;
    if (test < s) {
      test += tau;
    }
    if (test >= s && test <= e) {
      angles.push(test);
    }
  }
  return angles;
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

function positionsEqual(a: Position, b: Position): boolean {
  return AXES.every((axis) => a[axis] === b[axis]);
}

const MAX_ROTATION_DEGREES_PER_STEP = 5;

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
