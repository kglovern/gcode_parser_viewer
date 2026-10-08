import type { LoadWorkerDataOptions, WorkerGeometryData, WorkerSegmentsData } from "../types";
import type { PrecomputedSegmentGroup, PrecomputedSegmentMeta } from "./toolpath/precomputed";

export type { PrecomputedSegmentGroup, PrecomputedSegmentMeta } from "./toolpath/precomputed";

export type GridUnits = "mm" | "in";

export type GCodeViewerTheme = {
  background: string;
  opacity: number;
  rapidOpacity?: number;
  colors: {
    rapid: string;
    cutting: string;
    laser?: string;
    processed?: string;
    /** Acked by the controller but not yet physically cut. Falls back to `processed`, then `cutting`. */
    planned?: string;
    boundingBox: string;
    machineBed: string;
    machineBedKeepout: string;
    grid: {
      major: string;
      minor: string;
    };
    axes: {
      x: string;
      y: string;
      z: string;
    };
  };
};

export type GCodeViewerBitType = "circle" | "triangle" | "drill" | "laser" | "crosshair";

export type GCodeViewerBitPosition = {
  x: number;
  y: number;
  z: number;
  a?: number;
};

export type GCodeViewerRunProgressArgs = {
  /** First line of the run (start from line); 0 for a whole-file run. */
  minLine?: number;
  /** Index of the last line sent to the controller; the planned span ends here. */
  plannedLine: number;
  /**
   * Line-based processed edge (e.g. an estimate), used after the bit has been
   * off the toolpath for `fallbackAfterMisses` consecutive calls, or always
   * when the toolpath can't be searched.
   */
  fallbackLine?: number;
  /** Consecutive misses before `fallbackLine` applies. Default 8 (~2 s of 250 ms reports). */
  fallbackAfterMisses?: number;
  /** Distance (toolpath units) the bit may be from a short segment and still be on it. Default 0.5. */
  tolerance?: number;
  mode?: "hide" | "grey";
};

export type GCodeViewerRunProgress = {
  /** Whether the bit was found on the toolpath this call. */
  located: boolean;
  /** Line the processed boundary is in. */
  line: number;
};

export type GCodeViewerSim3dOptions = {
  toolDiameter: number;
  resolution: number;
  showToolpath: boolean;
  erosionPasses: number;
};

/**
 * `"pendant"`: a locked top-down orthographic view for touch screens. It forces
 * `camera.lockTopDown`, orthographic projection, no view cube, no grid or
 * axes, a screen-sized crosshair bit and the origin marker. The machine bed is
 * left to the host. Pair it with `loadFromPrecomputedGroups` and 2D data.
 */
export type GCodeViewerViewMode = "standard" | "pendant";

