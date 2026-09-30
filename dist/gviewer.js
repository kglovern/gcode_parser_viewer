const q = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
class j {
  parseLine(t) {
    const e = [], o = this.stripComments(t, e), s = this.parseWords(o), r = s.filter((c) => {
      const a = c.letter.toUpperCase();
      return a === "G" || a === "M";
    }), i = s.filter((c) => {
      const a = c.letter.toUpperCase();
      return a !== "G" && a !== "M";
    });
    return {
      raw: t,
      words: s,
      gcodes: r,
      params: i,
      comments: e
    };
  }
  stripComments(t, e) {
    let o = "", s = !1, r = -1, i = "";
    for (let c = 0; c < t.length; c += 1) {
      const a = t[c];
      if (!s && a === ";") {
        const f = t.slice(c + 1);
        e.push({ type: "semicolon", text: f, start: c, end: t.length });
        break;
      }
      if (a === "(") {
        s ? i += a : (s = !0, r = c, i = "");
        continue;
      }
      if (a === ")" && s) {
        e.push({
          type: "paren",
          text: i,
          start: r,
          end: c + 1
        }), s = !1, r = -1, i = "";
        continue;
      }
      if (s) {
        i += a;
        continue;
      }
      o += a;
    }
    return s && e.push({
      type: "paren",
      text: i,
      start: r,
      end: t.length
    }), o;
  }
  parseWords(t) {
    const e = [];
    for (const o of t.matchAll(q)) {
      const s = o[0], r = o[1].toUpperCase(), i = Number(o[2]), c = o.index ?? 0, a = c + s.length;
      e.push({ letter: r, value: i, raw: s, start: c, end: a });
    }
    return e;
  }
}
const N = ["X", "Y", "Z", "A", "B", "C"], B = {
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
class E {
  constructor(t = {}) {
    this.parser = new j(), this.modals = { ...B }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.callbacks = t, this.feedRates = /* @__PURE__ */ new Set(), this.spindleSpeeds = /* @__PURE__ */ new Set(), this.tools = /* @__PURE__ */ new Set();
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
    this.modals = { ...B }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.feedRates.clear(), this.spindleSpeeds.clear(), this.tools.clear();
  }
  processLine(t) {
    const e = this.parser.parseLine(t), o = { ...this.position };
    this.updateModals(e);
    const s = this.modals.motion, r = this.modals.plane;
    let i = this.applyAxes(e, o), c, a, f = "none";
    return s === "G0" || s === "G1" ? _(o, i) || (f = "linear", this.position = { ...i }, this.emitLinear({ start: o, end: i })) : (s === "G2" || s === "G3") && (_(o, i) || (f = "arc", a = this.arcCenter(e, o, i, r), c = this.computeArcMax(o, i, s, r, a), this.position = { ...i }, this.emitArc({ start: o, end: i, max: c, center: a, plane: r, motion: s }))), {
      parsed: e,
      modals: { ...this.modals },
      start: o,
      end: i,
      movement: f,
      arcMax: c
    };
  }
  unitsScale() {
    return this.modals.units === "G20" ? 25.4 : 1;
  }
  updateModals(t) {
    for (const e of t.gcodes) {
      if (e.letter.toUpperCase() === "G") {
        const o = `G${Math.trunc(e.value)}`;
        (o === "G0" || o === "G1" || o === "G2" || o === "G3") && (this.modals.motion = o), (o === "G90" || o === "G91") && (this.modals.distance = o), (o === "G17" || o === "G18" || o === "G19") && (this.modals.plane = o), (o === "G20" || o === "G21") && (this.modals.units = o), (o === "G93" || o === "G94") && (this.modals.feedMode = o), (o === "G54" || o === "G55" || o === "G56" || o === "G57" || o === "G58" || o === "G59") && (this.modals.coordinateSystem = o);
      }
      if (e.letter.toUpperCase() === "M") {
        const o = `M${Math.trunc(e.value)}`;
        (o === "M7" || o === "M8" || o === "M9") && (this.modals.coolant = o), (o === "M3" || o === "M4" || o === "M5") && (this.modals.spindle = o);
      }
    }
    for (const e of t.params) {
      const o = e.letter.toUpperCase();
      o === "F" && (this.modals.feedRate = e.value, this.feedRates.add(e.value)), o === "S" && (this.modals.spindleSpeed = e.value, this.spindleSpeeds.add(e.value)), o === "T" && (this.modals.tool = e.value, this.tools.add(e.value));
    }
  }
  applyAxes(t, e) {
    const o = { ...e }, s = this.unitsScale();
    for (const r of N) {
      const i = t.params.find((a) => a.letter.toUpperCase() === r);
      if (!i)
        continue;
      const c = r === "X" || r === "Y" || r === "Z" ? i.value * s : i.value;
      this.modals.distance === "G90" ? o[r] = c : o[r] = o[r] + c;
    }
    return o;
  }
  computeArcMax(t, e, o, s, r) {
    const { primary: i, secondary: c, tertiary: a } = R(s), f = J(
      t[i],
      t[c],
      r[i],
      r[c]
    ), d = Math.atan2(
      t[c] - r[c],
      t[i] - r[i]
    ), u = Math.atan2(
      e[c] - r[c],
      e[i] - r[i]
    ), y = H(d, u, o);
    let l = Number.NEGATIVE_INFINITY, h = Number.NEGATIVE_INFINITY;
    for (const x of y) {
      const S = r[i] + f * Math.cos(x), M = r[c] + f * Math.sin(x);
      S > l && (l = S), M > h && (h = M);
    }
    const w = { ...t };
    w[i] = l, w[c] = h, w[a] = Math.max(t[a], e[a]);
    for (const x of N)
      x !== i && x !== c && x !== a && (w[x] = Math.max(t[x], e[x]));
    return w;
  }
  arcCenter(t, e, o, s) {
    const { primary: r, secondary: i } = R(s), c = { ...e }, a = this.unitsScale(), f = V(t, "R"), d = K(t, s), u = d.primary === null ? null : d.primary * a, y = d.secondary === null ? null : d.secondary * a;
    if (u !== null || y !== null)
      return c[r] = e[r] + (u ?? 0), c[i] = e[i] + (y ?? 0), c;
    if (f === null)
      return c;
    const l = f * a, h = e[r], w = e[i], x = o[r], S = o[i], M = x - h, P = S - w, L = Math.hypot(M, P);
    if (L === 0)
      return c;
    const G = Math.abs(l), m = Math.sqrt(Math.max(0, G * G - L / 2 * (L / 2))), A = (h + x) / 2, p = (w + S) / 2, v = -P / L, I = M / L, g = l >= 0 ? 1 : -1;
    return c[r] = A + g * v * m, c[i] = p + g * I * m, c;
  }
  emitLinear(t) {
    const e = this.callbacks.onLinearMove;
    if (!e)
      return;
    const o = t.end.A - t.start.A, s = Math.max(1, Math.ceil(Math.abs(o) / Q));
    let r = { ...t.start };
    for (let i = 1; i <= s; i += 1) {
      const c = i / s, a = tt(t.start, t.end, c), f = Y(r), d = Y(a);
      e({
        modals: { ...this.modals },
        start: { ...r },
        end: { ...a },
        transformedStart: f,
        transformedEnd: d
      }), r = a;
    }
  }
  emitArc(t) {
    const e = this.callbacks.onArcMove;
    if (!e)
      return;
    const o = Y(t.start), s = Y(t.end), r = Y(t.max), i = Y(t.center);
    e({
      modals: { ...this.modals },
      start: { ...t.start },
      end: { ...t.end },
      max: { ...t.max },
      center: { ...t.center },
      plane: t.plane,
      motion: t.motion,
      transformedStart: o,
      transformedEnd: s,
      transformedMax: r,
      transformedCenter: i
    });
  }
}
function V(n, t) {
  const e = n.params.find((o) => o.letter.toUpperCase() === t);
  return e ? e.value : null;
}
function R(n) {
  return n === "G18" ? { primary: "Z", secondary: "X", tertiary: "Y" } : n === "G19" ? { primary: "Y", secondary: "Z", tertiary: "X" } : { primary: "X", secondary: "Y", tertiary: "Z" };
}
function K(n, t) {
  const e = V(n, "I"), o = V(n, "J"), s = V(n, "K");
  return t === "G18" ? { primary: s, secondary: e } : t === "G19" ? { primary: o, secondary: s } : { primary: e, secondary: o };
}
function H(n, t, e) {
  const o = Math.PI * 2;
  let s = O(n), r = O(t);
  const i = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, o];
  if (e === "G2") {
    s < r && (s += o);
    const a = [s, r];
    for (const f of i) {
      let d = f;
      d < r && (d += o), d <= s && d >= r && a.push(d);
    }
    return a;
  }
  r < s && (r += o);
  const c = [s, r];
  for (const a of i) {
    let f = a;
    f < s && (f += o), f >= s && f <= r && c.push(f);
  }
  return c;
}
function O(n) {
  const t = Math.PI * 2;
  let e = n % t;
  return e < 0 && (e += t), e;
}
function J(n, t, e, o) {
  return Math.hypot(n - e, t - o);
}
function _(n, t) {
  return N.every((e) => n[e] === t[e]);
}
const Q = 5;
function tt(n, t, e) {
  return {
    X: n.X + (t.X - n.X) * e,
    Y: n.Y + (t.Y - n.Y) * e,
    Z: n.Z + (t.Z - n.Z) * e,
    A: n.A + (t.A - n.A) * e,
    B: n.B + (t.B - n.B) * e,
    C: n.C + (t.C - n.C) * e
  };
}
function Y(n) {
  const t = n.A * Math.PI / 180, e = Math.cos(t), o = Math.sin(t), s = n.Y * e - n.Z * o, r = n.Y * o + n.Z * e;
  return { ...n, Y: s, Z: r };
}
const T = 128, et = 127;
function lt(n, t = {}) {
  const e = [], o = t.arcSegments ?? 30, s = t.collector ?? {}, r = new E({
    onLinearMove: (i) => {
      (s.onLinearMove ?? D)(i, e);
    },
    onArcMove: (i) => {
      (s.onArcMove ?? ((a, f) => {
        F(a, f, o);
      }))(i, e);
    }
  });
  for (const i of n)
    i && r.processLine(i);
  return Float32Array.from(e);
}
function ut(n, t = {}) {
  const e = [], o = [], s = t.arcSegments ?? 30, r = new E({
    onLinearMove: (i) => {
      const c = i.transformedStart ?? i.start, a = i.transformedEnd ?? i.end;
      (i.modals.motion === "G0" ? e : o).push(c.X, c.Y, c.Z, a.X, a.Y, a.Z);
    },
    onArcMove: (i) => {
      const c = i.modals.motion === "G0" ? e : o;
      F(i, c, s);
    }
  });
  for (const i of n)
    i && r.processLine(i);
  return {
    rapid: Float32Array.from(e),
    cutting: Float32Array.from(o)
  };
}
async function ft(n, t = {}) {
  var y;
  const e = [], o = [], s = t.arcSegments ?? 30, r = t.batch, i = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), c = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let a = i, f = c > 0 ? c : Number.POSITIVE_INFINITY;
  const d = new E({
    onLinearMove: (l) => {
      const h = l.transformedStart ?? l.start, w = l.transformedEnd ?? l.end;
      (l.modals.motion === "G0" ? e : o).push(h.X, h.Y, h.Z, w.X, w.Y, w.Z);
    },
    onArcMove: (l) => {
      const h = l.modals.motion === "G0" ? e : o;
      F(l, h, s);
    }
  }), u = n.length;
  for (let l = 0; l < u; l += 1) {
    if ((y = r == null ? void 0 : r.shouldAbort) != null && y.call(r))
      throw new Error("Aborted.");
    const h = n[l];
    if (!h) {
      r != null && r.onProgress && (l + 1 === u || l + 1 === a) && (r.onProgress(l + 1, u), a += i), c > 0 && (l + 1 === u || l + 1 === f) && (await new Promise((w) => {
        setTimeout(w, 0);
      }), f += c);
      continue;
    }
    d.processLine(h), r != null && r.onProgress && (l + 1 === u || l + 1 === a) && (r.onProgress(l + 1, u), a += i), c > 0 && (l + 1 === u || l + 1 === f) && (await new Promise((w) => {
      setTimeout(w, 0);
    }), f += c);
  }
  return {
    rapid: Float32Array.from(e),
    cutting: Float32Array.from(o)
  };
}
async function dt(n, t = {}) {
  var S;
  const e = [], o = t.arcSegments ?? 30, s = t.batch, r = Math.max(1, Math.floor((s == null ? void 0 : s.everyLines) ?? 5e3)), i = Math.max(0, Math.floor((s == null ? void 0 : s.yieldEveryLines) ?? 5e4));
  let c = r, a = i > 0 ? i : Number.POSITIVE_INFINITY;
  const f = new Int32Array(n.length);
  f.fill(-1);
  const d = new Int32Array(n.length);
  d.fill(-1);
  const u = new Uint8Array(n.length), y = new Int32Array(n.length);
  let l = -1, h = 0;
  const w = new E({
    onLinearMove: (M) => {
      const P = M.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (h === 0 ? h = P : h !== P && (h = 3)), D(M, e);
    },
    onArcMove: (M) => {
      const P = M.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (h === 0 ? h = P : h !== P && (h = 3)), F(M, e, o);
    }
  }), x = n.length;
  for (let M = 0; M < x; M += 1) {
    if ((S = s == null ? void 0 : s.shouldAbort) != null && S.call(s))
      throw new Error("Aborted.");
    const P = e.length / 3;
    l = M, h = 0;
    const L = n[M];
    L && w.processLine(L), l = -1;
    const G = e.length / 3;
    G > P && (f[M] = P, d[M] = G, u[M] = h), y[M] = G, s != null && s.onProgress && (M + 1 === x || M + 1 === c) && (s.onProgress(M + 1, x), c += r), i > 0 && (M + 1 === x || M + 1 === a) && (await new Promise((m) => {
      setTimeout(m, 0);
    }), a += i);
  }
  return {
    positions: Float32Array.from(e),
    lineStartVertex: f,
    lineEndVertex: d,
    lineKind: u,
    prefixEndVertex: y
  };
}
function mt(n, t = {}) {
  const e = t.arcSegments ?? 30, o = Math.max(1, Math.floor(t.bucketCount ?? 16)), s = t.baseOpacity ?? 0.9, { minPower: r, maxPower: i } = ct(n), c = [], a = Array.from({ length: o }, () => []), f = new E({
    onLinearMove: (u) => {
      const y = u.transformedStart ?? u.start, l = u.transformedEnd ?? u.end;
      if (u.modals.motion === "G0") {
        c.push(y.X, y.Y, y.Z, l.X, l.Y, l.Z);
        return;
      }
      const h = $(u.modals.spindleSpeed, r, i, o);
      a[h].push(y.X, y.Y, y.Z, l.X, l.Y, l.Z);
    },
    onArcMove: (u) => {
      if (u.modals.motion === "G0")
        return;
      const y = $(u.modals.spindleSpeed, r, i, o), l = a[y];
      F(u, l, e);
    }
  });
  for (const u of n)
    u && f.processLine(u);
  const d = a.map((u, y) => ({
    opacity: W(y, o, s),
    vertices: Float32Array.from(u)
  }));
  return {
    rapid: Float32Array.from(c),
    buckets: d,
    minPower: r,
    maxPower: i
  };
}
async function pt(n, t = {}) {
  const e = await ot(n, t);
  return {
    rapid: e.rapidPositions,
    buckets: e.buckets.map((o) => ({ opacity: o.opacity, vertices: o.positions })),
    minPower: e.minPower,
    maxPower: e.maxPower
  };
}
async function nt(n, t = {}) {
  var L, G;
  const e = t.arcSegments ?? 30, o = Math.max(1, Math.floor(t.bucketCount ?? 16)), s = !!t.laserMode, r = t.batch, i = n.length * (s ? 2 : 1), c = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), a = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let f = c, d = a > 0 ? a : Number.POSITIVE_INFINITY, u = Number.NEGATIVE_INFINITY, y = !1;
  if (s) {
    const m = new j();
    for (const A of n) {
      if (!A)
        continue;
      if (m.parseLine(A).gcodes.some((I) => {
        if (I.letter !== "M")
          return !1;
        const g = Math.trunc(I.value);
        return g === 3 || g === 4 || g === 5;
      })) {
        y = !1;
        break;
      }
      y = !0;
    }
  }
  const l = (m) => m.spindle === "M5" || !(m.spindle === "M3" || m.spindle === "M4" || y && m.spindle === null) ? !1 : m.spindleSpeed === null ? !0 : m.spindleSpeed > 0;
  if (s) {
    const m = new E({
      onLinearMove: (A) => {
        if (!l(A.modals))
          return;
        const p = A.modals.spindleSpeed;
        p === null || p <= 0 || (u = Math.max(u, p));
      },
      onArcMove: (A) => {
        if (!l(A.modals))
          return;
        const p = A.modals.spindleSpeed;
        p === null || p <= 0 || (u = Math.max(u, p));
      }
    });
    for (let A = 0; A < n.length; A += 1) {
      if ((L = r == null ? void 0 : r.shouldAbort) != null && L.call(r))
        throw new Error("Aborted.");
      const p = n[A];
      p && m.processLine(p);
      const v = A + 1;
      r != null && r.onProgress && (v === i || v === f) && (r.onProgress(v, i), f += c), a > 0 && (v === i || v === d) && (await new Promise((I) => {
        setTimeout(I, 0);
      }), d += a);
    }
    Number.isFinite(u) || (u = 0);
  } else
    u = 0;
  const h = (m) => {
    if (o <= 1)
      return 0;
    if (m === null)
      return o - 1;
    const A = m;
    if (A <= 0)
      return 0;
    if (u <= 0)
      return o - 1;
    const p = Math.min(1, Math.max(0, A / u)), v = 1 + Math.floor(p * (o - 2));
    return Math.min(o - 1, Math.max(1, v));
  }, w = [], x = s ? Array.from({ length: o }, () => []) : [new Array()], S = new Int32Array(n.length), M = Array.from(
    { length: s ? o : 1 },
    () => new Int32Array(n.length)
  ), P = new E({
    onLinearMove: (m) => {
      const A = m.transformedStart ?? m.start, p = m.transformedEnd ?? m.end;
      if (m.modals.motion === "G0") {
        w.push(A.X, A.Y, A.Z, p.X, p.Y, p.Z);
        return;
      }
      if (s && !l(m.modals))
        return;
      const v = s ? h(m.modals.spindleSpeed) : 0;
      x[v].push(A.X, A.Y, A.Z, p.X, p.Y, p.Z);
    },
    onArcMove: (m) => {
      if (m.modals.motion === "G0" || s && !l(m.modals))
        return;
      const A = s ? h(m.modals.spindleSpeed) : 0, p = x[A];
      F(m, p, e);
    }
  });
  for (let m = 0; m < n.length; m += 1) {
    if ((G = r == null ? void 0 : r.shouldAbort) != null && G.call(r))
      throw new Error("Aborted.");
    const A = n[m];
    A && P.processLine(A), S[m] = w.length / 3;
    for (let v = 0; v < x.length; v += 1)
      M[v][m] = x[v].length / 3;
    const p = s ? n.length + m + 1 : m + 1;
    r != null && r.onProgress && (p === i || p === f) && (r.onProgress(p, i), f += c), a > 0 && (p === i || p === d) && (await new Promise((v) => {
      setTimeout(v, 0);
    }), d += a);
  }
  return {
    rapid: { positions: Float32Array.from(w), prefixEndVertex: S },
    cuts: x.map((m, A) => ({
      positions: Float32Array.from(m),
      prefixEndVertex: M[A]
    })),
    cutBucketCount: x.length,
    minPower: 0,
    maxPower: u
  };
}
async function ot(n, t = {}) {
  const e = Math.max(1, Math.floor(t.bucketCount ?? 16)), o = t.baseOpacity ?? 0.9, s = await nt(n, {
    arcSegments: t.arcSegments,
    bucketCount: e,
    laserMode: !0,
    batch: t.batch
  }), r = s.cuts.map((i, c) => ({
    opacity: W(c, e, o),
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
function ht(n, t) {
  n.push(t.X, t.Y, t.Z);
}
function D(n, t) {
  const e = n.transformedStart ?? n.start, o = n.transformedEnd ?? n.end;
  t.push(e.X, e.Y, e.Z, o.X, o.Y, o.Z);
}
function F(n, t, e) {
  const o = Math.max(1, Math.floor(e)), { primary: s, secondary: r } = rt(n.plane), i = st(
    n.start[s],
    n.start[r],
    n.center[s],
    n.center[r]
  ), c = Math.atan2(
    n.start[r] - n.center[r],
    n.start[s] - n.center[s]
  ), a = Math.atan2(
    n.end[r] - n.center[r],
    n.end[s] - n.center[s]
  ), f = Math.PI * 2;
  let d = U(c), u = U(a);
  n.motion === "G2" ? d <= u && (d += f) : u <= d && (u += f);
  const y = n.motion === "G2" ? d - u : u - d;
  let l = { ...n.start };
  for (let h = 1; h <= o; h += 1) {
    const w = h / o, x = n.motion === "G2" ? d - y * w : d + y * w, S = it(n.start, n.end, w);
    S[s] = n.center[s] + i * Math.cos(x), S[r] = n.center[r] + i * Math.sin(x);
    const M = z(l), P = z(S);
    t.push(
      M.X,
      M.Y,
      M.Z,
      P.X,
      P.Y,
      P.Z
    ), l = S;
  }
}
function z(n) {
  const t = n.A * Math.PI / 180, e = Math.cos(t), o = Math.sin(t), s = n.Y * e - n.Z * o, r = n.Y * o + n.Z * e;
  return { ...n, Y: s, Z: r };
}
function rt(n) {
  return n === "G18" ? { primary: "Z", secondary: "X" } : n === "G19" ? { primary: "Y", secondary: "Z" } : { primary: "X", secondary: "Y" };
}
function U(n) {
  const t = Math.PI * 2;
  let e = n % t;
  return e < 0 && (e += t), e;
}
function st(n, t, e, o) {
  return Math.hypot(n - e, t - o);
}
function it(n, t, e) {
  return {
    X: n.X + (t.X - n.X) * e,
    Y: n.Y + (t.Y - n.Y) * e,
    Z: n.Z + (t.Z - n.Z) * e,
    A: n.A + (t.A - n.A) * e,
    B: n.B + (t.B - n.B) * e,
    C: n.C + (t.C - n.C) * e
  };
}
function ct(n) {
  let t = Number.POSITIVE_INFINITY, e = Number.NEGATIVE_INFINITY;
  const o = new E({
    onLinearMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (t = Math.min(t, r), e = Math.max(e, r));
    },
    onArcMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (t = Math.min(t, r), e = Math.max(e, r));
    }
  });
  for (const s of n)
    s && o.processLine(s);
  return !Number.isFinite(t) || !Number.isFinite(e) ? { minPower: 0, maxPower: 0 } : { minPower: t, maxPower: e };
}
function $(n, t, e, o) {
  if (o <= 1)
    return 0;
  const s = n ?? t;
  if (e <= t)
    return o - 1;
  const r = (s - t) / (e - t), i = Math.floor(r * (o - 1));
  return Math.min(o - 1, Math.max(0, i));
}
function W(n, t, e) {
  if (t <= 1)
    return e;
  const o = n / (t - 1);
  return e * o;
}
function yt(n) {
  const t = new Float32Array(n.vertices), e = new Uint32Array(n.frames), o = new Float32Array(n.colorArrayBuffer), { verticesLen: s, framesLen: r } = n, i = /* @__PURE__ */ new Map();
  for (let c = 0; c < r; c++) {
    const a = e[c], f = c < r - 1 ? e[c + 1] : s / 3;
    if (f <= a + 1) continue;
    const d = a * 4, u = o[d], y = o[d + 1], l = o[d + 2], h = o[d + 3], w = at(u, y, l), x = `${w}|${Math.round(h * 100)}`;
    let S = i.get(x);
    S || (S = { hexColor: w, opacity: h, pos: [], rgb: [] }, i.set(x, S));
    for (let M = a; M < f - 1; M++) {
      const P = M * 3, L = (M + 1) * 3;
      S.pos.push(t[P], t[P + 1], t[P + 2], t[L], t[L + 1], t[L + 2]), S.rgb.push(u, y, l, u, y, l);
    }
  }
  return Array.from(i.values()).map(({ hexColor: c, opacity: a, pos: f, rgb: d }) => ({
    hexColor: c,
    opacity: a,
    positions: new Float32Array(f),
    rgbColors: new Float32Array(d)
  }));
}
function Mt(n, t) {
  const e = (n.toolchangeCount ?? 0) > 0 ? n.paletteHex : void 0, o = !!n.isLaser, s = (c) => c & T ? -1 : c & et, r = /* @__PURE__ */ new Map();
  for (const c of n.chunks) {
    const a = new Uint8Array(c.attrs, 0, c.vertexCount), f = o && c.power ? new Float32Array(c.power, 0, c.vertexCount) : null;
    for (let d = 0; d < c.vertexCount; d += 2) {
      const u = a[d];
      if (f && !(u & T) && f[d] === 0) continue;
      const y = s(u);
      r.set(y, (r.get(y) ?? 0) + 1);
    }
  }
  const i = /* @__PURE__ */ new Map();
  for (const [c, a] of r) {
    const f = c < 0 ? t.rapidColor : (e == null ? void 0 : e[c]) ?? t.cutColor, d = c < 0 ? t.rapidOpacity ?? 0.5 : 1;
    i.set(c, { hexColor: f, opacity: d, positions: new Float32Array(a * 6), length: 0 });
  }
  for (const c of n.chunks) {
    const a = new Float32Array(c.positions, 0, c.vertexCount * 3), f = new Uint8Array(c.attrs, 0, c.vertexCount), d = o && c.power ? new Float32Array(c.power, 0, c.vertexCount) : null;
    for (let u = 0; u < c.vertexCount; u += 2) {
      const y = f[u];
      if (d && !(y & T) && d[u] === 0) continue;
      const l = i.get(s(y));
      l.positions.set(a.subarray(u * 3, u * 3 + 6), l.length), l.length += 6;
    }
  }
  return Array.from(i.values()).map(({ hexColor: c, opacity: a, positions: f }) => ({ hexColor: c, opacity: a, positions: f }));
}
function at(n, t, e) {
  const o = (s) => Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, "0");
  return `#${o(n)}${o(t)}${o(e)}`;
}
function At(n, t) {
  const e = new Float32Array(n.vertices), o = new Uint32Array(n.frames), s = new Float32Array(n.colorArrayBuffer), i = (n.isLaser && n.savedColorsBuffer && n.savedColorLen ? new Float32Array(n.savedColorsBuffer) : null) ?? s, { verticesLen: c, framesLen: a } = n, f = (t == null ? void 0 : t.lineGroups) ?? [], d = f.length, u = d + 1, y = new Int32Array(a).fill(d);
  for (let G = f.length - 1; G >= 0; G--) {
    const m = Math.max(0, Math.floor(f[G].start)), A = Math.min(a - 1, Math.floor(f[G].end));
    for (let p = m; p <= A; p++)
      y[p] = G;
  }
  const l = (G) => Array.from({ length: u }, G), h = l(() => []), w = l(() => []), x = l(() => []), S = l(() => []), M = l(() => new Int32Array(a)), P = l(() => new Int32Array(a));
  for (let G = 0; G < a; G++) {
    const m = o[G], A = G < a - 1 ? o[G + 1] : c / 3;
    if (A > m + 1) {
      const p = s[m * 4 + 3] < 0.75, v = y[G], I = p ? h[v] : x[v], g = p ? w[v] : S[v];
      for (let C = m; C < A - 1; C++) {
        const Z = C * 3, k = (C + 1) * 3;
        I.push(e[Z], e[Z + 1], e[Z + 2], e[k], e[k + 1], e[k + 2]);
        const b = C * 4, X = (C + 1) * 4;
        g.push(i[b], i[b + 1], i[b + 2], i[X], i[X + 1], i[X + 2]);
      }
    }
    for (let p = 0; p < u; p++)
      M[p][G] = h[p].length / 3, P[p][G] = x[p].length / 3;
  }
  const L = (G, m, A) => G.map((p, v) => ({
    positions: Float32Array.from(p),
    colors: Float32Array.from(m[v]),
    prefixEndVertex: A[v],
    lineGroupIndex: v === d ? null : v
  }));
  return {
    rapids: L(h, w, M),
    cuts: L(x, S, P)
  };
}
export {
  j as GCodeParser,
  E as GCodeVirtualizer,
  T as SEGMENT_ATTR_RAPID,
  et as SEGMENT_ATTR_SLOT_MASK,
  ot as buildLaserGeometryFromLinesBatched,
  mt as buildLaserVerticesFromLines,
  pt as buildLaserVerticesFromLinesBatched,
  dt as buildMovementGeometryFromLinesBatched,
  ut as buildMovementVerticesFromLines,
  ft as buildMovementVerticesFromLinesBatched,
  Mt as buildSegmentsSegmentGroups,
  nt as buildToolpathGeometryFromLinesBatched,
  lt as buildVerticesFromLines,
  yt as buildWorkerSegmentGroups,
  At as buildWorkerToolpathStreams,
  ht as pushXYZ
};
