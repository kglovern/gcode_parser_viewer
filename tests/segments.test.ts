import * as THREE from "three";
import { buildSegmentsSegmentGroups } from "../src/geometry";
import { SEGMENT_ATTR_RAPID, type WorkerSegmentsData } from "../src/types";
import {
  applySegmentsTheme,
  createSegmentsToolpath,
  disposeSegmentsToolpath,
  resetSegmentsColors,
  setSegmentsLineGroupVisible,
  setSegmentsPlannedEnd,
  setSegmentsProgress,
  showAllSegmentsLineGroups,
} from "../src/viewer/toolpath/segments";
import { defaultGCodeViewerOptions } from "../src/viewer/types";

const R = SEGMENT_ATTR_RAPID;

// One segment (two vertices) per entry: [attr, power?]
function chunk(segments: { attr: number; power?: number; x?: number }[]) {
  const n = segments.length * 2;
  const positions = new Float32Array(n * 3);
  const attrs = new Uint8Array(n);
  const power = new Float32Array(n);
  segments.forEach((s, i) => {
    const x = s.x ?? i;
    positions.set([x, 0, 0, x + 1, 1, 2], i * 6);
    attrs[i * 2] = s.attr;
    attrs[i * 2 + 1] = s.attr;
    power[i * 2] = s.power ?? 0;
    power[i * 2 + 1] = s.power ?? 0;
  });
  return { positions: positions.buffer, attrs: attrs.buffer, power: power.buffer, vertexCount: n };
}

// Lines: 0 = rapid, 1 = cut, 2 = comment (no geometry), 3 = cut | 4 = cut, 5 = rapid
function twoChunkData(overrides: Partial<WorkerSegmentsData> = {}): WorkerSegmentsData {
  return {
    format: "segments-v1",
    chunks: [chunk([{ attr: R }, { attr: 0 }, { attr: 0 }]), chunk([{ attr: 1 }, { attr: R }])],
    totalVertices: 10,
    prefixEndVertex: new Uint32Array([2, 4, 4, 6, 8, 10]).buffer,
    ...overrides,
  };
}

function load(data: WorkerSegmentsData, lineGroups?: { start: number; end: number }[]) {
  const parent = new THREE.Group();
  const result = createSegmentsToolpath({ data, options: defaultGCodeViewerOptions, parent, lineGroups });
  return { parent, ...result };
}

describe("createSegmentsToolpath", () => {
  it("uploads each chunk's transferred buffers without copying them", () => {
    const data = twoChunkData();
    const { parent, state, bounds } = load(data);

    // Two passes (cuts, then rapids) per chunk over one shared geometry.
    expect(parent.children).toHaveLength(4);
    for (const c of state.chunks) {
      expect(c.cutLine.geometry).toBe(c.geometry);
      expect(c.rapidLine.geometry).toBe(c.geometry);
      expect(c.rapidLine.renderOrder).toBeGreaterThan(c.cutLine.renderOrder);
    }
    expect(state.chunks.map((c) => [c.base, c.count])).toEqual([
      [0, 6],
      [6, 4],
    ]);
    const position = state.chunks[0].geometry.getAttribute("position") as THREE.BufferAttribute;
    const attr = state.chunks[1].geometry.getAttribute("aSegAttr") as THREE.BufferAttribute;
    expect((position.array as Float32Array).buffer).toBe(data.chunks[0].positions);
    expect((attr.array as Uint8Array).buffer).toBe(data.chunks[1].attrs);
    expect(bounds?.min.toArray()).toEqual([0, 0, 0]);
    expect(bounds?.max.toArray()).toEqual([3, 1, 2]);
  });

  it("only adds the power attribute for laser files", () => {
    expect(load(twoChunkData()).state.chunks[0].geometry.getAttribute("aSegPower")).toBeUndefined();
    const laser = load(twoChunkData({ isLaser: true, maxPower: 1000 }));
    expect(laser.state.chunks[0].geometry.getAttribute("aSegPower")).toBeDefined();
    expect(laser.state.shared.uSegMaxPower.value).toBe(1000);
    expect(load(twoChunkData({ isLaser: true, maxPower: 0.5 })).state.shared.uSegMaxPower.value).toBe(0.5);
    expect(load(twoChunkData({ isLaser: true, maxPower: 0 })).state.shared.uSegMaxPower.value).toBe(1);
  });

  it("removes and disposes every chunk", () => {
    const { parent, state } = load(twoChunkData());
    disposeSegmentsToolpath(parent, state);
    expect(parent.children).toHaveLength(0);
    expect(state.chunks).toHaveLength(0);
  });
});

