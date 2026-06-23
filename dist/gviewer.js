const U = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
class R {
  parseLine(t) {
    const n = [], e = this.stripComments(t, n), s = this.parseWords(e), r = s.filter((a) => {
      const c = a.letter.toUpperCase();
      return c === "G" || c === "M";
    }), i = s.filter((a) => {
      const c = a.letter.toUpperCase();
      return c !== "G" && c !== "M";
    });
    return {
      raw: t,
      words: s,
      gcodes: r,
      params: i,
      comments: n
    };
  }
  stripComments(t, n) {
    let e = "", s = !1, r = -1, i = "";
    for (let a = 0; a < t.length; a += 1) {
      const c = t[a];
      if (!s && c === ";") {
        const u = t.slice(a + 1);
        n.push({ type: "semicolon", text: u, start: a, end: t.length });
        break;
      }
      if (c === "(") {
        s ? i += c : (s = !0, r = a, i = "");
        continue;
      }
      if (c === ")" && s) {
        n.push({
          type: "paren",
          text: i,
          start: r,
          end: a + 1
        }), s = !1, r = -1, i = "";
        continue;
      }
      if (s) {
        i += c;
        continue;
      }
      e += c;
    }
    return s && n.push({
      type: "paren",
      text: i,
      start: r,
      end: t.length
    }), e;
  }
  parseWords(t) {
    const n = [];
    for (const e of t.matchAll(U)) {
      const s = e[0], r = e[1].toUpperCase(), i = Number(e[2]), a = e.index ?? 0, c = a + s.length;
      n.push({ letter: r, value: i, raw: s, start: a, end: c });
    }
    return n;
  }
}
const Z = ["X", "Y", "Z", "A", "B", "C"], X = {
  motion: "G0",
  distance: "G90",
  plane: "G17",
  units: "G21",
  feedMode: "G94",
  feedRate: null,
  spindleSpeed: null,
  tool: null,
  coolant: null,
  spindle: null,
  coordinateSystem: "G54"
};
class L {
  constructor(t = {}) {
    this.parser = new R(), this.modals = { ...X }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.callbacks = t, this.feedRates = /* @__PURE__ */ new Set(), this.spindleSpeeds = /* @__PURE__ */ new Set(), this.tools = /* @__PURE__ */ new Set();
  }
  setCallbacks(t) {
    this.callbacks = t;
  }
  getModals() {
    return { ...this.modals };
  }
  getPosition() {
    return { ...this.position };
  }
  getUniqueFeedRates() {
    return Array.from(this.feedRates);
  }
  getUniqueSpindleSpeeds() {
    return Array.from(this.spindleSpeeds);
  }
  getUniqueTools() {
    return Array.from(this.tools);
  }
  reset() {
    this.modals = { ...X }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.feedRates.clear(), this.spindleSpeeds.clear(), this.tools.clear();
  }
  processLine(t) {
    const n = this.parser.parseLine(t), e = { ...this.position };
    this.updateModals(n);
    const s = this.modals.motion, r = this.modals.plane;
    let i = this.applyAxes(n, e), a, c, u = "none";
    return s === "G0" || s === "G1" ? N(e, i) || (u = "linear", this.position = { ...i }, this.emitLinear({ start: e, end: i })) : (s === "G2" || s === "G3") && (N(e, i) || (u = "arc", c = this.arcCenter(n, e, i, r), a = this.computeArcMax(e, i, s, r, c), this.position = { ...i }, this.emitArc({ start: e, end: i, max: a, center: c, plane: r, motion: s }))), {
      parsed: n,
      modals: { ...this.modals },
      start: e,
      end: i,
      movement: u,
      arcMax: a
    };
  }
  unitsScale() {
    return this.modals.units === "G20" ? 25.4 : 1;
  }
  updateModals(t) {
    for (const n of t.gcodes) {
      if (n.letter.toUpperCase() === "G") {
        const e = `G${Math.trunc(n.value)}`;
        (e === "G0" || e === "G1" || e === "G2" || e === "G3") && (this.modals.motion = e), (e === "G90" || e === "G91") && (this.modals.distance = e), (e === "G17" || e === "G18" || e === "G19") && (this.modals.plane = e), (e === "G20" || e === "G21") && (this.modals.units = e), (e === "G93" || e === "G94") && (this.modals.feedMode = e), (e === "G54" || e === "G55" || e === "G56" || e === "G57" || e === "G58" || e === "G59") && (this.modals.coordinateSystem = e);
      }
      if (n.letter.toUpperCase() === "M") {
        const e = `M${Math.trunc(n.value)}`;
        (e === "M7" || e === "M8" || e === "M9") && (this.modals.coolant = e), (e === "M3" || e === "M4" || e === "M5") && (this.modals.spindle = e);
      }
    }
    for (const n of t.params) {
      const e = n.letter.toUpperCase();
      e === "F" && (this.modals.feedRate = n.value, this.feedRates.add(n.value)), e === "S" && (this.modals.spindleSpeed = n.value, this.spindleSpeeds.add(n.value)), e === "T" && (this.modals.tool = n.value, this.tools.add(n.value));
    }
  }
  applyAxes(t, n) {
    const e = { ...n }, s = this.unitsScale();
    for (const r of Z) {
      const i = t.params.find((c) => c.letter.toUpperCase() === r);
      if (!i)
        continue;
      const a = r === "X" || r === "Y" || r === "Z" ? i.value * s : i.value;
      this.modals.distance === "G90" ? e[r] = a : e[r] = e[r] + a;
    }
    return e;
  }
  computeArcMax(t, n, e, s, r) {
    const { primary: i, secondary: a, tertiary: c } = C(s), u = j(
      t[i],
      t[a],
      r[i],
      r[a]
    ), f = Math.atan2(
      t[a] - r[a],
      t[i] - r[i]
    ), d = Math.atan2(
      n[a] - r[a],
      n[i] - r[i]
    ), y = $(f, d, e);
    let l = Number.NEGATIVE_INFINITY, h = Number.NEGATIVE_INFINITY;
    for (const A of y) {
      const G = r[i] + u * Math.cos(A), p = r[a] + u * Math.sin(A);
      G > l && (l = G), p > h && (h = p);
    }
    const M = { ...t };
    M[i] = l, M[a] = h, M[c] = Math.max(t[c], n[c]);
    for (const A of Z)
      A !== i && A !== a && A !== c && (M[A] = Math.max(t[A], n[A]));
    return M;
  }
  arcCenter(t, n, e, s) {
    const { primary: r, secondary: i } = C(s), a = { ...n }, c = this.unitsScale(), u = F(t, "R"), f = _(t, s), d = f.primary === null ? null : f.primary * c, y = f.secondary === null ? null : f.secondary * c;
    if (d !== null || y !== null)
      return a[r] = n[r] + (d ?? 0), a[i] = n[i] + (y ?? 0), a;
    if (u === null)
      return a;
    const l = u * c, h = n[r], M = n[i], A = e[r], G = e[i], p = A - h, w = G - M, S = Math.hypot(p, w);
    if (S === 0)
      return a;
    const I = Math.abs(l), m = Math.sqrt(Math.max(0, I * I - S / 2 * (S / 2))), x = (h + A) / 2, v = (M + G) / 2, P = -w / S, E = p / S, Y = l >= 0 ? 1 : -1;
    return a[r] = x + Y * P * m, a[i] = v + Y * E * m, a;
  }
  emitLinear(t) {
    const n = this.callbacks.onLinearMove;
    if (!n)
      return;
    const e = t.end.A - t.start.A, s = Math.max(1, Math.ceil(Math.abs(e) / W));
    let r = { ...t.start };
    for (let i = 1; i <= s; i += 1) {
      const a = i / s, c = q(t.start, t.end, a), u = V(r), f = V(c);
      n({
        modals: { ...this.modals },
        start: { ...r },
        end: { ...c },
        transformedStart: u,
        transformedEnd: f
      }), r = c;
    }
  }
  emitArc(t) {
    const n = this.callbacks.onArcMove;
    if (!n)
      return;
    const e = V(t.start), s = V(t.end), r = V(t.max), i = V(t.center);
    n({
      modals: { ...this.modals },
      start: { ...t.start },
      end: { ...t.end },
      max: { ...t.max },
      center: { ...t.center },
      plane: t.plane,
      motion: t.motion,
      transformedStart: e,
      transformedEnd: s,
      transformedMax: r,
      transformedCenter: i
    });
  }
}
function F(o, t) {
  const n = o.params.find((e) => e.letter.toUpperCase() === t);
  return n ? n.value : null;
}
function C(o) {
  return o === "G18" ? { primary: "Z", secondary: "X", tertiary: "Y" } : o === "G19" ? { primary: "Y", secondary: "Z", tertiary: "X" } : { primary: "X", secondary: "Y", tertiary: "Z" };
}
function _(o, t) {
  const n = F(o, "I"), e = F(o, "J"), s = F(o, "K");
  return t === "G18" ? { primary: s, secondary: n } : t === "G19" ? { primary: e, secondary: s } : { primary: n, secondary: e };
}
function $(o, t, n) {
  const e = Math.PI * 2;
  let s = b(o), r = b(t);
  const i = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, e];
  if (n === "G2") {
    s < r && (s += e);
    const c = [s, r];
    for (const u of i) {
      let f = u;
      f < r && (f += e), f <= s && f >= r && c.push(f);
    }
    return c;
  }
  r < s && (r += e);
  const a = [s, r];
  for (const c of i) {
    let u = c;
    u < s && (u += e), u >= s && u <= r && a.push(u);
  }
  return a;
}
function b(o) {
  const t = Math.PI * 2;
  let n = o % t;
  return n < 0 && (n += t), n;
}
function j(o, t, n, e) {
  return Math.hypot(o - n, t - e);
}
function N(o, t) {
  return Z.every((n) => o[n] === t[n]);
}
const W = 5;
function q(o, t, n) {
  return {
    X: o.X + (t.X - o.X) * n,
    Y: o.Y + (t.Y - o.Y) * n,
    Z: o.Z + (t.Z - o.Z) * n,
    A: o.A + (t.A - o.A) * n,
    B: o.B + (t.B - o.B) * n,
    C: o.C + (t.C - o.C) * n
  };
}
function V(o) {
  const t = o.A * Math.PI / 180, n = Math.cos(t), e = Math.sin(t), s = o.Y * n - o.Z * e, r = o.Y * e + o.Z * n;
  return { ...o, Y: s, Z: r };
}
function ne(o, t = {}) {
  const n = [], e = t.arcSegments ?? 30, s = t.collector ?? {}, r = new L({
    onLinearMove: (i) => {
      (s.onLinearMove ?? z)(i, n);
    },
    onArcMove: (i) => {
      (s.onArcMove ?? ((c, u) => {
        g(c, u, e);
      }))(i, n);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return Float32Array.from(n);
}
function oe(o, t = {}) {
  const n = [], e = [], s = t.arcSegments ?? 30, r = new L({
    onLinearMove: (i) => {
      const a = i.transformedStart ?? i.start, c = i.transformedEnd ?? i.end;
      (i.modals.motion === "G0" ? n : e).push(a.X, a.Y, a.Z, c.X, c.Y, c.Z);
    },
    onArcMove: (i) => {
      const a = i.modals.motion === "G0" ? n : e;
      g(i, a, s);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return {
    rapid: Float32Array.from(n),
    cutting: Float32Array.from(e)
  };
}
async function re(o, t = {}) {
  var y;
  const n = [], e = [], s = t.arcSegments ?? 30, r = t.batch, i = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), a = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let c = i, u = a > 0 ? a : Number.POSITIVE_INFINITY;
  const f = new L({
    onLinearMove: (l) => {
      const h = l.transformedStart ?? l.start, M = l.transformedEnd ?? l.end;
      (l.modals.motion === "G0" ? n : e).push(h.X, h.Y, h.Z, M.X, M.Y, M.Z);
    },
    onArcMove: (l) => {
      const h = l.modals.motion === "G0" ? n : e;
      g(l, h, s);
    }
  }), d = o.length;
  for (let l = 0; l < d; l += 1) {
    if ((y = r == null ? void 0 : r.shouldAbort) != null && y.call(r))
      throw new Error("Aborted.");
    const h = o[l];
    if (!h) {
      r != null && r.onProgress && (l + 1 === d || l + 1 === c) && (r.onProgress(l + 1, d), c += i), a > 0 && (l + 1 === d || l + 1 === u) && (await new Promise((M) => {
        setTimeout(M, 0);
      }), u += a);
      continue;
    }
    f.processLine(h), r != null && r.onProgress && (l + 1 === d || l + 1 === c) && (r.onProgress(l + 1, d), c += i), a > 0 && (l + 1 === d || l + 1 === u) && (await new Promise((M) => {
      setTimeout(M, 0);
    }), u += a);
  }
  return {
    rapid: Float32Array.from(n),
    cutting: Float32Array.from(e)
  };
}
async function se(o, t = {}) {
  var G;
  const n = [], e = t.arcSegments ?? 30, s = t.batch, r = Math.max(1, Math.floor((s == null ? void 0 : s.everyLines) ?? 5e3)), i = Math.max(0, Math.floor((s == null ? void 0 : s.yieldEveryLines) ?? 5e4));
  let a = r, c = i > 0 ? i : Number.POSITIVE_INFINITY;
  const u = new Int32Array(o.length);
  u.fill(-1);
  const f = new Int32Array(o.length);
  f.fill(-1);
  const d = new Uint8Array(o.length), y = new Int32Array(o.length);
  let l = -1, h = 0;
  const M = new L({
    onLinearMove: (p) => {
      const w = p.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (h === 0 ? h = w : h !== w && (h = 3)), z(p, n);
    },
    onArcMove: (p) => {
      const w = p.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (h === 0 ? h = w : h !== w && (h = 3)), g(p, n, e);
    }
  }), A = o.length;
  for (let p = 0; p < A; p += 1) {
    if ((G = s == null ? void 0 : s.shouldAbort) != null && G.call(s))
      throw new Error("Aborted.");
    const w = n.length / 3;
    l = p, h = 0;
    const S = o[p];
    S && M.processLine(S), l = -1;
    const I = n.length / 3;
    I > w && (u[p] = w, f[p] = I, d[p] = h), y[p] = I, s != null && s.onProgress && (p + 1 === A || p + 1 === a) && (s.onProgress(p + 1, A), a += r), i > 0 && (p + 1 === A || p + 1 === c) && (await new Promise((m) => {
      setTimeout(m, 0);
    }), c += i);
  }
  return {
    positions: Float32Array.from(n),
    lineStartVertex: u,
    lineEndVertex: f,
    lineKind: d,
    prefixEndVertex: y
  };
}
function ie(o, t = {}) {
  const n = t.arcSegments ?? 30, e = Math.max(1, Math.floor(t.bucketCount ?? 16)), s = t.baseOpacity ?? 0.9, { minPower: r, maxPower: i } = ee(o), a = [], c = Array.from({ length: e }, () => []), u = new L({
    onLinearMove: (d) => {
      const y = d.transformedStart ?? d.start, l = d.transformedEnd ?? d.end;
      if (d.modals.motion === "G0") {
        a.push(y.X, y.Y, y.Z, l.X, l.Y, l.Z);
        return;
      }
      const h = B(d.modals.spindleSpeed, r, i, e);
      c[h].push(y.X, y.Y, y.Z, l.X, l.Y, l.Z);
    },
    onArcMove: (d) => {
      if (d.modals.motion === "G0")
        return;
      const y = B(d.modals.spindleSpeed, r, i, e), l = c[y];
      g(d, l, n);
    }
  });
  for (const d of o)
    d && u.processLine(d);
  const f = c.map((d, y) => ({
    opacity: O(y, e, s),
    vertices: Float32Array.from(d)
  }));
  return {
    rapid: Float32Array.from(a),
    buckets: f,
    minPower: r,
    maxPower: i
  };
}
async function ae(o, t = {}) {
  const n = await K(o, t);
  return {
    rapid: n.rapidPositions,
    buckets: n.buckets.map((e) => ({ opacity: e.opacity, vertices: e.positions })),
    minPower: n.minPower,
    maxPower: n.maxPower
  };
}
async function D(o, t = {}) {
  var S, I;
  const n = t.arcSegments ?? 30, e = Math.max(1, Math.floor(t.bucketCount ?? 16)), s = !!t.laserMode, r = t.batch, i = o.length * (s ? 2 : 1), a = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), c = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let u = a, f = c > 0 ? c : Number.POSITIVE_INFINITY, d = Number.NEGATIVE_INFINITY, y = !1;
  if (s) {
    const m = new R();
    for (const x of o) {
      if (!x)
        continue;
      if (m.parseLine(x).gcodes.some((E) => {
        if (E.letter !== "M")
          return !1;
        const Y = Math.trunc(E.value);
        return Y === 3 || Y === 4 || Y === 5;
      })) {
        y = !1;
        break;
      }
      y = !0;
    }
  }
  const l = (m) => m.spindle === "M5" || !(m.spindle === "M3" || m.spindle === "M4" || y && m.spindle === null) ? !1 : m.spindleSpeed === null ? !0 : m.spindleSpeed > 0;
  if (s) {
    const m = new L({
      onLinearMove: (x) => {
        if (!l(x.modals))
          return;
        const v = x.modals.spindleSpeed;
        v === null || v <= 0 || (d = Math.max(d, v));
      },
      onArcMove: (x) => {
        if (!l(x.modals))
          return;
        const v = x.modals.spindleSpeed;
        v === null || v <= 0 || (d = Math.max(d, v));
      }
    });
    for (let x = 0; x < o.length; x += 1) {
      if ((S = r == null ? void 0 : r.shouldAbort) != null && S.call(r))
        throw new Error("Aborted.");
      const v = o[x];
      v && m.processLine(v);
      const P = x + 1;
      r != null && r.onProgress && (P === i || P === u) && (r.onProgress(P, i), u += a), c > 0 && (P === i || P === f) && (await new Promise((E) => {
        setTimeout(E, 0);
      }), f += c);
    }
    Number.isFinite(d) || (d = 0);
  } else
    d = 0;
  const h = (m) => {
    if (e <= 1)
      return 0;
    if (m === null)
      return e - 1;
    const x = m;
    if (x <= 0)
      return 0;
    if (d <= 0)
      return e - 1;
    const v = Math.min(1, Math.max(0, x / d)), P = 1 + Math.floor(v * (e - 2));
    return Math.min(e - 1, Math.max(1, P));
  }, M = [], A = s ? Array.from({ length: e }, () => []) : [new Array()], G = new Int32Array(o.length), p = Array.from(
    { length: s ? e : 1 },
    () => new Int32Array(o.length)
  ), w = new L({
    onLinearMove: (m) => {
      const x = m.transformedStart ?? m.start, v = m.transformedEnd ?? m.end;
      if (m.modals.motion === "G0") {
        M.push(x.X, x.Y, x.Z, v.X, v.Y, v.Z);
        return;
      }
      if (s && !l(m.modals))
        return;
      const P = s ? h(m.modals.spindleSpeed) : 0;
      A[P].push(x.X, x.Y, x.Z, v.X, v.Y, v.Z);
    },
    onArcMove: (m) => {
      if (m.modals.motion === "G0" || s && !l(m.modals))
        return;
      const x = s ? h(m.modals.spindleSpeed) : 0, v = A[x];
      g(m, v, n);
    }
  });
  for (let m = 0; m < o.length; m += 1) {
    if ((I = r == null ? void 0 : r.shouldAbort) != null && I.call(r))
      throw new Error("Aborted.");
    const x = o[m];
    x && w.processLine(x), G[m] = M.length / 3;
    for (let P = 0; P < A.length; P += 1)
      p[P][m] = A[P].length / 3;
    const v = s ? o.length + m + 1 : m + 1;
    r != null && r.onProgress && (v === i || v === u) && (r.onProgress(v, i), u += a), c > 0 && (v === i || v === f) && (await new Promise((P) => {
      setTimeout(P, 0);
    }), f += c);
  }
  return {
    rapid: { positions: Float32Array.from(M), prefixEndVertex: G },
    cuts: A.map((m, x) => ({
      positions: Float32Array.from(m),
      prefixEndVertex: p[x]
    })),
    cutBucketCount: A.length,
    minPower: 0,
    maxPower: d
  };
}
async function K(o, t = {}) {
  const n = Math.max(1, Math.floor(t.bucketCount ?? 16)), e = t.baseOpacity ?? 0.9, s = await D(o, {
    arcSegments: t.arcSegments,
    bucketCount: n,
    laserMode: !0,
    batch: t.batch
  }), r = s.cuts.map((i, a) => ({
    opacity: O(a, n, e),
    positions: i.positions,
    prefixEndVertex: i.prefixEndVertex
  }));
  return {
    rapidPositions: s.rapid.positions,
    rapidPrefixEndVertex: s.rapid.prefixEndVertex,
    buckets: r,
    minPower: 0,
    maxPower: s.maxPower
  };
}
function ce(o, t) {
  o.push(t.X, t.Y, t.Z);
}
function z(o, t) {
  const n = o.transformedStart ?? o.start, e = o.transformedEnd ?? o.end;
  t.push(n.X, n.Y, n.Z, e.X, e.Y, e.Z);
}
function g(o, t, n) {
  const e = Math.max(1, Math.floor(n)), { primary: s, secondary: r } = H(o.plane), i = J(
    o.start[s],
    o.start[r],
    o.center[s],
    o.center[r]
  ), a = Math.atan2(
    o.start[r] - o.center[r],
    o.start[s] - o.center[s]
  ), c = Math.atan2(
    o.end[r] - o.center[r],
    o.end[s] - o.center[s]
  ), u = Math.PI * 2;
  let f = k(a), d = k(c);
  o.motion === "G2" ? f <= d && (f += u) : d <= f && (d += u);
  const y = o.motion === "G2" ? f - d : d - f;
  let l = { ...o.start };
  for (let h = 1; h <= e; h += 1) {
    const M = h / e, A = o.motion === "G2" ? f - y * M : f + y * M, G = Q(o.start, o.end, M);
    G[s] = o.center[s] + i * Math.cos(A), G[r] = o.center[r] + i * Math.sin(A);
    const p = T(l), w = T(G);
    t.push(
      p.X,
      p.Y,
      p.Z,
      w.X,
      w.Y,
      w.Z
    ), l = G;
  }
}
function T(o) {
  const t = o.A * Math.PI / 180, n = Math.cos(t), e = Math.sin(t), s = o.Y * n - o.Z * e, r = o.Y * e + o.Z * n;
  return { ...o, Y: s, Z: r };
}
function H(o) {
  return o === "G18" ? { primary: "Z", secondary: "X" } : o === "G19" ? { primary: "Y", secondary: "Z" } : { primary: "X", secondary: "Y" };
}
function k(o) {
  const t = Math.PI * 2;
  let n = o % t;
  return n < 0 && (n += t), n;
}
function J(o, t, n, e) {
  return Math.hypot(o - n, t - e);
}
function Q(o, t, n) {
  return {
    X: o.X + (t.X - o.X) * n,
    Y: o.Y + (t.Y - o.Y) * n,
    Z: o.Z + (t.Z - o.Z) * n,
    A: o.A + (t.A - o.A) * n,
    B: o.B + (t.B - o.B) * n,
    C: o.C + (t.C - o.C) * n
  };
}
function ee(o) {
  let t = Number.POSITIVE_INFINITY, n = Number.NEGATIVE_INFINITY;
  const e = new L({
    onLinearMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (t = Math.min(t, r), n = Math.max(n, r));
    },
    onArcMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (t = Math.min(t, r), n = Math.max(n, r));
    }
  });
  for (const s of o)
    s && e.processLine(s);
  return !Number.isFinite(t) || !Number.isFinite(n) ? { minPower: 0, maxPower: 0 } : { minPower: t, maxPower: n };
}
function B(o, t, n, e) {
  if (e <= 1)
    return 0;
  const s = o ?? t;
  if (n <= t)
    return e - 1;
  const r = (s - t) / (n - t), i = Math.floor(r * (e - 1));
  return Math.min(e - 1, Math.max(0, i));
}
function O(o, t, n) {
  if (t <= 1)
    return n;
  const e = o / (t - 1);
  return n * e;
}
function le(o) {
  const t = new Float32Array(o.vertices), n = new Uint32Array(o.frames), e = new Float32Array(o.colorArrayBuffer), { verticesLen: s, framesLen: r } = o, i = /* @__PURE__ */ new Map();
  for (let a = 0; a < r; a++) {
    const c = n[a], u = a < r - 1 ? n[a + 1] : s / 3;
    if (u <= c + 1) continue;
    const f = c * 4, d = e[f], y = e[f + 1], l = e[f + 2], h = e[f + 3], M = te(d, y, l), A = `${M}|${Math.round(h * 100)}`;
    let G = i.get(A);
    G || (G = { hexColor: M, opacity: h, pos: [], rgb: [] }, i.set(A, G));
    for (let p = c; p < u - 1; p++) {
      const w = p * 3, S = (p + 1) * 3;
      G.pos.push(t[w], t[w + 1], t[w + 2], t[S], t[S + 1], t[S + 2]), G.rgb.push(d, y, l, d, y, l);
    }
  }
  return Array.from(i.values()).map(({ hexColor: a, opacity: c, pos: u, rgb: f }) => ({
    hexColor: a,
    opacity: c,
    positions: new Float32Array(u),
    rgbColors: new Float32Array(f)
  }));
}
function te(o, t, n) {
  const e = (s) => Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, "0");
  return `#${e(o)}${e(t)}${e(n)}`;
}
function de(o) {
  const t = new Float32Array(o.vertices), n = new Uint32Array(o.frames), e = new Float32Array(o.colorArrayBuffer), { verticesLen: s, framesLen: r } = o, i = [], a = [], c = [], u = [], f = new Int32Array(r), d = new Int32Array(r);
  for (let y = 0; y < r; y++) {
    const l = n[y], h = y < r - 1 ? n[y + 1] : s / 3;
    if (h > l + 1) {
      const M = e[l * 4 + 3] < 0.75, A = M ? i : c, G = M ? a : u;
      for (let p = l; p < h - 1; p++) {
        const w = p * 3, S = (p + 1) * 3;
        A.push(t[w], t[w + 1], t[w + 2], t[S], t[S + 1], t[S + 2]);
        const I = p * 4, m = (p + 1) * 4;
        G.push(e[I], e[I + 1], e[I + 2], e[m], e[m + 1], e[m + 2]);
      }
    }
    f[y] = i.length / 3, d[y] = c.length / 3;
  }
  return {
    rapid: {
      positions: Float32Array.from(i),
      colors: Float32Array.from(a),
      prefixEndVertex: f
    },
    cut: {
      positions: Float32Array.from(c),
      colors: Float32Array.from(u),
      prefixEndVertex: d
    }
  };
}
export {
  R as GCodeParser,
  L as GCodeVirtualizer,
  K as buildLaserGeometryFromLinesBatched,
  ie as buildLaserVerticesFromLines,
  ae as buildLaserVerticesFromLinesBatched,
  se as buildMovementGeometryFromLinesBatched,
  oe as buildMovementVerticesFromLines,
  re as buildMovementVerticesFromLinesBatched,
  D as buildToolpathGeometryFromLinesBatched,
  ne as buildVerticesFromLines,
  le as buildWorkerSegmentGroups,
  de as buildWorkerToolpathStreams,
  ce as pushXYZ
};
