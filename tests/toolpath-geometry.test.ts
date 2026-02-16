import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildToolpathGeometryFromLinesBatched } from "../src/geometry";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("buildToolpathGeometryFromLinesBatched", () => {
  it("emits rapid + one cut stream in non-laser mode", async () => {
    const lines = ["G21", "G90", "G0 X1", "G1 X2", "G2 X3 Y0 I0.5 J0"];
    const result = await buildToolpathGeometryFromLinesBatched(lines, { laserMode: false, arcSegments: 4 });

    expect(result.cutBucketCount).toBe(1);
    expect(result.rapid.prefixEndVertex.length).toBe(lines.length);
    expect(result.cuts).toHaveLength(1);
    expect(result.cuts[0].prefixEndVertex.length).toBe(lines.length);
    expect(result.rapid.positions.length % 6).toBe(0);
    expect(result.cuts[0].positions.length % 6).toBe(0);
  });

  it("hides G1/G2 segments when laser is off", async () => {
    const lines = [
      "G21",
      "G90",
      "G0 X1",
      "M3 S0",
      "G1 X2",
      "M3 S500",
      "G1 X3",
      "M5",
      "G1 X4",
      "M4 S1000",
      "G2 X5 Y0 I0.5 J0",
    ];

    const result = await buildToolpathGeometryFromLinesBatched(lines, { laserMode: true, bucketCount: 4, arcSegments: 4 });

    const totalCutVertices = result.cuts.reduce((sum, stream) => sum + stream.positions.length / 3, 0);
    expect(totalCutVertices).toBeGreaterThan(0);

    const cutPrefixAtOffG1 = result.cuts.reduce((sum, stream) => sum + stream.prefixEndVertex[4], 0);
    const cutPrefixAfterOnG1 = result.cuts.reduce((sum, stream) => sum + stream.prefixEndVertex[6], 0);
    const cutPrefixAfterM5G1 = result.cuts.reduce((sum, stream) => sum + stream.prefixEndVertex[8], 0);
    const cutPrefixAfterArcOn = result.cuts.reduce((sum, stream) => sum + stream.prefixEndVertex[10], 0);

    expect(cutPrefixAtOffG1).toBe(0);
    expect(cutPrefixAfterOnG1).toBeGreaterThan(0);
    expect(cutPrefixAfterM5G1).toBe(cutPrefixAfterOnG1);
    expect(cutPrefixAfterArcOn).toBeGreaterThan(cutPrefixAfterM5G1);
  });

  it("assumes laser on at 100% when no spindle commands are present", async () => {
    const lines = ["G21", "G90", "G0 X1", "G1 X2", "G1 X3", "G2 X4 Y0 I0.5 J0"];
    const result = await buildToolpathGeometryFromLinesBatched(lines, { laserMode: true, bucketCount: 8, arcSegments: 4 });

    const totalCutVertices = result.cuts.reduce((sum, stream) => sum + stream.positions.length / 3, 0);
    expect(totalCutVertices).toBeGreaterThan(0);
  });
});
