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
    setSpinning(spinning: boolean): void;
    /**
     * World units per CSS pixel at the current zoom. With `bit.screenSpace` the
     * marker rescales to stay `bit.size` pixels across; otherwise a no-op.
     */
    setPixelScale(worldUnitsPerPixel: number): void;
};
export declare function createBitMarker(initialOptions: GCodeViewerOptions): BitMarker;
