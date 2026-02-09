"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushXYZ = exports.buildToolpathGeometryFromLinesBatched = exports.buildLaserGeometryFromLinesBatched = exports.buildLaserVerticesFromLinesBatched = exports.buildLaserVerticesFromLines = exports.buildMovementGeometryFromLinesBatched = exports.buildMovementVerticesFromLinesBatched = exports.buildMovementVerticesFromLines = exports.buildVerticesFromLines = void 0;
exports.buildVerticesFromFile = buildVerticesFromFile;
const node_fs_1 = require("node:fs");
const node_readline_1 = require("node:readline");
const virtualizer_1 = require("./virtualizer");
async function buildVerticesFromFile(filePath, options = {}) {
    const vertices = [];
    const arcSegments = options.arcSegments ?? 30;
    const collector = options.collector ?? {};
    const virtualizer = new virtualizer_1.GCodeVirtualizer({
        onLinearMove: (args) => {
            const handler = collector.onLinearMove ?? defaultLinearCollector;
            handler(args, vertices);
        },
        onArcMove: (args) => {
            const handler = collector.onArcMove ??
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
var threejs_core_1 = require("./threejs-core");
Object.defineProperty(exports, "buildVerticesFromLines", { enumerable: true, get: function () { return threejs_core_1.buildVerticesFromLines; } });
Object.defineProperty(exports, "buildMovementVerticesFromLines", { enumerable: true, get: function () { return threejs_core_1.buildMovementVerticesFromLines; } });
Object.defineProperty(exports, "buildMovementVerticesFromLinesBatched", { enumerable: true, get: function () { return threejs_core_1.buildMovementVerticesFromLinesBatched; } });
Object.defineProperty(exports, "buildMovementGeometryFromLinesBatched", { enumerable: true, get: function () { return threejs_core_1.buildMovementGeometryFromLinesBatched; } });
Object.defineProperty(exports, "buildLaserVerticesFromLines", { enumerable: true, get: function () { return threejs_core_1.buildLaserVerticesFromLines; } });
Object.defineProperty(exports, "buildLaserVerticesFromLinesBatched", { enumerable: true, get: function () { return threejs_core_1.buildLaserVerticesFromLinesBatched; } });
Object.defineProperty(exports, "buildLaserGeometryFromLinesBatched", { enumerable: true, get: function () { return threejs_core_1.buildLaserGeometryFromLinesBatched; } });
Object.defineProperty(exports, "buildToolpathGeometryFromLinesBatched", { enumerable: true, get: function () { return threejs_core_1.buildToolpathGeometryFromLinesBatched; } });
Object.defineProperty(exports, "pushXYZ", { enumerable: true, get: function () { return threejs_core_1.pushXYZ; } });
function streamLines(filePath, onLine) {
    return new Promise((resolve, reject) => {
        const stream = (0, node_fs_1.createReadStream)(filePath, { encoding: "utf8" });
        const rl = (0, node_readline_1.createInterface)({ input: stream, crlfDelay: Infinity });
        rl.on("line", onLine);
        rl.on("close", () => resolve());
        rl.on("error", reject);
        stream.on("error", reject);
    });
}
function defaultLinearCollector(args, vertices) {
    const start = args.transformedStart ?? args.start;
    const end = args.transformedEnd ?? args.end;
    vertices.push(start.X, start.Y, start.Z, end.X, end.Y, end.Z);
}
function tessellateArc(args, vertices, segments) {
    const count = Math.max(1, Math.floor(segments));
    const { primary, secondary } = planeAxes(args.plane);
    const radius = distance2d(args.start[primary], args.start[secondary], args.center[primary], args.center[secondary]);
    const startAngle = Math.atan2(args.start[secondary] - args.center[secondary], args.start[primary] - args.center[primary]);
    const endAngle = Math.atan2(args.end[secondary] - args.center[secondary], args.end[primary] - args.center[primary]);
    const tau = Math.PI * 2;
    let s = normalizeAngle(startAngle);
    let e = normalizeAngle(endAngle);
    if (args.motion === "G2") {
        if (s <= e) {
            s += tau;
        }
    }
    else if (e <= s) {
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
        vertices.push(rotatedPrevious.X, rotatedPrevious.Y, rotatedPrevious.Z, rotatedPosition.X, rotatedPosition.Y, rotatedPosition.Z);
        previous = position;
    }
}
function planeAxes(plane) {
    if (plane === "G18") {
        return { primary: "Z", secondary: "X" };
    }
    if (plane === "G19") {
        return { primary: "Y", secondary: "Z" };
    }
    return { primary: "X", secondary: "Y" };
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
