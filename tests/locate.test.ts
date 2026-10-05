import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { WorkerSegmentsData } from "../src/types";
import { GCodeViewer } from "../src/viewer/GCodeViewer";
import {
  advanceRunProgress,
  createRunProgressState,
  defaultLocateOptions,
  locateOnSegments,
  segmentsLineForVertex,
  segmentsLineStartVertex,
} from "../src/viewer/toolpath/locate";
import { createSegmentsToolpath } from "../src/viewer/toolpath/segments";
import { defaultGCodeViewerOptions } from "../src/viewer/types";

type P = [number, number, number];

// Segments as [from, to] pairs, split into chunks of the given segment counts.
function data(segments: [P, P][], prefixEndVertex: number[], chunkSegments = [segments.length]): WorkerSegmentsData {
  const chunks = [];
  let i = 0;
  for (const n of chunkSegments) {
    const part = segments.slice(i, i + n);
    i += n;
    chunks.push({
      positions: new Float32Array(part.flatMap(([a, b]) => [...a, ...b])).buffer,
      attrs: new Uint8Array(part.length * 2).buffer,
      vertexCount: part.length * 2,
    });
  }
  return {
    format: "segments-v1",
    chunks,
    totalVertices: segments.length * 2,
    prefixEndVertex: new Uint32Array(prefixEndVertex).buffer,
  };
}

function load(d: WorkerSegmentsData) {
  return createSegmentsToolpath({ data: d, options: defaultGCodeViewerOptions, parent: new THREE.Group() }).state;
}

