import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GCodeParser } from "../src/parser";
import { GCodeVirtualizer } from "../src/virtualizer";

const fixturePath = join(__dirname, "..", "fixtures", "sample.gcode");

describe("fixture printout", () => {
  it("prints parsed output and position per line", () => {
    const parser = new GCodeParser();
    const virtualizer = new GCodeVirtualizer();
    const lines = readFileSync(fixturePath, "utf8").split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const parsed = parser.parseLine(line);
      const result = virtualizer.processLine(line);
      //console.log(JSON.stringify(result.end, null, 2));
    }
  });
});
