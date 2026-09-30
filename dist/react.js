import * as n from "react";
import { a as w, G as C } from "./GCodeSVGRenderer-DaYpG5UE.js";
const g = n.forwardRef(
  function(c, m) {
    const { id: a, options: s, callbacks: l, className: f, style: u } = c, i = n.useRef(null), t = n.useRef(null);
    return n.useEffect(() => {
      const e = i.current;
      if (!e)
        return;
      const d = new w({ id: a, container: e, options: s, callbacks: l });
      return t.current = d, () => {
        t.current = null, d.dispose();
      };
    }, [a]), n.useEffect(() => {
      var e;
      (e = t.current) == null || e.setOptions(s ?? {});
    }, [s]), n.useEffect(() => {
      var e;
      (e = t.current) == null || e.setCallbacks(l ?? {});
    }, [l]), n.useImperativeHandle(
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
          snapCameraToView(r, o) {
            e().snapCameraToView(r, o);
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
          screenToWorld(r, o, p) {
            return e().screenToWorld(r, o, p);
          },
          worldToScreen(r, o, p) {
            return e().worldToScreen(r, o, p);
          },
          setBitPosition(r, o) {
            e().setBitPosition(r, o);
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
          hideUntilLine(r, o) {
            e().hideUntilLine(r, o);
          },
          seekToLine(r, o) {
            e().seekToLine(r, o);
          },
          showAll() {
            e().showAll();
          },
          resetColors() {
            e().resetColors();
          },
          loadFromUrl(r, o) {
            return e().loadFromUrl(r, o);
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
          loadFromSegments(r, o) {
            return e().loadFromSegments(r, o);
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
    ), n.createElement("div", { ref: i, className: f, style: u });
  }
), G = n.forwardRef(
  function(c, m) {
    const { id: a, options: s, className: l, style: f } = c, u = n.useRef(null), i = n.useRef(null);
    return n.useEffect(() => {
      const t = u.current;
      if (!t) return;
      const e = new C(t, s);
      return i.current = e, () => {
        i.current = null, e.dispose();
      };
    }, []), n.useEffect(() => {
      var t;
      s && ((t = i.current) == null || t.setOptions(s));
    }, [s]), n.useImperativeHandle(m, () => {
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
        loadFromSegments: (e) => t().loadFromSegments(e),
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
    }, []), n.createElement("div", {
      ref: u,
      className: l,
      style: { width: "100%", height: "100%", ...f }
    });
  }
);
export {
  G as GCodeSVGVisualizer,
  g as GCodeVisualizer
};
