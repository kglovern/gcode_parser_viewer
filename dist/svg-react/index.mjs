// src/svg-react/GCodeSVGVisualizer.tsx
import * as React from "react";

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
function buildMovementVerticesFromLines(lines, options = {}) {
  const rapidVertices = [];
  const cuttingVertices = [];
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
    }
  });
  for (const line of lines) {
    if (!line) {
      continue;
    }
    virtualizer.processLine(line);
  }
  return {
    rapid: Float32Array.from(rapidVertices),
    cutting: Float32Array.from(cuttingVertices)
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

// src/svg/types.ts
var defaultGCodeSVGOptions = {
  rapidColor: "#4a9eff",
  cutColor: "#e05c00",
  boundingBoxColor: "#d0d0d0",
  strokeWidth: 0.5,
  arcSegments: 30,
  padding: 5,
  projectionMode: "isometric"
};

// src/svg/GCodeSVGRenderer.ts
var DEFAULT_ROT_X = -0.5;
var DEFAULT_ROT_Y = 0.6;
var GCodeSVGRenderer = class {
  constructor(container, options) {
    this.viewBox = { x: 0, y: 0, w: 100, h: 100 };
    // Camera
    this.rotX = DEFAULT_ROT_X;
    this.rotY = DEFAULT_ROT_Y;
    this.centerX = 0;
    this.centerY = 0;
    this.centerZ = 0;
    this.focalLength = 500;
    // Interaction
    this.dragMode = "none";
    this.dragLast = { x: 0, y: 0 };
    this.rafPending = false;
    // Geometry
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };
    // ── Projection ────────────────────────────────────────────────────────────
    this.project = (x, y, z) => {
      const dx = x - this.centerX;
      const dy = y - this.centerY;
      const dz = z - this.centerZ;
      const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
      const rx = dx * cosY + dz * sinY;
      const ry = dy;
      const rz = -dx * sinY + dz * cosY;
      const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
      const fx = rx;
      const fy = ry * cosX - rz * sinX;
      const fz = ry * sinX + rz * cosX;
      if (this.options.projectionMode === "perspective") {
        const s = this.focalLength / (this.focalLength + fz);
        return { x: fx * s, y: -fy * s };
      }
      return { x: fx, y: -fy };
    };
    // ── Interaction ───────────────────────────────────────────────────────────
    this.onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const pt = this.svgPoint(e.clientX, e.clientY);
      const { x, y, w, h } = this.viewBox;
      this.viewBox = {
        x: pt.x - (pt.x - x) * factor,
        y: pt.y - (pt.y - y) * factor,
        w: w * factor,
        h: h * factor
      };
      this.applyViewBox();
    };
    this.onPointerDown = (e) => {
      const isPan = e.button === 2 || e.shiftKey;
      this.dragMode = isPan ? "pan" : "orbit";
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.svg.setPointerCapture(e.pointerId);
      this.svg.style.cursor = isPan ? "move" : "grabbing";
      e.preventDefault();
    };
    this.onPointerMove = (e) => {
      if (this.dragMode === "none") return;
      const dx = e.clientX - this.dragLast.x;
      const dy = e.clientY - this.dragLast.y;
      this.dragLast = { x: e.clientX, y: e.clientY };
      if (this.dragMode === "orbit") {
        const rect = this.svg.getBoundingClientRect();
        const sensitivity = Math.PI / Math.min(rect.width, rect.height);
        this.rotY += dx * sensitivity;
        this.rotX += dy * sensitivity;
        this.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotX));
        this.fitView();
        this.scheduleDraw();
      } else {
        const rect = this.svg.getBoundingClientRect();
        this.viewBox = {
          ...this.viewBox,
          x: this.viewBox.x - dx / rect.width * this.viewBox.w,
          y: this.viewBox.y - dy / rect.height * this.viewBox.h
        };
        this.applyViewBox();
      }
    };
    this.onPointerUp = (e) => {
      if (this.dragMode === "none") return;
      this.dragMode = "none";
      this.svg.releasePointerCapture(e.pointerId);
      this.svg.style.cursor = "grab";
    };
    this.onContextMenu = (e) => {
      e.preventDefault();
    };
    this.options = { ...defaultGCodeSVGOptions, ...options };
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.cssText = "width:100%;height:100%;display:block;cursor:grab;user-select:none;";
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    this.bboxPath = makePath();
    this.rapidPath = makePath();
    this.rapidPath.setAttribute("stroke-linecap", "round");
    this.rapidPath.setAttribute("stroke-linejoin", "round");
    this.cutPath = makePath();
    this.cutPath.setAttribute("stroke-linecap", "round");
    this.cutPath.setAttribute("stroke-linejoin", "round");
    this.bboxLabelX = makeText("middle", "hanging");
    this.bboxLabelY = makeText("middle", "hanging");
    this.bboxLabelZ = makeText("start", "middle");
    this.svg.appendChild(this.bboxPath);
    this.svg.appendChild(this.rapidPath);
    this.svg.appendChild(this.cutPath);
    this.svg.appendChild(this.bboxLabelX);
    this.svg.appendChild(this.bboxLabelY);
    this.svg.appendChild(this.bboxLabelZ);
    container.appendChild(this.svg);
    this.applyOptions();
    this.bindEvents();
  }
  // ── Public API ────────────────────────────────────────────────────────────
  loadFromLines(lines) {
    const { rapid, cutting } = buildMovementVerticesFromLines(lines, {
      arcSegments: this.options.arcSegments
    });
    this.rapidVerts = rapid;
    this.cutVerts = cutting;
    this.bounds = computeBounds(rapid, cutting);
    if (!this.bounds.empty) {
      this.centerX = (this.bounds.minX + this.bounds.maxX) / 2;
      this.centerY = (this.bounds.minY + this.bounds.maxY) / 2;
      this.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
      const diag = Math.hypot(
        this.bounds.maxX - this.bounds.minX,
        this.bounds.maxY - this.bounds.minY,
        this.bounds.maxZ - this.bounds.minZ
      );
      this.focalLength = diag * 2;
    }
    this.rotX = DEFAULT_ROT_X;
    this.rotY = DEFAULT_ROT_Y;
    this.fitView();
    this.rebuildAndRender();
  }
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") {
          reject(new Error("Failed to read file"));
          return;
        }
        this.loadFromText(text);
        resolve();
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsText(file);
    });
  }
  loadFromText(gcode) {
    this.loadFromLines(gcode.split(/\r?\n/));
  }
  clear() {
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };
    this.rebuildAndRender();
  }
  resetView() {
    this.rotX = DEFAULT_ROT_X;
    this.rotY = DEFAULT_ROT_Y;
    this.fitView();
    this.rebuildAndRender();
  }
  setOptions(opts) {
    this.options = { ...this.options, ...opts };
    this.applyOptions();
    this.rebuildAndRender();
  }
  setProjectionMode(mode) {
    this.options = { ...this.options, projectionMode: mode };
    this.fitView();
    this.rebuildAndRender();
  }
  getSVGElement() {
    return this.svg;
  }
  dispose() {
    this.svg.removeEventListener("wheel", this.onWheel);
    this.svg.removeEventListener("pointerdown", this.onPointerDown);
    this.svg.removeEventListener("pointermove", this.onPointerMove);
    this.svg.removeEventListener("pointerup", this.onPointerUp);
    this.svg.removeEventListener("pointercancel", this.onPointerUp);
    this.svg.removeEventListener("contextmenu", this.onContextMenu);
    this.svg.remove();
  }
  // ── Rendering ─────────────────────────────────────────────────────────────
  rebuildAndRender() {
    const proj = this.project;
    this.rapidPath.setAttribute("d", verticesToPath(this.rapidVerts, proj));
    this.cutPath.setAttribute("d", verticesToPath(this.cutVerts, proj));
    this.renderBbox();
    this.applyViewBox();
  }
  scheduleDraw() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.rebuildAndRender();
    });
  }
  fitView() {
    if (this.bounds.empty) {
      this.viewBox = { x: -50, y: -50, w: 100, h: 100 };
      return;
    }
    const { minX, maxX, minY, maxY, minZ, maxZ } = this.bounds;
    const corners = [
      this.project(minX, minY, minZ),
      this.project(maxX, minY, minZ),
      this.project(maxX, maxY, minZ),
      this.project(minX, maxY, minZ),
      this.project(minX, minY, maxZ),
      this.project(maxX, minY, maxZ),
      this.project(maxX, maxY, maxZ),
      this.project(minX, maxY, maxZ)
    ];
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
    for (const c of corners) {
      if (c.x < pMinX) pMinX = c.x;
      if (c.y < pMinY) pMinY = c.y;
      if (c.x > pMaxX) pMaxX = c.x;
      if (c.y > pMaxY) pMaxY = c.y;
    }
    const p = this.options.padding;
    this.viewBox = {
      x: pMinX - p,
      y: pMinY - p,
      w: pMaxX - pMinX + p * 2,
      h: pMaxY - pMinY + p * 2
    };
  }
  applyViewBox() {
    const { x, y, w, h } = this.viewBox;
    this.svg.setAttribute("viewBox", `${f(x)} ${f(y)} ${f(w)} ${f(h)}`);
  }
  applyOptions() {
    const { rapidColor, cutColor, boundingBoxColor, strokeWidth } = this.options;
    this.rapidPath.setAttribute("stroke", rapidColor);
    this.rapidPath.setAttribute("stroke-width", String(strokeWidth));
    this.cutPath.setAttribute("stroke", cutColor);
    this.cutPath.setAttribute("stroke-width", String(strokeWidth));
    this.bboxPath.setAttribute("stroke", boundingBoxColor);
    this.bboxPath.setAttribute("stroke-width", String(strokeWidth * 0.6));
    this.bboxPath.setAttribute("fill", boundingBoxColor);
    this.bboxPath.setAttribute("fill-opacity", "0.05");
    for (const lbl of [this.bboxLabelX, this.bboxLabelY, this.bboxLabelZ]) {
      lbl.setAttribute("fill", boundingBoxColor);
    }
  }
  renderBbox() {
    if (this.bounds.empty) {
      this.bboxPath.setAttribute("d", "");
      this.bboxLabelX.setAttribute("visibility", "hidden");
      this.bboxLabelY.setAttribute("visibility", "hidden");
      this.bboxLabelZ.setAttribute("visibility", "hidden");
      return;
    }
    const { minX, maxX, minY, maxY, minZ, maxZ } = this.bounds;
    const p = this.project;
    const b0 = p(minX, minY, minZ), b1 = p(maxX, minY, minZ);
    const b2 = p(maxX, maxY, minZ), b3 = p(minX, maxY, minZ);
    const t0 = p(minX, minY, maxZ), t1 = p(maxX, minY, maxZ);
    const t2 = p(maxX, maxY, maxZ), t3 = p(minX, maxY, maxZ);
    const d = [
      // bottom face
      `M${f(b0.x)} ${f(b0.y)}L${f(b1.x)} ${f(b1.y)}L${f(b2.x)} ${f(b2.y)}L${f(b3.x)} ${f(b3.y)}Z`,
      // top face
      `M${f(t0.x)} ${f(t0.y)}L${f(t1.x)} ${f(t1.y)}L${f(t2.x)} ${f(t2.y)}L${f(t3.x)} ${f(t3.y)}Z`,
      // vertical edges
      `M${f(b0.x)} ${f(b0.y)}L${f(t0.x)} ${f(t0.y)}`,
      `M${f(b1.x)} ${f(b1.y)}L${f(t1.x)} ${f(t1.y)}`,
      `M${f(b2.x)} ${f(b2.y)}L${f(t2.x)} ${f(t2.y)}`,
      `M${f(b3.x)} ${f(b3.y)}L${f(t3.x)} ${f(t3.y)}`
    ].join("");
    this.bboxPath.setAttribute("d", d);
    const projW = Math.hypot(b1.x - b0.x, b1.y - b0.y);
    const projH = Math.hypot(b3.x - b0.x, b3.y - b0.y);
    const projZ = Math.hypot(t0.x - b0.x, t0.y - b0.y);
    const fontSize = Math.max(projW, projH, projZ) * 0.07;
    const gap = fontSize * 0.5;
    setLabel(
      this.bboxLabelX,
      mid(b0, b1),
      outward(mid(b0, b1), mid(b2, b3), gap),
      fontSize,
      `X: ${fd(maxX - minX)}`
    );
    setLabel(
      this.bboxLabelY,
      mid(b1, b2),
      outward(mid(b1, b2), mid(b0, b3), gap),
      fontSize,
      `Y: ${fd(maxY - minY)}`
    );
    setLabel(
      this.bboxLabelZ,
      mid(b0, t0),
      outward(mid(b0, t0), mid(b2, t2), gap),
      fontSize,
      `Z: ${fd(maxZ - minZ)}`
    );
  }
  bindEvents() {
    this.svg.addEventListener("wheel", this.onWheel, { passive: false });
    this.svg.addEventListener("pointerdown", this.onPointerDown);
    this.svg.addEventListener("pointermove", this.onPointerMove);
    this.svg.addEventListener("pointerup", this.onPointerUp);
    this.svg.addEventListener("pointercancel", this.onPointerUp);
    this.svg.addEventListener("contextmenu", this.onContextMenu);
  }
  svgPoint(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const { x, y, w, h } = this.viewBox;
    return {
      x: x + (clientX - rect.left) / rect.width * w,
      y: y + (clientY - rect.top) / rect.height * h
    };
  }
};
function makePath() {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("fill", "none");
  return p;
}
function makeText(anchor, baseline) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("text-anchor", anchor);
  t.setAttribute("dominant-baseline", baseline);
  return t;
}
function setLabel(el, _at, offset, fontSize, text) {
  el.setAttribute("x", f(offset.x));
  el.setAttribute("y", f(offset.y));
  el.setAttribute("font-size", f(fontSize));
  el.textContent = text;
  el.setAttribute("visibility", "visible");
}
function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function outward(pos, interior, gap) {
  const dx = pos.x - interior.x;
  const dy = pos.y - interior.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: pos.x + dx / len * gap, y: pos.y + dy / len * gap };
}
function f(n) {
  return Number(n.toFixed(4)).toString();
}
function fd(n) {
  return Number(n.toFixed(2)).toString();
}
function verticesToPath(verts, project) {
  if (verts.length === 0) return "";
  const parts = [];
  const EPS = 1e-6;
  let prevX = NaN, prevY = NaN;
  for (let i = 0; i + 5 < verts.length; i += 6) {
    const p0 = project(verts[i], verts[i + 1], verts[i + 2]);
    const p1 = project(verts[i + 3], verts[i + 4], verts[i + 5]);
    if (Math.abs(p0.x - prevX) < EPS && Math.abs(p0.y - prevY) < EPS) {
      parts.push(`L${f(p1.x)} ${f(p1.y)}`);
    } else {
      parts.push(`M${f(p0.x)} ${f(p0.y)}L${f(p1.x)} ${f(p1.y)}`);
    }
    prevX = p1.x;
    prevY = p1.y;
  }
  return parts.join("");
}
function computeBounds(...arrays) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let empty = true;
  for (const verts of arrays) {
    for (let i = 0; i + 5 < verts.length; i += 6) {
      const x0 = verts[i], y0 = verts[i + 1], z0 = verts[i + 2];
      const x1 = verts[i + 3], y1 = verts[i + 4], z1 = verts[i + 5];
      if (x0 < minX) minX = x0;
      if (y0 < minY) minY = y0;
      if (z0 < minZ) minZ = z0;
      if (x0 > maxX) maxX = x0;
      if (y0 > maxY) maxY = y0;
      if (z0 > maxZ) maxZ = z0;
      if (x1 < minX) minX = x1;
      if (y1 < minY) minY = y1;
      if (z1 < minZ) minZ = z1;
      if (x1 > maxX) maxX = x1;
      if (y1 > maxY) maxY = y1;
      if (z1 > maxZ) maxZ = z1;
      empty = false;
    }
  }
  return { minX, minY, maxX, maxY, minZ, maxZ, empty };
}

