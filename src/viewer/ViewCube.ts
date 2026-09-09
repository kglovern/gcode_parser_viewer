import type { GCodeViewerCameraView } from "./types";
import viewcubeCss from "./viewcube.css?inline";

const VIEWCUBE_STYLE_ELEMENT_ID = "gviewer-viewcube-style";

// Consumers historically had to manually import "@sienci/gviewer/viewer/viewcube.css",
// but that side-effect import silently gets dropped by some bundler/CSS-tooling
// combinations (e.g. Tailwind v4's Vite plugin) since it's several packages deep in
// node_modules. Self-injecting here guarantees the styles apply for any consumer.
function ensureViewCubeStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(VIEWCUBE_STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = VIEWCUBE_STYLE_ELEMENT_ID;
  style.setAttribute("data-gviewer", "viewcube");
  style.textContent = viewcubeCss;
  document.head.appendChild(style);
}

type ViewCubeArgs = {
  container: HTMLElement;
  onSelectView: (view: GCodeViewerCameraView) => void;
};

export class ViewCube {
  private readonly root: HTMLDivElement;
  private readonly cube: HTMLDivElement;
  private readonly onSelectView: (view: GCodeViewerCameraView) => void;
  private readonly faceButtons: Map<string, HTMLButtonElement>;

  constructor(args: ViewCubeArgs) {
    ensureViewCubeStyles();
    this.onSelectView = args.onSelectView;
    this.faceButtons = new Map();

    this.root = document.createElement("div");
    this.root.className = "gViewer-viewcube";

    this.cube = document.createElement("div");
    this.cube.className = "gViewer-viewcube__cube";
    this.root.appendChild(this.cube);

    const faces: Array<{ view: GCodeViewerCameraView; className: string; label: string }> = [
      { view: "front", className: "gViewer-viewcube__face--front", label: "Front" },
      { view: "back", className: "gViewer-viewcube__face--back", label: "Back" },
      { view: "left", className: "gViewer-viewcube__face--left", label: "Left" },
      { view: "right", className: "gViewer-viewcube__face--right", label: "Right" },
      { view: "top", className: "gViewer-viewcube__face--top", label: "Top" },
      { view: "bottom", className: "gViewer-viewcube__face--bottom", label: "Bottom" },
    ];

    for (const face of faces) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `gViewer-viewcube__face ${face.className}`;
      button.textContent = face.label;
      button.addEventListener("click", () => this.onSelectView(face.view));
      this.cube.appendChild(button);
      this.faceButtons.set(face.view, button);
    }

    args.container.appendChild(this.root);
  }

  setActiveFace(view: "front" | "back" | "left" | "right" | "top" | "bottom"): void {
    for (const [key, button] of this.faceButtons.entries()) {
      if (key === view) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }
    }
  }

  setRotationMatrix3d(elements: readonly number[]): void {
    const values = Array.from({ length: 16 }, (_, index) => {
      const value = elements[index] ?? 0;
      return Number.isFinite(value) ? String(Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(8))) : "0";
    });
    this.cube.style.transform = `matrix3d(${values.join(",")})`;
  }

  dispose(): void {
    this.root.remove();
  }
}
