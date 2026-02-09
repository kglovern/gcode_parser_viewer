// src/viewer/GCodeViewer.ts
import * as THREE7 from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// src/parser.ts
var WORD_RE = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
var GCodeParser = class {
  parseLine(line) {
    const comments = [];
    const stripped = this.stripComments(line, comments);
    const words = this.parseWords(stripped);
    const gcodes = words.filter((word) => {
      const letter = word.letter.toUpperCase();
      return letter === "G" || letter === "M";
    });
    const params = words.filter((word) => {
      const letter = word.letter.toUpperCase();
      return letter !== "G" && letter !== "M";
    });
    return {
      raw: line,
      words,
      gcodes,
      params,
      comments
    };
  }
  stripComments(line, comments) {
    let result = "";
    let inParen = false;
    let commentStart = -1;
    let commentBuffer = "";
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (!inParen && ch === ";") {
        const text = line.slice(i + 1);
        comments.push({ type: "semicolon", text, start: i, end: line.length });
        break;
      }
      if (ch === "(") {
        if (!inParen) {
          inParen = true;
          commentStart = i;
          commentBuffer = "";
        } else {
          commentBuffer += ch;
        }
        continue;
      }
      if (ch === ")" && inParen) {
        comments.push({
          type: "paren",
          text: commentBuffer,
          start: commentStart,
          end: i + 1
        });
        inParen = false;
        commentStart = -1;
        commentBuffer = "";
        continue;
      }
      if (inParen) {
        commentBuffer += ch;
        continue;
      }
      result += ch;
    }
    if (inParen) {
      comments.push({
        type: "paren",
        text: commentBuffer,
        start: commentStart,
        end: line.length
      });
    }
    return result;
  }
  parseWords(line) {
    const words = [];
    for (const match of line.matchAll(WORD_RE)) {
      const raw = match[0];
      const letter = match[1].toUpperCase();
      const value = Number(match[2]);
      const start = match.index ?? 0;
      const end = start + raw.length;
      words.push({ letter, value, raw, start, end });
    }
    return words;
  }
};

