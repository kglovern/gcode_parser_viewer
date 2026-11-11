import * as s from "react";
import { a as w, G as g } from "./GCodeSVGRenderer-C2K26hAv.js";
const V = s.forwardRef(
  function(c, m) {
    const { id: a, options: n, callbacks: l, className: f, style: u } = c, i = s.useRef(null), o = s.useRef(null);
    return s.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const d = new w({ id: a, container: e, options: n, callbacks: l });
      return o.current = d, () => {
        o.current = null, d.dispose();
      };
    }, [a]), s.useEffect(() => {
      var e;
      (e = o.current) == null || e.setOptions(n ?? {});
    }, [n]), s.useEffect(() => {
      var e;
      (e = o.current) == null || e.setCallbacks(l ?? {});
    }, [l]), s.useImperativeHandle(
      m,
      () => {
        const e = () => {
          const r = o.current;
          if (!r)
            throw new Error("GCodeViewer is not ready.");
          return r;
        };
        return {
          get id() {
            return a;
          },
          setCallbacks(r) {
            e().setCallbacks(r);
          },
          snapCameraToView(r, t) {
            e().snapCameraToView(r, t);
          },
          setCameraProjection(r) {
            e().setCameraProjection(r);
          },
          getCameraProjection() {
            return e().getCameraProjection();
          },
          setRotateEnabled(r) {
            e().setRotateEnabled(r);
          },
          setPanZoomEnabled(r) {
            e().setPanZoomEnabled(r);
          },
          setCameraFollowEnabled(r) {
            e().setCameraFollowEnabled(r);
          },
          screenToWorld(r, t, p) {
            return e().screenToWorld(r, t, p);
          },
          worldToScreen(r, t, p) {
            return e().worldToScreen(r, t, p);
          },
          setBitPosition(r, t) {
            e().setBitPosition(r, t);
          },
          setBitVisible(r) {
            e().setBitVisible(r);
          },
          setOriginVisible(r) {
            e().setOriginVisible(r);
          },
          setBitSpinning(r) {
            e().setBitSpinning(r);
          },
          setToolpathRotationA(r) {
            e().setToolpathRotationA(r);
          },
          hideUntilLine(r, t) {
            e().hideUntilLine(r, t);
          },
          setPlannedRange(r, t) {
            e().setPlannedRange(r, t);
          },
          trackRunProgress(r) {
            return e().trackRunProgress(r);
          },
          seekToLine(r, t) {
            e().seekToLine(r, t);
          },
          showAll() {
            e().showAll();
          },
          resetColors() {
            e().resetColors();
          },
          loadFromUrl(r, t) {
            return e().loadFromUrl(r, t);
          },
          loadFromFile(r) {
            return e().loadFromFile(r);
          },
          loadFromText(r) {
            return e().loadFromText(r);
          },
          loadFromLines(r) {
            return e().loadFromLines(r);
          },
          loadFromWorkerData(r) {
            return e().loadFromWorkerData(r);
          },
          loadFromSegments(r, t) {
            return e().loadFromSegments(r, t);
          },
          loadFromPrecomputedGroups(r, t) {
            e().loadFromPrecomputedGroups(r, t);
          },
          unload() {
            e().unload();
          },
          setOptions(r) {
            e().setOptions(r);
          },
          getOptions() {
            return e().getOptions();
          },
          resize() {
            e().resize();
          },
          pause() {
            e().pause();
          },
          resume() {
            e().resume();
          },
          isPaused() {
            return e().isPaused();
          },
          focusToModel() {
            e().focusToModel();
          },
          focusToMachineBed() {
            e().focusToMachineBed();
          },
          resetCamera() {
            e().resetCamera();
          },
          getBounds() {
            return e().getBounds();
          },
          dispose() {
            e().dispose();
          }
        };
      },
      [a]
    ), s.createElement("div", { ref: i, className: f, style: u });
  }
), P = s.forwardRef(
  function(c, m) {
    const { id: a, options: n, className: l, style: f } = c, u = s.useRef(null), i = s.useRef(null);
    return s.useEffect(() => {
      const o = u.current;
      if (!o) return;
      const e = new g(o, n);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), s.useEffect(() => {
      var o;
      n && ((o = i.current) == null || o.setOptions(n));
    }, [n]), s.useImperativeHandle(m, () => {
      const o = () => {
        const e = i.current;
        if (!e) throw new Error("GCodeSVGRenderer is not ready.");
        return e;
      };
      return {
        loadFromLines: (e) => o().loadFromLines(e),
        loadFromFile: (e) => o().loadFromFile(e),
        loadFromText: (e) => o().loadFromText(e),
        loadFromWorkerData: (e) => o().loadFromWorkerData(e),
        loadFromSegments: (e) => o().loadFromSegments(e),
        loadFromPrecomputedGroups: (e, d) => o().loadFromPrecomputedGroups(e, d),
        clear: () => o().clear(),
        resetView: () => o().resetView(),
        setOptions: (e) => o().setOptions(e),
        setProjectionMode: (e) => o().setProjectionMode(e),
        setBitPosition: (e) => o().setBitPosition(e),
        setBitVisible: (e) => o().setBitVisible(e),
        getSVGElement: () => o().getSVGElement(),
        dispose: () => o().dispose()
      };
    }, []), s.createElement("div", {
      ref: u,
      className: l,
      style: { width: "100%", height: "100%", ...f }
    });
  }
);
export {
  P as GCodeSVGVisualizer,
  V as GCodeVisualizer
};
