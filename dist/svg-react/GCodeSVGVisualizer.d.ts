import type { GCodeSVGOptions } from "../svg/types";
export type GCodeSVGVisualizerProps = {
    options?: Partial<GCodeSVGOptions>;
    className?: string;
    style?: React.CSSProperties;
};
export type GCodeSVGVisualizerHandle = {
    loadFromLines(lines: string[]): void;
    loadFromFile(file: File): Promise<void>;
    loadFromText(gcode: string): void;
    clear(): void;
    resetView(): void;
    setOptions(opts: Partial<GCodeSVGOptions>): void;
    setProjectionMode(mode: 'perspective' | 'isometric'): void;
};
export declare const GCodeSVGVisualizer: any;
