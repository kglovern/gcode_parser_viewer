"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultGCodeViewerOptions = exports.defaultGCodeViewerTheme = void 0;
exports.defaultGCodeViewerTheme = {
    background: "#111827",
    opacity: 0.9,
    colors: {
        rapid: "#0ef6ae",
        cutting: "#3e85c7",
        boundingBox: "#77a9d7",
        grid: { major: "#2f3840", minor: "#1f252b" },
        axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" },
    },
};
exports.defaultGCodeViewerOptions = {
    units: "mm",
    mode: { laser: false },
    grid: { size: 400, axisDepth: 200, labels: false },
    boundingBox: { visible: false, labels: false },
    geometry: { arcSegments: 30, batching: { progressEveryLines: 5000, yieldEveryLines: 50000 } },
    render: { antialias: true, theme: exports.defaultGCodeViewerTheme },
    camera: {
        fov: 45,
        focusDurationMs: 900,
        orbit: { enableDamping: true },
        initialPosition: { x: 0, y: -200, z: 200 },
    },
};
