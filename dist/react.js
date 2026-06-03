import * as o from "react";
import { a as F, G as w } from "./GCodeSVGRenderer-BubxJOY3.js";
const C = o.forwardRef(
  function(u, c) {
    const { id: a, options: n, callbacks: l, className: m, style: d } = u, i = o.useRef(null), t = o.useRef(null);
    return o.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const f = new F({ id: a, container: e, options: n, callbacks: l });
      return t.current = f, () => {
        t.current = null, f.dispose();
      };
    }, [a]), o.useEffect(() => {
      var e;
      (e = t.current) == null || e.setOptions(n ?? {});
    }, [n]), o.useEffect(() => {
      var e;
      (e = t.current) == null || e.setCallbacks(l ?? {});
    }, [l]), o.useImperativeHandle(
      c,
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
          snapCameraToView(r, s) {
            e().snapCameraToView(r, s);
          },
          setBitPosition(r, s) {
            e().setBitPosition(r, s);
          },
          setBitVisible(r) {
            e().setBitVisible(r);
          },
          setToolpathRotationA(r) {
            e().setToolpathRotationA(r);
          },
          hideUntilLine(r, s) {
            e().hideUntilLine(r, s);
          },
          seekToLine(r, s) {
            e().seekToLine(r, s);
          },
          showAll() {
            e().showAll();
          },
          resetColors() {
            e().resetColors();
          },
          loadFromUrl(r, s) {
            return e().loadFromUrl(r, s);
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
    ), o.createElement("div", { ref: i, className: m, style: d });
  }
), G = o.forwardRef(
  function(u, c) {
    const { id: a, options: n, className: l, style: m } = u, d = o.useRef(null), i = o.useRef(null);
    return o.useEffect(() => {
      const t = d.current;
      if (!t) return;
      const e = new w(t, n);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), o.useEffect(() => {
      var t;
      n && ((t = i.current) == null || t.setOptions(n));
    }, [n]), o.useImperativeHandle(c, () => {
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
        loadFromPrecomputedGroups: (e) => t().loadFromPrecomputedGroups(e),
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
      ref: d,
      className: l,
      style: { width: "100%", height: "100%", ...m }
    });
  }
);
export {
  G as GCodeSVGVisualizer,
  C as GCodeVisualizer
};