describe("segments shader injection", () => {
  const compile = (material: THREE.LineBasicMaterial) => {
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    return shader;
  };

  it("draws cuts and rapids in separate passes of the same program source", () => {
    const { state } = load(twoChunkData());
    const cut = state.chunks[0].cutLine.material as THREE.LineBasicMaterial;
    const rapid = state.chunks[0].rapidLine.material as THREE.LineBasicMaterial;
    expect(cut.defines).toEqual({});
    expect(rapid.defines).toEqual({ SEG_PASS_RAPID: "" });
    expect(cut.customProgramCacheKey()).toBe("gviewer-segments-v1-cut");
    expect(rapid.customProgramCacheKey()).toBe("gviewer-segments-v1-rapid");
    expect(compile(rapid).vertexShader).toContain("#ifdef SEG_PASS_RAPID");
  });

  it("finds its hook points in three's basic line shader", () => {
    const { state } = load(twoChunkData({ isLaser: true }));
    const material = state.chunks[0].cutLine.material as THREE.LineBasicMaterial;
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(shader.vertexShader).toContain("attribute float aSegAttr;");
    expect(shader.vertexShader).toContain("float( gl_VertexID )");
    expect(shader.fragmentShader).toContain("vec4 diffuseColor = vSegColor;");
    expect(shader.fragmentShader).not.toContain("vec4( diffuse, opacity )");
    expect(Object.keys(shader.uniforms)).toEqual(
      expect.arrayContaining([
        "uSegSlotColors",
        "uSegCursor",
        "uSegPlannedEnd",
        "uSegPlannedColor",
        "uSegHidden",
        "uSegMaxPower",
      ])
    );
    expect(shader.vertexShader).toContain("uniform float uSegPlannedEnd;");
    expect(shader.vertexShader).toContain(
      "} else if ( segVertex < uSegPlannedEnd ) {\n  segColor = uSegPlannedColor;"
    );
    expect(material.defines).toEqual({ SEG_USE_POWER: "" });
    expect(material.customProgramCacheKey()).toBe("gviewer-segments-v1-cut-power");
  });
});

describe("segments progress", () => {
  it("greys through a line (inclusive) by moving each chunk's cursor", () => {
    const { state } = load(twoChunkData());

    setSegmentsProgress(state, 3, "grey"); // through line 3: 6 vertices
    expect(state.chunks.map((c) => c.uniforms.uSegCursor.value)).toEqual([6, 0]);
    setSegmentsProgress(state, 4, "grey"); // through line 4: 8 vertices
    expect(state.chunks.map((c) => c.uniforms.uSegCursor.value)).toEqual([6, 2]);
    setSegmentsProgress(state, -1, "grey");
    expect(state.chunks.map((c) => c.uniforms.uSegCursor.value)).toEqual([0, 0]);
    setSegmentsProgress(state, 99, "grey");
    expect(state.chunks.map((c) => c.uniforms.uSegCursor.value)).toEqual([6, 4]);

    resetSegmentsColors(state);
    expect(state.chunks.map((c) => c.uniforms.uSegCursor.value)).toEqual([0, 0]);
  });

  it("hides through a line with the draw range", () => {
    const { state } = load(twoChunkData());
    setSegmentsProgress(state, 1, "hide"); // 4 vertices hidden
    expect(state.chunks.map((c) => [c.geometry.drawRange.start, c.geometry.drawRange.count])).toEqual([
      [4, 2],
      [0, 4],
    ]);
  });

  it("colours the planned span through a line by moving each chunk's uSegPlannedEnd", () => {
    const { state } = load(twoChunkData());

    setSegmentsPlannedEnd(state, 3); // through line 3: 6 vertices
    expect(state.chunks.map((c) => c.uniforms.uSegPlannedEnd.value)).toEqual([6, 0]);
    setSegmentsPlannedEnd(state, 4); // through line 4: 8 vertices
    expect(state.chunks.map((c) => c.uniforms.uSegPlannedEnd.value)).toEqual([6, 2]);
    setSegmentsPlannedEnd(state, -1);
    expect(state.chunks.map((c) => c.uniforms.uSegPlannedEnd.value)).toEqual([0, 0]);
    setSegmentsPlannedEnd(state, 99);
    expect(state.chunks.map((c) => c.uniforms.uSegPlannedEnd.value)).toEqual([6, 4]);

    resetSegmentsColors(state);
    expect(state.chunks.map((c) => c.uniforms.uSegPlannedEnd.value)).toEqual([0, 0]);
  });
});

