import { GCodeViewer, defaultGCodeViewerOptions, gCodeViewerThemePresets } from "../src/viewer";
import type { GridUnits } from "../src/viewer";
import { GCodeVirtualizer } from "../src/virtualizer";

const container = document.querySelector<HTMLElement>("#viewer");
if (!container) {
  throw new Error("Missing #viewer container.");
}

const timingElement = document.querySelector<HTMLElement>("#timing");
const progressRoot = document.querySelector<HTMLElement>("#progress");
const progressLabel = document.querySelector<HTMLElement>("#progress-label");
const progressValue = document.querySelector<HTMLElement>("#progress-value");
const progressBar = document.querySelector<HTMLProgressElement>("#progress-bar");
const gridUnitsSelect = document.querySelector<HTMLSelectElement>("#grid-units");
const gridSizeInput = document.querySelector<HTMLInputElement>("#grid-size");
const gridLabelsToggle = document.querySelector<HTMLInputElement>("#grid-labels-toggle");
const boundingBoxToggle = document.querySelector<HTMLInputElement>("#bounding-box-toggle");
const boundingBoxLabelsToggle = document.querySelector<HTMLInputElement>("#bounding-box-labels-toggle");
const laserToggle = document.querySelector<HTMLInputElement>("#laser-toggle");
const simModeHide = document.querySelector<HTMLInputElement>("#sim-mode-hide");
const simModeGrey = document.querySelector<HTMLInputElement>("#sim-mode-grey");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select");
const bitTypeSelect = document.querySelector<HTMLSelectElement>("#bit-type-select");
const toolpathARotationInput = document.querySelector<HTMLInputElement>("#toolpath-a-rotation");
const simLineInput = document.querySelector<HTMLInputElement>("#sim-line");
const simPrevButton = document.querySelector<HTMLButtonElement>("#sim-prev");
const simNextButton = document.querySelector<HTMLButtonElement>("#sim-next");
const simResetButton = document.querySelector<HTMLButtonElement>("#sim-reset");
const simStatus = document.querySelector<HTMLElement>("#sim-status");

const MM_PER_INCH = 25.4;

let lastLoadTimeMs: number | null = null;
let currentFps = 0;

function updateTimingLabel(): void {
  if (!timingElement) {
    return;
  }
  const loadLabel = lastLoadTimeMs === null ? "--" : lastLoadTimeMs.toFixed(1);
  timingElement.textContent = `Load time: ${loadLabel} ms | FPS: ${currentFps.toFixed(0)}`;
}

