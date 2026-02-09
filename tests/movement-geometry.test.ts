import { buildMovementGeometryFromLinesBatched } from "../src/threejs-core";

describe("buildMovementGeometryFromLinesBatched", () => {
  it("emits file-ordered vertices with per-line ranges", async () => {
    const lines = [
      "G21",
      "G90",
      "G0 X1 Y0 Z0",
      "G1 X10 Y0",
      "G2 X20 Y0 I5 J0",
    ];

    const result = await buildMovementGeometryFromLinesBatched(lines, { arcSegments: 5 });

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.positions.length % 6).toBe(0);

    const totalVertices = result.positions.length / 3;
    expect(result.prefixEndVertex.length).toBe(lines.length);
    expect(result.prefixEndVertex[result.prefixEndVertex.length - 1]).toBe(totalVertices);

    for (let i = 1; i < result.prefixEndVertex.length; i += 1) {
      expect(result.prefixEndVertex[i]).toBeGreaterThanOrEqual(result.prefixEndVertex[i - 1]);
      expect(result.prefixEndVertex[i] % 2).toBe(0);
    }

    expect(result.lineKind[2]).toBe(1); // rapid
    expect(result.lineEndVertex[2] - result.lineStartVertex[2]).toBe(2); // 1 segment -> 2 vertices

    expect(result.lineKind[3]).toBe(2); // cut
    expect(result.lineEndVertex[3] - result.lineStartVertex[3]).toBe(2);

    expect(result.lineKind[4]).toBe(2); // arc is also cut
    expect(result.lineEndVertex[4] - result.lineStartVertex[4]).toBe(10); // 5 segments -> 10 vertices
  });
});
