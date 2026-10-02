import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GCodeViewer } from "../src/viewer/GCodeViewer";
import { defaultGCodeViewerOptions } from "../src/viewer/types";
import type { WorkerSegmentsData } from "../src/types";

// Exercise real loading, scene transforms and disposal without a WebGL canvas.
function viewerFixture() {
  const viewer = Object.create(GCodeViewer.prototype);
  Object.assign(viewer, {
    toolpathRoot: new THREE.Group(), toolpathStreams: [], segmentsToolpath: null,
    toolpathRotationA: 0, options: defaultGCodeViewerOptions,
    setSim3dHandle: vi.fn(), emitBoundsChanged: vi.fn(), refreshBoundingBox: vi.fn(),
    emitProgress: vi.fn(),
  });
  return viewer;
}
function payload(rotary?: WorkerSegmentsData["rotary"]): WorkerSegmentsData {
  return { format: "segments-v1", rotary,
    chunks: [{ positions: new Float32Array([0, 0, 0, 3, 20, -2]).buffer,
      attrs: new Uint8Array([0, 0]).buffer, vertexCount: 2 }],
    totalVertices: 2, prefixEndVertex: new Uint32Array([2]).buffer };
}
function near(actual: THREE.Vector3, expected: THREE.Vector3) {
  expect(actual.distanceTo(expected)).toBeLessThan(1e-9);
}
describe("RotatoCAM rotary work coordinates", () => {
  it.each(["X", "Y"] as const)("round-trips indexed and simultaneous %s positions", async (axis) => {
    const v = viewerFixture(), data = payload({ axis, centerlineZ: -10 });
    const original = new Float32Array(data.chunks[0].positions).slice();
    await v.loadFromSegments(data);
    const center = new THREE.Vector3(0, 0, -10);
    const rotationAxis = new THREE.Vector3(axis === "X" ? 1 : 0, axis === "Y" ? 1 : 0, 0);
    for (const degrees of [0, 0.0005, 90, -90, 180, 270, 360, 720]) {
      const machine = new THREE.Vector3(3, 20, -2);
      const stock = machine.clone().sub(center).applyAxisAngle(rotationAxis, -degrees * Math.PI / 180).add(center);
      v.setToolpathRotationA(degrees);
      v.toolpathRoot.updateMatrix();
      near(stock.applyMatrix4(v.toolpathRoot.matrix), machine);
      near(center.clone().applyMatrix4(v.toolpathRoot.matrix), center);
    }
    expect(new Float32Array(data.chunks[0].positions)).toEqual(original);
  });
  it("adopts metadata per load, resets on unload, and retains legacy X defaults", async () => {
    const v = viewerFixture();
    await v.loadFromSegments(payload({ axis: "Y", centerlineZ: -10 }));
    v.setToolpathRotationA(90);
    await v.loadFromSegments(payload());
    expect(v.toolpathRoot.rotation.y).toBe(0);
    expect(v.toolpathRoot.rotation.x).toBeCloseTo(Math.PI / 2);
    near(v.toolpathRoot.position, new THREE.Vector3());
    await v.loadFromSegments(payload({ axis: "Y", centerlineZ: -10 }));
    v.unload();
    near(v.toolpathRoot.position, new THREE.Vector3());
    expect(v.toolpathRoot.rotation.y).toBe(0);
  });
  it("rejects non-finite display values", async () => {
    const v = viewerFixture();
    await v.loadFromSegments(payload({ axis: "Y", centerlineZ: Infinity }));
    v.setToolpathRotationA(NaN);
    near(v.toolpathRoot.position, new THREE.Vector3());
    expect(v.toolpathRoot.rotation.y).toBe(0);
  });
});
