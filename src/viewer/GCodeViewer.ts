import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildToolpathGeometryFromLinesBatched,
} from "../geometry";
import { GCodeVirtualizer } from "../virtualizer";
import {
  applyStreamGreyCursor,
  createToolpathStreams,
  disposeToolpathStreams,
  refreshToolpathStreamColors,
  refreshToolpathStreamOpacities,
  type ToolpathStreamState,
} from "./toolpath/streams";
import {
  defaultGCodeViewerOptions,
  GCodeViewerBitType,
  GCodeViewerCameraView,
  GCodeViewerBounds,
  GCodeViewerCallbacks,
  GCodeViewerCreateArgs,
  GCodeViewerHandle,
  GCodeViewerBitPosition,
  GCodeViewerOptions,
} from "./types";
import type { GCodeViewerProgressEventNoId } from "./types";
import { ViewCube } from "./ViewCube";
import { createBoundingBoxGroup, disposeBoundingBoxGroup } from "./bbox/boundingBox";
import {
  dominantCameraFace,
  easeInOutCubic,
  ensureContainerOverlayLayout,
  viewDirection,
} from "./camera/camera";
import {
  createAxes,
  createGridLabels,
  createUnitGrid,
  disposeAxesGroup,
  disposeLineSegmentsGroup,
  disposeSpriteGroup,
} from "./grid/grid";
import { createBitMarker, type BitMarker } from "./bit/bit";

const MM_PER_INCH = 25.4;

type NormalizedOptions = GCodeViewerOptions;

export class GCodeViewer implements GCodeViewerHandle {
  public readonly id: string;

  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly toolpathRoot: THREE.Group;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private viewCube: ViewCube | null = null;
  private readonly viewCubeCorrection: THREE.Matrix4;

  private callbacks: GCodeViewerCallbacks;
  private options: NormalizedOptions;

  private resizeObserver: ResizeObserver | null = null;
  private onWindowResize: (() => void) | null = null;
  private animationFrameId: number | null = null;

  private gridGroup: THREE.Group | null = null;
  private axesGroup: THREE.Group | null = null;
  private gridLabelsGroup: THREE.Group | null = null;
  private boundingBoxGroup: THREE.Group | null = null;
  private bitMarker: BitMarker | null = null;
  private preLaserBitType: GCodeViewerBitType = "drill";

  private toolpathStreams: ToolpathStreamState[] = [];
  private toolpathCutBucketCount = 1;
  private toolpathRotationA = 0;

  private currentLines: string[] = [];
  private linePositions: Float32Array | null = null;
  private renderSequence = 0;
  private currentBounds: THREE.Box3 | null = null;

  private cameraFocusTransition:
    | {
        startedAt: number;
        duration: number;
        fromPosition: THREE.Vector3;
        toPosition: THREE.Vector3;
        fromTarget: THREE.Vector3;
        toTarget: THREE.Vector3;
        dampingEnabled: boolean;
      }
    | null = null;

