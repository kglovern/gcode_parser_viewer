import * as THREE from "three";
import type { GCodeViewerBitPosition, GCodeViewerOptions } from "../types";
export type BitMarker = {
    object: THREE.Object3D;
    update(nowMs: number): void;
    dispose(): void;
    setVisible(visible: boolean): void;
    setOptions(options: GCodeViewerOptions): void;
    setTarget(position: GCodeViewerBitPosition, options?: {
        immediate?: boolean;
    }): void;
};
export declare function createBitMarker(initialOptions: GCodeViewerOptions): BitMarker;
