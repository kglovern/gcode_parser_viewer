import { buildMovementVerticesFromLines } from "../../geometry";
import { GCodeSVGOptions, defaultGCodeSVGOptions } from "./types";

type ViewBox = { x: number; y: number; w: number; h: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number; empty: boolean };
type Pt2 = { x: number; y: number };

const DEFAULT_ROT_X = 0;
const DEFAULT_ROT_Y = 0;

export class GCodeSVGRenderer {
  private svg: SVGSVGElement;
  private bboxPath: SVGPathElement;
  private bboxLabelX: SVGTextElement;
  private bboxLabelY: SVGTextElement;
  private bboxLabelZ: SVGTextElement;
  private rapidPath: SVGPathElement;
  private cutPath: SVGPathElement;
  private options: GCodeSVGOptions;

  private viewBox: ViewBox = { x: 0, y: 0, w: 100, h: 100 };

  // Camera
  private rotX = DEFAULT_ROT_X;
  private rotY = DEFAULT_ROT_Y;
  private centerX = 0;
  private centerY = 0;
  private centerZ = 0;
  private focalLength = 500;

  // Cached trig — recomputed only when rotX/rotY change, not per-vertex
  private cosRotX = 1; private sinRotX = 0;
  private cosRotY = 1; private sinRotY = 0;

  // Interaction
  private dragMode: 'none' | 'orbit' | 'pan' = 'none';
  private dragLast = { x: 0, y: 0 };
  private rafPending = false;

