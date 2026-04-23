import * as React from "react";
import { createRoot } from "react-dom/client";
import { GCodeSVGVisualizer } from "../src/svg-react/GCodeSVGVisualizer";
import type { GCodeSVGVisualizerHandle } from "../src/svg-react/GCodeSVGVisualizer";

function App() {
  const ref = React.useRef(null) as { current: GCodeSVGVisualizerHandle | null };
  const [filename, setFilename] = React.useState<string | null>(null);
  const [projection, setProjection] = React.useState<'isometric' | 'perspective'>('isometric');

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setFilename(file.name);
    ref.current?.loadFromFile(file);
    (e.target as HTMLInputElement).value = "";
  }

  function onReset() {
    ref.current?.resetView();
  }

  function onToggleProjection() {
    const next = projection === 'isometric' ? 'perspective' : 'isometric';
    setProjection(next);
    ref.current?.setProjectionMode(next);
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(GCodeSVGVisualizer as any, {
      ref,
      style: { width: "100%", height: "100%", position: "absolute", inset: 0 },
    }),
    React.createElement(
      "div",
      { className: "controls" },
      React.createElement(
        "label",
        { className: "file-btn" },
        React.createElement("input", {
          type: "file",
          accept: ".gcode,.nc,.tap,.txt",
          onChange: onFileChange,
          style: { display: "none" },
        }),
        "Load GCode"
      ),
      filename && React.createElement("span", { className: "filename" }, filename),
      React.createElement(
        "button",
        { className: "ctrl-btn", onClick: onReset, type: "button" },
        "Reset View"
      ),
      React.createElement(
        "button",
        { className: "ctrl-btn", onClick: onToggleProjection, type: "button" },
        projection === 'isometric' ? "Perspective" : "Isometric"
      ),
      React.createElement(
        "div",
        { className: "legend" },
        React.createElement("span", { className: "legend-rapid" }, "G0 Rapid"),
        React.createElement("span", { className: "legend-cut" }, "G1/G2/G3 Cut")
      ),
      React.createElement(
        "div",
        { className: "hint-text" },
        "Drag to orbit · Shift+drag or right-drag to pan · Scroll to zoom"
      )
    )
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(React.createElement(App));
