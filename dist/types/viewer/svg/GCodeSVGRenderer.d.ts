import type { WorkerGeometryData, WorkerSegmentsData } from "../../types";
import { GCodeSVGOptions } from "./types";
export declare class GCodeSVGRenderer {
    private svg;
    private bboxPath;
    private bboxLabelX;
    private bboxLabelY;
    private bboxLabelZ;
    private pathLayer;
    private originMarker;
    private crosshairEl;
    private crosshairPos;
    private crosshairVisible;
    private pathEls;
    private segmentGroups;
    private workerMode;
    private options;
    private viewBox;
    private rotX;
    private rotY;
    private centerX;
    private centerY;
    private centerZ;
    private focalLength;
    private cosRotX;
    private sinRotX;
    private cosRotY;
    private sinRotY;
    private dragMode;
    private activePointers;
    private pinchLastDist;
    private pinchLastMid;
    private rafPending;
    private overlayRafPending;
    private gestureActive;
    private gestureRect;
    private gestureRafPending;
    private wheelEndTimer;
    private committedViewBox;
    private committedViewBoxAttr;
    private rapidVerts;
    private cutVerts;
    private bounds;
    private hasZInfo;
    constructor(container: HTMLElement, options?: Partial<GCodeSVGOptions>);
    loadFromLines(lines: string[]): void;
    loadFromFile(file: File): Promise<void>;
    loadFromText(gcode: string): void;
    clear(): void;
    loadFromWorkerData(data: WorkerGeometryData): void;
    /**
     * Load a worker toolpath in its draw layout ({@link WorkerSegmentsData}).
     * Rapids use `rapidColor` and cuts `cutColor`, or the palette slot colour
     * when the file has toolchanges; laser-off cuts are not drawn.
     */
    loadFromSegments(data: WorkerSegmentsData): void;
    private adoptWorkerGroups;
    loadFromPrecomputedGroups(groups: {
        hexColor: string;
        opacity: number;
        positionsBuffer: ArrayBuffer;
        positionsLen: number;
        stride?: 4 | 6;
    }[], meta?: {
        minZ?: number;
        maxZ?: number;
    }): void;
    private syncSegmentGroupsFromLines;
    resetView(): void;
    setOptions(opts: Partial<GCodeSVGOptions>): void;
    setProjectionMode(mode: 'perspective' | 'isometric' | 'top'): void;
    getSVGElement(): SVGSVGElement;
    setBitPosition(pos: {
        x: number;
        y: number;
        z: number;
    }): void;
    setBitVisible(visible: boolean): void;
    dispose(): void;
    private updateTrig;
    private project;
    private rebuildAndRender;
    private rebuildToolpaths;
    private styleToolpaths;
    private renderOverlays;
    private simplifyTolerance;
    private scheduleDraw;
    private scheduleOverlayDraw;
    private fitView;
    private applyViewBox;
    private beginGesture;
    private endGesture;
    private scheduleGesturePreview;
    private applyGesturePreview;
    private elementRect;
    private applyOptions;
    private renderBbox;
    private renderOriginMarker;
    private renderCrosshairMarker;
    private onWheel;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private onContextMenu;
    private bindEvents;
    private pixelsPerUnit;
    private svgPoint;
}
