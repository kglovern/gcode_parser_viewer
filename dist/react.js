import * as o from "react";
import { a as w, G as V } from "./GCodeSVGRenderer-COAZHkLX.js";
const G = o.forwardRef(
  function(c, m) {
    const { id: l, options: n, callbacks: a, className: f, style: u } = c, i = o.useRef(null), t = o.useRef(null);
    return o.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const d = new w({ id: l, container: e, options: n, callbacks: a });
      return t.current = d, () => {
        t.current = null, d.dispose();
      };
    }, [l]), o.useEffect(() => {
      var e;
      (e = t.current) == null || e.setOptions(n ?? {});
    }, [n]), o.useEffect(() => {
      var e;
      (e = t.current) == null || e.setCallbacks(a ?? {});
    }, [a]), o.useImperativeHandle(
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
            return l;
          },
          setCallbacks(r) {
            e().setCallbacks(r);
          },
          snapCameraToView(r, s) {
            e().snapCameraToView(r, s);
          },
          setRotateEnabled(r) {
            e().setRotateEnabled(r);
          },
          setCameraFollowEnabled(r) {
            e().setCameraFollowEnabled(r);
          },
          screenToWorld(r, s, p) {
            return e().screenToWorld(r, s, p);
          },
          worldToScreen(r, s, p) {
            return e().worldToScreen(r, s, p);
          },
          setBitPosition(r, s) {
            e().setBitPosition(r, s);
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
      [l]
    ), o.createElement("div", { ref: i, className: f, style: u });
  }
), R = o.forwardRef(
  function(c, m) {
    const { id: l, options: n, className: a, style: f } = c, u = o.useRef(null), i = o.useRef(null);
    return o.useEffect(() => {
      const t = u.current;
      if (!t) return;
      const e = new V(t, n);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), o.useEffect(() => {
      var t;
      n && ((t = i.current) == null || t.setOptions(n));
    }, [n]), o.useImperativeHandle(m, () => {
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
      ref: u,
      className: a,
      style: { width: "100%", height: "100%", ...f }
    });
  }
);
export {
  R as GCodeSVGVisualizer,
  G as GCodeVisualizer
};