// src/virtualizer.ts
var AXES = ["X", "Y", "Z", "A", "B", "C"];
var DEFAULT_MODALS = {
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
  coordinateSystem: "G54"
};
var GCodeVirtualizer = class {
  constructor(callbacks = {}) {
    this.parser = new GCodeParser();
    this.modals = { ...DEFAULT_MODALS };
    this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
    this.callbacks = callbacks;
    this.feedRates = /* @__PURE__ */ new Set();
    this.spindleSpeeds = /* @__PURE__ */ new Set();
    this.tools = /* @__PURE__ */ new Set();
  }
  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }
  getModals() {
    return { ...this.modals };
  }
  getPosition() {
    return { ...this.position };
  }
  getUniqueFeedRates() {
    return Array.from(this.feedRates);
  }
  getUniqueSpindleSpeeds() {
    return Array.from(this.spindleSpeeds);
  }
  getUniqueTools() {
    return Array.from(this.tools);
  }
  reset() {
    this.modals = { ...DEFAULT_MODALS };
    this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
    this.feedRates.clear();
    this.spindleSpeeds.clear();
    this.tools.clear();
  }
  processLine(line) {
    const parsed = this.parser.parseLine(line);
    const start = { ...this.position };
    this.updateModals(parsed);
    const movement = this.modals.motion;
    const plane = this.modals.plane;
    let end = this.applyAxes(parsed, start);
    let arcMax;
    let arcCenter;
    let moveType = "none";
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
      arcMax
    };
  }
  unitsScale() {
    return this.modals.units === "G20" ? 25.4 : 1;
  }
  updateModals(parsed) {
    for (const word of parsed.gcodes) {
      if (word.letter.toUpperCase() === "G") {
        const gcode = `G${Math.trunc(word.value)}`;
        if (gcode === "G0" || gcode === "G1" || gcode === "G2" || gcode === "G3") {
          this.modals.motion = gcode;
        }
        if (gcode === "G90" || gcode === "G91") {
          this.modals.distance = gcode;
        }
        if (gcode === "G17" || gcode === "G18" || gcode === "G19") {
          this.modals.plane = gcode;
        }
        if (gcode === "G20" || gcode === "G21") {
          this.modals.units = gcode;
        }
        if (gcode === "G93" || gcode === "G94") {
          this.modals.feedMode = gcode;
        }
        if (gcode === "G54" || gcode === "G55" || gcode === "G56" || gcode === "G57" || gcode === "G58" || gcode === "G59") {
          this.modals.coordinateSystem = gcode;
        }
      }
      if (word.letter.toUpperCase() === "M") {
        const mcode = `M${Math.trunc(word.value)}`;
        if (mcode === "M7" || mcode === "M8" || mcode === "M9") {
          this.modals.coolant = mcode;
        }
        if (mcode === "M3" || mcode === "M4" || mcode === "M5") {
          this.modals.spindle = mcode;
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
  applyAxes(parsed, start) {
    const end = { ...start };
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
  computeArcMax(start, end, motion, plane, center) {
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
    const max = { ...start };
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
  arcCenter(parsed, start, end, plane) {
    const { primary, secondary } = planeAxes(plane);
    const center = { ...start };
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
    const h = Math.sqrt(Math.max(0, radius * radius - chord / 2 * (chord / 2)));
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const ux = -dy / chord;
    const uy = dx / chord;
    const sign = scaledR >= 0 ? 1 : -1;
    center[primary] = mx + sign * ux * h;
    center[secondary] = my + sign * uy * h;
    return center;
  }
  emitLinear(args) {
    const callback = this.callbacks.onLinearMove;
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
        transformedEnd
      });
      previous = current;
    }
  }
  emitArc(args) {
    const callback = this.callbacks.onArcMove;
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
      transformedCenter
    });
  }
};
function findParam(parsed, letter) {
  const found = parsed.params.find((param) => param.letter.toUpperCase() === letter);
  return found ? found.value : null;
}
function planeAxes(plane) {
  if (plane === "G18") {
    return { primary: "Z", secondary: "X", tertiary: "Y" };
  }
  if (plane === "G19") {
    return { primary: "Y", secondary: "Z", tertiary: "X" };
  }
  return { primary: "X", secondary: "Y", tertiary: "Z" };
}
function arcOffsets(parsed, plane) {
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
function arcCandidateAngles(startAngle, endAngle, motion) {
  const tau = Math.PI * 2;
  let s = normalizeAngle(startAngle);
  let e = normalizeAngle(endAngle);
  const baseAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, tau];
  if (motion === "G2") {
    if (s < e) {
      s += tau;
    }
    const angles2 = [s, e];
    for (const a of baseAngles) {
      let test = a;
      if (test < e) {
        test += tau;
      }
      if (test <= s && test >= e) {
        angles2.push(test);
      }
    }
    return angles2;
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
function normalizeAngle(angle) {
  const tau = Math.PI * 2;
  let a = angle % tau;
  if (a < 0) {
    a += tau;
  }
  return a;
}
function distance2d(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function positionsEqual(a, b) {
  return AXES.every((axis) => a[axis] === b[axis]);
}
var MAX_ROTATION_DEGREES_PER_STEP = 5;
function lerpPosition(start, end, t) {
  return {
    X: start.X + (end.X - start.X) * t,
    Y: start.Y + (end.Y - start.Y) * t,
    Z: start.Z + (end.Z - start.Z) * t,
    A: start.A + (end.A - start.A) * t,
    B: start.B + (end.B - start.B) * t,
    C: start.C + (end.C - start.C) * t
  };
}
function applyARotationX(position) {
  const angle = position.A * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const y = position.Y * cos - position.Z * sin;
  const z = position.Y * sin + position.Z * cos;
  return { ...position, Y: y, Z: z };
}

// src/threejs-core.ts
async function buildToolpathGeometryFromLinesBatched(lines, options = {}) {
  const arcSegments = options.arcSegments ?? 30;
  const bucketCount = Math.max(1, Math.floor(options.bucketCount ?? 16));
  const laserMode = Boolean(options.laserMode);
  const batch = options.batch;
  const total = lines.length * (laserMode ? 2 : 1);
  const everyLines = Math.max(1, Math.floor(batch?.everyLines ?? 5e3));
  const yieldEveryLines = Math.max(0, Math.floor(batch?.yieldEveryLines ?? 5e4));
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
  const isLaserOn = (modals) => {
    if (modals.spindle === "M5") {
      return false;
    }
    const spindleEnabled = modals.spindle === "M3" || modals.spindle === "M4" || assumeLaserOnWithoutSpindleCommands && modals.spindle === null;
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
      }
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
        await new Promise((resolve) => {
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
  const bucketIndexLaser = (spindleSpeed) => {
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
    const normalized = Math.min(1, Math.max(0, power / maxPower));
    const index = 1 + Math.floor(normalized * (bucketCount - 2));
    return Math.min(bucketCount - 1, Math.max(1, index));
  };
  const rapidVertices = [];
  const cutVertices = laserMode ? Array.from({ length: bucketCount }, () => []) : [new Array()];
  const rapidPrefixEndVertex = new Int32Array(lines.length);
  const cutPrefixEndVertex = Array.from(
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
      const bucketIndexValue = laserMode ? bucketIndexLaser(args.modals.spindleSpeed) : 0;
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
      const bucketIndexValue = laserMode ? bucketIndexLaser(args.modals.spindleSpeed) : 0;
      const target = cutVertices[bucketIndexValue];
      tessellateArc(args, target, arcSegments);
    }
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
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      nextYieldAt += yieldEveryLines;
    }
  }
  return {
    rapid: { positions: Float32Array.from(rapidVertices), prefixEndVertex: rapidPrefixEndVertex },
    cuts: cutVertices.map((vertices, idx) => ({
      positions: Float32Array.from(vertices),
      prefixEndVertex: cutPrefixEndVertex[idx]
    })),
    cutBucketCount: cutVertices.length,
    minPower: 0,
    maxPower
  };
}
function tessellateArc(args, vertices, segments) {
  const count = Math.max(1, Math.floor(segments));
  const { primary, secondary } = planeAxes2(args.plane);
  const radius = distance2d2(
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
  let s = normalizeAngle2(startAngle);
  let e = normalizeAngle2(endAngle);
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
    const position = lerpPosition2(args.start, args.end, t);
    position[primary] = args.center[primary] + radius * Math.cos(angle);
    position[secondary] = args.center[secondary] + radius * Math.sin(angle);
    const rotatedPrevious = applyARotationX2(previous);
    const rotatedPosition = applyARotationX2(position);
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
function applyARotationX2(position) {
  const angle = position.A * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const y = position.Y * cos - position.Z * sin;
  const z = position.Y * sin + position.Z * cos;
  return { ...position, Y: y, Z: z };
}
function planeAxes2(plane) {
  if (plane === "G18") {
    return { primary: "Z", secondary: "X" };
  }
  if (plane === "G19") {
    return { primary: "Y", secondary: "Z" };
  }
  return { primary: "X", secondary: "Y" };
}
function normalizeAngle2(angle) {
  const tau = Math.PI * 2;
  let a = angle % tau;
  if (a < 0) {
    a += tau;
  }
  return a;
}
function distance2d2(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function lerpPosition2(start, end, t) {
  return {
    X: start.X + (end.X - start.X) * t,
    Y: start.Y + (end.Y - start.Y) * t,
    Z: start.Z + (end.Z - start.Z) * t,
    A: start.A + (end.A - start.A) * t,
    B: start.B + (end.B - start.B) * t,
    C: start.C + (end.C - start.C) * t
  };
}

// src/viewer/toolpath/streams.ts
import * as THREE from "three";
function createToolpathStreams(args) {
  const streams = [];
  let bounds = null;
  for (const spec of args.specs) {
    if (spec.positions.length === 0 || spec.opacity <= 0) {
      continue;
    }
    const totalVertices = spec.positions.length / 3;
    const baseColors = buildStreamBaseColors(spec.kind, totalVertices, args.options);
    const simColors = new Float32Array(baseColors.length);
    simColors.set(baseColors);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(spec.positions, 3));
    const colorAttr = new THREE.BufferAttribute(simColors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", colorAttr);
    geometry.computeBoundingBox();
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: spec.opacity
    });
    const line = new THREE.LineSegments(geometry, material);
    args.scene.add(line);
    streams.push({
      line,
      baseColors,
      simColors,
      prefixEndVertex: spec.prefixEndVertex,
      totalVertices,
      greyCursorVertex: 0,
      kind: spec.kind,
      cutBucketIndex: spec.cutBucketIndex
    });
    if (geometry.boundingBox) {
      bounds = bounds ? bounds.union(geometry.boundingBox) : geometry.boundingBox.clone();
    }
  }
  return { streams, bounds };
}
function disposeToolpathStreams(scene, streams) {
  for (const stream of streams) {
    scene.remove(stream.line);
    stream.line.geometry.dispose();
    stream.line.material.dispose();
  }
}
function refreshToolpathStreamColors(streams, options) {
  for (const stream of streams) {
    const nextBase = buildStreamBaseColors(stream.kind, stream.totalVertices, options);
    stream.baseColors = nextBase;
    stream.simColors.set(nextBase);
    stream.greyCursorVertex = 0;
    const attr = stream.line.geometry.getAttribute("color");
    attr.updateRange.offset = 0;
    attr.updateRange.count = stream.simColors.length;
    attr.needsUpdate = true;
  }
}
function refreshToolpathStreamOpacities(args) {
  const rapidOpacity = clamp01(args.options.render.theme.rapidOpacity ?? 0.3);
  for (const stream of args.streams) {
    const material = stream.line.material;
    if (stream.kind === "rapid") {
      material.opacity = rapidOpacity;
      continue;
    }
    material.opacity = cutBucketOpacity({
      bucketIndex: stream.cutBucketIndex ?? 0,
      bucketCount: args.cutBucketCount,
      baseOpacity: args.options.render.theme.opacity
    });
  }
}
function applyStreamGreyCursor(args) {
  const total = args.stream.totalVertices;
  const next = Math.max(0, Math.min(total, Math.floor(args.nextCursorVertex)));
  const previous = Math.max(0, Math.min(total, Math.floor(args.stream.greyCursorVertex)));
  if (next === previous) {
    return;
  }
  const attr = args.stream.line.geometry.getAttribute("color");
  const processed = processedRgb(args.options);
  const startVertex = Math.min(previous, next);
  const endVertex = Math.max(previous, next);
  if (next > previous) {
    for (let v = previous; v < next; v += 1) {
      const off = v * 3;
      args.stream.simColors[off] = processed.r;
      args.stream.simColors[off + 1] = processed.g;
      args.stream.simColors[off + 2] = processed.b;
    }
  } else {
    const startOff = next * 3;
    const endOff = previous * 3;
    args.stream.simColors.set(args.stream.baseColors.subarray(startOff, endOff), startOff);
  }
  attr.updateRange.offset = startVertex * 3;
  attr.updateRange.count = (endVertex - startVertex) * 3;
  attr.needsUpdate = true;
  args.stream.greyCursorVertex = next;
}
function buildStreamBaseColors(kind, totalVertices, options) {
  const themeColors = options.render.theme.colors;
  const cutColor = options.mode.laser ? themeColors.laser ?? themeColors.cutting : themeColors.cutting;
  const color = new THREE.Color(kind === "rapid" ? themeColors.rapid : cutColor);
  const base = new Float32Array(totalVertices * 3);
  for (let v = 0; v < totalVertices; v += 1) {
    const off = v * 3;
    base[off] = color.r;
    base[off + 1] = color.g;
    base[off + 2] = color.b;
  }
  return base;
}
function processedRgb(options) {
  const themeColors = options.render.theme.colors;
  const background = new THREE.Color(options.render.theme.background);
  const processedColor = new THREE.Color(themeColors.processed ?? themeColors.cutting);
  const processed = background.clone().lerp(processedColor, 0.65);
  return { r: processed.r, g: processed.g, b: processed.b };
}
function cutBucketOpacity(args) {
  if (args.bucketCount <= 1) {
    return clamp01(args.baseOpacity);
  }
  const normalized = args.bucketIndex / (args.bucketCount - 1);
  return clamp01(args.baseOpacity * normalized);
}
function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

// src/viewer/types.ts
var defaultGCodeViewerTheme = {
  background: "#111827",
  opacity: 0.9,
  rapidOpacity: 0.3,
  colors: {
    rapid: "#0ef6ae",
    cutting: "#3e85c7",
    laser: "#a855f7",
    processed: "#6b7280",
    boundingBox: "#77a9d7",
    grid: { major: "#2f3840", minor: "#1f252b" },
    axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" }
  }
};
var defaultGCodeViewerOptions = {
  units: "mm",
  mode: { laser: false },
  bit: {
    enabled: true,
    type: "circle",
    size: 2.7,
    opacity: 0.9,
    tweenMs: 140,
    colorSource: "cutting",
    color: defaultGCodeViewerTheme.colors.cutting
  },
  progress: { mode: "grey" },
  grid: { size: 400, axisDepth: 200, labels: true },
  boundingBox: { visible: false, labels: false },
  geometry: { arcSegments: 30, batching: { progressEveryLines: 5e3, yieldEveryLines: 5e4 } },
  render: { antialias: true, theme: defaultGCodeViewerTheme },
  camera: {
    fov: 45,
    focusDurationMs: 900,
    orbit: { enableDamping: true },
    initialPosition: { x: 0, y: -200, z: 200 }
  }
};

// src/viewer/ViewCube.ts
var ViewCube = class {
  constructor(args) {
    this.onSelectView = args.onSelectView;
    this.faceButtons = /* @__PURE__ */ new Map();
    this.root = document.createElement("div");
    this.root.className = "gViewer-viewcube";
    this.cube = document.createElement("div");
    this.cube.className = "gViewer-viewcube__cube";
    this.root.appendChild(this.cube);
    const faces = [
      { view: "front", className: "gViewer-viewcube__face--front", label: "Front" },
      { view: "back", className: "gViewer-viewcube__face--back", label: "Back" },
      { view: "left", className: "gViewer-viewcube__face--left", label: "Left" },
      { view: "right", className: "gViewer-viewcube__face--right", label: "Right" },
      { view: "top", className: "gViewer-viewcube__face--top", label: "Top" },
      { view: "bottom", className: "gViewer-viewcube__face--bottom", label: "Bottom" }
    ];
    for (const face of faces) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `gViewer-viewcube__face ${face.className}`;
      button.textContent = face.label;
      button.addEventListener("click", () => this.onSelectView(face.view));
      this.cube.appendChild(button);
      this.faceButtons.set(face.view, button);
    }
    args.container.appendChild(this.root);
  }
  setActiveFace(view) {
    for (const [key, button] of this.faceButtons.entries()) {
      if (key === view) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }
    }
  }
  setRotationMatrix3d(elements) {
    const values = Array.from({ length: 16 }, (_, index) => {
      const value = elements[index] ?? 0;
      return Number.isFinite(value) ? String(Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(8))) : "0";
    });
    this.cube.style.transform = `matrix3d(${values.join(",")})`;
  }
  dispose() {
    this.root.remove();
  }
};

// src/viewer/bbox/boundingBox.ts
import * as THREE3 from "three";

// src/viewer/render/textSprite.ts
import * as THREE2 from "three";
function createTextSprite(text, color, options = {}) {
  const { opacity = 1, size = 10 } = options;
  const textObject = new THREE2.Object3D();
  const textHeight = 100;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Missing canvas 2D context.");
  }
  context.font = `normal ${textHeight}px Arial`;
  const metrics = context.measureText(text);
  const textWidth = metrics.width;
  canvas.width = textWidth;
  canvas.height = textHeight;
  context.font = `normal ${textHeight}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(text, textWidth / 2, textHeight / 2);
  const texture = new THREE2.Texture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE2.LinearFilter;
  const material = new THREE2.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity
  });
  textObject.textHeight = size;
  textObject.textWidth = textWidth / textHeight * textObject.textHeight;
  if (options.textAlign === "left") {
    textObject.position.x = (options.x ?? 0) + (textObject.textWidth ?? 0) / 2;
  } else if (options.textAlign === "right") {
    textObject.position.x = (options.x ?? 0) - (textObject.textWidth ?? 0) / 2;
  } else {
    textObject.position.x = options.x ?? 0;
  }
  if (options.textBaseline === "top") {
    textObject.position.y = (options.y ?? 0) - (textObject.textHeight ?? 0) / 2;
  } else if (options.textBaseline === "bottom") {
    textObject.position.y = (options.y ?? 0) + (textObject.textHeight ?? 0) / 2;
  } else {
    textObject.position.y = options.y ?? 0;
  }
  textObject.position.z = options.z ?? 0;
  const sprite = new THREE2.Sprite(material);
  sprite.scale.set(textWidth / textHeight * size, size, 1);
  textObject.add(sprite);
  return textObject;
}
function disposeSpriteGroup(group) {
  group.traverse((child) => {
    if (!(child instanceof THREE2.Sprite)) {
      return;
    }
    const material = child.material;
    material.map?.dispose();
    material.dispose();
  });
}

// src/viewer/bbox/boundingBox.ts
var MM_PER_INCH = 25.4;
function createBoundingBoxGroup(bounds, options) {
  const group = new THREE3.Group();
  const helper = new THREE3.Box3Helper(
    bounds.clone(),
    new THREE3.Color(options.render.theme.colors.boundingBox)
  );
  const helperMaterial = helper.material;
  helperMaterial.transparent = true;
  helperMaterial.opacity = 0.12;
  helperMaterial.depthWrite = false;
  group.add(helper);
  if (options.boundingBox.labels) {
    group.add(...createBoundingBoxLabels(bounds.clone(), options));
  }
  return group;
}
function createBoundingBoxLabels(bounds, options) {
  const color = options.render.theme.colors.boundingBox;
  const labelOpacity = 0.32;
  const format = (value) => {
    if (Math.abs(value) < 1e-9) {
      return "0";
    }
    return value.toFixed(3);
  };
  const formatWithUnits = (valueMm) => {
    if (options.units === "in") {
      return `${format(valueMm / MM_PER_INCH)} in`;
    }
    return `${format(valueMm)} mm`;
  };
  const min = bounds.min;
  const max = bounds.max;
  const make = (text) => createTextSprite(text, color, { size: 4, opacity: labelOpacity });
  const xMinLabel = make(formatWithUnits(min.x));
  const xMaxLabel = make(formatWithUnits(max.x));
  const yMinLabel = make(formatWithUnits(min.y));
  const yMaxLabel = make(formatWithUnits(max.y));
  const zMinLabel = make(formatWithUnits(min.z));
  const zMaxLabel = make(formatWithUnits(max.z));
  const size = new THREE3.Vector3();
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
function disposeBoundingBoxGroup(group) {
  group.traverse((child) => {
    if (child instanceof THREE3.LineSegments || child instanceof THREE3.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      return;
    }
    if (child instanceof THREE3.Sprite) {
      const material = child.material;
      material.map?.dispose();
      material.dispose();
    }
  });
}

// src/viewer/camera/camera.ts
import * as THREE4 from "three";
function ensureContainerOverlayLayout(container) {
  const style = window.getComputedStyle(container);
  if (style.position === "static" || !style.position) {
    container.style.position = "relative";
  }
  if (!container.style.overflow) {
    container.style.overflow = "hidden";
  }
}
function easeInOutCubic(t) {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const inv = -2 * t + 2;
  return 1 - inv * inv * inv / 2;
}
function viewDirection(view) {
  const dir = new THREE4.Vector3();
  const axes = {
    right: new THREE4.Vector3(1, 0, 0),
    left: new THREE4.Vector3(-1, 0, 0),
    front: new THREE4.Vector3(0, -1, 0),
    back: new THREE4.Vector3(0, 1, 0),
    top: new THREE4.Vector3(0, 0, 1),
    bottom: new THREE4.Vector3(0, 0, -1)
  };
  switch (view) {
    case "front":
      dir.copy(axes.front);
      break;
    case "back":
      dir.copy(axes.back);
      break;
    case "left":
      dir.copy(axes.left);
      break;
    case "right":
      dir.copy(axes.right);
      break;
    case "top":
      dir.copy(axes.top);
      break;
    case "bottom":
      dir.copy(axes.bottom);
      break;
    case "front-top-left":
      dir.copy(axes.front).add(axes.top).add(axes.left);
      break;
    case "front-top-right":
      dir.copy(axes.front).add(axes.top).add(axes.right);
      break;
    case "front-bottom-left":
      dir.copy(axes.front).add(axes.bottom).add(axes.left);
      break;
    case "front-bottom-right":
      dir.copy(axes.front).add(axes.bottom).add(axes.right);
      break;
    case "back-top-left":
      dir.copy(axes.back).add(axes.top).add(axes.left);
      break;
    case "back-top-right":
      dir.copy(axes.back).add(axes.top).add(axes.right);
      break;
    case "back-bottom-left":
      dir.copy(axes.back).add(axes.bottom).add(axes.left);
      break;
    case "back-bottom-right":
      dir.copy(axes.back).add(axes.bottom).add(axes.right);
      break;
    default:
      dir.copy(axes.front);
      break;
  }
  return dir.normalize();
}
function dominantCameraFace(cameraPosition, target) {
  const dx = cameraPosition.x - target.x;
  const dy = cameraPosition.y - target.y;
  const dz = cameraPosition.z - target.z;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const az = Math.abs(dz);
  if (az >= ax && az >= ay) {
    return dz >= 0 ? "top" : "bottom";
  }
  if (ax >= ay) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "back" : "front";
}

// src/viewer/grid/grid.ts
import * as THREE5 from "three";
var MM_PER_INCH2 = 25.4;
function createUnitGrid(args) {
  const sizeWorld = Math.max(1, args.sizeMm);
  const half = sizeWorld / 2;
  const stepWorld = args.units === "mm" ? 10 : MM_PER_INCH2;
  const count = Math.max(0, Math.floor(half / stepWorld));
  const centerVertices = [];
  const gridVertices = [];
  const pushLineXY = (x1, y1, x2, y2, target) => {
    target.push(x1, y1, 0, x2, y2, 0);
  };
  for (let i = -count; i <= count; i += 1) {
    const y = i * stepWorld;
    pushLineXY(-half, y, half, y, i === 0 ? centerVertices : gridVertices);
  }
  for (let i = -count; i <= count; i += 1) {
    const x = i * stepWorld;
    pushLineXY(x, -half, x, half, i === 0 ? centerVertices : gridVertices);
  }
  const group = new THREE5.Group();
  if (gridVertices.length > 0) {
    group.add(createLineSegments(gridVertices, args.theme.colors.grid.minor, 0.5));
  }
  if (centerVertices.length > 0) {
    group.add(createLineSegments(centerVertices, args.theme.colors.grid.major, 0.6));
  }
  return group;
}
function createLineSegments(vertices, color, opacity) {
  const geometry = new THREE5.BufferGeometry();
  geometry.setAttribute("position", new THREE5.Float32BufferAttribute(vertices, 3));
  const material = new THREE5.LineBasicMaterial({
    color: new THREE5.Color(color),
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE5.LineSegments(geometry, material);
}
function disposeLineSegmentsGroup(group) {
  group.traverse((child) => {
    if (!(child instanceof THREE5.LineSegments)) {
      return;
    }
    child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material.dispose();
    }
  });
}
function createAxes(args) {
  const group = new THREE5.Group();
  const half = Math.max(1, args.sizeWorld) / 2;
  const depth = Math.max(1, args.depthWorld);
  const dashSize = Math.max(1, Math.min(half / 12, 30));
  const gapSize = dashSize * 0.6;
  const lineMaterial = (color) => new THREE5.LineDashedMaterial({
    color: new THREE5.Color(color),
    dashSize,
    gapSize,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  });
  const xLine = new THREE5.Line(
    new THREE5.BufferGeometry().setFromPoints([
      new THREE5.Vector3(-half, 0, 0),
      new THREE5.Vector3(half, 0, 0)
    ]),
    lineMaterial(args.theme.colors.axes.x)
  );
  xLine.computeLineDistances();
  const yLine = new THREE5.Line(
    new THREE5.BufferGeometry().setFromPoints([
      new THREE5.Vector3(0, -half, 0),
      new THREE5.Vector3(0, half, 0)
    ]),
    lineMaterial(args.theme.colors.axes.y)
  );
  yLine.computeLineDistances();
  const zLine = new THREE5.Line(
    new THREE5.BufferGeometry().setFromPoints([
      new THREE5.Vector3(0, 0, 0),
      new THREE5.Vector3(0, 0, depth)
    ]),
    lineMaterial(args.theme.colors.axes.z)
  );
  zLine.computeLineDistances();
  group.add(xLine, yLine, zLine);
  const labelOffset = Math.max(2, dashSize);
  const xLabel = createTextSprite("X", args.theme.colors.axes.x, { size: 5 });
  xLabel.position.set(half + labelOffset, 0, 0);
  const yLabel = createTextSprite("Y", args.theme.colors.axes.y, { size: 5 });
  yLabel.position.set(0, half + labelOffset, 0);
  const zLabel = createTextSprite("Z", args.theme.colors.axes.z, { size: 5 });
  zLabel.position.set(0, 0, depth + labelOffset);
  group.add(xLabel, yLabel, zLabel);
  return group;
}
function disposeAxesGroup(group) {
  group.traverse((child) => {
    if (child instanceof THREE5.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      return;
    }
    if (child instanceof THREE5.Sprite) {
      const material = child.material;
      material.map?.dispose();
      material.dispose();
    }
  });
}
function createGridLabels(args) {
  const group = new THREE5.Group();
  const halfWorld = Math.max(1, args.sizeMm) / 2;
  const displayStep = args.units === "mm" ? 10 : 1;
  const displayStart = displayStep;
  const displayMax = args.units === "mm" ? halfWorld : halfWorld / MM_PER_INCH2;
  const displayIncrement = displayStep * 2;
  const unitScale = args.units === "mm" ? 1 : MM_PER_INCH2;
  const opacity = 0.5;
  const size = 4;
  const z = 0.1;
  const axisOffset = 5;
  for (let value = displayStart; value <= displayMax + 1e-6; value += displayIncrement) {
    const worldValue = value * unitScale;
    if (worldValue > halfWorld + 1e-6) {
      continue;
    }
    const xColor = args.theme.colors.axes.x;
    const yColor = args.theme.colors.axes.y;
    const spriteOptions = { opacity, size };
    const xPos = createTextSprite(String(value), xColor, spriteOptions);
    xPos.position.set(worldValue, axisOffset, z);
    const xNeg = createTextSprite(String(-value), xColor, spriteOptions);
    xNeg.position.set(-worldValue, axisOffset, z);
    const yPos = createTextSprite(String(value), yColor, spriteOptions);
    yPos.position.set(-axisOffset, worldValue, z);
    const yNeg = createTextSprite(String(-value), yColor, spriteOptions);
    yNeg.position.set(-axisOffset, -worldValue, z);
    group.add(xPos, xNeg, yPos, yNeg);
  }
  return group;
}

// src/viewer/bit/bit.ts
import * as THREE6 from "three";
var BIT_COLOR = "#c9883d";
function clamp012(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
function easeOutCubic(t) {
  const x = clamp012(t);
  return 1 - Math.pow(1 - x, 3);
}
function createTriangleGeometry(size) {
  const clampedSize = Math.max(1e-3, size);
  const height = clampedSize * 1.6;
  const radius = clampedSize * 0.7;
  const geometry = new THREE6.ConeGeometry(radius, height, 3, 1, false);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, height / 2);
  return geometry;
}
function createCircleGeometry(size) {
  const clampedSize = Math.max(1e-3, size);
  const radius = clampedSize * 0.65;
  const geometry = new THREE6.SphereGeometry(radius, 18, 12);
  geometry.translate(0, 0, radius);
  return geometry;
}
function createBitGeometry(options) {
  const size = Math.max(1e-3, options.bit.size);
  if (options.bit.type === "triangle") {
    return createTriangleGeometry(size);
  }
  return createCircleGeometry(size);
}
function createBitMesh(options) {
  const opacity = clamp012(options.bit.opacity);
  const geometry = createBitGeometry(options);
  const material = new THREE6.MeshBasicMaterial({
    color: new THREE6.Color(BIT_COLOR),
    transparent: opacity < 1,
    opacity,
    side: THREE6.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new THREE6.Mesh(geometry, material);
  mesh.renderOrder = 1e3;
  return mesh;
}
function createBitMarker(initialOptions) {
  const root = new THREE6.Group();
  root.name = "gviewer:bit-marker";
  root.visible = Boolean(initialOptions.bit.enabled);
  let currentOptions = initialOptions;
  let mesh = createBitMesh(currentOptions);
  root.add(mesh);
  let tween = null;
  const setMeshOptions = (nextOptions) => {
    const nextType = nextOptions.bit.type;
    const prevType = currentOptions.bit.type;
    const nextSize = nextOptions.bit.size;
    const prevSize = currentOptions.bit.size;
    const typeChanged = nextType !== prevType;
    const sizeChanged = nextSize !== prevSize;
    const nextOpacity = clamp012(nextOptions.bit.opacity);
    const material = mesh.material;
    const needsRebuild = typeChanged || sizeChanged;
    if (needsRebuild) {
      root.remove(mesh);
      mesh.geometry.dispose?.();
      material?.dispose?.();
      mesh = createBitMesh(nextOptions);
      root.add(mesh);
    } else {
      if (material?.color) {
        material.color = new THREE6.Color(BIT_COLOR);
      }
      material.opacity = nextOpacity;
      material.transparent = nextOpacity < 1;
      material.needsUpdate = true;
    }
    currentOptions = nextOptions;
    root.visible = Boolean(nextOptions.bit.enabled);
  };
  const setTarget = (position, options) => {
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
      to: { x, y, z }
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
        THREE6.MathUtils.lerp(tween.from.x, tween.to.x, eased),
        THREE6.MathUtils.lerp(tween.from.y, tween.to.y, eased),
        THREE6.MathUtils.lerp(tween.from.z, tween.to.z, eased)
      );
      if (t >= 1) {
        root.position.set(tween.to.x, tween.to.y, tween.to.z);
        tween = null;
      }
    },
    dispose: () => {
      root.remove(mesh);
      mesh.geometry.dispose?.();
      const material = mesh.material;
      material?.dispose?.();
    }
  };
}

// src/viewer/GCodeViewer.ts
var MM_PER_INCH3 = 25.4;
var GCodeViewer = class {
  constructor(args) {
    this.viewCube = null;
    this.resizeObserver = null;
    this.onWindowResize = null;
    this.animationFrameId = null;
    this.gridGroup = null;
    this.axesGroup = null;
    this.gridLabelsGroup = null;
    this.boundingBoxGroup = null;
    this.bitMarker = null;
    this.toolpathStreams = [];
    this.toolpathCutBucketCount = 1;
    this.toolpathRotationA = 0;
    this.currentLines = [];
    this.renderSequence = 0;
    this.currentBounds = null;
    this.cameraFocusTransition = null;
    this.id = args.id;
    this.container = args.container;
    this.callbacks = args.callbacks ?? {};
    this.options = mergeOptions(defaultGCodeViewerOptions, args.options);
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    this.container.appendChild(this.canvas);
    ensureContainerOverlayLayout(this.container);
    this.renderer = new THREE7.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.options.render.antialias
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(this.options.render.theme.background, 1);
    this.scene = new THREE7.Scene();
    this.scene.add(new THREE7.AmbientLight(16777215, 0.7));
    this.scene.add(new THREE7.DirectionalLight(16777215, 0.6));
    this.toolpathRoot = new THREE7.Group();
    this.toolpathRoot.name = "gviewer:toolpath-root";
    this.scene.add(this.toolpathRoot);
    this.camera = new THREE7.PerspectiveCamera(this.options.camera.fov, 1, 0.1, 1e5);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(
      this.options.camera.initialPosition.x,
      this.options.camera.initialPosition.y,
      this.options.camera.initialPosition.z
    );
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = this.options.camera.orbit.enableDamping;
    this.controls.update();
    this.viewCubeCorrection = new THREE7.Matrix4().makeRotationX(THREE7.MathUtils.degToRad(90));
    this.viewCube = new ViewCube({
      container: this.container,
      onSelectView: (view) => {
        this.snapCameraToView(view, { durationMs: 240 });
      }
    });
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    } else {
      this.onWindowResize = () => this.resize();
      window.addEventListener("resize", this.onWindowResize);
    }
    this.renderGridAndAxes();
    this.refreshGridLabels();
    this.refreshBoundingBox();
    this.ensureBitMarker();
    this.resize();
    this.startAnimationLoop();
  }
  setBitPosition(position, options) {
    this.ensureBitMarker();
    this.bitMarker?.setTarget(position, options);
  }
  setBitVisible(visible) {
    this.ensureBitMarker();
    this.bitMarker?.setVisible(visible);
  }
  setToolpathRotationA(aDegrees) {
    const next = Number(aDegrees) || 0;
    this.toolpathRotationA = next;
    this.toolpathRoot.rotation.x = THREE7.MathUtils.degToRad(next);
  }
  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }
  hideUntilLine(lineIndex, mode) {
    const resolvedMode = mode ?? this.options.progress.mode;
    const index = Math.floor(lineIndex);
    for (const stream of this.toolpathStreams) {
      const cursor = index < 0 ? 0 : stream.prefixEndVertex[Math.min(index, stream.prefixEndVertex.length - 1)];
      if (resolvedMode === "grey") {
        stream.line.geometry.setDrawRange(0, stream.totalVertices);
        applyStreamGreyCursor({ stream, nextCursorVertex: cursor, options: this.options });
      } else {
        stream.line.geometry.setDrawRange(cursor, Math.max(0, stream.totalVertices - cursor));
      }
    }
  }
  showAll() {
    for (const stream of this.toolpathStreams) {
      stream.line.geometry.setDrawRange(0, stream.totalVertices);
    }
  }
  resetColors() {
    for (const stream of this.toolpathStreams) {
      stream.greyCursorVertex = 0;
      stream.simColors.set(stream.baseColors);
      const attr = stream.line.geometry.getAttribute("color");
      attr.updateRange.offset = 0;
      attr.updateRange.count = stream.simColors.length;
      attr.needsUpdate = true;
    }
  }
  snapCameraToView(view, options = {}) {
    const durationMs = Math.max(0, Math.floor(options.durationMs ?? 240));
    const target = this.controls.target.clone();
    const currentDistance = this.camera.position.distanceTo(target);
    const distance = Math.max(1e-6, options.distance ?? currentDistance);
    const direction = viewDirection(view);
    const toPosition = target.clone().add(direction.multiplyScalar(distance));
    const maxDim = Math.max(1, distance);
    this.camera.near = maxDim / 1e3;
    this.camera.far = maxDim * 50;
    this.camera.updateProjectionMatrix();
    if (this.cameraFocusTransition) {
      this.controls.enableDamping = this.cameraFocusTransition.dampingEnabled;
    }
    this.cameraFocusTransition = {
      startedAt: performance.now(),
      duration: durationMs,
      fromPosition: this.camera.position.clone(),
      toPosition,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      dampingEnabled: this.controls.enableDamping
    };
    this.controls.enableDamping = false;
  }
  async loadFromUrl(url, args = {}) {
    this.emitProgress({ state: "indeterminate", label: "Loading file..." });
    const response = await fetch(url, { signal: args.signal });
    if (!response.ok) {
      this.emitProgress({ state: "hidden" });
      throw new Error(`Failed to load gcode: ${response.statusText}`);
    }
    const text = await response.text();
    await this.loadFromText(text);
  }
  async loadFromFile(file) {
    this.emitProgress({ state: "indeterminate", label: "Loading file..." });
    const text = await file.text();
    await this.loadFromText(text);
  }
  async loadFromText(gcode) {
    await this.loadFromLines(gcode.split(/\r?\n/));
  }
  async loadFromLines(lines) {
    this.currentLines = Array.from(lines);
    await this.renderScene();
  }
  unload() {
    this.currentLines = [];
    this.setGeometryEmpty();
    this.emitProgress({ state: "hidden" });
  }
  setOptions(next) {
    const previous = this.options;
    this.options = mergeOptions(this.options, next);
    if (previous.render.antialias !== this.options.render.antialias || previous.render.theme.background !== this.options.render.theme.background) {
      this.renderer.setClearColor(this.options.render.theme.background, 1);
    }
    if (previous.render.theme.opacity !== this.options.render.theme.opacity || previous.render.theme.rapidOpacity !== this.options.render.theme.rapidOpacity) {
      this.refreshToolpathOpacities();
    }
    if (previous.camera.fov !== this.options.camera.fov) {
      this.camera.fov = this.options.camera.fov;
      this.camera.updateProjectionMatrix();
    }
    if (previous.camera.orbit.enableDamping !== this.options.camera.orbit.enableDamping) {
      this.controls.enableDamping = this.options.camera.orbit.enableDamping;
    }
    const gridLayoutChanged = previous.units !== this.options.units || previous.grid.size !== this.options.grid.size || previous.grid.axisDepth !== this.options.grid.axisDepth;
    const gridStyleChanged = previous.render.theme.colors.grid.major !== this.options.render.theme.colors.grid.major || previous.render.theme.colors.grid.minor !== this.options.render.theme.colors.grid.minor || previous.render.theme.colors.axes.x !== this.options.render.theme.colors.axes.x || previous.render.theme.colors.axes.y !== this.options.render.theme.colors.axes.y || previous.render.theme.colors.axes.z !== this.options.render.theme.colors.axes.z;
    if (gridLayoutChanged || gridStyleChanged) {
      this.renderGridAndAxes();
    }
    const gridLabelsChanged = previous.grid.labels !== this.options.grid.labels || previous.units !== this.options.units || previous.grid.size !== this.options.grid.size || gridStyleChanged;
    if (gridLabelsChanged) {
      this.refreshGridLabels();
    }
    const bboxChanged = previous.boundingBox.visible !== this.options.boundingBox.visible || previous.boundingBox.labels !== this.options.boundingBox.labels || previous.units !== this.options.units || previous.render.theme.colors.boundingBox !== this.options.render.theme.colors.boundingBox;
    if (bboxChanged) {
      this.refreshBoundingBox();
    }
    const toolpathColorsChanged = previous.render.theme.colors.rapid !== this.options.render.theme.colors.rapid || previous.render.theme.colors.cutting !== this.options.render.theme.colors.cutting || previous.render.theme.colors.laser !== this.options.render.theme.colors.laser || previous.render.theme.background !== this.options.render.theme.background || previous.render.theme.colors.processed !== this.options.render.theme.colors.processed;
    if (toolpathColorsChanged) {
      this.refreshToolpathColors();
    }
    const bitChanged = previous.bit.enabled !== this.options.bit.enabled || previous.bit.type !== this.options.bit.type || previous.bit.size !== this.options.bit.size || previous.bit.opacity !== this.options.bit.opacity || previous.bit.colorSource !== this.options.bit.colorSource || previous.bit.color !== this.options.bit.color || toolpathColorsChanged;
    if (bitChanged) {
      this.ensureBitMarker();
      this.bitMarker?.setOptions(this.options);
    }
    if (previous.mode.laser !== this.options.mode.laser) {
      void this.renderScene();
    }
  }
  getOptions() {
    return this.options;
  }
  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.floor(rect.width || this.container.clientWidth || window.innerWidth)
    );
    const height = Math.max(
      1,
      Math.floor(rect.height || this.container.clientHeight || window.innerHeight)
    );
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  focusToModel() {
    if (!this.currentBounds) {
      return;
    }
    this.startCameraFocus(this.currentBounds);
  }
  resetCamera() {
    this.cameraFocusTransition = null;
    this.controls.enableDamping = this.options.camera.orbit.enableDamping;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(
      this.options.camera.initialPosition.x,
      this.options.camera.initialPosition.y,
      this.options.camera.initialPosition.z
    );
    this.controls.update();
  }
  getBounds() {
    if (!this.currentBounds) {
      return null;
    }
    return {
      min: {
        x: this.currentBounds.min.x,
        y: this.currentBounds.min.y,
        z: this.currentBounds.min.z
      },
      max: {
        x: this.currentBounds.max.x,
        y: this.currentBounds.max.y,
        z: this.currentBounds.max.z
      }
    };
  }
  dispose() {
    this.renderSequence += 1;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.onWindowResize) {
      window.removeEventListener("resize", this.onWindowResize);
      this.onWindowResize = null;
    }
    this.setGeometryEmpty();
    this.setGridGroup(null);
    this.setAxesGroup(null);
    this.setGridLabelsGroup(null);
    this.setBoundingBoxGroup(null);
    this.setBitMarker(null);
    this.controls.dispose();
    this.renderer.dispose();
    this.viewCube?.dispose();
    this.viewCube = null;
    this.container.removeChild(this.canvas);
  }
  emitProgress(event) {
    this.callbacks.onProgress?.({ id: this.id, ...event });
  }
  emitBoundsChanged() {
    this.callbacks.onBoundsChanged?.({ id: this.id, bounds: this.getBounds() });
  }
  startAnimationLoop() {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);
      const now = performance.now();
      this.updateCameraFocusTransition();
      this.updateViewCubeRotation();
      this.controls.update();
      this.bitMarker?.update(now);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }
  ensureBitMarker() {
    if (this.bitMarker) {
      return;
    }
    this.bitMarker = createBitMarker(this.options);
    this.scene.add(this.bitMarker.object);
  }
  worldSizes() {
    const scale = this.options.units === "in" ? MM_PER_INCH3 : 1;
    return {
      sizeMm: Math.max(1, this.options.grid.size * scale),
      axisDepthMm: Math.max(1, this.options.grid.axisDepth * scale)
    };
  }
  renderGridAndAxes() {
    const { sizeMm, axisDepthMm } = this.worldSizes();
    this.setGridGroup(
      createUnitGrid({
        units: this.options.units,
        sizeMm,
        theme: this.options.render.theme
      })
    );
    this.setAxesGroup(createAxes({ sizeWorld: sizeMm, depthWorld: axisDepthMm, theme: this.options.render.theme }));
  }
  refreshGridLabels() {
    if (!this.options.grid.labels) {
      this.setGridLabelsGroup(null);
      return;
    }
    const { sizeMm } = this.worldSizes();
    this.setGridLabelsGroup(
      createGridLabels({ sizeMm, units: this.options.units, theme: this.options.render.theme })
    );
  }
  refreshBoundingBox() {
    if (!this.options.boundingBox.visible || !this.currentBounds) {
      this.setBoundingBoxGroup(null);
      return;
    }
    this.setBoundingBoxGroup(createBoundingBoxGroup(this.currentBounds, this.options));
  }
  setBitMarker(next) {
    if (this.bitMarker) {
      this.scene.remove(this.bitMarker.object);
      this.bitMarker.dispose();
    }
    this.bitMarker = next;
    if (this.bitMarker) {
      this.scene.add(this.bitMarker.object);
    }
  }
  setGridGroup(group) {
    if (this.gridGroup) {
      this.scene.remove(this.gridGroup);
      disposeLineSegmentsGroup(this.gridGroup);
      this.gridGroup = null;
    }
    if (group) {
      this.gridGroup = group;
      this.scene.add(group);
    }
  }
  setAxesGroup(group) {
    if (this.axesGroup) {
      this.scene.remove(this.axesGroup);
      disposeAxesGroup(this.axesGroup);
      this.axesGroup = null;
    }
    if (group) {
      this.axesGroup = group;
      this.scene.add(group);
    }
  }
  setGridLabelsGroup(group) {
    if (this.gridLabelsGroup) {
      this.scene.remove(this.gridLabelsGroup);
      disposeSpriteGroup(this.gridLabelsGroup);
      this.gridLabelsGroup = null;
    }
    if (group) {
      this.gridLabelsGroup = group;
      this.scene.add(group);
    }
  }
  setBoundingBoxGroup(group) {
    if (this.boundingBoxGroup) {
      this.scene.remove(this.boundingBoxGroup);
      disposeBoundingBoxGroup(this.boundingBoxGroup);
      this.boundingBoxGroup = null;
    }
    if (group) {
      this.boundingBoxGroup = group;
      this.scene.add(group);
    }
  }
  setGeometryEmpty() {
    disposeToolpathStreams(this.toolpathRoot, this.toolpathStreams);
    this.toolpathStreams = [];
    this.toolpathCutBucketCount = 1;
    this.currentBounds = null;
    this.emitBoundsChanged();
    this.refreshBoundingBox();
  }
  setToolpathGeometry(args) {
    this.setGeometryEmpty();
    this.toolpathCutBucketCount = Math.max(1, Math.floor(args.cutBucketCount));
    const specs = [
      {
        kind: "rapid",
        cutBucketIndex: null,
        positions: args.rapid.positions,
        prefixEndVertex: args.rapid.prefixEndVertex,
        opacity: clamp013(this.options.render.theme.rapidOpacity ?? 0.3)
      },
      ...args.cuts.map((cut, index) => ({
        kind: "cut",
        cutBucketIndex: index,
        positions: cut.positions,
        prefixEndVertex: cut.prefixEndVertex,
        opacity: this.cutBucketOpacity(index)
      }))
    ];
    const { streams, bounds } = createToolpathStreams({ specs, options: this.options, scene: this.toolpathRoot });
    this.toolpathStreams = streams;
    this.currentBounds = bounds ? bounds.clone() : null;
    this.emitBoundsChanged();
    this.refreshBoundingBox();
    this.setToolpathRotationA(this.toolpathRotationA);
  }
  refreshToolpathColors() {
    refreshToolpathStreamColors(this.toolpathStreams, this.options);
  }
  refreshToolpathOpacities() {
    refreshToolpathStreamOpacities({
      streams: this.toolpathStreams,
      options: this.options,
      cutBucketCount: this.toolpathCutBucketCount
    });
  }
  cutBucketOpacity(bucketIndex) {
    const baseOpacity = this.options.render.theme.opacity;
    const bucketCount = this.toolpathCutBucketCount;
    if (bucketCount <= 1) {
      return baseOpacity;
    }
    const normalized = bucketIndex / (bucketCount - 1);
    return clamp013(baseOpacity * normalized);
  }
  async renderScene() {
    if (this.currentLines.length === 0) {
      this.setGeometryEmpty();
      this.emitProgress({ state: "hidden" });
      return;
    }
    const mySequence = this.renderSequence += 1;
    try {
      if (this.options.mode.laser) {
        this.emitProgress({ state: "indeterminate", label: "Scanning power..." });
      } else {
        this.emitProgress({
          state: "determinate",
          label: "Building geometry...",
          processed: 0,
          total: this.currentLines.length
        });
      }
      const result = await buildToolpathGeometryFromLinesBatched(this.currentLines, {
        arcSegments: this.options.geometry.arcSegments,
        bucketCount: 16,
        laserMode: this.options.mode.laser,
        batch: {
          everyLines: this.options.geometry.batching.progressEveryLines,
          yieldEveryLines: this.options.geometry.batching.yieldEveryLines,
          shouldAbort: () => mySequence !== this.renderSequence,
          onProgress: (processed, total) => {
            if (mySequence !== this.renderSequence) {
              return;
            }
            this.emitProgress({ state: "determinate", label: "Building geometry...", processed, total });
          }
        }
      });
      if (mySequence !== this.renderSequence) {
        return;
      }
      this.setToolpathGeometry({
        rapid: result.rapid,
        cuts: result.cuts,
        cutBucketCount: result.cutBucketCount
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Aborted.") {
        return;
      }
      throw error;
    } finally {
      if (mySequence === this.renderSequence) {
        this.emitProgress({ state: "hidden" });
      }
    }
  }
  startCameraFocus(bounds) {
    const center = new THREE7.Vector3();
    bounds.getCenter(center);
    const size = new THREE7.Vector3();
    bounds.getSize(size);
    const halfMax = Math.max(size.x, size.y, 1) / 2;
    const fovRadians = THREE7.MathUtils.degToRad(this.camera.fov);
    const distance = halfMax / Math.tan(fovRadians / 2) * 1.25 + size.z;
    const direction = viewDirection("front-top-left");
    const toPosition = center.clone().add(direction.multiplyScalar(distance));
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    this.camera.near = maxDim / 1e3;
    this.camera.far = maxDim * 50;
    this.camera.updateProjectionMatrix();
    if (this.cameraFocusTransition) {
      this.controls.enableDamping = this.cameraFocusTransition.dampingEnabled;
    }
    this.cameraFocusTransition = {
      startedAt: performance.now(),
      duration: this.options.camera.focusDurationMs,
      fromPosition: this.camera.position.clone(),
      toPosition,
      fromTarget: this.controls.target.clone(),
      toTarget: center,
      dampingEnabled: this.controls.enableDamping
    };
    this.controls.enableDamping = false;
  }
  updateCameraFocusTransition() {
    if (!this.cameraFocusTransition) {
      return;
    }
    const now = performance.now();
    const elapsed = now - this.cameraFocusTransition.startedAt;
    const t = Math.min(1, Math.max(0, elapsed / this.cameraFocusTransition.duration));
    const eased = easeInOutCubic(t);
    this.camera.position.lerpVectors(this.cameraFocusTransition.fromPosition, this.cameraFocusTransition.toPosition, eased);
    this.controls.target.lerpVectors(this.cameraFocusTransition.fromTarget, this.cameraFocusTransition.toTarget, eased);
    if (t >= 1) {
      const restoreDamping = this.cameraFocusTransition.dampingEnabled;
      this.camera.position.copy(this.cameraFocusTransition.toPosition);
      this.controls.target.copy(this.cameraFocusTransition.toTarget);
      this.cameraFocusTransition = null;
      this.controls.enableDamping = false;
      this.controls.update();
      this.controls.enableDamping = restoreDamping;
    }
  }
  updateViewCubeRotation() {
    if (!this.viewCube) {
      return;
    }
    const q = this.camera.quaternion.clone();
    if (typeof q.invert === "function") {
      q.invert();
    } else if (typeof q.inverse === "function") {
      q.inverse();
    }
    const matrix = new THREE7.Matrix4();
    matrix.makeRotationFromQuaternion(q);
    matrix.multiply(this.viewCubeCorrection);
    this.viewCube.setRotationMatrix3d(matrix.elements);
    const face = dominantCameraFace(this.camera.position, this.controls.target);
    this.viewCube.setActiveFace(face);
  }
};
function clamp013(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
function mergeOptions(base, next) {
  if (!next) {
    return { ...base };
  }
  const mergedTheme = mergeTheme(base.render.theme, next.render?.theme);
  return {
    ...base,
    ...next,
    mode: { ...base.mode, ...next.mode },
    bit: { ...base.bit, ...next.bit },
    progress: { ...base.progress, ...next.progress },
    grid: { ...base.grid, ...next.grid },
    boundingBox: { ...base.boundingBox, ...next.boundingBox },
    geometry: {
      ...base.geometry,
      ...next.geometry,
      batching: { ...base.geometry.batching, ...next.geometry?.batching }
    },
    render: {
      ...base.render,
      ...next.render,
      theme: mergedTheme
    },
    camera: {
      ...base.camera,
      ...next.camera,
      orbit: { ...base.camera.orbit, ...next.camera?.orbit },
      initialPosition: { ...base.camera.initialPosition, ...next.camera?.initialPosition }
    }
  };
}
function mergeTheme(base, next) {
  if (!next) {
    return base;
  }
  return {
    ...base,
    ...next,
    colors: {
      ...base.colors,
      ...next.colors,
      grid: { ...base.colors.grid, ...next.colors?.grid },
      axes: { ...base.colors.axes, ...next.colors?.axes }
    }
  };
}

// src/viewer/themes.ts
var gCodeViewerThemePresets = {
  dark: {
    background: "#111827",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#0ef6ae",
      cutting: "#3e85c7",
      laser: "#a855f7",
      processed: "#6b7280",
      boundingBox: "#77a9d7",
      grid: { major: "#2f3840", minor: "#1f252b" },
      axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" }
    }
  },
  light: {
    background: "#e5e7eb",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#295d8d",
      cutting: "#111827",
      laser: "#FF0000",
      processed: "#9ca3af",
      boundingBox: "#5191cc",
      grid: { major: "#77a9d7", minor: "#a8c6e4" },
      axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" }
    }
  },
  "flexoki-dark": {
    background: "#100f0f",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#DA702C",
      cutting: "#3AA99F",
      laser: "#8B7EC8",
      processed: "#6f6e69",
      boundingBox: "#da702c",
      grid: { major: "#403e3c", minor: "#282726" },
      axes: { x: "#d14d41", y: "#879a39", z: "#4385be" }
    }
  },
  "tokyo-night": {
    background: "#1a1b26",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#ff9e64",
      cutting: "#7dcfff",
      laser: "#bb9af7",
      processed: "#565f89",
      boundingBox: "#73daca",
      grid: { major: "#414868", minor: "#24283b" },
      axes: { x: "#f7768e", y: "#9ece6a", z: "#7aa2f7" }
    }
  },
  "gruvbox-light": {
    background: "#fbf1c7",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#d65d0e",
      cutting: "#3c3836",
      laser: "#b16286",
      processed: "#928374",
      boundingBox: "#076678",
      grid: { major: "#d5c4a1", minor: "#ebdbb2" },
      axes: { x: "#cc241d", y: "#98971a", z: "#458588" }
    }
  },
  "ayu-dark": {
    background: "#0b0e14",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#FFA659",
      cutting: "#73D0FF",
      laser: "#DFBFFF",
      processed: "#6E7C8F",
      boundingBox: "#95E6CB",
      grid: { major: "#242b38", minor: "#1a1f2b" },
      axes: { x: "#F28779", y: "#D5FF80", z: "#5CCFE6" }
    }
  },
  "ayu-light": {
    background: "#fafafa",
    opacity: 0.9,
    rapidOpacity: 0.3,
    colors: {
      rapid: "#FA8D3E",
      cutting: "#22A4E6",
      laser: "#A37ACC",
      processed: "#ADAEB1",
      boundingBox: "#5C6773",
      grid: { major: "#c9cacc", minor: "#e5e7ea" },
      axes: { x: "#F07171", y: "#86B300", z: "#55B4D4" }
    }
  }
};
export {
  GCodeViewer,
  ViewCube,
  defaultGCodeViewerOptions,
  defaultGCodeViewerTheme,
  gCodeViewerThemePresets
};