// A square pocket pass at z=-1 then the same square at z=-2, one line per side;
// line 0 is the plunge from z=5.
const square = (z: number): [P, P][] => [
  [[0, 0, z], [10, 0, z]],
  [[10, 0, z], [10, 10, z]],
  [[10, 10, z], [0, 10, z]],
  [[0, 10, z], [0, 0, z]],
];
const twoPasses = (): WorkerSegmentsData =>
  data(
    [[[0, 0, 5], [0, 0, -1]], ...square(-1), [[0, 0, -1], [0, 0, -2]], ...square(-2)],
    [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    [6, 4] // chunk boundary inside the second pass
  );

describe("locateOnSegments", () => {
  it("returns the fractional vertex position along the closest segment", () => {
    const state = load(twoPasses());
    const hit = locateOnSegments(state, { x: 2.5, y: 0, z: -1 }, 0, 20);
    expect(hit?.vertex).toBeCloseTo(2 + 0.5); // segment 1, a quarter along
    expect(hit?.distance).toBeCloseTo(0);
  });

  it("tells passes at the same XY apart by Z", () => {
    const state = load(twoPasses());
    expect(locateOnSegments(state, { x: 10, y: 5, z: -2 }, 0, 20)?.vertex).toBeCloseTo(14 + 1);
    expect(locateOnSegments(state, { x: 10, y: 5, z: -1 }, 0, 20)?.vertex).toBeCloseTo(4 + 1);
  });

  it("prefers the earlier segment on a shared endpoint", () => {
    const state = load(twoPasses());
    // (10,0,-1) ends segment 1 and starts segment 2: the same position either way.
    expect(locateOnSegments(state, { x: 10, y: 0, z: -1 }, 0, 20)?.vertex).toBeCloseTo(4);
  });

  it("only searches the window, including the segment ending at its start", () => {
    const state = load(twoPasses());
    expect(locateOnSegments(state, { x: 10, y: 5, z: -1 }, 8, 20)).toBeNull();
    expect(locateOnSegments(state, { x: 10, y: 5, z: -2 }, 0, 12)).toBeNull();
    expect(locateOnSegments(state, { x: 10, y: 10, z: -1 }, 6, 20)?.vertex).toBeCloseTo(6);
  });

  it("finds segments across a chunk boundary", () => {
    const state = load(twoPasses());
    // Segment 6 (vertices 12-13) is the first of chunk 1.
    expect(locateOnSegments(state, { x: 5, y: 0, z: -2 }, 10, 20)?.vertex).toBeCloseTo(13);
  });

  it("rejects a bit off the toolpath, allowing more on long (chord) segments", () => {
    const state = load(twoPasses());
    expect(locateOnSegments(state, { x: 5, y: 5, z: -1 }, 0, 20)).toBeNull();
    // 10 mm segments allow 0.5 + 0.35 mm.
    expect(locateOnSegments(state, { x: 5, y: 0.8, z: -1 }, 0, 20)).not.toBeNull();
    expect(locateOnSegments(state, { x: 5, y: 0.9, z: -1 }, 0, 20)).toBeNull();
    expect(
      locateOnSegments(state, { x: 5, y: 0.2, z: -1 }, 0, 20, { ...defaultLocateOptions, tolerance: 0.1, tolerancePerLength: 0 })
    ).toBeNull();
  });
});

describe("line/vertex helpers", () => {
  it("maps between lines and vertex positions", () => {
    const state = load(data(square(0), [2, 2, 4, 6, 8])); // line 1 has no geometry
    expect(segmentsLineStartVertex(state, 0)).toBe(0);
    expect(segmentsLineStartVertex(state, 3)).toBe(4);
    expect(segmentsLineForVertex(state, 0)).toBe(0);
    expect(segmentsLineForVertex(state, 1.5)).toBe(0);
    expect(segmentsLineForVertex(state, 2)).toBe(2);
    expect(segmentsLineForVertex(state, 7.9)).toBe(4);
    expect(segmentsLineForVertex(state, 8)).toBe(4);
  });
});

describe("advanceRunProgress", () => {
  const args = { minLine: 0, fallbackAfterMisses: 3, locate: defaultLocateOptions };

  it("follows the bit and ends the planned span with the planned line", () => {
    const state = load(twoPasses());
    const run = createRunProgressState();
    const r = advanceRunProgress(state, run, { x: 10, y: 5, z: -1 }, { ...args, plannedLine: 4 });
    expect(r).toMatchObject({ located: true, plannedEndVertex: 10 });
    expect(r.cursorVertex).toBeCloseTo(5);
  });

  it("never moves backwards and never searches past the planned line", () => {
    const state = load(twoPasses());
    const run = createRunProgressState();
    advanceRunProgress(state, run, { x: 10, y: 5, z: -1 }, { ...args, plannedLine: 9 });
    // Back on the first side: below the boundary, so not found; boundary holds.
    const back = advanceRunProgress(state, run, { x: 5, y: 0, z: -1 }, { ...args, plannedLine: 9 });
    expect(back.located).toBe(false);
    expect(back.cursorVertex).toBeCloseTo(5);
    // On the second pass, but that line has not been sent yet.
    const ahead = advanceRunProgress(state, run, { x: 10, y: 5, z: -2 }, { ...args, plannedLine: 5 });
    expect(ahead.located).toBe(false);
    expect(ahead.cursorVertex).toBeCloseTo(5);
  });

  it("starts a start-from-line run at its first line", () => {
    const state = load(twoPasses());
    const run = createRunProgressState();
    // Approach move: bit away from the toolpath.
    const r = advanceRunProgress(state, run, { x: 50, y: 50, z: 5 }, { ...args, minLine: 6, plannedLine: 7 });
    expect(r).toMatchObject({ located: false, cursorVertex: 12 });
  });

  it("falls back to the line-based edge after enough misses, then resumes locating", () => {
    const state = load(twoPasses());
    const run = createRunProgressState();
    const off = { x: 50, y: 50, z: 5 };
    const call = (p = off) => advanceRunProgress(state, run, p, { ...args, plannedLine: 9, fallbackLine: 4 });
    expect(call().cursorVertex).toBe(0);
    expect(call().cursorVertex).toBe(0);
    expect(call().cursorVertex).toBe(10); // third miss: through line 4
    const back = call({ x: 10, y: 5, z: -2 });
    expect(back.located).toBe(true);
    expect(back.cursorVertex).toBeCloseTo(15);
    expect(run.misses).toBe(0);
  });
});

describe("GCodeViewer.trackRunProgress", () => {
  function viewer() {
    const v = Object.create(GCodeViewer.prototype);
    Object.assign(v, {
      toolpathRoot: new THREE.Group(),
      toolpathStreams: [],
      segmentsToolpath: null,
      toolpathRotationA: 0,
      options: defaultGCodeViewerOptions,
      runProgress: createRunProgressState(),
      lastBitPosition: { x: 0, y: 0, z: 0, a: 0 },
      setSim3dHandle: vi.fn(),
      emitBoundsChanged: vi.fn(),
      refreshBoundingBox: vi.fn(),
      emitProgress: vi.fn(),
    });
    return v;
  }
  const uniforms = (v: GCodeViewer, key: "uSegCursor" | "uSegPlannedEnd") =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (v as any).segmentsToolpath.chunks.map((c: any) => c.uniforms[key].value);

  it("greys up to the bit and plans through the sent line, per chunk", async () => {
    const v = viewer();
    await v.loadFromSegments(twoPasses());
    v.lastBitPosition = { x: 5, y: 0, z: -2, a: 0 };
    expect(v.trackRunProgress({ plannedLine: 7, mode: "grey" })).toEqual({ located: true, line: 6 });
    const cursor = uniforms(v, "uSegCursor");
    expect(cursor[0]).toBe(12);
    expect(cursor[1]).toBeCloseTo(1);
    expect(uniforms(v, "uSegPlannedEnd")).toEqual([12, 4]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((v as any).segmentsToolpath.shared.uSegPlannedSpan.value).toBeCloseTo(16 - 13);
  });

  it("starts over after resetColors and after a new load", async () => {
    const v = viewer();
    await v.loadFromSegments(twoPasses());
    v.lastBitPosition = { x: 10, y: 5, z: -2, a: 0 };
    v.trackRunProgress({ plannedLine: 9 });
    v.resetColors();
    v.lastBitPosition = { x: 10, y: 5, z: -1, a: 0 };
    expect(v.trackRunProgress({ plannedLine: 9 }).line).toBe(2);
    await v.loadFromSegments(twoPasses());
    v.lastBitPosition = { x: 0, y: 0, z: 0, a: 0 };
    expect(v.trackRunProgress({ plannedLine: 9 })).toEqual({ located: true, line: 0 });
  });

  it("locates a rotary bit in the toolpath's unrotated frame", async () => {
    const v = viewer();
    await v.loadFromSegments({ ...twoPasses(), rotary: { axis: "X", centerlineZ: 0 } });
    v.setToolpathRotationA(90);
    // Where (10, 5, -1) on the A=0 toolpath is in machine coordinates at A=90.
    v.toolpathRoot.updateMatrix();
    const machine = new THREE.Vector3(10, 5, -1).applyMatrix4(v.toolpathRoot.matrix);
    v.lastBitPosition = { x: machine.x, y: machine.y, z: machine.z, a: 90 };
    expect(v.trackRunProgress({ plannedLine: 9 })).toEqual({ located: true, line: 2 });
  });

  it("falls back to lines for toolpaths that can't be searched", () => {
    const v = viewer();
    expect(v.trackRunProgress({ plannedLine: 9, fallbackLine: 3 })).toEqual({ located: false, line: 3 });
  });
});