export type GCodeViewerOptions = {
  viewMode?: GCodeViewerViewMode;
  units: GridUnits;
  mode: {
    laser: boolean;
    sim3d: boolean;
  };
  sim3d: GCodeViewerSim3dOptions;
  bit: {
    enabled: boolean;
    type: GCodeViewerBitType;
    size: number;
    opacity: number;
    tweenMs: number;
    colorSource: "cutting" | "rapid" | "custom";
    color: string;
    spinRpm: number;
    /**
     * Treat `size` as CSS pixels and keep the marker that size on screen at
     * any zoom. Default false (`size` is in world units).
     */
    screenSpace?: boolean;
  };
  progress: {
    mode: "hide" | "grey";
    /**
     * Planned span (segments toolpaths): how far its colour fades from
     * `theme.colors.planned` at the bit toward the toolpath's own colour at
     * the last planned line, 0..1, so later moves read as later. Default 0.85.
     */
    plannedFade?: number;
    /**
     * Sweep a pulse along the planned span in execution order, so the order
     * can be followed where paths overlap or double back. Default false.
     */
    plannedPulse?: boolean;
  };
  grid: {
    sizeX: number;
    sizeY: number;
    axisDepth: number;
    labels: boolean;
    bounds: { min: { x: number; y: number }; max: { x: number; y: number } } | null;
    /** Draw the grid, its labels and the axes. Default true. */
    visible?: boolean;
  };
  /** The HTML view cube in the container corner. Default visible. */
  viewCube?: {
    visible: boolean;
  };
  /** Filled dot at the toolpath origin (0,0,0), a constant size on screen. Default hidden. */
  originMarker?: {
    visible: boolean;
    color: string;
    /** Diameter in CSS pixels. */
    sizePx: number;
  };
  boundingBox: {
    visible: boolean;
    labels: boolean;
  };
  machineBed: {
    visible: boolean;
    min: { x: number; y: number } | null;
    max: { x: number; y: number } | null;
    keepout: { min: { x: number; y: number }; max: { x: number; y: number } } | null;
  };
  geometry: {
    arcSegments: number;
    batching: {
      progressEveryLines: number;
      yieldEveryLines: number;
    };
  };
  render: {
    antialias: boolean;
    theme: GCodeViewerTheme;
  };
  camera: {
    /**
     * Perspective is the default. Orthographic removes the divide-by-z, so
     * toolpath segments sharing X/Y but differing in Z land on the same pixel
     * in an axis-aligned view instead of splaying apart away from the centre.
     */
    projection: GCodeViewerCameraProjection;
    /** Perspective vertical FOV. Also seeds ortho framing when projections swap. */
    fov: number;
    focusDurationMs: number;
    orbit: {
      enableDamping: boolean;
    };
    initialPosition: { x: number; y: number; z: number };
    /**
     * Pin the camera looking straight down (+Y up on screen): rotation off,
     * one-finger/left-drag pans, view snaps ignored, and focus/reset fit the
     * model top-down. Default false.
     */
    lockTopDown?: boolean;
  };
};

export const defaultGCodeViewerTheme: GCodeViewerTheme = {
  background: "#111827",
  opacity: 0.9,
  rapidOpacity: 0.3,
  colors: {
    rapid: "#0ef6ae",
    cutting: "#3e85c7",
    laser: "#a855f7",
    processed: "#6b7280",
    planned: "#dff204",
    boundingBox: "#e2e8f0",
    machineBed: "#fbbf24",
    machineBedKeepout: "#df3b3b",
    grid: { major: "#2f3840", minor: "#1f252b" },
    axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" },
  },
};

export const defaultGCodeViewerOptions: GCodeViewerOptions = {
  units: "mm",
  mode: { laser: false, sim3d: false },
  sim3d: { toolDiameter: 6.35, resolution: 256, showToolpath: false, erosionPasses: 2 },
  bit: {
    enabled: true,
    type: "drill",
    size: 4.05,
    opacity: 0.9,
    tweenMs: 140,
    colorSource: "cutting",
    color: defaultGCodeViewerTheme.colors.cutting,
    spinRpm: 300,
  },
  progress: { mode: "grey", plannedFade: 0.85, plannedPulse: false },
  grid: { sizeX: 1000, sizeY: 1000, axisDepth: 200, labels: true, bounds: null, visible: true },
  viewCube: { visible: true },
  originMarker: { visible: false, color: "#ffffff", sizePx: 9 },
  boundingBox: { visible: false, labels: false },
  machineBed: { visible: false, min: null, max: null, keepout: null },
  geometry: { arcSegments: 30, batching: { progressEveryLines: 5000, yieldEveryLines: 50000 } },
  render: { antialias: true, theme: defaultGCodeViewerTheme },
  camera: {
    projection: "perspective",
    fov: 45,
    focusDurationMs: 900,
    orbit: { enableDamping: true },
    initialPosition: { x: 0, y: -200, z: 200 },
  },
};

export type GCodeViewerProgressEvent =
  | { id: string; state: "hidden" }
  | { id: string; state: "indeterminate"; label: string }
  | { id: string; state: "determinate"; label: string; processed: number; total: number };

export type GCodeViewerProgressEventNoId =
  | { state: "hidden" }
  | { state: "indeterminate"; label: string }
  | { state: "determinate"; label: string; processed: number; total: number };

export type GCodeViewerCallbacks = {
  onProgress?: (event: GCodeViewerProgressEvent) => void;
  onBoundsChanged?: (event: { id: string; bounds: GCodeViewerBounds | null }) => void;
};

