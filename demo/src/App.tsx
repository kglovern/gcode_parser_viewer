import { useRef, useState, useMemo, useEffect } from "react";
import { GCodeVisualizer, GCodeSVGVisualizer, type GCodeSVGRendererHandle } from "@src/react";
import { gCodeViewerThemePresets, type GCodeViewerThemePresetName } from "@src/viewer/themes";
import type { GCodeViewerHandle, GCodeViewerOptions, GCodeViewerCallbacks } from "@src/viewer/types";
import "@src/viewer/viewcube.css";
import "./App.css";

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const result = { ...base };
  for (const key in patch) {
    const patchVal = patch[key];
    const baseVal = base[key];
    if (
      patchVal !== null &&
      typeof patchVal === "object" &&
      !Array.isArray(patchVal) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      (result as Record<string, unknown>)[key] = { ...(baseVal as object), ...(patchVal as object) };
    } else {
      (result as Record<string, unknown>)[key] = patchVal;
    }
  }
  return result;
}

type Options = Partial<GCodeViewerOptions>;

type ProgressState =
  | { state: "hidden" }
  | { state: "indeterminate"; label: string }
  | { state: "determinate"; label: string; pct: number };

export default function App() {
  const ref = useRef<GCodeViewerHandle>(null);
  const svgRef = useRef<GCodeSVGRendererHandle>(null);
  const gcodeTextRef = useRef<string>("");
  const [svgMode, setSvgMode] = useState(false);
  const [svgProjection, setSvgProjection] = useState<'isometric' | 'perspective'>('isometric');
  const [options, setOptions] = useState<Options>({
    render: { antialias: true, theme: gCodeViewerThemePresets["dark"] },
    progress: { mode: "grey" },
  });
  const [selectedTheme, setSelectedTheme] = useState<GCodeViewerThemePresetName>("dark");
  const [totalLines, setTotalLines] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const [lineInput, setLineInput] = useState("0");
  const [aRotation, setARotation] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadProgress, setLoadProgress] = useState<ProgressState>({ state: "hidden" });

  function patchOptions(patch: Partial<GCodeViewerOptions>) {
    setOptions((prev) => deepMerge(prev as Record<string, unknown>, patch as Record<string, unknown>) as Options);
  }

  const callbacks = useMemo<GCodeViewerCallbacks>(
    () => ({
      onProgress(event) {
        if (event.state === "determinate") {
          setTotalLines(event.total);
          setLoadProgress({
            state: "determinate",
            label: event.label,
            pct: event.total > 0 ? event.processed / event.total : 0,
          });
        } else if (event.state === "indeterminate") {
          setLoadProgress({ state: "indeterminate", label: event.label });
        } else {
          setLoadProgress({ state: "hidden" });
        }
      },
    }),
    []
  );

  // Re-apply sim position when mode changes
  useEffect(() => {
    if (currentLine > 0 && ref.current) {
      ref.current.seekToLine(currentLine, options.progress?.mode);
    }
  }, [options.progress?.mode]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTotalLines(0);
    setCurrentLine(0);
    setLineInput("0");

    // Read as text for the SVG renderer; load into 3D viewer in parallel
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = typeof ev.target?.result === "string" ? ev.target.result : "";
      gcodeTextRef.current = text;
      svgRef.current?.loadFromText(text);
    };
    reader.readAsText(file);

    ref.current?.loadFromFile(file).then(() => {
      ref.current?.focusToModel();
    });
  }

  function handleToggleSvgMode() {
    setSvgMode((prev) => {
      const next = !prev;
      if (!next) setTimeout(() => ref.current?.resize(), 0);
      return next;
    });
  }

  function handleSvgProjectionToggle() {
    const next = svgProjection === 'isometric' ? 'perspective' : 'isometric';
    setSvgProjection(next);
    svgRef.current?.setProjectionMode(next);
  }

  function handleLineInput(val: string) {
    setLineInput(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0 && ref.current) {
      const clamped = Math.min(n, totalLines);
      setCurrentLine(clamped);
      ref.current.seekToLine(clamped, options.progress?.mode);
    }
  }

  function stepLine(delta: number) {
    if (!ref.current) return;
    const next = Math.max(0, Math.min(currentLine + delta, totalLines));
    setCurrentLine(next);
    setLineInput(String(next));
    ref.current.seekToLine(next, options.progress?.mode);
  }

  function handleReset() {
    if (!ref.current) return;
    ref.current.showAll();
    setCurrentLine(0);
    setLineInput("0");
  }

  function handleARotation(val: string) {
    const n = parseFloat(val);
    setARotation(isNaN(n) ? 0 : n);
    if (ref.current) ref.current.setToolpathRotationA(isNaN(n) ? 0 : n);
  }

  function handleTheme(name: GCodeViewerThemePresetName) {
    setSelectedTheme(name);
    patchOptions({ render: { antialias: true, theme: gCodeViewerThemePresets[name] } });
  }

  const simDisabled = totalLines === 0;
  const progressMode = options.progress?.mode ?? "grey";

  const panel = (
    <div className={`control-panel${panelOpen ? " open" : ""}`}>
      <h2 className="panel-title">gviewer demo</h2>

      <section>
        <label className="section-label">Load File</label>
        <input
          type="file"
          accept=".gcode,.nc,.tap,.txt"
          onChange={handleFile}
          className="file-input"
        />
      </section>

      <section>
        <label className="section-label">View</label>
        <button className="reset-btn" onClick={handleToggleSvgMode}>
          {svgMode ? "Switch to 3D View" : "Switch to SVG View"}
        </button>
        {svgMode && (
          <>
            <button className="reset-btn" onClick={handleSvgProjectionToggle}>
              {svgProjection === 'isometric' ? 'Projection: Isometric' : 'Projection: Perspective'}
            </button>
            <button className="reset-btn" onClick={() => svgRef.current?.resetView()}>
              Reset View
            </button>
            <div className="svg-legend">
              <span className="svg-legend__swatch" style={{ background: "#4a9eff" }} />
              G0 Rapid
              <span className="svg-legend__swatch" style={{ background: "#e05c00", marginLeft: 8 }} />
              G1/G2/G3 Cut
            </div>
            <div className="svg-hint">Drag · Shift+drag to pan · Scroll to zoom</div>
          </>
        )}
      </section>

      <section>
        <label className="section-label">Mode</label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={options.mode?.laser ?? false}
            onChange={(e) => patchOptions({ mode: { laser: e.target.checked } })}
          />
          Laser Mode
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={options.mode?.sim3d ?? false}
            onChange={(e) => patchOptions({ mode: { sim3d: e.target.checked } })}
          />
          3D Simulation
        </label>
        {(options.mode?.sim3d ?? false) && (
          <>
            <label className="number-label">
              Tool Diameter (mm)
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={options.sim3d?.toolDiameter ?? 6.35}
                onChange={(e) =>
                  patchOptions({ sim3d: { toolDiameter: Number(e.target.value) } })
                }
              />
            </label>
            <label className="number-label">
              Erosion Passes
              <input
                type="number"
                min={0}
                max={4}
                step={1}
                value={options.sim3d?.erosionPasses ?? 2}
                onChange={(e) =>
                  patchOptions({ sim3d: { erosionPasses: Number(e.target.value) } })
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={options.sim3d?.showToolpath ?? false}
                onChange={(e) =>
                  patchOptions({ sim3d: { showToolpath: e.target.checked } })
                }
              />
              Show Toolpath
            </label>
          </>
        )}
      </section>

      <section>
        <label className="section-label">Bounding Box</label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={options.boundingBox?.visible ?? false}
            onChange={(e) =>
              patchOptions({ boundingBox: { visible: e.target.checked, labels: options.boundingBox?.labels ?? false } })
            }
          />
          Visible
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={options.boundingBox?.labels ?? false}
            onChange={(e) =>
              patchOptions({ boundingBox: { visible: options.boundingBox?.visible ?? false, labels: e.target.checked } })
            }
          />
          Labels
        </label>
      </section>

      <section>
        <label className="section-label">Grid</label>
        <label className="select-label">
          Units
          <select
            value={options.units ?? "mm"}
            onChange={(e) => patchOptions({ units: e.target.value as "mm" | "in" })}
          >
            <option value="mm">mm</option>
            <option value="in">in</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={options.grid?.labels ?? true}
            onChange={(e) =>
              patchOptions({ grid: { size: options.grid?.size ?? 1000, axisDepth: options.grid?.axisDepth ?? 200, labels: e.target.checked } })
            }
          />
          Labels
        </label>
        <label className="number-label">
          Size
          <input
            type="number"
            min={50}
            max={2000}
            step={50}
            value={options.grid?.size ?? 1000}
            onChange={(e) =>
              patchOptions({
                grid: {
                  size: Number(e.target.value),
                  axisDepth: options.grid?.axisDepth ?? 200,
                  labels: options.grid?.labels ?? true,
                },
              })
            }
          />
        </label>
      </section>

      <section>
        <label className="section-label">Theme</label>
        <select
          value={selectedTheme}
          onChange={(e) => handleTheme(e.target.value as GCodeViewerThemePresetName)}
          className="full-select"
        >
          {(Object.keys(gCodeViewerThemePresets) as GCodeViewerThemePresetName[]).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </section>

      <section>
        <label className="section-label">Bit</label>
        <label className="select-label">
          Type
          <select
            value={options.bit?.type ?? "drill"}
            onChange={(e) =>
              patchOptions({ bit: { ...(options.bit as object), type: e.target.value as GCodeViewerOptions["bit"]["type"] } as GCodeViewerOptions["bit"] })
            }
          >
            <option value="drill">drill</option>
            <option value="laser">laser</option>
            <option value="circle">circle</option>
            <option value="triangle">triangle</option>
          </select>
        </label>
      </section>

      <section>
        <label className="section-label">A Rotation (°)</label>
        <input
          type="number"
          step={5}
          value={aRotation}
          onChange={(e) => handleARotation(e.target.value)}
          className="full-number"
        />
      </section>

      <section>
        <label className="section-label">Sim Mode</label>
        <label className="radio-label">
          <input
            type="radio"
            name="sim-mode"
            value="grey"
            checked={progressMode === "grey"}
            onChange={() => patchOptions({ progress: { mode: "grey" } })}
          />
          Grey
        </label>
        <label className="radio-label">
          <input
            type="radio"
            name="sim-mode"
            value="hide"
            checked={progressMode === "hide"}
            onChange={() => patchOptions({ progress: { mode: "hide" } })}
          />
          Hide
        </label>
      </section>

      <section>
        <label className="section-label">
          Sim Line{totalLines > 0 ? ` / ${totalLines}` : ""}
        </label>
        <div className="sim-row">
          <button onClick={() => stepLine(-100)} disabled={simDisabled} title="-100">
            «
          </button>
          <button onClick={() => stepLine(-1)} disabled={simDisabled} title="-1">
            ‹
          </button>
          <input
            type="number"
            min={0}
            max={totalLines}
            value={lineInput}
            disabled={simDisabled}
            onChange={(e) => handleLineInput(e.target.value)}
            className="line-input"
          />
          <button onClick={() => stepLine(1)} disabled={simDisabled} title="+1">
            ›
          </button>
          <button onClick={() => stepLine(100)} disabled={simDisabled} title="+100">
            »
          </button>
        </div>
        <button onClick={handleReset} disabled={simDisabled} className="reset-btn">
          Reset
        </button>
      </section>
    </div>
  );

  return (
    <div className="app-layout">
      <div className="viewer-area">
        <div style={{ width: "100%", height: "100%", display: svgMode ? "none" : "block" }}>
          <GCodeVisualizer id="demo" ref={ref} options={options} callbacks={callbacks} style={{ width: "100%", height: "100%" }} />
        </div>
        <div style={{ width: "100%", height: "100%", display: svgMode ? "block" : "none" }}>
          <GCodeSVGVisualizer id="demo-svg" ref={svgRef} options={{ projectionMode: svgProjection }} />
        </div>
        {!svgMode && loadProgress.state !== "hidden" && (
          <div className="load-overlay">
            <div className="load-bar-wrap">
              <div className="load-label">{loadProgress.label}</div>
              {loadProgress.state === "determinate" ? (
                <div className="load-track">
                  <div
                    className="load-fill"
                    style={{ width: `${Math.round(loadProgress.pct * 100)}%` }}
                  />
                </div>
              ) : (
                <div className="load-track">
                  <div className="load-fill load-indeterminate" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {panel}
      <button
        className="panel-toggle"
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Toggle controls"
      >
        {panelOpen ? "✕" : "⚙"}
      </button>
    </div>
  );
}
