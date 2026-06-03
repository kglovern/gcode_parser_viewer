# gviewer

TypeScript library for parsing, virtualizing, and visualizing GCode toolpaths. Built on Three.js with an optional React wrapper.

## Installation

```bash
npm install @sienci/gviewer
```

Peer dependencies — install whichever you need:

```bash
npm install three             # required for the viewer
npm install react react-dom   # required for the React component
```

---

## Import paths

| Path | Contents |
|---|---|
| `@sienci/gviewer` | Parser, virtualizer, geometry builders, `WorkerGeometryData`, shared types |
| `@sienci/gviewer/viewer` | `GCodeViewer`, `GCodeSVGRenderer`, themes, viewer types, `WorkerGeometryData` |
| `@sienci/gviewer/react` | `GCodeVisualizer`, `GCodeSVGVisualizer` React components |
| `@sienci/gviewer/viewer/viewcube.css` | Stylesheet for the ViewCube overlay |

---

## Quick start

### React

```tsx
import { useRef } from "react";
import { GCodeVisualizer } from "@sienci/gviewer/react";
import type { GCodeViewerHandle } from "@sienci/gviewer/viewer";
import "@sienci/gviewer/viewer/viewcube.css";

export function App() {
  const ref = useRef<GCodeViewerHandle>(null);

  return (
    <>
      <GCodeVisualizer
        id="main"
        ref={ref}
        style={{ width: "100%", height: "600px" }}
      />
      <button onClick={() => ref.current?.loadFromUrl("/part.gcode")}>
        Load
      </button>
    </>
  );
}
```

### Vanilla JS

```ts
import { GCodeViewer } from "@sienci/gviewer/viewer";
import "@sienci/gviewer/viewer/viewcube.css";

const viewer = new GCodeViewer({
  id: "main",
  container: document.getElementById("viewer")!,
});

await viewer.loadFromUrl("/part.gcode");
viewer.focusToModel();
```

---

## API reference

### `@sienci/gviewer` — core

#### `GCodeParser`

Stateless line-by-line parser. No state is kept between calls.

```ts
import { GCodeParser } from "@sienci/gviewer";

const parser = new GCodeParser();
const result = parser.parseLine("G1 X10 Y5 F1200 ; move");
// result.words    — all letter-value pairs
// result.gcodes   — G and M words only
// result.params   — non-G/M words (X, Y, F, …)
// result.comments — extracted semicolon and paren comments
```

**`parseLine(line: string): ParsedLine`**

Returns a `ParsedLine`:

```ts
type ParsedLine = {
  raw: string;
  words: GCodeWord[];    // all tokens
  gcodes: GCodeWord[];   // G/M codes
  params: GCodeWord[];   // axis and parameter words
  comments: Comment[];   // extracted comments with positions
};

type GCodeWord = {
  letter: string;   // uppercase, e.g. "G", "X"
  value: number;
  raw: string;      // original matched text
  start: number;    // char offset in stripped line
  end: number;
};

type Comment = {
  type: "paren" | "semicolon";
  text: string;
  start: number;    // char offset in original line
  end: number;
};
```

---

#### `GCodeVirtualizer`

Stateful interpreter. Tracks modal state and machine position across calls to `processLine()`.

```ts
import { GCodeVirtualizer } from "@sienci/gviewer";

const virt = new GCodeVirtualizer({
  onLinearMove({ modals, start, end, transformedStart, transformedEnd }) {
    // called for every G0/G1 segment (subdivided at ≤5° A-axis steps)
  },
  onArcMove({ modals, start, end, center, max, plane, motion, ... }) {
    // called for every G2/G3 move
  },
});

for (const line of gcodeLines) {
  virt.processLine(line);
}

virt.getModals();             // current ModalState
virt.getPosition();           // current Position { X, Y, Z, A, B, C }
virt.getUniqueFeedRates();    // number[]
virt.getUniqueSpindleSpeeds(); // number[]
virt.getUniqueTools();        // number[]
virt.reset();                 // restore defaults
```

**Modal state defaults:** `G0`, `G90` (absolute), `G17` (XY plane), `G21` (mm).

**Unit conversion:** When `G20` is active, X/Y/Z values are automatically multiplied by 25.4 before being stored and passed to callbacks. A/B/C axes are not scaled.

**Supported G-codes:**

