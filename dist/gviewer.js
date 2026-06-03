const U = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
class R {
  parseLine(e) {
    const n = [], t = this.stripComments(e, n), s = this.parseWords(t), r = s.filter((a) => {
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
      comments: n
    };
  }
  stripComments(e, n) {
    let t = "", s = !1, r = -1, i = "";
    for (let a = 0; a < e.length; a += 1) {
      const c = e[a];
      if (!s && c === ";") {
        const u = e.slice(a + 1);
        n.push({ type: "semicolon", text: u, start: a, end: e.length });
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
      t += c;
    }
    return s && n.push({
      type: "paren",
      text: i,
      start: r,
      end: e.length
    }), t;
  }
  parseWords(e) {
    const n = [];
    for (const t of e.matchAll(U)) {
      const s = t[0], r = t[1].toUpperCase(), i = Number(t[2]), a = t.index ?? 0, c = a + s.length;
      n.push({ letter: r, value: i, raw: s, start: a, end: c });
    }
    return n;
  }
}
const X = ["X", "Y", "Z", "A", "B", "C"], C = {
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
    this.parser = new R(), this.modals = { ...C }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.callbacks = e, this.feedRates = /* @__PURE__ */ new Set(), this.spindleSpeeds = /* @__PURE__ */ new Set(), this.tools = /* @__PURE__ */ new Set();
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
    this.modals = { ...C }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.feedRates.clear(), this.spindleSpeeds.clear(), this.tools.clear();
  }
  processLine(e) {
    const n = this.parser.parseLine(e), t = { ...this.position };
    this.updateModals(n);
    const s = this.modals.motion, r = this.modals.plane;
    let i = this.applyAxes(n, t), a, c, u = "none";
    return s === "G0" || s === "G1" ? N(t, i) || (u = "linear", this.position = { ...i }, this.emitLinear({ start: t, end: i })) : (s === "G2" || s === "G3") && (N(t, i) || (u = "arc", c = this.arcCenter(n, t, i, r), a = this.computeArcMax(t, i, s, r, c), this.position = { ...i }, this.emitArc({ start: t, end: i, max: a, center: c, plane: r, motion: s }))), {
      parsed: n,
      modals: { ...this.modals },
      start: t,
      end: i,
      movement: u,
      arcMax: a
    };
  }
  unitsScale() {
    return this.modals.units === "G20" ? 25.4 : 1;
  }
  updateModals(e) {
    for (const n of e.gcodes) {
      if (n.letter.toUpperCase() === "G") {
        const t = `G${Math.trunc(n.value)}`;
        (t === "G0" || t === "G1" || t === "G2" || t === "G3") && (this.modals.motion = t), (t === "G90" || t === "G91") && (this.modals.distance = t), (t === "G17" || t === "G18" || t === "G19") && (this.modals.plane = t), (t === "G20" || t === "G21") && (this.modals.units = t), (t === "G93" || t === "G94") && (this.modals.feedMode = t), (t === "G54" || t === "G55" || t === "G56" || t === "G57" || t === "G58" || t === "G59") && (this.modals.coordinateSystem = t);
      }
      if (n.letter.toUpperCase() === "M") {
        const t = `M${Math.trunc(n.value)}`;
        (t === "M7" || t === "M8" || t === "M9") && (this.modals.coolant = t), (t === "M3" || t === "M4" || t === "M5") && (this.modals.spindle = t);
      }
    }
    for (const n of e.params) {
      const t = n.letter.toUpperCase();
      t === "F" && (this.modals.feedRate = n.value, this.feedRates.add(n.value)), t === "S" && (this.modals.spindleSpeed = n.value, this.spindleSpeeds.add(n.value)), t === "T" && (this.modals.tool = n.value, this.tools.add(n.value));
    }
  }
  applyAxes(e, n) {
    const t = { ...n }, s = this.unitsScale();
    for (const r of X) {
      const i = e.params.find((c) => c.letter.toUpperCase() === r);
      if (!i)
        continue;
      const a = r === "X" || r === "Y" || r === "Z" ? i.value * s : i.value;
      this.modals.distance === "G90" ? t[r] = a : t[r] = t[r] + a;
    }
    return t;
  }
  computeArcMax(e, n, t, s, r) {
    const { primary: i, secondary: a, tertiary: c } = F(s), u = q(
      e[i],
      e[a],
      r[i],
      r[a]
    ), f = Math.atan2(
      e[a] - r[a],
      e[i] - r[i]
    ), d = Math.atan2(
      n[a] - r[a],
      n[i] - r[i]
    ), y = $(f, d, t);
    let l = Number.NEGATIVE_INFINITY, p = Number.NEGATIVE_INFINITY;
    for (const A of y) {
      const w = r[i] + u * Math.cos(A), h = r[a] + u * Math.sin(A);
      w > l && (l = w), h > p && (p = h);
    }
    const x = { ...e };
    x[i] = l, x[a] = p, x[c] = Math.max(e[c], n[c]);
    for (const A of X)
      A !== i && A !== a && A !== c && (x[A] = Math.max(e[A], n[A]));
    return x;
  }
  arcCenter(e, n, t, s) {
    const { primary: r, secondary: i } = F(s), a = { ...n }, c = this.unitsScale(), u = V(e, "R"), f = _(e, s), d = f.primary === null ? null : f.primary * c, y = f.secondary === null ? null : f.secondary * c;
    if (d !== null || y !== null)
      return a[r] = n[r] + (d ?? 0), a[i] = n[i] + (y ?? 0), a;
    if (u === null)
      return a;
    const l = u * c, p = n[r], x = n[i], A = t[r], w = t[i], h = A - p, G = w - x, P = Math.hypot(h, G);
    if (P === 0)
      return a;
    const I = Math.abs(l), m = Math.sqrt(Math.max(0, I * I - P / 2 * (P / 2))), M = (p + A) / 2, v = (x + w) / 2, S = -G / P, Y = h / P, E = l >= 0 ? 1 : -1;
    return a[r] = M + E * S * m, a[i] = v + E * Y * m, a;
  }
  emitLinear(e) {
    const n = this.callbacks.onLinearMove;
    if (!n)
      return;
    const t = e.end.A - e.start.A, s = Math.max(1, Math.ceil(Math.abs(t) / D));
    let r = { ...e.start };
    for (let i = 1; i <= s; i += 1) {
      const a = i / s, c = W(e.start, e.end, a), u = Z(r), f = Z(c);
      n({
        modals: { ...this.modals },
        start: { ...r },
        end: { ...c },
        transformedStart: u,
        transformedEnd: f
      }), r = c;
    }
  }
  emitArc(e) {
    const n = this.callbacks.onArcMove;
    if (!n)
      return;
    const t = Z(e.start), s = Z(e.end), r = Z(e.max), i = Z(e.center);
    n({
      modals: { ...this.modals },
      start: { ...e.start },
      end: { ...e.end },
      max: { ...e.max },
      center: { ...e.center },
      plane: e.plane,
      motion: e.motion,
      transformedStart: t,
      transformedEnd: s,
      transformedMax: r,
      transformedCenter: i
    });
  }
}
function V(o, e) {
  const n = o.params.find((t) => t.letter.toUpperCase() === e);
  return n ? n.value : null;
}
function F(o) {
  return o === "G18" ? { primary: "Z", secondary: "X", tertiary: "Y" } : o === "G19" ? { primary: "Y", secondary: "Z", tertiary: "X" } : { primary: "X", secondary: "Y", tertiary: "Z" };
}
function _(o, e) {
  const n = V(o, "I"), t = V(o, "J"), s = V(o, "K");
  return e === "G18" ? { primary: s, secondary: n } : e === "G19" ? { primary: t, secondary: s } : { primary: n, secondary: t };
}
function $(o, e, n) {
  const t = Math.PI * 2;
  let s = b(o), r = b(e);
  const i = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, t];
  if (n === "G2") {
    s < r && (s += t);
    const c = [s, r];
    for (const u of i) {
      let f = u;
      f < r && (f += t), f <= s && f >= r && c.push(f);
    }
    return c;
  }
  r < s && (r += t);
  const a = [s, r];
  for (const c of i) {
    let u = c;
    u < s && (u += t), u >= s && u <= r && a.push(u);
  }
  return a;
}
function b(o) {
  const e = Math.PI * 2;
  let n = o % e;
  return n < 0 && (n += e), n;
}
function q(o, e, n, t) {
  return Math.hypot(o - n, e - t);
}
function N(o, e) {
  return X.every((n) => o[n] === e[n]);
}
const D = 5;
function W(o, e, n) {
  return {
    X: o.X + (e.X - o.X) * n,
    Y: o.Y + (e.Y - o.Y) * n,
    Z: o.Z + (e.Z - o.Z) * n,
    A: o.A + (e.A - o.A) * n,
    B: o.B + (e.B - o.B) * n,
    C: o.C + (e.C - o.C) * n
  };
}
function Z(o) {
  const e = o.A * Math.PI / 180, n = Math.cos(e), t = Math.sin(e), s = o.Y * n - o.Z * t, r = o.Y * t + o.Z * n;
  return { ...o, Y: s, Z: r };
}
function ne(o, e = {}) {
  const n = [], t = e.arcSegments ?? 30, s = e.collector ?? {}, r = new L({
    onLinearMove: (i) => {
      (s.onLinearMove ?? z)(i, n);
    },
    onArcMove: (i) => {
      (s.onArcMove ?? ((c, u) => {
        g(c, u, t);
      }))(i, n);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return Float32Array.from(n);
}
function oe(o, e = {}) {
  const n = [], t = [], s = e.arcSegments ?? 30, r = new L({
    onLinearMove: (i) => {
      const a = i.transformedStart ?? i.start, c = i.transformedEnd ?? i.end;
      (i.modals.motion === "G0" ? n : t).push(a.X, a.Y, a.Z, c.X, c.Y, c.Z);
    },
    onArcMove: (i) => {
      const a = i.modals.motion === "G0" ? n : t;
      g(i, a, s);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return {
    rapid: Float32Array.from(n),
    cutting: Float32Array.from(t)
  };
}
async function re(o, e = {}) {
  var y;
  const n = [], t = [], s = e.arcSegments ?? 30, r = e.batch, i = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), a = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let c = i, u = a > 0 ? a : Number.POSITIVE_INFINITY;
  const f = new L({
    onLinearMove: (l) => {
      const p = l.transformedStart ?? l.start, x = l.transformedEnd ?? l.end;
      (l.modals.motion === "G0" ? n : t).push(p.X, p.Y, p.Z, x.X, x.Y, x.Z);
    },
    onArcMove: (l) => {
      const p = l.modals.motion === "G0" ? n : t;
      g(l, p, s);
    }
  }), d = o.length;
  for (let l = 0; l < d; l += 1) {
    if ((y = r == null ? void 0 : r.shouldAbort) != null && y.call(r))
      throw new Error("Aborted.");
    const p = o[l];
    if (!p) {
      r != null && r.onProgress && (l + 1 === d || l + 1 === c) && (r.onProgress(l + 1, d), c += i), a > 0 && (l + 1 === d || l + 1 === u) && (await new Promise((x) => {
        setTimeout(x, 0);
      }), u += a);
      continue;
    }
    f.processLine(p), r != null && r.onProgress && (l + 1 === d || l + 1 === c) && (r.onProgress(l + 1, d), c += i), a > 0 && (l + 1 === d || l + 1 === u) && (await new Promise((x) => {
      setTimeout(x, 0);
    }), u += a);
  }
  return {
    rapid: Float32Array.from(n),
    cutting: Float32Array.from(t)
  };
}
async function se(o, e = {}) {
  var w;
  const n = [], t = e.arcSegments ?? 30, s = e.batch, r = Math.max(1, Math.floor((s == null ? void 0 : s.everyLines) ?? 5e3)), i = Math.max(0, Math.floor((s == null ? void 0 : s.yieldEveryLines) ?? 5e4));
  let a = r, c = i > 0 ? i : Number.POSITIVE_INFINITY;
  const u = new Int32Array(o.length);
  u.fill(-1);
  const f = new Int32Array(o.length);
  f.fill(-1);
  const d = new Uint8Array(o.length), y = new Int32Array(o.length);
  let l = -1, p = 0;
  const x = new L({
    onLinearMove: (h) => {
      const G = h.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (p === 0 ? p = G : p !== G && (p = 3)), z(h, n);
    },
    onArcMove: (h) => {
      const G = h.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (p === 0 ? p = G : p !== G && (p = 3)), g(h, n, t);
    }
  }), A = o.length;
  for (let h = 0; h < A; h += 1) {
    if ((w = s == null ? void 0 : s.shouldAbort) != null && w.call(s))
      throw new Error("Aborted.");
    const G = n.length / 3;
    l = h, p = 0;
    const P = o[h];
    P && x.processLine(P), l = -1;
    const I = n.length / 3;
    I > G && (u[h] = G, f[h] = I, d[h] = p), y[h] = I, s != null && s.onProgress && (h + 1 === A || h + 1 === a) && (s.onProgress(h + 1, A), a += r), i > 0 && (h + 1 === A || h + 1 === c) && (await new Promise((m) => {
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
function ie(o, e = {}) {
  const n = e.arcSegments ?? 30, t = Math.max(1, Math.floor(e.bucketCount ?? 16)), s = e.baseOpacity ?? 0.9, { minPower: r, maxPower: i } = ee(o), a = [], c = Array.from({ length: t }, () => []), u = new L({
    onLinearMove: (d) => {
      const y = d.transformedStart ?? d.start, l = d.transformedEnd ?? d.end;
      if (d.modals.motion === "G0") {
        a.push(y.X, y.Y, y.Z, l.X, l.Y, l.Z);
        return;
      }
      const p = B(d.modals.spindleSpeed, r, i, t);
      c[p].push(y.X, y.Y, y.Z, l.X, l.Y, l.Z);
    },
    onArcMove: (d) => {
      if (d.modals.motion === "G0")
        return;
      const y = B(d.modals.spindleSpeed, r, i, t), l = c[y];
      g(d, l, n);
    }
  });
  for (const d of o)
    d && u.processLine(d);
  const f = c.map((d, y) => ({
    opacity: O(y, t, s),
    vertices: Float32Array.from(d)
  }));
  return {
    rapid: Float32Array.from(a),
    buckets: f,
    minPower: r,
    maxPower: i
  };
}
async function ae(o, e = {}) {
  const n = await K(o, e);
  return {
    rapid: n.rapidPositions,
    buckets: n.buckets.map((t) => ({ opacity: t.opacity, vertices: t.positions })),
    minPower: n.minPower,
    maxPower: n.maxPower
  };
}
async function j(o, e = {}) {
  var P, I;
  const n = e.arcSegments ?? 30, t = Math.max(1, Math.floor(e.bucketCount ?? 16)), s = !!e.laserMode, r = e.batch, i = o.length * (s ? 2 : 1), a = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), c = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let u = a, f = c > 0 ? c : Number.POSITIVE_INFINITY, d = Number.NEGATIVE_INFINITY, y = !1;
  if (s) {
    const m = new R();
    for (const M of o) {
      if (!M)
        continue;
      if (m.parseLine(M).gcodes.some((Y) => {
        if (Y.letter !== "M")
          return !1;
        const E = Math.trunc(Y.value);
        return E === 3 || E === 4 || E === 5;
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
      onLinearMove: (M) => {
        if (!l(M.modals))
          return;
        const v = M.modals.spindleSpeed;
        v === null || v <= 0 || (d = Math.max(d, v));
      },
      onArcMove: (M) => {
        if (!l(M.modals))
          return;
        const v = M.modals.spindleSpeed;
        v === null || v <= 0 || (d = Math.max(d, v));
      }
    });
    for (let M = 0; M < o.length; M += 1) {
      if ((P = r == null ? void 0 : r.shouldAbort) != null && P.call(r))
        throw new Error("Aborted.");
      const v = o[M];
      v && m.processLine(v);
      const S = M + 1;
      r != null && r.onProgress && (S === i || S === u) && (r.onProgress(S, i), u += a), c > 0 && (S === i || S === f) && (await new Promise((Y) => {
        setTimeout(Y, 0);
      }), f += c);
    }
    Number.isFinite(d) || (d = 0);
  } else
    d = 0;
  const p = (m) => {
    if (t <= 1)
      return 0;
    if (m === null)
      return t - 1;
    const M = m;
    if (M <= 0)
      return 0;
    if (d <= 0)
      return t - 1;
    const v = Math.min(1, Math.max(0, M / d)), S = 1 + Math.floor(v * (t - 2));
    return Math.min(t - 1, Math.max(1, S));
  }, x = [], A = s ? Array.from({ length: t }, () => []) : [new Array()], w = new Int32Array(o.length), h = Array.from(
    { length: s ? t : 1 },
    () => new Int32Array(o.length)
  ), G = new L({
    onLinearMove: (m) => {
      const M = m.transformedStart ?? m.start, v = m.transformedEnd ?? m.end;
      if (m.modals.motion === "G0") {
        x.push(M.X, M.Y, M.Z, v.X, v.Y, v.Z);
        return;
      }
      if (s && !l(m.modals))
        return;
      const S = s ? p(m.modals.spindleSpeed) : 0;
      A[S].push(M.X, M.Y, M.Z, v.X, v.Y, v.Z);
    },
    onArcMove: (m) => {
      if (m.modals.motion === "G0" || s && !l(m.modals))
        return;
      const M = s ? p(m.modals.spindleSpeed) : 0, v = A[M];
      g(m, v, n);
    }
  });
  for (let m = 0; m < o.length; m += 1) {
    if ((I = r == null ? void 0 : r.shouldAbort) != null && I.call(r))
      throw new Error("Aborted.");
    const M = o[m];
    M && G.processLine(M), w[m] = x.length / 3;
    for (let S = 0; S < A.length; S += 1)
      h[S][m] = A[S].length / 3;
    const v = s ? o.length + m + 1 : m + 1;
    r != null && r.onProgress && (v === i || v === u) && (r.onProgress(v, i), u += a), c > 0 && (v === i || v === f) && (await new Promise((S) => {
      setTimeout(S, 0);
    }), f += c);
  }
  return {
    rapid: { positions: Float32Array.from(x), prefixEndVertex: w },
    cuts: A.map((m, M) => ({
      positions: Float32Array.from(m),
      prefixEndVertex: h[M]
    })),
    cutBucketCount: A.length,
    minPower: 0,
    maxPower: d
  };
}
async function K(o, e = {}) {
  const n = Math.max(1, Math.floor(e.bucketCount ?? 16)), t = e.baseOpacity ?? 0.9, s = await j(o, {
    arcSegments: e.arcSegments,
    bucketCount: n,
    laserMode: !0,
    batch: e.batch
  }), r = s.cuts.map((i, a) => ({
    opacity: O(a, n, t),
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
function ce(o, e) {
  o.push(e.X, e.Y, e.Z);
}
function z(o, e) {
  const n = o.transformedStart ?? o.start, t = o.transformedEnd ?? o.end;
  e.push(n.X, n.Y, n.Z, t.X, t.Y, t.Z);
}
function g(o, e, n) {
  const t = Math.max(1, Math.floor(n)), { primary: s, secondary: r } = H(o.plane), i = J(
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
  for (let p = 1; p <= t; p += 1) {
    const x = p / t, A = o.motion === "G2" ? f - y * x : f + y * x, w = Q(o.start, o.end, x);
    w[s] = o.center[s] + i * Math.cos(A), w[r] = o.center[r] + i * Math.sin(A);
    const h = T(l), G = T(w);
    e.push(
      h.X,
      h.Y,
      h.Z,
      G.X,
      G.Y,
      G.Z
    ), l = w;
  }
}
function T(o) {
  const e = o.A * Math.PI / 180, n = Math.cos(e), t = Math.sin(e), s = o.Y * n - o.Z * t, r = o.Y * t + o.Z * n;
  return { ...o, Y: s, Z: r };
}
function H(o) {
  return o === "G18" ? { primary: "Z", secondary: "X" } : o === "G19" ? { primary: "Y", secondary: "Z" } : { primary: "X", secondary: "Y" };
}
function k(o) {
  const e = Math.PI * 2;
  let n = o % e;
  return n < 0 && (n += e), n;
}
function J(o, e, n, t) {
  return Math.hypot(o - n, e - t);
}
function Q(o, e, n) {
  return {
    X: o.X + (e.X - o.X) * n,
    Y: o.Y + (e.Y - o.Y) * n,
    Z: o.Z + (e.Z - o.Z) * n,
    A: o.A + (e.A - o.A) * n,
    B: o.B + (e.B - o.B) * n,
    C: o.C + (e.C - o.C) * n
  };
}
function ee(o) {
  let e = Number.POSITIVE_INFINITY, n = Number.NEGATIVE_INFINITY;
  const t = new L({
    onLinearMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (e = Math.min(e, r), n = Math.max(n, r));
    },
    onArcMove: (s) => {
      const r = s.modals.spindleSpeed;
      r !== null && (e = Math.min(e, r), n = Math.max(n, r));
    }
  });
  for (const s of o)
    s && t.processLine(s);
  return !Number.isFinite(e) || !Number.isFinite(n) ? { minPower: 0, maxPower: 0 } : { minPower: e, maxPower: n };
}
function B(o, e, n, t) {
  if (t <= 1)
    return 0;
  const s = o ?? e;
  if (n <= e)
    return t - 1;
  const r = (s - e) / (n - e), i = Math.floor(r * (t - 1));
  return Math.min(t - 1, Math.max(0, i));
}
function O(o, e, n) {
  if (e <= 1)
    return n;
  const t = o / (e - 1);
  return n * t;
}
function le(o) {
  const e = new Float32Array(o.vertices), n = new Uint32Array(o.frames), t = new Float32Array(o.colorArrayBuffer), { verticesLen: s, framesLen: r } = o, i = /* @__PURE__ */ new Map();
  for (let a = 0; a < r; a++) {
    const c = n[a], u = a < r - 1 ? n[a + 1] : s / 3;
    if (u <= c + 1) continue;
    const f = c * 4, d = t[f], y = t[f + 1], l = t[f + 2], p = t[f + 3], x = te(d, y, l), A = `${x}|${Math.round(p * 100)}`;
    let w = i.get(A);
    w || (w = { hexColor: x, opacity: p, pos: [], rgb: [] }, i.set(A, w));
    for (let h = c; h < u - 1; h++) {
      const G = h * 3, P = (h + 1) * 3;
      w.pos.push(e[G], e[G + 1], e[G + 2], e[P], e[P + 1], e[P + 2]), w.rgb.push(d, y, l, d, y, l);
    }
  }
  return Array.from(i.values()).map(({ hexColor: a, opacity: c, pos: u, rgb: f }) => ({
    hexColor: a,
    opacity: c,
    positions: new Float32Array(u),
    rgbColors: new Float32Array(f)
  }));
}
function te(o, e, n) {
  const t = (s) => Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, "0");
  return `#${t(o)}${t(e)}${t(n)}`;
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
  j as buildToolpathGeometryFromLinesBatched,
  ne as buildVerticesFromLines,
  le as buildWorkerSegmentGroups,
  ce as pushXYZ
};
