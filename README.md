# gviewer

TypeScript library for parsing, virtualizing, and visualizing GCode toolpaths. Built on Three.js with an optional React wrapper.

## Installation

```bash
npm install gviewer
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
| `gviewer` | Parser, virtualizer, geometry builders, shared types |
| `gviewer/viewer` | `GCodeViewer` class, themes, viewer types |
| `gviewer/react` | `GCodeVisualizer` React component |
| `gviewer/viewer/viewcube.css` | Stylesheet for the ViewCube overlay |

---

## Quick start

### React

```tsx
import { useRef } from "react";
import { GCodeVisualizer } from "gviewer/react";
import type { GCodeViewerHandle } from "gviewer/viewer";
import "gviewer/viewer/viewcube.css";

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
import { GCodeViewer } from "gviewer/viewer";
import "gviewer/viewer/viewcube.css";

const viewer = new GCodeViewer({
  id: "main",
  container: document.getElementById("viewer")!,
});

await viewer.loadFromUrl("/part.gcode");
viewer.focusToModel();
```

---

## API reference

### `gviewer` — core

#### `GCodeParser`

Stateless line-by-line parser. No state is kept between calls.

```ts
import { GCodeParser } from "gviewer";

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
import { GCodeVirtualizer } from "gviewer";

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
import { buildVerticesFromLines } from "gviewer";

const positions: Float32Array = buildVerticesFromLines(lines, {
  arcSegments: 30,   // tessellation quality for arcs
});
// Flat [x0,y0,z0, x1,y1,z1, ...] line-segment pairs
```

##### `buildMovementVerticesFromLines`

Separates rapid (G0) and cutting (G1/G2/G3) moves.

```ts
import { buildMovementVerticesFromLines } from "gviewer";

const { rapid, cutting } = buildMovementVerticesFromLines(lines);
```

##### `buildMovementGeometryFromLinesBatched`

Async, progress-reporting version that also tracks per-line vertex ranges.

```ts
import { buildMovementGeometryFromLinesBatched } from "gviewer";

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
import { buildToolpathGeometryFromLinesBatched } from "gviewer";

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
import { buildLaserGeometryFromLinesBatched } from "gviewer";

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

---

### `gviewer/viewer` — Three.js viewer

#### `GCodeViewer`

Full 3D viewer with orbit controls, grid, bounding box, bit marker, and ViewCube.

```ts
import { GCodeViewer } from "gviewer/viewer";
import "gviewer/viewer/viewcube.css";

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

##### Options

```ts
viewer.setOptions({
  units: "mm",             // "mm" | "in"
  mode: { laser: false },
  render: {
    theme: gCodeViewerThemePresets["tokyo-night"],
  },
  grid: { size: 400, axisDepth: 200, labels: true },
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
import { gCodeViewerThemePresets } from "gviewer/viewer";

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
    type: "circle" | "triangle";
    size: number;        // world units
    opacity: number;     // 0–1
    tweenMs: number;     // animation duration
    colorSource: "cutting" | "rapid" | "custom";
    color: string;
  };
  progress: { mode: "hide" | "grey" };
  grid: { size: number; axisDepth: number; labels: boolean };
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

### `gviewer/react` — React component

```tsx
import { GCodeVisualizer } from "gviewer/react";
import type { GCodeViewerHandle, GCodeViewerOptions } from "gviewer/viewer";
import "gviewer/viewer/viewcube.css";
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
ref.current?.focusToModel();
ref.current?.hideUntilLine(currentLine, "grey");
ref.current?.snapCameraToView("top");
ref.current?.setBitPosition({ x, y, z });
```

`options` and `callbacks` props are synced to the viewer whenever they change (via `useEffect`).

---

## Development

```bash
npm install
npm run build        # compile + generate types
npm test             # run all test suites
npm run test:watch   # watch mode
npm run dev          # rebuild on file changes
```

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