| Code | Effect |
|---|---|
| G0, G1 | Set motion mode (rapid / feed) |
| G2, G3 | Arc CW / CCW |
| G17, G18, G19 | Plane selection (XY / ZX / YZ) |
| G20, G21 | Units (inches / mm) |
| G90, G91 | Distance mode (absolute / incremental) |
| G93, G94 | Feed mode |
| G54–G59 | Coordinate system selection |
| M3, M4, M5 | Spindle on/off |
| M7, M8, M9 | Coolant |
| T | Tool number |
| F | Feed rate |
| S | Spindle speed |

---

#### Geometry builders

Build Three.js-ready `Float32Array` position buffers from arrays of GCode lines. All functions are browser-safe (no Node.js APIs).

##### `buildVerticesFromLines`

```ts
import { buildVerticesFromLines } from "@sienci/gviewer";

const positions: Float32Array = buildVerticesFromLines(lines, {
  arcSegments: 30,   // tessellation quality for arcs
});
// Flat [x0,y0,z0, x1,y1,z1, ...] line-segment pairs
```

##### `buildMovementVerticesFromLines`

Separates rapid (G0) and cutting (G1/G2/G3) moves.

```ts
import { buildMovementVerticesFromLines } from "@sienci/gviewer";

const { rapid, cutting } = buildMovementVerticesFromLines(lines);
```

##### `buildMovementGeometryFromLinesBatched`

Async, progress-reporting version that also tracks per-line vertex ranges.

```ts
import { buildMovementGeometryFromLinesBatched } from "@sienci/gviewer";

const result = await buildMovementGeometryFromLinesBatched(lines, {
  arcSegments: 30,
  batch: {
    onProgress(processed, total) { /* update UI */ },
    yieldEveryLines: 50000,   // yield to event loop periodically
    shouldAbort: () => cancelled,
  },
});

// result.positions        — Float32Array of all vertices
// result.prefixEndVertex  — Int32Array; result.prefixEndVertex[i] is the
//                           cumulative vertex count after line i
// result.lineStartVertex  — Int32Array; first vertex for line i (-1 if none)
// result.lineEndVertex    — Int32Array; last vertex+1 for line i
// result.lineKind         — Uint8Array; 0=none, 1=rapid, 2=cut, 3=mixed
```

##### `buildToolpathGeometryFromLinesBatched`

Unified builder for both standard and laser modes. Returns separate rapid and per-power-bucket cut streams, each with per-line prefix arrays for progress visualization.

```ts
import { buildToolpathGeometryFromLinesBatched } from "@sienci/gviewer";

const result = await buildToolpathGeometryFromLinesBatched(lines, {
  laserMode: false,
  bucketCount: 16,   // power buckets for laser mode
  arcSegments: 30,
});

// result.rapid            — { positions, prefixEndVertex }
// result.cuts             — array of { positions, prefixEndVertex }
// result.cutBucketCount   — number of cut streams (1 in non-laser mode)
// result.maxPower         — max spindle speed seen (laser mode)
```

##### `buildLaserGeometryFromLinesBatched`

Laser-specific variant. Returns rapid positions plus opacity-bucketed cut streams.

```ts
import { buildLaserGeometryFromLinesBatched } from "@sienci/gviewer";

const result = await buildLaserGeometryFromLinesBatched(lines, {
  bucketCount: 16,
  baseOpacity: 0.9,
});

// result.rapidPositions         — Float32Array
// result.rapidPrefixEndVertex   — Int32Array
// result.buckets[i].positions   — Float32Array
// result.buckets[i].opacity     — number (0–1, proportional to power)
// result.buckets[i].prefixEndVertex
```

##### `buildWorkerSegmentGroups`

