import * as React from "react";
import type { GCodeViewerCallbacks, GCodeViewerHandle, GCodeViewerOptions } from "../viewer/types";
export type GCodeVisualizerProps = {
    id: string;
    options?: Partial<GCodeViewerOptions>;
    callbacks?: GCodeViewerCallbacks;
    className?: string;
    style?: React.CSSProperties;
};
export declare const GCodeVisualizer: React.ForwardRefExoticComponent<GCodeVisualizerProps & React.RefAttributes<GCodeViewerHandle>>;
