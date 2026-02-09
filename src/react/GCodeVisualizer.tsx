import * as React from "react";
import { GCodeViewer } from "../viewer/GCodeViewer";
import type {
  GCodeViewerCallbacks,
  GCodeViewerHandle,
  GCodeViewerOptions,
} from "../viewer/types";

export type GCodeVisualizerProps = {
  id: string;
  options?: Partial<GCodeViewerOptions>;
  callbacks?: GCodeViewerCallbacks;
  className?: string;
  style?: Record<string, unknown>;
};

export const GCodeVisualizer = React.forwardRef(function GCodeVisualizer(
  props: GCodeVisualizerProps,
  ref: unknown
) {
    const { id, options, callbacks, className, style } = props;
    const containerRef = React.useRef(null) as { current: HTMLDivElement | null };
    const viewerRef = React.useRef(null) as { current: GCodeViewer | null };

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const viewer = new GCodeViewer({ id, container, options, callbacks });
      viewerRef.current = viewer;
      return () => {
        viewerRef.current = null;
        viewer.dispose();
      };
    }, [id]);

    React.useEffect(() => {
      viewerRef.current?.setOptions(options ?? {});
    }, [options]);

    React.useEffect(() => {
      viewerRef.current?.setCallbacks(callbacks ?? {});
    }, [callbacks]);

    React.useImperativeHandle(
      ref as any,
      () => {
        const getViewer = () => {
          const viewer = viewerRef.current;
          if (!viewer) {
            throw new Error("GCodeViewer is not ready.");
          }
          return viewer;
        };

        const handle: GCodeViewerHandle = {
          get id() {
            return id;
          },
          setCallbacks(next: GCodeViewerCallbacks) {
            getViewer().setCallbacks(next);
          },
          snapCameraToView(view, options) {
            getViewer().snapCameraToView(view as any, options);
          },
          setBitPosition(position, options) {
            getViewer().setBitPosition(position as any, options as any);
          },
          setBitVisible(visible: boolean) {
            getViewer().setBitVisible(visible);
          },
          setToolpathRotationA(aDegrees: number) {
            getViewer().setToolpathRotationA(aDegrees);
          },
          hideUntilLine(lineIndex: number, mode?: "hide" | "grey") {
            getViewer().hideUntilLine(lineIndex, mode as any);
          },
          showAll() {
            getViewer().showAll();
          },
          resetColors() {
            getViewer().resetColors();
          },
          loadFromUrl(url: string, args?: { signal?: AbortSignal }) {
            return getViewer().loadFromUrl(url, args);
          },
          loadFromFile(file: File) {
            return getViewer().loadFromFile(file);
          },
          loadFromText(gcode: string) {
            return getViewer().loadFromText(gcode);
          },
          loadFromLines(lines: readonly string[]) {
            return getViewer().loadFromLines(lines);
          },
          unload() {
            getViewer().unload();
          },
          setOptions(next: Partial<GCodeViewerOptions>) {
            getViewer().setOptions(next);
          },
          getOptions() {
            return getViewer().getOptions();
          },
          resize() {
            getViewer().resize();
          },
          focusToModel() {
            getViewer().focusToModel();
          },
          resetCamera() {
            getViewer().resetCamera();
          },
          getBounds() {
            return getViewer().getBounds();
          },
          dispose() {
            getViewer().dispose();
          },
        };

        return handle;
      },
      [id]
    );

    return React.createElement("div", { ref: containerRef, className, style });
  }
);
