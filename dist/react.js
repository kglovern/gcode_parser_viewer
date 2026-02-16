import * as r from "react";
import { G as p } from "./GCodeViewer-kCUsrM8M.js";
const F = r.forwardRef(
  function(c, d) {
    const { id: n, options: i, callbacks: l, className: f, style: m } = c, u = r.useRef(null), s = r.useRef(null);
    return r.useEffect(() => {
      const e = u.current;
      if (!e)
        return;
      const a = new p({ id: n, container: e, options: i, callbacks: l });
      return s.current = a, () => {
        s.current = null, a.dispose();
      };
    }, [n]), r.useEffect(() => {
      var e;
      (e = s.current) == null || e.setOptions(i ?? {});
    }, [i]), r.useEffect(() => {
      var e;
      (e = s.current) == null || e.setCallbacks(l ?? {});
    }, [l]), r.useImperativeHandle(
      d,
      () => {
        const e = () => {
          const t = s.current;
          if (!t)
            throw new Error("GCodeViewer is not ready.");
          return t;
        };
        return {
          get id() {
            return n;
          },
          setCallbacks(t) {
            e().setCallbacks(t);
          },
          snapCameraToView(t, o) {
            e().snapCameraToView(t, o);
          },
          setBitPosition(t, o) {
            e().setBitPosition(t, o);
          },
          setBitVisible(t) {
            e().setBitVisible(t);
          },
          setToolpathRotationA(t) {
            e().setToolpathRotationA(t);
          },
          hideUntilLine(t, o) {
            e().hideUntilLine(t, o);
          },
          seekToLine(t, o) {
            e().seekToLine(t, o);
          },
          showAll() {
            e().showAll();
          },
          resetColors() {
            e().resetColors();
          },
          loadFromUrl(t, o) {
            return e().loadFromUrl(t, o);
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
      [n]
    ), r.createElement("div", { ref: u, className: f, style: m });
  }
);
export {
  F as GCodeVisualizer
};
