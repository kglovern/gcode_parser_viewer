import { describe, expect, it } from "vitest";
import { applyViewMode, mergeOptions } from "../src/viewer/GCodeViewer";
import { defaultGCodeViewerOptions } from "../src/viewer/types";

describe("pendant view mode", () => {
  it("leaves standard options alone", () => {
    const merged = mergeOptions(defaultGCodeViewerOptions, { units: "in" });
    expect(merged.camera.projection).toBe("perspective");
    expect(merged.camera.lockTopDown).toBeFalsy();
    expect(merged.viewCube?.visible).toBe(true);
    expect(merged.grid.visible).toBe(true);
    expect(merged.originMarker?.visible).toBe(false);
  });

  it("pins the locked top-down preset", () => {
    const merged = mergeOptions(defaultGCodeViewerOptions, { viewMode: "pendant" });
    expect(merged.camera.projection).toBe("orthographic");
    expect(merged.camera.lockTopDown).toBe(true);
    expect(merged.viewCube?.visible).toBe(false);
    expect(merged.grid.visible).toBe(false);
    expect(merged.originMarker?.visible).toBe(true);
    expect(merged.bit.type).toBe("crosshair");
    expect(merged.bit.screenSpace).toBe(true);
  });

  it("survives a later partial update that would unlock it", () => {
    const pendant = mergeOptions(defaultGCodeViewerOptions, { viewMode: "pendant" });
    const next = mergeOptions(pendant, {
      camera: { ...pendant.camera, projection: "perspective", lockTopDown: false },
      grid: { ...pendant.grid, visible: true },
    });
    expect(next.camera.projection).toBe("orthographic");
    expect(next.camera.lockTopDown).toBe(true);
    expect(next.grid.visible).toBe(false);
  });

  it("keeps host colours for the origin marker and leaves the bed to the host", () => {
    const merged = mergeOptions(defaultGCodeViewerOptions, {
      viewMode: "pendant",
      originMarker: { visible: false, color: "#ff00ff", sizePx: 12 },
      machineBed: { visible: true, min: { x: 0, y: 0 }, max: { x: 10, y: 10 }, keepout: null },
    });
    expect(merged.originMarker).toEqual({ visible: true, color: "#ff00ff", sizePx: 12 });
    expect(merged.machineBed.visible).toBe(true);
  });

  it("keeps a laser bit in laser mode", () => {
    const options = applyViewMode({
      ...defaultGCodeViewerOptions,
      viewMode: "pendant",
      bit: { ...defaultGCodeViewerOptions.bit, type: "laser" },
    });
    expect(options.bit.type).toBe("laser");
  });
});
