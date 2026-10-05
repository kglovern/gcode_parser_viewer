import { buildMovementVerticesFromLines, buildSegmentsSegmentGroups, buildWorkerSegmentGroups } from "../../geometry";
import type { WorkerGeometryData, WorkerSegmentsData } from "../../types";
import { GCodeSVGOptions, defaultGCodeSVGOptions } from "./types";

type ViewBox = { x: number; y: number; w: number; h: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number; empty: boolean };
type Pt2 = { x: number; y: number };

const DEFAULT_ROT_X = 0;
const DEFAULT_ROT_Y = 0;
// A wheel zoom is committed once no wheel event has arrived for this long.
const WHEEL_END_MS = 150;

// stride 6 = 3D segments [x1,y1,z1,x2,y2,z2]; stride 4 = 2D top-down segments [x1,y1,x2,y2]
type SegmentGroup = { color: string; opacity: number; verts: Float32Array; stride: 4 | 6 };

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
  // Separate rAF flag for overlay-only redraws (bit/crosshair) so they never
  // trigger — or get starved by — a full toolpath rebuild.
  private overlayRafPending = false;

  // Pan/zoom gestures. Changing the viewBox re-rasterises every path on the
  // CPU, which is too slow per pointermove on large files on mobile. During
  // a gesture the live viewBox is previewed as a CSS transform of the already
  // rasterised SVG (composited on the GPU) and only committed when it ends.
  private gestureActive = false;
  // Untransformed element rect from gesture start; getBoundingClientRect
  // would include the preview transform.
  private gestureRect: DOMRect | null = null;
  private gestureRafPending = false;
  private wheelEndTimer: ReturnType<typeof setTimeout> | null = null;
  // The viewBox currently in the attribute, and its serialised form.
  private committedViewBox: ViewBox | null = null;
  private committedViewBoxAttr = "";

  // Geometry
  private rapidVerts: Float32Array = new Float32Array(0);
  private cutVerts: Float32Array = new Float32Array(0);
  private bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };
  // False when loaded from 2D data with no Z metadata — hides the Z dimension label
  private hasZInfo = true;

  constructor(container: HTMLElement, options?: Partial<GCodeSVGOptions>) {
    this.options = { ...defaultGCodeSVGOptions, ...options };

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // will-change keeps the SVG on its own compositor layer so gesture
    // previews (see applyGesturePreview) scale the existing raster.
    this.svg.style.cssText = "width:100%;height:100%;display:block;cursor:grab;user-select:none;touch-action:none;transform-origin:0 0;will-change:transform;";
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
    this.hasZInfo = true;
    this.bounds = computeBounds([
      { verts: rapid, stride: 6 },
      { verts: cutting, stride: 6 },
    ]);
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
    this.hasZInfo = true;
    this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: true };
    this.rebuildAndRender();
  }

  loadFromWorkerData(data: WorkerGeometryData): void {
    // Use the per-group hex color baked by the worker so toolchange palette
    // segments render with distinct colors. setOptions won't overwrite these
    // because applyOptions skips syncSegmentGroupsFromLines in workerMode.
    this.adoptWorkerGroups(buildWorkerSegmentGroups(data));
  }

  /**
   * Load a worker toolpath in its draw layout ({@link WorkerSegmentsData}).
   * Rapids use `rapidColor` and cuts `cutColor`, or the palette slot colour
   * when the file has toolchanges; laser-off cuts are not drawn.
   */
  loadFromSegments(data: WorkerSegmentsData): void {
    this.adoptWorkerGroups(
      buildSegmentsSegmentGroups(data, { rapidColor: this.options.rapidColor, cutColor: this.options.cutColor })
    );
  }

  private adoptWorkerGroups(groups: { hexColor: string; opacity: number; positions: Float32Array }[]): void {
    this.workerMode = true;
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    this.segmentGroups = groups.map(g => ({
      color: g.hexColor,
      opacity: g.opacity,
      verts: g.positions,
      stride: 6 as const,
    }));
    this.hasZInfo = true;
    this.bounds = computeBounds(groups.map(g => ({ verts: g.positions, stride: 6 })));
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
    groups: { hexColor: string; opacity: number; positionsBuffer: ArrayBuffer; positionsLen: number; stride?: 4 | 6 }[],
    meta?: { minZ?: number; maxZ?: number }
  ): void {
    this.workerMode = true;
    this.rapidVerts = new Float32Array(0);
    this.cutVerts = new Float32Array(0);
    this.segmentGroups = groups.map(g => ({
      color: g.hexColor,
      opacity: g.opacity,
      verts: new Float32Array(g.positionsBuffer, 0, g.positionsLen),
      stride: g.stride ?? 6,
    }));
    this.bounds = computeBounds(this.segmentGroups);
    const hasMetaZ = meta?.minZ !== undefined && meta?.maxZ !== undefined;
    if (hasMetaZ && !this.bounds.empty) {
      this.bounds.minZ = meta.minZ!;
      this.bounds.maxZ = meta.maxZ!;
    }
    this.hasZInfo = hasMetaZ || this.segmentGroups.every(g => g.stride === 6);
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
      { color: this.options.rapidColor, opacity: 0.5, verts: this.rapidVerts, stride: 6 },
      { color: this.options.cutColor, opacity: 1.0, verts: this.cutVerts, stride: 6 },
    ];
  }

  resetView(): void {
    const rotated = this.rotX !== DEFAULT_ROT_X || this.rotY !== DEFAULT_ROT_Y;
    this.rotX = DEFAULT_ROT_X;
    this.rotY = DEFAULT_ROT_Y;
    this.updateTrig();
    this.fitView();
    // The path data only depends on the projection, so an unrotated view just
    // needs the new viewBox.
    if (rotated) this.rebuildAndRender();
    else this.renderOverlays();
  }

  // Cheap unless the projection changes: colours and stroke width are
  // attributes, so only a projection change re-serialises the path data.
  // Consumers often pass a fresh options object on every render, so unchanged
  // values must cost nothing.
  setOptions(opts: Partial<GCodeSVGOptions>): void {
    const prev = this.options;
    const next = { ...prev, ...opts };
    const keys = Object.keys(opts) as (keyof GCodeSVGOptions)[];
    if (!keys.some(k => next[k] !== prev[k])) return;
    this.options = next;
    this.applyOptions();
    if (next.projectionMode !== prev.projectionMode) {
      this.rebuildAndRender();
    } else {
      this.styleToolpaths();
      this.renderOverlays();
    }
  }

  setProjectionMode(mode: 'perspective' | 'isometric' | 'top'): void {
    if (mode === this.options.projectionMode) return;
    this.options = { ...this.options, projectionMode: mode };
    this.rebuildAndRender();
  }

  getSVGElement(): SVGSVGElement {
    return this.svg;
  }

  setBitPosition(pos: { x: number; y: number; z: number }): void {
    this.crosshairPos = pos;
    this.crosshairVisible = true;
    // Moving the tool marker only touches the crosshair overlay — never rebuild
    // the (potentially huge) toolpath paths. This is O(1) regardless of file size.
    this.scheduleOverlayDraw();
  }

  setBitVisible(visible: boolean): void {
    this.crosshairVisible = visible;
    this.scheduleOverlayDraw();
  }

  dispose(): void {
    if (this.wheelEndTimer !== null) clearTimeout(this.wheelEndTimer);
    this.gestureActive = false;
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
    // Fixed top-down view: world XY maps straight to screen (Y flipped), Z ignored.
    if (this.options.projectionMode === 'top') {
      return { x, y: -y };
    }
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
    this.rebuildToolpaths(draft);
    this.renderOverlays();
  }

  // Expensive: re-projects and re-serialises every vertex into SVG path `d`
  // strings. Only call when geometry, projection, or stroke width changes —
  // never for bit-position/crosshair updates (use scheduleOverlayDraw instead).
  private rebuildToolpaths(draft = false): void {
    const fmt = draft ? fDraft : f;
    // Screen-space simplification tolerance: merge consecutive projected points
    // closer than a fraction of the model extent. Sub-pixel at typical view
    // sizes (no visible loss) but it caps drawn segment density so large files
    // (100k+ segments) don't choke SVG paint.
    const tol = this.simplifyTolerance();

    while (this.pathEls.length < this.segmentGroups.length) {
      const el = makePath();
      this.pathLayer.appendChild(el);
      this.pathEls.push(el);
    }
    while (this.pathEls.length > this.segmentGroups.length) {
      this.pathLayer.removeChild(this.pathEls.pop()!);
    }

    for (let i = 0; i < this.segmentGroups.length; i++) {
      const { verts, stride } = this.segmentGroups[i];
      this.pathEls[i].setAttribute(
        "d",
        stride === 4
          ? verticesToPath2D(verts, fmt, tol)
          : verticesToPath(verts, this.project, fmt, tol)
      );
    }
    this.styleToolpaths();
  }

  // Butt caps and bevel joins: round ones make stroking very long paths
  // noticeably slower on mobile, and the difference isn't visible at
  // toolpath widths.
  private styleToolpaths(): void {
    const sw = String(this.options.strokeWidth);
    for (let i = 0; i < this.pathEls.length; i++) {
      const { color, opacity } = this.segmentGroups[i];
      const el = this.pathEls[i];
      el.setAttribute("stroke", color);
      el.setAttribute("stroke-opacity", String(opacity));
      el.setAttribute("stroke-width", sw);
      el.setAttribute("stroke-linecap", "butt");
      el.setAttribute("stroke-linejoin", "bevel");
    }
  }

  // Cheap O(1) overlays that don't depend on toolpath geometry.
  private renderOverlays(): void {
    this.renderBbox();
    this.renderOriginMarker();
    this.renderCrosshairMarker();
    this.applyViewBox();
  }

  // World-space distance below which consecutive projected points are merged.
  // Derived from the bounds diagonal so it scales with model size and stays
  // deterministic (independent of zoom / layout timing).
  private simplifyTolerance(): number {
    if (this.bounds.empty) return 0;
    const diag = Math.hypot(
      this.bounds.maxX - this.bounds.minX,
      this.bounds.maxY - this.bounds.minY,
      this.bounds.maxZ - this.bounds.minZ
    );
    return diag / 1500;
  }

  private scheduleDraw(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.rebuildAndRender(true); // draft precision during active drag
    });
  }

  // rAF-coalesced redraw of just the overlays (bbox/origin/crosshair/viewBox).
  // Used for bit-position updates so a running job never rebuilds the toolpath.
  private scheduleOverlayDraw(): void {
    if (this.overlayRafPending) return;
    this.overlayRafPending = true;
    requestAnimationFrame(() => {
      this.overlayRafPending = false;
      this.renderOverlays();
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
    if (this.gestureActive) {
      this.scheduleGesturePreview();
      return;
    }
    this.svg.style.transform = "";
    const { x, y, w, h } = this.viewBox;
    this.committedViewBox = { ...this.viewBox };
    const attr = `${f(x)} ${f(y)} ${f(w)} ${f(h)}`;
    // Rewriting an identical viewBox would still invalidate the paths.
    if (attr === this.committedViewBoxAttr) return;
    this.committedViewBoxAttr = attr;
    this.svg.setAttribute("viewBox", attr);
  }

  private beginGesture(): void {
    if (this.gestureActive) return;
    if (!this.committedViewBox) this.applyViewBox();
    this.gestureRect = this.svg.getBoundingClientRect();
    this.gestureActive = true;
  }

  private endGesture(): void {
    if (!this.gestureActive) return;
    this.gestureActive = false;
    this.gestureRect = null;
    if (this.wheelEndTimer !== null) {
      clearTimeout(this.wheelEndTimer);
      this.wheelEndTimer = null;
    }
    // Overlay sizes (origin, crosshair) depend on the zoom, so redraw them
    // along with the commit.
    this.renderOverlays();
  }

  private scheduleGesturePreview(): void {
    if (this.gestureRafPending) return;
    this.gestureRafPending = true;
    requestAnimationFrame(() => {
      this.gestureRafPending = false;
      if (this.gestureActive) this.applyGesturePreview();
    });
  }

  // Map the committed view onto the live one with translate + uniform scale.
  // Gestures keep the viewBox aspect ratio, and with preserveAspectRatio
  // "xMidYMid meet" the viewBox centre sits at the element centre, scaled
  // by k, so a world point P lands at rc + (P - centre) * k:
  //   committed: rc + (P - cc) * k        live: rc + (P - cl) * k * s
  //   live = t + s * committed  =>  t = rc * (1 - s) + s * k * (cc - cl)
  private applyGesturePreview(): void {
    const c = this.committedViewBox;
    const rect = this.gestureRect;
    if (!c || !rect || rect.width === 0 || rect.height === 0) return;
    const l = this.viewBox;
    const s = c.w / l.w;
    const k = Math.min(rect.width / c.w, rect.height / c.h);
    const tx = (rect.width / 2) * (1 - s) + s * k * (c.x + c.w / 2 - (l.x + l.w / 2));
    const ty = (rect.height / 2) * (1 - s) + s * k * (c.y + c.h / 2 - (l.y + l.h / 2));
    this.svg.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }

  private elementRect(): DOMRect {
    return this.gestureRect ?? this.svg.getBoundingClientRect();
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

    if (this.options.projectionMode === 'top') {
      const c0 = p(minX, minY, 0), c1 = p(maxX, minY, 0);
      const c2 = p(maxX, maxY, 0), c3 = p(minX, maxY, 0);
      this.bboxPath.setAttribute(
        "d",
        `M${f(c0.x)} ${f(c0.y)}L${f(c1.x)} ${f(c1.y)}L${f(c2.x)} ${f(c2.y)}L${f(c3.x)} ${f(c3.y)}Z`
      );

      const projW = Math.abs(c1.x - c0.x);
      const projH = Math.abs(c3.y - c0.y);
      const fontSize = Math.max(projW, projH) * 0.07;
      const gap = fontSize * 0.5;

      setLabel(this.bboxLabelX, mid(c0, c1), outward(mid(c0, c1), mid(c2, c3), gap), fontSize, `X: ${fd(maxX - minX)}`);
      const screenMinY = Math.min(c0.y, c1.y, c2.y, c3.y);
      const screenMaxY = Math.max(c0.y, c1.y, c2.y, c3.y);
      const screenMaxX = Math.max(c0.x, c1.x, c2.x, c3.x);
      const screenMinX = Math.min(c0.x, c1.x, c2.x, c3.x);
      const yPos = { x: screenMaxX + gap, y: (screenMinY + screenMaxY) / 2 };
      setLabel(this.bboxLabelY, yPos, yPos, fontSize, `Y: ${fd(maxY - minY)}`);
      if (this.hasZInfo) {
        const zPos = { x: (screenMinX + screenMaxX) / 2, y: screenMinY - fontSize };
        setLabel(this.bboxLabelZ, zPos, zPos, fontSize, `Z: ${fd(maxZ - minZ)}`);
      } else {
        this.bboxLabelZ.setAttribute("visibility", "hidden");
      }
      return;
    }

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
    this.beginGesture();
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
    if (this.wheelEndTimer !== null) clearTimeout(this.wheelEndTimer);
    this.wheelEndTimer = setTimeout(() => this.endGesture(), WHEEL_END_MS);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    this.beginGesture();

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

      const scale = this.pixelsPerUnit();
      const dmx = mid.x - this.pinchLastMid.x;
      const dmy = mid.y - this.pinchLastMid.y;
      this.viewBox = {
        ...this.viewBox,
        x: this.viewBox.x - dmx / scale,
        y: this.viewBox.y - dmy / scale,
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
      const rect = this.elementRect();
      const sensitivity = Math.PI / Math.min(rect.width, rect.height);
      this.rotY += dx * sensitivity;
      this.rotX += dy * sensitivity;
      this.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotX));
      this.updateTrig();
      this.fitView();
      this.scheduleDraw();
    } else {
      const scale = this.pixelsPerUnit();
      this.viewBox = {
        ...this.viewBox,
        x: this.viewBox.x - dx / scale,
        y: this.viewBox.y - dy / scale,
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
      this.endGesture();
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

  // With preserveAspectRatio "xMidYMid meet" the viewBox is scaled uniformly
  // to fit and centred, so one scale factor covers both axes.
  private pixelsPerUnit(): number {
    const rect = this.elementRect();
    return Math.min(rect.width / this.viewBox.w, rect.height / this.viewBox.h) || 1;
  }

  private svgPoint(clientX: number, clientY: number): Pt2 {
    const rect = this.elementRect();
    const { x, y, w, h } = this.viewBox;
    const scale = this.pixelsPerUnit();
    return {
      x: x + w / 2 + (clientX - rect.left - rect.width / 2) / scale,
      y: y + h / 2 + (clientY - rect.top - rect.height / 2) / scale,
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

// Fast path for stride-4 (2D top-down) data: no projection call, no point allocation.
// `tol` (>0) merges consecutive points within that distance of the last emitted
// point, preserving polyline connectivity and every run's true endpoint.
function verticesToPath2D(
  verts: Float32Array,
  fmt: (n: number) => string,
  tol = 0
): string {
  if (verts.length === 0) return "";
  const parts: string[] = [];
  const EPS = 1e-6;
  const tol2 = tol * tol;
  let prevX = NaN, prevY = NaN;   // end of previous input segment (continuity check)
  let lastX = NaN, lastY = NaN;   // last point actually emitted
  let pendingX = NaN, pendingY = NaN; // deferred (within-tol) tail of current run
  let hasPending = false;
  for (let i = 0; i + 3 < verts.length; i += 4) {
    const x0 = verts[i], y0 = -verts[i + 1];
    const x1 = verts[i + 2], y1 = -verts[i + 3];
    if (Math.abs(x0 - prevX) < EPS && Math.abs(y0 - prevY) < EPS) {
      const dx = x1 - lastX, dy = y1 - lastY;
      if (tol2 > 0 && dx * dx + dy * dy < tol2) {
        pendingX = x1; pendingY = y1; hasPending = true;
      } else {
        parts.push(`L${fmt(x1)} ${fmt(y1)}`);
        lastX = x1; lastY = y1; hasPending = false;
      }
    } else {
      if (hasPending) { parts.push(`L${fmt(pendingX)} ${fmt(pendingY)}`); hasPending = false; }
      parts.push(`M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}`);
      lastX = x1; lastY = y1;
    }
    prevX = x1;
    prevY = y1;
  }
  if (hasPending) parts.push(`L${fmt(pendingX)} ${fmt(pendingY)}`);
  return parts.join("");
}

function verticesToPath(
  verts: Float32Array,
  project: (x: number, y: number, z: number) => Pt2,
  fmt: (n: number) => string,
  tol = 0
): string {
  if (verts.length === 0) return "";
  const parts: string[] = [];
  const EPS = 1e-6;
  const tol2 = tol * tol;
  let prevX = NaN, prevY = NaN;   // end of previous input segment (continuity check)
  let lastX = NaN, lastY = NaN;   // last point actually emitted
  let pendingX = NaN, pendingY = NaN; // deferred (within-tol) tail of current run
  let hasPending = false;
  for (let i = 0; i + 5 < verts.length; i += 6) {
    const p0 = project(verts[i], verts[i + 1], verts[i + 2]);
    const p1 = project(verts[i + 3], verts[i + 4], verts[i + 5]);
    if (Math.abs(p0.x - prevX) < EPS && Math.abs(p0.y - prevY) < EPS) {
      const dx = p1.x - lastX, dy = p1.y - lastY;
      if (tol2 > 0 && dx * dx + dy * dy < tol2) {
        pendingX = p1.x; pendingY = p1.y; hasPending = true;
      } else {
        parts.push(`L${fmt(p1.x)} ${fmt(p1.y)}`);
        lastX = p1.x; lastY = p1.y; hasPending = false;
      }
    } else {
      if (hasPending) { parts.push(`L${fmt(pendingX)} ${fmt(pendingY)}`); hasPending = false; }
      parts.push(`M${fmt(p0.x)} ${fmt(p0.y)}L${fmt(p1.x)} ${fmt(p1.y)}`);
      lastX = p1.x; lastY = p1.y;
    }
    prevX = p1.x;
    prevY = p1.y;
  }
  if (hasPending) parts.push(`L${fmt(pendingX)} ${fmt(pendingY)}`);
  return parts.join("");
}

// ── Bounds computation ───────────────────────────────────────────────────────

function computeBounds(arrays: { verts: Float32Array; stride: number }[]): Bounds {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let empty = true;
  let sawZ = false;
  for (const { verts, stride } of arrays) {
    if (stride === 4) {
      for (let i = 0; i + 3 < verts.length; i += 4) {
        const x0 = verts[i], y0 = verts[i + 1];
        const x1 = verts[i + 2], y1 = verts[i + 3];
        if (x0 < minX) minX = x0; if (y0 < minY) minY = y0;
        if (x0 > maxX) maxX = x0; if (y0 > maxY) maxY = y0;
        if (x1 < minX) minX = x1; if (y1 < minY) minY = y1;
        if (x1 > maxX) maxX = x1; if (y1 > maxY) maxY = y1;
        empty = false;
      }
    } else {
      for (let i = 0; i + 5 < verts.length; i += 6) {
        const x0 = verts[i], y0 = verts[i + 1], z0 = verts[i + 2];
        const x1 = verts[i + 3], y1 = verts[i + 4], z1 = verts[i + 5];
        if (x0 < minX) minX = x0; if (y0 < minY) minY = y0; if (z0 < minZ) minZ = z0;
        if (x0 > maxX) maxX = x0; if (y0 > maxY) maxY = y0; if (z0 > maxZ) maxZ = z0;
        if (x1 < minX) minX = x1; if (y1 < minY) minY = y1; if (z1 < minZ) minZ = z1;
        if (x1 > maxX) maxX = x1; if (y1 > maxY) maxY = y1; if (z1 > maxZ) maxZ = z1;
        empty = false;
        sawZ = true;
      }
    }
  }
  if (!empty && !sawZ) {
    minZ = 0;
    maxZ = 0;
  }
  return { minX, minY, maxX, maxY, minZ, maxZ, empty };
}