export type GCodeViewerBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type GCodeViewerHandle = {
  readonly id: string;
  setCallbacks(callbacks: GCodeViewerCallbacks): void;
  snapCameraToView(
    view: GCodeViewerCameraView,
    options?: { durationMs?: number; distance?: number }
  ): void;
  setCameraProjection(projection: GCodeViewerCameraProjection): void;
  getCameraProjection(): GCodeViewerCameraProjection;
  setRotateEnabled(enabled: boolean): void;
  setCameraFollowEnabled(enabled: boolean): void;
  screenToWorld(
    clientX: number,
    clientY: number,
    options?: { planeZ?: number }
  ): { x: number; y: number; z: number } | null;
  worldToScreen(
    x: number,
    y: number,
    z?: number
  ): { x: number; y: number } | null;
  setBitPosition(position: GCodeViewerBitPosition, options?: { immediate?: boolean }): void;
  setBitVisible(visible: boolean): void;
  setBitSpinning(spinning: boolean): void;
  setToolpathRotationA(aDegrees: number): void;
  hideUntilLine(lineIndex: number, mode?: "hide" | "grey"): void;
  /**
   * Colour the span of lines acked by the controller but not yet physically
   * cut (e.g. `[currentLineRunning, received - 1]`) with `theme.colors.planned`.
   * `fromLine` documents the intended lower bound but is NOT taken literally:
   * the implementation always anchors the lower bound to whatever line
   * `hideUntilLine` most recently resolved, so the two cursors can never
   * drift apart regardless of call order. Call `hideUntilLine` first in the
   * same tick so that cursor is current. Pass `toLine < fromLine` (the
   * normal "nothing queued" state) to clear the planned range — do this on
   * every tick where that holds, it is not a special case to skip.
   */
  setPlannedRange(fromLine: number, toLine: number): void;
  /**
   * Run progress from the bit's position: find the last `setBitPosition`
   * point on the toolpath between the current processed boundary and the end
   * of `plannedLine`, grey (or hide) everything before it — part-way along a
   * segment if that is where the bit is — and colour the rest of the planned
   * lines with `theme.colors.planned`. The processed boundary only moves
   * forward until `resetColors()` or a new load. Toolpaths loaded with
   * `loadFromSegments` only; other loads fall back to `fallbackLine`.
   */
  trackRunProgress(args: GCodeViewerRunProgressArgs): GCodeViewerRunProgress;
  seekToLine(lineIndex: number, mode?: "hide" | "grey"): void;
  showAll(): void;
  resetColors(): void;
  loadFromUrl(url: string, args?: { signal?: AbortSignal }): Promise<void>;
  loadFromFile(file: File): Promise<void>;
  loadFromText(gcode: string): Promise<void>;
  loadFromLines(lines: readonly string[]): Promise<void>;
  loadFromWorkerData(data: WorkerGeometryData): Promise<void>;
  loadFromSegments(data: WorkerSegmentsData, options?: LoadWorkerDataOptions): Promise<void>;
  /**
   * Load draw-ready colour groups, e.g. a worker's Z-deduped 2D output. Each
   * group keeps its own colour and opacity; theme toolpath colours, progress
   * greying, planned lines and `trackRunProgress` do not apply to it.
   */
  loadFromPrecomputedGroups(groups: readonly PrecomputedSegmentGroup[], meta?: PrecomputedSegmentMeta): void;
  unload(): void;
  setOptions(next: Partial<GCodeViewerOptions>): void;
  getOptions(): Readonly<GCodeViewerOptions>;
  resize(): void;
  focusToModel(): void;
  resetCamera(): void;
  getBounds(): GCodeViewerBounds | null;
  dispose(): void;
};

export type GCodeViewerCreateArgs = {
  id: string;
  container: HTMLElement;
  options?: Partial<GCodeViewerOptions>;
  callbacks?: GCodeViewerCallbacks;
};

export type GCodeViewerCameraProjection = "perspective" | "orthographic";

export type GCodeViewerCameraView =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "front-top-left"
  | "front-top-right"
  | "front-bottom-left"
  | "front-bottom-right"
  | "back-top-left"
  | "back-top-right"
  | "back-bottom-left"
  | "back-bottom-right";
