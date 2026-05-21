import * as React from "react";
import type { GCodeSVGOptions } from "../viewer/svg/types";
import type { WorkerGeometryData } from "../types";
export type GCodeSVGRendererHandle = {
    loadFromLines(lines: string[]): void;
    loadFromFile(file: File): Promise<void>;
    loadFromText(gcode: string): void;
    loadFromWorkerData(data: WorkerGeometryData): void;
    clear(): void;
    resetView(): void;
    setOptions(opts: Partial<GCodeSVGOptions>): void;
    setProjectionMode(mode: 'perspective' | 'isometric'): void;
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
