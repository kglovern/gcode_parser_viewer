import type { WorkerGeometryData } from "../types";
import { GCodeViewerCameraView, GCodeViewerBounds, GCodeViewerCallbacks, GCodeViewerCreateArgs, GCodeViewerHandle, GCodeViewerBitPosition, GCodeViewerOptions } from "./types";
export declare class GCodeViewer implements GCodeViewerHandle {
    readonly id: string;
    private readonly container;
    private readonly canvas;
    private readonly renderer;
    private readonly scene;
    private readonly toolpathRoot;
    private readonly camera;
    private readonly controls;
    private viewCube;
    private readonly viewCubeCorrection;
    private callbacks;
    private options;
    private resizeObserver;
    private onWindowResize;
    private animationFrameId;
    private gridGroup;
    private axesGroup;
    private gridLabelsGroup;
    private boundingBoxGroup;
    private machineBedGroup;
    private bitMarker;
    private preLaserBitType;
    private toolpathStreams;
    private toolpathCutBucketCount;
    private toolpathRotationA;
    private lastBitPosition;
    private sim3dHandle;
    private currentLines;
    private linePositions;
    private renderSequence;
    private currentBounds;
    private cameraFocusTransition;
    constructor(args: GCodeViewerCreateArgs);
    setBitPosition(position: GCodeViewerBitPosition, options?: {
        immediate?: boolean;
    }): void;
    setBitVisible(visible: boolean): void;
    setBitSpinning(spinning: boolean): void;
    setToolpathRotationA(aDegrees: number): void;
    setCallbacks(callbacks: GCodeViewerCallbacks): void;
    hideUntilLine(lineIndex: number, mode?: "hide" | "grey"): void;
    seekToLine(lineIndex: number, mode?: "hide" | "grey"): void;
    showAll(): void;
    resetColors(): void;
    snapCameraToView(view: GCodeViewerCameraView, options?: {
        durationMs?: number;
        distance?: number;
    }): void;
    /**
     * Enable or disable orbit *rotation* while leaving pan and zoom untouched.
     *
     * Used to pin the camera to a fixed view (e.g. top-down) so a press-and-hold
     * gesture is not interpreted as a rotate-drag and the picked plane stays
     * stable under the cursor. Picking (screenToWorld) works from any camera
     * orientation, so this is a UX lock, not a correctness requirement.
     */
    setRotateEnabled(enabled: boolean): void;
    /**
     * Convert a viewport pixel (clientX/clientY, e.g. from a PointerEvent) into a
     * point on a horizontal toolpath plane, in the scene's coordinate space.
     *
     * A ray is cast from the camera through the pixel and intersected with the
     * plane Z = `planeZ`, which defaults to the bit's current Z so the pick lands
     * on the plane the tool is sitting on. Returns null when the pixel is outside
     * a laid-out canvas or the ray is parallel to the plane (no intersection).
     *
     * The result is in world/scene space. The toolpath root sits at the origin,
     * so for a normal (non-rotary) file this equals the gcode work coordinate.
     * For a rotary file the toolpath root is rotated about X, so the returned XY
     * is not a meaningful work coordinate — callers supporting only XY moves
     * should gate on file type.
     */
    screenToWorld(clientX: number, clientY: number, options?: {
        planeZ?: number;
    }): {
        x: number;
        y: number;
        z: number;
    } | null;
    private startSnapToView;
    loadFromUrl(url: string, args?: {
        signal?: AbortSignal;
    }): Promise<void>;
    loadFromFile(file: File): Promise<void>;
    loadFromText(gcode: string): Promise<void>;
    loadFromLines(lines: readonly string[]): Promise<void>;
    loadFromWorkerData(data: WorkerGeometryData): Promise<void>;
    unload(): void;
    setOptions(next: Partial<GCodeViewerOptions>): void;
    getOptions(): Readonly<GCodeViewerOptions>;
    resize(): void;
    focusToModel(): void;
    resetCamera(): void;
    getBounds(): GCodeViewerBounds | null;
    dispose(): void;
    private emitProgress;
    private emitBoundsChanged;
    private startAnimationLoop;
    private ensureBitMarker;
    private worldSizes;
    private renderGridAndAxes;
    private refreshGridLabels;
    private refreshBoundingBox;
    private refreshMachineBed;
    private setBitMarker;
    private setGridGroup;
    private setAxesGroup;
    private setGridLabelsGroup;
    private setBoundingBoxGroup;
    private setMachineBedGroup;
    private setGeometryEmpty;
    private setToolpathGeometry;
    private refreshToolpathColors;
    private refreshToolpathOpacities;
    private cutBucketOpacity;
    private buildLinePositions;
    private renderScene;
    private setSim3dHandle;
    private setToolpathStreamsVisible;
    private buildAndApplySim3d;
    private startCameraFocus;
    private updateCameraFocusTransition;
    private updateViewCubeRotation;
}