Converts the pre-parsed payload from an external worker (e.g. gSender's `Visualize.worker`) into groups of stride-6 line segments, each with a hex color and opacity. Segments with the same color and opacity are merged into a single group. This is the conversion step used internally by `loadFromWorkerData()` on both the 3D viewer and the SVG renderer.

```ts
import { buildWorkerSegmentGroups } from "@sienci/gviewer";
import type { WorkerGeometryData } from "@sienci/gviewer";

const groups = buildWorkerSegmentGroups(workerData);
// groups[i].hexColor  — e.g. "#0ef6ae"
// groups[i].opacity   — 0.5 for rapid moves, 1.0 for cutting moves
// groups[i].positions — Float32Array stride-6: [x0,y0,z0, x1,y1,z1, ...]
// groups[i].rgbColors — Float32Array stride-3 per vertex (2 per segment, same length as positions)
```

`WorkerGeometryData` matches the relevant fields of the `geometryReady` worker message:

```ts
type WorkerGeometryData = {
  vertices: ArrayBuffer;         // Float32Array stride-3: individual 3D points
  frames: ArrayBuffer;           // Uint32Array: vertex index at the start of each motion segment
  colorArrayBuffer: ArrayBuffer; // Float32Array stride-4: r,g,b,opacity per vertex (values 0–1)
  verticesLen: number;
  framesLen: number;
  colorLen: number;
};
```

---

### `@sienci/gviewer/viewer` — Three.js viewer

#### `GCodeViewer`

Full 3D viewer with orbit controls, grid, bounding box, bit marker, and ViewCube.

```ts
import { GCodeViewer } from "@sienci/gviewer/viewer";
import "@sienci/gviewer/viewer/viewcube.css";

const viewer = new GCodeViewer({
  id: "my-viewer",
  container: document.getElementById("viewer")!,
  options: { /* Partial<GCodeViewerOptions> */ },
  callbacks: {
    onProgress(event) {
      // event.state: "hidden" | "indeterminate" | "determinate"
    },
    onBoundsChanged(event) {
      // event.bounds: { min, max } | null
    },
  },
});
```

##### Loading GCode

```ts
await viewer.loadFromUrl("/path/to/file.gcode");
await viewer.loadFromFile(fileInputElement.files[0]);
await viewer.loadFromText("G21\nG0 X10 Y10\n...");
await viewer.loadFromLines(["G21", "G0 X10 Y10"]);
viewer.unload();
```

##### Loading from pre-parsed worker data

If GCode has already been parsed by an external worker (e.g. gSender's `Visualize.worker`), pass the `geometryReady` payload directly to skip re-parsing. Per-vertex colors — including tool-change palette cycling — are preserved.

```ts
import type { WorkerGeometryData } from "@sienci/gviewer/viewer";

// workerData comes from the worker's geometryReady message
const workerData: WorkerGeometryData = {
  vertices: msg.vertices,               // ArrayBuffer (Float32Array stride-3: x,y,z per point)
  frames: msg.frames,                   // ArrayBuffer (Uint32Array: vertex index per motion segment)
  colorArrayBuffer: msg.colorArrayBuffer, // ArrayBuffer (Float32Array stride-4: r,g,b,opacity per vertex)
  verticesLen: msg.verticesLen,
  framesLen: msg.framesLen,
  colorLen: msg.colorLen,
};

await viewer.loadFromWorkerData(workerData);
```

> **Note:** `seekToLine()` and `hideUntilLine()` are no-ops when data is loaded this way, because per-line vertex ranges are not included in the worker response. Pass GCode text to `loadFromLines()` if you need those features.

##### Camera

```ts
viewer.focusToModel();          // animate camera to fit the loaded geometry
viewer.resetCamera();           // return to initial position
viewer.snapCameraToView("front", { durationMs: 300 });
// views: "front" | "back" | "left" | "right" | "top" | "bottom"
//        | "front-top-left" | "front-top-right" | ... (14 presets)
```

##### Progress / simulation

```ts
// Show geometry only from lineIndex onward
viewer.hideUntilLine(lineIndex, "grey");  // grey out processed lines
viewer.hideUntilLine(lineIndex, "hide");  // hide processed lines
viewer.showAll();
viewer.resetColors();
```

##### Bit marker

```ts
viewer.setBitPosition({ x: 10, y: 5, z: 0 });
viewer.setBitPosition({ x: 10, y: 5, z: 0 }, { immediate: true });
viewer.setBitVisible(false);
```

The bit type is controlled via `options.bit.type`. Five types are available:

| Type | Description |
|---|---|
| `"drill"` | Real drill-bit mesh (STL) with metallic shading. **Default.** |
| `"laser"` | Tapered beam with additive purple glow. Set automatically when `mode.laser` is enabled. |
| `"circle"` | Simple sphere. |
| `"triangle"` | Cone. |
| `"crosshair"` | 2D crosshair — intended for use with `GCodeSVGRenderer`. See [Crosshair marker](#crosshair-marker). |

**Laser mode auto-switch:** when `mode.laser` is set to `true`, the bit type automatically switches to `"laser"`. When `mode.laser` is set back to `false`, the bit reverts to whatever type was active before laser mode was enabled.

```ts
viewer.setOptions({ mode: { laser: true } });
// bit type is now automatically "laser"

viewer.setOptions({ mode: { laser: false } });
// bit type is restored to its previous value (e.g. "drill")
```

##### Options

```ts
viewer.setOptions({
  units: "mm",             // "mm" | "in"
  mode: { laser: false },  // setting true auto-switches bit type to "laser"
  render: {
    theme: gCodeViewerThemePresets["tokyo-night"],
  },
  grid: { size: 1000, axisDepth: 200, labels: true },
  boundingBox: { visible: true, labels: true },
  camera: { fov: 45 },
});

viewer.getOptions();   // returns current options (readonly)
viewer.getBounds();    // { min, max } | null
viewer.resize();       // call after container resizes (automatic via ResizeObserver)
viewer.dispose();      // clean up Three.js resources and DOM elements
```

##### Themes

```ts
import { gCodeViewerThemePresets } from "@sienci/gviewer/viewer";

// Available presets:
// "dark" | "light" | "flexoki-dark" | "tokyo-night"
// "gruvbox-light" | "ayu-dark" | "ayu-light"

viewer.setOptions({ render: { theme: gCodeViewerThemePresets["ayu-dark"] } });
```

##### `GCodeViewerOptions` — full reference

```ts
type GCodeViewerOptions = {
  units: "mm" | "in";
  mode: { laser: boolean };
  bit: {
    enabled: boolean;
    type: "drill" | "laser" | "circle" | "triangle" | "crosshair";  // default: "drill"
    size: number;        // world units (default: 4.05)
    opacity: number;     // 0–1
    tweenMs: number;     // animation duration
    colorSource: "cutting" | "rapid" | "custom";
    color: string;
  };
  progress: { mode: "hide" | "grey" };
  grid: { size: number; axisDepth: number; labels: boolean };  // default size: 1000
  boundingBox: { visible: boolean; labels: boolean };
  geometry: {
    arcSegments: number;
    batching: { progressEveryLines: number; yieldEveryLines: number };
  };
  render: { antialias: boolean; theme: GCodeViewerTheme };
  camera: {
    fov: number;
    focusDurationMs: number;
    orbit: { enableDamping: boolean };
    initialPosition: { x: number; y: number; z: number };
  };
};
```

---

### `GCodeSVGRenderer` — SVG viewer

Lightweight 2D/isometric SVG renderer. No Three.js dependency — works in any environment that has a DOM. Supports pan (drag) and scroll-to-zoom.

```ts
import { GCodeSVGRenderer } from "@sienci/gviewer/viewer";
import type { GCodeSVGOptions } from "@sienci/gviewer/viewer";

const renderer = new GCodeSVGRenderer(
  document.getElementById("container")!,
  { /* Partial<GCodeSVGOptions> */ }
);
```

##### Loading GCode

```ts
renderer.loadFromText("G21\nG0 X10 Y10\n...");
renderer.loadFromLines(["G21", "G0 X10 Y10"]);
await renderer.loadFromFile(fileInputElement.files[0]);
renderer.clear();
```

##### Loading from pre-parsed worker data

Pass the `geometryReady` payload directly to avoid re-parsing. Tool-change colors from the worker are rendered as separate colored paths.

```ts
import type { WorkerGeometryData } from "@sienci/gviewer/viewer";

renderer.loadFromWorkerData(workerData);
```

##### Controls

```ts
renderer.resetView();                         // re-fit view
renderer.setProjectionMode("isometric");      // "isometric" (default) | "perspective"
renderer.getSVGElement();                     // returns the <svg> element (for export, etc.)
renderer.dispose();                           // remove event listeners and DOM element
```

##### Crosshair marker

A 2D crosshair can be shown at any world position — useful for indicating the current machine/tool location during job execution. Call `setBitPosition` with the work position (in the same coordinate space as the GCode) and the crosshair will project correctly as the view is panned or zoomed.

```ts
// Show the crosshair at a work position
renderer.setBitPosition({ x: 25, y: 50, z: 0 });

// Hide without losing the stored position
renderer.setBitVisible(false);

// Show again at the last set position
renderer.setBitVisible(true);
```

The crosshair starts hidden and becomes visible on the first `setBitPosition` call. Its color is controlled via `crosshairColor` in `GCodeSVGOptions`.

##### Options

```ts
renderer.setOptions({
  rapidColor: "#0ef6ae",        // G0 rapid move color
  cutColor: "#3e85c7",          // G1/G2/G3 cutting move color
  boundingBoxColor: "#d0d0d0",  // wireframe bounding box color
  strokeWidth: 0.5,             // path stroke width in SVG units
  arcSegments: 30,              // arc tessellation quality
  padding: 5,                   // fixed padding around the fit view (SVG units)
  projectionMode: "isometric",  // "isometric" | "perspective"
  crosshairColor: "#ffffff",    // crosshair marker color (default: "#ffffff")
});
```

> **Note:** When data is loaded via `loadFromWorkerData()`, `rapidColor` and `cutColor` are ignored — colors come from the worker payload. Other options (stroke width, padding, projection mode) apply in both modes.

---

### `@sienci/gviewer/react` — React component

```tsx
import { GCodeVisualizer } from "@sienci/gviewer/react";
import type { GCodeViewerHandle, GCodeViewerOptions } from "@sienci/gviewer/viewer";
import "@sienci/gviewer/viewer/viewcube.css";
```

#### Props

```ts
type GCodeVisualizerProps = {
  id: string;
  options?: Partial<GCodeViewerOptions>;
  callbacks?: GCodeViewerCallbacks;
  className?: string;
  style?: React.CSSProperties;
};
```

The component forwards a `GCodeViewerHandle` ref that exposes the full `GCodeViewer` imperative API:

```tsx
const ref = useRef<GCodeViewerHandle>(null);

<GCodeVisualizer id="viewer" ref={ref} style={{ height: 500 }} />

// Later:
ref.current?.loadFromText(gcode);
ref.current?.loadFromWorkerData(workerData);
ref.current?.focusToModel();
ref.current?.hideUntilLine(currentLine, "grey");
ref.current?.snapCameraToView("top");
ref.current?.setBitPosition({ x, y, z });
```

`options` and `callbacks` props are synced to the viewer whenever they change (via `useEffect`).

#### `GCodeSVGVisualizer`

React wrapper for `GCodeSVGRenderer`.

```tsx
import { GCodeSVGVisualizer } from "@sienci/gviewer/react";
import type { GCodeSVGRendererHandle } from "@sienci/gviewer/react";
import type { GCodeSVGOptions } from "@sienci/gviewer/viewer";

const ref = useRef<GCodeSVGRendererHandle>(null);

<GCodeSVGVisualizer
  id="svg-viewer"
  ref={ref}
  options={{ strokeWidth: 0.5, projectionMode: "isometric" }}
  style={{ width: "100%", height: "400px" }}
/>

// Load via any method:
ref.current?.loadFromText(gcode);
ref.current?.loadFromWorkerData(workerData);
ref.current?.resetView();
ref.current?.setProjectionMode("perspective");
ref.current?.getSVGElement();                 // access raw <svg> for export

// Crosshair — show current machine position during job execution:
ref.current?.setBitPosition({ x: 25, y: 50, z: 0 });
ref.current?.setBitVisible(false);
```

`GCodeSVGRendererHandle` exposes: `loadFromLines`, `loadFromFile`, `loadFromText`, `loadFromWorkerData`, `clear`, `resetView`, `setOptions`, `setProjectionMode`, `setBitPosition`, `setBitVisible`, `getSVGElement`, `dispose`.

---

## Development

```bash
npm install
npm run build        # compile + generate types
npm test             # run all test suites
npm run test:watch   # watch mode
npm run dev          # rebuild on file changes
npm run demo         # start the demo dev server
npm run build:demo   # build the demo for deployment
```

The demo is automatically built and published to GitHub Pages on every push to `master`.

### Output

```
dist/
  gviewer.js / gviewer.cjs       — core (parser, virtualizer, geometry)
  viewer.js  / viewer.cjs        — Three.js viewer
  react.js   / react.cjs         — React component
  viewcube.css                   — ViewCube styles
  types/                         — TypeScript declarations
```

## License

MIT
