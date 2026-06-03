import * as React from "react";
import { GCodeSVGRenderer } from "../viewer/svg/GCodeSVGRenderer";
import type { GCodeSVGOptions } from "../viewer/svg/types";
import type { WorkerGeometryData } from "../types";

export type GCodeSVGRendererHandle = {
  loadFromLines(lines: string[]): void;
  loadFromFile(file: File): Promise<void>;
  loadFromText(gcode: string): void;
  loadFromWorkerData(data: WorkerGeometryData): void;
  loadFromPrecomputedGroups(groups: { hexColor: string; opacity: number; positionsBuffer: ArrayBuffer; positionsLen: number }[]): void;
  clear(): void;
  resetView(): void;
  setOptions(opts: Partial<GCodeSVGOptions>): void;
  setProjectionMode(mode: 'perspective' | 'isometric'): void;
  getSVGElement(): SVGSVGElement;
  dispose(): void;
};

export type GCodeSVGVisualizerProps = {
  id: string;
  options?: Partial<GCodeSVGOptions>;
  className?: string;
  style?: React.CSSProperties;
};

export const GCodeSVGVisualizer = React.forwardRef<GCodeSVGRendererHandle, GCodeSVGVisualizerProps>(
  function GCodeSVGVisualizer(props, ref) {
    const { id: _id, options, className, style } = props;
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const rendererRef = React.useRef<GCodeSVGRenderer | null>(null);

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
      if (options) rendererRef.current?.setOptions(options);
    }, [options]);

    React.useImperativeHandle(ref, () => {
      const get = () => {
        const r = rendererRef.current;
        if (!r) throw new Error("GCodeSVGRenderer is not ready.");
        return r;
      };
      return {
        loadFromLines: (lines) => get().loadFromLines(lines),
        loadFromFile: (file) => get().loadFromFile(file),
        loadFromText: (gcode) => get().loadFromText(gcode),
        loadFromWorkerData: (data) => get().loadFromWorkerData(data),
        loadFromPrecomputedGroups: (groups) => get().loadFromPrecomputedGroups(groups),
        clear: () => get().clear(),
        resetView: () => get().resetView(),
        setOptions: (opts) => get().setOptions(opts),
        setProjectionMode: (mode) => get().setProjectionMode(mode),
        getSVGElement: () => get().getSVGElement(),
        dispose: () => get().dispose(),
      };
    }, []);

    return React.createElement("div", {
      ref: containerRef,
      className,
      style: { width: "100%", height: "100%", ...style },
    });
  }
);
