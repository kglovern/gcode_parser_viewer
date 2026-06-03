import * as t from "react";
import { a as F, G as w } from "./GCodeSVGRenderer-DUQ-WgJi.js";
const C = t.forwardRef(
  function(u, c) {
    const { id: a, options: n, callbacks: l, className: m, style: d } = u, i = t.useRef(null), o = t.useRef(null);
    return t.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const f = new F({ id: a, container: e, options: n, callbacks: l });
      return o.current = f, () => {
        o.current = null, f.dispose();
      };
    }, [a]), t.useEffect(() => {
      var e;
      (e = o.current) == null || e.setOptions(n ?? {});
    }, [n]), t.useEffect(() => {
      var e;
      (e = o.current) == null || e.setCallbacks(l ?? {});
    }, [l]), t.useImperativeHandle(
      c,
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
    ), t.createElement("div", { ref: i, className: m, style: d });
  }
), G = t.forwardRef(
  function(u, c) {
    const { id: a, options: n, className: l, style: m } = u, d = t.useRef(null), i = t.useRef(null);
    return t.useEffect(() => {
      const o = d.current;
      if (!o) return;
      const e = new w(o, n);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), t.useEffect(() => {
      var o;
      n && ((o = i.current) == null || o.setOptions(n));
    }, [n]), t.useImperativeHandle(c, () => {
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
        loadFromPrecomputedGroups: (e) => o().loadFromPrecomputedGroups(e),
        clear: () => o().clear(),
        resetView: () => o().resetView(),
        setOptions: (e) => o().setOptions(e),
        setProjectionMode: (e) => o().setProjectionMode(e),
        getSVGElement: () => o().getSVGElement(),
        dispose: () => o().dispose()
      };
    }, []), t.createElement("div", {
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