  constructor(args: GCodeViewerCreateArgs) {
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

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.options.render.antialias,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(this.options.render.theme.background, 1);

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    this.scene.add(new THREE.DirectionalLight(0xffffff, 0.6));

    this.toolpathRoot = new THREE.Group();
    this.toolpathRoot.name = "gviewer:toolpath-root";
    this.scene.add(this.toolpathRoot);

    this.camera = new THREE.PerspectiveCamera(this.options.camera.fov, 1, 0.1, 100000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(
      this.options.camera.initialPosition.x,
      this.options.camera.initialPosition.y,
      this.options.camera.initialPosition.z
    );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = this.options.camera.orbit.enableDamping;
    this.controls.update();

    this.viewCubeCorrection = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(90));

    this.viewCube = new ViewCube({
      container: this.container,
      onSelectView: (view) => {
        const center = new THREE.Vector3();
        let distance: number;
        if (this.currentBounds) {
          this.currentBounds.getCenter(center);
          const size = new THREE.Vector3();
          this.currentBounds.getSize(size);
          const halfMax = Math.max(size.x, size.y, 1) / 2;
          const fovRadians = THREE.MathUtils.degToRad(this.camera.fov);
          distance = (halfMax / Math.tan(fovRadians / 2)) * 1.25 + size.z;
        } else {
          distance = this.camera.position.distanceTo(this.controls.target);
        }
        this.startSnapToView(view, center, Math.max(1e-6, distance), 400);
      },
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

  setBitPosition(position: GCodeViewerBitPosition, options?: { immediate?: boolean }): void {
    this.ensureBitMarker();
    this.bitMarker?.setTarget(position, options);
  }

  setBitVisible(visible: boolean): void {
    this.ensureBitMarker();
    this.bitMarker?.setVisible(visible);
  }

  setToolpathRotationA(aDegrees: number): void {
    const next = Number(aDegrees) || 0;
    this.toolpathRotationA = next;
    this.toolpathRoot.rotation.x = THREE.MathUtils.degToRad(next);
  }

  setCallbacks(callbacks: GCodeViewerCallbacks): void {
    this.callbacks = callbacks;
  }

  hideUntilLine(lineIndex: number, mode?: "hide" | "grey"): void {
    const resolvedMode = mode ?? this.options.progress.mode;
    const index = Math.floor(lineIndex);

    for (const stream of this.toolpathStreams) {
      const cursor =
        index < 0 ? 0 : stream.prefixEndVertex[Math.min(index, stream.prefixEndVertex.length - 1)];
      if (resolvedMode === "grey") {
        stream.line.geometry.setDrawRange(0, stream.totalVertices);
        applyStreamGreyCursor({ stream, nextCursorVertex: cursor, options: this.options });
      } else {
        stream.line.geometry.setDrawRange(cursor, Math.max(0, stream.totalVertices - cursor));
      }
    }
  }

  seekToLine(lineIndex: number, mode?: "hide" | "grey"): void {
    this.hideUntilLine(lineIndex, mode);
    if (this.linePositions && this.currentLines.length > 0) {
      const i = Math.max(0, Math.min(Math.floor(lineIndex), this.currentLines.length - 1));
      const pos: GCodeViewerBitPosition = {
        x: this.linePositions[i * 4],
        y: this.linePositions[i * 4 + 1],
        z: this.linePositions[i * 4 + 2],
        a: this.linePositions[i * 4 + 3],
      };
      this.setBitPosition(pos, { immediate: true });
    }
  }

  showAll(): void {
    for (const stream of this.toolpathStreams) {
      stream.line.geometry.setDrawRange(0, stream.totalVertices);
    }
  }

  resetColors(): void {
    for (const stream of this.toolpathStreams) {
      stream.greyCursorVertex = 0;
      stream.simColors.set(stream.baseColors);
      const attr = stream.line.geometry.getAttribute("color") as THREE.BufferAttribute;
      attr.updateRange.offset = 0;
      attr.updateRange.count = stream.simColors.length;
      attr.needsUpdate = true;
    }
  }

  snapCameraToView(view: GCodeViewerCameraView, options: { durationMs?: number; distance?: number } = {}): void {
    const durationMs = Math.max(0, Math.floor(options.durationMs ?? 240));
    const target = this.controls.target.clone();
    const currentDistance = this.camera.position.distanceTo(target);
    const distance = Math.max(1e-6, options.distance ?? currentDistance);
    this.startSnapToView(view, target, distance, durationMs);
  }

  private startSnapToView(
    view: GCodeViewerCameraView,
    toTarget: THREE.Vector3,
    distance: number,
    durationMs: number
  ): void {
    const direction = viewDirection(view);
    const toPosition = toTarget.clone().add(direction.multiplyScalar(distance));
    const maxDim = Math.max(1, distance);
    this.camera.near = maxDim / 1000;
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
      toTarget,
      dampingEnabled: this.controls.enableDamping,
    };
    this.controls.enableDamping = false;
  }

  async loadFromUrl(url: string, args: { signal?: AbortSignal } = {}): Promise<void> {
    this.emitProgress({ state: "indeterminate", label: "Loading file..." });
    const response = await fetch(url, { signal: args.signal });
    if (!response.ok) {
      this.emitProgress({ state: "hidden" });
      throw new Error(`Failed to load gcode: ${response.statusText}`);
    }
    const text = await response.text();
    await this.loadFromText(text);
  }

  async loadFromFile(file: File): Promise<void> {
    this.emitProgress({ state: "indeterminate", label: "Loading file..." });
    const text = await file.text();
    await this.loadFromText(text);
  }

  async loadFromText(gcode: string): Promise<void> {
    await this.loadFromLines(gcode.split(/\r?\n/));
  }

  async loadFromLines(lines: readonly string[]): Promise<void> {
    this.currentLines = Array.from(lines);
    await this.renderScene();
  }

  unload(): void {
    this.currentLines = [];
    this.setGeometryEmpty();
    this.emitProgress({ state: "hidden" });
  }

  setOptions(next: Partial<GCodeViewerOptions>): void {
    const previous = this.options;
    this.options = mergeOptions(this.options, next);

    if (
      previous.render.antialias !== this.options.render.antialias ||
      previous.render.theme.background !== this.options.render.theme.background
    ) {
      this.renderer.setClearColor(this.options.render.theme.background, 1);
    }

    if (
      previous.render.theme.opacity !== this.options.render.theme.opacity ||
      previous.render.theme.rapidOpacity !== this.options.render.theme.rapidOpacity
    ) {
      this.refreshToolpathOpacities();
    }

    if (previous.camera.fov !== this.options.camera.fov) {
      this.camera.fov = this.options.camera.fov;
      this.camera.updateProjectionMatrix();
    }
    if (previous.camera.orbit.enableDamping !== this.options.camera.orbit.enableDamping) {
      this.controls.enableDamping = this.options.camera.orbit.enableDamping;
    }

    const gridLayoutChanged =
      previous.units !== this.options.units ||
      previous.grid.size !== this.options.grid.size ||
      previous.grid.axisDepth !== this.options.grid.axisDepth;

    const gridStyleChanged =
      previous.render.theme.colors.grid.major !== this.options.render.theme.colors.grid.major ||
      previous.render.theme.colors.grid.minor !== this.options.render.theme.colors.grid.minor ||
      previous.render.theme.colors.axes.x !== this.options.render.theme.colors.axes.x ||
      previous.render.theme.colors.axes.y !== this.options.render.theme.colors.axes.y ||
      previous.render.theme.colors.axes.z !== this.options.render.theme.colors.axes.z;

    if (gridLayoutChanged || gridStyleChanged) {
      this.renderGridAndAxes();
    }

    const gridLabelsChanged =
      previous.grid.labels !== this.options.grid.labels ||
      previous.units !== this.options.units ||
      previous.grid.size !== this.options.grid.size ||
      gridStyleChanged;
    if (gridLabelsChanged) {
      this.refreshGridLabels();
    }

    const bboxChanged =
      previous.boundingBox.visible !== this.options.boundingBox.visible ||
      previous.boundingBox.labels !== this.options.boundingBox.labels ||
      previous.units !== this.options.units ||
      previous.render.theme.colors.boundingBox !== this.options.render.theme.colors.boundingBox;
    if (bboxChanged) {
      this.refreshBoundingBox();
    }

    const toolpathColorsChanged =
      previous.render.theme.colors.rapid !== this.options.render.theme.colors.rapid ||
      previous.render.theme.colors.cutting !== this.options.render.theme.colors.cutting ||
      previous.render.theme.colors.laser !== this.options.render.theme.colors.laser ||
      previous.render.theme.background !== this.options.render.theme.background ||
      previous.render.theme.colors.processed !== this.options.render.theme.colors.processed;
    if (toolpathColorsChanged) {
      this.refreshToolpathColors();
    }

    const bitChanged =
      previous.bit.enabled !== this.options.bit.enabled ||
      previous.bit.type !== this.options.bit.type ||
      previous.bit.size !== this.options.bit.size ||
      previous.bit.opacity !== this.options.bit.opacity ||
      previous.bit.colorSource !== this.options.bit.colorSource ||
      previous.bit.color !== this.options.bit.color ||
      toolpathColorsChanged;
    if (bitChanged) {
      this.ensureBitMarker();
      this.bitMarker?.setOptions(this.options);
    }

    if (previous.mode.laser !== this.options.mode.laser) {
      if (this.options.mode.laser) {
        // Entering laser mode — remember current bit type and switch to laser
        if (this.options.bit.type !== "laser") {
          this.preLaserBitType = this.options.bit.type;
          this.options = { ...this.options, bit: { ...this.options.bit, type: "laser" } };
        }
      } else {
        // Leaving laser mode — restore previous bit type
        this.options = { ...this.options, bit: { ...this.options.bit, type: this.preLaserBitType } };
      }
      this.ensureBitMarker();
      this.bitMarker?.setOptions(this.options);
      void this.renderScene();
    }
  }

  getOptions(): Readonly<GCodeViewerOptions> {
    return this.options;
  }

  resize(): void {
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

  focusToModel(): void {
    if (!this.currentBounds) {
      return;
    }
    this.startCameraFocus(this.currentBounds);
  }

  resetCamera(): void {
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

  getBounds(): GCodeViewerBounds | null {
    if (!this.currentBounds) {
      return null;
    }
    return {
      min: {
        x: this.currentBounds.min.x,
        y: this.currentBounds.min.y,
        z: this.currentBounds.min.z,
      },
      max: {
        x: this.currentBounds.max.x,
        y: this.currentBounds.max.y,
        z: this.currentBounds.max.z,
      },
    };
  }

  dispose(): void {
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

  private emitProgress(event: GCodeViewerProgressEventNoId): void {
    this.callbacks.onProgress?.({ id: this.id, ...event });
  }

  private emitBoundsChanged(): void {
    this.callbacks.onBoundsChanged?.({ id: this.id, bounds: this.getBounds() });
  }

  private startAnimationLoop(): void {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);
      const now = performance.now();
      // controls.update() must run before updateCameraFocusTransition().
      // If the order were reversed, controls would recompute camera.position
      // from its internal spherical state (relative to the just-moved target),
      // overwriting the lerped position on every frame. By running controls
      // first, it reads the position from the previous frame; the transition
      // then overrides that with the correct lerped value for this frame.
      // Any pending orbital velocity is decayed by controls each frame and
      // therefore doesn't accumulate to fire as a jump at transition end.
      this.controls.update();
      this.updateCameraFocusTransition();
      this.updateViewCubeRotation();
      this.bitMarker?.update(now);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private ensureBitMarker(): void {
    if (this.bitMarker) {
      return;
    }
    this.bitMarker = createBitMarker(this.options);
    this.scene.add(this.bitMarker.object);
  }

  private worldSizes(): { sizeMm: number; axisDepthMm: number } {
    const scale = this.options.units === "in" ? MM_PER_INCH : 1;
    return {
      sizeMm: Math.max(1, this.options.grid.size * scale),
      axisDepthMm: Math.max(1, this.options.grid.axisDepth * scale),
    };
  }

  private renderGridAndAxes(): void {
    const { sizeMm, axisDepthMm } = this.worldSizes();
    this.setGridGroup(
      createUnitGrid({
        units: this.options.units,
        sizeMm,
        theme: this.options.render.theme,
      })
    );
    this.setAxesGroup(createAxes({ sizeWorld: sizeMm, depthWorld: axisDepthMm, theme: this.options.render.theme }));
  }

  private refreshGridLabels(): void {
    if (!this.options.grid.labels) {
      this.setGridLabelsGroup(null);
      return;
    }
    const { sizeMm } = this.worldSizes();
    this.setGridLabelsGroup(
      createGridLabels({ sizeMm, units: this.options.units, theme: this.options.render.theme })
    );
  }

  private refreshBoundingBox(): void {
    if (!this.options.boundingBox.visible || !this.currentBounds) {
      this.setBoundingBoxGroup(null);
      return;
    }
    this.setBoundingBoxGroup(createBoundingBoxGroup(this.currentBounds, this.options));
  }

  private setBitMarker(next: BitMarker | null): void {
    if (this.bitMarker) {
      this.scene.remove(this.bitMarker.object);
      this.bitMarker.dispose();
    }
    this.bitMarker = next;
    if (this.bitMarker) {
      this.scene.add(this.bitMarker.object);
    }
  }

  private setGridGroup(group: THREE.Group | null): void {
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

  private setAxesGroup(group: THREE.Group | null): void {
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

  private setGridLabelsGroup(group: THREE.Group | null): void {
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

  private setBoundingBoxGroup(group: THREE.Group | null): void {
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

  private setGeometryEmpty(): void {
    disposeToolpathStreams(this.toolpathRoot as unknown as THREE.Scene, this.toolpathStreams);
    this.toolpathStreams = [];
    this.toolpathCutBucketCount = 1;
    this.linePositions = null;
    this.currentBounds = null;
    this.emitBoundsChanged();
    this.refreshBoundingBox();
  }

  private setToolpathGeometry(args: {
    rapid: { positions: Float32Array; prefixEndVertex: Int32Array };
    cuts: { positions: Float32Array; prefixEndVertex: Int32Array }[];
    cutBucketCount: number;
  }): void {
    this.setGeometryEmpty();
    this.toolpathCutBucketCount = Math.max(1, Math.floor(args.cutBucketCount));

    const specs = [
      {
        kind: "rapid" as const,
        cutBucketIndex: null,
        positions: args.rapid.positions,
        prefixEndVertex: args.rapid.prefixEndVertex,
        opacity: clamp01(this.options.render.theme.rapidOpacity ?? 0.3),
      },
      ...args.cuts.map((cut, index) => ({
        kind: "cut" as const,
        cutBucketIndex: index,
        positions: cut.positions,
        prefixEndVertex: cut.prefixEndVertex,
        opacity: this.cutBucketOpacity(index),
      })),
    ];

    const { streams, bounds } = createToolpathStreams({
      specs,
      options: this.options,
      scene: this.toolpathRoot as unknown as THREE.Scene,
    });
    this.toolpathStreams = streams;
    this.currentBounds = bounds ? bounds.clone() : null;
    this.emitBoundsChanged();
    this.refreshBoundingBox();
    this.setToolpathRotationA(this.toolpathRotationA);
  }

  private refreshToolpathColors(): void {
    refreshToolpathStreamColors(this.toolpathStreams, this.options);
  }

  private refreshToolpathOpacities(): void {
    refreshToolpathStreamOpacities({
      streams: this.toolpathStreams,
      options: this.options,
      cutBucketCount: this.toolpathCutBucketCount,
    });
  }

  private cutBucketOpacity(bucketIndex: number): number {
    const baseOpacity = this.options.render.theme.opacity;
    const bucketCount = this.toolpathCutBucketCount;
    if (bucketCount <= 1) {
      return baseOpacity;
    }
    const normalized = bucketIndex / (bucketCount - 1);
    return clamp01(baseOpacity * normalized);
  }

  private buildLinePositions(): void {
    const count = this.currentLines.length;
    this.linePositions = new Float32Array(count * 4);
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    let lastA = 0;
    const virtualizer = new GCodeVirtualizer({
      onLinearMove: (args) => {
        const end = args.transformedEnd ?? args.end;
        lastX = end.X;
        lastY = end.Y;
        lastZ = end.Z;
        lastA = args.end.A;
      },
      onArcMove: (args) => {
        const end = args.transformedEnd ?? args.end;
        lastX = end.X;
        lastY = end.Y;
        lastZ = end.Z;
        lastA = args.end.A;
      },
    });
    for (let i = 0; i < count; i++) {
      const line = this.currentLines[i];
      if (line) {
        virtualizer.processLine(line);
      }
      this.linePositions[i * 4] = lastX;
      this.linePositions[i * 4 + 1] = lastY;
      this.linePositions[i * 4 + 2] = lastZ;
      this.linePositions[i * 4 + 3] = lastA;
    }
  }

  private async renderScene(): Promise<void> {
    if (this.currentLines.length === 0) {
      this.setGeometryEmpty();
      this.emitProgress({ state: "hidden" });
      return;
    }

    const mySequence = (this.renderSequence += 1);
    try {
      if (this.options.mode.laser) {
        this.emitProgress({ state: "indeterminate", label: "Scanning power..." });
      } else {
        this.emitProgress({
          state: "determinate",
          label: "Building geometry...",
          processed: 0,
          total: this.currentLines.length,
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
          },
        },
      });
      if (mySequence !== this.renderSequence) {
        return;
      }
      this.setToolpathGeometry({
        rapid: result.rapid,
        cuts: result.cuts,
        cutBucketCount: result.cutBucketCount,
      });
      this.buildLinePositions();
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

  private startCameraFocus(bounds: THREE.Box3): void {
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    const halfMax = Math.max(size.x, size.y, 1) / 2;
    const fovRadians = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (halfMax / Math.tan(fovRadians / 2)) * 1.25 + size.z;

    const direction = viewDirection("front-top-left");
    const toPosition = center.clone().add(direction.multiplyScalar(distance));
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    this.camera.near = maxDim / 1000;
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
      dampingEnabled: this.controls.enableDamping,
    };
    this.controls.enableDamping = false;
  }

  private updateCameraFocusTransition(): void {
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

  private updateViewCubeRotation(): void {
    if (!this.viewCube) {
      return;
    }
    const q = this.camera.quaternion.clone();
    if (typeof (q as unknown as { invert?: () => void }).invert === "function") {
      (q as unknown as { invert: () => void }).invert();
    } else if (typeof (q as unknown as { inverse?: () => void }).inverse === "function") {
      (q as unknown as { inverse: () => void }).inverse();
    }
    const matrix = new THREE.Matrix4();
    matrix.makeRotationFromQuaternion(q);
    matrix.multiply(this.viewCubeCorrection);
    this.viewCube.setRotationMatrix3d(matrix.elements);

    const face = dominantCameraFace(this.camera.position, this.controls.target);
    this.viewCube.setActiveFace(face);
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function mergeOptions(base: NormalizedOptions, next?: Partial<GCodeViewerOptions>): NormalizedOptions {
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
      batching: { ...base.geometry.batching, ...next.geometry?.batching },
    },
    render: {
      ...base.render,
      ...next.render,
      theme: mergedTheme,
    },
    camera: {
      ...base.camera,
      ...next.camera,
      orbit: { ...base.camera.orbit, ...next.camera?.orbit },
      initialPosition: { ...base.camera.initialPosition, ...next.camera?.initialPosition },
    },
  };
}

function mergeTheme(
  base: GCodeViewerOptions["render"]["theme"],
  next?: Partial<GCodeViewerOptions["render"]["theme"]>
): GCodeViewerOptions["render"]["theme"] {
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
      axes: { ...base.colors.axes, ...next.colors?.axes },
    },
  };
}
