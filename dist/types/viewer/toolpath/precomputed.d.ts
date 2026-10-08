import * as THREE from "three";
/**
 * Segment groups already reduced to draw-ready line pairs, one group per
 * colour. stride 6 = 3D segments [x1,y1,z1,x2,y2,z2]; stride 4 = 2D top-down
 * segments [x1,y1,x2,y2] (what a worker's Z-deduped output emits).
 */
export type PrecomputedSegmentGroup = {
    hexColor: string;
    opacity: number;
    positionsBuffer: ArrayBuffer;
    positionsLen: number;
    stride?: 4 | 6;
};
export type PrecomputedSegmentMeta = {
    minZ?: number;
    maxZ?: number;
};
export type PrecomputedToolpathState = {
    group: THREE.Group;
    lines: THREE.LineSegments[];
};
/**
 * xyz vertex positions for one group. Stride 6 is already xyz and is viewed,
 * not copied; stride 4 is expanded with z = 0.
 */
export declare function precomputedGroupPositions(group: PrecomputedSegmentGroup): Float32Array;
/**
 * Bounds over every group's xyz positions, or null when there are none. When
 * the data is 2D, `meta` supplies the Z extent the flattening threw away.
 */
export declare function precomputedBounds(positions: readonly Float32Array[], meta?: PrecomputedSegmentMeta): THREE.Box3 | null;
/** One LineSegments per group, each in its own colour and opacity. */
export declare function createPrecomputedToolpath(args: {
    groups: readonly PrecomputedSegmentGroup[];
    meta?: PrecomputedSegmentMeta;
    parent: THREE.Object3D;
}): {
    state: PrecomputedToolpathState;
    bounds: THREE.Box3 | null;
};
export declare function disposePrecomputedToolpath(parent: THREE.Object3D, state: PrecomputedToolpathState): void;
