import { describe, expect, it } from "vitest";
import { nextFrameDecision } from "../src/viewer/render/frameScheduler";

const base = { onDemand: true, needsRender: false, animating: false, sinceLastDrawMs: 0 };

describe("nextFrameDecision", () => {
  it("always draws in continuous mode", () => {
    expect(nextFrameDecision({ ...base, onDemand: false })).toEqual({ draw: true, continue: true });
  });

  it("stops the loop when idle", () => {
    expect(nextFrameDecision(base)).toEqual({ draw: false, continue: false });
  });

  it("draws an invalidated frame immediately, even under the fps cap", () => {
    expect(nextFrameDecision({ ...base, needsRender: true, sinceLastDrawMs: 1, maxAnimationFps: 30 })).toEqual({
      draw: true,
      continue: true,
    });
  });

  it("draws every frame while animating without a cap", () => {
    expect(nextFrameDecision({ ...base, animating: true, sinceLastDrawMs: 16 })).toEqual({ draw: true, continue: true });
  });

  it("caps animation-only frames at maxAnimationFps", () => {
    // 60Hz frames under a 30fps cap: skip one, draw the next
    expect(nextFrameDecision({ ...base, animating: true, sinceLastDrawMs: 16.7, maxAnimationFps: 30 })).toEqual({
      draw: false,
      continue: true,
    });
    expect(nextFrameDecision({ ...base, animating: true, sinceLastDrawMs: 33.4, maxAnimationFps: 30 })).toEqual({
      draw: true,
      continue: true,
    });
  });
});
