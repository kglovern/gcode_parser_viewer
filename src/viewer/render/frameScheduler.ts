export type FrameDecisionArgs = {
  /** `render.onDemand`; false keeps the continuous loop. */
  onDemand: boolean;
  /** Something changed since the last draw (invalidate()). */
  needsRender: boolean;
  /** An animation (tween, camera transition, pulse, damping) is running. */
  animating: boolean;
  /** Milliseconds since the last draw. */
  sinceLastDrawMs: number;
  /** `render.maxAnimationFps`; caps frames driven only by animation. */
  maxAnimationFps?: number;
};

export type FrameDecision = {
  /** Draw this frame. */
  draw: boolean;
  /** Request another animation frame. */
  continue: boolean;
};

/**
 * Per-frame scheduling for the render loop. Continuous mode draws every frame.
 * On-demand draws when invalidated or animating and stops once neither holds;
 * frames driven only by animation are capped at maxAnimationFps, while
 * explicit invalidations always draw straight away.
 */
export function nextFrameDecision(args: FrameDecisionArgs): FrameDecision {
  if (!args.onDemand) {
    return { draw: true, continue: true };
  }
  if (args.needsRender) {
    return { draw: true, continue: true };
  }
  if (!args.animating) {
    return { draw: false, continue: false };
  }
  const fps = args.maxAnimationFps;
  const minInterval = fps && fps > 0 ? 1000 / fps : 0;
  // A frame's worth of slack so a 30fps cap on a 60Hz display lands on every
  // other vsync rather than drifting to every third
  return { draw: args.sinceLastDrawMs >= minInterval - 4, continue: true };
}
