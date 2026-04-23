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
    setBitPosition(position: GCodeViewerBitPosition, options?: {
        immediate?: boolean;
    }): void;
    setBitVisible(visible: boolean): void;
    setToolpathRotationA(aDegrees: number): void;
    hideUntilLine(lineIndex: number, mode?: "hide" | "grey"): void;
    seekToLine(lineIndex: number, mode?: "hide" | "grey"): void;
    showAll(): void;
    resetColors(): void;
    loadFromUrl(url: string, args?: {
        signal?: AbortSignal;
    }): Promise<void>;
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
export type GCodeViewerCameraView = "front" | "back" | "left" | "right" | "top" | "bottom" | "front-top-left" | "front-top-right" | "front-bottom-left" | "front-bottom-right" | "back-top-left" | "back-top-right" | "back-bottom-left" | "back-bottom-right";
