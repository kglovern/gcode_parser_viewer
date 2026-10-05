import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GCodeSVGRenderer } from "../src/viewer/svg/GCodeSVGRenderer";

// Just enough DOM for the renderer: elements record attribute writes so tests
// can tell a path-data rebuild from a cheap attribute update.
class FakeEl {
  attrs = new Map<string, string>();
  writes: string[] = [];
  children: FakeEl[] = [];
  style: Record<string, string> = {};
  textContent = "";
  listeners = new Map<string, (e: unknown) => void>();
  rect = { left: 0, top: 0, width: 200, height: 100 };
  setAttribute(k: string, v: string) { this.attrs.set(k, v); this.writes.push(k); }
  getAttribute(k: string) { return this.attrs.get(k) ?? null; }
  appendChild(c: FakeEl) { this.children.push(c); return c; }
  removeChild(c: FakeEl) { this.children = this.children.filter(x => x !== c); return c; }
  remove() {}
  addEventListener(t: string, fn: (e: unknown) => void) { this.listeners.set(t, fn); }
  removeEventListener(t: string) { this.listeners.delete(t); }
  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() { return this.rect; }
}

let frames: (() => void)[] = [];
const flushFrames = () => { const f = frames; frames = []; f.forEach(cb => cb()); };
const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  frames = [];
  g.document = { createElementNS: () => new FakeEl() };
  g.requestAnimationFrame = (cb: () => void) => { frames.push(cb); return frames.length; };
});

afterEach(() => {
  delete g.document;
  delete g.requestAnimationFrame;
});

function setup() {
  const container = new FakeEl();
  const r = new GCodeSVGRenderer(container as unknown as HTMLElement, {
    projectionMode: "top",
    strokeWidth: 1,
  });
  const svg = container.children[0];
  // Two 2D groups (rapid, cut), as the worker sends for the pendant.
  const verts = new Float32Array([0, 0, 10, 0, 10, 0, 10, 10, 10, 10, 0, 10]);
  r.loadFromPrecomputedGroups(
    [
      { hexColor: "#00ff00", opacity: 0.35, positionsBuffer: verts.buffer, positionsLen: verts.length, stride: 4 },
      { hexColor: "#0000ff", opacity: 1, positionsBuffer: verts.buffer, positionsLen: verts.length, stride: 4 },
    ],
    { minZ: -3, maxZ: 0 },
  );
  const layer = svg.children[1];
  const paths = layer.children;
  const dWrites = () => paths.reduce((n, p) => n + p.writes.filter(w => w === "d").length, 0);
  return { r, svg, paths, dWrites };
}

describe("GCodeSVGRenderer setOptions", () => {
  test("identical options do not touch the path data", () => {
    const { r, dWrites } = setup();
    const before = dWrites();
    r.setOptions({ projectionMode: "top", strokeWidth: 1 });
    r.setOptions({ projectionMode: "top", strokeWidth: 1 });
    expect(dWrites()).toBe(before);
  });

  test("stroke width changes restyle without rebuilding", () => {
    const { r, paths, dWrites } = setup();
    const before = dWrites();
    r.setOptions({ strokeWidth: 2 });
    expect(dWrites()).toBe(before);
    expect(paths[0].attrs.get("stroke-width")).toBe("2");
  });

  test("a projection change rebuilds the path data", () => {
    const { r, dWrites } = setup();
    const before = dWrites();
    r.setOptions({ projectionMode: "isometric" });
    expect(dWrites()).toBe(before + 2);
  });
});

describe("GCodeSVGRenderer gestures", () => {
  const pointer = (svg: FakeEl, type: string, id: number, x: number, y: number) =>
    svg.listeners.get(type)!({ pointerId: id, clientX: x, clientY: y, preventDefault() {} });

  test("panning previews with a transform and commits the viewBox on release", () => {
    const { svg, dWrites } = setup();
    const startViewBox = svg.attrs.get("viewBox");
    const before = dWrites();

    pointer(svg, "pointerdown", 1, 100, 50);
    pointer(svg, "pointermove", 1, 120, 50);
    pointer(svg, "pointermove", 1, 140, 50);
    flushFrames();
    expect(svg.attrs.get("viewBox")).toBe(startViewBox);
    // Content follows the finger 1:1 even though the view is letterboxed.
    const m = svg.style.transform.match(/translate\((.+)px, (.+)px\) scale\((.+)\)/)!;
    expect(Number(m[1])).toBeCloseTo(40, 6);
    expect(Number(m[2])).toBeCloseTo(0, 6);
    expect(Number(m[3])).toBe(1);

    pointer(svg, "pointerup", 1, 140, 50);
    expect(svg.style.transform).toBe("");
    expect(svg.attrs.get("viewBox")).not.toBe(startViewBox);
    expect(dWrites()).toBe(before);
  });

  test("the preview transform matches the committed view", () => {
    const { svg } = setup();
    const vb = () => svg.attrs.get("viewBox")!.split(" ").map(Number);
    // Screen position of world point P under a viewBox, with xMidYMid meet.
    const toScreen = (v: number[], px: number, py: number) => {
      const k = Math.min(200 / v[2], 100 / v[3]);
      return [100 + (px - (v[0] + v[2] / 2)) * k, 50 + (py - (v[1] + v[3] / 2)) * k];
    };
    const committed = vb();

    // Pinch out around an off-centre midpoint while drifting.
    pointer(svg, "pointerdown", 1, 40, 30);
    pointer(svg, "pointerdown", 2, 80, 30);
    pointer(svg, "pointermove", 2, 120, 40);
    pointer(svg, "pointermove", 1, 30, 20);
    flushFrames();
    const m = svg.style.transform.match(/translate\((.+)px, (.+)px\) scale\((.+)\)/)!;
    const [tx, ty, s] = [Number(m[1]), Number(m[2]), Number(m[3])];

    pointer(svg, "pointerup", 1, 30, 20);
    pointer(svg, "pointerup", 2, 120, 40);
    const live = vb();

    for (const [px, py] of [[0, 0], [10, -10], [5, -5]]) {
      const [cx, cy] = toScreen(committed, px, py);
      const [lx, ly] = toScreen(live, px, py);
      expect(tx + s * cx).toBeCloseTo(lx, 0);
      expect(ty + s * cy).toBeCloseTo(ly, 0);
    }
  });
});
