import * as React from "react";
import type { GCodeSVGOptions } from "../viewer/svg/types";
import type { WorkerGeometryData } from "../types";
export type GCodeSVGRendererHandle = {
    loadFromLines(lines: string[]): void;
    loadFromFile(file: File): Promise<void>;
    loadFromText(gcode: string): void;
    loadFromWorkerData(data: WorkerGeometryData): void;
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
    clear(): void;
    resetView(): void;
    setOptions(opts: Partial<GCodeSVGOptions>): void;
    setProjectionMode(mode: 'perspective' | 'isometric' | 'top'): void;
    setBitPosition(pos: {
        x: number;
        y: number;
        z: number;
    }): void;
    setBitVisible(visible: boolean): void;
    getSVGElement(): SVGSVGElement;
    dispose(): void;
};
export type GCodeSVGVisualizerProps = {
    id: string;
    options?: Partial<GCodeSVGOptions>;
    className?: string;
    style?: React.CSSProperties;
};
export declare const GCodeSVGVisualizer: React.ForwardRefExoticComponent<GCodeSVGVisualizerProps & React.RefAttributes<GCodeSVGRendererHandle>>;
