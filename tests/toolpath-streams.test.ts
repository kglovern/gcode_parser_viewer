import * as THREE from "three";
import {
  applyStreamGreyCursor,
  applyStreamPlannedCursor,
  createToolpathStreams,
  plannedRgb,
  processedRgb,
} from "../src/viewer/toolpath/streams";
import { defaultGCodeViewerOptions } from "../src/viewer/types";

const VERTICES = 40;

function buildStream() {
  const { streams } = createToolpathStreams({
    specs: [
      {
        kind: "cut",
        cutBucketIndex: 0,
        positions: new Float32Array(VERTICES * 3),
        prefixEndVertex: new Int32Array(0),
        opacity: 1,
      },
    ],
    options: defaultGCodeViewerOptions,
    scene: new THREE.Scene(),
  });
  const stream = streams[0];
  const attr = stream.line.geometry.getAttribute("color") as THREE.BufferAttribute;
  return { stream, attr };
}

describe("applyStreamGreyCursor", () => {
  it("keeps earlier pending ranges when several moves happen between renders", () => {
    const { stream, attr } = buildStream();

    // No render (and so no range upload/clear) between these, as when the window is backgrounded.
    for (const cursor of [10, 20, 30]) {
      applyStreamGreyCursor({ stream, nextCursorVertex: cursor, options: defaultGCodeViewerOptions });
    }

    expect(attr.updateRanges).toEqual([{ start: 0, count: 30 * 3 }]);
    const processed = processedRgb(defaultGCodeViewerOptions);
    for (let v = 0; v < 30; v += 1) {
      expect(stream.simColors[v * 3]).toBeCloseTo(processed.r);
      expect(stream.simColors[v * 3 + 1]).toBeCloseTo(processed.g);
      expect(stream.simColors[v * 3 + 2]).toBeCloseTo(processed.b);
    }
  });

  it("covers only the new span once the previous range has been uploaded", () => {
    const { stream, attr } = buildStream();

    applyStreamGreyCursor({ stream, nextCursorVertex: 10, options: defaultGCodeViewerOptions });
    attr.clearUpdateRanges(); // what the renderer does after uploading
    applyStreamGreyCursor({ stream, nextCursorVertex: 25, options: defaultGCodeViewerOptions });

    expect(attr.updateRanges).toEqual([{ start: 10 * 3, count: 15 * 3 }]);
  });
});

describe("applyStreamPlannedCursor", () => {
  it("paints the span from the processed cursor through the planned end", () => {
    const { stream, attr } = buildStream();
    applyStreamGreyCursor({ stream, nextCursorVertex: 10, options: defaultGCodeViewerOptions });
    attr.clearUpdateRanges();

    applyStreamPlannedCursor({ stream, nextPlannedEndVertex: 25, options: defaultGCodeViewerOptions });

    expect(attr.updateRanges).toEqual([{ start: 10 * 3, count: 15 * 3 }]);
    const planned = plannedRgb(defaultGCodeViewerOptions);
    for (let v = 10; v < 25; v += 1) {
      expect(stream.simColors[v * 3]).toBeCloseTo(planned.r);
      expect(stream.simColors[v * 3 + 1]).toBeCloseTo(planned.g);
      expect(stream.simColors[v * 3 + 2]).toBeCloseTo(planned.b);
    }
    // Untouched vertices stay base-colored.
    expect(stream.simColors[26 * 3]).toBeCloseTo(stream.baseColors[26 * 3]);
  });

  it("restores a shrinking span to base colors, not processed", () => {
    const { stream, attr } = buildStream();
    applyStreamGreyCursor({ stream, nextCursorVertex: 10, options: defaultGCodeViewerOptions });
    applyStreamPlannedCursor({ stream, nextPlannedEndVertex: 25, options: defaultGCodeViewerOptions });
    attr.clearUpdateRanges();

    applyStreamPlannedCursor({ stream, nextPlannedEndVertex: 15, options: defaultGCodeViewerOptions });

    expect(attr.updateRanges).toEqual([{ start: 15 * 3, count: 10 * 3 }]);
    for (let v = 15; v < 25; v += 1) {
      expect(stream.simColors[v * 3]).toBeCloseTo(stream.baseColors[v * 3]);
      expect(stream.simColors[v * 3 + 1]).toBeCloseTo(stream.baseColors[v * 3 + 1]);
      expect(stream.simColors[v * 3 + 2]).toBeCloseTo(stream.baseColors[v * 3 + 2]);
    }
    // The still-planned prefix is untouched.
    const planned = plannedRgb(defaultGCodeViewerOptions);
    expect(stream.simColors[12 * 3]).toBeCloseTo(planned.r);
  });

  it("clamps the lower bound to the current processed cursor, never painting over it", () => {
    const { stream } = buildStream();
    applyStreamGreyCursor({ stream, nextCursorVertex: 20, options: defaultGCodeViewerOptions });

    // A stale/out-of-order call asking to plan from before the processed cursor.
    applyStreamPlannedCursor({ stream, nextPlannedEndVertex: 15, options: defaultGCodeViewerOptions });

    const processed = processedRgb(defaultGCodeViewerOptions);
    for (let v = 0; v < 20; v += 1) {
      expect(stream.simColors[v * 3]).toBeCloseTo(processed.r);
    }
    expect(stream.plannedCursorVertex).toBe(20);
  });

  it("tracks the processed cursor forward without the two states fighting across ticks", () => {
    // Simulates gsender's real call sequence: hideUntilLine (grey) then
    // setPlannedRange (planned), every tick, as both execLine and received advance.
    const { stream } = buildStream();
    const processed = processedRgb(defaultGCodeViewerOptions);
    const planned = plannedRgb(defaultGCodeViewerOptions);

    // Tick 1: execLine=0, received=10 -> processed [0,0), planned [0,10)
    applyStreamGreyCursor({ stream, nextCursorVertex: 0, options: defaultGCodeViewerOptions });
    applyStreamPlannedCursor({ stream, nextPlannedEndVertex: 10, options: defaultGCodeViewerOptions });

    // Tick 2: execLine=5, received=18 -> processed [0,5), planned [5,18)
    applyStreamGreyCursor({ stream, nextCursorVertex: 5, options: defaultGCodeViewerOptions });
    applyStreamPlannedCursor({ stream, nextPlannedEndVertex: 18, options: defaultGCodeViewerOptions });

    for (let v = 0; v < 5; v += 1) {
      expect(stream.simColors[v * 3]).toBeCloseTo(processed.r);
    }
    for (let v = 5; v < 18; v += 1) {
      expect(stream.simColors[v * 3]).toBeCloseTo(planned.r);
    }
    expect(stream.simColors[19 * 3]).toBeCloseTo(stream.baseColors[19 * 3]);
  });
});