// src/svg-react/GCodeSVGVisualizer.tsx
var GCodeSVGVisualizer = React.forwardRef(function GCodeSVGVisualizer2(props, ref) {
  const { options, className, style } = props;
  const containerRef = React.useRef(null);
  const rendererRef = React.useRef(null);
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new GCodeSVGRenderer(container, options);
    rendererRef.current = renderer;
    return () => {
      rendererRef.current = null;
      renderer.dispose();
    };
  }, []);
  React.useEffect(() => {
    if (options) {
      rendererRef.current?.setOptions(options);
    }
  }, [options]);
  React.useImperativeHandle(
    ref,
    () => ({
      loadFromLines(lines) {
        rendererRef.current?.loadFromLines(lines);
      },
      loadFromFile(file) {
        const r = rendererRef.current;
        if (!r) return Promise.reject(new Error("Renderer not ready"));
        return r.loadFromFile(file);
      },
      loadFromText(gcode) {
        rendererRef.current?.loadFromText(gcode);
      },
      clear() {
        rendererRef.current?.clear();
      },
      resetView() {
        rendererRef.current?.resetView();
      },
      setOptions(opts) {
        rendererRef.current?.setOptions(opts);
      },
      setProjectionMode(mode) {
        rendererRef.current?.setProjectionMode(mode);
      }
    })
  );
  return React.createElement("div", { ref: containerRef, className, style });
});
export {
  GCodeSVGVisualizer
};
