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
    boundingBox: string;
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

export type GCodeViewerBitType = "circle" | "triangle" | "drill" | "laser";

export type GCodeViewerBitPosition = {
  x: number;
  y: number;
  z: number;
  a?: number;
};

export type GCodeViewerOptions = {
  units: GridUnits;
  mode: {
    laser: boolean;
  };
  bit: {
    enabled: boolean;
    type: GCodeViewerBitType;
    size: number;
    opacity: number;
    tweenMs: number;
    colorSource: "cutting" | "rapid" | "custom";
    color: string;
  };
  progress: {
    mode: "hide" | "grey";
  };
  grid: {
    size: number;
    axisDepth: number;
    labels: boolean;
  };
  boundingBox: {
    visible: boolean;
    labels: boolean;
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
    fov: number;
    focusDurationMs: number;
    orbit: {
      enableDamping: boolean;
    };
    initialPosition: { x: number; y: number; z: number };
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
    boundingBox: "#77a9d7",
    grid: { major: "#2f3840", minor: "#1f252b" },
    axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" },
  },
};

export const defaultGCodeViewerOptions: GCodeViewerOptions = {
  units: "mm",
  mode: { laser: false },
  bit: {
    enabled: true,
    type: "drill",
    size: 4.05,
    opacity: 0.9,
    tweenMs: 140,
    colorSource: "cutting",
    color: defaultGCodeViewerTheme.colors.cutting,
  },
  progress: { mode: "grey" },
  grid: { size: 1000, axisDepth: 200, labels: true },
  boundingBox: { visible: false, labels: false },
  geometry: { arcSegments: 30, batching: { progressEveryLines: 5000, yieldEveryLines: 50000 } },
  render: { antialias: true, theme: defaultGCodeViewerTheme },
  camera: {
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
  setBitPosition(position: GCodeViewerBitPosition, options?: { immediate?: boolean }): void;
  setBitVisible(visible: boolean): void;
  setToolpathRotationA(aDegrees: number): void;
  hideUntilLine(lineIndex: number, mode?: "hide" | "grey"): void;
  seekToLine(lineIndex: number, mode?: "hide" | "grey"): void;
  showAll(): void;
  resetColors(): void;
  loadFromUrl(url: string, args?: { signal?: AbortSignal }): Promise<void>;
  loadFromFile(file: File): Promise<void>;
  loadFromText(gcode: string): Promise<void>;
  loadFromLines(lines: readonly string[]): Promise<void>;
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
