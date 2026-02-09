"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushXYZ = exports.buildLaserVerticesFromLinesBatched = exports.buildLaserVerticesFromLines = exports.buildMovementVerticesFromLinesBatched = exports.buildMovementVerticesFromLines = exports.buildVerticesFromLines = exports.buildVerticesFromFile = exports.GCodeVirtualizer = exports.GCodeParser = void 0;
var parser_1 = require("./parser");
Object.defineProperty(exports, "GCodeParser", { enumerable: true, get: function () { return parser_1.GCodeParser; } });
var virtualizer_1 = require("./virtualizer");
Object.defineProperty(exports, "GCodeVirtualizer", { enumerable: true, get: function () { return virtualizer_1.GCodeVirtualizer; } });
var threejs_1 = require("./threejs");
Object.defineProperty(exports, "buildVerticesFromFile", { enumerable: true, get: function () { return threejs_1.buildVerticesFromFile; } });
Object.defineProperty(exports, "buildVerticesFromLines", { enumerable: true, get: function () { return threejs_1.buildVerticesFromLines; } });
Object.defineProperty(exports, "buildMovementVerticesFromLines", { enumerable: true, get: function () { return threejs_1.buildMovementVerticesFromLines; } });
Object.defineProperty(exports, "buildMovementVerticesFromLinesBatched", { enumerable: true, get: function () { return threejs_1.buildMovementVerticesFromLinesBatched; } });
Object.defineProperty(exports, "buildLaserVerticesFromLines", { enumerable: true, get: function () { return threejs_1.buildLaserVerticesFromLines; } });
Object.defineProperty(exports, "buildLaserVerticesFromLinesBatched", { enumerable: true, get: function () { return threejs_1.buildLaserVerticesFromLinesBatched; } });
Object.defineProperty(exports, "pushXYZ", { enumerable: true, get: function () { return threejs_1.pushXYZ; } });
__exportStar(require("./types"), exports);
