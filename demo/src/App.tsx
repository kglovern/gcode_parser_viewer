import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { GCodeVisualizer, GCodeSVGVisualizer, type GCodeSVGRendererHandle } from "@src/react";
import { gCodeViewerThemePresets, type GCodeViewerThemePresetName } from "@src/viewer/themes";
import type { GCodeViewerHandle, GCodeViewerOptions, GCodeViewerCallbacks } from "@src/viewer/types";
import { GCodeVirtualizer } from "@src/virtualizer";
import "@src/viewer/viewcube.css";
import { PendantView, type PendantBed, type PendantViewHandle } from "./PendantView";
import type { PendantData } from "./pendantData";
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

type ViewKind = "3d" | "svg" | "pendant";

type ProgressState =
  | { state: "hidden" }
  | { state: "indeterminate"; label: string }
  | { state: "determinate"; label: string; pct: number };

export default function App() {
  const ref = useRef<GCodeViewerHandle>(null);
  const svgRef = useRef<GCodeSVGRendererHandle>(null);
  const gcodeTextRef = useRef<string>("");
  const linePositionsRef = useRef<Float32Array | null>(null);
  const pendantRef = useRef<PendantViewHandle>(null);
  const [view, setView] = useState<ViewKind>("3d");
  const svgMode = view === "svg";
  const [gcodeText, setGcodeText] = useState("");
  const [pendantData, setPendantData] = useState<PendantData | null>(null);
  const [pendantBed, setPendantBed] = useState<PendantBed>({
    visible: true,
    width: 800,
    depth: 800,
    offsetX: -100,
    offsetY: -100,
  });
  const [crosshairPx, setCrosshairPx] = useState(26);

  // There is no machine in the demo, so stand a bed in around each new
  // toolpath (with a margin) where it will be in view. The fields stay editable.
  const handlePendantData = useCallback((data: PendantData | null) => {
    setPendantData(data);
    const b = data?.bounds;
    if (!b) return;
    const margin = Math.max(10, Math.round(Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.15));
    setPendantBed((prev) => ({
      ...prev,
      offsetX: Math.floor(b.minX - margin),
      offsetY: Math.floor(b.minY - margin),
      width: Math.ceil(b.maxX - b.minX + margin * 2),
      depth: Math.ceil(b.maxY - b.minY + margin * 2),
    }));
  }, []);
  const [originPx, setOriginPx] = useState(9);
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

  function buildLinePositions(lines: string[]): Float32Array {
    const count = lines.length;
    const positions = new Float32Array(count * 3);
    let lastX = 0, lastY = 0, lastZ = 0;
    const virtualizer = new GCodeVirtualizer({
      onLinearMove: (args) => {
        const end = args.transformedEnd ?? args.end;
        lastX = end.X; lastY = end.Y; lastZ = end.Z;
      },
      onArcMove: (args) => {
        const end = args.transformedEnd ?? args.end;
        lastX = end.X; lastY = end.Y; lastZ = end.Z;
      },
    });
    for (let i = 0; i < count; i++) {
      if (lines[i]) virtualizer.processLine(lines[i]);
      positions[i * 3] = lastX;
      positions[i * 3 + 1] = lastY;
      positions[i * 3 + 2] = lastZ;
    }
    return positions;
  }

  const updateSvgCrosshair = useCallback((lineIndex: number, bitType?: string) => {
    const type = bitType ?? options.bit?.type;
    const pos = linePositionsRef.current;
    if (!svgRef.current || !pos || type !== "crosshair") {
      svgRef.current?.setBitVisible(false);
      return;
    }
    const i = Math.min(lineIndex, (pos.length / 3) - 1);
    svgRef.current.setBitPosition({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] });
  }, [options.bit?.type]);

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

  // Sync SVG crosshair visibility when bit type changes
  useEffect(() => {
    if (options.bit?.type === "crosshair" && currentLine > 0) {
      updateSvgCrosshair(currentLine, "crosshair");
    } else {
      svgRef.current?.setBitVisible(false);
    }
  }, [options.bit?.type]);

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
      const lines = text.split(/\r?\n/);
      linePositionsRef.current = buildLinePositions(lines);
      svgRef.current?.loadFromText(text);
      setGcodeText(text);
    };
    reader.readAsText(file);

    ref.current?.loadFromFile(file).then(() => {
      ref.current?.focusToModel();
    });
  }

  function handleView(next: ViewKind) {
    setView(next);
    if (next === "3d") setTimeout(() => ref.current?.resize(), 0);
  }

  function patchBed(patch: Partial<PendantBed>) {
    setPendantBed((prev) => ({ ...prev, ...patch }));
  }

  // The pendant crosshair follows the sim line, standing in for the DRO.
  const pendantBit = useMemo(() => {
    const pos = linePositionsRef.current;
    if (!pos || pos.length === 0) return null;
    const i = Math.min(currentLine, pos.length / 3 - 1);
    return { x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] };
  }, [currentLine, gcodeText]);

  function handleSvgProjectionToggle() {
    const next = svgProjection === 'isometric' ? 'perspective' : 'isometric';
    setSvgProjection(next);
    svgRef.current?.setProjectionMode(next);
  }

  function handleLineInput(val: string) {
    setLineInput(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0) {
      const clamped = Math.min(n, totalLines);
      setCurrentLine(clamped);
      ref.current?.seekToLine(clamped, options.progress?.mode);
      updateSvgCrosshair(clamped);
    }
  }

  function stepLine(delta: number) {
    const next = Math.max(0, Math.min(currentLine + delta, totalLines));
    setCurrentLine(next);
    setLineInput(String(next));
    ref.current?.seekToLine(next, options.progress?.mode);
    updateSvgCrosshair(next);
  }

  function handleReset() {
    ref.current?.showAll();
    setCurrentLine(0);
    setLineInput("0");
    svgRef.current?.setBitVisible(false);
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
        <div className="view-switch" role="group" aria-label="Renderer">
          {(["3d", "svg", "pendant"] as const).map((kind) => (
            <button
              key={kind}
              className={`view-switch__btn${view === kind ? " active" : ""}`}
              aria-pressed={view === kind}
              onClick={() => handleView(kind)}
            >
              {kind === "3d" ? "3D" : kind === "svg" ? "SVG" : "Pendant"}
            </button>
          ))}
        </div>
        {svgMode && (
          <>
            <button className="reset-btn" onClick={handleSvgProjectionToggle}>
              {svgProjection === 'isometric' ? 'Projection: Isometric' : 'Projection: Perspective'}
            </button>
            <button className="reset-btn" onClick={() => svgRef.current?.resetView()}>
              Reset View
            </button>
            <div className="svg-legend">
              <span className="svg-legend__swatch" style={{ background: "#0ef6ae" }} />
              G0 Rapid
              <span className="svg-legend__swatch" style={{ background: "#3e85c7", marginLeft: 8 }} />
              G1/G2/G3 Cut
            </div>
            <div className="svg-hint">Drag to pan · Scroll to zoom</div>
          </>
        )}
        {view === "pendant" && (
          <>
            <button className="reset-btn" onClick={() => pendantRef.current?.fit()}>
              Fit to Toolpath
            </button>
            <div className="svg-hint">
              Locked top-down WebGL fed Z-deduped 2D segments. Drag or one finger pans; scroll or pinch zooms.
              The crosshair follows the Sim Line.
            </div>
            {pendantData && (
              <div className="pendant-stats">
                <div>
                  Segments {pendantData.stats.kept.toLocaleString()} of{" "}
                  {pendantData.stats.rawSegments.toLocaleString()}
                </div>
                <div>
                  Dropped {pendantData.stats.duplicates.toLocaleString()} repeats,{" "}
                  {pendantData.stats.degenerate.toLocaleString()} Z-only
                </div>
                <div>
                  Z {pendantData.meta.minZ.toFixed(2)} to {pendantData.meta.maxZ.toFixed(2)}, built in{" "}
                  {pendantData.stats.buildMs.toFixed(0)} ms
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {view === "pendant" && (
        <section>
          <label className="section-label">Pendant</label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={pendantBed.visible}
              onChange={(e) => patchBed({ visible: e.target.checked })}
            />
            Machine bed
          </label>
          {pendantBed.visible && (
            <>
              <label className="number-label">
                Bed width (mm)
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={pendantBed.width}
                  onChange={(e) => patchBed({ width: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="number-label">
                Bed depth (mm)
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={pendantBed.depth}
                  onChange={(e) => patchBed({ depth: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="number-label">
                Bed corner X (work)
                <input
                  type="number"
                  step={10}
                  value={pendantBed.offsetX}
                  onChange={(e) => patchBed({ offsetX: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="number-label">
                Bed corner Y (work)
                <input
                  type="number"
                  step={10}
                  value={pendantBed.offsetY}
                  onChange={(e) => patchBed({ offsetY: Number(e.target.value) || 0 })}
                />
              </label>
            </>
          )}
          <label className="number-label">
            Crosshair (px)
            <input
              type="number"
              min={8}
              max={80}
              step={2}
              value={crosshairPx}
              onChange={(e) => setCrosshairPx(Number(e.target.value) || 26)}
            />
          </label>
          <label className="number-label">
            Origin dot (px)
            <input
              type="number"
              min={3}
              max={30}
              step={1}
              value={originPx}
              onChange={(e) => setOriginPx(Number(e.target.value) || 9)}
            />
          </label>
        </section>
      )}

      <section>
        <label className="section-label">Camera</label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={options.camera?.projection === "orthographic"}
            onChange={(e) =>
              patchOptions({
                camera: { projection: e.target.checked ? "orthographic" : "perspective" },
              } as Partial<GCodeViewerOptions>)
            }
          />
          Orthographic
        </label>
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
            <option value="crosshair">crosshair</option>
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
        <div style={{ width: "100%", height: "100%", display: view === "3d" ? "block" : "none" }}>
          <GCodeVisualizer id="demo" ref={ref} options={options} callbacks={callbacks} style={{ width: "100%", height: "100%" }} />
        </div>
        <div style={{ width: "100%", height: "100%", display: svgMode ? "block" : "none" }}>
          <GCodeSVGVisualizer id="demo-svg" ref={svgRef} options={{ projectionMode: svgProjection }} />
        </div>
        <div style={{ width: "100%", height: "100%", display: view === "pendant" ? "block" : "none" }}>
          <PendantView
            ref={pendantRef}
            text={gcodeText}
            bit={pendantBit}
            bed={pendantBed}
            crosshairPx={crosshairPx}
            originPx={originPx}
            theme={gCodeViewerThemePresets[selectedTheme]}
            onData={handlePendantData}
          />
        </div>
        {view === "3d" && loadProgress.state !== "hidden" && (
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
