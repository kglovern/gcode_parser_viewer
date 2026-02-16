const _ = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
class z {
  parseLine(e) {
    const t = [], n = this.stripComments(e, t), s = this.parseWords(n), r = s.filter((a) => {
      const c = a.letter.toUpperCase();
      return c === "G" || c === "M";
    }), i = s.filter((a) => {
      const c = a.letter.toUpperCase();
      return c !== "G" && c !== "M";
    });
    return {
      raw: e,
      words: s,
      gcodes: r,
      params: i,
      comments: t
    };
  }
  stripComments(e, t) {
    let n = "", s = !1, r = -1, i = "";
    for (let a = 0; a < e.length; a += 1) {
      const c = e[a];
      if (!s && c === ";") {
        const u = e.slice(a + 1);
        t.push({ type: "semicolon", text: u, start: a, end: e.length });
        break;
      }
      if (c === "(") {
        s ? i += c : (s = !0, r = a, i = "");
        continue;
      }
      if (c === ")" && s) {
        t.push({
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
      n += c;
    }
    return s && t.push({
      type: "paren",
      text: i,
      start: r,
      end: e.length
    }), n;
  }
  parseWords(e) {
    const t = [];
    for (const n of e.matchAll(_)) {
      const s = n[0], r = n[1].toUpperCase(), i = Number(n[2]), a = n.index ?? 0, c = a + s.length;
      t.push({ letter: r, value: i, raw: s, start: a, end: c });
    }
    return t;
  }
}
const C = ["X", "Y", "Z", "A", "B", "C"], N = {
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
  constructor(e = {}) {
    this.parser = new z(), this.modals = { ...N }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.callbacks = e, this.feedRates = /* @__PURE__ */ new Set(), this.spindleSpeeds = /* @__PURE__ */ new Set(), this.tools = /* @__PURE__ */ new Set();
  }
  setCallbacks(e) {
    this.callbacks = e;
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
    this.modals = { ...N }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.feedRates.clear(), this.spindleSpeeds.clear(), this.tools.clear();
  }
  processLine(e) {
    const t = this.parser.parseLine(e), n = { ...this.position };
    this.updateModals(t);
    const s = this.modals.motion, r = this.modals.plane;
    let i = this.applyAxes(t, n), a, c, u = "none";
    return s === "G0" || s === "G1" ? T(n, i) || (u = "linear", this.position = { ...i }, this.emitLinear({ start: n, end: i })) : (s === "G2" || s === "G3") && (T(n, i) || (u = "arc", c = this.arcCenter(t, n, i, r), a = this.computeArcMax(n, i, s, r, c), this.position = { ...i }, this.emitArc({ start: n, end: i, max: a, center: c, plane: r, motion: s }))), {
      parsed: t,
      modals: { ...this.modals },
      start: n,
      end: i,
      movement: u,
      arcMax: a
    };
  }
  unitsScale() {
    return this.modals.units === "G20" ? 25.4 : 1;
  }
  updateModals(e) {
    for (const t of e.gcodes) {
      if (t.letter.toUpperCase() === "G") {
        const n = `G${Math.trunc(t.value)}`;
        (n === "G0" || n === "G1" || n === "G2" || n === "G3") && (this.modals.motion = n), (n === "G90" || n === "G91") && (this.modals.distance = n), (n === "G17" || n === "G18" || n === "G19") && (this.modals.plane = n), (n === "G20" || n === "G21") && (this.modals.units = n), (n === "G93" || n === "G94") && (this.modals.feedMode = n), (n === "G54" || n === "G55" || n === "G56" || n === "G57" || n === "G58" || n === "G59") && (this.modals.coordinateSystem = n);
      }
      if (t.letter.toUpperCase() === "M") {
        const n = `M${Math.trunc(t.value)}`;
        (n === "M7" || n === "M8" || n === "M9") && (this.modals.coolant = n), (n === "M3" || n === "M4" || n === "M5") && (this.modals.spindle = n);
      }
    }
    for (const t of e.params) {
      const n = t.letter.toUpperCase();
      n === "F" && (this.modals.feedRate = t.value, this.feedRates.add(t.value)), n === "S" && (this.modals.spindleSpeed = t.value, this.spindleSpeeds.add(t.value)), n === "T" && (this.modals.tool = t.value, this.tools.add(t.value));
    }
  }
  applyAxes(e, t) {
    const n = { ...t }, s = this.unitsScale();
    for (const r of C) {
      const i = e.params.find((c) => c.letter.toUpperCase() === r);
      if (!i)
        continue;
      const a = r === "X" || r === "Y" || r === "Z" ? i.value * s : i.value;
      this.modals.distance === "G90" ? n[r] = a : n[r] = n[r] + a;
    }
    return n;
  }
  computeArcMax(e, t, n, s, r) {
    const { primary: i, secondary: a, tertiary: c } = F(s), u = q(
      e[i],
      e[a],
      r[i],
      r[a]
    ), m = Math.atan2(
      e[a] - r[a],
      e[i] - r[i]
    ), d = Math.atan2(
      t[a] - r[a],
      t[i] - r[i]
    ), x = $(m, d, n);
    let l = Number.NEGATIVE_INFINITY, p = Number.NEGATIVE_INFINITY;
    for (const A of x) {
      const S = r[i] + u * Math.cos(A), M = r[a] + u * Math.sin(A);
      S > l && (l = S), M > p && (p = M);
    }
    const v = { ...e };
    v[i] = l, v[a] = p, v[c] = Math.max(e[c], t[c]);
    for (const A of C)
      A !== i && A !== a && A !== c && (v[A] = Math.max(e[A], t[A]));
    return v;
  }
  arcCenter(e, t, n, s) {
    const { primary: r, secondary: i } = F(s), a = { ...t }, c = this.unitsScale(), u = V(e, "R"), m = U(e, s), d = m.primary === null ? null : m.primary * c, x = m.secondary === null ? null : m.secondary * c;
    if (d !== null || x !== null)
      return a[r] = t[r] + (d ?? 0), a[i] = t[i] + (x ?? 0), a;
    if (u === null)
      return a;
    const l = u * c, p = t[r], v = t[i], A = n[r], S = n[i], M = A - p, w = S - v, P = Math.hypot(M, w);
    if (P === 0)
      return a;
    const I = Math.abs(l), f = Math.sqrt(Math.max(0, I * I - P / 2 * (P / 2))), h = (p + A) / 2, y = (v + S) / 2, G = -w / P, Y = M / P, E = l >= 0 ? 1 : -1;
    return a[r] = h + E * G * f, a[i] = y + E * Y * f, a;
  }
  emitLinear(e) {
    const t = this.callbacks.onLinearMove;
    if (!t)
      return;
    const n = e.end.A - e.start.A, s = Math.max(1, Math.ceil(Math.abs(n) / D));
    let r = { ...e.start };
    for (let i = 1; i <= s; i += 1) {
      const a = i / s, c = W(e.start, e.end, a), u = Z(r), m = Z(c);
      t({
        modals: { ...this.modals },
        start: { ...r },
        end: { ...c },
        transformedStart: u,
        transformedEnd: m
      }), r = c;
    }
  }
  emitArc(e) {
    const t = this.callbacks.onArcMove;
    if (!t)
      return;
    const n = Z(e.start), s = Z(e.end), r = Z(e.max), i = Z(e.center);
    t({
      modals: { ...this.modals },
      start: { ...e.start },
      end: { ...e.end },
      max: { ...e.max },
      center: { ...e.center },
      plane: e.plane,
      motion: e.motion,
      transformedStart: n,
      transformedEnd: s,
      transformedMax: r,
      transformedCenter: i
    });
  }
}
function V(o, e) {
  const t = o.params.find((n) => n.letter.toUpperCase() === e);
  return t ? t.value : null;
}
function F(o) {
  return o === "G18" ? { primary: "Z", secondary: "X", tertiary: "Y" } : o === "G19" ? { primary: "Y", secondary: "Z", tertiary: "X" } : { primary: "X", secondary: "Y", tertiary: "Z" };
}
function U(o, e) {
  const t = V(o, "I"), n = V(o, "J"), s = V(o, "K");
  return e === "G18" ? { primary: s, secondary: t } : e === "G19" ? { primary: n, secondary: s } : { primary: t, secondary: n };
}
function $(o, e, t) {
  const n = Math.PI * 2;
  let s = g(o), r = g(e);
  const i = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, n];
  if (t === "G2") {
    s < r && (s += n);
    const c = [s, r];
    for (const u of i) {
      let m = u;
      m < r && (m += n), m <= s && m >= r && c.push(m);
    }
    return c;
  }
  r < s && (r += n);
  const a = [s, r];
  for (const c of i) {
    let u = c;
    u < s && (u += n), u >= s && u <= r && a.push(u);
  }
  return a;
}
function g(o) {
  const e = Math.PI * 2;
  let t = o % e;
  return t < 0 && (t += e), t;
}
function q(o, e, t, n) {
  return Math.hypot(o - t, e - n);
}
function T(o, e) {
  return C.every((t) => o[t] === e[t]);
}
const D = 5;
function W(o, e, t) {
  return {
    X: o.X + (e.X - o.X) * t,
    Y: o.Y + (e.Y - o.Y) * t,
    Z: o.Z + (e.Z - o.Z) * t,
    A: o.A + (e.A - o.A) * t,
    B: o.B + (e.B - o.B) * t,
    C: o.C + (e.C - o.C) * t
  };
}
function Z(o) {
  const e = o.A * Math.PI / 180, t = Math.cos(e), n = Math.sin(e), s = o.Y * t - o.Z * n, r = o.Y * n + o.Z * t;
  return { ...o, Y: s, Z: r };
}
function te(o, e = {}) {
  const t = [], n = e.arcSegments ?? 30, s = e.collector ?? {}, r = new L({
    onLinearMove: (i) => {
      (s.onLinearMove ?? O)(i, t);
    },
    onArcMove: (i) => {
      (s.onArcMove ?? ((c, u) => {
        X(c, u, n);
      }))(i, t);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return Float32Array.from(t);
}
function ne(o, e = {}) {
  const t = [], n = [], s = e.arcSegments ?? 30, r = new L({
    onLinearMove: (i) => {
      const a = i.transformedStart ?? i.start, c = i.transformedEnd ?? i.end;
      (i.modals.motion === "G0" ? t : n).push(a.X, a.Y, a.Z, c.X, c.Y, c.Z);
    },
    onArcMove: (i) => {
      const a = i.modals.motion === "G0" ? t : n;
      X(i, a, s);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return {
    rapid: Float32Array.from(t),
    cutting: Float32Array.from(n)
  };
}
async function oe(o, e = {}) {
  var x;
  const t = [], n = [], s = e.arcSegments ?? 30, r = e.batch, i = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), a = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let c = i, u = a > 0 ? a : Number.POSITIVE_INFINITY;
  const m = new L({
    onLinearMove: (l) => {
      const p = l.transformedStart ?? l.start, v = l.transformedEnd ?? l.end;
      (l.modals.motion === "G0" ? t : n).push(p.X, p.Y, p.Z, v.X, v.Y, v.Z);
    },
    onArcMove: (l) => {
      const p = l.modals.motion === "G0" ? t : n;
      X(l, p, s);
    }
  }), d = o.length;
  for (let l = 0; l < d; l += 1) {
    if ((x = r == null ? void 0 : r.shouldAbort) != null && x.call(r))
      throw new Error("Aborted.");
    const p = o[l];
    if (!p) {
      r != null && r.onProgress && (l + 1 === d || l + 1 === c) && (r.onProgress(l + 1, d), c += i), a > 0 && (l + 1 === d || l + 1 === u) && (await new Promise((v) => {
        setTimeout(v, 0);
      }), u += a);
      continue;
    }
    m.processLine(p), r != null && r.onProgress && (l + 1 === d || l + 1 === c) && (r.onProgress(l + 1, d), c += i), a > 0 && (l + 1 === d || l + 1 === u) && (await new Promise((v) => {
      setTimeout(v, 0);
    }), u += a);
  }
  return {
    rapid: Float32Array.from(t),
    cutting: Float32Array.from(n)
  };
}
async function re(o, e = {}) {
  var S;
  const t = [], n = e.arcSegments ?? 30, s = e.batch, r = Math.max(1, Math.floor((s == null ? void 0 : s.everyLines) ?? 5e3)), i = Math.max(0, Math.floor((s == null ? void 0 : s.yieldEveryLines) ?? 5e4));
  let a = r, c = i > 0 ? i : Number.POSITIVE_INFINITY;
  const u = new Int32Array(o.length);
  u.fill(-1);
  const m = new Int32Array(o.length);
  m.fill(-1);
  const d = new Uint8Array(o.length), x = new Int32Array(o.length);
  let l = -1, p = 0;
  const v = new L({
    onLinearMove: (M) => {
      const w = M.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (p === 0 ? p = w : p !== w && (p = 3)), O(M, t);
    },
    onArcMove: (M) => {
      const w = M.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (p === 0 ? p = w : p !== w && (p = 3)), X(M, t, n);
    }
  }), A = o.length;
  for (let M = 0; M < A; M += 1) {
    if ((S = s == null ? void 0 : s.shouldAbort) != null && S.call(s))
      throw new Error("Aborted.");
    const w = t.length / 3;
    l = M, p = 0;
    const P = o[M];
    P && v.processLine(P), l = -1;
    const I = t.length / 3;
    I > w && (u[M] = w, m[M] = I, d[M] = p), x[M] = I, s != null && s.onProgress && (M + 1 === A || M + 1 === a) && (s.onProgress(M + 1, A), a += r), i > 0 && (M + 1 === A || M + 1 === c) && (await new Promise((f) => {
      setTimeout(f, 0);
    }), c += i);
  }
  return {
    positions: Float32Array.from(t),
    lineStartVertex: u,
    lineEndVertex: m,
    lineKind: d,
    prefixEndVertex: x
  };
}
function se(o, e = {}) {
  const t = e.arcSegments ?? 30, n = Math.max(1, Math.floor(e.bucketCount ?? 16)), s = e.baseOpacity ?? 0.9, { minPower: r, maxPower: i } = ee(o), a = [], c = Array.from({ length: n }, () => []), u = new L({
    onLinearMove: (d) => {
      const x = d.transformedStart ?? d.start, l = d.transformedEnd ?? d.end;
      if (d.modals.motion === "G0") {
        a.push(x.X, x.Y, x.Z, l.X, l.Y, l.Z);
        return;
      }
      const p = B(d.modals.spindleSpeed, r, i, n);
      c[p].push(x.X, x.Y, x.Z, l.X, l.Y, l.Z);
    },
    onArcMove: (d) => {
      if (d.modals.motion === "G0")
        return;
      const x = B(d.modals.spindleSpeed, r, i, n), l = c[x];
      X(d, l, t);
    }
  });
  for (const d of o)
    d && u.processLine(d);
  const m = c.map((d, x) => ({
    opacity: R(x, n, s),
    vertices: Float32Array.from(d)
  }));
  return {
    rapid: Float32Array.from(a),
    buckets: m,
    minPower: r,
    maxPower: i
  };
}
async function ie(o, e = {}) {
  const t = await j(o, e);
  return {
    rapid: t.rapidPositions,
    buckets: t.buckets.map((n) => ({ opacity: n.opacity, vertices: n.positions })),
    minPower: t.minPower,
    maxPower: t.maxPower
  };
}
async function K(o, e = {}) {
  var P, I;
  const t = e.arcSegments ?? 30, n = Math.max(1, Math.floor(e.bucketCount ?? 16)), s = !!e.laserMode, r = e.batch, i = o.length * (s ? 2 : 1), a = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), c = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let u = a, m = c > 0 ? c : Number.POSITIVE_INFINITY, d = Number.NEGATIVE_INFINITY, x = !1;
  if (s) {
    const f = new z();
    for (const h of o) {
      if (!h)
        continue;
      if (f.parseLine(h).gcodes.some((Y) => {
        if (Y.letter !== "M")
          return !1;
        const E = Math.trunc(Y.value);
        return E === 3 || E === 4 || E === 5;
      })) {
        x = !1;
        break;
      }
      x = !0;
    }
  }
  const l = (f) => f.spindle === "M5" || !(f.spindle === "M3" || f.spindle === "M4" || x && f.spindle === null) ? !1 : f.spindleSpeed === null ? !0 : f.spindleSpeed > 0;
  if (s) {
    const f = new L({
      onLinearMove: (h) => {
        if (!l(h.modals))
          return;
        const y = h.modals.spindleSpeed;
        y === null || y <= 0 || (d = Math.max(d, y));
      },
      onArcMove: (h) => {
        if (!l(h.modals))
          return;
        const y = h.modals.spindleSpeed;
        y === null || y <= 0 || (d = Math.max(d, y));
      }
    });
    for (let h = 0; h < o.length; h += 1) {
      if ((P = r == null ? void 0 : r.shouldAbort) != null && P.call(r))
        throw new Error("Aborted.");
      const y = o[h];
      y && f.processLine(y);
      const G = h + 1;
      r != null && r.onProgress && (G === i || G === u) && (r.onProgress(G, i), u += a), c > 0 && (G === i || G === m) && (await new Promise((Y) => {
        setTimeout(Y, 0);
      }), m += c);
    }
    Number.isFinite(d) || (d = 0);
  } else
    d = 0;
  const p = (f) => {
    if (n <= 1)
      return 0;
    if (f === null)
      return n - 1;
    const h = f;
    if (h <= 0)
      return 0;
    if (d <= 0)
      return n - 1;
    const y = Math.min(1, Math.max(0, h / d)), G = 1 + Math.floor(y * (n - 2));
    return Math.min(n - 1, Math.max(1, G));
  }, v = [], A = s ? Array.from({ length: n }, () => []) : [new Array()], S = new Int32Array(o.length), M = Array.from(
    { length: s ? n : 1 },
    () => new Int32Array(o.length)
  ), w = new L({
    onLinearMove: (f) => {
      const h = f.transformedStart ?? f.start, y = f.transformedEnd ?? f.end;
      if (f.modals.motion === "G0") {
        v.push(h.X, h.Y, h.Z, y.X, y.Y, y.Z);
        return;
      }
      if (s && !l(f.modals))
        return;
      const G = s ? p(f.modals.spindleSpeed) : 0;
      A[G].push(h.X, h.Y, h.Z, y.X, y.Y, y.Z);
    },
    onArcMove: (f) => {
      if (f.modals.motion === "G0" || s && !l(f.modals))
        return;
      const h = s ? p(f.modals.spindleSpeed) : 0, y = A[h];
      X(f, y, t);
    }
  });
  for (let f = 0; f < o.length; f += 1) {
    if ((I = r == null ? void 0 : r.shouldAbort) != null && I.call(r))
      throw new Error("Aborted.");
    const h = o[f];
    h && w.processLine(h), S[f] = v.length / 3;
    for (let G = 0; G < A.length; G += 1)
      M[G][f] = A[G].length / 3;
    const y = s ? o.length + f + 1 : f + 1;
    r != null && r.onProgress && (y === i || y === u) && (r.onProgress(y, i), u += a), c > 0 && (y === i || y === m) && (await new Promise((G) => {
      setTimeout(G, 0);
    }), m += c);
  }
  return {
    rapid: { positions: Float32Array.from(v), prefixEndVertex: S },
    cuts: A.map((f, h) => ({
      positions: Float32Array.from(f),
      prefixEndVertex: M[h]
    })),
    cutBucketCount: A.length,
    minPower: 0,
    maxPower: d
  };
}
async function j(o, e = {}) {
  const t = Math.max(1, Math.floor(e.bucketCount ?? 16)), n = e.baseOpacity ?? 0.9, s = await K(o, {
    arcSegments: e.arcSegments,
    bucketCount: t,
    laserMode: !0,
    batch: e.batch
  }), r = s.cuts.map((i, a) => ({
    opacity: R(a, t, n),
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
function ae(o, e) {
  o.push(e.X, e.Y, e.Z);
}
function O(o, e) {
  const t = o.transformedStart ?? o.start, n = o.transformedEnd ?? o.end;
  e.push(t.X, t.Y, t.Z, n.X, n.Y, n.Z);
}
function X(o, e, t) {
  const n = Math.max(1, Math.floor(t)), { primary: s, secondary: r } = J(o.plane), i = H(
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
  let m = k(a), d = k(c);
  o.motion === "G2" ? m <= d && (m += u) : d <= m && (d += u);
  const x = o.motion === "G2" ? m - d : d - m;
  let l = { ...o.start };
  for (let p = 1; p <= n; p += 1) {
    const v = p / n, A = o.motion === "G2" ? m - x * v : m + x * v, S = Q(o.start, o.end, v);
    S[s] = o.center[s] + i * Math.cos(A), S[r] = o.center[r] + i * Math.sin(A);
    const M = b(l), w = b(S);
    e.push(
      M.X,
      M.Y,
      M.Z,
      w.X,
      w.Y,
      w.Z
    ), l = S;
  }
}
function b(o) {
  const e = o.A * Math.PI / 180, t = Math.cos(e), n = Math.sin(e), s = o.Y * t - o.Z * n, r = o.Y * n + o.Z * t;
  return { ...o, Y: s, Z: r };
}
function J(o) {
  return o === "G18" ? { primary: "Z", secondary: "X" } : o === "G19" ? { primary: "Y", secondary: "Z" } : { primary: "X", secondary: "Y" };
}
function k(o) {
  const e = Math.PI * 2;
  let t = o % e;
  return t < 0 && (t += e), t;
}
function H(o, e, t, n) {
  return Math.hypot(o - t, e - n);
}
function Q(o, e, t) {
  return {
    X: o.X + (e.X - o.X) * t,
    Y: o.Y + (e.Y - o.Y) * t,
    Z: o.Z + (e.Z - o.Z) * t,
    A: o.A + (e.A - o.A) * t,
    B: o.B + (e.B - o.B) * t,
    C: o.C + (e.C - o.C) * t
  };
}
function ee(o) {
  let e = Number.POSITIVE_INFINITY, t = Number.NEGATIVE_INFINITY;
  const n = new L({
    onLinearMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (e = Math.min(e, r), t = Math.max(t, r));
    },
    onArcMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (e = Math.min(e, r), t = Math.max(t, r));
    }
  });
  for (const s of o)
    s && n.processLine(s);
  return !Number.isFinite(e) || !Number.isFinite(t) ? { minPower: 0, maxPower: 0 } : { minPower: e, maxPower: t };
}
function B(o, e, t, n) {
  if (n <= 1)
    return 0;
  const s = o ?? e;
  if (t <= e)
    return n - 1;
  const r = (s - e) / (t - e), i = Math.floor(r * (n - 1));
  return Math.min(n - 1, Math.max(0, i));
}
function R(o, e, t) {
  if (e <= 1)
    return t;
  const n = o / (e - 1);
  return t * n;
}
export {
  z as GCodeParser,
  L as GCodeVirtualizer,
  j as buildLaserGeometryFromLinesBatched,
  se as buildLaserVerticesFromLines,
  ie as buildLaserVerticesFromLinesBatched,
  re as buildMovementGeometryFromLinesBatched,
  ne as buildMovementVerticesFromLines,
  oe as buildMovementVerticesFromLinesBatched,
  K as buildToolpathGeometryFromLinesBatched,
  te as buildVerticesFromLines,
  ae as pushXYZ
};
