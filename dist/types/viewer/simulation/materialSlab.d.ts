import * as THREE from "three";
import type { SlabBounds } from "./heightmap";
export type SlabHandle = {
    group: THREE.Group;
    topMesh: THREE.Mesh;
    topPositionAttr: THREE.BufferAttribute;
    slabBounds: SlabBounds;
    resolution: number;
};
export declare function createMaterialSlab(slabBounds: SlabBounds, resolution: number): SlabHandle;
export declare function updateSlabTopSurface(handle: SlabHandle, heightmap: Float32Array): void;
export declare function disposeSlabHandle(handle: SlabHandle): void;
