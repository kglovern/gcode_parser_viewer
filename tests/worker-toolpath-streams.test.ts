import { buildWorkerToolpathStreams } from "../src/geometry";
import type { LineRangeGroup, WorkerGeometryData } from "../src/types";

/**
 * One source line of a synthetic worker payload. `vertices` is how many points
 * the line contributed; a line needs at least two to emit any segment, so
 * `vertices: 1` models a non-motion line (a comment, an M6, the preamble).
 */
type FixtureLine = { kind: "rapid" | "cut"; vertices: number };

/**
 * Builds a `WorkerGeometryData` whose vertex X coordinate *is* the global vertex
 * index, so a stream's contents can be read back as the exact list of source
 * vertices that landed in it.
 */
function buildWorkerData(lines: readonly FixtureLine[]): WorkerGeometryData {
  const positions: number[] = [];
  const colors: number[] = [];
  const frames: number[] = [];

  for (const line of lines) {
    frames.push(positions.length / 3);
    // buildWorkerToolpathStreams routes a whole line by its first vertex's
    // alpha, matching how the worker dims rapid moves.
    const alpha = line.kind === "rapid" ? 0.3 : 1;
    for (let i = 0; i < line.vertices; i++) {
      positions.push(positions.length / 3, 0, 0);
      colors.push(0.1, 0.2, 0.3, alpha);
    }
  }

  return {
    vertices: new Float32Array(positions).buffer,
    frames: new Uint32Array(frames).buffer,
    colorArrayBuffer: new Float32Array(colors).buffer,
    verticesLen: positions.length,
    framesLen: frames.length,
    colorLen: colors.length,
  };
}

/** The vertex indices a stream holds, in order. */
function vertexIds(positions: Float32Array): number[] {
  return Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3]);
}

/**
 * Line 0 is an ungrouped rapid preamble and line 3 an ungrouped cut between the
 * two groups, so both catch-all streams are non-empty and testable.
 *
 *   line 0  rapid  3 verts   ungrouped
 *   line 1  rapid  3 verts   group 0
 *   line 2  cut    4 verts   group 0
 *   line 3  cut    3 verts   ungrouped
 *   line 4  rapid  2 verts   group 1
 *   line 5  cut    3 verts   group 1
 *   line 6  cut    1 vert    group 1  (no segments)
 */
const FIXTURE: FixtureLine[] = [
  { kind: "rapid", vertices: 3 },
  { kind: "rapid", vertices: 3 },
  { kind: "cut", vertices: 4 },
  { kind: "cut", vertices: 3 },
  { kind: "rapid", vertices: 2 },
  { kind: "cut", vertices: 3 },
  { kind: "cut", vertices: 1 },
];

const GROUPS: LineRangeGroup[] = [
  { start: 1, end: 2 },
  { start: 4, end: 6 },
];