  // Geometry
  private rapidVerts: Float32Array = new Float32Array(0);
  private cutVerts: Float32Array = new Float32Array(0);
  private bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };

  constructor(container: HTMLElement, options?: Partial<GCodeSVGOptions>) {
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

  loadFromLines(lines: string[]): void {
    const { rapid, cutting } = buildMovementVerticesFromLines(lines, {
      arcSegments: this.options.arcSegments,
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
    this.updateTrig();
    this.fitView();
    this.rebuildAndRender();
  }

  loadFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") { reject(new Error("Failed to read file")); return; }
        this.loadFromText(text);
        resolve();
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsText(file);
    });
  }

  loadFromText(gcode: string): void {
    this.loadFromLines(gcode.split(/\r?\n/));
  }

  clear(): void {
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };
    this.rebuildAndRender();
  }

  resetView(): void {
    this.rotX = DEFAULT_ROT_X;
    this.rotY = DEFAULT_ROT_Y;
    this.updateTrig();
    this.fitView();
    this.rebuildAndRender();
  }

  setOptions(opts: Partial<GCodeSVGOptions>): void {
    this.options = { ...this.options, ...opts };
    this.applyOptions();
    this.rebuildAndRender();
  }

  setProjectionMode(mode: 'perspective' | 'isometric'): void {
    this.options = { ...this.options, projectionMode: mode };
    this.rebuildAndRender();
  }

  getSVGElement(): SVGSVGElement {
    return this.svg;
  }

  dispose(): void {
    this.svg.removeEventListener("wheel", this.onWheel);
    this.svg.removeEventListener("pointerdown", this.onPointerDown);
    this.svg.removeEventListener("pointermove", this.onPointerMove);
    this.svg.removeEventListener("pointerup", this.onPointerUp);
    this.svg.removeEventListener("pointercancel", this.onPointerUp);
    this.svg.removeEventListener("contextmenu", this.onContextMenu);
    this.svg.remove();
  }

  // ── Projection ────────────────────────────────────────────────────────────

  private updateTrig(): void {
    this.cosRotX = Math.cos(this.rotX);
    this.sinRotX = Math.sin(this.rotX);
    this.cosRotY = Math.cos(this.rotY);
    this.sinRotY = Math.sin(this.rotY);
  }

  private project = (x: number, y: number, z: number): Pt2 => {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const dz = z - this.centerZ;
    // Rotate around Y axis (azimuth)
    const rx = dx * this.cosRotY + dz * this.sinRotY;
    const ry = dy;
    const rz = -dx * this.sinRotY + dz * this.cosRotY;
    // Rotate around X axis (elevation)
    const fx = rx;
    const fy = ry * this.cosRotX - rz * this.sinRotX;
    const fz = ry * this.sinRotX + rz * this.cosRotX;
    if (this.options.projectionMode === 'perspective') {
      const s = this.focalLength / (this.focalLength + fz);
      return { x: fx * s, y: -fy * s };
    }
    return { x: fx, y: -fy };
  };

  // ── Rendering ─────────────────────────────────────────────────────────────

  private rebuildAndRender(draft = false): void {
    const fmt = draft ? fDraft : f;
    this.rapidPath.setAttribute("d", verticesToPath(this.rapidVerts, this.project, fmt));
    this.cutPath.setAttribute("d", verticesToPath(this.cutVerts, this.project, fmt));
    this.renderBbox();
    this.applyViewBox();
  }

  private scheduleDraw(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.rebuildAndRender(true); // draft precision during active drag
    });
  }

  private fitView(): void {
    if (this.bounds.empty) {
      this.viewBox = { x: -50, y: -50, w: 100, h: 100 };
      return;
    }
    const { minX, maxX, minY, maxY, minZ, maxZ } = this.bounds;
    const corners: Pt2[] = [
      this.project(minX, minY, minZ), this.project(maxX, minY, minZ),
      this.project(maxX, maxY, minZ), this.project(minX, maxY, minZ),
      this.project(minX, minY, maxZ), this.project(maxX, minY, maxZ),
      this.project(maxX, maxY, maxZ), this.project(minX, maxY, maxZ),
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
      h: pMaxY - pMinY + p * 2,
    };
  }

  private applyViewBox(): void {
    const { x, y, w, h } = this.viewBox;
    this.svg.setAttribute("viewBox", `${f(x)} ${f(y)} ${f(w)} ${f(h)}`);
  }

  private applyOptions(): void {
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

  private renderBbox(): void {
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
      `M${f(b0.x)} ${f(b0.y)}L${f(b1.x)} ${f(b1.y)}L${f(b2.x)} ${f(b2.y)}L${f(b3.x)} ${f(b3.y)}Z`,
      `M${f(t0.x)} ${f(t0.y)}L${f(t1.x)} ${f(t1.y)}L${f(t2.x)} ${f(t2.y)}L${f(t3.x)} ${f(t3.y)}Z`,
      `M${f(b0.x)} ${f(b0.y)}L${f(t0.x)} ${f(t0.y)}`,
      `M${f(b1.x)} ${f(b1.y)}L${f(t1.x)} ${f(t1.y)}`,
      `M${f(b2.x)} ${f(b2.y)}L${f(t2.x)} ${f(t2.y)}`,
      `M${f(b3.x)} ${f(b3.y)}L${f(t3.x)} ${f(t3.y)}`,
    ].join("");
    this.bboxPath.setAttribute("d", d);

    const projW = Math.hypot(b1.x - b0.x, b1.y - b0.y);
    const projH = Math.hypot(b3.x - b0.x, b3.y - b0.y);
    const projZ = Math.hypot(t0.x - b0.x, t0.y - b0.y);
    const fontSize = Math.max(projW, projH, projZ) * 0.07;
    const gap = fontSize * 0.5;

    setLabel(this.bboxLabelX, mid(b0, b1), outward(mid(b0, b1), mid(b2, b3), gap), fontSize, `X: ${fd(maxX - minX)}`);
    setLabel(this.bboxLabelY, mid(b1, b2), outward(mid(b1, b2), mid(b0, b3), gap), fontSize, `Y: ${fd(maxY - minY)}`);
    setLabel(this.bboxLabelZ, mid(b0, t0), outward(mid(b0, t0), mid(b2, t2), gap), fontSize, `Z: ${fd(maxZ - minZ)}`);
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  private onWheel = (e: WheelEvent): void => {
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

  private onPointerDown = (e: PointerEvent): void => {
    const isPan = e.button === 2 || e.shiftKey;
    this.dragMode = isPan ? 'pan' : 'orbit';
    this.dragLast = { x: e.clientX, y: e.clientY };
    this.svg.setPointerCapture(e.pointerId);
    this.svg.style.cursor = isPan ? 'move' : 'grabbing';
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragMode === 'none') return;
    const dx = e.clientX - this.dragLast.x;
    const dy = e.clientY - this.dragLast.y;
    this.dragLast = { x: e.clientX, y: e.clientY };

    if (this.dragMode === 'orbit') {
      const rect = this.svg.getBoundingClientRect();
      const sensitivity = Math.PI / Math.min(rect.width, rect.height);
      this.rotY += dx * sensitivity;
      this.rotX += dy * sensitivity;
      this.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotX));
      this.updateTrig();
      this.fitView();
      this.scheduleDraw();
    } else {
      const rect = this.svg.getBoundingClientRect();
      this.viewBox = {
        ...this.viewBox,
        x: this.viewBox.x - (dx / rect.width) * this.viewBox.w,
        y: this.viewBox.y - (dy / rect.height) * this.viewBox.h,
      };
      this.applyViewBox();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.dragMode === 'none') return;
    const wasOrbit = this.dragMode === 'orbit';
    this.dragMode = 'none';
    this.svg.releasePointerCapture(e.pointerId);
    this.svg.style.cursor = 'grab';
    if (wasOrbit) {
      this.rebuildAndRender(false);
    }
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private bindEvents(): void {
    this.svg.addEventListener("wheel", this.onWheel, { passive: false });
    this.svg.addEventListener("pointerdown", this.onPointerDown);
    this.svg.addEventListener("pointermove", this.onPointerMove);
    this.svg.addEventListener("pointerup", this.onPointerUp);
    this.svg.addEventListener("pointercancel", this.onPointerUp);
    this.svg.addEventListener("contextmenu", this.onContextMenu);
  }

  private svgPoint(clientX: number, clientY: number): Pt2 {
    const rect = this.svg.getBoundingClientRect();
    const { x, y, w, h } = this.viewBox;
    return {
      x: x + ((clientX - rect.left) / rect.width) * w,
      y: y + ((clientY - rect.top) / rect.height) * h,
    };
  }
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

