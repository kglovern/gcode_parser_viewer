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
  style?: React.CSSProperties;
};

export const GCodeVisualizer = React.forwardRef<GCodeViewerHandle, GCodeVisualizerProps>(
  function GCodeVisualizer(props, ref) {
    const { id, options, callbacks, className, style } = props;
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const viewerRef = React.useRef<GCodeViewer | null>(null);

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
      ref,
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
          snapCameraToView(view, snapOptions) {
            getViewer().snapCameraToView(view, snapOptions);
          },
          setRotateEnabled(enabled: boolean) {
            getViewer().setRotateEnabled(enabled);
          },
          setCameraFollowEnabled(enabled: boolean) {
            getViewer().setCameraFollowEnabled(enabled);
          },
          screenToWorld(clientX: number, clientY: number, worldOptions?: { planeZ?: number }) {
            return getViewer().screenToWorld(clientX, clientY, worldOptions);
          },
          worldToScreen(x: number, y: number, z?: number) {
            return getViewer().worldToScreen(x, y, z);
          },
          setBitPosition(position, bitOptions) {
            getViewer().setBitPosition(position, bitOptions);
          },
          setBitVisible(visible: boolean) {
            getViewer().setBitVisible(visible);
          },
          setBitSpinning(spinning: boolean) {
            getViewer().setBitSpinning(spinning);
          },
          setToolpathRotationA(aDegrees: number) {
            getViewer().setToolpathRotationA(aDegrees);
          },
          hideUntilLine(lineIndex: number, mode?: "hide" | "grey") {
            getViewer().hideUntilLine(lineIndex, mode);
          },
          seekToLine(lineIndex: number, mode?: "hide" | "grey") {
            getViewer().seekToLine(lineIndex, mode);
          },
          showAll() {
            getViewer().showAll();
          },
          resetColors() {
            getViewer().resetColors();
          },
          loadFromUrl(url: string, urlArgs?: { signal?: AbortSignal }) {
            return getViewer().loadFromUrl(url, urlArgs);
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
          loadFromWorkerData(data) {
            return getViewer().loadFromWorkerData(data);
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
