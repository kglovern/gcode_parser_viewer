import type { GCodeViewerCallbacks, GCodeViewerOptions } from "../viewer/types";
export type GCodeVisualizerProps = {
    id: string;
    options?: Partial<GCodeViewerOptions>;
    callbacks?: GCodeViewerCallbacks;
    className?: string;
    style?: Record<string, unknown>;
};
export declare const GCodeVisualizer: any;
