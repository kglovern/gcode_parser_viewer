import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildLaserGeometryFromLinesBatched } from "../src/geometry";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("buildLaserGeometryFromLinesBatched", () => {
  it("tracks per-line prefix vertex counts for rapid and buckets", async () => {
    const lines = [
      "G21",
      "G90",
      "G0 X1 Y0 Z0",
      "G1 X2 Y0 S1000",
      "G1 X3 Y0 S500",
    ];

    const result = await buildLaserGeometryFromLinesBatched(lines, { bucketCount: 4, arcSegments: 5 });

    expect(result.rapidPrefixEndVertex.length).toBe(lines.length);
    expect(result.buckets.length).toBe(4);
    for (const bucket of result.buckets) {
      expect(bucket.prefixEndVertex.length).toBe(lines.length);
      expect(bucket.positions.length % 6).toBe(0);
    }

    const rapidTotalVertices = result.rapidPositions.length / 3;
    expect(result.rapidPrefixEndVertex[result.rapidPrefixEndVertex.length - 1]).toBe(rapidTotalVertices);

    for (let i = 1; i < result.rapidPrefixEndVertex.length; i += 1) {
      expect(result.rapidPrefixEndVertex[i]).toBeGreaterThanOrEqual(result.rapidPrefixEndVertex[i - 1]);
    }
    for (const bucket of result.buckets) {
      for (let i = 1; i < bucket.prefixEndVertex.length; i += 1) {
        expect(bucket.prefixEndVertex[i]).toBeGreaterThanOrEqual(bucket.prefixEndVertex[i - 1]);
      }
    }
  });
});
