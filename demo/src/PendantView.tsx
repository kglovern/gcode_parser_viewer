import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { GCodeVisualizer } from "@src/react";
import type { GCodeViewerHandle, GCodeViewerOptions, GCodeViewerTheme } from "@src/viewer/types";
import { buildPendantData, type PendantData } from "./pendantData";

// The sender pendant's colours (blue.500 cut, green.500 rapid, blue.200 bit,
// orange.400 bed), so the demo looks like the device.
const PENDANT_CUT = "#3F85C7";
const PENDANT_RAPID = "#059669";
const PENDANT_BIT = "#79aad8";
const PENDANT_BED = "#c27924";

export type PendantBed = {
  visible: boolean;
  width: number;
  depth: number;
  /** Where machine X0 Y0 (the bed's min corner) sits in work coordinates. */
  offsetX: number;
  offsetY: number;
};

export type PendantViewHandle = { fit(): void };

type Props = {
  text: string;
  /** Simulated tool position in work coordinates; null hides the crosshair. */
  bit: { x: number; y: number; z: number } | null;
  bed: PendantBed;
  crosshairPx: number;
  originPx: number;
  theme: GCodeViewerTheme;
  onData?: (data: PendantData | null) => void;
};

export const PendantView = forwardRef<PendantViewHandle, Props>(function PendantView(props, ref) {
  const { text, bit, bed, crosshairPx, originPx, theme, onData } = props;
  const viewerRef = useRef<GCodeViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingFit = useRef(false);

  const options = useMemo<Partial<GCodeViewerOptions>>(
    () => ({
      viewMode: "pendant",
      bit: {
        enabled: true,
        type: "crosshair",
        size: crosshairPx,
        opacity: 1,
        tweenMs: 0,
        colorSource: "custom",
        color: PENDANT_BIT,
        spinRpm: 300,
        screenSpace: true,
      },
      originMarker: { visible: true, color: "#ffffff", sizePx: originPx },
      boundingBox: { visible: false, labels: false },
      machineBed: bed.visible
        ? {
            visible: true,
            min: { x: bed.offsetX, y: bed.offsetY },
            max: { x: bed.offsetX + bed.width, y: bed.offsetY + bed.depth },
            keepout: null,
          }
        : { visible: false, min: null, max: null, keepout: null },
      render: { antialias: true, theme: { ...theme, colors: { ...theme.colors, machineBed: PENDANT_BED } } },
      camera: {
        projection: "orthographic",
        fov: 45,
        focusDurationMs: 0,
        orbit: { enableDamping: false },
        initialPosition: { x: 0, y: 0, z: 400 },
        lockTopDown: true,
      },
    }),
    [bed.visible, bed.width, bed.depth, bed.offsetX, bed.offsetY, crosshairPx, originPx, theme]
  );

  // Fitting needs a laid-out canvas; a load while this view is hidden fits
  // when it is next shown, as the pendant does for its hidden Carve tab.
  const fit = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) {
      pendingFit.current = true;
      return;
    }
    pendingFit.current = false;
    viewerRef.current?.focusToModel();
  };

  useImperativeHandle(ref, () => ({ fit }), []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!text) {
      viewer.unload();
      onData?.(null);
      return;
    }
    const data = buildPendantData(text, { cut: PENDANT_CUT, rapid: PENDANT_RAPID });
    viewer.loadFromPrecomputedGroups(data.groups, data.meta);
    onData?.(data);
    fit();
  }, [text]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (pendingFit.current) fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.setBitVisible(bit !== null);
    if (bit) viewer.setBitPosition(bit);
  }, [bit?.x, bit?.y, bit?.z, bit === null]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <GCodeVisualizer
        id="demo-pendant"
        ref={viewerRef}
        options={options}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});
