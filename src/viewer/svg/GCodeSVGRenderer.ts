import { buildMovementVerticesFromLines, buildWorkerSegmentGroups } from "../../geometry";
import type { WorkerGeometryData } from "../../types";
import { GCodeSVGOptions, defaultGCodeSVGOptions } from "./types";

type ViewBox = { x: number; y: number; w: number; h: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number; empty: boolean };
type Pt2 = { x: number; y: number };

const DEFAULT_ROT_X = 0;
const DEFAULT_ROT_Y = 0;

type SegmentGroup = { color: string; opacity: number; verts: Float32Array };

export class GCodeSVGRenderer {
  private svg: SVGSVGElement;
  private bboxPath: SVGPathElement;
  private bboxLabelX: SVGTextElement;
  private bboxLabelY: SVGTextElement;
  private bboxLabelZ: SVGTextElement;
  private pathLayer: SVGGElement;
  private originMarker: SVGCircleElement;
  private crosshairEl: SVGPathElement;
  private crosshairPos: { x: number; y: number; z: number } | null = null;
  private crosshairVisible = false;
  private pathEls: SVGPathElement[] = [];
  private segmentGroups: SegmentGroup[] = [];
  private workerMode = false;
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
  private activePointers = new Map<number, Pt2>();
  private pinchLastDist = 0;
  private pinchLastMid: Pt2 = { x: 0, y: 0 };
  private rafPending = false;

