import * as o from "react";
import { a as w, G as V } from "./GCodeSVGRenderer-DrPQRfLG.js";
const G = o.forwardRef(
  function(u, c) {
    const { id: a, options: n, callbacks: l, className: m, style: d } = u, i = o.useRef(null), r = o.useRef(null);
    return o.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const f = new w({ id: a, container: e, options: n, callbacks: l });
      return r.current = f, () => {
        r.current = null, f.dispose();
      };
    }, [a]), o.useEffect(() => {
      var e;
      (e = r.current) == null || e.setOptions(n ?? {});
    }, [n]), o.useEffect(() => {
      var e;
      (e = r.current) == null || e.setCallbacks(l ?? {});
    }, [l]), o.useImperativeHandle(
      c,
      () => {
        const e = () => {
          const t = r.current;
          if (!t)
            throw new Error("GCodeViewer is not ready.");
          return t;
        };
        return {
          get id() {
            return a;
          },
          setCallbacks(t) {
            e().setCallbacks(t);
          },
          snapCameraToView(t, s) {
            e().snapCameraToView(t, s);
          },
          setRotateEnabled(t) {
            e().setRotateEnabled(t);
          },
          screenToWorld(t, s, F) {
            return e().screenToWorld(t, s, F);
          },
          setBitPosition(t, s) {
            e().setBitPosition(t, s);
          },
          setBitVisible(t) {
            e().setBitVisible(t);
          },
          setBitSpinning(t) {
            e().setBitSpinning(t);
          },
          setToolpathRotationA(t) {
            e().setToolpathRotationA(t);
          },
          hideUntilLine(t, s) {
            e().hideUntilLine(t, s);
          },
          seekToLine(t, s) {
            e().seekToLine(t, s);
          },
          showAll() {
            e().showAll();
          },
          resetColors() {
            e().resetColors();
          },
          loadFromUrl(t, s) {
            return e().loadFromUrl(t, s);
          },
          loadFromFile(t) {
            return e().loadFromFile(t);
          },
          loadFromText(t) {
            return e().loadFromText(t);
          },
          loadFromLines(t) {
            return e().loadFromLines(t);
          },
          loadFromWorkerData(t) {
            return e().loadFromWorkerData(t);
          },
          unload() {
            e().unload();
          },
          setOptions(t) {
            e().setOptions(t);
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
    ), o.createElement("div", { ref: i, className: m, style: d });
  }
), R = o.forwardRef(
  function(u, c) {
    const { id: a, options: n, className: l, style: m } = u, d = o.useRef(null), i = o.useRef(null);
    return o.useEffect(() => {
      const r = d.current;
      if (!r) return;
      const e = new V(r, n);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), o.useEffect(() => {
      var r;
      n && ((r = i.current) == null || r.setOptions(n));
    }, [n]), o.useImperativeHandle(c, () => {
      const r = () => {
        const e = i.current;
        if (!e) throw new Error("GCodeSVGRenderer is not ready.");
        return e;
      };
      return {
        loadFromLines: (e) => r().loadFromLines(e),
        loadFromFile: (e) => r().loadFromFile(e),
        loadFromText: (e) => r().loadFromText(e),
        loadFromWorkerData: (e) => r().loadFromWorkerData(e),
        loadFromPrecomputedGroups: (e) => r().loadFromPrecomputedGroups(e),
        clear: () => r().clear(),
        resetView: () => r().resetView(),
        setOptions: (e) => r().setOptions(e),
        setProjectionMode: (e) => r().setProjectionMode(e),
        setBitPosition: (e) => r().setBitPosition(e),
        setBitVisible: (e) => r().setBitVisible(e),
        getSVGElement: () => r().getSVGElement(),
        dispose: () => r().dispose()
      };
    }, []), o.createElement("div", {
      ref: d,
      className: l,
      style: { width: "100%", height: "100%", ...m }
    });
  }
);
export {
  R as GCodeSVGVisualizer,
  G as GCodeVisualizer
};
