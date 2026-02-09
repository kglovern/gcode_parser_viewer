import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GCodeParser } from "../src/parser";

const fixturePath = join(__dirname, "..", "fixtures", "sample.gcode");

describe("GCodeParser", () => {
  it("parses words and comments from fixture lines", () => {
    const parser = new GCodeParser();
    const lines = readFileSync(fixturePath, "utf8").split(/\r?\n/).filter(Boolean);

    const first = parser.parseLine(lines[0]);
    expect(first.words).toHaveLength(0);
    expect(first.comments).toHaveLength(1);
    expect(first.comments[0].type).toBe("paren");

    const second = parser.parseLine(lines[1]);
    expect(second.gcodes.map((word) => word.letter)).toEqual(["G", "G", "G"]);
    expect(second.params).toHaveLength(0);

    const third = parser.parseLine(lines[2]);
    expect(third.comments).toHaveLength(1);
    expect(third.comments[0].type).toBe("semicolon");
    expect(third.params.map((word) => word.letter)).toContain("Z");
  });
});