  // Geometry
  private rapidVerts: Float32Array = new Float32Array(0);
  private cutVerts: Float32Array = new Float32Array(0);
  private bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };

  constructor(container: HTMLElement, options?: Partial<GCodeSVGOptions>) {
    this.options = { ...defaultGCodeSVGOptions, ...options };

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.cssText = "width:100%;height:100%;display:block;cursor:grab;user-select:none;touch-action:none;";
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    this.bboxPath = makePath();
    this.pathLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");

    this.bboxLabelX = makeText("middle", "hanging");
    this.bboxLabelY = makeText("start", "middle");
    this.bboxLabelZ = makeText("middle", "auto");

    this.originMarker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    this.originMarker.setAttribute("stroke-opacity", "0.4");
    this.originMarker.setAttribute("visibility", "hidden");

    this.crosshairEl = makePath();
    this.crosshairEl.setAttribute("fill", "none");
    this.crosshairEl.setAttribute("visibility", "hidden");

    this.svg.appendChild(this.bboxPath);
    this.svg.appendChild(this.pathLayer);
    this.svg.appendChild(this.bboxLabelX);
    this.svg.appendChild(this.bboxLabelY);
    this.svg.appendChild(this.bboxLabelZ);
    this.svg.appendChild(this.originMarker);
    this.svg.appendChild(this.crosshairEl);

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
    this.workerMode = false;
    this.syncSegmentGroupsFromLines();
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
    this.workerMode = false;
    this.segmentGroups = [];
    this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };
    this.rebuildAndRender();
  }

  loadFromWorkerData(data: WorkerGeometryData): void {
    const groups = buildWorkerSegmentGroups(data);
    this.workerMode = true;
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    // Worker groups carry baked RGB (host app's legacy theme system, kept
    // only for rapid/cut bucketing via opacity) — use this renderer's own
    // theme-derived colors instead, same as the non-worker `loadFromLines`
    // path, so the SVG preview reflects the selected theme.
    this.segmentGroups = groups.map(g => ({
      color: g.opacity < 0.75 ? this.options.rapidColor : this.options.cutColor,
      opacity: g.opacity,
      verts: g.positions,
    }));
    this.bounds = computeBounds(...groups.map(g => g.positions));
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

  loadFromPrecomputedGroups(
    groups: { hexColor: string; opacity: number; positionsBuffer: ArrayBuffer; positionsLen: number }[]
  ): void {
    this.workerMode = true;
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    this.segmentGroups = groups.map(g => ({
      color: g.hexColor,
      opacity: g.opacity,
      verts: new Float32Array(g.positionsBuffer, 0, g.positionsLen),
    }));
    this.bounds = computeBounds(...this.segmentGroups.map(g => g.verts));
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

  private syncSegmentGroupsFromLines(): void {
    this.segmentGroups = [
      { color: this.options.rapidColor, opacity: 0.5, verts: this.rapidVerts },
      { color: this.options.cutColor, opacity: 1.0, verts: this.cutVerts },
    ];
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

  setBitPosition(pos: { x: number; y: number; z: number }): void {
    this.crosshairPos = pos;
    this.crosshairVisible = true;
    this.rebuildAndRender();
  }

  setBitVisible(visible: boolean): void {
    this.crosshairVisible = visible;
    this.rebuildAndRender();
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
    const sw = String(this.options.strokeWidth);

    while (this.pathEls.length < this.segmentGroups.length) {
      const el = makePath();
      this.pathLayer.appendChild(el);
      this.pathEls.push(el);
    }
    while (this.pathEls.length > this.segmentGroups.length) {
      this.pathLayer.removeChild(this.pathEls.pop()!);
    }

    for (let i = 0; i < this.segmentGroups.length; i++) {
      const { color, opacity, verts } = this.segmentGroups[i];
      const el = this.pathEls[i];
      el.setAttribute("stroke", color);
      el.setAttribute("stroke-opacity", String(opacity));
      el.setAttribute("stroke-width", sw);
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("d", verticesToPath(verts, this.project, fmt));
    }

    this.renderBbox();
    this.renderOriginMarker();
    this.renderCrosshairMarker();
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
    const p2 = this.project;
    const b0 = p2(minX, minY, minZ), b1 = p2(maxX, minY, minZ);
    const b2 = p2(maxX, maxY, minZ), b3 = p2(minX, maxY, minZ);
    const t0 = p2(minX, minY, maxZ), t1 = p2(maxX, minY, maxZ);
    const t2 = p2(maxX, maxY, maxZ), t3 = p2(minX, maxY, maxZ);

    // Compute label positions (mirrors renderBbox) so fitView includes them
    const projW = Math.hypot(b1.x - b0.x, b1.y - b0.y);
    const projH = Math.hypot(b3.x - b0.x, b3.y - b0.y);
    const projZ = Math.hypot(t0.x - b0.x, t0.y - b0.y);
    const fontSize = Math.max(projW, projH, projZ) * 0.07;
    const gap = fontSize * 0.5;
    const labelX = outward(mid(b0, b1), mid(b2, b3), gap);
    const allCorners = [b0, b1, b2, b3, t0, t1, t2, t3];
    const screenMinY = Math.min(...allCorners.map(c => c.y));
    const screenMaxY = Math.max(...allCorners.map(c => c.y));
    const screenMinX = Math.min(...allCorners.map(c => c.x));
    const screenMaxX = Math.max(...allCorners.map(c => c.x));
    const labelY = { x: screenMaxX + gap, y: (screenMinY + screenMaxY) / 2 };
    const labelYRight = { x: labelY.x + fontSize * 5, y: labelY.y };
    const labelZ = { x: (screenMinX + screenMaxX) / 2, y: screenMinY - fontSize };

    const corners: Pt2[] = [b0, b1, b2, b3, t0, t1, t2, t3, labelX, labelY, labelYRight, labelZ];
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
    for (const c of corners) {
      if (c.x < pMinX) pMinX = c.x;
      if (c.y < pMinY) pMinY = c.y;
      if (c.x > pMaxX) pMaxX = c.x;
      if (c.y > pMaxY) pMaxY = c.y;
    }
    const spanX = pMaxX - pMinX;
    const spanY = pMaxY - pMinY;
    const pctPad = Math.max(spanX, spanY) * 0.08;
    const p = this.options.padding + pctPad;
    this.viewBox = {
      x: pMinX - p,
      y: pMinY - p,
      w: spanX + p * 2,
      h: spanY + p * 2,
    };
  }

  private applyViewBox(): void {
    const { x, y, w, h } = this.viewBox;
    this.svg.setAttribute("viewBox", `${f(x)} ${f(y)} ${f(w)} ${f(h)}`);
  }

  private applyOptions(): void {
    const { boundingBoxColor, strokeWidth, originColor } = this.options;
    if (!this.workerMode) {
      this.syncSegmentGroupsFromLines();
    }
    this.bboxPath.setAttribute("stroke", boundingBoxColor);
    this.bboxPath.setAttribute("stroke-width", String(strokeWidth * 0.6));
    this.bboxPath.setAttribute("fill", boundingBoxColor);
    this.bboxPath.setAttribute("fill-opacity", "0.05");
    for (const lbl of [this.bboxLabelX, this.bboxLabelY, this.bboxLabelZ]) {
      lbl.setAttribute("fill", boundingBoxColor);
    }
    this.originMarker.setAttribute("fill", originColor);
    this.originMarker.setAttribute("stroke", "#000000");
    this.crosshairEl.setAttribute("stroke", this.options.crosshairColor);
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
    const allCorners = [b0, b1, b2, b3, t0, t1, t2, t3];
    const screenMinY = Math.min(...allCorners.map(c => c.y));
    const screenMaxY = Math.max(...allCorners.map(c => c.y));
    const screenMinX = Math.min(...allCorners.map(c => c.x));
    const screenMaxX = Math.max(...allCorners.map(c => c.x));
    const yPos = { x: screenMaxX + gap, y: (screenMinY + screenMaxY) / 2 };
    setLabel(this.bboxLabelY, yPos, yPos, fontSize, `Y: ${fd(maxY - minY)}`);
    const zPos = { x: (screenMinX + screenMaxX) / 2, y: screenMinY - fontSize };
    setLabel(this.bboxLabelZ, zPos, zPos, fontSize, `Z: ${fd(maxZ - minZ)}`);
  }

  private renderOriginMarker(): void {
    if (!this.options.showOrigin || this.bounds.empty) {
      this.originMarker.setAttribute("visibility", "hidden");
      return;
    }
    const pt = this.project(0, 0, 0);
    const r = Math.min(this.viewBox.w, this.viewBox.h) * 0.018;
    this.originMarker.setAttribute("cx", f(pt.x));
    this.originMarker.setAttribute("cy", f(pt.y));
    this.originMarker.setAttribute("r", f(r));
    this.originMarker.setAttribute("stroke-width", f(r * 0.25));
    this.originMarker.setAttribute("visibility", "visible");
  }

  private renderCrosshairMarker(): void {
    if (!this.crosshairVisible || this.crosshairPos === null) {
      this.crosshairEl.setAttribute("visibility", "hidden");
      return;
    }
    const { x, y, z } = this.crosshairPos;
    const pt = this.project(x, y, z);
    const r = Math.min(this.viewBox.w, this.viewBox.h) * 0.025;
    const g = r * 0.25;
    const cx = pt.x, cy = pt.y;
    const d = [
      `M${f(cx - r)} ${f(cy)}L${f(cx - g)} ${f(cy)}`,
      `M${f(cx + g)} ${f(cy)}L${f(cx + r)} ${f(cy)}`,
      `M${f(cx)} ${f(cy - r)}L${f(cx)} ${f(cy - g)}`,
      `M${f(cx)} ${f(cy + g)}L${f(cx)} ${f(cy + r)}`,
    ].join("");
    this.crosshairEl.setAttribute("d", d);
    this.crosshairEl.setAttribute("stroke-width", f(this.options.strokeWidth * 2));
    this.crosshairEl.setAttribute("stroke-linecap", "round");
    this.crosshairEl.setAttribute("visibility", "visible");
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
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.svg.setPointerCapture(e.pointerId);
    e.preventDefault();

    if (this.activePointers.size === 1) {
      this.dragMode = 'pan';
      this.svg.style.cursor = 'grabbing';
    } else if (this.activePointers.size === 2) {
      this.dragMode = 'pan';
      this.svg.style.cursor = 'move';
      const [a, b] = Array.from(this.activePointers.values());
      this.pinchLastDist = Math.hypot(b.x - a.x, b.y - a.y);
      this.pinchLastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.activePointers.has(e.pointerId)) return;
    const prev = this.activePointers.get(e.pointerId)!;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 2) {
      const [a, b] = Array.from(this.activePointers.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      if (this.pinchLastDist > 0) {
        const factor = this.pinchLastDist / dist;
        const pt = this.svgPoint(mid.x, mid.y);
        const { x, y, w, h } = this.viewBox;
        this.viewBox = {
          x: pt.x - (pt.x - x) * factor,
          y: pt.y - (pt.y - y) * factor,
          w: w * factor,
          h: h * factor,
        };
      }

      const rect = this.svg.getBoundingClientRect();
      const dmx = mid.x - this.pinchLastMid.x;
      const dmy = mid.y - this.pinchLastMid.y;
      this.viewBox = {
        ...this.viewBox,
        x: this.viewBox.x - (dmx / rect.width) * this.viewBox.w,
        y: this.viewBox.y - (dmy / rect.height) * this.viewBox.h,
      };

      this.pinchLastDist = dist;
      this.pinchLastMid = mid;
      this.applyViewBox();
      return;
    }

    if (this.dragMode === 'none') return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;

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
    this.activePointers.delete(e.pointerId);
    this.svg.releasePointerCapture(e.pointerId);

    if (this.activePointers.size === 1) {
      // One finger lifted — reinitialise single-pointer state from the remaining finger
      const [remaining] = this.activePointers.values();
      this.pinchLastMid = { x: remaining.x, y: remaining.y };
      this.dragMode = 'pan';
      this.svg.style.cursor = 'grabbing';
    } else if (this.activePointers.size === 0) {
      this.dragMode = 'none';
      this.svg.style.cursor = 'grab';
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
