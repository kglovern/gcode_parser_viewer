# gViewer

GCode parsing + virtualization, plus an optional Three.js viewer.

## Install

```bash
yarn add gViewer
```

## Viewer (React)

The viewer requires `three` (peer dependency).

Include the ViewCube styles (required if you use the viewer):

```html
<link rel="stylesheet" href="/node_modules/gViewer/viewer/viewcube.css" />
```

```tsx
import * as React from "react";
import { GCodeVisualizer } from "gViewer/react";
import type { GCodeViewerHandle, GCodeViewerOptions } from "gViewer/viewer";

export function Example() {
  const viewerRef = React.useRef<GCodeViewerHandle | null>(null);

  const options: Partial<GCodeViewerOptions> = {
    units: "mm",
    mode: { laser: false },
    grid: { size: 400, axisDepth: 200, labels: true },
    boundingBox: { visible: true, labels: false },
  };

  return (
    <div style={{ height: 500 }}>
      <GCodeVisualizer
        id="part-A"
        ref={viewerRef}
        options={options}
        style={{ width: "100%", height: "100%" }}
        callbacks={{
          onProgress: (e) => {
            if (e.id !== "part-A") return;
            // e.state: "hidden" | "indeterminate" | "determinate"
          },
          onBoundsChanged: (e) => {
            if (e.id !== "part-A") return;
            // e.bounds: {min,max} | null
          },
        }}
      />
      <button onClick={() => viewerRef.current?.loadFromUrl("/fixtures/sample.gcode")}>
        Load
      </button>
      <button onClick={() => viewerRef.current?.unload()}>Unload</button>
      <button onClick={() => viewerRef.current?.focusToModel()}>Focus</button>
    </div>
  );
}
```

## Viewer (vanilla JS/TS)

Include the ViewCube styles:

```html
<link rel="stylesheet" href="/node_modules/gViewer/viewer/viewcube.css" />
```

```ts
import { GCodeViewer } from "gViewer/viewer";

const container = document.querySelector<HTMLElement>("#viewer");
if (!container) throw new Error("Missing container");

const viewer = new GCodeViewer({
  id: "viewer-1",
  container,
  options: { units: "mm" },
});

await viewer.loadFromUrl("/fixtures/sample.gcode");
viewer.focusToModel();
```

## `GCodeViewerOptions`

Import from `gViewer/viewer`:

- `units`: `"mm" | "in"` (used across grid + labels + bbox labels)
- `mode.laser`: laser geometry mode (non-rapid moves are rendered only when `M3/M4` and `S>0`; opacity scales with `S`)
- `bit.*`: drill bit marker (enabled by default; position controlled via `setBitPosition()`)
  - `bit.type`: `"circle" | "triangle"` (default `"circle"`)
  - `bit.size`: marker size in mm (defaults small)
  - `bit.opacity`: marker opacity `[0,1]`
  - `bit.tweenMs`: tween duration for XYZ updates
  - `bit.colorSource`, `bit.color`: reserved (bit color is currently fixed to `#c9883d`)
- `progress.mode`: `"grey" | "hide"` (used by `hideUntilLine` when `mode` is omitted)
- `grid.size`, `grid.axisDepth`, `grid.labels`
- `boundingBox.visible`, `boundingBox.labels`
- `geometry.arcSegments`, `geometry.batching.progressEveryLines`, `geometry.batching.yieldEveryLines`
- `render.antialias`
- `render.theme`: `GCodeViewerTheme` for background/opacity/colors
- `render.theme.rapidOpacity`: rapid (G0) opacity
- `render.theme.colors.laser`: optional laser cutting color (used when `mode.laser=true`)
- `render.theme.colors.processed`: color used for the processed prefix when `progress.mode="grey"` (defaults to a neutral grey)
- `camera.fov`, `camera.focusDurationMs`, `camera.orbit.enableDamping`, `camera.initialPosition`

Defaults: `defaultGCodeViewerOptions`, `defaultGCodeViewerTheme`.

## Theme presets

Import from `gViewer/viewer`:

```ts
import { gCodeViewerThemePresets } from "gViewer/viewer";

viewer.setOptions({ render: { theme: gCodeViewerThemePresets.light } });
```

Available presets: `"dark"`, `"light"`, `"flexoki-dark"`, `"tokyo-night"`, `"gruvbox-light"`, `"ayu-dark"`, `"ayu-light"`.

## Methods (imperative API)

The React `ref` and the `GCodeViewer` instance both expose the same surface (`GCodeViewerHandle`):

- `id`: readonly viewer id
- `setCallbacks(callbacks)`: update callbacks after construction
- `snapCameraToView(view, { durationMs?, distance? })`: snap to a named view (`GCodeViewerCameraView`)
- `setBitPosition({ x, y, z, a? }, { immediate? })`: update the bit marker (mm world units; `a` is currently ignored since the tool marker stays fixed while A rotates the workpiece/toolpath)
- `setBitVisible(visible)`: show/hide the bit marker
- `setToolpathRotationA(aDegrees)`: apply an extra global X rotation (degrees) for inspection (does not move/rotate the bit marker; rotary files may already bake A into vertices)
- `hideUntilLine(lineIndex, mode?)`: apply progress to everything emitted up to (and including) 0-based `lineIndex` (`mode` defaults to `options.progress.mode`)
- `showAll()`: show the full toolpath again
- `resetColors()`: restore original colors after a simulation pass
- `loadFromUrl(url, { signal? })`
- `loadFromFile(file)`
- `loadFromText(gcode)`
- `loadFromLines(lines)`
- `unload()`
- `setOptions(partialOptions)`
- `getOptions()`
- `resize()`
- `focusToModel()`
- `resetCamera()`
- `getBounds()`: returns `{ min, max }` in world units (mm)
- `dispose()`
