import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createPrecomputedToolpath,
  disposePrecomputedToolpath,
  precomputedBounds,
  precomputedGroupPositions,
  type PrecomputedSegmentGroup,
} from "../src/viewer/toolpath/precomputed";

function group2d(hexColor: string, opacity: number, verts: number[]): PrecomputedSegmentGroup {
  const data = new Float32Array(verts);
  return { hexColor, opacity, positionsBuffer: data.buffer, positionsLen: data.length, stride: 4 };
}

describe("precomputedGroupPositions", () => {
  it("expands stride-4 2D segments to xyz with z = 0", () => {
    const positions = precomputedGroupPositions(group2d("#fff", 1, [1, 2, 3, 4, 5, 6, 7, 8]));
    expect(Array.from(positions)).toEqual([1, 2, 0, 3, 4, 0, 5, 6, 0, 7, 8, 0]);
  });

  it("views stride-6 data without copying", () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 99]);
    const positions = precomputedGroupPositions({
      hexColor: "#fff",
      opacity: 1,
      positionsBuffer: data.buffer,
      positionsLen: 6,
      stride: 6,
    });
    expect(positions.buffer).toBe(data.buffer);
    expect(Array.from(positions)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("honours positionsLen over a larger buffer", () => {
    const data = new Float32Array([1, 1, 2, 2, 9, 9, 9, 9]);
    const positions = precomputedGroupPositions({
      hexColor: "#fff",
      opacity: 1,
      positionsBuffer: data.buffer,
      positionsLen: 4,
      stride: 4,
    });
    expect(positions.length).toBe(6);
  });
});

describe("precomputedBounds", () => {
  it("returns null with no vertices", () => {
    expect(precomputedBounds([])).toBeNull();
    expect(precomputedBounds([new Float32Array(0)])).toBeNull();
  });

  it("spans every group", () => {
    const bounds = precomputedBounds([
      new Float32Array([-5, 2, 0, 3, 4, 0]),
      new Float32Array([10, -1, 0, 0, 0, 0]),
    ])!;
    expect(bounds.min.toArray()).toEqual([-5, -1, 0]);
    expect(bounds.max.toArray()).toEqual([10, 4, 0]);
  });

  it("takes Z from meta for flattened data", () => {
    const bounds = precomputedBounds([new Float32Array([0, 0, 0, 1, 1, 0])], { minZ: -12.7, maxZ: 5 })!;
    expect(bounds.min.z).toBeCloseTo(-12.7);
    expect(bounds.max.z).toBe(5);
  });
});

describe("createPrecomputedToolpath", () => {
  it("builds one LineSegments per non-empty group with its colour and opacity", () => {
    const parent = new THREE.Group();
    const { state, bounds } = createPrecomputedToolpath({
      groups: [
        group2d("#3f85c7", 1, [0, 0, 10, 0]),
        group2d("#059669", 0.35, [0, 0, 0, 20]),
        group2d("#ff0000", 1, []),
      ],
      meta: { minZ: -3, maxZ: 1 },
      parent,
    });
    expect(parent.children).toContain(state.group);
    expect(state.lines).toHaveLength(2);

    const [cut, rapid] = state.lines;
    const cutMat = cut.material as THREE.LineBasicMaterial;
    const rapidMat = rapid.material as THREE.LineBasicMaterial;
    expect(cutMat.color.getHexString()).toBe("3f85c7");
    expect(cutMat.transparent).toBe(false);
    expect(rapidMat.opacity).toBeCloseTo(0.35);
    expect(rapidMat.transparent).toBe(true);
    expect(rapid.renderOrder).toBeGreaterThan(cut.renderOrder);

    expect(bounds!.max.x).toBe(10);
    expect(bounds!.max.y).toBe(20);
    expect(bounds!.min.z).toBe(-3);

    disposePrecomputedToolpath(parent, state);
    expect(parent.children).not.toContain(state.group);
    expect(state.lines).toHaveLength(0);
  });
});
