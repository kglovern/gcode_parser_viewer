const q = /([A-Za-z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
class $ {
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
        const d = e.slice(a + 1);
        t.push({ type: "semicolon", text: d, start: a, end: e.length });
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
    for (const n of e.matchAll(q)) {
      const s = n[0], r = n[1].toUpperCase(), i = Number(n[2]), a = n.index ?? 0, c = a + s.length;
      t.push({ letter: r, value: i, raw: s, start: a, end: c });
    }
    return t;
  }
}
const N = ["X", "Y", "Z", "A", "B", "C"], T = {
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
class Y {
  constructor(e = {}) {
    this.parser = new $(), this.modals = { ...T }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.callbacks = e, this.feedRates = /* @__PURE__ */ new Set(), this.spindleSpeeds = /* @__PURE__ */ new Set(), this.tools = /* @__PURE__ */ new Set();
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
    this.modals = { ...T }, this.position = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 }, this.feedRates.clear(), this.spindleSpeeds.clear(), this.tools.clear();
  }
  processLine(e) {
    const t = this.parser.parseLine(e), n = { ...this.position };
    this.updateModals(t);
    const s = this.modals.motion, r = this.modals.plane;
    let i = this.applyAxes(t, n), a, c, d = "none";
    return s === "G0" || s === "G1" ? z(n, i) || (d = "linear", this.position = { ...i }, this.emitLinear({ start: n, end: i })) : (s === "G2" || s === "G3") && (z(n, i) || (d = "arc", c = this.arcCenter(t, n, i, r), a = this.computeArcMax(n, i, s, r, c), this.position = { ...i }, this.emitArc({ start: n, end: i, max: a, center: c, plane: r, motion: s }))), {
      parsed: t,
      modals: { ...this.modals },
      start: n,
      end: i,
      movement: d,
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
    for (const r of N) {
      const i = e.params.find((c) => c.letter.toUpperCase() === r);
      if (!i)
        continue;
      const a = r === "X" || r === "Y" || r === "Z" ? i.value * s : i.value;
      this.modals.distance === "G90" ? n[r] = a : n[r] = n[r] + a;
    }
    return n;
  }
  computeArcMax(e, t, n, s, r) {
    const { primary: i, secondary: a, tertiary: c } = B(s), d = H(
      e[i],
      e[a],
      r[i],
      r[a]
    ), m = Math.atan2(
      e[a] - r[a],
      e[i] - r[i]
    ), u = Math.atan2(
      t[a] - r[a],
      t[i] - r[i]
    ), A = K(m, u, n);
    let l = Number.NEGATIVE_INFINITY, h = Number.NEGATIVE_INFINITY;
    for (const x of A) {
      const S = r[i] + d * Math.cos(x), y = r[a] + d * Math.sin(x);
      S > l && (l = S), y > h && (h = y);
    }
    const v = { ...e };
    v[i] = l, v[a] = h, v[c] = Math.max(e[c], t[c]);
    for (const x of N)
      x !== i && x !== a && x !== c && (v[x] = Math.max(e[x], t[x]));
    return v;
  }
  arcCenter(e, t, n, s) {
    const { primary: r, secondary: i } = B(s), a = { ...t }, c = this.unitsScale(), d = F(e, "R"), m = D(e, s), u = m.primary === null ? null : m.primary * c, A = m.secondary === null ? null : m.secondary * c;
    if (u !== null || A !== null)
      return a[r] = t[r] + (u ?? 0), a[i] = t[i] + (A ?? 0), a;
    if (d === null)
      return a;
    const l = d * c, h = t[r], v = t[i], x = n[r], S = n[i], y = x - h, P = S - v, L = Math.hypot(y, P);
    if (L === 0)
      return a;
    const G = Math.abs(l), f = Math.sqrt(Math.max(0, G * G - L / 2 * (L / 2))), M = (h + x) / 2, p = (v + S) / 2, w = -P / L, I = y / L, E = l >= 0 ? 1 : -1;
    return a[r] = M + E * w * f, a[i] = p + E * I * f, a;
  }
  emitLinear(e) {
    const t = this.callbacks.onLinearMove;
    if (!t)
      return;
    const n = e.end.A - e.start.A, s = Math.max(1, Math.ceil(Math.abs(n) / J));
    let r = { ...e.start };
    for (let i = 1; i <= s; i += 1) {
      const a = i / s, c = Q(e.start, e.end, a), d = C(r), m = C(c);
      t({
        modals: { ...this.modals },
        start: { ...r },
        end: { ...c },
        transformedStart: d,
        transformedEnd: m
      }), r = c;
    }
  }
  emitArc(e) {
    const t = this.callbacks.onArcMove;
    if (!t)
      return;
    const n = C(e.start), s = C(e.end), r = C(e.max), i = C(e.center);
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
function F(o, e) {
  const t = o.params.find((n) => n.letter.toUpperCase() === e);
  return t ? t.value : null;
}
function B(o) {
  return o === "G18" ? { primary: "Z", secondary: "X", tertiary: "Y" } : o === "G19" ? { primary: "Y", secondary: "Z", tertiary: "X" } : { primary: "X", secondary: "Y", tertiary: "Z" };
}
function D(o, e) {
  const t = F(o, "I"), n = F(o, "J"), s = F(o, "K");
  return e === "G18" ? { primary: s, secondary: t } : e === "G19" ? { primary: n, secondary: s } : { primary: t, secondary: n };
}
function K(o, e, t) {
  const n = Math.PI * 2;
  let s = R(o), r = R(e);
  const i = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, n];
  if (t === "G2") {
    s < r && (s += n);
    const c = [s, r];
    for (const d of i) {
      let m = d;
      m < r && (m += n), m <= s && m >= r && c.push(m);
    }
    return c;
  }
  r < s && (r += n);
  const a = [s, r];
  for (const c of i) {
    let d = c;
    d < s && (d += n), d >= s && d <= r && a.push(d);
  }
  return a;
}
function R(o) {
  const e = Math.PI * 2;
  let t = o % e;
  return t < 0 && (t += e), t;
}
function H(o, e, t, n) {
  return Math.hypot(o - t, e - n);
}
function z(o, e) {
  return N.every((t) => o[t] === e[t]);
}
const J = 5;
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
function C(o) {
  const e = o.A * Math.PI / 180, t = Math.cos(e), n = Math.sin(e), s = o.Y * t - o.Z * n, r = o.Y * n + o.Z * t;
  return { ...o, Y: s, Z: r };
}
function ae(o, e = {}) {
  const t = [], n = e.arcSegments ?? 30, s = e.collector ?? {}, r = new Y({
    onLinearMove: (i) => {
      (s.onLinearMove ?? j)(i, t);
    },
    onArcMove: (i) => {
      (s.onArcMove ?? ((c, d) => {
        V(c, d, n);
      }))(i, t);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return Float32Array.from(t);
}
function ce(o, e = {}) {
  const t = [], n = [], s = e.arcSegments ?? 30, r = new Y({
    onLinearMove: (i) => {
      const a = i.transformedStart ?? i.start, c = i.transformedEnd ?? i.end;
      (i.modals.motion === "G0" ? t : n).push(a.X, a.Y, a.Z, c.X, c.Y, c.Z);
    },
    onArcMove: (i) => {
      const a = i.modals.motion === "G0" ? t : n;
      V(i, a, s);
    }
  });
  for (const i of o)
    i && r.processLine(i);
  return {
    rapid: Float32Array.from(t),
    cutting: Float32Array.from(n)
  };
}
async function le(o, e = {}) {
  var A;
  const t = [], n = [], s = e.arcSegments ?? 30, r = e.batch, i = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), a = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let c = i, d = a > 0 ? a : Number.POSITIVE_INFINITY;
  const m = new Y({
    onLinearMove: (l) => {
      const h = l.transformedStart ?? l.start, v = l.transformedEnd ?? l.end;
      (l.modals.motion === "G0" ? t : n).push(h.X, h.Y, h.Z, v.X, v.Y, v.Z);
    },
    onArcMove: (l) => {
      const h = l.modals.motion === "G0" ? t : n;
      V(l, h, s);
    }
  }), u = o.length;
  for (let l = 0; l < u; l += 1) {
    if ((A = r == null ? void 0 : r.shouldAbort) != null && A.call(r))
      throw new Error("Aborted.");
    const h = o[l];
    if (!h) {
      r != null && r.onProgress && (l + 1 === u || l + 1 === c) && (r.onProgress(l + 1, u), c += i), a > 0 && (l + 1 === u || l + 1 === d) && (await new Promise((v) => {
        setTimeout(v, 0);
      }), d += a);
      continue;
    }
    m.processLine(h), r != null && r.onProgress && (l + 1 === u || l + 1 === c) && (r.onProgress(l + 1, u), c += i), a > 0 && (l + 1 === u || l + 1 === d) && (await new Promise((v) => {
      setTimeout(v, 0);
    }), d += a);
  }
  return {
    rapid: Float32Array.from(t),
    cutting: Float32Array.from(n)
  };
}
async function ue(o, e = {}) {
  var S;
  const t = [], n = e.arcSegments ?? 30, s = e.batch, r = Math.max(1, Math.floor((s == null ? void 0 : s.everyLines) ?? 5e3)), i = Math.max(0, Math.floor((s == null ? void 0 : s.yieldEveryLines) ?? 5e4));
  let a = r, c = i > 0 ? i : Number.POSITIVE_INFINITY;
  const d = new Int32Array(o.length);
  d.fill(-1);
  const m = new Int32Array(o.length);
  m.fill(-1);
  const u = new Uint8Array(o.length), A = new Int32Array(o.length);
  let l = -1, h = 0;
  const v = new Y({
    onLinearMove: (y) => {
      const P = y.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (h === 0 ? h = P : h !== P && (h = 3)), j(y, t);
    },
    onArcMove: (y) => {
      const P = y.modals.motion === "G0" ? 1 : 2;
      l >= 0 && (h === 0 ? h = P : h !== P && (h = 3)), V(y, t, n);
    }
  }), x = o.length;
  for (let y = 0; y < x; y += 1) {
    if ((S = s == null ? void 0 : s.shouldAbort) != null && S.call(s))
      throw new Error("Aborted.");
    const P = t.length / 3;
    l = y, h = 0;
    const L = o[y];
    L && v.processLine(L), l = -1;
    const G = t.length / 3;
    G > P && (d[y] = P, m[y] = G, u[y] = h), A[y] = G, s != null && s.onProgress && (y + 1 === x || y + 1 === a) && (s.onProgress(y + 1, x), a += r), i > 0 && (y + 1 === x || y + 1 === c) && (await new Promise((f) => {
      setTimeout(f, 0);
    }), c += i);
  }
  return {
    positions: Float32Array.from(t),
    lineStartVertex: d,
    lineEndVertex: m,
    lineKind: u,
    prefixEndVertex: A
  };
}
function de(o, e = {}) {
  const t = e.arcSegments ?? 30, n = Math.max(1, Math.floor(e.bucketCount ?? 16)), s = e.baseOpacity ?? 0.9, { minPower: r, maxPower: i } = se(o), a = [], c = Array.from({ length: n }, () => []), d = new Y({
    onLinearMove: (u) => {
      const A = u.transformedStart ?? u.start, l = u.transformedEnd ?? u.end;
      if (u.modals.motion === "G0") {
        a.push(A.X, A.Y, A.Z, l.X, l.Y, l.Z);
        return;
      }
      const h = _(u.modals.spindleSpeed, r, i, n);
      c[h].push(A.X, A.Y, A.Z, l.X, l.Y, l.Z);
    },
    onArcMove: (u) => {
      if (u.modals.motion === "G0")
        return;
      const A = _(u.modals.spindleSpeed, r, i, n), l = c[A];
      V(u, l, t);
    }
  });
  for (const u of o)
    u && d.processLine(u);
  const m = c.map((u, A) => ({
    opacity: W(A, n, s),
    vertices: Float32Array.from(u)
  }));
  return {
    rapid: Float32Array.from(a),
    buckets: m,
    minPower: r,
    maxPower: i
  };
}
async function fe(o, e = {}) {
  const t = await te(o, e);
  return {
    rapid: t.rapidPositions,
    buckets: t.buckets.map((n) => ({ opacity: n.opacity, vertices: n.positions })),
    minPower: t.minPower,
    maxPower: t.maxPower
  };
}
async function ee(o, e = {}) {
  var L, G;
  const t = e.arcSegments ?? 30, n = Math.max(1, Math.floor(e.bucketCount ?? 16)), s = !!e.laserMode, r = e.batch, i = o.length * (s ? 2 : 1), a = Math.max(1, Math.floor((r == null ? void 0 : r.everyLines) ?? 5e3)), c = Math.max(0, Math.floor((r == null ? void 0 : r.yieldEveryLines) ?? 5e4));
  let d = a, m = c > 0 ? c : Number.POSITIVE_INFINITY, u = Number.NEGATIVE_INFINITY, A = !1;
  if (s) {
    const f = new $();
    for (const M of o) {
      if (!M)
        continue;
      if (f.parseLine(M).gcodes.some((I) => {
        if (I.letter !== "M")
          return !1;
        const E = Math.trunc(I.value);
        return E === 3 || E === 4 || E === 5;
      })) {
        A = !1;
        break;
      }
      A = !0;
    }
  }
  const l = (f) => f.spindle === "M5" || !(f.spindle === "M3" || f.spindle === "M4" || A && f.spindle === null) ? !1 : f.spindleSpeed === null ? !0 : f.spindleSpeed > 0;
  if (s) {
    const f = new Y({
      onLinearMove: (M) => {
        if (!l(M.modals))
          return;
        const p = M.modals.spindleSpeed;
        p === null || p <= 0 || (u = Math.max(u, p));
      },
      onArcMove: (M) => {
        if (!l(M.modals))
          return;
        const p = M.modals.spindleSpeed;
        p === null || p <= 0 || (u = Math.max(u, p));
      }
    });
    for (let M = 0; M < o.length; M += 1) {
      if ((L = r == null ? void 0 : r.shouldAbort) != null && L.call(r))
        throw new Error("Aborted.");
      const p = o[M];
      p && f.processLine(p);
      const w = M + 1;
      r != null && r.onProgress && (w === i || w === d) && (r.onProgress(w, i), d += a), c > 0 && (w === i || w === m) && (await new Promise((I) => {
        setTimeout(I, 0);
      }), m += c);
    }
    Number.isFinite(u) || (u = 0);
  } else
    u = 0;
  const h = (f) => {
    if (n <= 1)
      return 0;
    if (f === null)
      return n - 1;
    const M = f;
    if (M <= 0)
      return 0;
    if (u <= 0)
      return n - 1;
    const p = Math.min(1, Math.max(0, M / u)), w = 1 + Math.floor(p * (n - 2));
    return Math.min(n - 1, Math.max(1, w));
  }, v = [], x = s ? Array.from({ length: n }, () => []) : [new Array()], S = new Int32Array(o.length), y = Array.from(
    { length: s ? n : 1 },
    () => new Int32Array(o.length)
  ), P = new Y({
    onLinearMove: (f) => {
      const M = f.transformedStart ?? f.start, p = f.transformedEnd ?? f.end;
      if (f.modals.motion === "G0") {
        v.push(M.X, M.Y, M.Z, p.X, p.Y, p.Z);
        return;
      }
      if (s && !l(f.modals))
        return;
      const w = s ? h(f.modals.spindleSpeed) : 0;
      x[w].push(M.X, M.Y, M.Z, p.X, p.Y, p.Z);
    },
    onArcMove: (f) => {
      if (f.modals.motion === "G0" || s && !l(f.modals))
        return;
      const M = s ? h(f.modals.spindleSpeed) : 0, p = x[M];
      V(f, p, t);
    }
  });
  for (let f = 0; f < o.length; f += 1) {
    if ((G = r == null ? void 0 : r.shouldAbort) != null && G.call(r))
      throw new Error("Aborted.");
    const M = o[f];
    M && P.processLine(M), S[f] = v.length / 3;
    for (let w = 0; w < x.length; w += 1)
      y[w][f] = x[w].length / 3;
    const p = s ? o.length + f + 1 : f + 1;
    r != null && r.onProgress && (p === i || p === d) && (r.onProgress(p, i), d += a), c > 0 && (p === i || p === m) && (await new Promise((w) => {
      setTimeout(w, 0);
    }), m += c);
  }
  return {
    rapid: { positions: Float32Array.from(v), prefixEndVertex: S },
    cuts: x.map((f, M) => ({
      positions: Float32Array.from(f),
      prefixEndVertex: y[M]
    })),
    cutBucketCount: x.length,
    minPower: 0,
    maxPower: u
  };
}
async function te(o, e = {}) {
  const t = Math.max(1, Math.floor(e.bucketCount ?? 16)), n = e.baseOpacity ?? 0.9, s = await ee(o, {
    arcSegments: e.arcSegments,
    bucketCount: t,
    laserMode: !0,
    batch: e.batch
  }), r = s.cuts.map((i, a) => ({
    opacity: W(a, t, n),
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
function me(o, e) {
  o.push(e.X, e.Y, e.Z);
}
function j(o, e) {
  const t = o.transformedStart ?? o.start, n = o.transformedEnd ?? o.end;
  e.push(t.X, t.Y, t.Z, n.X, n.Y, n.Z);
}
function V(o, e, t) {
  const n = Math.max(1, Math.floor(t)), { primary: s, secondary: r } = ne(o.plane), i = oe(
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
  ), d = Math.PI * 2;
  let m = U(a), u = U(c);
  o.motion === "G2" ? m <= u && (m += d) : u <= m && (u += d);
  const A = o.motion === "G2" ? m - u : u - m;
  let l = { ...o.start };
  for (let h = 1; h <= n; h += 1) {
    const v = h / n, x = o.motion === "G2" ? m - A * v : m + A * v, S = re(o.start, o.end, v);
    S[s] = o.center[s] + i * Math.cos(x), S[r] = o.center[r] + i * Math.sin(x);
    const y = O(l), P = O(S);
    e.push(
      y.X,
      y.Y,
      y.Z,
      P.X,
      P.Y,
      P.Z
    ), l = S;
  }
}
function O(o) {
  const e = o.A * Math.PI / 180, t = Math.cos(e), n = Math.sin(e), s = o.Y * t - o.Z * n, r = o.Y * n + o.Z * t;
  return { ...o, Y: s, Z: r };
}
function ne(o) {
  return o === "G18" ? { primary: "Z", secondary: "X" } : o === "G19" ? { primary: "Y", secondary: "Z" } : { primary: "X", secondary: "Y" };
}
function U(o) {
  const e = Math.PI * 2;
  let t = o % e;
  return t < 0 && (t += e), t;
}
function oe(o, e, t, n) {
  return Math.hypot(o - t, e - n);
}
function re(o, e, t) {
  return {
    X: o.X + (e.X - o.X) * t,
    Y: o.Y + (e.Y - o.Y) * t,
    Z: o.Z + (e.Z - o.Z) * t,
    A: o.A + (e.A - o.A) * t,
    B: o.B + (e.B - o.B) * t,
    C: o.C + (e.C - o.C) * t
  };
}
function se(o) {
  let e = Number.POSITIVE_INFINITY, t = Number.NEGATIVE_INFINITY;
  const n = new Y({
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
function _(o, e, t, n) {
  if (n <= 1)
    return 0;
  const s = o ?? e;
  if (t <= e)
    return n - 1;
  const r = (s - e) / (t - e), i = Math.floor(r * (n - 1));
  return Math.min(n - 1, Math.max(0, i));
}
function W(o, e, t) {
  if (e <= 1)
    return t;
  const n = o / (e - 1);
  return t * n;
}
function pe(o) {
  const e = new Float32Array(o.vertices), t = new Uint32Array(o.frames), n = new Float32Array(o.colorArrayBuffer), { verticesLen: s, framesLen: r } = o, i = /* @__PURE__ */ new Map();
  for (let a = 0; a < r; a++) {
    const c = t[a], d = a < r - 1 ? t[a + 1] : s / 3;
    if (d <= c + 1) continue;
    const m = c * 4, u = n[m], A = n[m + 1], l = n[m + 2], h = n[m + 3], v = ie(u, A, l), x = `${v}|${Math.round(h * 100)}`;
    let S = i.get(x);
    S || (S = { hexColor: v, opacity: h, pos: [], rgb: [] }, i.set(x, S));
    for (let y = c; y < d - 1; y++) {
      const P = y * 3, L = (y + 1) * 3;
      S.pos.push(e[P], e[P + 1], e[P + 2], e[L], e[L + 1], e[L + 2]), S.rgb.push(u, A, l, u, A, l);
    }
  }
  return Array.from(i.values()).map(({ hexColor: a, opacity: c, pos: d, rgb: m }) => ({
    hexColor: a,
    opacity: c,
    positions: new Float32Array(d),
    rgbColors: new Float32Array(m)
  }));
}
function ie(o, e, t) {
  const n = (s) => Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, "0");
  return `#${n(o)}${n(e)}${n(t)}`;
}
function he(o, e) {
  const t = new Float32Array(o.vertices), n = new Uint32Array(o.frames), s = new Float32Array(o.colorArrayBuffer), i = (o.isLaser && o.savedColorsBuffer && o.savedColorLen ? new Float32Array(o.savedColorsBuffer) : null) ?? s, { verticesLen: a, framesLen: c } = o, d = (e == null ? void 0 : e.lineGroups) ?? [], m = d.length, u = m + 1, A = new Int32Array(c).fill(m);
  for (let G = d.length - 1; G >= 0; G--) {
    const f = Math.max(0, Math.floor(d[G].start)), M = Math.min(c - 1, Math.floor(d[G].end));
    for (let p = f; p <= M; p++)
      A[p] = G;
  }
  const l = (G) => Array.from({ length: u }, G), h = l(() => []), v = l(() => []), x = l(() => []), S = l(() => []), y = l(() => new Int32Array(c)), P = l(() => new Int32Array(c));
  for (let G = 0; G < c; G++) {
    const f = n[G], M = G < c - 1 ? n[G + 1] : a / 3;
    if (M > f + 1) {
      const p = s[f * 4 + 3] < 0.75, w = A[G], I = p ? h[w] : x[w], E = p ? v[w] : S[w];
      for (let g = f; g < M - 1; g++) {
        const Z = g * 3, X = (g + 1) * 3;
        I.push(t[Z], t[Z + 1], t[Z + 2], t[X], t[X + 1], t[X + 2]);
        const b = g * 4, k = (g + 1) * 4;
        E.push(i[b], i[b + 1], i[b + 2], i[k], i[k + 1], i[k + 2]);
      }
    }
    for (let p = 0; p < u; p++)
      y[p][G] = h[p].length / 3, P[p][G] = x[p].length / 3;
  }
  const L = (G, f, M) => G.map((p, w) => ({
    positions: Float32Array.from(p),
    colors: Float32Array.from(f[w]),
    prefixEndVertex: M[w],
    lineGroupIndex: w === m ? null : w
  }));
  return {
    rapids: L(h, v, y),
    cuts: L(x, S, P)
  };
}
export {
  $ as GCodeParser,
  Y as GCodeVirtualizer,
  te as buildLaserGeometryFromLinesBatched,
  de as buildLaserVerticesFromLines,
  fe as buildLaserVerticesFromLinesBatched,
  ue as buildMovementGeometryFromLinesBatched,
  ce as buildMovementVerticesFromLines,
  le as buildMovementVerticesFromLinesBatched,
  ee as buildToolpathGeometryFromLinesBatched,
  ae as buildVerticesFromLines,
  pe as buildWorkerSegmentGroups,
  he as buildWorkerToolpathStreams,
  me as pushXYZ
};
