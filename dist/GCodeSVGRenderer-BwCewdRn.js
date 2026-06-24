import * as h from "three";
import { OrbitControls as oP } from "three/examples/jsm/controls/OrbitControls.js";
import { GCodeVirtualizer as AA, buildWorkerToolpathStreams as TP, buildToolpathGeometryFromLinesBatched as zP, buildMovementVerticesFromLines as wP, buildWorkerSegmentGroups as EP } from "./gviewer.js";
import { STLLoader as aP } from "three/examples/jsm/loaders/STLLoader.js";
function hP(r) {
  const Q = [];
  let B = null;
  for (const A of r.specs) {
    if (A.positions.length === 0 || A.opacity <= 0)
      continue;
    const t = A.positions.length / 3, P = A.colors ? A.colors.slice() : ot(A.kind, t, r.options), e = new Float32Array(P.length);
    e.set(P);
    const i = new h.BufferGeometry();
    i.setAttribute("position", new h.BufferAttribute(A.positions, 3));
    const s = new h.BufferAttribute(e, 3);
    s.setUsage(h.DynamicDrawUsage), i.setAttribute("color", s), i.computeBoundingBox();
    const v = new h.LineBasicMaterial({
      vertexColors: !0,
      transparent: !0,
      opacity: A.opacity
    }), c = new h.LineSegments(i, v);
    r.scene.add(c), Q.push({
      line: c,
      baseColors: P,
      simColors: e,
      prefixEndVertex: A.prefixEndVertex,
      totalVertices: t,
      greyCursorVertex: 0,
      kind: A.kind,
      cutBucketIndex: A.cutBucketIndex
    }), i.boundingBox && (B = B ? B.union(i.boundingBox) : i.boundingBox.clone());
  }
  return { streams: Q, bounds: B };
}
function kP(r, Q) {
  for (const B of Q)
    r.remove(B.line), B.line.geometry.dispose(), B.line.material.dispose();
}
function lP(r, Q) {
  for (const B of r) {
    const A = ot(B.kind, B.totalVertices, Q);
    B.baseColors = A, B.simColors.set(A), B.greyCursorVertex = 0;
    const t = B.line.geometry.getAttribute("color");
    t.clearUpdateRanges(), t.addUpdateRange(0, B.simColors.length), t.needsUpdate = !0;
  }
}
function UP(r) {
  const Q = tA(r.options.render.theme.rapidOpacity ?? 0.3);
  for (const B of r.streams) {
    const A = B.line.material;
    if (B.kind === "rapid") {
      A.opacity = Q;
      continue;
    }
    A.opacity = CP({
      bucketIndex: B.cutBucketIndex ?? 0,
      bucketCount: r.cutBucketCount,
      baseOpacity: r.options.render.theme.opacity
    });
  }
}
function DP(r) {
  const Q = r.stream.totalVertices, B = Math.max(0, Math.min(Q, Math.floor(r.nextCursorVertex))), A = Math.max(0, Math.min(Q, Math.floor(r.stream.greyCursorVertex)));
  if (B === A)
    return;
  const t = r.stream.line.geometry.getAttribute("color"), P = uP(r.options), e = Math.min(A, B), i = Math.max(A, B);
  if (B > A)
    for (let s = A; s < B; s += 1) {
      const v = s * 3;
      r.stream.simColors[v] = P.r, r.stream.simColors[v + 1] = P.g, r.stream.simColors[v + 2] = P.b;
    }
  else {
    const s = B * 3, v = A * 3;
    r.stream.simColors.set(r.stream.baseColors.subarray(s, v), s);
  }
  t.clearUpdateRanges(), t.addUpdateRange(e * 3, (i - e) * 3), t.needsUpdate = !0, r.stream.greyCursorVertex = B;
}
function ot(r, Q, B) {
  const A = B.render.theme.colors, t = B.mode.laser ? A.laser ?? A.cutting : A.cutting, P = new h.Color(r === "rapid" ? A.rapid : t), e = new Float32Array(Q * 3);
  for (let i = 0; i < Q; i += 1) {
    const s = i * 3;
    e[s] = P.r, e[s + 1] = P.g, e[s + 2] = P.b;
  }
  return e;
}
function uP(r) {
  const Q = r.render.theme.colors, B = new h.Color(r.render.theme.background), A = new h.Color(Q.processed ?? Q.cutting), t = B.clone().lerp(A, 0.65);
  return { r: t.r, g: t.g, b: t.b };
}
function CP(r) {
  if (r.bucketCount <= 1)
    return tA(r.baseOpacity);
  const Q = r.bucketIndex / (r.bucketCount - 1);
  return tA(r.baseOpacity * Q);
}
function tA(r) {
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}
const xA = {
  background: "#111827",
  opacity: 0.9,
  rapidOpacity: 0.3,
  colors: {
    rapid: "#0ef6ae",
    cutting: "#3e85c7",
    laser: "#a855f7",
    processed: "#6b7280",
    boundingBox: "#77a9d7",
    grid: { major: "#2f3840", minor: "#1f252b" },
    axes: { x: "#df3b3b", y: "#06b881", z: "#295d8d" }
  }
}, NP = {
  units: "mm",
  mode: { laser: !1, sim3d: !1 },
  sim3d: { toolDiameter: 6.35, resolution: 256, showToolpath: !1, erosionPasses: 2 },
  bit: {
    enabled: !0,
    type: "drill",
    size: 4.05,
    opacity: 0.9,
    tweenMs: 140,
    colorSource: "cutting",
    color: xA.colors.cutting,
    spinRpm: 300
  },
  progress: { mode: "grey" },
  grid: { size: 1e3, axisDepth: 200, labels: !0 },
  boundingBox: { visible: !1, labels: !1 },
  geometry: { arcSegments: 30, batching: { progressEveryLines: 5e3, yieldEveryLines: 5e4 } },
  render: { antialias: !0, theme: xA },
  camera: {
    fov: 45,
    focusDurationMs: 900,
    orbit: { enableDamping: !0 },
    initialPosition: { x: 0, y: -200, z: 200 }
  }
};
async function OP(r, Q, B, A) {
  var M, b, j;
  const t = Math.max(2, Math.floor(B)), P = (A == null ? void 0 : A.arcSegments) ?? 30, e = (A == null ? void 0 : A.checkpointEveryLines) ?? 2e3, i = ((M = A == null ? void 0 : A.batch) == null ? void 0 : M.yieldEveryLines) ?? 1e4, s = ((b = A == null ? void 0 : A.batch) == null ? void 0 : b.shouldAbort) ?? (() => !1), v = (j = A == null ? void 0 : A.batch) == null ? void 0 : j.onProgress;
  if (r.length === 0) {
    const d = {
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      zTop: 1,
      zBot: 0
    }, G = new Float32Array(t * t).fill(d.zTop), f = /* @__PURE__ */ new Map();
    return f.set(0, new Float32Array(G)), { moves: [], checkpoints: f, slabBounds: d, resolution: t, toolRadius: Q };
  }
  let c = 1 / 0, n = -1 / 0, T = 1 / 0, z = -1 / 0, w = 1 / 0, o = -1 / 0;
  const E = new AA({
    onLinearMove(d) {
      if (d.modals.motion === "G0") return;
      const G = d.transformedStart ?? d.start, f = d.transformedEnd ?? d.end;
      for (const H of [G, f])
        H.X < c && (c = H.X), H.X > n && (n = H.X), H.Y < T && (T = H.Y), H.Y > z && (z = H.Y), H.Z < w && (w = H.Z), H.Z > o && (o = H.Z);
    },
    onArcMove(d) {
      const G = d.transformedStart ?? d.start, f = d.transformedEnd ?? d.end, H = d.transformedMax ?? d.max;
      for (const F of [G, f, H])
        F.X < c && (c = F.X), F.X > n && (n = F.X), F.Y < T && (T = F.Y), F.Y > z && (z = F.Y), F.Z < w && (w = F.Z), F.Z > o && (o = F.Z);
    }
  });
  for (const d of r)
    E.processLine(d);
  isFinite(c) || (c = -1, n = 1, T = -1, z = 1, w = 0, o = 0), c === n && (c -= Q * 2, n += Q * 2), T === z && (T -= Q * 2, z += Q * 2), c -= Q, n += Q, T -= Q, z += Q;
  const k = o;
  let a = w - Q;
  a >= k && (a = k - 1);
  const U = { xMin: c, xMax: n, yMin: T, yMax: z, zTop: k, zBot: a }, D = new Float32Array(t * t).fill(k), l = /* @__PURE__ */ new Map();
  l.set(0, new Float32Array(D));
  const O = [];
  let u = 0, N = 0;
  const C = new AA({
    onLinearMove(d) {
      const G = d.transformedStart ?? d.start, f = d.transformedEnd ?? d.end, H = {
        lineIndex: N,
        x0: G.X,
        y0: G.Y,
        z0: G.Z,
        x1: f.X,
        y1: f.Y,
        z1: f.Z
      };
      O.push(H), PA(H, D, U, Q, t);
    },
    onArcMove(d) {
      const G = d.transformedStart ?? d.start, f = d.transformedEnd ?? d.end, H = d.transformedCenter ?? d.center, F = dP(G, f, H, d.plane, d.motion, P);
      for (const X of F) {
        const nQ = { lineIndex: N, ...X };
        O.push(nQ), PA(nQ, D, U, Q, t);
      }
    }
  });
  for (let d = 0; d < r.length && !s(); d++) {
    N = d;
    const G = r[d];
    G !== void 0 && C.processLine(G), d - u >= e && (l.set(d, new Float32Array(D)), u = d), d % i === 0 && d > 0 && (v == null || v(d, r.length), await new Promise((f) => setTimeout(f, 0)));
  }
  return v == null || v(r.length, r.length), { moves: O, checkpoints: l, slabBounds: U, resolution: t, toolRadius: Q };
}
function PA(r, Q, B, A, t) {
  const P = (B.xMax - B.xMin) / t, e = (B.yMax - B.yMin) / t, i = Math.hypot(r.x1 - r.x0, r.y1 - r.y0), s = Math.max(1e-3, Math.min(P, e) * 0.5), v = Math.max(1, Math.ceil(i / s)), c = Math.ceil(A / P), n = Math.ceil(A / e), T = A * A;
  for (let z = 0; z <= v; z++) {
    const w = z / v, o = r.x0 + (r.x1 - r.x0) * w, E = r.y0 + (r.y1 - r.y0) * w, k = r.z0 + (r.z1 - r.z0) * w, a = Math.floor((o - B.xMin) / P), U = Math.floor((E - B.yMin) / e);
    for (let D = -c; D <= c; D++) {
      const l = a + D;
      if (l < 0 || l >= t) continue;
      const O = B.xMin + (l + 0.5) * P, u = (O - o) * (O - o);
      if (!(u > T))
        for (let N = -n; N <= n; N++) {
          const C = U + N;
          if (C < 0 || C >= t) continue;
          const M = B.yMin + (C + 0.5) * e;
          if (u + (M - E) * (M - E) > T) continue;
          const j = C * t + l;
          Q[j] > k && (Q[j] = k);
        }
    }
  }
}
function mB(r, Q) {
  let B = 0;
  for (const P of Q.checkpoints.keys())
    P <= r && P > B && (B = P);
  const A = Q.checkpoints.get(B), t = A ? new Float32Array(A) : new Float32Array(Q.resolution * Q.resolution).fill(Q.slabBounds.zTop);
  for (const P of Q.moves)
    P.lineIndex > B && P.lineIndex <= r && PA(P, t, Q.slabBounds, Q.toolRadius, Q.resolution);
  return t;
}
function yB(r, Q, B, A) {
  if (B <= 0) return;
  const t = 1e-3, P = Q * Q, e = new Float32Array(P);
  for (let i = 0; i < B; i++) {
    e.set(r);
    for (let s = 0; s < Q; s++)
      for (let v = 0; v < Q; v++) {
        if (e[s * Q + v] < A - t) continue;
        let n = A;
        for (let T = -1; T <= 1; T++) {
          const z = s + T;
          if (!(z < 0 || z >= Q))
            for (let w = -1; w <= 1; w++) {
              if (w === 0 && T === 0) continue;
              const o = v + w;
              if (o < 0 || o >= Q) continue;
              const E = e[z * Q + o];
              E < n && (n = E);
            }
        }
        n < A - t && (r[s * Q + v] = n);
      }
  }
}
function dP(r, Q, B, A, t, P) {
  const e = Math.max(1, P);
  let i, s, v;
  A === "G18" ? (i = "Z", s = "X", v = "Y") : A === "G19" ? (i = "Y", s = "Z", v = "X") : (i = "X", s = "Y", v = "Z");
  const c = Math.hypot(r[i] - B[i], r[s] - B[s]), n = Math.atan2(r[s] - B[s], r[i] - B[i]), T = Math.atan2(Q[s] - B[s], Q[i] - B[i]);
  let z;
  t === "G2" ? (z = T - n, z > 0 && (z -= Math.PI * 2)) : (z = T - n, z < 0 && (z += Math.PI * 2));
  const w = [];
  let o = { ...r };
  for (let E = 1; E <= e; E++) {
    const k = E / e, a = n + z * k, U = k, D = B[i] + c * Math.cos(a), l = B[s] + c * Math.sin(a), O = r[v] + (Q[v] - r[v]) * U, u = { X: 0, Y: 0, Z: 0 };
    u[i] = D, u[s] = l, u[v] = O, w.push({
      x0: o.X,
      y0: o.Y,
      z0: o.Z,
      x1: u.X,
      y1: u.Y,
      z1: u.Z
    }), o = u;
  }
  return w;
}
let uB = null;
function LP() {
  if (uB) return uB;
  const r = 512, Q = document.createElement("canvas");
  Q.width = r, Q.height = r;
  const B = Q.getContext("2d");
  B.fillStyle = "#8B5E3C", B.fillRect(0, 0, r, r);
  const A = Math.floor(40 + Math.random() * 20);
  for (let t = 0; t < A; t++) {
    const P = Math.random() * r, e = 1 + Math.random() * 2, i = Math.floor(139 + (Math.random() - 0.5) * 40), s = Math.floor(94 + (Math.random() - 0.5) * 30), v = Math.floor(60 + (Math.random() - 0.5) * 20);
    B.strokeStyle = `rgb(${i},${s},${v})`, B.lineWidth = e, B.beginPath(), B.moveTo(0, P), B.lineTo(r, P), B.stroke();
  }
  for (let t = 0; t < 300; t++) {
    const P = Math.random() * r, e = Math.random() * r, i = 20 + Math.random() * 60, s = (Math.random() - 0.5) * 0.3, v = Math.floor(100 + Math.random() * 80), c = Math.floor(60 + Math.random() * 50), n = Math.floor(30 + Math.random() * 40);
    B.strokeStyle = `rgba(${v},${c},${n},0.35)`, B.lineWidth = 0.5 + Math.random() * 1, B.beginPath(), B.moveTo(P, e), B.quadraticCurveTo(
      P + i * 0.5 * Math.cos(s),
      e + i * 0.5 * Math.sin(s) * 0.1,
      P + i * Math.cos(s * 0.5),
      e + i * 0.15
    ), B.stroke();
  }
  return uB = new h.CanvasTexture(Q), uB;
}
function MP(r, Q) {
  const B = new h.Group();
  B.name = "gviewer:sim3d-slab";
  const A = r.xMax - r.xMin, t = r.yMax - r.yMin, P = r.zTop - r.zBot, e = (r.xMin + r.xMax) / 2, i = (r.yMin + r.yMax) / 2, s = (r.zBot + r.zTop) / 2, v = LP();
  v.wrapS = h.RepeatWrapping, v.wrapT = h.RepeatWrapping, v.repeat.set(A / 100, t / 100);
  const c = new h.MeshStandardMaterial({
    map: v,
    roughness: 0.85,
    metalness: 0,
    side: h.FrontSide
  }), n = new h.MeshStandardMaterial({
    color: 8016432,
    roughness: 0.9,
    metalness: 0,
    side: h.DoubleSide
  }), T = new h.MeshStandardMaterial({
    color: 7030822,
    roughness: 0.9,
    metalness: 0
  }), z = new h.PlaneGeometry(A, t, Q - 1, Q - 1), w = Q * Q, o = new Float32Array(w * 3), E = z.attributes.position;
  for (let j = 0; j < w; j++)
    o[j * 3] = E.getX(j), o[j * 3 + 1] = E.getY(j), o[j * 3 + 2] = 0;
  const k = new h.BufferAttribute(o, 3);
  k.usage = h.DynamicDrawUsage, z.setAttribute("position", k), z.computeVertexNormals();
  const a = new h.Mesh(z, c);
  a.name = "gviewer:sim3d-top", a.position.set(e, i, r.zTop), B.add(a);
  const U = new h.PlaneGeometry(A, P);
  U.rotateX(Math.PI / 2);
  const D = new h.Mesh(U, n);
  D.position.set(e, r.yMax, s), B.add(D);
  const l = new h.PlaneGeometry(A, P);
  l.rotateX(Math.PI / 2);
  const O = new h.Mesh(l, n);
  O.position.set(e, r.yMin, s), B.add(O);
  const u = new h.PlaneGeometry(P, t);
  u.rotateY(-Math.PI / 2);
  const N = new h.Mesh(u, n);
  N.position.set(r.xMax, i, s), B.add(N);
  const C = new h.PlaneGeometry(P, t);
  C.rotateY(-Math.PI / 2);
  const M = new h.Mesh(C, n);
  M.position.set(r.xMin, i, s), B.add(M);
  const b = new h.Mesh(new h.PlaneGeometry(A, t), T);
  return b.position.set(e, i, r.zBot), B.add(b), { group: B, topMesh: a, topPositionAttr: k, slabBounds: r, resolution: Q };
}
function IB(r, Q) {
  const { topPositionAttr: B, slabBounds: A, resolution: t } = r, P = t * t;
  for (let e = 0; e < P; e++) {
    const i = Math.floor(e / t), s = e % t, v = (t - 1 - i) * t + s;
    B.setZ(e, Q[v] - A.zTop);
  }
  B.needsUpdate = !0, r.topMesh.geometry.computeVertexNormals();
}
function HP(r) {
  r.group.traverse((Q) => {
    if (Q instanceof h.Mesh) {
      Q.geometry.dispose();
      const B = Q.material;
      Array.isArray(B) ? B.forEach((A) => {
        A.map && A.map.dispose(), A.dispose();
      }) : (B.map && B.map.dispose(), B.dispose());
    }
  });
}
class jP {
  constructor(Q) {
    this.onSelectView = Q.onSelectView, this.faceButtons = /* @__PURE__ */ new Map(), this.root = document.createElement("div"), this.root.className = "gViewer-viewcube", this.cube = document.createElement("div"), this.cube.className = "gViewer-viewcube__cube", this.root.appendChild(this.cube);
    const B = [
      { view: "front", className: "gViewer-viewcube__face--front", label: "Front" },
      { view: "back", className: "gViewer-viewcube__face--back", label: "Back" },
      { view: "left", className: "gViewer-viewcube__face--left", label: "Left" },
      { view: "right", className: "gViewer-viewcube__face--right", label: "Right" },
      { view: "top", className: "gViewer-viewcube__face--top", label: "Top" },
      { view: "bottom", className: "gViewer-viewcube__face--bottom", label: "Bottom" }
    ];
    for (const A of B) {
      const t = document.createElement("button");
      t.type = "button", t.className = `gViewer-viewcube__face ${A.className}`, t.textContent = A.label, t.addEventListener("click", () => this.onSelectView(A.view)), this.cube.appendChild(t), this.faceButtons.set(A.view, t);
    }
    Q.container.appendChild(this.root);
  }
  setActiveFace(Q) {
    for (const [B, A] of this.faceButtons.entries())
      B === Q ? A.classList.add("is-active") : A.classList.remove("is-active");
  }
  setRotationMatrix3d(Q) {
    const B = Array.from({ length: 16 }, (A, t) => {
      const P = Q[t] ?? 0;
      return Number.isFinite(P) ? String(Math.abs(P) < 1e-12 ? 0 : Number(P.toFixed(8))) : "0";
    });
    this.cube.style.transform = `matrix3d(${B.join(",")})`;
  }
  dispose() {
    this.root.remove();
  }
}
function OQ(r, Q, B = {}) {
  const { opacity: A = 1, size: t = 10 } = B, P = new h.Object3D(), e = 100, i = document.createElement("canvas"), s = i.getContext("2d");
  if (!s)
    throw new Error("Missing canvas 2D context.");
  s.font = `normal ${e}px Arial`;
  const c = s.measureText(r).width;
  i.width = c, i.height = e, s.font = `normal ${e}px Arial`, s.textAlign = "center", s.textBaseline = "middle", s.fillStyle = Q, s.fillText(r, c / 2, e / 2);
  const n = new h.Texture(i);
  n.needsUpdate = !0, n.minFilter = h.LinearFilter;
  const T = new h.SpriteMaterial({
    map: n,
    transparent: !0,
    opacity: A
  });
  P.textHeight = t, P.textWidth = c / e * P.textHeight, B.textAlign === "left" ? P.position.x = (B.x ?? 0) + (P.textWidth ?? 0) / 2 : B.textAlign === "right" ? P.position.x = (B.x ?? 0) - (P.textWidth ?? 0) / 2 : P.position.x = B.x ?? 0, B.textBaseline === "top" ? P.position.y = (B.y ?? 0) - (P.textHeight ?? 0) / 2 : B.textBaseline === "bottom" ? P.position.y = (B.y ?? 0) + (P.textHeight ?? 0) / 2 : P.position.y = B.y ?? 0, P.position.z = B.z ?? 0;
  const z = new h.Sprite(T);
  return z.scale.set(c / e * t, t, 1), P.add(z), P;
}
function FP(r) {
  r.traverse((Q) => {
    var A;
    if (!(Q instanceof h.Sprite))
      return;
    const B = Q.material;
    (A = B.map) == null || A.dispose(), B.dispose();
  });
}
const GP = 25.4;
function fP(r, Q) {
  const B = new h.Group(), A = new h.Box3Helper(
    r.clone(),
    new h.Color(Q.render.theme.colors.boundingBox)
  ), t = A.material;
  return t.transparent = !0, t.opacity = 0.12, t.depthWrite = !1, B.add(A), Q.boundingBox.labels && B.add(...bP(r.clone(), Q)), B;
}
function bP(r, Q) {
  const B = Q.render.theme.colors.boundingBox, A = 0.32, t = (U) => Math.abs(U) < 1e-9 ? "0" : U.toFixed(3), P = (U) => Q.units === "in" ? `${t(U / GP)} in` : `${t(U)} mm`, e = r.min, i = r.max, s = (U) => OQ(U, B, { size: 4, opacity: A }), v = s(P(e.x)), c = s(P(i.x)), n = s(P(e.y)), T = s(P(i.y)), z = s(P(e.z)), w = s(P(i.z)), o = new h.Vector3();
  r.getSize(o);
  const E = Math.max(2, Math.max(o.x, o.y, o.z) * 0.02), k = (e.x + i.x) / 2, a = (e.y + i.y) / 2;
  return v.position.set(e.x - E, a, e.z - E), c.position.set(i.x + E, a, e.z - E), n.position.set(k, e.y - E, e.z - E), T.position.set(k, i.y + E, e.z - E), z.position.set(k, a, e.z - E), w.position.set(k, a, i.z + E), [v, c, n, T, z, w];
}
function gP(r) {
  r.traverse((Q) => {
    var B;
    if (Q instanceof h.LineSegments || Q instanceof h.Line) {
      Q.geometry.dispose();
      const A = Q.material;
      Array.isArray(A) ? A.forEach((t) => t.dispose()) : A.dispose();
      return;
    }
    if (Q instanceof h.Sprite) {
      const A = Q.material;
      (B = A.map) == null || B.dispose(), A.dispose();
    }
  });
}
function pP(r) {
  const Q = window.getComputedStyle(r);
  (Q.position === "static" || !Q.position) && (r.style.position = "relative"), r.style.overflow || (r.style.overflow = "hidden");
}
function xP(r) {
  if (r < 0.5)
    return 4 * r * r * r;
  const Q = -2 * r + 2;
  return 1 - Q * Q * Q / 2;
}
function mA(r) {
  const Q = new h.Vector3(), B = {
    right: new h.Vector3(1, 0, 0),
    left: new h.Vector3(-1, 0, 0),
    front: new h.Vector3(0, -1, 0),
    back: new h.Vector3(0, 1, 0),
    top: new h.Vector3(0, 0, 1),
    bottom: new h.Vector3(0, 0, -1)
  };
  switch (r) {
    case "front":
      Q.copy(B.front);
      break;
    case "back":
      Q.copy(B.back);
      break;
    case "left":
      Q.copy(B.left);
      break;
    case "right":
      Q.copy(B.right);
      break;
    case "top":
      Q.copy(B.top);
      break;
    case "bottom":
      Q.copy(B.bottom);
      break;
    case "front-top-left":
      Q.copy(B.front).add(B.top).add(B.left);
      break;
    case "front-top-right":
      Q.copy(B.front).add(B.top).add(B.right);
      break;
    case "front-bottom-left":
      Q.copy(B.front).add(B.bottom).add(B.left);
      break;
    case "front-bottom-right":
      Q.copy(B.front).add(B.bottom).add(B.right);
      break;
    case "back-top-left":
      Q.copy(B.back).add(B.top).add(B.left);
      break;
    case "back-top-right":
      Q.copy(B.back).add(B.top).add(B.right);
      break;
    case "back-bottom-left":
      Q.copy(B.back).add(B.bottom).add(B.left);
      break;
    case "back-bottom-right":
      Q.copy(B.back).add(B.bottom).add(B.right);
      break;
    default:
      Q.copy(B.front);
      break;
  }
  return Q.normalize();
}
function mP(r, Q) {
  const B = r.x - Q.x, A = r.y - Q.y, t = r.z - Q.z, P = Math.abs(B), e = Math.abs(A), i = Math.abs(t);
  return i >= P && i >= e ? t >= 0 ? "top" : "bottom" : P >= e ? B >= 0 ? "right" : "left" : A >= 0 ? "back" : "front";
}
const eA = 25.4;
function yP(r) {
  const B = Math.max(1, r.sizeMm) / 2, A = r.units === "mm" ? 10 : eA, t = Math.max(0, Math.floor(B / A)), P = [], e = [], i = (v, c, n, T, z) => {
    z.push(v, c, 0, n, T, 0);
  };
  for (let v = -t; v <= t; v += 1) {
    const c = v * A;
    i(-B, c, B, c, v === 0 ? P : e);
  }
  for (let v = -t; v <= t; v += 1) {
    const c = v * A;
    i(c, -B, c, B, v === 0 ? P : e);
  }
  const s = new h.Group();
  return e.length > 0 && s.add(yA(e, r.theme.colors.grid.minor, 0.25)), P.length > 0 && s.add(yA(P, r.theme.colors.grid.major, 0.4)), s;
}
function yA(r, Q, B) {
  const A = new h.BufferGeometry();
  A.setAttribute("position", new h.Float32BufferAttribute(r, 3));
  const t = new h.LineBasicMaterial({
    color: new h.Color(Q),
    transparent: !0,
    opacity: B,
    depthWrite: !1
  });
  return new h.LineSegments(A, t);
}
function IP(r) {
  r.traverse((Q) => {
    if (!(Q instanceof h.LineSegments))
      return;
    Q.geometry.dispose();
    const B = Q.material;
    Array.isArray(B) ? B.forEach((A) => A.dispose()) : B.dispose();
  });
}
function SP(r) {
  const Q = new h.Group(), B = Math.max(1, r.sizeWorld) / 2, A = Math.max(1, r.depthWorld), t = Math.max(1, Math.min(B / 12, 30)), P = t * 0.6, e = (w) => new h.LineDashedMaterial({
    color: new h.Color(w),
    dashSize: t,
    gapSize: P,
    transparent: !0,
    opacity: 0.75,
    depthWrite: !1
  }), i = new h.Line(
    new h.BufferGeometry().setFromPoints([
      new h.Vector3(-B, 0, 0),
      new h.Vector3(B, 0, 0)
    ]),
    e(r.theme.colors.axes.x)
  );
  i.computeLineDistances();
  const s = new h.Line(
    new h.BufferGeometry().setFromPoints([
      new h.Vector3(0, -B, 0),
      new h.Vector3(0, B, 0)
    ]),
    e(r.theme.colors.axes.y)
  );
  s.computeLineDistances();
  const v = new h.Line(
    new h.BufferGeometry().setFromPoints([
      new h.Vector3(0, 0, 0),
      new h.Vector3(0, 0, A)
    ]),
    e(r.theme.colors.axes.z)
  );
  v.computeLineDistances(), Q.add(i, s, v);
  const c = Math.max(2, t), n = OQ("X", r.theme.colors.axes.x, { size: 5 });
  n.position.set(B + c, 0, 0);
  const T = OQ("Y", r.theme.colors.axes.y, { size: 5 });
  T.position.set(0, B + c, 0);
  const z = OQ("Z", r.theme.colors.axes.z, { size: 5 });
  return z.position.set(0, 0, A + c), Q.add(n, T, z), Q;
}
function YP(r) {
  r.traverse((Q) => {
    var B;
    if (Q instanceof h.Line) {
      Q.geometry.dispose();
      const A = Q.material;
      Array.isArray(A) ? A.forEach((t) => t.dispose()) : A.dispose();
      return;
    }
    if (Q instanceof h.Sprite) {
      const A = Q.material;
      (B = A.map) == null || B.dispose(), A.dispose();
    }
  });
}
function VP(r) {
  const Q = new h.Group(), B = Math.max(1, r.sizeMm) / 2, A = r.units === "mm" ? 10 : 1, t = A, P = r.units === "mm" ? B : B / eA, e = A * 2, i = r.units === "mm" ? 1 : eA, s = 0.5, v = 4, c = 0.1, n = 5;
  for (let T = t; T <= P + 1e-6; T += e) {
    const z = T * i;
    if (z > B + 1e-6)
      continue;
    const w = r.theme.colors.axes.x, o = r.theme.colors.axes.y, E = { opacity: s, size: v }, k = OQ(String(T), w, E);
    k.position.set(z, n, c);
    const a = OQ(String(-T), w, E);
    a.position.set(-z, n, c);
    const U = OQ(String(T), o, E);
    U.position.set(-n, z, c);
    const D = OQ(String(-T), o, E);
    D.position.set(-n, -z, c), Q.add(k, a, U, D);
  }
  return Q;
}
function UQ(r) {
  if (r === void 0)
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return r;
}
function Tt(r, Q) {
  r.prototype = Object.create(Q.prototype), r.prototype.constructor = r, r.__proto__ = Q;
}
/*!
 * GSAP 3.15.0
 * https://gsap.com
 *
 * @license Copyright 2008-2026, GreenSock. All rights reserved.
 * Subject to the terms at https://gsap.com/standard-license
 * @author: Jack Doyle, jack@greensock.com
*/
var sQ = {
  autoSleep: 120,
  force3D: "auto",
  nullTargetWarn: 1,
  units: {
    lineHeight: ""
  }
}, TB = {
  duration: 0.5,
  overwrite: !1,
  delay: 0
}, lA, Z, m, zQ = 1e8, x = 1 / zQ, iA = Math.PI * 2, JP = iA / 4, RP = 0, zt = Math.sqrt, XP = Math.cos, KP = Math.sin, K = function(Q) {
  return typeof Q == "string";
}, Y = function(Q) {
  return typeof Q == "function";
}, uQ = function(Q) {
  return typeof Q == "number";
}, UA = function(Q) {
  return typeof Q > "u";
}, kQ = function(Q) {
  return typeof Q == "object";
}, $ = function(Q) {
  return Q !== !1;
}, DA = function() {
  return typeof window < "u";
}, CB = function(Q) {
  return Y(Q) || K(Q);
}, wt = typeof ArrayBuffer == "function" && ArrayBuffer.isView || function() {
}, q = Array.isArray, ZP = /random\([^)]+\)/g, WP = /,\s*/g, IA = /(?:-?\.?\d|\.)+/gi, Et = /[-+=.]*\d+[.e\-+]*\d*[e\-+]*\d*/g, KQ = /[-+=.]*\d+[.e-]*\d*[a-z%]*/g, SB = /[-+=.]*\d+\.?\d*(?:e-|e\+)?\d*/gi, at = /[+-]=-?[.\d]+/, qP = /[^,'"\[\]\s]+/gi, _P = /^[+\-=e\s\d]*\d+[.\d]*([a-z]*|%)\s*$/i, I, EQ, rA, uA, vQ = {}, MB = {}, ht, kt = function(Q) {
  return (MB = $Q(Q, vQ)) && tQ;
}, CA = function(Q, B) {
  return console.warn("Invalid property", Q, "set to", B, "Missing plugin? gsap.registerPlugin()");
}, zB = function(Q, B) {
  return !B && console.warn(Q);
}, lt = function(Q, B) {
  return Q && (vQ[Q] = B) && MB && (MB[Q] = B) || vQ;
}, wB = function() {
  return 0;
}, $P = {
  suppressEvents: !0,
  isStart: !0,
  kill: !1
}, NB = {
  suppressEvents: !0,
  kill: !1
}, Qe = {
  suppressEvents: !0
}, NA = {}, HQ = [], sA = {}, Ut, PQ = {}, YB = {}, SA = 30, OB = [], OA = "", dA = function(Q) {
  var B = Q[0], A, t;
  if (kQ(B) || Y(B) || (Q = [Q]), !(A = (B._gsap || {}).harness)) {
    for (t = OB.length; t-- && !OB[t].targetTest(B); )
      ;
    A = OB[t];
  }
  for (t = Q.length; t--; )
    Q[t] && (Q[t]._gsap || (Q[t]._gsap = new Yt(Q[t], A))) || Q.splice(t, 1);
  return Q;
}, SQ = function(Q) {
  return Q._gsap || dA(wQ(Q))[0]._gsap;
}, Dt = function(Q, B, A) {
  return (A = Q[B]) && Y(A) ? Q[B]() : UA(A) && Q.getAttribute && Q.getAttribute(B) || A;
}, QQ = function(Q, B) {
  return (Q = Q.split(",")).forEach(B) || Q;
}, V = function(Q) {
  return Math.round(Q * 1e5) / 1e5 || 0;
}, y = function(Q) {
  return Math.round(Q * 1e7) / 1e7 || 0;
}, WQ = function(Q, B) {
  var A = B.charAt(0), t = parseFloat(B.substr(2));
  return Q = parseFloat(Q), A === "+" ? Q + t : A === "-" ? Q - t : A === "*" ? Q * t : Q / t;
}, Be = function(Q, B) {
  for (var A = B.length, t = 0; Q.indexOf(B[t]) < 0 && ++t < A; )
    ;
  return t < A;
}, HB = function() {
  var Q = HQ.length, B = HQ.slice(0), A, t;
  for (sA = {}, HQ.length = 0, A = 0; A < Q; A++)
    t = B[A], t && t._lazy && (t.render(t._lazy[0], t._lazy[1], !0)._lazy = 0);
}, LA = function(Q) {
  return !!(Q._initted || Q._startAt || Q.add);
}, ut = function(Q, B, A, t) {
  HQ.length && !Z && HB(), Q.render(B, A, !!(Z && B < 0 && LA(Q))), HQ.length && !Z && HB();
}, Ct = function(Q) {
  var B = parseFloat(Q);
  return (B || B === 0) && (Q + "").match(qP).length < 2 ? B : K(Q) ? Q.trim() : Q;
}, Nt = function(Q) {
  return Q;
}, cQ = function(Q, B) {
  for (var A in B)
    A in Q || (Q[A] = B[A]);
  return Q;
}, Ae = function(Q) {
  return function(B, A) {
    for (var t in A)
      t in B || t === "duration" && Q || t === "ease" || (B[t] = A[t]);
  };
}, $Q = function(Q, B) {
  for (var A in B)
    Q[A] = B[A];
  return Q;
}, YA = function r(Q, B) {
  for (var A in B)
    A !== "__proto__" && A !== "constructor" && A !== "prototype" && (Q[A] = kQ(B[A]) ? r(Q[A] || (Q[A] = {}), B[A]) : B[A]);
  return Q;
}, jB = function(Q, B) {
  var A = {}, t;
  for (t in Q)
    t in B || (A[t] = Q[t]);
  return A;
}, cB = function(Q) {
  var B = Q.parent || I, A = Q.keyframes ? Ae(q(Q.keyframes)) : cQ;
  if ($(Q.inherit))
    for (; B; )
      A(Q, B.vars.defaults), B = B.parent || B._dp;
  return Q;
}, te = function(Q, B) {
  for (var A = Q.length, t = A === B.length; t && A-- && Q[A] === B[A]; )
    ;
  return A < 0;
}, Ot = function(Q, B, A, t, P) {
  var e = Q[t], i;
  if (P)
    for (i = B[P]; e && e[P] > i; )
      e = e._prev;
  return e ? (B._next = e._next, e._next = B) : (B._next = Q[A], Q[A] = B), B._next ? B._next._prev = B : Q[t] = B, B._prev = e, B.parent = B._dp = Q, B;
}, gB = function(Q, B, A, t) {
  A === void 0 && (A = "_first"), t === void 0 && (t = "_last");
  var P = B._prev, e = B._next;
  P ? P._next = e : Q[A] === B && (Q[A] = e), e ? e._prev = P : Q[t] === B && (Q[t] = P), B._next = B._prev = B.parent = null;
}, FQ = function(Q, B) {
  Q.parent && (!B || Q.parent.autoRemoveChildren) && Q.parent.remove && Q.parent.remove(Q), Q._act = 0;
}, YQ = function(Q, B) {
  if (Q && (!B || B._end > Q._dur || B._start < 0))
    for (var A = Q; A; )
      A._dirty = 1, A = A.parent;
  return Q;
}, Pe = function(Q) {
  for (var B = Q.parent; B && B.parent; )
    B._dirty = 1, B.totalDuration(), B = B.parent;
  return Q;
}, vA = function(Q, B, A, t) {
  return Q._startAt && (Z ? Q._startAt.revert(NB) : Q.vars.immediateRender && !Q.vars.autoRevert || Q._startAt.render(B, !0, t));
}, ee = function r(Q) {
  return !Q || Q._ts && r(Q.parent);
}, VA = function(Q) {
  return Q._repeat ? QB(Q._tTime, Q = Q.duration() + Q._rDelay) * Q : 0;
}, QB = function(Q, B) {
  var A = Math.floor(Q = y(Q / B));
  return Q && A === Q ? A - 1 : A;
}, FB = function(Q, B) {
  return (Q - B._start) * B._ts + (B._ts >= 0 ? 0 : B._dirty ? B.totalDuration() : B._tDur);
}, pB = function(Q) {
  return Q._end = y(Q._start + (Q._tDur / Math.abs(Q._ts || Q._rts || x) || 0));
}, xB = function(Q, B) {
  var A = Q._dp;
  return A && A.smoothChildTiming && Q._ts && (Q._start = y(A._time - (Q._ts > 0 ? B / Q._ts : ((Q._dirty ? Q.totalDuration() : Q._tDur) - B) / -Q._ts)), pB(Q), A._dirty || YQ(A, Q)), Q;
}, dt = function(Q, B) {
  var A;
  if ((B._time || !B._dur && B._initted || B._start < Q._time && (B._dur || !B.add)) && (A = FB(Q.rawTime(), B), (!B._dur || UB(0, B.totalDuration(), A) - B._tTime > x) && B.render(A, !0)), YQ(Q, B)._dp && Q._initted && Q._time >= Q._dur && Q._ts) {
    if (Q._dur < Q.duration())
      for (A = Q; A._dp; )
        A.rawTime() >= 0 && A.totalTime(A._tTime), A = A._dp;
    Q._zTime = -x;
  }
}, aQ = function(Q, B, A, t) {
  return B.parent && FQ(B), B._start = y((uQ(A) ? A : A || Q !== I ? TQ(Q, A, B) : Q._time) + B._delay), B._end = y(B._start + (B.totalDuration() / Math.abs(B.timeScale()) || 0)), Ot(Q, B, "_first", "_last", Q._sort ? "_start" : 0), cA(B) || (Q._recent = B), t || dt(Q, B), Q._ts < 0 && xB(Q, Q._tTime), Q;
}, Lt = function(Q, B) {
  return (vQ.ScrollTrigger || CA("scrollTrigger", B)) && vQ.ScrollTrigger.create(B, Q);
}, Mt = function(Q, B, A, t, P) {
  if (HA(Q, B, P), !Q._initted)
    return 1;
  if (!A && Q._pt && !Z && (Q._dur && Q.vars.lazy !== !1 || !Q._dur && Q.vars.lazy) && Ut !== eQ.frame)
    return HQ.push(Q), Q._lazy = [P, t], 1;
}, ie = function r(Q) {
  var B = Q.parent;
  return B && B._ts && B._initted && !B._lock && (B.rawTime() < 0 || r(B));
}, cA = function(Q) {
  var B = Q.data;
  return B === "isFromStart" || B === "isStart";
}, re = function(Q, B, A, t) {
  var P = Q.ratio, e = B < 0 || !B && (!Q._start && ie(Q) && !(!Q._initted && cA(Q)) || (Q._ts < 0 || Q._dp._ts < 0) && !cA(Q)) ? 0 : 1, i = Q._rDelay, s = 0, v, c, n;
  if (i && Q._repeat && (s = UB(0, Q._tDur, B), c = QB(s, i), Q._yoyo && c & 1 && (e = 1 - e), c !== QB(Q._tTime, i) && (P = 1 - e, Q.vars.repeatRefresh && Q._initted && Q.invalidate())), e !== P || Z || t || Q._zTime === x || !B && Q._zTime) {
    if (!Q._initted && Mt(Q, B, t, A, s))
      return;
    for (n = Q._zTime, Q._zTime = B || (A ? x : 0), A || (A = B && !n), Q.ratio = e, Q._from && (e = 1 - e), Q._time = 0, Q._tTime = s, v = Q._pt; v; )
      v.r(e, v.d), v = v._next;
    B < 0 && vA(Q, B, A, !0), Q._onUpdate && !A && iQ(Q, "onUpdate"), s && Q._repeat && !A && Q.parent && iQ(Q, "onRepeat"), (B >= Q._tDur || B < 0) && Q.ratio === e && (e && FQ(Q, 1), !A && !Z && (iQ(Q, e ? "onComplete" : "onReverseComplete", !0), Q._prom && Q._prom()));
  } else Q._zTime || (Q._zTime = B);
}, se = function(Q, B, A) {
  var t;
  if (A > B)
    for (t = Q._first; t && t._start <= A; ) {
      if (t.data === "isPause" && t._start > B)
        return t;
      t = t._next;
    }
  else
    for (t = Q._last; t && t._start >= A; ) {
      if (t.data === "isPause" && t._start < B)
        return t;
      t = t._prev;
    }
}, BB = function(Q, B, A, t) {
  var P = Q._repeat, e = y(B) || 0, i = Q._tTime / Q._tDur;
  return i && !t && (Q._time *= e / Q._dur), Q._dur = e, Q._tDur = P ? P < 0 ? 1e10 : y(e * (P + 1) + Q._rDelay * P) : e, i > 0 && !t && xB(Q, Q._tTime = Q._tDur * i), Q.parent && pB(Q), A || YQ(Q.parent, Q), Q;
}, JA = function(Q) {
  return Q instanceof _ ? YQ(Q) : BB(Q, Q._dur);
}, ve = {
  _start: 0,
  endTime: wB,
  totalDuration: wB
}, TQ = function r(Q, B, A) {
  var t = Q.labels, P = Q._recent || ve, e = Q.duration() >= zQ ? P.endTime(!1) : Q._dur, i, s, v;
  return K(B) && (isNaN(B) || B in t) ? (s = B.charAt(0), v = B.substr(-1) === "%", i = B.indexOf("="), s === "<" || s === ">" ? (i >= 0 && (B = B.replace(/=/, "")), (s === "<" ? P._start : P.endTime(P._repeat >= 0)) + (parseFloat(B.substr(1)) || 0) * (v ? (i < 0 ? P : A).totalDuration() / 100 : 1)) : i < 0 ? (B in t || (t[B] = e), t[B]) : (s = parseFloat(B.charAt(i - 1) + B.substr(i + 1)), v && A && (s = s / 100 * (q(A) ? A[0] : A).totalDuration()), i > 1 ? r(Q, B.substr(0, i - 1), A) + s : e + s)) : B == null ? e : +B;
}, nB = function(Q, B, A) {
  var t = uQ(B[1]), P = (t ? 2 : 1) + (Q < 2 ? 0 : 1), e = B[P], i, s;
  if (t && (e.duration = B[1]), e.parent = A, Q) {
    for (i = e, s = A; s && !("immediateRender" in i); )
      i = s.vars.defaults || {}, s = $(s.vars.inherit) && s.parent;
    e.immediateRender = $(i.immediateRender), Q < 2 ? e.runBackwards = 1 : e.startAt = B[P - 1];
  }
  return new J(B[0], e, B[P + 1]);
}, bQ = function(Q, B) {
  return Q || Q === 0 ? B(Q) : B;
}, UB = function(Q, B, A) {
  return A < Q ? Q : A > B ? B : A;
}, W = function(Q, B) {
  return !K(Q) || !(B = _P.exec(Q)) ? "" : B[1];
}, ce = function(Q, B, A) {
  return bQ(A, function(t) {
    return UB(Q, B, t);
  });
}, nA = [].slice, Ht = function(Q, B) {
  return Q && kQ(Q) && "length" in Q && (!B && !Q.length || Q.length - 1 in Q && kQ(Q[0])) && !Q.nodeType && Q !== EQ;
}, ne = function(Q, B, A) {
  return A === void 0 && (A = []), Q.forEach(function(t) {
    var P;
    return K(t) && !B || Ht(t, 1) ? (P = A).push.apply(P, wQ(t)) : A.push(t);
  }) || A;
}, wQ = function(Q, B, A) {
  return m && !B && m.selector ? m.selector(Q) : K(Q) && !A && (rA || !AB()) ? nA.call((B || uA).querySelectorAll(Q), 0) : q(Q) ? ne(Q, A) : Ht(Q) ? nA.call(Q, 0) : Q ? [Q] : [];
}, oA = function(Q) {
  return Q = wQ(Q)[0] || zB("Invalid scope") || {}, function(B) {
    var A = Q.current || Q.nativeElement || Q;
    return wQ(B, A.querySelectorAll ? A : A === Q ? zB("Invalid scope") || uA.createElement("div") : Q);
  };
}, jt = function(Q) {
  return Q.sort(function() {
    return 0.5 - Math.random();
  });
}, Ft = function(Q) {
  if (Y(Q))
    return Q;
  var B = kQ(Q) ? Q : {
    each: Q
  }, A = VQ(B.ease), t = B.from || 0, P = parseFloat(B.base) || 0, e = {}, i = t > 0 && t < 1, s = isNaN(t) || i, v = B.axis, c = t, n = t;
  return K(t) ? c = n = {
    center: 0.5,
    edges: 0.5,
    end: 1
  }[t] || 0 : !i && s && (c = t[0], n = t[1]), function(T, z, w) {
    var o = (w || B).length, E = e[o], k, a, U, D, l, O, u, N, C;
    if (!E) {
      if (C = B.grid === "auto" ? 0 : (B.grid || [1, zQ])[1], !C) {
        for (u = -zQ; u < (u = w[C++].getBoundingClientRect().left) && C < o; )
          ;
        C < o && C--;
      }
      for (E = e[o] = [], k = s ? Math.min(C, o) * c - 0.5 : t % C, a = C === zQ ? 0 : s ? o * n / C - 0.5 : t / C | 0, u = 0, N = zQ, O = 0; O < o; O++)
        U = O % C - k, D = a - (O / C | 0), E[O] = l = v ? Math.abs(v === "y" ? D : U) : zt(U * U + D * D), l > u && (u = l), l < N && (N = l);
      t === "random" && jt(E), E.max = u - N, E.min = N, E.v = o = (parseFloat(B.amount) || parseFloat(B.each) * (C > o ? o - 1 : v ? v === "y" ? o / C : C : Math.max(C, o / C)) || 0) * (t === "edges" ? -1 : 1), E.b = o < 0 ? P - o : P, E.u = W(B.amount || B.each) || 0, A = A && o < 0 ? Ce(A) : A;
    }
    return o = (E[T] - E.min) / E.max || 0, y(E.b + (A ? A(o) : o) * E.v) + E.u;
  };
}, TA = function(Q) {
  var B = Math.pow(10, ((Q + "").split(".")[1] || "").length);
  return function(A) {
    var t = y(Math.round(parseFloat(A) / Q) * Q * B);
    return (t - t % 1) / B + (uQ(A) ? 0 : W(A));
  };
}, Gt = function(Q, B) {
  var A = q(Q), t, P;
  return !A && kQ(Q) && (t = A = Q.radius || zQ, Q.values ? (Q = wQ(Q.values), (P = !uQ(Q[0])) && (t *= t)) : Q = TA(Q.increment)), bQ(B, A ? Y(Q) ? function(e) {
    return P = Q(e), Math.abs(P - e) <= t ? P : e;
  } : function(e) {
    for (var i = parseFloat(P ? e.x : e), s = parseFloat(P ? e.y : 0), v = zQ, c = 0, n = Q.length, T, z; n--; )
      P ? (T = Q[n].x - i, z = Q[n].y - s, T = T * T + z * z) : T = Math.abs(Q[n] - i), T < v && (v = T, c = n);
    return c = !t || v <= t ? Q[c] : e, P || c === e || uQ(e) ? c : c + W(e);
  } : TA(Q));
}, ft = function(Q, B, A, t) {
  return bQ(q(Q) ? !B : A === !0 ? !!(A = 0) : !t, function() {
    return q(Q) ? Q[~~(Math.random() * Q.length)] : (A = A || 1e-5) && (t = A < 1 ? Math.pow(10, (A + "").length - 2) : 1) && Math.floor(Math.round((Q - A / 2 + Math.random() * (B - Q + A * 0.99)) / A) * A * t) / t;
  });
}, oe = function() {
  for (var Q = arguments.length, B = new Array(Q), A = 0; A < Q; A++)
    B[A] = arguments[A];
  return function(t) {
    return B.reduce(function(P, e) {
      return e(P);
    }, t);
  };
}, Te = function(Q, B) {
  return function(A) {
    return Q(parseFloat(A)) + (B || W(A));
  };
}, ze = function(Q, B, A) {
  return gt(Q, B, 0, 1, A);
}, bt = function(Q, B, A) {
  return bQ(A, function(t) {
    return Q[~~B(t)];
  });
}, we = function r(Q, B, A) {
  var t = B - Q;
  return q(Q) ? bt(Q, r(0, Q.length), B) : bQ(A, function(P) {
    return (t + (P - Q) % t) % t + Q;
  });
}, Ee = function r(Q, B, A) {
  var t = B - Q, P = t * 2;
  return q(Q) ? bt(Q, r(0, Q.length - 1), B) : bQ(A, function(e) {
    return e = (P + (e - Q) % P) % P || 0, Q + (e > t ? P - e : e);
  });
}, EB = function(Q) {
  return Q.replace(ZP, function(B) {
    var A = B.indexOf("[") + 1, t = B.substring(A || 7, A ? B.indexOf("]") : B.length - 1).split(WP);
    return ft(A ? t : +t[0], A ? 0 : +t[1], +t[2] || 1e-5);
  });
}, gt = function(Q, B, A, t, P) {
  var e = B - Q, i = t - A;
  return bQ(P, function(s) {
    return A + ((s - Q) / e * i || 0);
  });
}, ae = function r(Q, B, A, t) {
  var P = isNaN(Q + B) ? 0 : function(z) {
    return (1 - z) * Q + z * B;
  };
  if (!P) {
    var e = K(Q), i = {}, s, v, c, n, T;
    if (A === !0 && (t = 1) && (A = null), e)
      Q = {
        p: Q
      }, B = {
        p: B
      };
    else if (q(Q) && !q(B)) {
      for (c = [], n = Q.length, T = n - 2, v = 1; v < n; v++)
        c.push(r(Q[v - 1], Q[v]));
      n--, P = function(w) {
        w *= n;
        var o = Math.min(T, ~~w);
        return c[o](w - o);
      }, A = B;
    } else t || (Q = $Q(q(Q) ? [] : {}, Q));
    if (!c) {
      for (s in B)
        MA.call(i, Q, s, "get", B[s]);
      P = function(w) {
        return GA(w, i) || (e ? Q.p : Q);
      };
    }
  }
  return bQ(A, P);
}, RA = function(Q, B, A) {
  var t = Q.labels, P = zQ, e, i, s;
  for (e in t)
    i = t[e] - B, i < 0 == !!A && i && P > (i = Math.abs(i)) && (s = e, P = i);
  return s;
}, iQ = function(Q, B, A) {
  var t = Q.vars, P = t[B], e = m, i = Q._ctx, s, v, c;
  if (P)
    return s = t[B + "Params"], v = t.callbackScope || Q, A && HQ.length && HB(), i && (m = i), c = s ? P.apply(v, s) : P.call(v), m = e, c;
}, sB = function(Q) {
  return FQ(Q), Q.scrollTrigger && Q.scrollTrigger.kill(!!Z), Q.progress() < 1 && iQ(Q, "onInterrupt"), Q;
}, ZQ, pt = [], xt = function(Q) {
  if (Q)
    if (Q = !Q.name && Q.default || Q, DA() || Q.headless) {
      var B = Q.name, A = Y(Q), t = B && !A && Q.init ? function() {
        this._props = [];
      } : Q, P = {
        init: wB,
        render: GA,
        add: MA,
        kill: fe,
        modifier: Ge,
        rawVars: 0
      }, e = {
        targetTest: 0,
        get: 0,
        getSetter: FA,
        aliases: {},
        register: 0
      };
      if (AB(), Q !== t) {
        if (PQ[B])
          return;
        cQ(t, cQ(jB(Q, P), e)), $Q(t.prototype, $Q(P, jB(Q, e))), PQ[t.prop = B] = t, Q.targetTest && (OB.push(t), NA[B] = 1), B = (B === "css" ? "CSS" : B.charAt(0).toUpperCase() + B.substr(1)) + "Plugin";
      }
      lt(B, t), Q.register && Q.register(tQ, t, BQ);
    } else
      pt.push(Q);
}, p = 255, vB = {
  aqua: [0, p, p],
  lime: [0, p, 0],
  silver: [192, 192, 192],
  black: [0, 0, 0],
  maroon: [128, 0, 0],
  teal: [0, 128, 128],
  blue: [0, 0, p],
  navy: [0, 0, 128],
  white: [p, p, p],
  olive: [128, 128, 0],
  yellow: [p, p, 0],
  orange: [p, 165, 0],
  gray: [128, 128, 128],
  purple: [128, 0, 128],
  green: [0, 128, 0],
  red: [p, 0, 0],
  pink: [p, 192, 203],
  cyan: [0, p, p],
  transparent: [p, p, p, 0]
}, VB = function(Q, B, A) {
  return Q += Q < 0 ? 1 : Q > 1 ? -1 : 0, (Q * 6 < 1 ? B + (A - B) * Q * 6 : Q < 0.5 ? A : Q * 3 < 2 ? B + (A - B) * (2 / 3 - Q) * 6 : B) * p + 0.5 | 0;
}, mt = function(Q, B, A) {
  var t = Q ? uQ(Q) ? [Q >> 16, Q >> 8 & p, Q & p] : 0 : vB.black, P, e, i, s, v, c, n, T, z, w;
  if (!t) {
    if (Q.substr(-1) === "," && (Q = Q.substr(0, Q.length - 1)), vB[Q])
      t = vB[Q];
    else if (Q.charAt(0) === "#") {
      if (Q.length < 6 && (P = Q.charAt(1), e = Q.charAt(2), i = Q.charAt(3), Q = "#" + P + P + e + e + i + i + (Q.length === 5 ? Q.charAt(4) + Q.charAt(4) : "")), Q.length === 9)
        return t = parseInt(Q.substr(1, 6), 16), [t >> 16, t >> 8 & p, t & p, parseInt(Q.substr(7), 16) / 255];
      Q = parseInt(Q.substr(1), 16), t = [Q >> 16, Q >> 8 & p, Q & p];
    } else if (Q.substr(0, 3) === "hsl") {
      if (t = w = Q.match(IA), !B)
        s = +t[0] % 360 / 360, v = +t[1] / 100, c = +t[2] / 100, e = c <= 0.5 ? c * (v + 1) : c + v - c * v, P = c * 2 - e, t.length > 3 && (t[3] *= 1), t[0] = VB(s + 1 / 3, P, e), t[1] = VB(s, P, e), t[2] = VB(s - 1 / 3, P, e);
      else if (~Q.indexOf("="))
        return t = Q.match(Et), A && t.length < 4 && (t[3] = 1), t;
    } else
      t = Q.match(IA) || vB.transparent;
    t = t.map(Number);
  }
  return B && !w && (P = t[0] / p, e = t[1] / p, i = t[2] / p, n = Math.max(P, e, i), T = Math.min(P, e, i), c = (n + T) / 2, n === T ? s = v = 0 : (z = n - T, v = c > 0.5 ? z / (2 - n - T) : z / (n + T), s = n === P ? (e - i) / z + (e < i ? 6 : 0) : n === e ? (i - P) / z + 2 : (P - e) / z + 4, s *= 60), t[0] = ~~(s + 0.5), t[1] = ~~(v * 100 + 0.5), t[2] = ~~(c * 100 + 0.5)), A && t.length < 4 && (t[3] = 1), t;
}, yt = function(Q) {
  var B = [], A = [], t = -1;
  return Q.split(jQ).forEach(function(P) {
    var e = P.match(KQ) || [];
    B.push.apply(B, e), A.push(t += e.length + 1);
  }), B.c = A, B;
}, XA = function(Q, B, A) {
  var t = "", P = (Q + t).match(jQ), e = B ? "hsla(" : "rgba(", i = 0, s, v, c, n;
  if (!P)
    return Q;
  if (P = P.map(function(T) {
    return (T = mt(T, B, 1)) && e + (B ? T[0] + "," + T[1] + "%," + T[2] + "%," + T[3] : T.join(",")) + ")";
  }), A && (c = yt(Q), s = A.c, s.join(t) !== c.c.join(t)))
    for (v = Q.replace(jQ, "1").split(KQ), n = v.length - 1; i < n; i++)
      t += v[i] + (~s.indexOf(i) ? P.shift() || e + "0,0,0,0)" : (c.length ? c : P.length ? P : A).shift());
  if (!v)
    for (v = Q.split(jQ), n = v.length - 1; i < n; i++)
      t += v[i] + P[i];
  return t + v[n];
}, jQ = function() {
  var r = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#(?:[0-9a-f]{3,4}){1,2}\\b", Q;
  for (Q in vB)
    r += "|" + Q + "\\b";
  return new RegExp(r + ")", "gi");
}(), he = /hsl[a]?\(/, It = function(Q) {
  var B = Q.join(" "), A;
  if (jQ.lastIndex = 0, jQ.test(B))
    return A = he.test(B), Q[1] = XA(Q[1], A), Q[0] = XA(Q[0], A, yt(Q[1])), !0;
}, aB, eQ = function() {
  var r = Date.now, Q = 500, B = 33, A = r(), t = A, P = 1e3 / 240, e = P, i = [], s, v, c, n, T, z, w = function o(E) {
    var k = r() - t, a = E === !0, U, D, l, O;
    if ((k > Q || k < 0) && (A += k - B), t += k, l = t - A, U = l - e, (U > 0 || a) && (O = ++n.frame, T = l - n.time * 1e3, n.time = l = l / 1e3, e += U + (U >= P ? 4 : P - U), D = 1), a || (s = v(o)), D)
      for (z = 0; z < i.length; z++)
        i[z](l, T, O, E);
  };
  return n = {
    time: 0,
    frame: 0,
    tick: function() {
      w(!0);
    },
    deltaRatio: function(E) {
      return T / (1e3 / (E || 60));
    },
    wake: function() {
      ht && (!rA && DA() && (EQ = rA = window, uA = EQ.document || {}, vQ.gsap = tQ, (EQ.gsapVersions || (EQ.gsapVersions = [])).push(tQ.version), kt(MB || EQ.GreenSockGlobals || !EQ.gsap && EQ || {}), pt.forEach(xt)), c = typeof requestAnimationFrame < "u" && requestAnimationFrame, s && n.sleep(), v = c || function(E) {
        return setTimeout(E, e - n.time * 1e3 + 1 | 0);
      }, aB = 1, w(2));
    },
    sleep: function() {
      (c ? cancelAnimationFrame : clearTimeout)(s), aB = 0, v = wB;
    },
    lagSmoothing: function(E, k) {
      Q = E || 1 / 0, B = Math.min(k || 33, Q);
    },
    fps: function(E) {
      P = 1e3 / (E || 240), e = n.time * 1e3 + P;
    },
    add: function(E, k, a) {
      var U = k ? function(D, l, O, u) {
        E(D, l, O, u), n.remove(U);
      } : E;
      return n.remove(E), i[a ? "unshift" : "push"](U), AB(), U;
    },
    remove: function(E, k) {
      ~(k = i.indexOf(E)) && i.splice(k, 1) && z >= k && z--;
    },
    _listeners: i
  }, n;
}(), AB = function() {
  return !aB && eQ.wake();
}, g = {}, ke = /^[\d.\-M][\d.\-,\s]/, le = /["']/g, Ue = function(Q) {
  for (var B = {}, A = Q.substr(1, Q.length - 3).split(":"), t = A[0], P = 1, e = A.length, i, s, v; P < e; P++)
    s = A[P], i = P !== e - 1 ? s.lastIndexOf(",") : s.length, v = s.substr(0, i), B[t] = isNaN(v) ? v.replace(le, "").trim() : +v, t = s.substr(i + 1).trim();
  return B;
}, De = function(Q) {
  var B = Q.indexOf("(") + 1, A = Q.indexOf(")"), t = Q.indexOf("(", B);
  return Q.substring(B, ~t && t < A ? Q.indexOf(")", A + 1) : A);
}, ue = function(Q) {
  var B = (Q + "").split("("), A = g[B[0]];
  return A && B.length > 1 && A.config ? A.config.apply(null, ~Q.indexOf("{") ? [Ue(B[1])] : De(Q).split(",").map(Ct)) : g._CE && ke.test(Q) ? g._CE("", Q) : A;
}, Ce = function(Q) {
  return function(B) {
    return 1 - Q(1 - B);
  };
}, VQ = function(Q, B) {
  return Q && (Y(Q) ? Q : g[Q] || ue(Q)) || B;
}, RQ = function(Q, B, A, t) {
  A === void 0 && (A = function(s) {
    return 1 - B(1 - s);
  }), t === void 0 && (t = function(s) {
    return s < 0.5 ? B(s * 2) / 2 : 1 - B((1 - s) * 2) / 2;
  });
  var P = {
    easeIn: B,
    easeOut: A,
    easeInOut: t
  }, e;
  return QQ(Q, function(i) {
    g[i] = vQ[i] = P, g[e = i.toLowerCase()] = A;
    for (var s in P)
      g[e + (s === "easeIn" ? ".in" : s === "easeOut" ? ".out" : ".inOut")] = g[i + "." + s] = P[s];
  }), P;
}, St = function(Q) {
  return function(B) {
    return B < 0.5 ? (1 - Q(1 - B * 2)) / 2 : 0.5 + Q((B - 0.5) * 2) / 2;
  };
}, JB = function r(Q, B, A) {
  var t = B >= 1 ? B : 1, P = (A || (Q ? 0.3 : 0.45)) / (B < 1 ? B : 1), e = P / iA * (Math.asin(1 / t) || 0), i = function(c) {
    return c === 1 ? 1 : t * Math.pow(2, -10 * c) * KP((c - e) * P) + 1;
  }, s = Q === "out" ? i : Q === "in" ? function(v) {
    return 1 - i(1 - v);
  } : St(i);
  return P = iA / P, s.config = function(v, c) {
    return r(Q, v, c);
  }, s;
}, RB = function r(Q, B) {
  B === void 0 && (B = 1.70158);
  var A = function(e) {
    return e ? --e * e * ((B + 1) * e + B) + 1 : 0;
  }, t = Q === "out" ? A : Q === "in" ? function(P) {
    return 1 - A(1 - P);
  } : St(A);
  return t.config = function(P) {
    return r(Q, P);
  }, t;
};
QQ("Linear,Quad,Cubic,Quart,Quint,Strong", function(r, Q) {
  var B = Q < 5 ? Q + 1 : Q;
  RQ(r + ",Power" + (B - 1), Q ? function(A) {
    return Math.pow(A, B);
  } : function(A) {
    return A;
  }, function(A) {
    return 1 - Math.pow(1 - A, B);
  }, function(A) {
    return A < 0.5 ? Math.pow(A * 2, B) / 2 : 1 - Math.pow((1 - A) * 2, B) / 2;
  });
});
g.Linear.easeNone = g.none = g.Linear.easeIn;
RQ("Elastic", JB("in"), JB("out"), JB());
(function(r, Q) {
  var B = 1 / Q, A = 2 * B, t = 2.5 * B, P = function(i) {
    return i < B ? r * i * i : i < A ? r * Math.pow(i - 1.5 / Q, 2) + 0.75 : i < t ? r * (i -= 2.25 / Q) * i + 0.9375 : r * Math.pow(i - 2.625 / Q, 2) + 0.984375;
  };
  RQ("Bounce", function(e) {
    return 1 - P(1 - e);
  }, P);
})(7.5625, 2.75);
RQ("Expo", function(r) {
  return Math.pow(2, 10 * (r - 1)) * r + r * r * r * r * r * r * (1 - r);
});
RQ("Circ", function(r) {
  return -(zt(1 - r * r) - 1);
});
RQ("Sine", function(r) {
  return r === 1 ? 1 : -XP(r * JP) + 1;
});
RQ("Back", RB("in"), RB("out"), RB());
g.SteppedEase = g.steps = vQ.SteppedEase = {
  config: function(Q, B) {
    Q === void 0 && (Q = 1);
    var A = 1 / Q, t = Q + (B ? 0 : 1), P = B ? 1 : 0, e = 1 - x;
    return function(i) {
      return ((t * UB(0, e, i) | 0) + P) * A;
    };
  }
};
TB.ease = g["quad.out"];
QQ("onComplete,onUpdate,onStart,onRepeat,onReverseComplete,onInterrupt", function(r) {
  return OA += r + "," + r + "Params,";
});
var Yt = function(Q, B) {
  this.id = RP++, Q._gsap = this, this.target = Q, this.harness = B, this.get = B ? B.get : Dt, this.set = B ? B.getSetter : FA;
}, hB = /* @__PURE__ */ function() {
  function r(B) {
    this.vars = B, this._delay = +B.delay || 0, (this._repeat = B.repeat === 1 / 0 ? -2 : B.repeat || 0) && (this._rDelay = B.repeatDelay || 0, this._yoyo = !!B.yoyo || !!B.yoyoEase), this._ts = 1, BB(this, +B.duration, 1, 1), this.data = B.data, m && (this._ctx = m, m.data.push(this)), aB || eQ.wake();
  }
  var Q = r.prototype;
  return Q.delay = function(A) {
    return A || A === 0 ? (this.parent && this.parent.smoothChildTiming && this.startTime(this._start + A - this._delay), this._delay = A, this) : this._delay;
  }, Q.duration = function(A) {
    return arguments.length ? this.totalDuration(this._repeat > 0 ? A + (A + this._rDelay) * this._repeat : A) : this.totalDuration() && this._dur;
  }, Q.totalDuration = function(A) {
    return arguments.length ? (this._dirty = 0, BB(this, this._repeat < 0 ? A : (A - this._repeat * this._rDelay) / (this._repeat + 1))) : this._tDur;
  }, Q.totalTime = function(A, t) {
    if (AB(), !arguments.length)
      return this._tTime;
    var P = this._dp;
    if (P && P.smoothChildTiming && this._ts) {
      for (xB(this, A), !P._dp || P.parent || dt(P, this); P && P.parent; )
        P.parent._time !== P._start + (P._ts >= 0 ? P._tTime / P._ts : (P.totalDuration() - P._tTime) / -P._ts) && P.totalTime(P._tTime, !0), P = P.parent;
      !this.parent && this._dp.autoRemoveChildren && (this._ts > 0 && A < this._tDur || this._ts < 0 && A > 0 || !this._tDur && !A) && aQ(this._dp, this, this._start - this._delay);
    }
    return (this._tTime !== A || !this._dur && !t || this._initted && Math.abs(this._zTime) === x || !this._initted && this._dur && A || !A && !this._initted && (this.add || this._ptLookup)) && (this._ts || (this._pTime = A), ut(this, A, t)), this;
  }, Q.time = function(A, t) {
    return arguments.length ? this.totalTime(Math.min(this.totalDuration(), A + VA(this)) % (this._dur + this._rDelay) || (A ? this._dur : 0), t) : this._time;
  }, Q.totalProgress = function(A, t) {
    return arguments.length ? this.totalTime(this.totalDuration() * A, t) : this.totalDuration() ? Math.min(1, this._tTime / this._tDur) : this.rawTime() >= 0 && this._initted ? 1 : 0;
  }, Q.progress = function(A, t) {
    return arguments.length ? this.totalTime(this.duration() * (this._yoyo && !(this.iteration() & 1) ? 1 - A : A) + VA(this), t) : this.duration() ? Math.min(1, this._time / this._dur) : this.rawTime() > 0 ? 1 : 0;
  }, Q.iteration = function(A, t) {
    var P = this.duration() + this._rDelay;
    return arguments.length ? this.totalTime(this._time + (A - 1) * P, t) : this._repeat ? QB(this._tTime, P) + 1 : 1;
  }, Q.timeScale = function(A, t) {
    if (!arguments.length)
      return this._rts === -x ? 0 : this._rts;
    if (this._rts === A)
      return this;
    var P = this.parent && this._ts ? FB(this.parent._time, this) : this._tTime;
    return this._rts = +A || 0, this._ts = this._ps || A === -x ? 0 : this._rts, this.totalTime(UB(-Math.abs(this._delay), this.totalDuration(), P), t !== !1), pB(this), Pe(this);
  }, Q.paused = function(A) {
    return arguments.length ? (this._ps !== A && (this._ps = A, A ? (this._pTime = this._tTime || Math.max(-this._delay, this.rawTime()), this._ts = this._act = 0) : (AB(), this._ts = this._rts, this.totalTime(this.parent && !this.parent.smoothChildTiming ? this.rawTime() : this._tTime || this._pTime, this.progress() === 1 && Math.abs(this._zTime) !== x && (this._tTime -= x)))), this) : this._ps;
  }, Q.startTime = function(A) {
    if (arguments.length) {
      this._start = y(A);
      var t = this.parent || this._dp;
      return t && (t._sort || !this.parent) && aQ(t, this, this._start - this._delay), this;
    }
    return this._start;
  }, Q.endTime = function(A) {
    return this._start + ($(A) ? this.totalDuration() : this.duration()) / Math.abs(this._ts || 1);
  }, Q.rawTime = function(A) {
    var t = this.parent || this._dp;
    return t ? A && (!this._ts || this._repeat && this._time && this.totalProgress() < 1) ? this._tTime % (this._dur + this._rDelay) : this._ts ? FB(t.rawTime(A), this) : this._tTime : this._tTime;
  }, Q.revert = function(A) {
    A === void 0 && (A = Qe);
    var t = Z;
    return Z = A, LA(this) && (this.timeline && this.timeline.revert(A), this.totalTime(-0.01, A.suppressEvents)), this.data !== "nested" && A.kill !== !1 && this.kill(), Z = t, this;
  }, Q.globalTime = function(A) {
    for (var t = this, P = arguments.length ? A : t.rawTime(); t; )
      P = t._start + P / (Math.abs(t._ts) || 1), t = t._dp;
    return !this.parent && this._sat ? this._sat.globalTime(A) : P;
  }, Q.repeat = function(A) {
    return arguments.length ? (this._repeat = A === 1 / 0 ? -2 : A, JA(this)) : this._repeat === -2 ? 1 / 0 : this._repeat;
  }, Q.repeatDelay = function(A) {
    if (arguments.length) {
      var t = this._time;
      return this._rDelay = A, JA(this), t ? this.time(t) : this;
    }
    return this._rDelay;
  }, Q.yoyo = function(A) {
    return arguments.length ? (this._yoyo = A, this) : this._yoyo;
  }, Q.seek = function(A, t) {
    return this.totalTime(TQ(this, A), $(t));
  }, Q.restart = function(A, t) {
    return this.play().totalTime(A ? -this._delay : 0, $(t)), this._dur || (this._zTime = -x), this;
  }, Q.play = function(A, t) {
    return A != null && this.seek(A, t), this.reversed(!1).paused(!1);
  }, Q.reverse = function(A, t) {
    return A != null && this.seek(A || this.totalDuration(), t), this.reversed(!0).paused(!1);
  }, Q.pause = function(A, t) {
    return A != null && this.seek(A, t), this.paused(!0);
  }, Q.resume = function() {
    return this.paused(!1);
  }, Q.reversed = function(A) {
    return arguments.length ? (!!A !== this.reversed() && this.timeScale(-this._rts || (A ? -x : 0)), this) : this._rts < 0;
  }, Q.invalidate = function() {
    return this._initted = this._act = 0, this._zTime = -x, this;
  }, Q.isActive = function() {
    var A = this.parent || this._dp, t = this._start, P;
    return !!(!A || this._ts && this._initted && A.isActive() && (P = A.rawTime(!0)) >= t && P < this.endTime(!0) - x);
  }, Q.eventCallback = function(A, t, P) {
    var e = this.vars;
    return arguments.length > 1 ? (t ? (e[A] = t, P && (e[A + "Params"] = P), A === "onUpdate" && (this._onUpdate = t)) : delete e[A], this) : e[A];
  }, Q.then = function(A) {
    var t = this, P = t._prom;
    return new Promise(function(e) {
      var i = Y(A) ? A : Nt, s = function() {
        var c = t.then;
        t.then = null, P && P(), Y(i) && (i = i(t)) && (i.then || i === t) && (t.then = c), e(i), t.then = c;
      };
      t._initted && t.totalProgress() === 1 && t._ts >= 0 || !t._tTime && t._ts < 0 ? s() : t._prom = s;
    });
  }, Q.kill = function() {
    sB(this);
  }, r;
}();
cQ(hB.prototype, {
  _time: 0,
  _start: 0,
  _end: 0,
  _tTime: 0,
  _tDur: 0,
  _dirty: 0,
  _repeat: 0,
  _yoyo: !1,
  parent: null,
  _initted: !1,
  _rDelay: 0,
  _ts: 1,
  _dp: 0,
  ratio: 0,
  _zTime: -x,
  _prom: 0,
  _ps: !1,
  _rts: 1
});
var _ = /* @__PURE__ */ function(r) {
  Tt(Q, r);
  function Q(A, t) {
    var P;
    return A === void 0 && (A = {}), P = r.call(this, A) || this, P.labels = {}, P.smoothChildTiming = !!A.smoothChildTiming, P.autoRemoveChildren = !!A.autoRemoveChildren, P._sort = $(A.sortChildren), I && aQ(A.parent || I, UQ(P), t), A.reversed && P.reverse(), A.paused && P.paused(!0), A.scrollTrigger && Lt(UQ(P), A.scrollTrigger), P;
  }
  var B = Q.prototype;
  return B.to = function(t, P, e) {
    return nB(0, arguments, this), this;
  }, B.from = function(t, P, e) {
    return nB(1, arguments, this), this;
  }, B.fromTo = function(t, P, e, i) {
    return nB(2, arguments, this), this;
  }, B.set = function(t, P, e) {
    return P.duration = 0, P.parent = this, cB(P).repeatDelay || (P.repeat = 0), P.immediateRender = !!P.immediateRender, new J(t, P, TQ(this, e), 1), this;
  }, B.call = function(t, P, e) {
    return aQ(this, J.delayedCall(0, t, P), e);
  }, B.staggerTo = function(t, P, e, i, s, v, c) {
    return e.duration = P, e.stagger = e.stagger || i, e.onComplete = v, e.onCompleteParams = c, e.parent = this, new J(t, e, TQ(this, s)), this;
  }, B.staggerFrom = function(t, P, e, i, s, v, c) {
    return e.runBackwards = 1, cB(e).immediateRender = $(e.immediateRender), this.staggerTo(t, P, e, i, s, v, c);
  }, B.staggerFromTo = function(t, P, e, i, s, v, c, n) {
    return i.startAt = e, cB(i).immediateRender = $(i.immediateRender), this.staggerTo(t, P, i, s, v, c, n);
  }, B.render = function(t, P, e) {
    var i = this._time, s = this._dirty ? this.totalDuration() : this._tDur, v = this._dur, c = t <= 0 ? 0 : y(t), n = this._zTime < 0 != t < 0 && (this._initted || !v), T, z, w, o, E, k, a, U, D, l, O, u;
    if (this !== I && c > s && t >= 0 && (c = s), c !== this._tTime || e || n) {
      if (i !== this._time && v && (c += this._time - i, t += this._time - i), T = c, D = this._start, U = this._ts, k = !U, n && (v || (i = this._zTime), (t || !P) && (this._zTime = t)), this._repeat) {
        if (O = this._yoyo, E = v + this._rDelay, this._repeat < -1 && t < 0)
          return this.totalTime(E * 100 + t, P, e);
        if (T = y(c % E), c === s ? (o = this._repeat, T = v) : (l = y(c / E), o = ~~l, o && o === l && (T = v, o--), T > v && (T = v)), l = QB(this._tTime, E), !i && this._tTime && l !== o && this._tTime - l * E - this._dur <= 0 && (l = o), O && o & 1 && (T = v - T, u = 1), o !== l && !this._lock) {
          var N = O && l & 1, C = N === (O && o & 1);
          if (o < l && (N = !N), i = N ? 0 : c % v ? v : c, this._lock = 1, this.render(i || (u ? 0 : y(o * E)), P, !v)._lock = 0, this._tTime = c, !P && this.parent && iQ(this, "onRepeat"), this.vars.repeatRefresh && !u && (this.invalidate()._lock = 1, l = o), i && i !== this._time || k !== !this._ts || this.vars.onRepeat && !this.parent && !this._act)
            return this;
          if (v = this._dur, s = this._tDur, C && (this._lock = 2, i = N ? v : -1e-4, this.render(i, !0), this.vars.repeatRefresh && !u && this.invalidate()), this._lock = 0, !this._ts && !k)
            return this;
        }
      }
      if (this._hasPause && !this._forcing && this._lock < 2 && (a = se(this, y(i), y(T)), a && (c -= T - (T = a._start))), this._tTime = c, this._time = T, this._act = !!U, this._initted || (this._onUpdate = this.vars.onUpdate, this._initted = 1, this._zTime = t, i = 0), !i && c && v && !P && !l && (iQ(this, "onStart"), this._tTime !== c))
        return this;
      if (T >= i && t >= 0)
        for (z = this._first; z; ) {
          if (w = z._next, (z._act || T >= z._start) && z._ts && a !== z) {
            if (z.parent !== this)
              return this.render(t, P, e);
            if (z.render(z._ts > 0 ? (T - z._start) * z._ts : (z._dirty ? z.totalDuration() : z._tDur) + (T - z._start) * z._ts, P, e), T !== this._time || !this._ts && !k) {
              a = 0, w && (c += this._zTime = -x);
              break;
            }
          }
          z = w;
        }
      else {
        z = this._last;
        for (var M = t < 0 ? t : T; z; ) {
          if (w = z._prev, (z._act || M <= z._end) && z._ts && a !== z) {
            if (z.parent !== this)
              return this.render(t, P, e);
            if (z.render(z._ts > 0 ? (M - z._start) * z._ts : (z._dirty ? z.totalDuration() : z._tDur) + (M - z._start) * z._ts, P, e || Z && LA(z)), T !== this._time || !this._ts && !k) {
              a = 0, w && (c += this._zTime = M ? -x : x);
              break;
            }
          }
          z = w;
        }
      }
      if (a && !P && (this.pause(), a.render(T >= i ? 0 : -x)._zTime = T >= i ? 1 : -1, this._ts))
        return this._start = D, pB(this), this.render(t, P, e);
      this._onUpdate && !P && iQ(this, "onUpdate", !0), (c === s && this._tTime >= this.totalDuration() || !c && i) && (D === this._start || Math.abs(U) !== Math.abs(this._ts)) && (this._lock || ((t || !v) && (c === s && this._ts > 0 || !c && this._ts < 0) && FQ(this, 1), !P && !(t < 0 && !i) && (c || i || !s) && (iQ(this, c === s && t >= 0 ? "onComplete" : "onReverseComplete", !0), this._prom && !(c < s && this.timeScale() > 0) && this._prom())));
    }
    return this;
  }, B.add = function(t, P) {
    var e = this;
    if (uQ(P) || (P = TQ(this, P, t)), !(t instanceof hB)) {
      if (q(t))
        return t.forEach(function(i) {
          return e.add(i, P);
        }), this;
      if (K(t))
        return this.addLabel(t, P);
      if (Y(t))
        t = J.delayedCall(0, t);
      else
        return this;
    }
    return this !== t ? aQ(this, t, P) : this;
  }, B.getChildren = function(t, P, e, i) {
    t === void 0 && (t = !0), P === void 0 && (P = !0), e === void 0 && (e = !0), i === void 0 && (i = -zQ);
    for (var s = [], v = this._first; v; )
      v._start >= i && (v instanceof J ? P && s.push(v) : (e && s.push(v), t && s.push.apply(s, v.getChildren(!0, P, e)))), v = v._next;
    return s;
  }, B.getById = function(t) {
    for (var P = this.getChildren(1, 1, 1), e = P.length; e--; )
      if (P[e].vars.id === t)
        return P[e];
  }, B.remove = function(t) {
    return K(t) ? this.removeLabel(t) : Y(t) ? this.killTweensOf(t) : (t.parent === this && gB(this, t), t === this._recent && (this._recent = this._last), YQ(this));
  }, B.totalTime = function(t, P) {
    return arguments.length ? (this._forcing = 1, !this._dp && this._ts && (this._start = y(eQ.time - (this._ts > 0 ? t / this._ts : (this.totalDuration() - t) / -this._ts))), r.prototype.totalTime.call(this, t, P), this._forcing = 0, this) : this._tTime;
  }, B.addLabel = function(t, P) {
    return this.labels[t] = TQ(this, P), this;
  }, B.removeLabel = function(t) {
    return delete this.labels[t], this;
  }, B.addPause = function(t, P, e) {
    var i = J.delayedCall(0, P || wB, e);
    return i.data = "isPause", this._hasPause = 1, aQ(this, i, TQ(this, t));
  }, B.removePause = function(t) {
    var P = this._first;
    for (t = TQ(this, t); P; )
      P._start === t && P.data === "isPause" && FQ(P), P = P._next;
  }, B.killTweensOf = function(t, P, e) {
    for (var i = this.getTweensOf(t, e), s = i.length; s--; )
      dQ !== i[s] && i[s].kill(t, P);
    return this;
  }, B.getTweensOf = function(t, P) {
    for (var e = [], i = wQ(t), s = this._first, v = uQ(P), c; s; )
      s instanceof J ? Be(s._targets, i) && (v ? (!dQ || s._initted && s._ts) && s.globalTime(0) <= P && s.globalTime(s.totalDuration()) > P : !P || s.isActive()) && e.push(s) : (c = s.getTweensOf(i, P)).length && e.push.apply(e, c), s = s._next;
    return e;
  }, B.tweenTo = function(t, P) {
    P = P || {};
    var e = this, i = TQ(e, t), s = P, v = s.startAt, c = s.onStart, n = s.onStartParams, T = s.immediateRender, z, w = J.to(e, cQ({
      ease: P.ease || "none",
      lazy: !1,
      immediateRender: !1,
      time: i,
      overwrite: "auto",
      duration: P.duration || Math.abs((i - (v && "time" in v ? v.time : e._time)) / e.timeScale()) || x,
      onStart: function() {
        if (e.pause(), !z) {
          var E = P.duration || Math.abs((i - (v && "time" in v ? v.time : e._time)) / e.timeScale());
          w._dur !== E && BB(w, E, 0, 1).render(w._time, !0, !0), z = 1;
        }
        c && c.apply(w, n || []);
      }
    }, P));
    return T ? w.render(0) : w;
  }, B.tweenFromTo = function(t, P, e) {
    return this.tweenTo(P, cQ({
      startAt: {
        time: TQ(this, t)
      }
    }, e));
  }, B.recent = function() {
    return this._recent;
  }, B.nextLabel = function(t) {
    return t === void 0 && (t = this._time), RA(this, TQ(this, t));
  }, B.previousLabel = function(t) {
    return t === void 0 && (t = this._time), RA(this, TQ(this, t), 1);
  }, B.currentLabel = function(t) {
    return arguments.length ? this.seek(t, !0) : this.previousLabel(this._time + x);
  }, B.shiftChildren = function(t, P, e) {
    e === void 0 && (e = 0);
    var i = this._first, s = this.labels, v;
    for (t = y(t); i; )
      i._start >= e && (i._start += t, i._end += t), i = i._next;
    if (P)
      for (v in s)
        s[v] >= e && (s[v] += t);
    return YQ(this);
  }, B.invalidate = function(t) {
    var P = this._first;
    for (this._lock = 0; P; )
      P.invalidate(t), P = P._next;
    return r.prototype.invalidate.call(this, t);
  }, B.clear = function(t) {
    t === void 0 && (t = !0);
    for (var P = this._first, e; P; )
      e = P._next, this.remove(P), P = e;
    return this._dp && (this._time = this._tTime = this._pTime = 0), t && (this.labels = {}), YQ(this);
  }, B.totalDuration = function(t) {
    var P = 0, e = this, i = e._last, s = zQ, v, c, n;
    if (arguments.length)
      return e.timeScale((e._repeat < 0 ? e.duration() : e.totalDuration()) / (e.reversed() ? -t : t));
    if (e._dirty) {
      for (n = e.parent; i; )
        v = i._prev, i._dirty && i.totalDuration(), c = i._start, c > s && e._sort && i._ts && !e._lock ? (e._lock = 1, aQ(e, i, c - i._delay, 1)._lock = 0) : s = c, c < 0 && i._ts && (P -= c, (!n && !e._dp || n && n.smoothChildTiming) && (e._start += y(c / e._ts), e._time -= c, e._tTime -= c), e.shiftChildren(-c, !1, -1 / 0), s = 0), i._end > P && i._ts && (P = i._end), i = v;
      BB(e, e === I && e._time > P ? e._time : P, 1, 1), e._dirty = 0;
    }
    return e._tDur;
  }, Q.updateRoot = function(t) {
    if (I._ts && (ut(I, FB(t, I)), Ut = eQ.frame), eQ.frame >= SA) {
      SA += sQ.autoSleep || 120;
      var P = I._first;
      if ((!P || !P._ts) && sQ.autoSleep && eQ._listeners.length < 2) {
        for (; P && !P._ts; )
          P = P._next;
        P || eQ.sleep();
      }
    }
  }, Q;
}(hB);
cQ(_.prototype, {
  _lock: 0,
  _hasPause: 0,
  _forcing: 0
});
var Ne = function(Q, B, A, t, P, e, i) {
  var s = new BQ(this._pt, Q, B, 0, 1, Zt, null, P), v = 0, c = 0, n, T, z, w, o, E, k, a;
  for (s.b = A, s.e = t, A += "", t += "", (k = ~t.indexOf("random(")) && (t = EB(t)), e && (a = [A, t], e(a, Q, B), A = a[0], t = a[1]), T = A.match(SB) || []; n = SB.exec(t); )
    w = n[0], o = t.substring(v, n.index), z ? z = (z + 1) % 5 : o.substr(-5) === "rgba(" && (z = 1), w !== T[c++] && (E = parseFloat(T[c - 1]) || 0, s._pt = {
      _next: s._pt,
      p: o || c === 1 ? o : ",",
      //note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
      s: E,
      c: w.charAt(1) === "=" ? WQ(E, w) - E : parseFloat(w) - E,
      m: z && z < 4 ? Math.round : 0
    }, v = SB.lastIndex);
  return s.c = v < t.length ? t.substring(v, t.length) : "", s.fp = i, (at.test(t) || k) && (s.e = 0), this._pt = s, s;
}, MA = function(Q, B, A, t, P, e, i, s, v, c) {
  Y(t) && (t = t(P || 0, Q, e));
  var n = Q[B], T = A !== "get" ? A : Y(n) ? v ? Q[B.indexOf("set") || !Y(Q["get" + B.substr(3)]) ? B : "get" + B.substr(3)](v) : Q[B]() : n, z = Y(n) ? v ? He : Xt : jA, w;
  if (K(t) && (~t.indexOf("random(") && (t = EB(t)), t.charAt(1) === "=" && (w = WQ(T, t) + (W(T) || 0), (w || w === 0) && (t = w))), !c || T !== t || zA)
    return !isNaN(T * t) && t !== "" ? (w = new BQ(this._pt, Q, B, +T || 0, t - (T || 0), typeof n == "boolean" ? Fe : Kt, 0, z), v && (w.fp = v), i && w.modifier(i, this, Q), this._pt = w) : (!n && !(B in Q) && CA(B, t), Ne.call(this, Q, B, T, t, z, s || sQ.stringFilter, v));
}, Oe = function(Q, B, A, t, P) {
  if (Y(Q) && (Q = oB(Q, P, B, A, t)), !kQ(Q) || Q.style && Q.nodeType || q(Q) || wt(Q))
    return K(Q) ? oB(Q, P, B, A, t) : Q;
  var e = {}, i;
  for (i in Q)
    e[i] = oB(Q[i], P, B, A, t);
  return e;
}, Vt = function(Q, B, A, t, P, e) {
  var i, s, v, c;
  if (PQ[Q] && (i = new PQ[Q]()).init(P, i.rawVars ? B[Q] : Oe(B[Q], t, P, e, A), A, t, e) !== !1 && (A._pt = s = new BQ(A._pt, P, Q, 0, 1, i.render, i, 0, i.priority), A !== ZQ))
    for (v = A._ptLookup[A._targets.indexOf(P)], c = i._props.length; c--; )
      v[i._props[c]] = s;
  return i;
}, dQ, zA, HA = function r(Q, B, A) {
  var t = Q.vars, P = t.ease, e = t.startAt, i = t.immediateRender, s = t.lazy, v = t.onUpdate, c = t.runBackwards, n = t.yoyoEase, T = t.keyframes, z = t.autoRevert, w = Q._dur, o = Q._startAt, E = Q._targets, k = Q.parent, a = k && k.data === "nested" ? k.vars.targets : E, U = Q._overwrite === "auto" && !lA, D = Q.timeline, l = t.easeReverse || n, O, u, N, C, M, b, j, d, G, f, H, F, X;
  if (D && (!T || !P) && (P = "none"), Q._ease = VQ(P, TB.ease), Q._rEase = l && (VQ(l) || Q._ease), Q._from = !D && !!t.runBackwards, Q._from && (Q.ratio = 1), !D || T && !t.stagger) {
    if (d = E[0] ? SQ(E[0]).harness : 0, F = d && t[d.prop], O = jB(t, NA), o && (o._zTime < 0 && o.progress(1), B < 0 && c && i && !z ? o.render(-1, !0) : o.revert(c && w ? NB : $P), o._lazy = 0), e) {
      if (FQ(Q._startAt = J.set(E, cQ({
        data: "isStart",
        overwrite: !1,
        parent: k,
        immediateRender: !0,
        lazy: !o && $(s),
        startAt: null,
        delay: 0,
        onUpdate: v && function() {
          return iQ(Q, "onUpdate");
        },
        stagger: 0
      }, e))), Q._startAt._dp = 0, Q._startAt._sat = Q, B < 0 && (Z || !i && !z) && Q._startAt.revert(NB), i && w && B <= 0 && A <= 0) {
        B && (Q._zTime = B);
        return;
      }
    } else if (c && w && !o) {
      if (B && (i = !1), N = cQ({
        overwrite: !1,
        data: "isFromStart",
        //we tag the tween with as "isFromStart" so that if [inside a plugin] we need to only do something at the very END of a tween, we have a way of identifying this tween as merely the one that's setting the beginning values for a "from()" tween. For example, clearProps in CSSPlugin should only get applied at the very END of a tween and without this tag, from(...{height:100, clearProps:"height", delay:1}) would wipe the height at the beginning of the tween and after 1 second, it'd kick back in.
        lazy: i && !o && $(s),
        immediateRender: i,
        //zero-duration tweens render immediately by default, but if we're not specifically instructed to render this tween immediately, we should skip this and merely _init() to record the starting values (rendering them immediately would push them to completion which is wasteful in that case - we'd have to render(-1) immediately after)
        stagger: 0,
        parent: k
        //ensures that nested tweens that had a stagger are handled properly, like gsap.from(".class", {y: gsap.utils.wrap([-100,100]), stagger: 0.5})
      }, O), F && (N[d.prop] = F), FQ(Q._startAt = J.set(E, N)), Q._startAt._dp = 0, Q._startAt._sat = Q, B < 0 && (Z ? Q._startAt.revert(NB) : Q._startAt.render(-1, !0)), Q._zTime = B, !i)
        r(Q._startAt, x, x);
      else if (!B)
        return;
    }
    for (Q._pt = Q._ptCache = 0, s = w && $(s) || s && !w, u = 0; u < E.length; u++) {
      if (M = E[u], j = M._gsap || dA(E)[u]._gsap, Q._ptLookup[u] = f = {}, sA[j.id] && HQ.length && HB(), H = a === E ? u : a.indexOf(M), d && (G = new d()).init(M, F || O, Q, H, a) !== !1 && (Q._pt = C = new BQ(Q._pt, M, G.name, 0, 1, G.render, G, 0, G.priority), G._props.forEach(function(nQ) {
        f[nQ] = C;
      }), G.priority && (b = 1)), !d || F)
        for (N in O)
          PQ[N] && (G = Vt(N, O, Q, H, M, a)) ? G.priority && (b = 1) : f[N] = C = MA.call(Q, M, N, "get", O[N], H, a, 0, t.stringFilter);
      Q._op && Q._op[u] && Q.kill(M, Q._op[u]), U && Q._pt && (dQ = Q, I.killTweensOf(M, f, Q.globalTime(B)), X = !Q.parent, dQ = 0), Q._pt && s && (sA[j.id] = 1);
    }
    b && Wt(Q), Q._onInit && Q._onInit(Q);
  }
  Q._onUpdate = v, Q._initted = (!Q._op || Q._pt) && !X, T && B <= 0 && D.render(zQ, !0, !0);
}, de = function(Q, B, A, t, P, e, i, s) {
  var v = (Q._pt && Q._ptCache || (Q._ptCache = {}))[B], c, n, T, z;
  if (!v)
    for (v = Q._ptCache[B] = [], T = Q._ptLookup, z = Q._targets.length; z--; ) {
      if (c = T[z][B], c && c.d && c.d._pt)
        for (c = c.d._pt; c && c.p !== B && c.fp !== B; )
          c = c._next;
      if (!c)
        return zA = 1, Q.vars[B] = "+=0", HA(Q, i), zA = 0, s ? zB(B + " not eligible for reset. Try splitting into individual properties") : 1;
      v.push(c);
    }
  for (z = v.length; z--; )
    n = v[z], c = n._pt || n, c.s = (t || t === 0) && !P ? t : c.s + (t || 0) + e * c.c, c.c = A - c.s, n.e && (n.e = V(A) + W(n.e)), n.b && (n.b = c.s + W(n.b));
}, Le = function(Q, B) {
  var A = Q[0] ? SQ(Q[0]).harness : 0, t = A && A.aliases, P, e, i, s;
  if (!t)
    return B;
  P = $Q({}, B);
  for (e in t)
    if (e in P)
      for (s = t[e].split(","), i = s.length; i--; )
        P[s[i]] = P[e];
  return P;
}, Me = function(Q, B, A, t) {
  var P = B.ease || t || "power1.inOut", e, i;
  if (q(B))
    i = A[Q] || (A[Q] = []), B.forEach(function(s, v) {
      return i.push({
        t: v / (B.length - 1) * 100,
        v: s,
        e: P
      });
    });
  else
    for (e in B)
      i = A[e] || (A[e] = []), e === "ease" || i.push({
        t: parseFloat(Q),
        v: B[e],
        e: P
      });
}, oB = function(Q, B, A, t, P) {
  return Y(Q) ? Q.call(B, A, t, P) : K(Q) && ~Q.indexOf("random(") ? EB(Q) : Q;
}, Jt = OA + "repeat,repeatDelay,yoyo,repeatRefresh,yoyoEase,easeReverse,autoRevert", Rt = {};
QQ(Jt + ",id,stagger,delay,duration,paused,scrollTrigger", function(r) {
  return Rt[r] = 1;
});
var J = /* @__PURE__ */ function(r) {
  Tt(Q, r);
  function Q(A, t, P, e) {
    var i;
    typeof t == "number" && (P.duration = t, t = P, P = null), i = r.call(this, e ? t : cB(t)) || this;
    var s = i.vars, v = s.duration, c = s.delay, n = s.immediateRender, T = s.stagger, z = s.overwrite, w = s.keyframes, o = s.defaults, E = s.scrollTrigger, k = t.parent || I, a = (q(A) || wt(A) ? uQ(A[0]) : "length" in t) ? [A] : wQ(A), U, D, l, O, u, N, C, M;
    if (i._targets = a.length ? dA(a) : zB("GSAP target " + A + " not found. https://gsap.com", !sQ.nullTargetWarn) || [], i._ptLookup = [], i._overwrite = z, w || T || CB(v) || CB(c)) {
      t = i.vars;
      var b = t.easeReverse || t.yoyoEase;
      if (U = i.timeline = new _({
        data: "nested",
        defaults: o || {},
        targets: k && k.data === "nested" ? k.vars.targets : a
      }), U.kill(), U.parent = U._dp = UQ(i), U._start = 0, T || CB(v) || CB(c)) {
        if (O = a.length, C = T && Ft(T), kQ(T))
          for (u in T)
            ~Jt.indexOf(u) && (M || (M = {}), M[u] = T[u]);
        for (D = 0; D < O; D++)
          l = jB(t, Rt), l.stagger = 0, b && (l.easeReverse = b), M && $Q(l, M), N = a[D], l.duration = +oB(v, UQ(i), D, N, a), l.delay = (+oB(c, UQ(i), D, N, a) || 0) - i._delay, !T && O === 1 && l.delay && (i._delay = c = l.delay, i._start += c, l.delay = 0), U.to(N, l, C ? C(D, N, a) : 0), U._ease = g.none;
        U.duration() ? v = c = 0 : i.timeline = 0;
      } else if (w) {
        cB(cQ(U.vars.defaults, {
          ease: "none"
        })), U._ease = VQ(w.ease || t.ease || "none");
        var j = 0, d, G, f;
        if (q(w))
          w.forEach(function(H) {
            return U.to(a, H, ">");
          }), U.duration();
        else {
          l = {};
          for (u in w)
            u === "ease" || u === "easeEach" || Me(u, w[u], l, w.easeEach);
          for (u in l)
            for (d = l[u].sort(function(H, F) {
              return H.t - F.t;
            }), j = 0, D = 0; D < d.length; D++)
              G = d[D], f = {
                ease: G.e,
                duration: (G.t - (D ? d[D - 1].t : 0)) / 100 * v
              }, f[u] = G.v, U.to(a, f, j), j += f.duration;
          U.duration() < v && U.to({}, {
            duration: v - U.duration()
          });
        }
      }
      v || i.duration(v = U.duration());
    } else
      i.timeline = 0;
    return z === !0 && !lA && (dQ = UQ(i), I.killTweensOf(a), dQ = 0), aQ(k, UQ(i), P), t.reversed && i.reverse(), t.paused && i.paused(!0), (n || !v && !w && i._start === y(k._time) && $(n) && ee(UQ(i)) && k.data !== "nested") && (i._tTime = -x, i.render(Math.max(0, -c) || 0)), E && Lt(UQ(i), E), i;
  }
  var B = Q.prototype;
  return B.render = function(t, P, e) {
    var i = this._time, s = this._tDur, v = this._dur, c = t < 0, n = t > s - x && !c ? s : t < x ? 0 : t, T, z, w, o, E, k, a, U;
    if (!v)
      re(this, t, P, e);
    else if (n !== this._tTime || !t || e || !this._initted && this._tTime || this._startAt && this._zTime < 0 !== c || this._lazy) {
      if (T = n, U = this.timeline, this._repeat) {
        if (o = v + this._rDelay, this._repeat < -1 && c)
          return this.totalTime(o * 100 + t, P, e);
        if (T = y(n % o), n === s ? (w = this._repeat, T = v) : (E = y(n / o), w = ~~E, w && w === E ? (T = v, w--) : T > v && (T = v)), k = this._yoyo && w & 1, k && (T = v - T), E = QB(this._tTime, o), T === i && !e && this._initted && w === E)
          return this._tTime = n, this;
        w !== E && this.vars.repeatRefresh && !k && !this._lock && T !== o && this._initted && (this._lock = e = 1, this.render(y(o * w), !0).invalidate()._lock = 0);
      }
      if (!this._initted) {
        if (Mt(this, c ? t : T, e, P, n))
          return this._tTime = 0, this;
        if (i !== this._time && !(e && this.vars.repeatRefresh && w !== E))
          return this;
        if (v !== this._dur)
          return this.render(t, P, e);
      }
      if (this._rEase) {
        var D = T < i;
        if (D !== this._inv) {
          var l = D ? i : v - i;
          this._inv = D, this._from && (this.ratio = 1 - this.ratio), this._invRatio = this.ratio, this._invTime = i, this._invRecip = l ? (D ? -1 : 1) / l : 0, this._invScale = D ? -this.ratio : 1 - this.ratio, this._invEase = D ? this._rEase : this._ease;
        }
        this.ratio = a = this._invRatio + this._invScale * this._invEase((T - this._invTime) * this._invRecip);
      } else
        this.ratio = a = this._ease(T / v);
      if (this._from && (this.ratio = a = 1 - a), this._tTime = n, this._time = T, !this._act && this._ts && (this._act = 1, this._lazy = 0), !i && n && !P && !E && (iQ(this, "onStart"), this._tTime !== n))
        return this;
      for (z = this._pt; z; )
        z.r(a, z.d), z = z._next;
      U && U.render(t < 0 ? t : U._dur * U._ease(T / this._dur), P, e) || this._startAt && (this._zTime = t), this._onUpdate && !P && (c && vA(this, t, P, e), iQ(this, "onUpdate")), this._repeat && w !== E && this.vars.onRepeat && !P && this.parent && iQ(this, "onRepeat"), (n === this._tDur || !n) && this._tTime === n && (c && !this._onUpdate && vA(this, t, !0, !0), (t || !v) && (n === this._tDur && this._ts > 0 || !n && this._ts < 0) && FQ(this, 1), !P && !(c && !i) && (n || i || k) && (iQ(this, n === s ? "onComplete" : "onReverseComplete", !0), this._prom && !(n < s && this.timeScale() > 0) && this._prom()));
    }
    return this;
  }, B.targets = function() {
    return this._targets;
  }, B.invalidate = function(t) {
    return (!t || !this.vars.runBackwards) && (this._startAt = 0), this._pt = this._op = this._onUpdate = this._lazy = this.ratio = 0, this._ptLookup = [], this.timeline && this.timeline.invalidate(t), r.prototype.invalidate.call(this, t);
  }, B.resetTo = function(t, P, e, i, s) {
    aB || eQ.wake(), this._ts || this.play();
    var v = Math.min(this._dur, (this._dp._time - this._start) * this._ts), c;
    return this._initted || HA(this, v), c = this._ease(v / this._dur), de(this, t, P, e, i, c, v, s) ? this.resetTo(t, P, e, i, 1) : (xB(this, 0), this.parent || Ot(this._dp, this, "_first", "_last", this._dp._sort ? "_start" : 0), this.render(0));
  }, B.kill = function(t, P) {
    if (P === void 0 && (P = "all"), !t && (!P || P === "all"))
      return this._lazy = this._pt = 0, this.parent ? sB(this) : this.scrollTrigger && this.scrollTrigger.kill(!!Z), this;
    if (this.timeline) {
      var e = this.timeline.totalDuration();
      return this.timeline.killTweensOf(t, P, dQ && dQ.vars.overwrite !== !0)._first || sB(this), this.parent && e !== this.timeline.totalDuration() && BB(this, this._dur * this.timeline._tDur / e, 0, 1), this;
    }
    var i = this._targets, s = t ? wQ(t) : i, v = this._ptLookup, c = this._pt, n, T, z, w, o, E, k;
    if ((!P || P === "all") && te(i, s))
      return P === "all" && (this._pt = 0), sB(this);
    for (n = this._op = this._op || [], P !== "all" && (K(P) && (o = {}, QQ(P, function(a) {
      return o[a] = 1;
    }), P = o), P = Le(i, P)), k = i.length; k--; )
      if (~s.indexOf(i[k])) {
        T = v[k], P === "all" ? (n[k] = P, w = T, z = {}) : (z = n[k] = n[k] || {}, w = P);
        for (o in w)
          E = T && T[o], E && ((!("kill" in E.d) || E.d.kill(o) === !0) && gB(this, E, "_pt"), delete T[o]), z !== "all" && (z[o] = 1);
      }
    return this._initted && !this._pt && c && sB(this), this;
  }, Q.to = function(t, P) {
    return new Q(t, P, arguments[2]);
  }, Q.from = function(t, P) {
    return nB(1, arguments);
  }, Q.delayedCall = function(t, P, e, i) {
    return new Q(P, 0, {
      immediateRender: !1,
      lazy: !1,
      overwrite: !1,
      delay: t,
      onComplete: P,
      onReverseComplete: P,
      onCompleteParams: e,
      onReverseCompleteParams: e,
      callbackScope: i
    });
  }, Q.fromTo = function(t, P, e) {
    return nB(2, arguments);
  }, Q.set = function(t, P) {
    return P.duration = 0, P.repeatDelay || (P.repeat = 0), new Q(t, P);
  }, Q.killTweensOf = function(t, P, e) {
    return I.killTweensOf(t, P, e);
  }, Q;
}(hB);
cQ(J.prototype, {
  _targets: [],
  _lazy: 0,
  _startAt: 0,
  _op: 0,
  _onInit: 0
});
QQ("staggerTo,staggerFrom,staggerFromTo", function(r) {
  J[r] = function() {
    var Q = new _(), B = nA.call(arguments, 0);
    return B.splice(r === "staggerFromTo" ? 5 : 4, 0, 0), Q[r].apply(Q, B);
  };
});
var jA = function(Q, B, A) {
  return Q[B] = A;
}, Xt = function(Q, B, A) {
  return Q[B](A);
}, He = function(Q, B, A, t) {
  return Q[B](t.fp, A);
}, je = function(Q, B, A) {
  return Q.setAttribute(B, A);
}, FA = function(Q, B) {
  return Y(Q[B]) ? Xt : UA(Q[B]) && Q.setAttribute ? je : jA;
}, Kt = function(Q, B) {
  return B.set(B.t, B.p, Math.round((B.s + B.c * Q) * 1e6) / 1e6, B);
}, Fe = function(Q, B) {
  return B.set(B.t, B.p, !!(B.s + B.c * Q), B);
}, Zt = function(Q, B) {
  var A = B._pt, t = "";
  if (!Q && B.b)
    t = B.b;
  else if (Q === 1 && B.e)
    t = B.e;
  else {
    for (; A; )
      t = A.p + (A.m ? A.m(A.s + A.c * Q) : Math.round((A.s + A.c * Q) * 1e4) / 1e4) + t, A = A._next;
    t += B.c;
  }
  B.set(B.t, B.p, t, B);
}, GA = function(Q, B) {
  for (var A = B._pt; A; )
    A.r(Q, A.d), A = A._next;
}, Ge = function(Q, B, A, t) {
  for (var P = this._pt, e; P; )
    e = P._next, P.p === t && P.modifier(Q, B, A), P = e;
}, fe = function(Q) {
  for (var B = this._pt, A, t; B; )
    t = B._next, B.p === Q && !B.op || B.op === Q ? gB(this, B, "_pt") : B.dep || (A = 1), B = t;
  return !A;
}, be = function(Q, B, A, t) {
  t.mSet(Q, B, t.m.call(t.tween, A, t.mt), t);
}, Wt = function(Q) {
  for (var B = Q._pt, A, t, P, e; B; ) {
    for (A = B._next, t = P; t && t.pr > B.pr; )
      t = t._next;
    (B._prev = t ? t._prev : e) ? B._prev._next = B : P = B, (B._next = t) ? t._prev = B : e = B, B = A;
  }
  Q._pt = P;
}, BQ = /* @__PURE__ */ function() {
  function r(B, A, t, P, e, i, s, v, c) {
    this.t = A, this.s = P, this.c = e, this.p = t, this.r = i || Kt, this.d = s || this, this.set = v || jA, this.pr = c || 0, this._next = B, B && (B._prev = this);
  }
  var Q = r.prototype;
  return Q.modifier = function(A, t, P) {
    this.mSet = this.mSet || this.set, this.set = be, this.m = A, this.mt = P, this.tween = t;
  }, r;
}();
QQ(OA + "parent,duration,ease,delay,overwrite,runBackwards,startAt,yoyo,immediateRender,repeat,repeatDelay,data,paused,reversed,lazy,callbackScope,stringFilter,id,yoyoEase,stagger,inherit,repeatRefresh,keyframes,autoRevert,scrollTrigger,easeReverse", function(r) {
  return NA[r] = 1;
});
vQ.TweenMax = vQ.TweenLite = J;
vQ.TimelineLite = vQ.TimelineMax = _;
I = new _({
  sortChildren: !1,
  defaults: TB,
  autoRemoveChildren: !0,
  id: "root",
  smoothChildTiming: !0
});
sQ.stringFilter = It;
var JQ = [], dB = {}, ge = [], KA = 0, pe = 0, XB = function(Q) {
  return (dB[Q] || ge).map(function(B) {
    return B();
  });
}, wA = function() {
  var Q = Date.now(), B = [];
  Q - KA > 2 && (XB("matchMediaInit"), JQ.forEach(function(A) {
    var t = A.queries, P = A.conditions, e, i, s, v;
    for (i in t)
      e = EQ.matchMedia(t[i]).matches, e && (s = 1), e !== P[i] && (P[i] = e, v = 1);
    v && (A.revert(), s && B.push(A));
  }), XB("matchMediaRevert"), B.forEach(function(A) {
    return A.onMatch(A, function(t) {
      return A.add(null, t);
    });
  }), KA = Q, XB("matchMedia"));
}, qt = /* @__PURE__ */ function() {
  function r(B, A) {
    this.selector = A && oA(A), this.data = [], this._r = [], this.isReverted = !1, this.id = pe++, B && this.add(B);
  }
  var Q = r.prototype;
  return Q.add = function(A, t, P) {
    Y(A) && (P = t, t = A, A = Y);
    var e = this, i = function() {
      var v = m, c = e.selector, n;
      return v && v !== e && v.data.push(e), P && (e.selector = oA(P)), m = e, n = t.apply(e, arguments), Y(n) && e._r.push(n), m = v, e.selector = c, e.isReverted = !1, n;
    };
    return e.last = i, A === Y ? i(e, function(s) {
      return e.add(null, s);
    }) : A ? e[A] = i : i;
  }, Q.ignore = function(A) {
    var t = m;
    m = null, A(this), m = t;
  }, Q.getTweens = function() {
    var A = [];
    return this.data.forEach(function(t) {
      return t instanceof r ? A.push.apply(A, t.getTweens()) : t instanceof J && !(t.parent && t.parent.data === "nested") && A.push(t);
    }), A;
  }, Q.clear = function() {
    this._r.length = this.data.length = 0;
  }, Q.kill = function(A, t) {
    var P = this;
    if (A ? function() {
      for (var i = P.getTweens(), s = P.data.length, v; s--; )
        v = P.data[s], v.data === "isFlip" && (v.revert(), v.getChildren(!0, !0, !1).forEach(function(c) {
          return i.splice(i.indexOf(c), 1);
        }));
      for (i.map(function(c) {
        return {
          g: c._dur || c._delay || c._sat && !c._sat.vars.immediateRender ? c.globalTime(0) : -1 / 0,
          t: c
        };
      }).sort(function(c, n) {
        return n.g - c.g || -1 / 0;
      }).forEach(function(c) {
        return c.t.revert(A);
      }), s = P.data.length; s--; )
        v = P.data[s], v instanceof _ ? v.data !== "nested" && (v.scrollTrigger && v.scrollTrigger.revert(), v.kill()) : !(v instanceof J) && v.revert && v.revert(A);
      P._r.forEach(function(c) {
        return c(A, P);
      }), P.isReverted = !0;
    }() : this.data.forEach(function(i) {
      return i.kill && i.kill();
    }), this.clear(), t)
      for (var e = JQ.length; e--; )
        JQ[e].id === this.id && JQ.splice(e, 1);
  }, Q.revert = function(A) {
    this.kill(A || {});
  }, r;
}(), xe = /* @__PURE__ */ function() {
  function r(B) {
    this.contexts = [], this.scope = B, m && m.data.push(this);
  }
  var Q = r.prototype;
  return Q.add = function(A, t, P) {
    kQ(A) || (A = {
      matches: A
    });
    var e = new qt(0, P || this.scope), i = e.conditions = {}, s, v, c;
    m && !e.selector && (e.selector = m.selector), this.contexts.push(e), t = e.add("onMatch", t), e.queries = A;
    for (v in A)
      v === "all" ? c = 1 : (s = EQ.matchMedia(A[v]), s && (JQ.indexOf(e) < 0 && JQ.push(e), (i[v] = s.matches) && (c = 1), s.addListener ? s.addListener(wA) : s.addEventListener("change", wA)));
    return c && t(e, function(n) {
      return e.add(null, n);
    }), this;
  }, Q.revert = function(A) {
    this.kill(A || {});
  }, Q.kill = function(A) {
    this.contexts.forEach(function(t) {
      return t.kill(A, !0);
    });
  }, r;
}(), GB = {
  registerPlugin: function() {
    for (var Q = arguments.length, B = new Array(Q), A = 0; A < Q; A++)
      B[A] = arguments[A];
    B.forEach(function(t) {
      return xt(t);
    });
  },
  timeline: function(Q) {
    return new _(Q);
  },
  getTweensOf: function(Q, B) {
    return I.getTweensOf(Q, B);
  },
  getProperty: function(Q, B, A, t) {
    K(Q) && (Q = wQ(Q)[0]);
    var P = SQ(Q || {}).get, e = A ? Nt : Ct;
    return A === "native" && (A = ""), Q && (B ? e((PQ[B] && PQ[B].get || P)(Q, B, A, t)) : function(i, s, v) {
      return e((PQ[i] && PQ[i].get || P)(Q, i, s, v));
    });
  },
  quickSetter: function(Q, B, A) {
    if (Q = wQ(Q), Q.length > 1) {
      var t = Q.map(function(c) {
        return tQ.quickSetter(c, B, A);
      }), P = t.length;
      return function(c) {
        for (var n = P; n--; )
          t[n](c);
      };
    }
    Q = Q[0] || {};
    var e = PQ[B], i = SQ(Q), s = i.harness && (i.harness.aliases || {})[B] || B, v = e ? function(c) {
      var n = new e();
      ZQ._pt = 0, n.init(Q, A ? c + A : c, ZQ, 0, [Q]), n.render(1, n), ZQ._pt && GA(1, ZQ);
    } : i.set(Q, s);
    return e ? v : function(c) {
      return v(Q, s, A ? c + A : c, i, 1);
    };
  },
  quickTo: function(Q, B, A) {
    var t, P = tQ.to(Q, cQ((t = {}, t[B] = "+=0.1", t.paused = !0, t.stagger = 0, t), A || {})), e = function(s, v, c) {
      return P.resetTo(B, s, v, c);
    };
    return e.tween = P, e;
  },
  isTweening: function(Q) {
    return I.getTweensOf(Q, !0).length > 0;
  },
  defaults: function(Q) {
    return Q && Q.ease && (Q.ease = VQ(Q.ease, TB.ease)), YA(TB, Q || {});
  },
  config: function(Q) {
    return YA(sQ, Q || {});
  },
  registerEffect: function(Q) {
    var B = Q.name, A = Q.effect, t = Q.plugins, P = Q.defaults, e = Q.extendTimeline;
    (t || "").split(",").forEach(function(i) {
      return i && !PQ[i] && !vQ[i] && zB(B + " effect requires " + i + " plugin.");
    }), YB[B] = function(i, s, v) {
      return A(wQ(i), cQ(s || {}, P), v);
    }, e && (_.prototype[B] = function(i, s, v) {
      return this.add(YB[B](i, kQ(s) ? s : (v = s) && {}, this), v);
    });
  },
  registerEase: function(Q, B) {
    g[Q] = VQ(B);
  },
  parseEase: function(Q, B) {
    return arguments.length ? VQ(Q, B) : g;
  },
  getById: function(Q) {
    return I.getById(Q);
  },
  exportRoot: function(Q, B) {
    Q === void 0 && (Q = {});
    var A = new _(Q), t, P;
    for (A.smoothChildTiming = $(Q.smoothChildTiming), I.remove(A), A._dp = 0, A._time = A._tTime = I._time, t = I._first; t; )
      P = t._next, (B || !(!t._dur && t instanceof J && t.vars.onComplete === t._targets[0])) && aQ(A, t, t._start - t._delay), t = P;
    return aQ(I, A, 0), A;
  },
  context: function(Q, B) {
    return Q ? new qt(Q, B) : m;
  },
  matchMedia: function(Q) {
    return new xe(Q);
  },
  matchMediaRefresh: function() {
    return JQ.forEach(function(Q) {
      var B = Q.conditions, A, t;
      for (t in B)
        B[t] && (B[t] = !1, A = 1);
      A && Q.revert();
    }) || wA();
  },
  addEventListener: function(Q, B) {
    var A = dB[Q] || (dB[Q] = []);
    ~A.indexOf(B) || A.push(B);
  },
  removeEventListener: function(Q, B) {
    var A = dB[Q], t = A && A.indexOf(B);
    t >= 0 && A.splice(t, 1);
  },
  utils: {
    wrap: we,
    wrapYoyo: Ee,
    distribute: Ft,
    random: ft,
    snap: Gt,
    normalize: ze,
    getUnit: W,
    clamp: ce,
    splitColor: mt,
    toArray: wQ,
    selector: oA,
    mapRange: gt,
    pipe: oe,
    unitize: Te,
    interpolate: ae,
    shuffle: jt
  },
  install: kt,
  effects: YB,
  ticker: eQ,
  updateRoot: _.updateRoot,
  plugins: PQ,
  globalTimeline: I,
  core: {
    PropTween: BQ,
    globals: lt,
    Tween: J,
    Timeline: _,
    Animation: hB,
    getCache: SQ,
    _removeLinkedListItem: gB,
    reverting: function() {
      return Z;
    },
    context: function(Q) {
      return Q && m && (m.data.push(Q), Q._ctx = m), m;
    },
    suppressOverwrites: function(Q) {
      return lA = Q;
    }
  }
};
QQ("to,from,fromTo,delayedCall,set,killTweensOf", function(r) {
  return GB[r] = J[r];
});
eQ.add(_.updateRoot);
ZQ = GB.to({}, {
  duration: 0
});
var me = function(Q, B) {
  for (var A = Q._pt; A && A.p !== B && A.op !== B && A.fp !== B; )
    A = A._next;
  return A;
}, ye = function(Q, B) {
  var A = Q._targets, t, P, e;
  for (t in B)
    for (P = A.length; P--; )
      e = Q._ptLookup[P][t], e && (e = e.d) && (e._pt && (e = me(e, t)), e && e.modifier && e.modifier(B[t], Q, A[P], t));
}, KB = function(Q, B) {
  return {
    name: Q,
    headless: 1,
    rawVars: 1,
    //don't pre-process function-based values or "random()" strings.
    init: function(t, P, e) {
      e._onInit = function(i) {
        var s, v;
        if (K(P) && (s = {}, QQ(P, function(c) {
          return s[c] = 1;
        }), P = s), B) {
          s = {};
          for (v in P)
            s[v] = B(P[v]);
          P = s;
        }
        ye(i, P);
      };
    }
  };
}, tQ = GB.registerPlugin({
  name: "attr",
  init: function(Q, B, A, t, P) {
    var e, i, s;
    this.tween = A;
    for (e in B)
      s = Q.getAttribute(e) || "", i = this.add(Q, "setAttribute", (s || 0) + "", B[e], t, P, 0, 0, e), i.op = e, i.b = s, this._props.push(e);
  },
  render: function(Q, B) {
    for (var A = B._pt; A; )
      Z ? A.set(A.t, A.p, A.b, A) : A.r(Q, A.d), A = A._next;
  }
}, {
  name: "endArray",
  headless: 1,
  init: function(Q, B) {
    for (var A = B.length; A--; )
      this.add(Q, A, Q[A] || 0, B[A], 0, 0, 0, 0, 0, 1);
  }
}, KB("roundProps", TA), KB("modifiers"), KB("snap", Gt)) || GB;
J.version = _.version = tQ.version = "3.15.0";
ht = 1;
DA() && AB();
g.Power0;
g.Power1;
g.Power2;
g.Power3;
g.Power4;
g.Linear;
g.Quad;
g.Cubic;
g.Quart;
g.Quint;
g.Strong;
g.Elastic;
g.Back;
g.SteppedEase;
g.Bounce;
g.Sine;
g.Expo;
g.Circ;
/*!
 * CSSPlugin 3.15.0
 * https://gsap.com
 *
 * Copyright 2008-2026, GreenSock. All rights reserved.
 * Subject to the terms at https://gsap.com/standard-license
 * @author: Jack Doyle, jack@greensock.com
*/
var ZA, LQ, qQ, fA, IQ, WA, bA, Ie = function() {
  return typeof window < "u";
}, CQ = {}, yQ = 180 / Math.PI, _Q = Math.PI / 180, XQ = Math.atan2, qA = 1e8, gA = /([A-Z])/g, Se = /(left|right|width|margin|padding|x)/i, Ye = /[\s,\(]\S/, hQ = {
  autoAlpha: "opacity,visibility",
  scale: "scaleX,scaleY",
  alpha: "opacity"
}, EA = function(Q, B) {
  return B.set(B.t, B.p, Math.round((B.s + B.c * Q) * 1e4) / 1e4 + B.u, B);
}, Ve = function(Q, B) {
  return B.set(B.t, B.p, Q === 1 ? B.e : Math.round((B.s + B.c * Q) * 1e4) / 1e4 + B.u, B);
}, Je = function(Q, B) {
  return B.set(B.t, B.p, Q ? Math.round((B.s + B.c * Q) * 1e4) / 1e4 + B.u : B.b, B);
}, Re = function(Q, B) {
  return B.set(B.t, B.p, Q === 1 ? B.e : Q ? Math.round((B.s + B.c * Q) * 1e4) / 1e4 + B.u : B.b, B);
}, Xe = function(Q, B) {
  var A = B.s + B.c * Q;
  B.set(B.t, B.p, ~~(A + (A < 0 ? -0.5 : 0.5)) + B.u, B);
}, _t = function(Q, B) {
  return B.set(B.t, B.p, Q ? B.e : B.b, B);
}, $t = function(Q, B) {
  return B.set(B.t, B.p, Q !== 1 ? B.b : B.e, B);
}, Ke = function(Q, B, A) {
  return Q.style[B] = A;
}, Ze = function(Q, B, A) {
  return Q.style.setProperty(B, A);
}, We = function(Q, B, A) {
  return Q._gsap[B] = A;
}, qe = function(Q, B, A) {
  return Q._gsap.scaleX = Q._gsap.scaleY = A;
}, _e = function(Q, B, A, t, P) {
  var e = Q._gsap;
  e.scaleX = e.scaleY = A, e.renderTransform(P, e);
}, $e = function(Q, B, A, t, P) {
  var e = Q._gsap;
  e[B] = A, e.renderTransform(P, e);
}, S = "transform", AQ = S + "Origin", Qi = function r(Q, B) {
  var A = this, t = this.target, P = t.style, e = t._gsap;
  if (Q in CQ && P) {
    if (this.tfm = this.tfm || {}, Q !== "transform")
      Q = hQ[Q] || Q, ~Q.indexOf(",") ? Q.split(",").forEach(function(i) {
        return A.tfm[i] = DQ(t, i);
      }) : this.tfm[Q] = e.x ? e[Q] : DQ(t, Q), Q === AQ && (this.tfm.zOrigin = e.zOrigin);
    else
      return hQ.transform.split(",").forEach(function(i) {
        return r.call(A, i, B);
      });
    if (this.props.indexOf(S) >= 0)
      return;
    e.svg && (this.svgo = t.getAttribute("data-svg-origin"), this.props.push(AQ, B, "")), Q = S;
  }
  (P || B) && this.props.push(Q, B, P[Q]);
}, QP = function(Q) {
  Q.translate && (Q.removeProperty("translate"), Q.removeProperty("scale"), Q.removeProperty("rotate"));
}, Bi = function() {
  var Q = this.props, B = this.target, A = B.style, t = B._gsap, P, e;
  for (P = 0; P < Q.length; P += 3)
    Q[P + 1] ? Q[P + 1] === 2 ? B[Q[P]](Q[P + 2]) : B[Q[P]] = Q[P + 2] : Q[P + 2] ? A[Q[P]] = Q[P + 2] : A.removeProperty(Q[P].substr(0, 2) === "--" ? Q[P] : Q[P].replace(gA, "-$1").toLowerCase());
  if (this.tfm) {
    for (e in this.tfm)
      t[e] = this.tfm[e];
    t.svg && (t.renderTransform(), B.setAttribute("data-svg-origin", this.svgo || "")), P = bA(), (!P || !P.isStart) && !A[S] && (QP(A), t.zOrigin && A[AQ] && (A[AQ] += " " + t.zOrigin + "px", t.zOrigin = 0, t.renderTransform()), t.uncache = 1);
  }
}, BP = function(Q, B) {
  var A = {
    target: Q,
    props: [],
    revert: Bi,
    save: Qi
  };
  return Q._gsap || tQ.core.getCache(Q), B && Q.style && Q.nodeType && B.split(",").forEach(function(t) {
    return A.save(t);
  }), A;
}, AP, aA = function(Q, B) {
  var A = LQ.createElementNS ? LQ.createElementNS((B || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), Q) : LQ.createElement(Q);
  return A && A.style ? A : LQ.createElement(Q);
}, rQ = function r(Q, B, A) {
  var t = getComputedStyle(Q);
  return t[B] || t.getPropertyValue(B.replace(gA, "-$1").toLowerCase()) || t.getPropertyValue(B) || !A && r(Q, tB(B) || B, 1) || "";
}, _A = "O,Moz,ms,Ms,Webkit".split(","), tB = function(Q, B, A) {
  var t = B || IQ, P = t.style, e = 5;
  if (Q in P && !A)
    return Q;
  for (Q = Q.charAt(0).toUpperCase() + Q.substr(1); e-- && !(_A[e] + Q in P); )
    ;
  return e < 0 ? null : (e === 3 ? "ms" : e >= 0 ? _A[e] : "") + Q;
}, hA = function() {
  Ie() && window.document && (ZA = window, LQ = ZA.document, qQ = LQ.documentElement, IQ = aA("div") || {
    style: {}
  }, aA("div"), S = tB(S), AQ = S + "Origin", IQ.style.cssText = "border-width:0;line-height:0;position:absolute;padding:0", AP = !!tB("perspective"), bA = tQ.core.reverting, fA = 1);
}, $A = function(Q) {
  var B = Q.ownerSVGElement, A = aA("svg", B && B.getAttribute("xmlns") || "http://www.w3.org/2000/svg"), t = Q.cloneNode(!0), P;
  t.style.display = "block", A.appendChild(t), qQ.appendChild(A);
  try {
    P = t.getBBox();
  } catch {
  }
  return A.removeChild(t), qQ.removeChild(A), P;
}, Qt = function(Q, B) {
  for (var A = B.length; A--; )
    if (Q.hasAttribute(B[A]))
      return Q.getAttribute(B[A]);
}, tP = function(Q) {
  var B, A;
  try {
    B = Q.getBBox();
  } catch {
    B = $A(Q), A = 1;
  }
  return B && (B.width || B.height) || A || (B = $A(Q)), B && !B.width && !B.x && !B.y ? {
    x: +Qt(Q, ["x", "cx", "x1"]) || 0,
    y: +Qt(Q, ["y", "cy", "y1"]) || 0,
    width: 0,
    height: 0
  } : B;
}, PP = function(Q) {
  return !!(Q.getCTM && (!Q.parentNode || Q.ownerSVGElement) && tP(Q));
}, GQ = function(Q, B) {
  if (B) {
    var A = Q.style, t;
    B in CQ && B !== AQ && (B = S), A.removeProperty ? (t = B.substr(0, 2), (t === "ms" || B.substr(0, 6) === "webkit") && (B = "-" + B), A.removeProperty(t === "--" ? B : B.replace(gA, "-$1").toLowerCase())) : A.removeAttribute(B);
  }
}, MQ = function(Q, B, A, t, P, e) {
  var i = new BQ(Q._pt, B, A, 0, 1, e ? $t : _t);
  return Q._pt = i, i.b = t, i.e = P, Q._props.push(A), i;
}, Bt = {
  deg: 1,
  rad: 1,
  turn: 1
}, Ai = {
  grid: 1,
  flex: 1
}, fQ = function r(Q, B, A, t) {
  var P = parseFloat(A) || 0, e = (A + "").trim().substr((P + "").length) || "px", i = IQ.style, s = Se.test(B), v = Q.tagName.toLowerCase() === "svg", c = (v ? "client" : "offset") + (s ? "Width" : "Height"), n = 100, T = t === "px", z = t === "%", w, o, E, k;
  if (t === e || !P || Bt[t] || Bt[e])
    return P;
  if (e !== "px" && !T && (P = r(Q, B, A, "px")), k = Q.getCTM && PP(Q), (z || e === "%") && (CQ[B] || ~B.indexOf("adius")))
    return w = k ? Q.getBBox()[s ? "width" : "height"] : Q[c], V(z ? P / w * n : P / 100 * w);
  if (i[s ? "width" : "height"] = n + (T ? e : t), o = t !== "rem" && ~B.indexOf("adius") || t === "em" && Q.appendChild && !v ? Q : Q.parentNode, k && (o = (Q.ownerSVGElement || {}).parentNode), (!o || o === LQ || !o.appendChild) && (o = LQ.body), E = o._gsap, E && z && E.width && s && E.time === eQ.time && !E.uncache)
    return V(P / E.width * n);
  if (z && (B === "height" || B === "width")) {
    var a = Q.style[B];
    Q.style[B] = n + t, w = Q[c], a ? Q.style[B] = a : GQ(Q, B);
  } else
    (z || e === "%") && !Ai[rQ(o, "display")] && (i.position = rQ(Q, "position")), o === Q && (i.position = "static"), o.appendChild(IQ), w = IQ[c], o.removeChild(IQ), i.position = "absolute";
  return s && z && (E = SQ(o), E.time = eQ.time, E.width = o[c]), V(T ? w * P / n : w && P ? n / w * P : 0);
}, DQ = function(Q, B, A, t) {
  var P;
  return fA || hA(), B in hQ && B !== "transform" && (B = hQ[B], ~B.indexOf(",") && (B = B.split(",")[0])), CQ[B] && B !== "transform" ? (P = lB(Q, t), P = B !== "transformOrigin" ? P[B] : P.svg ? P.origin : bB(rQ(Q, AQ)) + " " + P.zOrigin + "px") : (P = Q.style[B], (!P || P === "auto" || t || ~(P + "").indexOf("calc(")) && (P = fB[B] && fB[B](Q, B, A) || rQ(Q, B) || Dt(Q, B) || (B === "opacity" ? 1 : 0))), A && !~(P + "").trim().indexOf(" ") ? fQ(Q, B, P, A) + A : P;
}, ti = function(Q, B, A, t) {
  if (!A || A === "none") {
    var P = tB(B, Q, 1), e = P && rQ(Q, P, 1);
    e && e !== A ? (B = P, A = e) : B === "borderColor" && (A = rQ(Q, "borderTopColor"));
  }
  var i = new BQ(this._pt, Q.style, B, 0, 1, Zt), s = 0, v = 0, c, n, T, z, w, o, E, k, a, U, D, l;
  if (i.b = A, i.e = t, A += "", t += "", t.substring(0, 6) === "var(--" && (t = rQ(Q, t.substring(4, t.indexOf(")")))), t === "auto" && (o = Q.style[B], Q.style[B] = t, t = rQ(Q, B) || t, o ? Q.style[B] = o : GQ(Q, B)), c = [A, t], It(c), A = c[0], t = c[1], T = A.match(KQ) || [], l = t.match(KQ) || [], l.length) {
    for (; n = KQ.exec(t); )
      E = n[0], a = t.substring(s, n.index), w ? w = (w + 1) % 5 : (a.substr(-5) === "rgba(" || a.substr(-5) === "hsla(") && (w = 1), E !== (o = T[v++] || "") && (z = parseFloat(o) || 0, D = o.substr((z + "").length), E.charAt(1) === "=" && (E = WQ(z, E) + D), k = parseFloat(E), U = E.substr((k + "").length), s = KQ.lastIndex - U.length, U || (U = U || sQ.units[B] || D, s === t.length && (t += U, i.e += U)), D !== U && (z = fQ(Q, B, o, U) || 0), i._pt = {
        _next: i._pt,
        p: a || v === 1 ? a : ",",
        //note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
        s: z,
        c: k - z,
        m: w && w < 4 || B === "zIndex" ? Math.round : 0
      });
    i.c = s < t.length ? t.substring(s, t.length) : "";
  } else
    i.r = B === "display" && t === "none" ? $t : _t;
  return at.test(t) && (i.e = 0), this._pt = i, i;
}, At = {
  top: "0%",
  bottom: "100%",
  left: "0%",
  right: "100%",
  center: "50%"
}, Pi = function(Q) {
  var B = Q.split(" "), A = B[0], t = B[1] || "50%";
  return (A === "top" || A === "bottom" || t === "left" || t === "right") && (Q = A, A = t, t = Q), B[0] = At[A] || A, B[1] = At[t] || t, B.join(" ");
}, ei = function(Q, B) {
  if (B.tween && B.tween._time === B.tween._dur) {
    var A = B.t, t = A.style, P = B.u, e = A._gsap, i, s, v;
    if (P === "all" || P === !0)
      t.cssText = "", s = 1;
    else
      for (P = P.split(","), v = P.length; --v > -1; )
        i = P[v], CQ[i] && (s = 1, i = i === "transformOrigin" ? AQ : S), GQ(A, i);
    s && (GQ(A, S), e && (e.svg && A.removeAttribute("transform"), t.scale = t.rotate = t.translate = "none", lB(A, 1), e.uncache = 1, QP(t)));
  }
}, fB = {
  clearProps: function(Q, B, A, t, P) {
    if (P.data !== "isFromStart") {
      var e = Q._pt = new BQ(Q._pt, B, A, 0, 0, ei);
      return e.u = t, e.pr = -10, e.tween = P, Q._props.push(A), 1;
    }
  }
  /* className feature (about 0.4kb gzipped).
  , className(plugin, target, property, endValue, tween) {
  	let _renderClassName = (ratio, data) => {
  			data.css.render(ratio, data.css);
  			if (!ratio || ratio === 1) {
  				let inline = data.rmv,
  					target = data.t,
  					p;
  				target.setAttribute("class", ratio ? data.e : data.b);
  				for (p in inline) {
  					_removeProperty(target, p);
  				}
  			}
  		},
  		_getAllStyles = (target) => {
  			let styles = {},
  				computed = getComputedStyle(target),
  				p;
  			for (p in computed) {
  				if (isNaN(p) && p !== "cssText" && p !== "length") {
  					styles[p] = computed[p];
  				}
  			}
  			_setDefaults(styles, _parseTransform(target, 1));
  			return styles;
  		},
  		startClassList = target.getAttribute("class"),
  		style = target.style,
  		cssText = style.cssText,
  		cache = target._gsap,
  		classPT = cache.classPT,
  		inlineToRemoveAtEnd = {},
  		data = {t:target, plugin:plugin, rmv:inlineToRemoveAtEnd, b:startClassList, e:(endValue.charAt(1) !== "=") ? endValue : startClassList.replace(new RegExp("(?:\\s|^)" + endValue.substr(2) + "(?![\\w-])"), "") + ((endValue.charAt(0) === "+") ? " " + endValue.substr(2) : "")},
  		changingVars = {},
  		startVars = _getAllStyles(target),
  		transformRelated = /(transform|perspective)/i,
  		endVars, p;
  	if (classPT) {
  		classPT.r(1, classPT.d);
  		_removeLinkedListItem(classPT.d.plugin, classPT, "_pt");
  	}
  	target.setAttribute("class", data.e);
  	endVars = _getAllStyles(target, true);
  	target.setAttribute("class", startClassList);
  	for (p in endVars) {
  		if (endVars[p] !== startVars[p] && !transformRelated.test(p)) {
  			changingVars[p] = endVars[p];
  			if (!style[p] && style[p] !== "0") {
  				inlineToRemoveAtEnd[p] = 1;
  			}
  		}
  	}
  	cache.classPT = plugin._pt = new PropTween(plugin._pt, target, "className", 0, 0, _renderClassName, data, 0, -11);
  	if (style.cssText !== cssText) { //only apply if things change. Otherwise, in cases like a background-image that's pulled dynamically, it could cause a refresh. See https://gsap.com/forums/topic/20368-possible-gsap-bug-switching-classnames-in-chrome/.
  		style.cssText = cssText; //we recorded cssText before we swapped classes and ran _getAllStyles() because in cases when a className tween is overwritten, we remove all the related tweening properties from that class change (otherwise class-specific stuff can't override properties we've directly set on the target's style object due to specificity).
  	}
  	_parseTransform(target, true); //to clear the caching of transforms
  	data.css = new gsap.plugins.css();
  	data.css.init(target, changingVars, tween);
  	plugin._props.push(...data.css._props);
  	return 1;
  }
  */
}, kB = [1, 0, 0, 1, 0, 0], eP = {}, iP = function(Q) {
  return Q === "matrix(1, 0, 0, 1, 0, 0)" || Q === "none" || !Q;
}, tt = function(Q) {
  var B = rQ(Q, S);
  return iP(B) ? kB : B.substr(7).match(Et).map(V);
}, pA = function(Q, B) {
  var A = Q._gsap || SQ(Q), t = Q.style, P = tt(Q), e, i, s, v;
  return A.svg && Q.getAttribute("transform") ? (s = Q.transform.baseVal.consolidate().matrix, P = [s.a, s.b, s.c, s.d, s.e, s.f], P.join(",") === "1,0,0,1,0,0" ? kB : P) : (P === kB && !Q.offsetParent && Q !== qQ && !A.svg && (s = t.display, t.display = "block", e = Q.parentNode, (!e || !Q.offsetParent && !Q.getBoundingClientRect().width) && (v = 1, i = Q.nextElementSibling, qQ.appendChild(Q)), P = tt(Q), s ? t.display = s : GQ(Q, "display"), v && (i ? e.insertBefore(Q, i) : e ? e.appendChild(Q) : qQ.removeChild(Q))), B && P.length > 6 ? [P[0], P[1], P[4], P[5], P[12], P[13]] : P);
}, kA = function(Q, B, A, t, P, e) {
  var i = Q._gsap, s = P || pA(Q, !0), v = i.xOrigin || 0, c = i.yOrigin || 0, n = i.xOffset || 0, T = i.yOffset || 0, z = s[0], w = s[1], o = s[2], E = s[3], k = s[4], a = s[5], U = B.split(" "), D = parseFloat(U[0]) || 0, l = parseFloat(U[1]) || 0, O, u, N, C;
  A ? s !== kB && (u = z * E - w * o) && (N = D * (E / u) + l * (-o / u) + (o * a - E * k) / u, C = D * (-w / u) + l * (z / u) - (z * a - w * k) / u, D = N, l = C) : (O = tP(Q), D = O.x + (~U[0].indexOf("%") ? D / 100 * O.width : D), l = O.y + (~(U[1] || U[0]).indexOf("%") ? l / 100 * O.height : l)), t || t !== !1 && i.smooth ? (k = D - v, a = l - c, i.xOffset = n + (k * z + a * o) - k, i.yOffset = T + (k * w + a * E) - a) : i.xOffset = i.yOffset = 0, i.xOrigin = D, i.yOrigin = l, i.smooth = !!t, i.origin = B, i.originIsAbsolute = !!A, Q.style[AQ] = "0px 0px", e && (MQ(e, i, "xOrigin", v, D), MQ(e, i, "yOrigin", c, l), MQ(e, i, "xOffset", n, i.xOffset), MQ(e, i, "yOffset", T, i.yOffset)), Q.setAttribute("data-svg-origin", D + " " + l);
}, lB = function(Q, B) {
  var A = Q._gsap || new Yt(Q);
  if ("x" in A && !B && !A.uncache)
    return A;
  var t = Q.style, P = A.scaleX < 0, e = "px", i = "deg", s = getComputedStyle(Q), v = rQ(Q, AQ) || "0", c, n, T, z, w, o, E, k, a, U, D, l, O, u, N, C, M, b, j, d, G, f, H, F, X, nQ, NQ, gQ, oQ, R, lQ, pQ;
  return c = n = T = o = E = k = a = U = D = 0, z = w = 1, A.svg = !!(Q.getCTM && PP(Q)), s.translate && ((s.translate !== "none" || s.scale !== "none" || s.rotate !== "none") && (t[S] = (s.translate !== "none" ? "translate3d(" + (s.translate + " 0 0").split(" ").slice(0, 3).join(", ") + ") " : "") + (s.rotate !== "none" ? "rotate(" + s.rotate + ") " : "") + (s.scale !== "none" ? "scale(" + s.scale.split(" ").join(",") + ") " : "") + (s[S] !== "none" ? s[S] : "")), t.scale = t.rotate = t.translate = "none"), u = pA(Q, A.svg), A.svg && (A.uncache ? (X = Q.getBBox(), v = A.xOrigin - X.x + "px " + (A.yOrigin - X.y) + "px", F = "") : F = !B && Q.getAttribute("data-svg-origin"), kA(Q, F || v, !!F || A.originIsAbsolute, A.smooth !== !1, u)), l = A.xOrigin || 0, O = A.yOrigin || 0, u !== kB && (b = u[0], j = u[1], d = u[2], G = u[3], c = f = u[4], n = H = u[5], u.length === 6 ? (z = Math.sqrt(b * b + j * j), w = Math.sqrt(G * G + d * d), o = b || j ? XQ(j, b) * yQ : 0, a = d || G ? XQ(d, G) * yQ + o : 0, a && (w *= Math.abs(Math.cos(a * _Q))), A.svg && (c -= l - (l * b + O * d), n -= O - (l * j + O * G))) : (pQ = u[6], R = u[7], NQ = u[8], gQ = u[9], oQ = u[10], lQ = u[11], c = u[12], n = u[13], T = u[14], N = XQ(pQ, oQ), E = N * yQ, N && (C = Math.cos(-N), M = Math.sin(-N), F = f * C + NQ * M, X = H * C + gQ * M, nQ = pQ * C + oQ * M, NQ = f * -M + NQ * C, gQ = H * -M + gQ * C, oQ = pQ * -M + oQ * C, lQ = R * -M + lQ * C, f = F, H = X, pQ = nQ), N = XQ(-d, oQ), k = N * yQ, N && (C = Math.cos(-N), M = Math.sin(-N), F = b * C - NQ * M, X = j * C - gQ * M, nQ = d * C - oQ * M, lQ = G * M + lQ * C, b = F, j = X, d = nQ), N = XQ(j, b), o = N * yQ, N && (C = Math.cos(N), M = Math.sin(N), F = b * C + j * M, X = f * C + H * M, j = j * C - b * M, H = H * C - f * M, b = F, f = X), E && Math.abs(E) + Math.abs(o) > 359.9 && (E = o = 0, k = 180 - k), z = V(Math.sqrt(b * b + j * j + d * d)), w = V(Math.sqrt(H * H + pQ * pQ)), N = XQ(f, H), a = Math.abs(N) > 2e-4 ? N * yQ : 0, D = lQ ? 1 / (lQ < 0 ? -lQ : lQ) : 0), A.svg && (F = Q.getAttribute("transform"), A.forceCSS = Q.setAttribute("transform", "") || !iP(rQ(Q, S)), F && Q.setAttribute("transform", F))), Math.abs(a) > 90 && Math.abs(a) < 270 && (P ? (z *= -1, a += o <= 0 ? 180 : -180, o += o <= 0 ? 180 : -180) : (w *= -1, a += a <= 0 ? 180 : -180)), B = B || A.uncache, A.x = c - ((A.xPercent = c && (!B && A.xPercent || (Math.round(Q.offsetWidth / 2) === Math.round(-c) ? -50 : 0))) ? Q.offsetWidth * A.xPercent / 100 : 0) + e, A.y = n - ((A.yPercent = n && (!B && A.yPercent || (Math.round(Q.offsetHeight / 2) === Math.round(-n) ? -50 : 0))) ? Q.offsetHeight * A.yPercent / 100 : 0) + e, A.z = T + e, A.scaleX = V(z), A.scaleY = V(w), A.rotation = V(o) + i, A.rotationX = V(E) + i, A.rotationY = V(k) + i, A.skewX = a + i, A.skewY = U + i, A.transformPerspective = D + e, (A.zOrigin = parseFloat(v.split(" ")[2]) || !B && A.zOrigin || 0) && (t[AQ] = bB(v)), A.xOffset = A.yOffset = 0, A.force3D = sQ.force3D, A.renderTransform = A.svg ? ri : AP ? rP : ii, A.uncache = 0, A;
}, bB = function(Q) {
  return (Q = Q.split(" "))[0] + " " + Q[1];
}, ZB = function(Q, B, A) {
  var t = W(B);
  return V(parseFloat(B) + parseFloat(fQ(Q, "x", A + "px", t))) + t;
}, ii = function(Q, B) {
  B.z = "0px", B.rotationY = B.rotationX = "0deg", B.force3D = 0, rP(Q, B);
}, xQ = "0deg", PB = "0px", mQ = ") ", rP = function(Q, B) {
  var A = B || this, t = A.xPercent, P = A.yPercent, e = A.x, i = A.y, s = A.z, v = A.rotation, c = A.rotationY, n = A.rotationX, T = A.skewX, z = A.skewY, w = A.scaleX, o = A.scaleY, E = A.transformPerspective, k = A.force3D, a = A.target, U = A.zOrigin, D = "", l = k === "auto" && Q && Q !== 1 || k === !0;
  if (U && (n !== xQ || c !== xQ)) {
    var O = parseFloat(c) * _Q, u = Math.sin(O), N = Math.cos(O), C;
    O = parseFloat(n) * _Q, C = Math.cos(O), e = ZB(a, e, u * C * -U), i = ZB(a, i, -Math.sin(O) * -U), s = ZB(a, s, N * C * -U + U);
  }
  E !== PB && (D += "perspective(" + E + mQ), (t || P) && (D += "translate(" + t + "%, " + P + "%) "), (l || e !== PB || i !== PB || s !== PB) && (D += s !== PB || l ? "translate3d(" + e + ", " + i + ", " + s + ") " : "translate(" + e + ", " + i + mQ), v !== xQ && (D += "rotate(" + v + mQ), c !== xQ && (D += "rotateY(" + c + mQ), n !== xQ && (D += "rotateX(" + n + mQ), (T !== xQ || z !== xQ) && (D += "skew(" + T + ", " + z + mQ), (w !== 1 || o !== 1) && (D += "scale(" + w + ", " + o + mQ), a.style[S] = D || "translate(0, 0)";
}, ri = function(Q, B) {
  var A = B || this, t = A.xPercent, P = A.yPercent, e = A.x, i = A.y, s = A.rotation, v = A.skewX, c = A.skewY, n = A.scaleX, T = A.scaleY, z = A.target, w = A.xOrigin, o = A.yOrigin, E = A.xOffset, k = A.yOffset, a = A.forceCSS, U = parseFloat(e), D = parseFloat(i), l, O, u, N, C;
  s = parseFloat(s), v = parseFloat(v), c = parseFloat(c), c && (c = parseFloat(c), v += c, s += c), s || v ? (s *= _Q, v *= _Q, l = Math.cos(s) * n, O = Math.sin(s) * n, u = Math.sin(s - v) * -T, N = Math.cos(s - v) * T, v && (c *= _Q, C = Math.tan(v - c), C = Math.sqrt(1 + C * C), u *= C, N *= C, c && (C = Math.tan(c), C = Math.sqrt(1 + C * C), l *= C, O *= C)), l = V(l), O = V(O), u = V(u), N = V(N)) : (l = n, N = T, O = u = 0), (U && !~(e + "").indexOf("px") || D && !~(i + "").indexOf("px")) && (U = fQ(z, "x", e, "px"), D = fQ(z, "y", i, "px")), (w || o || E || k) && (U = V(U + w - (w * l + o * u) + E), D = V(D + o - (w * O + o * N) + k)), (t || P) && (C = z.getBBox(), U = V(U + t / 100 * C.width), D = V(D + P / 100 * C.height)), C = "matrix(" + l + "," + O + "," + u + "," + N + "," + U + "," + D + ")", z.setAttribute("transform", C), a && (z.style[S] = C);
}, si = function(Q, B, A, t, P) {
  var e = 360, i = K(P), s = parseFloat(P) * (i && ~P.indexOf("rad") ? yQ : 1), v = s - t, c = t + v + "deg", n, T;
  return i && (n = P.split("_")[1], n === "short" && (v %= e, v !== v % (e / 2) && (v += v < 0 ? e : -e)), n === "cw" && v < 0 ? v = (v + e * qA) % e - ~~(v / e) * e : n === "ccw" && v > 0 && (v = (v - e * qA) % e - ~~(v / e) * e)), Q._pt = T = new BQ(Q._pt, B, A, t, v, Ve), T.e = c, T.u = "deg", Q._props.push(A), T;
}, Pt = function(Q, B) {
  for (var A in B)
    Q[A] = B[A];
  return Q;
}, vi = function(Q, B, A) {
  var t = Pt({}, A._gsap), P = "perspective,force3D,transformOrigin,svgOrigin", e = A.style, i, s, v, c, n, T, z, w;
  t.svg ? (v = A.getAttribute("transform"), A.setAttribute("transform", ""), e[S] = B, i = lB(A, 1), GQ(A, S), A.setAttribute("transform", v)) : (v = getComputedStyle(A)[S], e[S] = B, i = lB(A, 1), e[S] = v);
  for (s in CQ)
    v = t[s], c = i[s], v !== c && P.indexOf(s) < 0 && (z = W(v), w = W(c), n = z !== w ? fQ(A, s, v, w) : parseFloat(v), T = parseFloat(c), Q._pt = new BQ(Q._pt, i, s, n, T - n, EA), Q._pt.u = w || 0, Q._props.push(s));
  Pt(i, t);
};
QQ("padding,margin,Width,Radius", function(r, Q) {
  var B = "Top", A = "Right", t = "Bottom", P = "Left", e = (Q < 3 ? [B, A, t, P] : [B + P, B + A, t + A, t + P]).map(function(i) {
    return Q < 2 ? r + i : "border" + i + r;
  });
  fB[Q > 1 ? "border" + r : r] = function(i, s, v, c, n) {
    var T, z;
    if (arguments.length < 4)
      return T = e.map(function(w) {
        return DQ(i, w, v);
      }), z = T.join(" "), z.split(T[0]).length === 5 ? T[0] : z;
    T = (c + "").split(" "), z = {}, e.forEach(function(w, o) {
      return z[w] = T[o] = T[o] || T[(o - 1) / 2 | 0];
    }), i.init(s, z, n);
  };
});
var sP = {
  name: "css",
  register: hA,
  targetTest: function(Q) {
    return Q.style && Q.nodeType;
  },
  init: function(Q, B, A, t, P) {
    var e = this._props, i = Q.style, s = A.vars.startAt, v, c, n, T, z, w, o, E, k, a, U, D, l, O, u, N, C;
    fA || hA(), this.styles = this.styles || BP(Q), N = this.styles.props, this.tween = A;
    for (o in B)
      if (o !== "autoRound" && (c = B[o], !(PQ[o] && Vt(o, B, A, t, Q, P)))) {
        if (z = typeof c, w = fB[o], z === "function" && (c = c.call(A, t, Q, P), z = typeof c), z === "string" && ~c.indexOf("random(") && (c = EB(c)), w)
          w(this, Q, o, c, A) && (u = 1);
        else if (o.substr(0, 2) === "--")
          v = (getComputedStyle(Q).getPropertyValue(o) + "").trim(), c += "", jQ.lastIndex = 0, jQ.test(v) || (E = W(v), k = W(c), k ? E !== k && (v = fQ(Q, o, v, k) + k) : E && (c += E)), this.add(i, "setProperty", v, c, t, P, 0, 0, o), e.push(o), N.push(o, 0, i[o]);
        else if (z !== "undefined") {
          if (s && o in s ? (v = typeof s[o] == "function" ? s[o].call(A, t, Q, P) : s[o], K(v) && ~v.indexOf("random(") && (v = EB(v)), W(v + "") || v === "auto" || (v += sQ.units[o] || W(DQ(Q, o)) || ""), (v + "").charAt(1) === "=" && (v = DQ(Q, o))) : v = DQ(Q, o), T = parseFloat(v), a = z === "string" && c.charAt(1) === "=" && c.substr(0, 2), a && (c = c.substr(2)), n = parseFloat(c), o in hQ && (o === "autoAlpha" && (T === 1 && DQ(Q, "visibility") === "hidden" && n && (T = 0), N.push("visibility", 0, i.visibility), MQ(this, i, "visibility", T ? "inherit" : "hidden", n ? "inherit" : "hidden", !n)), o !== "scale" && o !== "transform" && (o = hQ[o], ~o.indexOf(",") && (o = o.split(",")[0]))), U = o in CQ, U) {
            if (this.styles.save(o), C = c, z === "string" && c.substring(0, 6) === "var(--") {
              if (c = rQ(Q, c.substring(4, c.indexOf(")"))), c.substring(0, 5) === "calc(") {
                var M = Q.style.perspective;
                Q.style.perspective = c, c = rQ(Q, "perspective"), M ? Q.style.perspective = M : GQ(Q, "perspective");
              }
              n = parseFloat(c);
            }
            if (D || (l = Q._gsap, l.renderTransform && !B.parseTransform || lB(Q, B.parseTransform), O = B.smoothOrigin !== !1 && l.smooth, D = this._pt = new BQ(this._pt, i, S, 0, 1, l.renderTransform, l, 0, -1), D.dep = 1), o === "scale")
              this._pt = new BQ(this._pt, l, "scaleY", l.scaleY, (a ? WQ(l.scaleY, a + n) : n) - l.scaleY || 0, EA), this._pt.u = 0, e.push("scaleY", o), o += "X";
            else if (o === "transformOrigin") {
              N.push(AQ, 0, i[AQ]), c = Pi(c), l.svg ? kA(Q, c, 0, O, 0, this) : (k = parseFloat(c.split(" ")[2]) || 0, k !== l.zOrigin && MQ(this, l, "zOrigin", l.zOrigin, k), MQ(this, i, o, bB(v), bB(c)));
              continue;
            } else if (o === "svgOrigin") {
              kA(Q, c, 1, O, 0, this);
              continue;
            } else if (o in eP) {
              si(this, l, o, T, a ? WQ(T, a + c) : c);
              continue;
            } else if (o === "smoothOrigin") {
              MQ(this, l, "smooth", l.smooth, c);
              continue;
            } else if (o === "force3D") {
              l[o] = c;
              continue;
            } else if (o === "transform") {
              vi(this, c, Q);
              continue;
            }
          } else o in i || (o = tB(o) || o);
          if (U || (n || n === 0) && (T || T === 0) && !Ye.test(c) && o in i)
            E = (v + "").substr((T + "").length), n || (n = 0), k = W(c) || (o in sQ.units ? sQ.units[o] : E), E !== k && (T = fQ(Q, o, v, k)), this._pt = new BQ(this._pt, U ? l : i, o, T, (a ? WQ(T, a + n) : n) - T, !U && (k === "px" || o === "zIndex") && B.autoRound !== !1 ? Xe : EA), this._pt.u = k || 0, U && C !== c ? (this._pt.b = v, this._pt.e = C, this._pt.r = Re) : E !== k && k !== "%" && (this._pt.b = v, this._pt.r = Je);
          else if (o in i)
            ti.call(this, Q, o, v, a ? a + c : c);
          else if (o in Q)
            this.add(Q, o, v || Q[o], a ? a + c : c, t, P);
          else if (o !== "parseTransform") {
            CA(o, c);
            continue;
          }
          U || (o in i ? N.push(o, 0, i[o]) : typeof Q[o] == "function" ? N.push(o, 2, Q[o]()) : N.push(o, 1, v || Q[o])), e.push(o);
        }
      }
    u && Wt(this);
  },
  render: function(Q, B) {
    if (B.tween._time || !bA())
      for (var A = B._pt; A; )
        A.r(Q, A.d), A = A._next;
    else
      B.styles.revert();
  },
  get: DQ,
  aliases: hQ,
  getSetter: function(Q, B, A) {
    var t = hQ[B];
    return t && t.indexOf(",") < 0 && (B = t), B in CQ && B !== AQ && (Q._gsap.x || DQ(Q, "x")) ? A && WA === A ? B === "scale" ? qe : We : (WA = A || {}) && (B === "scale" ? _e : $e) : Q.style && !UA(Q.style[B]) ? Ke : ~B.indexOf("-") ? Ze : FA(Q, B);
  },
  core: {
    _removeProperty: GQ,
    _getMatrix: pA
  }
};
tQ.utils.checkPrefix = tB;
tQ.core.getStyleSaver = BP;
(function(r, Q, B, A) {
  var t = QQ(r + "," + Q + "," + B, function(P) {
    CQ[P] = 1;
  });
  QQ(Q, function(P) {
    sQ.units[P] = "deg", eP[P] = 1;
  }), hQ[t[13]] = r + "," + Q, QQ(A, function(P) {
    var e = P.split(":");
    hQ[e[1]] = t[e[0]];
  });
})("x,y,z,scale,scaleX,scaleY,xPercent,yPercent", "rotation,rotationX,rotationY,skewX,skewY", "transform,transformOrigin,svgOrigin,force3D,smoothOrigin,transformPerspective", "0:translateX,1:translateY,2:translateZ,8:rotate,8:rotationZ,8:rotateZ,9:rotateX,10:rotateY");
QQ("x,y,z,top,right,bottom,left,width,height,fontSize,padding,margin,perspective", function(r) {
  sQ.units[r] = "px";
});
tQ.registerPlugin(sP);
var LB = tQ.registerPlugin(sP) || tQ;
LB.core.Tween;
const ci = "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", et = 0.3, vP = "#c9883d", ni = "#eef1f4", it = "#a855f7";
function DB(r) {
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}
function oi(r) {
  const Q = DB(r);
  return 1 - Math.pow(1 - Q, 3);
}
function Ti(r) {
  const Q = Math.max(1e-3, r), B = Q * 1.6, A = Q * 0.7, t = new h.ConeGeometry(A, B, 3, 1, !1);
  return t.rotateX(-Math.PI / 2), t.translate(0, 0, B / 2), t;
}
function zi(r) {
  const B = Math.max(1e-3, r) * 0.65, A = new h.SphereGeometry(B, 18, 12);
  return A.translate(0, 0, B), A;
}
function wi(r, Q) {
  r.computeBoundingBox();
  const B = r.boundingBox, A = Math.max(1e-6, B.max.z - B.min.z), t = r.getAttribute("position"), P = new Float32Array(t.count * 2);
  for (let e = 0; e < t.count; e++) {
    const i = t.getX(e), s = t.getY(e), v = t.getZ(e);
    P[e * 2] = Math.atan2(s, i) / (2 * Math.PI) + 0.5, P[e * 2 + 1] = (v - B.min.z) / A * Q;
  }
  r.setAttribute("uv", new h.BufferAttribute(P, 2));
}
function cP(r) {
  const Q = atob(ci), B = new Uint8Array(Q.length);
  for (let v = 0; v < Q.length; v++) B[v] = Q.charCodeAt(v);
  const t = new aP().parse(B.buffer);
  t.rotateX(-Math.PI / 2), t.computeBoundingBox();
  const P = t.boundingBox, e = new h.Vector3();
  P.getSize(e);
  const i = Math.max(1e-3, r) * 1.6 / Math.max(e.x, e.y, e.z, 1e-3);
  t.scale(i, i, i), t.computeBoundingBox();
  const s = t.boundingBox;
  return t.translate(
    -(s.min.x + s.max.x) / 2,
    -(s.min.y + s.max.y) / 2,
    -s.min.z
  ), wi(t, 6), t.computeVertexNormals(), t;
}
let WB = null;
function Ei() {
  if (WB) return WB;
  const r = 64, Q = 256, B = document.createElement("canvas");
  B.width = r, B.height = Q;
  const A = B.getContext("2d");
  A.fillStyle = "#808080", A.fillRect(0, 0, r, Q);
  const t = 10;
  for (let i = 0; i < t; i++) {
    const s = i / t * r, v = i % 2 === 0 ? 150 : 90;
    A.fillStyle = `rgb(${v},${v},${v})`, A.fillRect(s, 0, r / t / 2, Q);
  }
  const P = A.getImageData(0, 0, r, Q);
  for (let i = 0; i < P.data.length; i += 4) {
    const s = (Math.random() - 0.5) * 40;
    P.data[i] = Math.min(255, Math.max(0, P.data[i] + s)), P.data[i + 1] = P.data[i], P.data[i + 2] = P.data[i];
  }
  A.putImageData(P, 0, 0);
  const e = new h.CanvasTexture(B);
  return e.wrapS = h.RepeatWrapping, e.wrapT = h.RepeatWrapping, WB = e, e;
}
function ai(r, Q) {
  const B = Math.max(1e-3, r), A = B * 3, t = B * 0.15, P = B * 0.35, e = DB(Q), i = new h.CylinderGeometry(0, t, A, 8, 1, !1);
  i.rotateX(-Math.PI / 2), i.translate(0, 0, A / 2);
  const s = new h.CylinderGeometry(0, P, A, 8, 1, !0);
  s.rotateX(-Math.PI / 2), s.translate(0, 0, A / 2);
  const v = new h.MeshBasicMaterial({
    color: new h.Color(it),
    transparent: !0,
    opacity: e,
    depthTest: !1,
    depthWrite: !1,
    blending: h.AdditiveBlending
  }), c = new h.MeshBasicMaterial({
    color: new h.Color(it),
    transparent: !0,
    opacity: e * 0.3,
    depthTest: !1,
    depthWrite: !1,
    blending: h.AdditiveBlending,
    side: h.DoubleSide
  }), n = new h.Mesh(i, v);
  n.renderOrder = 1e3;
  const T = new h.Mesh(s, c);
  T.renderOrder = 1e3;
  const z = new h.Group();
  return z.add(n), z.add(T), z;
}
function hi(r) {
  const Q = Math.max(1e-3, r.bit.size);
  return r.bit.type === "triangle" ? Ti(Q) : r.bit.type === "drill" ? cP(Q) : zi(Q);
}
function nP(r) {
  return r.bit.colorSource === "custom" ? r.bit.color : ni;
}
function ki(r) {
  const Q = DB(r.bit.opacity), B = cP(Math.max(1e-3, r.bit.size)), A = new h.Color(nP(r)), t = Ei(), P = new h.MeshStandardMaterial({
    color: A,
    metalness: 0.8,
    roughness: 0.35,
    roughnessMap: t,
    bumpMap: t,
    bumpScale: 0.03,
    // Self-illuminate slightly so the bit stays legible as a UI marker
    // regardless of viewing angle/lighting, matching the old visualizer's
    // brighter, always-visible look.
    emissive: A,
    emissiveIntensity: 0.12,
    transparent: Q < 1,
    opacity: Q,
    depthTest: !1,
    depthWrite: !1
  }), e = new h.Mesh(B, P);
  return e.renderOrder = 1e3, e;
}
function li(r) {
  const Q = DB(r.bit.opacity), B = hi(r), A = new h.MeshBasicMaterial({
    color: new h.Color(vP),
    transparent: Q < 1,
    opacity: Q,
    side: h.DoubleSide,
    depthTest: !1,
    depthWrite: !1
  }), t = new h.Mesh(B, A);
  return t.renderOrder = 1e3, t;
}
function rt(r) {
  return r.bit.type === "laser" ? ai(r.bit.size, r.bit.opacity) : r.bit.type === "drill" ? ki(r) : li(r);
}
function st(r) {
  if (r instanceof h.Mesh)
    r.geometry.dispose(), r.material.dispose();
  else if (r instanceof h.Group)
    for (const Q of r.children)
      Q instanceof h.Mesh && (Q.geometry.dispose(), Q.material.dispose());
}
function Ui(r) {
  const Q = new h.Group();
  Q.name = "gviewer:bit-marker", Q.visible = !!r.bit.enabled;
  let B = r, A = rt(B);
  Q.add(A);
  let t = null, P = !1, e = null, i = null;
  const s = (n) => {
    const T = Math.max(1, n);
    return LB.to(A.rotation, {
      z: `+=${Math.PI * 2}`,
      duration: 60 / T,
      repeat: -1,
      ease: "none",
      paused: !0
    });
  };
  e = s(B.bit.spinRpm);
  const v = (n) => {
    const T = n.bit.type, z = B.bit.type, w = n.bit.size, o = B.bit.size, E = T !== z, k = w !== o, a = DB(n.bit.opacity);
    if (E || k)
      Q.remove(A), st(A), A = rt(n), Q.add(A), i == null || i.kill(), e == null || e.kill(), e = s(n.bit.spinRpm), P && e.timeScale(1).play();
    else if (T === "laser") {
      const D = A, [l, O] = D.children, u = l.material, N = O.material;
      u.opacity = a, u.needsUpdate = !0, N.opacity = a * 0.3, N.needsUpdate = !0;
    } else {
      const l = A.material, O = new h.Color(T === "drill" ? nP(n) : vP);
      l.color = O, T === "drill" && (l.emissive = O), l.opacity = a, l.transparent = a < 1, l.needsUpdate = !0;
    }
    B = n, Q.visible = !!n.bit.enabled;
  };
  return {
    object: Q,
    setVisible: (n) => {
      Q.visible = !!n;
    },
    setOptions: (n) => v(n),
    setTarget: (n, T) => {
      const z = !!(T != null && T.immediate), w = Number(n.x) || 0, o = Number(n.y) || 0, E = Number(n.z) || 0;
      if (n.a, z || B.bit.tweenMs <= 0) {
        t = null, Q.position.set(w, o, E);
        return;
      }
      t = {
        startedAt: performance.now(),
        duration: Math.max(1, B.bit.tweenMs),
        from: { x: Q.position.x, y: Q.position.y, z: Q.position.z },
        to: { x: w, y: o, z: E }
      };
    },
    setSpinning: (n) => {
      const T = !!n;
      if (T !== P)
        if (P = T, i == null || i.kill(), P)
          e == null || e.play(), i = LB.to(e, {
            timeScale: 1,
            duration: et,
            ease: "power1.out"
          });
        else {
          const z = e;
          i = LB.to(e, {
            timeScale: 0,
            duration: et,
            ease: "power1.in",
            onComplete: () => z == null ? void 0 : z.pause()
          });
        }
    },
    update: (n) => {
      if (!t) return;
      const T = (n - t.startedAt) / t.duration, z = oi(T);
      Q.position.set(
        h.MathUtils.lerp(t.from.x, t.to.x, z),
        h.MathUtils.lerp(t.from.y, t.to.y, z),
        h.MathUtils.lerp(t.from.z, t.to.z, z)
      ), T >= 1 && (Q.position.set(t.to.x, t.to.y, t.to.z), t = null);
    },
    dispose: () => {
      i == null || i.kill(), e == null || e.kill(), Q.remove(A), st(A);
    }
  };
}
const Di = 25.4;
class Hi {
  constructor(Q) {
    this.viewCube = null, this.resizeObserver = null, this.onWindowResize = null, this.animationFrameId = null, this.gridGroup = null, this.axesGroup = null, this.gridLabelsGroup = null, this.boundingBoxGroup = null, this.bitMarker = null, this.preLaserBitType = "drill", this.toolpathStreams = [], this.toolpathCutBucketCount = 1, this.toolpathRotationA = 0, this.sim3dHandle = null, this.currentLines = [], this.linePositions = null, this.renderSequence = 0, this.currentBounds = null, this.cameraFocusTransition = null, this.id = Q.id, this.container = Q.container, this.callbacks = Q.callbacks ?? {}, this.options = ct(NP, Q.options), this.canvas = document.createElement("canvas"), this.canvas.style.width = "100%", this.canvas.style.height = "100%", this.canvas.style.display = "block", this.container.appendChild(this.canvas), pP(this.container), this.renderer = new h.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.options.render.antialias
    }), this.renderer.setPixelRatio(window.devicePixelRatio), this.renderer.setClearColor(this.options.render.theme.background, 1), this.scene = new h.Scene(), this.scene.add(new h.AmbientLight(16777215, 0.8));
    const B = new h.DirectionalLight(16777215, 0.9);
    B.position.set(1, -1, 1.5), this.scene.add(B);
    const A = new h.DirectionalLight(16777215, 0.5);
    A.position.set(-1, 1, 1), this.scene.add(A), this.toolpathRoot = new h.Group(), this.toolpathRoot.name = "gviewer:toolpath-root", this.scene.add(this.toolpathRoot), this.camera = new h.PerspectiveCamera(this.options.camera.fov, 1, 0.1, 1e5), this.camera.up.set(0, 0, 1), this.camera.position.set(
      this.options.camera.initialPosition.x,
      this.options.camera.initialPosition.y,
      this.options.camera.initialPosition.z
    ), this.controls = new oP(this.camera, this.renderer.domElement), this.controls.enableDamping = this.options.camera.orbit.enableDamping, this.controls.update(), this.viewCubeCorrection = new h.Matrix4().makeRotationX(h.MathUtils.degToRad(90)), this.viewCube = new jP({
      container: this.container,
      onSelectView: (t) => {
        const P = new h.Vector3();
        let e;
        if (this.currentBounds) {
          this.currentBounds.getCenter(P);
          const i = new h.Vector3();
          this.currentBounds.getSize(i);
          const s = Math.max(i.x, i.y, 1) / 2, v = h.MathUtils.degToRad(this.camera.fov);
          e = s / Math.tan(v / 2) * 1.25 + i.z;
        } else
          e = this.camera.position.distanceTo(this.controls.target);
        this.startSnapToView(t, P, Math.max(1e-6, e), 400);
      }
    }), typeof ResizeObserver < "u" ? (this.resizeObserver = new ResizeObserver(() => this.resize()), this.resizeObserver.observe(this.container)) : (this.onWindowResize = () => this.resize(), window.addEventListener("resize", this.onWindowResize)), this.renderGridAndAxes(), this.refreshGridLabels(), this.refreshBoundingBox(), this.ensureBitMarker(), this.resize(), this.startAnimationLoop();
  }
  setBitPosition(Q, B) {
    var A;
    this.ensureBitMarker(), (A = this.bitMarker) == null || A.setTarget(Q, B);
  }
  setBitVisible(Q) {
    var B;
    this.ensureBitMarker(), (B = this.bitMarker) == null || B.setVisible(Q);
  }
  setBitSpinning(Q) {
    var B;
    this.ensureBitMarker(), (B = this.bitMarker) == null || B.setSpinning(Q);
  }
  setToolpathRotationA(Q) {
    const B = Number(Q) || 0;
    this.toolpathRotationA = B, this.toolpathRoot.rotation.x = h.MathUtils.degToRad(B);
  }
  setCallbacks(Q) {
    this.callbacks = Q;
  }
  hideUntilLine(Q, B) {
    const A = B ?? this.options.progress.mode, t = Math.floor(Q);
    for (const P of this.toolpathStreams) {
      const e = t < 0 ? 0 : P.prefixEndVertex[Math.min(t, P.prefixEndVertex.length - 1)];
      A === "grey" ? (P.line.geometry.setDrawRange(0, P.totalVertices), DP({ stream: P, nextCursorVertex: e, options: this.options })) : P.line.geometry.setDrawRange(e, Math.max(0, P.totalVertices - e));
    }
  }
  seekToLine(Q, B) {
    if (this.hideUntilLine(Q, B), this.linePositions && this.currentLines.length > 0) {
      const A = Math.max(0, Math.min(Math.floor(Q), this.currentLines.length - 1)), t = {
        x: this.linePositions[A * 4],
        y: this.linePositions[A * 4 + 1],
        z: this.linePositions[A * 4 + 2],
        a: this.linePositions[A * 4 + 3]
      };
      this.setBitPosition(t, { immediate: !0 });
    }
    if (this.sim3dHandle) {
      const A = Math.max(0, Math.min(Math.floor(Q), this.currentLines.length - 1));
      if (A !== this.sim3dHandle.currentLine) {
        const t = mB(A, this.sim3dHandle.data);
        yB(t, this.sim3dHandle.data.resolution, this.options.sim3d.erosionPasses, this.sim3dHandle.data.slabBounds.zTop), IB(this.sim3dHandle.slab, t), this.sim3dHandle.currentLine = A;
      }
    }
  }
  showAll() {
    for (const Q of this.toolpathStreams)
      Q.line.geometry.setDrawRange(0, Q.totalVertices);
  }
  resetColors() {
    for (const Q of this.toolpathStreams) {
      Q.greyCursorVertex = 0, Q.simColors.set(Q.baseColors);
      const B = Q.line.geometry.getAttribute("color");
      B.clearUpdateRanges(), B.addUpdateRange(0, Q.simColors.length), B.needsUpdate = !0;
    }
  }
  snapCameraToView(Q, B = {}) {
    const A = Math.max(0, Math.floor(B.durationMs ?? 240)), t = this.controls.target.clone(), P = this.camera.position.distanceTo(t), e = Math.max(1e-6, B.distance ?? P);
    this.startSnapToView(Q, t, e, A);
  }
  startSnapToView(Q, B, A, t) {
    const P = mA(Q), e = B.clone().add(P.multiplyScalar(A)), i = Math.max(1, A);
    this.camera.near = i / 1e3, this.camera.far = i * 50, this.camera.updateProjectionMatrix(), this.cameraFocusTransition && (this.controls.enableDamping = this.cameraFocusTransition.dampingEnabled), this.cameraFocusTransition = {
      startedAt: performance.now(),
      duration: t,
      fromPosition: this.camera.position.clone(),
      toPosition: e,
      fromTarget: this.controls.target.clone(),
      toTarget: B,
      dampingEnabled: this.controls.enableDamping
    }, this.controls.enableDamping = !1;
  }
  async loadFromUrl(Q, B = {}) {
    this.emitProgress({ state: "indeterminate", label: "Loading file..." });
    const A = await fetch(Q, { signal: B.signal });
    if (!A.ok)
      throw this.emitProgress({ state: "hidden" }), new Error(`Failed to load gcode: ${A.statusText}`);
    const t = await A.text();
    await this.loadFromText(t);
  }
  async loadFromFile(Q) {
    this.emitProgress({ state: "indeterminate", label: "Loading file..." });
    const B = await Q.text();
    await this.loadFromText(B);
  }
  async loadFromText(Q) {
    await this.loadFromLines(Q.split(/\r?\n/));
  }
  async loadFromLines(Q) {
    this.currentLines = Array.from(Q), await this.renderScene();
  }
  async loadFromWorkerData(Q) {
    this.currentLines = [];
    const { rapid: B, cut: A } = TP(Q);
    this.setToolpathGeometry({
      rapid: {
        positions: B.positions,
        prefixEndVertex: B.prefixEndVertex
      },
      cuts: [{
        positions: A.positions,
        prefixEndVertex: A.prefixEndVertex
      }],
      cutBucketCount: 1
    }), this.focusToModel();
  }
  unload() {
    this.currentLines = [], this.setGeometryEmpty(), this.emitProgress({ state: "hidden" });
  }
  setOptions(Q) {
    var c, n;
    const B = this.options;
    this.options = ct(this.options, Q), (B.render.antialias !== this.options.render.antialias || B.render.theme.background !== this.options.render.theme.background) && this.renderer.setClearColor(this.options.render.theme.background, 1), (B.render.theme.opacity !== this.options.render.theme.opacity || B.render.theme.rapidOpacity !== this.options.render.theme.rapidOpacity) && this.refreshToolpathOpacities(), B.camera.fov !== this.options.camera.fov && (this.camera.fov = this.options.camera.fov, this.camera.updateProjectionMatrix()), B.camera.orbit.enableDamping !== this.options.camera.orbit.enableDamping && (this.controls.enableDamping = this.options.camera.orbit.enableDamping);
    const A = B.units !== this.options.units || B.grid.size !== this.options.grid.size || B.grid.axisDepth !== this.options.grid.axisDepth, t = B.render.theme.colors.grid.major !== this.options.render.theme.colors.grid.major || B.render.theme.colors.grid.minor !== this.options.render.theme.colors.grid.minor || B.render.theme.colors.axes.x !== this.options.render.theme.colors.axes.x || B.render.theme.colors.axes.y !== this.options.render.theme.colors.axes.y || B.render.theme.colors.axes.z !== this.options.render.theme.colors.axes.z;
    (A || t) && this.renderGridAndAxes(), (B.grid.labels !== this.options.grid.labels || B.units !== this.options.units || B.grid.size !== this.options.grid.size || t) && this.refreshGridLabels(), (B.boundingBox.visible !== this.options.boundingBox.visible || B.boundingBox.labels !== this.options.boundingBox.labels || B.units !== this.options.units || B.render.theme.colors.boundingBox !== this.options.render.theme.colors.boundingBox) && this.refreshBoundingBox();
    const i = B.render.theme.colors.rapid !== this.options.render.theme.colors.rapid || B.render.theme.colors.cutting !== this.options.render.theme.colors.cutting || B.render.theme.colors.laser !== this.options.render.theme.colors.laser || B.render.theme.background !== this.options.render.theme.background || B.render.theme.colors.processed !== this.options.render.theme.colors.processed;
    if (i && this.refreshToolpathColors(), (B.bit.enabled !== this.options.bit.enabled || B.bit.type !== this.options.bit.type || B.bit.size !== this.options.bit.size || B.bit.opacity !== this.options.bit.opacity || B.bit.colorSource !== this.options.bit.colorSource || B.bit.color !== this.options.bit.color || i) && (this.ensureBitMarker(), (c = this.bitMarker) == null || c.setOptions(this.options)), B.mode.laser !== this.options.mode.laser && (this.options.mode.laser ? this.options.bit.type !== "laser" && (this.preLaserBitType = this.options.bit.type, this.options = { ...this.options, bit: { ...this.options.bit, type: "laser" } }) : this.options = { ...this.options, bit: { ...this.options.bit, type: this.preLaserBitType } }, this.ensureBitMarker(), (n = this.bitMarker) == null || n.setOptions(this.options), this.renderScene()), B.mode.sim3d !== this.options.mode.sim3d)
      if (!this.options.mode.sim3d)
        this.setSim3dHandle(null), this.setToolpathStreamsVisible(!0);
      else {
        this.renderScene();
        return;
      }
    if ((B.sim3d.toolDiameter !== this.options.sim3d.toolDiameter || B.sim3d.resolution !== this.options.sim3d.resolution) && this.options.mode.sim3d) {
      this.renderScene();
      return;
    }
    if (B.sim3d.erosionPasses !== this.options.sim3d.erosionPasses && this.sim3dHandle) {
      const T = this.sim3dHandle.currentLine, z = mB(T, this.sim3dHandle.data);
      yB(z, this.sim3dHandle.data.resolution, this.options.sim3d.erosionPasses, this.sim3dHandle.data.slabBounds.zTop), IB(this.sim3dHandle.slab, z);
    }
    B.sim3d.showToolpath !== this.options.sim3d.showToolpath && this.options.mode.sim3d && this.setToolpathStreamsVisible(this.options.sim3d.showToolpath);
  }
  getOptions() {
    return this.options;
  }
  resize() {
    const Q = this.container.getBoundingClientRect(), B = Math.max(
      1,
      Math.floor(Q.width || this.container.clientWidth || window.innerWidth)
    ), A = Math.max(
      1,
      Math.floor(Q.height || this.container.clientHeight || window.innerHeight)
    );
    this.renderer.setSize(B, A, !1), this.camera.aspect = B / A, this.camera.updateProjectionMatrix();
  }
  focusToModel() {
    this.currentBounds && this.startCameraFocus(this.currentBounds);
  }
  resetCamera() {
    this.cameraFocusTransition = null, this.controls.enableDamping = this.options.camera.orbit.enableDamping, this.controls.target.set(0, 0, 0), this.camera.position.set(
      this.options.camera.initialPosition.x,
      this.options.camera.initialPosition.y,
      this.options.camera.initialPosition.z
    ), this.controls.update();
  }
  getBounds() {
    return this.currentBounds ? {
      min: {
        x: this.currentBounds.min.x,
        y: this.currentBounds.min.y,
        z: this.currentBounds.min.z
      },
      max: {
        x: this.currentBounds.max.x,
        y: this.currentBounds.max.y,
        z: this.currentBounds.max.z
      }
    } : null;
  }
  dispose() {
    var Q;
    this.renderSequence += 1, this.animationFrameId !== null && (cancelAnimationFrame(this.animationFrameId), this.animationFrameId = null), this.resizeObserver && (this.resizeObserver.disconnect(), this.resizeObserver = null), this.onWindowResize && (window.removeEventListener("resize", this.onWindowResize), this.onWindowResize = null), this.setGeometryEmpty(), this.setGridGroup(null), this.setAxesGroup(null), this.setGridLabelsGroup(null), this.setBoundingBoxGroup(null), this.setBitMarker(null), this.controls.dispose(), this.renderer.dispose(), (Q = this.viewCube) == null || Q.dispose(), this.viewCube = null, this.container.removeChild(this.canvas);
  }
  emitProgress(Q) {
    var B, A;
    (A = (B = this.callbacks).onProgress) == null || A.call(B, { id: this.id, ...Q });
  }
  emitBoundsChanged() {
    var Q, B;
    (B = (Q = this.callbacks).onBoundsChanged) == null || B.call(Q, { id: this.id, bounds: this.getBounds() });
  }
  startAnimationLoop() {
    const Q = () => {
      var A;
      this.animationFrameId = requestAnimationFrame(Q);
      const B = performance.now();
      this.controls.update(), this.updateCameraFocusTransition(), this.updateViewCubeRotation(), (A = this.bitMarker) == null || A.update(B), this.renderer.render(this.scene, this.camera);
    };
    Q();
  }
  ensureBitMarker() {
    this.bitMarker || (this.bitMarker = Ui(this.options), this.scene.add(this.bitMarker.object));
  }
  worldSizes() {
    const Q = this.options.units === "in" ? Di : 1;
    return {
      sizeMm: Math.max(1, this.options.grid.size * Q),
      axisDepthMm: Math.max(1, this.options.grid.axisDepth * Q)
    };
  }
  renderGridAndAxes() {
    const { sizeMm: Q, axisDepthMm: B } = this.worldSizes();
    this.setGridGroup(
      yP({
        units: this.options.units,
        sizeMm: Q,
        theme: this.options.render.theme
      })
    ), this.setAxesGroup(SP({ sizeWorld: Q, depthWorld: B, theme: this.options.render.theme }));
  }
  refreshGridLabels() {
    if (!this.options.grid.labels) {
      this.setGridLabelsGroup(null);
      return;
    }
    const { sizeMm: Q } = this.worldSizes();
    this.setGridLabelsGroup(
      VP({ sizeMm: Q, units: this.options.units, theme: this.options.render.theme })
    );
  }
  refreshBoundingBox() {
    if (!this.options.boundingBox.visible || !this.currentBounds) {
      this.setBoundingBoxGroup(null);
      return;
    }
    this.setBoundingBoxGroup(fP(this.currentBounds, this.options));
  }
  setBitMarker(Q) {
    this.bitMarker && (this.scene.remove(this.bitMarker.object), this.bitMarker.dispose()), this.bitMarker = Q, this.bitMarker && this.scene.add(this.bitMarker.object);
  }
  setGridGroup(Q) {
    this.gridGroup && (this.scene.remove(this.gridGroup), IP(this.gridGroup), this.gridGroup = null), Q && (this.gridGroup = Q, this.scene.add(Q));
  }
  setAxesGroup(Q) {
    this.axesGroup && (this.scene.remove(this.axesGroup), YP(this.axesGroup), this.axesGroup = null), Q && (this.axesGroup = Q, this.scene.add(Q));
  }
  setGridLabelsGroup(Q) {
    this.gridLabelsGroup && (this.scene.remove(this.gridLabelsGroup), FP(this.gridLabelsGroup), this.gridLabelsGroup = null), Q && (this.gridLabelsGroup = Q, this.scene.add(Q));
  }
  setBoundingBoxGroup(Q) {
    this.boundingBoxGroup && (this.scene.remove(this.boundingBoxGroup), gP(this.boundingBoxGroup), this.boundingBoxGroup = null), Q && (this.boundingBoxGroup = Q, this.scene.add(Q));
  }
  setGeometryEmpty() {
    this.setSim3dHandle(null), kP(this.toolpathRoot, this.toolpathStreams), this.toolpathStreams = [], this.toolpathCutBucketCount = 1, this.linePositions = null, this.currentBounds = null, this.emitBoundsChanged(), this.refreshBoundingBox();
  }
  setToolpathGeometry(Q) {
    this.setGeometryEmpty(), this.toolpathCutBucketCount = Math.max(1, Math.floor(Q.cutBucketCount));
    const B = [
      {
        kind: "rapid",
        cutBucketIndex: null,
        positions: Q.rapid.positions,
        prefixEndVertex: Q.rapid.prefixEndVertex,
        colors: Q.rapid.colors,
        opacity: vt(this.options.render.theme.rapidOpacity ?? 0.3)
      },
      ...Q.cuts.map((P, e) => ({
        kind: "cut",
        cutBucketIndex: e,
        positions: P.positions,
        prefixEndVertex: P.prefixEndVertex,
        colors: P.colors,
        opacity: this.cutBucketOpacity(e)
      }))
    ], { streams: A, bounds: t } = hP({
      specs: B,
      options: this.options,
      scene: this.toolpathRoot
    });
    this.toolpathStreams = A, this.currentBounds = t ? t.clone() : null, this.emitBoundsChanged(), this.refreshBoundingBox(), this.setToolpathRotationA(this.toolpathRotationA);
  }
  refreshToolpathColors() {
    lP(this.toolpathStreams, this.options);
  }
  refreshToolpathOpacities() {
    UP({
      streams: this.toolpathStreams,
      options: this.options,
      cutBucketCount: this.toolpathCutBucketCount
    });
  }
  cutBucketOpacity(Q) {
    const B = this.options.render.theme.opacity, A = this.toolpathCutBucketCount;
    if (A <= 1)
      return B;
    const t = Q / (A - 1);
    return vt(B * t);
  }
  buildLinePositions() {
    const Q = this.currentLines.length;
    this.linePositions = new Float32Array(Q * 4);
    let B = 0, A = 0, t = 0, P = 0;
    const e = new AA({
      onLinearMove: (i) => {
        const s = i.transformedEnd ?? i.end;
        B = s.X, A = s.Y, t = s.Z, P = i.end.A;
      },
      onArcMove: (i) => {
        const s = i.transformedEnd ?? i.end;
        B = s.X, A = s.Y, t = s.Z, P = i.end.A;
      }
    });
    for (let i = 0; i < Q; i++) {
      const s = this.currentLines[i];
      s && e.processLine(s), this.linePositions[i * 4] = B, this.linePositions[i * 4 + 1] = A, this.linePositions[i * 4 + 2] = t, this.linePositions[i * 4 + 3] = P;
    }
  }
  async renderScene() {
    if (this.currentLines.length === 0) {
      this.setGeometryEmpty(), this.emitProgress({ state: "hidden" });
      return;
    }
    const Q = this.renderSequence += 1;
    try {
      this.options.mode.laser ? this.emitProgress({ state: "indeterminate", label: "Scanning power..." }) : this.emitProgress({
        state: "determinate",
        label: "Building geometry...",
        processed: 0,
        total: this.currentLines.length
      });
      const B = await zP(this.currentLines, {
        arcSegments: this.options.geometry.arcSegments,
        bucketCount: 16,
        laserMode: this.options.mode.laser,
        batch: {
          everyLines: this.options.geometry.batching.progressEveryLines,
          yieldEveryLines: this.options.geometry.batching.yieldEveryLines,
          shouldAbort: () => Q !== this.renderSequence,
          onProgress: (A, t) => {
            Q === this.renderSequence && this.emitProgress({ state: "determinate", label: "Building geometry...", processed: A, total: t });
          }
        }
      });
      if (Q !== this.renderSequence)
        return;
      this.setToolpathGeometry({
        rapid: B.rapid,
        cuts: B.cuts,
        cutBucketCount: B.cutBucketCount
      }), this.buildLinePositions(), this.options.mode.sim3d && (this.setToolpathStreamsVisible(this.options.sim3d.showToolpath), await this.buildAndApplySim3d(Q));
    } catch (B) {
      if (B instanceof Error && B.message === "Aborted.")
        return;
      throw B;
    } finally {
      Q === this.renderSequence && this.emitProgress({ state: "hidden" });
    }
  }
  setSim3dHandle(Q) {
    this.sim3dHandle && (this.scene.remove(this.sim3dHandle.slab.group), HP(this.sim3dHandle.slab), this.sim3dHandle = null), Q && (this.sim3dHandle = Q, this.scene.add(Q.slab.group));
  }
  setToolpathStreamsVisible(Q) {
    for (const B of this.toolpathStreams)
      B.line.visible = Q;
  }
  async buildAndApplySim3d(Q) {
    this.emitProgress({ state: "indeterminate", label: "Building 3D simulation..." });
    const B = this.options.sim3d.toolDiameter / 2, A = this.options.sim3d.resolution;
    let t;
    try {
      t = await OP(this.currentLines, B, A, {
        arcSegments: this.options.geometry.arcSegments,
        batch: {
          shouldAbort: () => Q !== this.renderSequence,
          onProgress: (i, s) => {
            Q === this.renderSequence && this.emitProgress({
              state: "determinate",
              label: "Building 3D simulation...",
              processed: i,
              total: s
            });
          },
          yieldEveryLines: this.options.geometry.batching.yieldEveryLines
        }
      });
    } catch {
      return;
    }
    if (Q !== this.renderSequence) return;
    const P = mB(0, t);
    yB(P, A, this.options.sim3d.erosionPasses, t.slabBounds.zTop);
    const e = MP(t.slabBounds, A);
    IB(e, P), this.setSim3dHandle({ data: t, slab: e, currentLine: 0 });
  }
  startCameraFocus(Q) {
    const B = new h.Vector3();
    Q.getCenter(B);
    const A = new h.Vector3();
    Q.getSize(A);
    const t = Math.max(A.x, A.y, 1) / 2, P = h.MathUtils.degToRad(this.camera.fov), e = t / Math.tan(P / 2) * 1.25 + A.z, i = mA("front-top-left"), s = B.clone().add(i.multiplyScalar(e)), v = Math.max(A.x, A.y, A.z, 1);
    this.camera.near = v / 1e3, this.camera.far = v * 50, this.camera.updateProjectionMatrix(), this.cameraFocusTransition && (this.controls.enableDamping = this.cameraFocusTransition.dampingEnabled), this.cameraFocusTransition = {
      startedAt: performance.now(),
      duration: this.options.camera.focusDurationMs,
      fromPosition: this.camera.position.clone(),
      toPosition: s,
      fromTarget: this.controls.target.clone(),
      toTarget: B,
      dampingEnabled: this.controls.enableDamping
    }, this.controls.enableDamping = !1;
  }
  updateCameraFocusTransition() {
    if (!this.cameraFocusTransition)
      return;
    const B = performance.now() - this.cameraFocusTransition.startedAt, A = Math.min(1, Math.max(0, B / this.cameraFocusTransition.duration)), t = xP(A);
    if (this.camera.position.lerpVectors(this.cameraFocusTransition.fromPosition, this.cameraFocusTransition.toPosition, t), this.controls.target.lerpVectors(this.cameraFocusTransition.fromTarget, this.cameraFocusTransition.toTarget, t), A >= 1) {
      const P = this.cameraFocusTransition.dampingEnabled;
      this.camera.position.copy(this.cameraFocusTransition.toPosition), this.controls.target.copy(this.cameraFocusTransition.toTarget), this.cameraFocusTransition = null, this.controls.enableDamping = !1, this.controls.update(), this.controls.enableDamping = P;
    }
  }
  updateViewCubeRotation() {
    if (!this.viewCube)
      return;
    const Q = this.camera.quaternion.clone();
    typeof Q.invert == "function" ? Q.invert() : typeof Q.inverse == "function" && Q.inverse();
    const B = new h.Matrix4();
    B.makeRotationFromQuaternion(Q), B.multiply(this.viewCubeCorrection), this.viewCube.setRotationMatrix3d(B.elements);
    const A = mP(this.camera.position, this.controls.target);
    this.viewCube.setActiveFace(A);
  }
}
function vt(r) {
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}
function ct(r, Q) {
  var A, t, P, e;
  if (!Q)
    return { ...r };
  const B = ui(r.render.theme, (A = Q.render) == null ? void 0 : A.theme);
  return {
    ...r,
    ...Q,
    mode: { ...r.mode, ...Q.mode },
    sim3d: { ...r.sim3d, ...Q.sim3d },
    bit: { ...r.bit, ...Q.bit },
    progress: { ...r.progress, ...Q.progress },
    grid: { ...r.grid, ...Q.grid },
    boundingBox: { ...r.boundingBox, ...Q.boundingBox },
    geometry: {
      ...r.geometry,
      ...Q.geometry,
      batching: { ...r.geometry.batching, ...(t = Q.geometry) == null ? void 0 : t.batching }
    },
    render: {
      ...r.render,
      ...Q.render,
      theme: B
    },
    camera: {
      ...r.camera,
      ...Q.camera,
      orbit: { ...r.camera.orbit, ...(P = Q.camera) == null ? void 0 : P.orbit },
      initialPosition: { ...r.camera.initialPosition, ...(e = Q.camera) == null ? void 0 : e.initialPosition }
    }
  };
}
function ui(r, Q) {
  var B, A;
  return Q ? {
    ...r,
    ...Q,
    colors: {
      ...r.colors,
      ...Q.colors,
      grid: { ...r.colors.grid, ...(B = Q.colors) == null ? void 0 : B.grid },
      axes: { ...r.colors.axes, ...(A = Q.colors) == null ? void 0 : A.axes }
    }
  } : r;
}
const Ci = {
  rapidColor: "#0ef6ae",
  cutColor: "#3e85c7",
  boundingBoxColor: "#d0d0d0",
  strokeWidth: 0.5,
  arcSegments: 30,
  padding: 5,
  projectionMode: "isometric",
  showOrigin: !0,
  originColor: "#ffffff",
  crosshairColor: "#ffffff"
}, eB = 0, iB = 0;
class ji {
  constructor(Q, B) {
    this.crosshairPos = null, this.crosshairVisible = !1, this.pathEls = [], this.segmentGroups = [], this.workerMode = !1, this.viewBox = { x: 0, y: 0, w: 100, h: 100 }, this.rotX = eB, this.rotY = iB, this.centerX = 0, this.centerY = 0, this.centerZ = 0, this.focalLength = 500, this.cosRotX = 1, this.sinRotX = 0, this.cosRotY = 1, this.sinRotY = 0, this.dragMode = "none", this.activePointers = /* @__PURE__ */ new Map(), this.pinchLastDist = 0, this.pinchLastMid = { x: 0, y: 0 }, this.rafPending = !1, this.rapidVerts = new Float32Array(0), this.cutVerts = new Float32Array(0), this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: !0 }, this.project = (A, t, P) => {
      const e = A - this.centerX, i = t - this.centerY, s = P - this.centerZ, v = e * this.cosRotY + s * this.sinRotY, c = i, n = -e * this.sinRotY + s * this.cosRotY, T = v, z = c * this.cosRotX - n * this.sinRotX, w = c * this.sinRotX + n * this.cosRotX;
      if (this.options.projectionMode === "perspective") {
        const o = this.focalLength / (this.focalLength + w);
        return { x: T * o, y: -z * o };
      }
      return { x: T, y: -z };
    }, this.onWheel = (A) => {
      A.preventDefault();
      const t = A.deltaY > 0 ? 1.1 : 1 / 1.1, P = this.svgPoint(A.clientX, A.clientY), { x: e, y: i, w: s, h: v } = this.viewBox;
      this.viewBox = {
        x: P.x - (P.x - e) * t,
        y: P.y - (P.y - i) * t,
        w: s * t,
        h: v * t
      }, this.applyViewBox();
    }, this.onPointerDown = (A) => {
      if (this.activePointers.set(A.pointerId, { x: A.clientX, y: A.clientY }), this.svg.setPointerCapture(A.pointerId), A.preventDefault(), this.activePointers.size === 1)
        this.dragMode = "pan", this.svg.style.cursor = "grabbing";
      else if (this.activePointers.size === 2) {
        this.dragMode = "pan", this.svg.style.cursor = "move";
        const [t, P] = Array.from(this.activePointers.values());
        this.pinchLastDist = Math.hypot(P.x - t.x, P.y - t.y), this.pinchLastMid = { x: (t.x + P.x) / 2, y: (t.y + P.y) / 2 };
      }
    }, this.onPointerMove = (A) => {
      if (!this.activePointers.has(A.pointerId)) return;
      const t = this.activePointers.get(A.pointerId);
      if (this.activePointers.set(A.pointerId, { x: A.clientX, y: A.clientY }), this.activePointers.size === 2) {
        const [i, s] = Array.from(this.activePointers.values()), v = Math.hypot(s.x - i.x, s.y - i.y), c = { x: (i.x + s.x) / 2, y: (i.y + s.y) / 2 };
        if (this.pinchLastDist > 0) {
          const w = this.pinchLastDist / v, o = this.svgPoint(c.x, c.y), { x: E, y: k, w: a, h: U } = this.viewBox;
          this.viewBox = {
            x: o.x - (o.x - E) * w,
            y: o.y - (o.y - k) * w,
            w: a * w,
            h: U * w
          };
        }
        const n = this.svg.getBoundingClientRect(), T = c.x - this.pinchLastMid.x, z = c.y - this.pinchLastMid.y;
        this.viewBox = {
          ...this.viewBox,
          x: this.viewBox.x - T / n.width * this.viewBox.w,
          y: this.viewBox.y - z / n.height * this.viewBox.h
        }, this.pinchLastDist = v, this.pinchLastMid = c, this.applyViewBox();
        return;
      }
      if (this.dragMode === "none") return;
      const P = A.clientX - t.x, e = A.clientY - t.y;
      if (this.dragMode === "orbit") {
        const i = this.svg.getBoundingClientRect(), s = Math.PI / Math.min(i.width, i.height);
        this.rotY += P * s, this.rotX += e * s, this.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotX)), this.updateTrig(), this.fitView(), this.scheduleDraw();
      } else {
        const i = this.svg.getBoundingClientRect();
        this.viewBox = {
          ...this.viewBox,
          x: this.viewBox.x - P / i.width * this.viewBox.w,
          y: this.viewBox.y - e / i.height * this.viewBox.h
        }, this.applyViewBox();
      }
    }, this.onPointerUp = (A) => {
      if (this.activePointers.delete(A.pointerId), this.svg.releasePointerCapture(A.pointerId), this.activePointers.size === 1) {
        const [t] = this.activePointers.values();
        this.pinchLastMid = { x: t.x, y: t.y }, this.dragMode = "pan", this.svg.style.cursor = "grabbing";
      } else this.activePointers.size === 0 && (this.dragMode = "none", this.svg.style.cursor = "grab");
    }, this.onContextMenu = (A) => {
      A.preventDefault();
    }, this.options = { ...Ci, ...B }, this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), this.svg.style.cssText = "width:100%;height:100%;display:block;cursor:grab;user-select:none;touch-action:none;", this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet"), this.svg.setAttribute("xmlns", "http://www.w3.org/2000/svg"), this.bboxPath = qB(), this.pathLayer = document.createElementNS("http://www.w3.org/2000/svg", "g"), this.bboxLabelX = _B("middle", "hanging"), this.bboxLabelY = _B("start", "middle"), this.bboxLabelZ = _B("middle", "auto"), this.originMarker = document.createElementNS("http://www.w3.org/2000/svg", "circle"), this.originMarker.setAttribute("stroke-opacity", "0.4"), this.originMarker.setAttribute("visibility", "hidden"), this.crosshairEl = qB(), this.crosshairEl.setAttribute("fill", "none"), this.crosshairEl.setAttribute("visibility", "hidden"), this.svg.appendChild(this.bboxPath), this.svg.appendChild(this.pathLayer), this.svg.appendChild(this.bboxLabelX), this.svg.appendChild(this.bboxLabelY), this.svg.appendChild(this.bboxLabelZ), this.svg.appendChild(this.originMarker), this.svg.appendChild(this.crosshairEl), Q.appendChild(this.svg), this.applyOptions(), this.bindEvents();
  }
  // ── Public API ────────────────────────────────────────────────────────────
  loadFromLines(Q) {
    const { rapid: B, cutting: A } = wP(Q, {
      arcSegments: this.options.arcSegments
    });
    if (this.rapidVerts = B, this.cutVerts = A, this.workerMode = !1, this.syncSegmentGroupsFromLines(), this.bounds = BA(B, A), !this.bounds.empty) {
      this.centerX = (this.bounds.minX + this.bounds.maxX) / 2, this.centerY = (this.bounds.minY + this.bounds.maxY) / 2, this.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
      const t = Math.hypot(
        this.bounds.maxX - this.bounds.minX,
        this.bounds.maxY - this.bounds.minY,
        this.bounds.maxZ - this.bounds.minZ
      );
      this.focalLength = t * 2;
    }
    this.rotX = eB, this.rotY = iB, this.updateTrig(), this.fitView(), this.rebuildAndRender();
  }
  loadFromFile(Q) {
    return new Promise((B, A) => {
      const t = new FileReader();
      t.onload = (P) => {
        var i;
        const e = (i = P.target) == null ? void 0 : i.result;
        if (typeof e != "string") {
          A(new Error("Failed to read file"));
          return;
        }
        this.loadFromText(e), B();
      }, t.onerror = () => A(new Error("FileReader error")), t.readAsText(Q);
    });
  }
  loadFromText(Q) {
    this.loadFromLines(Q.split(/\r?\n/));
  }
  clear() {
    this.rapidVerts = new Float32Array(0), this.cutVerts = new Float32Array(0), this.workerMode = !1, this.segmentGroups = [], this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0, empty: !0 }, this.rebuildAndRender();
  }
  loadFromWorkerData(Q) {
    const B = EP(Q);
    if (this.workerMode = !0, this.rapidVerts = new Float32Array(0), this.cutVerts = new Float32Array(0), this.segmentGroups = B.map((A) => ({
      color: A.opacity < 0.75 ? this.options.rapidColor : this.options.cutColor,
      opacity: A.opacity,
      verts: A.positions
    })), this.bounds = BA(...B.map((A) => A.positions)), !this.bounds.empty) {
      this.centerX = (this.bounds.minX + this.bounds.maxX) / 2, this.centerY = (this.bounds.minY + this.bounds.maxY) / 2, this.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
      const A = Math.hypot(
        this.bounds.maxX - this.bounds.minX,
        this.bounds.maxY - this.bounds.minY,
        this.bounds.maxZ - this.bounds.minZ
      );
      this.focalLength = A * 2;
    }
    this.rotX = eB, this.rotY = iB, this.updateTrig(), this.fitView(), this.rebuildAndRender();
  }
  loadFromPrecomputedGroups(Q) {
    if (this.workerMode = !0, this.rapidVerts = new Float32Array(0), this.cutVerts = new Float32Array(0), this.segmentGroups = Q.map((B) => ({
      color: B.hexColor,
      opacity: B.opacity,
      verts: new Float32Array(B.positionsBuffer, 0, B.positionsLen)
    })), this.bounds = BA(...this.segmentGroups.map((B) => B.verts)), !this.bounds.empty) {
      this.centerX = (this.bounds.minX + this.bounds.maxX) / 2, this.centerY = (this.bounds.minY + this.bounds.maxY) / 2, this.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
      const B = Math.hypot(
        this.bounds.maxX - this.bounds.minX,
        this.bounds.maxY - this.bounds.minY,
        this.bounds.maxZ - this.bounds.minZ
      );
      this.focalLength = B * 2;
    }
    this.rotX = eB, this.rotY = iB, this.updateTrig(), this.fitView(), this.rebuildAndRender();
  }
  syncSegmentGroupsFromLines() {
    this.segmentGroups = [
      { color: this.options.rapidColor, opacity: 0.5, verts: this.rapidVerts },
      { color: this.options.cutColor, opacity: 1, verts: this.cutVerts }
    ];
  }
  resetView() {
    this.rotX = eB, this.rotY = iB, this.updateTrig(), this.fitView(), this.rebuildAndRender();
  }
  setOptions(Q) {
    this.options = { ...this.options, ...Q }, this.applyOptions(), this.rebuildAndRender();
  }
  setProjectionMode(Q) {
    this.options = { ...this.options, projectionMode: Q }, this.rebuildAndRender();
  }
  getSVGElement() {
    return this.svg;
  }
  setBitPosition(Q) {
    this.crosshairPos = Q, this.crosshairVisible = !0, this.rebuildAndRender();
  }
  setBitVisible(Q) {
    this.crosshairVisible = Q, this.rebuildAndRender();
  }
  dispose() {
    this.svg.removeEventListener("wheel", this.onWheel), this.svg.removeEventListener("pointerdown", this.onPointerDown), this.svg.removeEventListener("pointermove", this.onPointerMove), this.svg.removeEventListener("pointerup", this.onPointerUp), this.svg.removeEventListener("pointercancel", this.onPointerUp), this.svg.removeEventListener("contextmenu", this.onContextMenu), this.svg.remove();
  }
  // ── Projection ────────────────────────────────────────────────────────────
  updateTrig() {
    this.cosRotX = Math.cos(this.rotX), this.sinRotX = Math.sin(this.rotX), this.cosRotY = Math.cos(this.rotY), this.sinRotY = Math.sin(this.rotY);
  }
  // ── Rendering ─────────────────────────────────────────────────────────────
  rebuildAndRender(Q = !1) {
    const B = Q ? Ni : L, A = String(this.options.strokeWidth);
    for (; this.pathEls.length < this.segmentGroups.length; ) {
      const t = qB();
      this.pathLayer.appendChild(t), this.pathEls.push(t);
    }
    for (; this.pathEls.length > this.segmentGroups.length; )
      this.pathLayer.removeChild(this.pathEls.pop());
    for (let t = 0; t < this.segmentGroups.length; t++) {
      const { color: P, opacity: e, verts: i } = this.segmentGroups[t], s = this.pathEls[t];
      s.setAttribute("stroke", P), s.setAttribute("stroke-opacity", String(e)), s.setAttribute("stroke-width", A), s.setAttribute("stroke-linecap", "round"), s.setAttribute("stroke-linejoin", "round"), s.setAttribute("d", Oi(i, this.project, B));
    }
    this.renderBbox(), this.renderOriginMarker(), this.renderCrosshairMarker(), this.applyViewBox();
  }
  scheduleDraw() {
    this.rafPending || (this.rafPending = !0, requestAnimationFrame(() => {
      this.rafPending = !1, this.rebuildAndRender(!0);
    }));
  }
  fitView() {
    if (this.bounds.empty) {
      this.viewBox = { x: -50, y: -50, w: 100, h: 100 };
      return;
    }
    const { minX: Q, maxX: B, minY: A, maxY: t, minZ: P, maxZ: e } = this.bounds, i = this.project, s = i(Q, A, P), v = i(B, A, P), c = i(B, t, P), n = i(Q, t, P), T = i(Q, A, e), z = i(B, A, e), w = i(B, t, e), o = i(Q, t, e), E = Math.hypot(v.x - s.x, v.y - s.y), k = Math.hypot(n.x - s.x, n.y - s.y), a = Math.hypot(T.x - s.x, T.y - s.y), U = Math.max(E, k, a) * 0.07, D = U * 0.5, l = nt(rB(s, v), rB(c, n), D), O = [s, v, c, n, T, z, w, o], u = Math.min(...O.map((R) => R.y)), N = Math.max(...O.map((R) => R.y)), C = Math.min(...O.map((R) => R.x)), M = Math.max(...O.map((R) => R.x)), b = { x: M + D, y: (u + N) / 2 }, j = { x: b.x + U * 5, y: b.y }, d = { x: (C + M) / 2, y: u - U }, G = [s, v, c, n, T, z, w, o, l, b, j, d];
    let f = 1 / 0, H = 1 / 0, F = -1 / 0, X = -1 / 0;
    for (const R of G)
      R.x < f && (f = R.x), R.y < H && (H = R.y), R.x > F && (F = R.x), R.y > X && (X = R.y);
    const nQ = F - f, NQ = X - H, gQ = Math.max(nQ, NQ) * 0.08, oQ = this.options.padding + gQ;
    this.viewBox = {
      x: f - oQ,
      y: H - oQ,
      w: nQ + oQ * 2,
      h: NQ + oQ * 2
    };
  }
  applyViewBox() {
    const { x: Q, y: B, w: A, h: t } = this.viewBox;
    this.svg.setAttribute("viewBox", `${L(Q)} ${L(B)} ${L(A)} ${L(t)}`);
  }
  applyOptions() {
    const { boundingBoxColor: Q, strokeWidth: B, originColor: A } = this.options;
    this.workerMode || this.syncSegmentGroupsFromLines(), this.bboxPath.setAttribute("stroke", Q), this.bboxPath.setAttribute("stroke-width", String(B * 0.6)), this.bboxPath.setAttribute("fill", Q), this.bboxPath.setAttribute("fill-opacity", "0.05");
    for (const t of [this.bboxLabelX, this.bboxLabelY, this.bboxLabelZ])
      t.setAttribute("fill", Q);
    this.originMarker.setAttribute("fill", A), this.originMarker.setAttribute("stroke", "#000000"), this.crosshairEl.setAttribute("stroke", this.options.crosshairColor);
  }
  renderBbox() {
    if (this.bounds.empty) {
      this.bboxPath.setAttribute("d", ""), this.bboxLabelX.setAttribute("visibility", "hidden"), this.bboxLabelY.setAttribute("visibility", "hidden"), this.bboxLabelZ.setAttribute("visibility", "hidden");
      return;
    }
    const { minX: Q, maxX: B, minY: A, maxY: t, minZ: P, maxZ: e } = this.bounds, i = this.project, s = i(Q, A, P), v = i(B, A, P), c = i(B, t, P), n = i(Q, t, P), T = i(Q, A, e), z = i(B, A, e), w = i(B, t, e), o = i(Q, t, e), E = [
      `M${L(s.x)} ${L(s.y)}L${L(v.x)} ${L(v.y)}L${L(c.x)} ${L(c.y)}L${L(n.x)} ${L(n.y)}Z`,
      `M${L(T.x)} ${L(T.y)}L${L(z.x)} ${L(z.y)}L${L(w.x)} ${L(w.y)}L${L(o.x)} ${L(o.y)}Z`,
      `M${L(s.x)} ${L(s.y)}L${L(T.x)} ${L(T.y)}`,
      `M${L(v.x)} ${L(v.y)}L${L(z.x)} ${L(z.y)}`,
      `M${L(c.x)} ${L(c.y)}L${L(w.x)} ${L(w.y)}`,
      `M${L(n.x)} ${L(n.y)}L${L(o.x)} ${L(o.y)}`
    ].join("");
    this.bboxPath.setAttribute("d", E);
    const k = Math.hypot(v.x - s.x, v.y - s.y), a = Math.hypot(n.x - s.x, n.y - s.y), U = Math.hypot(T.x - s.x, T.y - s.y), D = Math.max(k, a, U) * 0.07, l = D * 0.5;
    $B(this.bboxLabelX, rB(s, v), nt(rB(s, v), rB(c, n), l), D, `X: ${QA(B - Q)}`);
    const O = [s, v, c, n, T, z, w, o], u = Math.min(...O.map((d) => d.y)), N = Math.max(...O.map((d) => d.y)), C = Math.min(...O.map((d) => d.x)), M = Math.max(...O.map((d) => d.x)), b = { x: M + l, y: (u + N) / 2 };
    $B(this.bboxLabelY, b, b, D, `Y: ${QA(t - A)}`);
    const j = { x: (C + M) / 2, y: u - D };
    $B(this.bboxLabelZ, j, j, D, `Z: ${QA(e - P)}`);
  }
  renderOriginMarker() {
    if (!this.options.showOrigin || this.bounds.empty) {
      this.originMarker.setAttribute("visibility", "hidden");
      return;
    }
    const Q = this.project(0, 0, 0), B = Math.min(this.viewBox.w, this.viewBox.h) * 0.018;
    this.originMarker.setAttribute("cx", L(Q.x)), this.originMarker.setAttribute("cy", L(Q.y)), this.originMarker.setAttribute("r", L(B)), this.originMarker.setAttribute("stroke-width", L(B * 0.25)), this.originMarker.setAttribute("visibility", "visible");
  }
  renderCrosshairMarker() {
    if (!this.crosshairVisible || this.crosshairPos === null) {
      this.crosshairEl.setAttribute("visibility", "hidden");
      return;
    }
    const { x: Q, y: B, z: A } = this.crosshairPos, t = this.project(Q, B, A), P = Math.min(this.viewBox.w, this.viewBox.h) * 0.025, e = P * 0.25, i = t.x, s = t.y, v = [
      `M${L(i - P)} ${L(s)}L${L(i - e)} ${L(s)}`,
      `M${L(i + e)} ${L(s)}L${L(i + P)} ${L(s)}`,
      `M${L(i)} ${L(s - P)}L${L(i)} ${L(s - e)}`,
      `M${L(i)} ${L(s + e)}L${L(i)} ${L(s + P)}`
    ].join("");
    this.crosshairEl.setAttribute("d", v), this.crosshairEl.setAttribute("stroke-width", L(this.options.strokeWidth * 2)), this.crosshairEl.setAttribute("stroke-linecap", "round"), this.crosshairEl.setAttribute("visibility", "visible");
  }
  bindEvents() {
    this.svg.addEventListener("wheel", this.onWheel, { passive: !1 }), this.svg.addEventListener("pointerdown", this.onPointerDown), this.svg.addEventListener("pointermove", this.onPointerMove), this.svg.addEventListener("pointerup", this.onPointerUp), this.svg.addEventListener("pointercancel", this.onPointerUp), this.svg.addEventListener("contextmenu", this.onContextMenu);
  }
  svgPoint(Q, B) {
    const A = this.svg.getBoundingClientRect(), { x: t, y: P, w: e, h: i } = this.viewBox;
    return {
      x: t + (Q - A.left) / A.width * e,
      y: P + (B - A.top) / A.height * i
    };
  }
}
function qB() {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "path");
  return r.setAttribute("fill", "none"), r;
}
function _B(r, Q) {
  const B = document.createElementNS("http://www.w3.org/2000/svg", "text");
  return B.setAttribute("text-anchor", r), B.setAttribute("dominant-baseline", Q), B;
}
function $B(r, Q, B, A, t) {
  r.setAttribute("x", L(B.x)), r.setAttribute("y", L(B.y)), r.setAttribute("font-size", L(A)), r.textContent = t, r.setAttribute("visibility", "visible");
}
function rB(r, Q) {
  return { x: (r.x + Q.x) / 2, y: (r.y + Q.y) / 2 };
}
function nt(r, Q, B) {
  const A = r.x - Q.x, t = r.y - Q.y, P = Math.hypot(A, t) || 1;
  return { x: r.x + A / P * B, y: r.y + t / P * B };
}
function L(r) {
  return r.toFixed(2);
}
function Ni(r) {
  return Math.round(r) + "";
}
function QA(r) {
  return r.toFixed(2);
}
function Oi(r, Q, B) {
  if (r.length === 0) return "";
  const A = [], t = 1e-6;
  let P = NaN, e = NaN;
  for (let i = 0; i + 5 < r.length; i += 6) {
    const s = Q(r[i], r[i + 1], r[i + 2]), v = Q(r[i + 3], r[i + 4], r[i + 5]);
    Math.abs(s.x - P) < t && Math.abs(s.y - e) < t ? A.push(`L${B(v.x)} ${B(v.y)}`) : A.push(`M${B(s.x)} ${B(s.y)}L${B(v.x)} ${B(v.y)}`), P = v.x, e = v.y;
  }
  return A.join("");
}
function BA(...r) {
  let Q = 1 / 0, B = 1 / 0, A = 1 / 0, t = -1 / 0, P = -1 / 0, e = -1 / 0, i = !0;
  for (const s of r)
    for (let v = 0; v + 5 < s.length; v += 6) {
      const c = s[v], n = s[v + 1], T = s[v + 2], z = s[v + 3], w = s[v + 4], o = s[v + 5];
      c < Q && (Q = c), n < B && (B = n), T < A && (A = T), c > t && (t = c), n > P && (P = n), T > e && (e = T), z < Q && (Q = z), w < B && (B = w), o < A && (A = o), z > t && (t = z), w > P && (P = w), o > e && (e = o), i = !1;
    }
  return { minX: Q, minY: B, maxX: t, maxY: P, minZ: A, maxZ: e, empty: i };
}
export {
  ji as G,
  jP as V,
  Hi as a,
  xA as b,
  NP as d
};
