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
export declare function nextFrameDecision(args: FrameDecisionArgs): FrameDecision;
