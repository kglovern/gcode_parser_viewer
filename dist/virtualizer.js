"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCodeVirtualizer = void 0;
const parser_1 = require("./parser");
const AXES = ["X", "Y", "Z", "A", "B", "C"];
const DEFAULT_MODALS = {
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
class GCodeVirtualizer {
    constructor(callbacks = {}) {
        this.parser = new parser_1.GCodeParser();
        this.modals = { ...DEFAULT_MODALS };
        this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
        this.callbacks = callbacks;
        this.feedRates = new Set();
        this.spindleSpeeds = new Set();
        this.tools = new Set();
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
        }
        else if (movement === "G2" || movement === "G3") {
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
                if (gcode === "G54" ||
                    gcode === "G55" ||
                    gcode === "G56" ||
                    gcode === "G57" ||
                    gcode === "G58" ||
                    gcode === "G59") {
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
            }
            else {
                end[axis] = end[axis] + value;
            }
        }
        return end;
    }
    computeArcMax(start, end, motion, plane, center) {
        const { primary, secondary, tertiary } = planeAxes(plane);
        const radius = distance2d(start[primary], start[secondary], center[primary], center[secondary]);
        const startAngle = Math.atan2(start[secondary] - center[secondary], start[primary] - center[primary]);
        const endAngle = Math.atan2(end[secondary] - center[secondary], end[primary] - center[primary]);
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
                transformedEnd,
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
            transformedCenter,
        });
    }
}
exports.GCodeVirtualizer = GCodeVirtualizer;
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
const MAX_ROTATION_DEGREES_PER_STEP = 5;
function lerpPosition(start, end, t) {
    return {
        X: start.X + (end.X - start.X) * t,
        Y: start.Y + (end.Y - start.Y) * t,
        Z: start.Z + (end.Z - start.Z) * t,
        A: start.A + (end.A - start.A) * t,
        B: start.B + (end.B - start.B) * t,
        C: start.C + (end.C - start.C) * t,
    };
}
function applyARotationX(position) {
    const angle = (position.A * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const y = position.Y * cos - position.Z * sin;
    const z = position.Y * sin + position.Z * cos;
    return { ...position, Y: y, Z: z };
}
