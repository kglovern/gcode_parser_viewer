"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCodeSVGRenderer = void 0;
const threejs_core_1 = require("../threejs-core");
const types_1 = require("./types");
class GCodeSVGRenderer {
    constructor(container, options) {
        this.viewBox = { x: 0, y: 0, w: 100, h: 100 };
        this.baseViewBox = { x: 0, y: 0, w: 100, h: 100 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0, vx: 0, vy: 0 };
        this.rapidData = "";
        this.cutData = "";
        this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, empty: true };
        this.onWheel = (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
            const pt = this.svgPoint(e.clientX, e.clientY);
            const { x, y, w, h } = this.viewBox;
            this.viewBox = {
                x: pt.x - (pt.x - x) * factor,
                y: pt.y - (pt.y - y) * factor,
                w: w * factor,
                h: h * factor,
            };
            this.applyViewBox();
        };
        this.onPointerDown = (e) => {
            if (e.button !== 0)
                return;
            this.isDragging = true;
            this.svg.setPointerCapture(e.pointerId);
            this.svg.style.cursor = "grabbing";
            const pt = this.svgPoint(e.clientX, e.clientY);
            this.dragStart = { x: e.clientX, y: e.clientY, vx: pt.x, vy: pt.y };
        };
        this.onPointerMove = (e) => {
            if (!this.isDragging)
                return;
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            const rect = this.svg.getBoundingClientRect();
            const scaleX = this.viewBox.w / rect.width;
            const scaleY = this.viewBox.h / rect.height;
            this.viewBox = {
                ...this.viewBox,
                x: this.viewBox.x - dx * scaleX,
                y: this.viewBox.y - dy * scaleY,
            };
            this.dragStart = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 };
            this.applyViewBox();
        };
        this.onPointerUp = (e) => {
            if (!this.isDragging)
                return;
            this.isDragging = false;
            this.svg.releasePointerCapture(e.pointerId);
            this.svg.style.cursor = "grab";
        };
        this.options = { ...types_1.defaultGCodeSVGOptions, ...options };
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.cssText = "width:100%;height:100%;display:block;cursor:grab;";
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        this.bboxRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this.bboxRect.setAttribute("fill", "none");
        this.rapidPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.rapidPath.setAttribute("fill", "none");
        this.rapidPath.setAttribute("stroke-linecap", "round");
        this.rapidPath.setAttribute("stroke-linejoin", "round");
        this.cutPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.cutPath.setAttribute("fill", "none");
        this.cutPath.setAttribute("stroke-linecap", "round");
        this.cutPath.setAttribute("stroke-linejoin", "round");
        this.svg.appendChild(this.bboxRect);
        this.svg.appendChild(this.rapidPath);
        this.svg.appendChild(this.cutPath);
        container.appendChild(this.svg);
        this.applyOptions();
        this.bindEvents();
    }
    loadFromLines(lines) {
        const { rapid, cutting } = (0, threejs_core_1.buildMovementVerticesFromLines)(lines, {
            arcSegments: this.options.arcSegments,
        });
        this.rapidData = verticesToPath(rapid);
        this.cutData = verticesToPath(cutting);
        this.bounds = computeBounds(rapid, cutting);
        this.fitView();
        this.render();
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
        const lines = gcode.split(/\r?\n/);
        this.loadFromLines(lines);
    }
    clear() {
        this.rapidData = "";
        this.cutData = "";
        this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, empty: true };
        this.render();
    }
    resetView() {
        this.fitView();
        this.applyViewBox();
    }
    setOptions(opts) {
        const needsReparse = opts.arcSegments !== undefined && opts.arcSegments !== this.options.arcSegments;
        this.options = { ...this.options, ...opts };
        this.applyOptions();
        if (needsReparse) {
            // arc segments changed; caller must reload
        }
        this.render();
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
        this.svg.remove();
    }
    fitView() {
        if (this.bounds.empty) {
            this.baseViewBox = { x: -50, y: -50, w: 100, h: 100 };
        }
        else {
            const p = this.options.padding;
            const x = this.bounds.minX - p;
            const y = -this.bounds.maxY - p; // flipped
            const w = this.bounds.maxX - this.bounds.minX + p * 2;
            const h = this.bounds.maxY - this.bounds.minY + p * 2;
            this.baseViewBox = { x, y, w, h };
        }
        this.viewBox = { ...this.baseViewBox };
        this.applyViewBox();
    }
    applyViewBox() {
        const { x, y, w, h } = this.viewBox;
        this.svg.setAttribute("viewBox", `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}`);
    }
    applyOptions() {
        const { rapidColor, cutColor, boundingBoxColor, strokeWidth } = this.options;
        this.rapidPath.setAttribute("stroke", rapidColor);
        this.rapidPath.setAttribute("stroke-width", String(strokeWidth));
        this.cutPath.setAttribute("stroke", cutColor);
        this.cutPath.setAttribute("stroke-width", String(strokeWidth));
        this.bboxRect.setAttribute("stroke", boundingBoxColor);
        this.bboxRect.setAttribute("stroke-width", String(strokeWidth * 0.75));
    }
    render() {
        this.rapidPath.setAttribute("d", this.rapidData);
        this.cutPath.setAttribute("d", this.cutData);
        if (!this.bounds.empty) {
            const p = this.options.padding * 0.5;
            this.bboxRect.setAttribute("x", fmt(this.bounds.minX - p));
            this.bboxRect.setAttribute("y", fmt(-this.bounds.maxY - p));
            this.bboxRect.setAttribute("width", fmt(this.bounds.maxX - this.bounds.minX + p * 2));
            this.bboxRect.setAttribute("height", fmt(this.bounds.maxY - this.bounds.minY + p * 2));
            this.bboxRect.setAttribute("visibility", "visible");
        }
        else {
            this.bboxRect.setAttribute("visibility", "hidden");
        }
    }
    bindEvents() {
        this.svg.addEventListener("wheel", this.onWheel, { passive: false });
        this.svg.addEventListener("pointerdown", this.onPointerDown);
        this.svg.addEventListener("pointermove", this.onPointerMove);
        this.svg.addEventListener("pointerup", this.onPointerUp);
        this.svg.addEventListener("pointercancel", this.onPointerUp);
    }
    svgPoint(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const { x, y, w, h } = this.viewBox;
        return {
            x: x + ((clientX - rect.left) / rect.width) * w,
            y: y + ((clientY - rect.top) / rect.height) * h,
        };
    }
}
exports.GCodeSVGRenderer = GCodeSVGRenderer;
function fmt(n) {
    return Number(n.toFixed(4)).toString();
}
function verticesToPath(verts) {
    if (verts.length === 0)
        return "";
    const parts = [];
    const EPS = 1e-6;
    let prevX = NaN;
    let prevY = NaN;
    for (let i = 0; i + 5 < verts.length; i += 6) {
        const x0 = verts[i];
        const y0 = -verts[i + 1]; // flip Y
        const x1 = verts[i + 3];
        const y1 = -verts[i + 4]; // flip Y
        if (Math.abs(x0 - prevX) < EPS && Math.abs(y0 - prevY) < EPS) {
            parts.push(`L${fmt(x1)} ${fmt(y1)}`);
        }
        else {
            parts.push(`M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}`);
        }
        prevX = x1;
        prevY = y1;
    }
    return parts.join("");
}
function computeBounds(...arrays) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let empty = true;
    for (const verts of arrays) {
        for (let i = 0; i + 5 < verts.length; i += 6) {
            const x0 = verts[i], y0 = verts[i + 1];
            const x1 = verts[i + 3], y1 = verts[i + 4];
            if (x0 < minX)
                minX = x0;
            if (y0 < minY)
                minY = y0;
            if (x0 > maxX)
                maxX = x0;
            if (y0 > maxY)
                maxY = y0;
            if (x1 < minX)
                minX = x1;
            if (y1 < minY)
                minY = y1;
            if (x1 > maxX)
                maxX = x1;
            if (y1 > maxY)
                maxY = y1;
            empty = false;
        }
    }
    return { minX, minY, maxX, maxY, empty };
}
