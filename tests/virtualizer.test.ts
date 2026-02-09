import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GCodeVirtualizer } from "../src/virtualizer";

type Position = {
  X: number;
  Y: number;
  Z: number;
  A: number;
  B: number;
  C: number;
};

const fixturePath = join(__dirname, "..", "fixtures", "sample.gcode");

describe("GCodeVirtualizer", () => {
  it("tracks modals and linear moves from fixture", () => {
    const linearMoves: Array<{ start: Record<string, number>; end: Record<string, number> }> = [];
    const virtualizer = new GCodeVirtualizer({
      onLinearMove: (payload) => linearMoves.push({ start: payload.start, end: payload.end }),
    });

    const lines = readFileSync(fixturePath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      virtualizer.processLine(line);
    }

    const modals = virtualizer.getModals();
    const position = virtualizer.getPosition();

    expect(modals.units).toBe("G21");
    expect(modals.distance).toBe("G91");
    expect(modals.motion).toBe("G0");
    expect(position.X).toBe(18);
    expect(position.Y).toBe(3);
    expect(position.Z).toBe(3.5);
    expect(linearMoves.length).toBeGreaterThan(0);
  });

  it("converts G20 inch coordinates to mm", () => {
    const virtualizer = new GCodeVirtualizer();
    virtualizer.processLine("G20");
    virtualizer.processLine("G90");
    virtualizer.processLine("G0 X1 Y2 Z0.5");

    const position = virtualizer.getPosition();
    expect(position.X).toBeCloseTo(25.4, 6);
    expect(position.Y).toBeCloseTo(50.8, 6);
    expect(position.Z).toBeCloseTo(12.7, 6);
  });

  it("converts G20 inch deltas to mm in G91", () => {
    const virtualizer = new GCodeVirtualizer();
    virtualizer.processLine("G20");
    virtualizer.processLine("G91");
    virtualizer.processLine("G0 X1");
    virtualizer.processLine("G0 X0.5");

    const position = virtualizer.getPosition();
    expect(position.X).toBeCloseTo(38.1, 6);
  });

  it("reports arc max position", () => {
    let arcMax: Position | null = null;
    const virtualizer = new GCodeVirtualizer({
      onArcMove: (payload) => {
        console.log(payload);
        arcMax = payload.max;
      },
    });

    const lines = readFileSync(fixturePath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      virtualizer.processLine(line);
    }

    console.log(arcMax);
    expect(arcMax).not.toBeNull();
    if (arcMax === null) {
      throw new Error("Expected arc max to be reported.");
    }
    const arcMaxValue = arcMax as Position;
    expect(arcMaxValue.X).toBeGreaterThan(20);
    expect(arcMaxValue.Y).toBeGreaterThan(0);
  });

  it("collects unique F, S, and T values", () => {
    const virtualizer = new GCodeVirtualizer();
    const lines = readFileSync(fixturePath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      virtualizer.processLine(line);
    }

    expect(virtualizer.getUniqueFeedRates()).toEqual([1200]);
    expect(virtualizer.getUniqueSpindleSpeeds()).toEqual([1000]);
    expect(virtualizer.getUniqueTools()).toEqual([3]);
  });
});
