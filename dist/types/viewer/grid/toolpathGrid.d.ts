import * as THREE from "three";
import type { GCodeViewerTheme, GridUnits } from "../types";
export type ToolpathGridExtent = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};
export type ToolpathGridLabel = {
    object: THREE.Object3D;
    axis: "x" | "y";
    /** World position along its axis. */
    world: number;
    /** Index in major steps from 0, used for thinning. */
    index: number;
    /** Label width / height. */
    aspect: number;
};
export type ToolpathGrid = {
    group: THREE.Group;
    extent: ToolpathGridExtent;
    majorStep: number;
    majorTick: number;
    labels: ToolpathGridLabel[];
    /** Major lines not on a decade; hidden when crowded. */
    majorLines: THREE.LineSegments;
    /** Minor (half-step) ruler ticks; hidden when crowded. */
    minorTicks: THREE.LineSegments;
};
export declare function toolpathGridSteps(units: GridUnits): {
    major: number;
    minor: number;
};
/**
 * The toolpath's X/Y extent snapped outward to the nearest major line, so the
 * grid starts at the toolpath rather than beyond it. A toolpath that spans no
 * width on an axis still gets one step.
 */
export declare function toolpathGridExtent(bounds: {
    min: {
        x: number;
        y: number;
    };
    max: {
        x: number;
        y: number;
    };
}, majorStep: number): ToolpathGridExtent;
/** Value shown for a major line, in display units. */
export declare function formatToolpathGridLabel(index: number, units: GridUnits): string;
/**
 * Show every Nth label (N from 1, 2, 5, 10, 20, 50...) so labels are at least
 * `minSpacingPx` apart on screen.
 */
export declare function labelStride(stepPx: number, minSpacingPx: number): number;
export declare function createToolpathGrid(args: {
    bounds: THREE.Box3;
    units: GridUnits;
    theme: GCodeViewerTheme;
}): ToolpathGrid;
/**
 * Sizes labels to `labelSizePx` on screen, keeps them a fixed pixel gap
 * outside the ruler, and thins labels / minor ticks / plain major lines that
 * would be too crowded at the current zoom.
 */
export declare function updateToolpathGridScale(grid: ToolpathGrid, worldPerPixel: number, labelSizePx: number): void;
/**
 * What a top-down fit must keep on screen to show the whole grid: the world
 * box (extent plus ruler ticks) and the pixel-sized label overhang per side.
 */
export declare function toolpathGridFrame(grid: ToolpathGrid, labelSizePx: number): {
    box: ToolpathGridExtent;
    paddingPx: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
};
export declare function disposeToolpathGrid(grid: ToolpathGrid): void;
