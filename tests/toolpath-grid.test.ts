import * as THREE from "three";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createToolpathGrid,
  disposeToolpathGrid,
  formatToolpathGridLabel,
  labelStride,
  toolpathGridExtent,
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

  it("snaps the extent outward and pads one step", () => {
    expect(toolpathGridExtent(box(3, -12, 87, 40), 10)).toEqual({ minX: -10, maxX: 100, minY: -30, maxY: 50 });
    // Already on a step: still padded by exactly one.
    expect(toolpathGridExtent(box(0, 0, 50, 20), 10)).toEqual({ minX: -10, maxX: 60, minY: -10, maxY: 30 });
    const inch = toolpathGridExtent(box(0, 0, 60, 10), 25.4);
    expect(inch.minX).toBeCloseTo(-25.4);
    expect(inch.maxX).toBeCloseTo(101.6);
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
    // X: -10..60 (8 lines), Y: -10..30 (5 lines).
    const xLabels = grid.labels.filter((l) => l.axis === "x");
    const yLabels = grid.labels.filter((l) => l.axis === "y");
    expect(xLabels.map((l) => l.index)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6]);
    expect(yLabels.map((l) => l.index)).toEqual([-1, 0, 1, 2, 3]);
    // Minor ticks: 7 on X + 4 on Y, 2 vertices each.
    expect(vertexCount(grid.minorTicks)).toBe((7 + 4) * 2);
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
