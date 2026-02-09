import type { GCodeViewerBitPosition, GCodeViewerOptions } from "../types";
export type BitMarker = {
    object: any;
    update(nowMs: number): void;
    dispose(): void;
    setVisible(visible: boolean): void;
    setOptions(options: GCodeViewerOptions): void;
    setTarget(position: GCodeViewerBitPosition, options?: {
        immediate?: boolean;
    }): void;
};
export declare function createBitMarker(initialOptions: GCodeViewerOptions): BitMarker;
