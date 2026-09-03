import * as o from "react";
import { a as w, G as C } from "./GCodeSVGRenderer-D4QGoHWJ.js";
const G = o.forwardRef(
  function(u, m) {
    const { id: a, options: s, callbacks: l, className: f, style: c } = u, i = o.useRef(null), t = o.useRef(null);
    return o.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const d = new w({ id: a, container: e, options: s, callbacks: l });
      return t.current = d, () => {
        t.current = null, d.dispose();
      };
    }, [a]), o.useEffect(() => {
      var e;
      (e = t.current) == null || e.setOptions(s ?? {});
    }, [s]), o.useEffect(() => {
      var e;
      (e = t.current) == null || e.setCallbacks(l ?? {});
    }, [l]), o.useImperativeHandle(
      m,
      () => {
        const e = () => {
          const r = t.current;
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
          snapCameraToView(r, n) {
            e().snapCameraToView(r, n);
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
          setCameraFollowEnabled(r) {
            e().setCameraFollowEnabled(r);
          },
          screenToWorld(r, n, p) {
            return e().screenToWorld(r, n, p);
          },
          worldToScreen(r, n, p) {
            return e().worldToScreen(r, n, p);
          },
          setBitPosition(r, n) {
            e().setBitPosition(r, n);
          },
          setBitVisible(r) {
            e().setBitVisible(r);
          },
          setBitSpinning(r) {
            e().setBitSpinning(r);
          },
          setToolpathRotationA(r) {
            e().setToolpathRotationA(r);
          },
          hideUntilLine(r, n) {
            e().hideUntilLine(r, n);
          },
          seekToLine(r, n) {
            e().seekToLine(r, n);
          },
          showAll() {
            e().showAll();
          },
          resetColors() {
            e().resetColors();
          },
          loadFromUrl(r, n) {
            return e().loadFromUrl(r, n);
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
          focusToModel() {
            e().focusToModel();
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
    ), o.createElement("div", { ref: i, className: f, style: c });
  }
), R = o.forwardRef(
  function(u, m) {
    const { id: a, options: s, className: l, style: f } = u, c = o.useRef(null), i = o.useRef(null);
    return o.useEffect(() => {
      const t = c.current;
      if (!t) return;
      const e = new C(t, s);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), o.useEffect(() => {
      var t;
      s && ((t = i.current) == null || t.setOptions(s));
    }, [s]), o.useImperativeHandle(m, () => {
      const t = () => {
        const e = i.current;
        if (!e) throw new Error("GCodeSVGRenderer is not ready.");
        return e;
      };
      return {
        loadFromLines: (e) => t().loadFromLines(e),
        loadFromFile: (e) => t().loadFromFile(e),
        loadFromText: (e) => t().loadFromText(e),
        loadFromWorkerData: (e) => t().loadFromWorkerData(e),
        loadFromPrecomputedGroups: (e, d) => t().loadFromPrecomputedGroups(e, d),
        clear: () => t().clear(),
        resetView: () => t().resetView(),
        setOptions: (e) => t().setOptions(e),
        setProjectionMode: (e) => t().setProjectionMode(e),
        setBitPosition: (e) => t().setBitPosition(e),
        setBitVisible: (e) => t().setBitVisible(e),
        getSVGElement: () => t().getSVGElement(),
        dispose: () => t().dispose()
      };
    }, []), o.createElement("div", {
      ref: c,
      className: l,
      style: { width: "100%", height: "100%", ...f }
    });
  }
);
export {
  R as GCodeSVGVisualizer,
  G as GCodeVisualizer
};