function makePath(): SVGPathElement {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("fill", "none");
  return p;
}

function makeText(anchor: string, baseline: string): SVGTextElement {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("text-anchor", anchor);
  t.setAttribute("dominant-baseline", baseline);
  return t;
}

function setLabel(el: SVGTextElement, _at: Pt2, offset: Pt2, fontSize: number, text: string): void {
  el.setAttribute("x", f(offset.x));
  el.setAttribute("y", f(offset.y));
  el.setAttribute("font-size", f(fontSize));
  el.textContent = text;
  el.setAttribute("visibility", "visible");
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function mid(a: Pt2, b: Pt2): Pt2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function outward(pos: Pt2, interior: Pt2, gap: number): Pt2 {
  const dx = pos.x - interior.x;
  const dy = pos.y - interior.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: pos.x + (dx / len) * gap, y: pos.y + (dy / len) * gap };
}

// ── Number formatting ────────────────────────────────────────────────────────

function f(n: number): string {
  return n.toFixed(2);
}

function fDraft(n: number): string {
  return Math.round(n) + '';
}

function fd(n: number): string {
  return n.toFixed(2);
}

// ── Path building ────────────────────────────────────────────────────────────

function verticesToPath(
  verts: Float32Array,
  project: (x: number, y: number, z: number) => Pt2,
  fmt: (n: number) => string
): string {
  if (verts.length === 0) return "";
  const parts: string[] = [];
  const EPS = 1e-6;
  let prevX = NaN, prevY = NaN;
  for (let i = 0; i + 5 < verts.length; i += 6) {
    const p0 = project(verts[i], verts[i + 1], verts[i + 2]);
    const p1 = project(verts[i + 3], verts[i + 4], verts[i + 5]);
    if (Math.abs(p0.x - prevX) < EPS && Math.abs(p0.y - prevY) < EPS) {
      parts.push(`L${fmt(p1.x)} ${fmt(p1.y)}`);
    } else {
      parts.push(`M${fmt(p0.x)} ${fmt(p0.y)}L${fmt(p1.x)} ${fmt(p1.y)}`);
    }
    prevX = p1.x;
    prevY = p1.y;
  }
  return parts.join("");
}

// ── Bounds computation ───────────────────────────────────────────────────────

function computeBounds(...arrays: Float32Array[]): Bounds {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let empty = true;
  for (const verts of arrays) {
    for (let i = 0; i + 5 < verts.length; i += 6) {
      const x0 = verts[i], y0 = verts[i + 1], z0 = verts[i + 2];
      const x1 = verts[i + 3], y1 = verts[i + 4], z1 = verts[i + 5];
      if (x0 < minX) minX = x0; if (y0 < minY) minY = y0; if (z0 < minZ) minZ = z0;
      if (x0 > maxX) maxX = x0; if (y0 > maxY) maxY = y0; if (z0 > maxZ) maxZ = z0;
      if (x1 < minX) minX = x1; if (y1 < minY) minY = y1; if (z1 < minZ) minZ = z1;
      if (x1 > maxX) maxX = x1; if (y1 > maxY) maxY = y1; if (z1 > maxZ) maxZ = z1;
      empty = false;
    }
  }
  return { minX, minY, maxX, maxY, minZ, maxZ, empty };
}
