import * as THREE from "three";
import { applyStreamGreyCursor, createToolpathStreams, processedRgb } from "../src/viewer/toolpath/streams";
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
