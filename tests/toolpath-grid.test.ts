import * as THREE from "three";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createToolpathGrid,
  disposeToolpathGrid,
  formatToolpathGridLabel,
  labelStride,
  toolpathGridExtent,
  toolpathGridFrame,
  toolpathGridSteps,
  updateToolpathGridScale,
} from "../src/viewer/grid/toolpathGrid";
import { defaultGCodeViewerTheme } from "../src/viewer/types";

// createTextSprite draws to a canvas; node has none.
const originalDocument = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        measureText: (text: string) => ({ width: text.length * 50 }),
        fillText: () => {},
      }),
    }),
  };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = originalDocument;
});

const box = (minX: number, minY: number, maxX: number, maxY: number) =>
  new THREE.Box3(new THREE.Vector3(minX, minY, -3), new THREE.Vector3(maxX, maxY, 0));

const vertexCount = (lines: THREE.LineSegments) => lines.geometry.getAttribute("position").count;

describe("toolpath grid", () => {
  it("uses 10 mm / 5 mm and 1 in / 0.5 in steps", () => {
    expect(toolpathGridSteps("mm")).toEqual({ major: 10, minor: 5 });
    expect(toolpathGridSteps("in")).toEqual({ major: 25.4, minor: 12.7 });
  });

  it("snaps the extent outward to the nearest step, no padding", () => {
    expect(toolpathGridExtent(box(3, -12, 87, 40), 10)).toEqual({ minX: 0, maxX: 90, minY: -20, maxY: 40 });
    // Already on a step: starts exactly at the toolpath.
    expect(toolpathGridExtent(box(0, 0, 50, 20), 10)).toEqual({ minX: 0, maxX: 50, minY: 0, maxY: 20 });
    // Zero-width axis still gets one step.
    expect(toolpathGridExtent(box(0, 5, 0, 5), 10)).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
    const inch = toolpathGridExtent(box(0, 0, 60, 10), 25.4);
    expect(inch.minX).toBeCloseTo(0);
    expect(inch.maxX).toBeCloseTo(76.2);
  });

  it("labels major lines in display units", () => {
    expect(formatToolpathGridLabel(3, "mm")).toBe("30");
    expect(formatToolpathGridLabel(-2, "mm")).toBe("-20");
    expect(formatToolpathGridLabel(-0, "mm")).toBe("0");
    expect(formatToolpathGridLabel(4, "in")).toBe("4");
  });

  it("thins labels on a 1-2-5 progression", () => {
    expect(labelStride(50, 40)).toBe(1);
    expect(labelStride(30, 40)).toBe(2);
    expect(labelStride(10, 40)).toBe(5);
    expect(labelStride(5, 40)).toBe(10);
    expect(labelStride(1, 40)).toBe(50);
  });

  it("builds one label per major step and a minor tick between each", () => {
    const grid = createToolpathGrid({ bounds: box(3, 2, 47, 18), units: "mm", theme: defaultGCodeViewerTheme });
    // X: 0..50 (6 lines), Y: 0..20 (3 lines).
    const xLabels = grid.labels.filter((l) => l.axis === "x");
    const yLabels = grid.labels.filter((l) => l.axis === "y");
    expect(xLabels.map((l) => l.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(yLabels.map((l) => l.index)).toEqual([0, 1, 2]);
    // Minor ticks: 5 on X + 2 on Y, 2 vertices each.
    expect(vertexCount(grid.minorTicks)).toBe((5 + 2) * 2);
    disposeToolpathGrid(grid);
  });

  it("frames the grid with its ticks and pixel-sized labels", () => {
    const grid = createToolpathGrid({ bounds: box(0, 0, 50, 20), units: "mm", theme: defaultGCodeViewerTheme });
    const { box: frame, paddingPx } = toolpathGridFrame(grid, 13);
    // Ticks hang off the min edges only.
    expect(frame.minX).toBeCloseTo(-grid.majorTick);
    expect(frame.minY).toBeCloseTo(-grid.majorTick);
    expect(frame.maxX).toBe(50);
    expect(frame.maxY).toBe(20);
    // Labels sit left and below; they overhang the far edges by half a label.
    expect(paddingPx.bottom).toBe(4 + 13);
    expect(paddingPx.top).toBe(6.5);
    expect(paddingPx.left).toBeGreaterThan(paddingPx.right);
    disposeToolpathGrid(grid);
  });

  it("scales labels to screen pixels and hides crowded detail", () => {
    const grid = createToolpathGrid({ bounds: box(0, 0, 500, 500), units: "mm", theme: defaultGCodeViewerTheme });
    // 1 world mm per px: 10 px per step.
    updateToolpathGridScale(grid, 1, 13);
    expect(grid.labels[0].object.scale.x).toBe(13);
    expect(grid.minorTicks.visible).toBe(true);
    const visible = grid.labels.filter((l) => l.axis === "x" && l.object.visible).map((l) => l.index);
    expect(visible.every((i) => i % 5 === 0)).toBe(true);
    // Zoomed far out: minor ticks and plain major lines go.
    updateToolpathGridScale(grid, 5, 13);
    expect(grid.minorTicks.visible).toBe(false);
    expect(grid.majorLines.visible).toBe(false);
    disposeToolpathGrid(grid);
  });
});