describe("buildWorkerToolpathStreams", () => {
  describe("without lineGroups", () => {
    it("emits exactly one rapid and one cut stream, both ungrouped", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE));

      expect(rapids).toHaveLength(1);
      expect(cuts).toHaveLength(1);
      expect(rapids[0].lineGroupIndex).toBeNull();
      expect(cuts[0].lineGroupIndex).toBeNull();
      expect(rapids[0].prefixEndVertex.length).toBe(FIXTURE.length);
      expect(cuts[0].prefixEndVertex.length).toBe(FIXTURE.length);
    });

    it("keeps every line's vertices in source order", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE));

      // Lines 0, 1 and 4 are rapid; each contributes (n - 1) two-vertex segments.
      expect(vertexIds(rapids[0].positions)).toEqual([
        0, 1, 1, 2, // line 0
        3, 4, 4, 5, // line 1
        13, 14, // line 4
      ]);
      // Lines 2, 3 and 5 are cut; line 6 has a single vertex and emits nothing.
      expect(vertexIds(cuts[0].positions)).toEqual([
        6, 7, 7, 8, 8, 9, // line 2
        10, 11, 11, 12, // line 3
        15, 16, 16, 17, // line 5
      ]);
    });

    it("treats an empty lineGroups array the same as passing none", () => {
      const data = buildWorkerData(FIXTURE);
      const withOption = buildWorkerToolpathStreams(data, { lineGroups: [] });
      const without = buildWorkerToolpathStreams(data);

      expect(withOption.rapids).toHaveLength(1);
      expect(withOption.cuts).toHaveLength(1);
      expect(vertexIds(withOption.rapids[0].positions)).toEqual(vertexIds(without.rapids[0].positions));
      expect(vertexIds(withOption.cuts[0].positions)).toEqual(vertexIds(without.cuts[0].positions));
    });
  });

  describe("with lineGroups", () => {
    it("emits a stream pair per group plus an ungrouped catch-all", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), { lineGroups: GROUPS });

      expect(rapids.map((s) => s.lineGroupIndex)).toEqual([0, 1, null]);
      expect(cuts.map((s) => s.lineGroupIndex)).toEqual([0, 1, null]);
    });

    it("routes each line's vertices to the group that covers it", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), { lineGroups: GROUPS });

      expect(vertexIds(rapids[0].positions)).toEqual([3, 4, 4, 5]); // line 1
      expect(vertexIds(cuts[0].positions)).toEqual([6, 7, 7, 8, 8, 9]); // line 2
      expect(vertexIds(rapids[1].positions)).toEqual([13, 14]); // line 4
      expect(vertexIds(cuts[1].positions)).toEqual([15, 16, 16, 17]); // line 5
    });

    it("puts lines outside every group in the always-visible catch-all", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), { lineGroups: GROUPS });

      expect(vertexIds(rapids[2].positions)).toEqual([0, 1, 1, 2]); // line 0, the preamble
      expect(vertexIds(cuts[2].positions)).toEqual([10, 11, 11, 12]); // line 3
    });

    it("loses and duplicates nothing relative to the ungrouped build", () => {
      const data = buildWorkerData(FIXTURE);
      const grouped = buildWorkerToolpathStreams(data, { lineGroups: GROUPS });
      const flat = buildWorkerToolpathStreams(data);

      // The groups are ascending and non-overlapping, so gathering every stream's
      // vertices and sorting must reproduce the flat stream exactly.
      const gather = (streams: { positions: Float32Array }[]) =>
        streams.flatMap((s) => vertexIds(s.positions)).sort((a, b) => a - b);

      expect(gather(grouped.rapids)).toEqual(gather(flat.rapids));
      expect(gather(grouped.cuts)).toEqual(gather(flat.cuts));
    });

    it("carries prefixEndVertex forward per group", () => {
      const { cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), { lineGroups: GROUPS });

      // Group 1's cuts come from line 5 only, so its cursor is 0 through line 4,
      // jumps on line 5, and holds flat afterwards — the carry-forward that keeps
      // progress greying correct inside a stream that spans only part of the file.
      const group1 = cuts[1].prefixEndVertex;
      expect(Array.from(group1)).toEqual([0, 0, 0, 0, 0, 4, 4]);

      // And group 0's holds flat once its own range ends.
      const group0 = cuts[0].prefixEndVertex;
      expect(Array.from(group0)).toEqual([0, 0, 6, 6, 6, 6, 6]);
    });

    it("ends every stream's cursor at its own total vertex count", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), { lineGroups: GROUPS });

      for (const stream of [...rapids, ...cuts]) {
        const last = stream.prefixEndVertex[stream.prefixEndVertex.length - 1];
        expect(last).toBe(stream.positions.length / 3);
      }
    });
  });

  describe("degenerate groups", () => {
    it("gives an overlapping line to the first group that claims it", () => {
      const { cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), {
        lineGroups: [
          { start: 2, end: 5 },
          { start: 3, end: 5 },
        ],
      });

      // Lines 3 and 5 are claimed by both; group 0 wins, so group 1 is empty.
      expect(vertexIds(cuts[0].positions)).toEqual([6, 7, 7, 8, 8, 9, 10, 11, 11, 12, 15, 16, 16, 17]);
      expect(cuts[1].positions).toHaveLength(0);
    });

    it("clamps a group that runs past the end of the file", () => {
      const { cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), {
        lineGroups: [{ start: 5, end: 9999 }],
      });

      expect(vertexIds(cuts[0].positions)).toEqual([15, 16, 16, 17]);
      expect(cuts[0].prefixEndVertex.length).toBe(FIXTURE.length);
    });

    it("yields an empty stream for a group entirely past the end of the file", () => {
      const { rapids, cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), {
        lineGroups: [{ start: 50, end: 60 }],
      });

      expect(rapids[0].positions).toHaveLength(0);
      expect(cuts[0].positions).toHaveLength(0);
      // Everything therefore falls to the catch-all.
      expect(vertexIds(cuts[1].positions)).toEqual([6, 7, 7, 8, 8, 9, 10, 11, 11, 12, 15, 16, 16, 17]);
    });

    it("ignores a group whose end precedes its start", () => {
      const { cuts } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), {
        lineGroups: [{ start: 5, end: 2 }],
      });

      expect(cuts[0].positions).toHaveLength(0);
      expect(vertexIds(cuts[1].positions)).toEqual([6, 7, 7, 8, 8, 9, 10, 11, 11, 12, 15, 16, 16, 17]);
    });

    it("clamps a negative start", () => {
      const { rapids } = buildWorkerToolpathStreams(buildWorkerData(FIXTURE), {
        lineGroups: [{ start: -10, end: 0 }],
      });

      expect(vertexIds(rapids[0].positions)).toEqual([0, 1, 1, 2]);
    });
  });
});