describe("segments line groups", () => {
  it("hides a group's vertex range in chunk-local units", () => {
    // group 0 = lines 1..3 (vertices 2..6), group 1 = lines 4..5 (vertices 6..10)
    const { state } = load(twoChunkData(), [
      { start: 1, end: 3 },
      { start: 4, end: 5 },
    ]);

    setSegmentsLineGroupVisible(state, 0, false);
    expect(state.chunks[0].uniforms.uSegHiddenCount.value).toBe(1);
    expect(state.chunks[0].uniforms.uSegHidden.value[0].toArray()).toEqual([2, 6]);
    expect(state.chunks[1].uniforms.uSegHiddenCount.value).toBe(0);

    setSegmentsLineGroupVisible(state, 1, false);
    expect(state.chunks[1].uniforms.uSegHiddenCount.value).toBe(1);
    expect(state.chunks[1].uniforms.uSegHidden.value[0].toArray()).toEqual([0, 4]);

    showAllSegmentsLineGroups(state);
    expect(state.chunks.map((c) => c.uniforms.uSegHiddenCount.value)).toEqual([0, 0]);
  });

  it("ignores groups it was not loaded with", () => {
    const { state } = load(twoChunkData());
    setSegmentsLineGroupVisible(state, 0, false);
    expect(state.chunks.map((c) => c.uniforms.uSegHiddenCount.value)).toEqual([0, 0]);
  });
});

describe("applySegmentsTheme", () => {
  const cutting = new THREE.Color(defaultGCodeViewerOptions.render.theme.colors.cutting);

  it("colours every cutting slot with the theme without toolchanges", () => {
    const { state } = load(twoChunkData({ paletteHex: ["#ff0000", "#00ff00"] }));
    expect(state.shared.uSegSlotColors.value[0].equals(cutting)).toBe(true);
    expect(state.shared.uSegSlotColors.value[1].equals(cutting)).toBe(true);
  });

  it("uses the palette when the file has toolchanges, and follows theme changes", () => {
    const { state } = load(twoChunkData({ paletteHex: ["#ff0000", "#00ff00"], toolchangeCount: 2 }));
    expect(state.shared.uSegSlotColors.value[1].equals(new THREE.Color("#00ff00"))).toBe(true);
    expect(state.shared.uSegSlotColors.value[5].equals(cutting)).toBe(true);

    const options = {
      ...defaultGCodeViewerOptions,
      render: {
        ...defaultGCodeViewerOptions.render,
        theme: {
          ...defaultGCodeViewerOptions.render.theme,
          rapidOpacity: 0.6,
          colors: { ...defaultGCodeViewerOptions.render.theme.colors, rapid: "#123456" },
        },
      },
    };
    applySegmentsTheme(state, options);
    expect(state.shared.uSegRapidColor.value.equals(new THREE.Color("#123456"))).toBe(true);
    expect(state.shared.uSegRapidOpacity.value).toBeCloseTo(0.6);
  });

  it("colours uSegPlannedColor from the theme's planned colour, falling back to processed then cutting", () => {
    const { state } = load(twoChunkData());
    expect(
      state.shared.uSegPlannedColor.value.equals(
        new THREE.Color(defaultGCodeViewerOptions.render.theme.colors.planned)
      )
    ).toBe(true);

    const withoutPlanned = {
      ...defaultGCodeViewerOptions,
      render: {
        ...defaultGCodeViewerOptions.render,
        theme: {
          ...defaultGCodeViewerOptions.render.theme,
          colors: { ...defaultGCodeViewerOptions.render.theme.colors, planned: undefined },
        },
      },
    };
    applySegmentsTheme(state, withoutPlanned);
    expect(
      state.shared.uSegPlannedColor.value.equals(
        new THREE.Color(defaultGCodeViewerOptions.render.theme.colors.processed)
      )
    ).toBe(true);
  });
});

describe("buildSegmentsSegmentGroups", () => {
  it("groups rapids and cuts by colour, dropping laser-off cuts", () => {
    const data: WorkerSegmentsData = {
      format: "segments-v1",
      chunks: [
        chunk([
          { attr: R, x: 0 },
          { attr: 0, power: 500, x: 1 },
          { attr: 0, power: 0, x: 2 },
          { attr: 1, power: 900, x: 3 },
        ]),
      ],
      totalVertices: 8,
      prefixEndVertex: new Uint32Array([8]).buffer,
      isLaser: true,
      toolchangeCount: 1,
      paletteHex: ["#aaaaaa", "#bbbbbb"],
    };
    const groups = buildSegmentsSegmentGroups(data, { rapidColor: "#rapid", cutColor: "#cut" });
    const byColor = Object.fromEntries(groups.map((g) => [g.hexColor, Array.from(g.positions)]));

    expect(Object.keys(byColor).sort()).toEqual(["#aaaaaa", "#bbbbbb", "#rapid"]);
    expect(byColor["#rapid"]).toEqual([0, 0, 0, 1, 1, 2]);
    expect(byColor["#aaaaaa"]).toEqual([1, 0, 0, 2, 1, 2]); // the power-0 cut at x=2 is dropped
    expect(byColor["#bbbbbb"]).toEqual([3, 0, 0, 4, 1, 2]);
  });
});
