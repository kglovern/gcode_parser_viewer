import type { LoadWorkerDataOptions, WorkerGeometryData, WorkerSegmentsData } from "../types";
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
export type GCodeViewerOptions = {
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
        bounds: {
            min: {
                x: number;
                y: number;
            };
            max: {
                x: number;
                y: number;
            };
        } | null;
    };
    boundingBox: {
        visible: boolean;
        labels: boolean;
    };
    machineBed: {
        visible: boolean;
        min: {
            x: number;
            y: number;
        } | null;
        max: {
            x: number;
            y: number;
        } | null;
        keepout: {
            min: {
                x: number;
                y: number;
            };
            max: {
                x: number;
                y: number;
            };
        } | null;
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
        initialPosition: {
            x: number;
            y: number;
            z: number;
        };
    };
};
export declare const defaultGCodeViewerTheme: GCodeViewerTheme;
export declare const defaultGCodeViewerOptions: GCodeViewerOptions;
export type GCodeViewerProgressEvent = {
    id: string;
    state: "hidden";
} | {
    id: string;
    state: "indeterminate";
    label: string;
} | {
    id: string;
    state: "determinate";
    label: string;
    processed: number;
    total: number;
};
export type GCodeViewerProgressEventNoId = {
    state: "hidden";
} | {
    state: "indeterminate";
    label: string;
} | {
    state: "determinate";
    label: string;
    processed: number;
    total: number;
};
export type GCodeViewerCallbacks = {
    onProgress?: (event: GCodeViewerProgressEvent) => void;
    onBoundsChanged?: (event: {
        id: string;
        bounds: GCodeViewerBounds | null;
    }) => void;
};
export type GCodeViewerBounds = {
    min: {
        x: number;
        y: number;
        z: number;
    };
    max: {
        x: number;
        y: number;
        z: number;
    };
};
export type GCodeViewerHandle = {
    readonly id: string;
    setCallbacks(callbacks: GCodeViewerCallbacks): void;
    snapCameraToView(view: GCodeViewerCameraView, options?: {
        durationMs?: number;
        distance?: number;
    }): void;
    setCameraProjection(projection: GCodeViewerCameraProjection): void;
    getCameraProjection(): GCodeViewerCameraProjection;
    setRotateEnabled(enabled: boolean): void;
    setCameraFollowEnabled(enabled: boolean): void;
    screenToWorld(clientX: number, clientY: number, options?: {
        planeZ?: number;
    }): {
        x: number;
        y: number;
        z: number;
    } | null;
    worldToScreen(x: number, y: number, z?: number): {
        x: number;
        y: number;
    } | null;
    setBitPosition(position: GCodeViewerBitPosition, options?: {
        immediate?: boolean;
    }): void;
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
    loadFromUrl(url: string, args?: {
        signal?: AbortSignal;
    }): Promise<void>;
    loadFromFile(file: File): Promise<void>;
    loadFromText(gcode: string): Promise<void>;
    loadFromLines(lines: readonly string[]): Promise<void>;
    loadFromWorkerData(data: WorkerGeometryData): Promise<void>;
    loadFromSegments(data: WorkerSegmentsData, options?: LoadWorkerDataOptions): Promise<void>;
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
export type GCodeViewerCameraView = "front" | "back" | "left" | "right" | "top" | "bottom" | "front-top-left" | "front-top-right" | "front-bottom-left" | "front-bottom-right" | "back-top-left" | "back-top-right" | "back-bottom-left" | "back-bottom-right";