function startFpsTracker(): void {
  let lastSampleAt = performance.now();
  let frames = 0;

  const tick = () => {
    frames += 1;
    const now = performance.now();
    const elapsed = now - lastSampleAt;
    if (elapsed >= 500) {
      currentFps = (frames * 1000) / elapsed;
      frames = 0;
      lastSampleAt = now;
      updateTimingLabel();
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function setProgressVisible(visible: boolean): void {
  if (!progressRoot) {
    return;
  }
  if (visible) {
    progressRoot.removeAttribute("hidden");
  } else {
    progressRoot.setAttribute("hidden", "true");
  }
}

function setProgressIndeterminate(label: string): void {
  if (progressLabel) {
    progressLabel.textContent = label;
  }
  if (progressValue) {
    progressValue.textContent = "--%";
  }
  if (progressBar) {
    progressBar.removeAttribute("value");
    progressBar.removeAttribute("max");
  }
  setProgressVisible(true);
}

function setProgressDeterminate(label: string, processed: number, total: number): void {
  if (progressLabel) {
    progressLabel.textContent = label;
  }
  if (progressBar) {
    progressBar.max = Math.max(1, total);
    progressBar.value = Math.min(total, Math.max(0, processed));
  }
  if (progressValue) {
    const percentage = total > 0 ? (processed / total) * 100 : 0;
    progressValue.textContent = `${percentage.toFixed(0)}%`;
  }
  setProgressVisible(true);
}

function hideProgress(): void {
  setProgressVisible(false);
}

const urlParams = new URLSearchParams(window.location.search);
const axisDepthParam = urlParams.get("axisDepth");
const bboxParam = urlParams.get("bbox");
const bboxLabelsParam = urlParams.get("bboxLabels");

function gridUnitsFromString(value: string | null | undefined): GridUnits {
  return value === "in" ? "in" : "mm";
}

function gridSizeFromString(value: string | null | undefined, fallback: number): number {
  const parsed = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, parsed);
}

function enabledFromParams(value: string | null | undefined): boolean {
  const normalized = (value ?? "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const initialUnits = gridUnitsFromString(urlParams.get("grid"));
const initialSizeMm = gridSizeFromString(urlParams.get("gridSize"), 1200);
const axisDepthMm = axisDepthParam ? gridSizeFromString(axisDepthParam, initialSizeMm / 2) : initialSizeMm / 2;
const initialGridSizeDisplay = initialUnits === "mm" ? initialSizeMm : initialSizeMm / MM_PER_INCH;
const initialAxisDepthDisplay = initialUnits === "mm" ? axisDepthMm : axisDepthMm / MM_PER_INCH;

function syncGridControls(units: GridUnits, gridSizeDisplay: number): void {
  if (gridUnitsSelect) {
    gridUnitsSelect.value = units;
  }
  if (gridSizeInput) {
    gridSizeInput.value = String(gridSizeDisplay);
    gridSizeInput.step = units === "mm" ? "10" : "0.1";
  }
}

syncGridControls(initialUnits, initialGridSizeDisplay);
if (boundingBoxToggle) {
  boundingBoxToggle.checked = enabledFromParams(bboxParam);
}
if (boundingBoxLabelsToggle) {
  boundingBoxLabelsToggle.checked = enabledFromParams(bboxLabelsParam);
}

const viewer = new GCodeViewer({
  id: "demo",
  container,
  options: {
    ...defaultGCodeViewerOptions,
    units: initialUnits,
    grid: {
      ...defaultGCodeViewerOptions.grid,
      size: initialGridSizeDisplay,
      axisDepth: initialAxisDepthDisplay,
      labels: Boolean(gridLabelsToggle?.checked),
    },
    mode: { laser: Boolean(laserToggle?.checked) },
    boundingBox: {
      visible: Boolean(boundingBoxToggle?.checked),
      labels: Boolean(boundingBoxLabelsToggle?.checked),
    },
  },
  callbacks: {
    onProgress: (event) => {
      if (event.state === "hidden") {
        hideProgress();
        return;
      }
      if (event.state === "indeterminate") {
        setProgressIndeterminate(event.label);
        return;
      }
      setProgressDeterminate(event.label, event.processed, event.total);
    },
  },
});

let loadedLines: string[] = [];
let simPositions: { x: number; y: number; z: number; a?: number }[] = [{ x: 0, y: 0, z: 0, a: 0 }];
let simCursorLine = 1;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdActive = false;
let holdIntervalMs = 260;
let holdDelta = 0;

function getSimMode(): "hide" | "grey" {
  if (simModeGrey?.checked) {
    return "grey";
  }
  return "hide";
}

function clampSimLineIndex(value: number): number {
  const total = loadedLines.length;
  if (total === 0) {
    return 1;
  }
  return Math.max(1, Math.min(total + 1, Math.floor(value)));
}

function updateSimUi(): void {
  const total = loadedLines.length;
  const processed = Math.max(0, Math.min(total, simCursorLine - 1));
  if (simStatus) {
    simStatus.textContent = total > 0 ? `${processed} / ${total}` : "- / -";
  }
  if (simLineInput) {
    simLineInput.value = String(simCursorLine);
    simLineInput.max = total > 0 ? String(total + 1) : "1";
  }
  if (simPrevButton) {
    simPrevButton.disabled = total === 0 || simCursorLine <= 1;
  }
  if (simNextButton) {
    simNextButton.disabled = total === 0 || simCursorLine >= total + 1;
  }
}

function applySimulation(): void {
  if (loadedLines.length === 0) {
    viewer.showAll();
    viewer.resetColors();
    viewer.setBitPosition({ x: 0, y: 0, z: 0, a: 0 }, { immediate: true });
    updateSimUi();
    return;
  }

  const mode = getSimMode();
  viewer.setOptions({ progress: { mode } });
  const processedLineIndex = simCursorLine - 2;
  const bitIndex = Math.max(0, Math.min(simPositions.length - 1, simCursorLine - 1));
  const bit = simPositions[bitIndex] ?? { x: 0, y: 0, z: 0, a: 0 };
  viewer.setBitPosition(bit);
  if (mode === "hide") {
    viewer.resetColors();
    viewer.hideUntilLine(processedLineIndex);
  } else {
    viewer.showAll();
    viewer.hideUntilLine(processedLineIndex);
  }
  updateSimUi();
}

function stepSim(delta: number): boolean {
  const next = clampSimLineIndex(simCursorLine + delta);
  if (next === simCursorLine) {
    return false;
  }
  simCursorLine = next;
  applySimulation();
  return true;
}

function stopHold(): void {
  holdActive = false;
  holdDelta = 0;
  holdIntervalMs = 260;
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

function startHold(delta: number): void {
  stopHold();
  holdActive = true;
  holdDelta = delta;
  holdIntervalMs = 260;

  if (!stepSim(delta)) {
    stopHold();
    return;
  }

  const initialDelayMs = 420;
  holdTimer = setTimeout(() => tickHold(), initialDelayMs);
}

function tickHold(): void {
  if (!holdActive) {
    return;
  }

  if (!stepSim(holdDelta)) {
    stopHold();
    return;
  }

  holdIntervalMs = Math.max(30, Math.floor(holdIntervalMs * 0.86));
  holdTimer = setTimeout(() => tickHold(), holdIntervalMs);
}

function bindHoldButtons(button: HTMLButtonElement | null | undefined, delta: number): void {
  if (!button) {
    return;
  }

  button.addEventListener("pointerdown", (event) => {
    if (button.disabled) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    startHold(delta);
  });

  const stop = () => stopHold();
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("pointerleave", stop);
}

simModeHide?.addEventListener("change", () => applySimulation());
simModeGrey?.addEventListener("change", () => applySimulation());

themeSelect?.addEventListener("change", () => {
  const value = themeSelect.value as keyof typeof gCodeViewerThemePresets;
  const preset = gCodeViewerThemePresets[value];
  if (!preset) {
    return;
  }
  viewer.setOptions({ render: { theme: preset } });
});

bitTypeSelect?.addEventListener("change", () => {
  const value = bitTypeSelect.value;
  if (value !== "circle" && value !== "triangle") {
    return;
  }
  viewer.setOptions({ bit: { type: value } });
});

function applyToolpathARotationInput(): void {
  if (!toolpathARotationInput) {
    return;
  }
  viewer.setToolpathRotationA(Number(toolpathARotationInput.value) || 0);
}

toolpathARotationInput?.addEventListener("change", () => applyToolpathARotationInput());
toolpathARotationInput?.addEventListener("input", () => applyToolpathARotationInput());

bindHoldButtons(simPrevButton, -1);
bindHoldButtons(simNextButton, 1);

simResetButton?.addEventListener("click", () => {
  stopHold();
  simCursorLine = 1;
  viewer.showAll();
  viewer.resetColors();
  viewer.setBitPosition(simPositions[0] ?? { x: 0, y: 0, z: 0, a: 0 }, { immediate: true });
  updateSimUi();
});

simLineInput?.addEventListener("change", () => {
  stopHold();
  simCursorLine = clampSimLineIndex(Number(simLineInput.value));
  applySimulation();
});
simLineInput?.addEventListener("input", () => {
  stopHold();
  simCursorLine = clampSimLineIndex(Number(simLineInput.value));
  applySimulation();
});

gridUnitsSelect?.addEventListener("change", () => {
  const units = gridUnitsFromString(gridUnitsSelect.value);
  const previous = viewer.getOptions().units;
  const conversion =
    previous === units ? 1 : previous === "mm" && units === "in" ? 1 / MM_PER_INCH : MM_PER_INCH;
  const current = viewer.getOptions().grid;
  viewer.setOptions({
    units,
    grid: { size: current.size * conversion, axisDepth: current.axisDepth * conversion },
  });

  const displaySize = current.size * conversion;
  syncGridControls(units, displaySize);
});

function applySizeInput(): void {
  if (!gridSizeInput) {
    return;
  }
  const displaySize = gridSizeFromString(gridSizeInput.value, 400);
  viewer.setOptions({ grid: { size: displaySize } });
}

gridSizeInput?.addEventListener("change", () => applySizeInput());
gridSizeInput?.addEventListener("input", () => applySizeInput());

gridLabelsToggle?.addEventListener("change", () => {
  viewer.setOptions({ grid: { labels: Boolean(gridLabelsToggle.checked) } });
});

boundingBoxToggle?.addEventListener("change", () => {
  viewer.setOptions({ boundingBox: { visible: Boolean(boundingBoxToggle.checked) } });
});

boundingBoxLabelsToggle?.addEventListener("change", () => {
  viewer.setOptions({ boundingBox: { labels: Boolean(boundingBoxLabelsToggle.checked) } });
});

laserToggle?.addEventListener("change", () => {
  viewer.setOptions({ mode: { laser: Boolean(laserToggle.checked) } });
});

async function loadGCodeUrl(url: string): Promise<void> {
  const startTime = performance.now();
  setProgressIndeterminate("Loading file...");

  const response = await fetch(url);
  if (!response.ok) {
    hideProgress();
    throw new Error(`Failed to load gcode: ${response.statusText}`);
  }
  const text = await response.text();

  await viewer.loadFromText(text);
  viewer.focusToModel();
  loadedLines = text.split(/\r?\n/);
  simPositions = buildSimPositions(loadedLines);
  simCursorLine = 1;
  viewer.showAll();
  viewer.resetColors();
  viewer.setBitPosition(simPositions[0] ?? { x: 0, y: 0, z: 0, a: 0 }, { immediate: true });
  updateSimUi();

  const elapsed = performance.now() - startTime;
  lastLoadTimeMs = elapsed;
  updateTimingLabel();
  console.log(`Parsed ${url} in ${elapsed.toFixed(1)}ms`);
}

async function loadGCodeFile(file: File): Promise<void> {
  const startTime = performance.now();
  setProgressIndeterminate("Loading file...");

  const text = await file.text();
  await viewer.loadFromText(text);
  viewer.focusToModel();
  loadedLines = text.split(/\r?\n/);
  simPositions = buildSimPositions(loadedLines);
  simCursorLine = 1;
  viewer.showAll();
  viewer.resetColors();
  viewer.setBitPosition(simPositions[0] ?? { x: 0, y: 0, z: 0, a: 0 }, { immediate: true });
  updateSimUi();

  const elapsed = performance.now() - startTime;
  lastLoadTimeMs = elapsed;
  updateTimingLabel();
  console.log(`Parsed ${file.name} in ${elapsed.toFixed(1)}ms`);
}

const fileInput = document.querySelector<HTMLInputElement>("#file-input");
fileInput?.addEventListener("change", async (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  await loadGCodeFile(file);
});

loadGCodeUrl("../fixtures/jsdc.gcode").catch((error) => {
  console.error(error);
});

updateSimUi();
window.addEventListener("blur", () => stopHold());
startFpsTracker();
updateTimingLabel();

function buildSimPositions(lines: readonly string[]): { x: number; y: number; z: number; a?: number }[] {
  const virtualizer = new GCodeVirtualizer();
  const result: { x: number; y: number; z: number; a?: number }[] = new Array(lines.length + 1);
  result[0] = { x: 0, y: 0, z: 0, a: 0 };
  for (let i = 0; i < lines.length; i += 1) {
    virtualizer.processLine(lines[i] ?? "");
    const pos = virtualizer.getPosition();
    result[i + 1] = { x: pos.X, y: pos.Y, z: pos.Z, a: pos.A };
  }
  return result;
}
