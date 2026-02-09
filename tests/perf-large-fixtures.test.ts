import { createReadStream } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { GCodeParser } from "../src/parser";

const fixtures = ["large.gcode", "larger.gcode"];

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function logMemory(label: string): void {
  const usage = process.memoryUsage();
  console.log(
    `${label} heapUsed=${formatBytes(usage.heapUsed)} rss=${formatBytes(usage.rss)}`
  );
}

describe("large fixture parsing performance", () => {
  async function runFixture(fixture: string): Promise<void> {
    const parser = new GCodeParser();
    const path = join(__dirname, "..", "fixtures", fixture);
    if (typeof global.gc === "function") {
      global.gc();
    }
    logMemory(`[${fixture}] before stream`);
    const startParse = performance.now();
    let count = 0;

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(path, { encoding: "utf8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      rl.on("line", (line) => {
        if (!line) {
          return;
        }
        parser.parseLine(line);
        count += 1;
      });
      rl.on("close", () => resolve());
      rl.on("error", reject);
      stream.on("error", reject);
    });

    const parseTime = performance.now() - startParse;

    if (typeof global.gc === "function") {
      global.gc();
    }
    logMemory(`[${fixture}] after stream parse`);
    console.log(`[${fixture}] lines=${count} parse=${parseTime.toFixed(1)}ms`);
    expect(count).toBeGreaterThan(0);
  }

  it(
    "reports memory/time for large.gcode (streamed)",
    async () => {
      await runFixture("large.gcode");
    },
    300000
  );

  it(
    "reports memory/time for larger.gcode (streamed)",
    async () => {
      await runFixture("larger.gcode");
    },
    600000
  );
});
