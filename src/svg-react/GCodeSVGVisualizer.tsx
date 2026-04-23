import * as React from "react";
import { GCodeSVGRenderer } from "../svg/GCodeSVGRenderer";
import type { GCodeSVGOptions } from "../svg/types";

export type GCodeSVGVisualizerProps = {
  options?: Partial<GCodeSVGOptions>;
  className?: string;
  style?: React.CSSProperties;
};

export type GCodeSVGVisualizerHandle = {
  loadFromLines(lines: string[]): void;
  loadFromFile(file: File): Promise<void>;
  loadFromText(gcode: string): void;
  clear(): void;
  resetView(): void;
  setOptions(opts: Partial<GCodeSVGOptions>): void;
  setProjectionMode(mode: 'perspective' | 'isometric'): void;
};

export const GCodeSVGVisualizer = React.forwardRef(function GCodeSVGVisualizer(
  props: GCodeSVGVisualizerProps,
  ref: unknown
) {
  const { options, className, style } = props;
  const containerRef = React.useRef(null) as { current: HTMLDivElement | null };
  const rendererRef = React.useRef(null) as { current: GCodeSVGRenderer | null };

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new GCodeSVGRenderer(container, options);
    rendererRef.current = renderer;
    return () => {
      rendererRef.current = null;
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (options) {
      rendererRef.current?.setOptions(options);
    }
  }, [options]);

  React.useImperativeHandle(
    ref as any,
    (): GCodeSVGVisualizerHandle => ({
      loadFromLines(lines: string[]) {
        rendererRef.current?.loadFromLines(lines);
      },
      loadFromFile(file: File) {
        const r = rendererRef.current;
        if (!r) return Promise.reject(new Error("Renderer not ready"));
        return r.loadFromFile(file);
      },
      loadFromText(gcode: string) {
        rendererRef.current?.loadFromText(gcode);
      },
      clear() {
        rendererRef.current?.clear();
      },
      resetView() {
        rendererRef.current?.resetView();
      },
      setOptions(opts: Partial<GCodeSVGOptions>) {
        rendererRef.current?.setOptions(opts);
      },
      setProjectionMode(mode: 'perspective' | 'isometric') {
        rendererRef.current?.setProjectionMode(mode);
      },
    })
  );

  return React.createElement("div", { ref: containerRef, className, style });
});
