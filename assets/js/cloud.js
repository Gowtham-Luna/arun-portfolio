/* Point-cloud engine: raw WebGL, no libraries.
   Every scene is modelled from simple parts (rounded boxes, tubes, rings, panels), sampled into N coloured
   points, then morphed between on the GPU. Units: roughly -1.5..1.5. */
(function () {
  "use strict";

  /* ---------- seeded random ---------- */
  let seed = 7;
  const R = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * R();
  const TAU = Math.PI * 2;

  /* ---------- palette ---------- */
  const COLS = {
    white: [0.86, 0.92, 0.96], steel: [0.66, 0.73, 0.8], dark: [0.2, 0.25, 0.32], soft: [0.42, 0.5, 0.6],
    cyan: [0.36, 0.88, 0.9], amber: [1, 0.72, 0.3], gold: [1, 0.78, 0.38], orange: [1, 0.5, 0.18],
    blue: [0.32, 0.58, 1], wood: [0.78, 0.55, 0.32], kraft: [0.86, 0.68, 0.46], green: [0.42, 0.88, 0.5],
    red: [1, 0.36, 0.3], bright: [1, 1, 1], dust: [0.3, 0.5, 0.6],
  };

  /* ---------- point output with colour + transform stack ---------- */
  let OUT = null, COL = COLS.white, XF = null;
  const col = (c) => { COL = typeof c === "string" ? COLS[c] : c; };
  const P = (x, y, z) => { if (XF) { const q = XF(x, y, z); x = q[0]; y = q[1]; z = q[2]; } OUT.p.push(x, y, z); OUT.c.push(COL[0], COL[1], COL[2]); };
  const T = (tx, ty, tz) => (x, y, z) => [x + tx, y + ty, z + tz];
  const RX = (a) => { const c = Math.cos(a), s = Math.sin(a); return (x, y, z) => [x, y * c - z * s, y * s + z * c]; };
  const RY = (a) => { const c = Math.cos(a), s = Math.sin(a); return (x, y, z) => [x * c + z * s, y, -x * s + z * c]; };
  const RZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return (x, y, z) => [x * c - y * s, x * s + y * c, z]; };
  // with(fns..., body): applies fns in order (first = innermost) to every point drawn inside body
  function withX(...args) {
    const body = args.pop(), prev = XF;
    const f = (x, y, z) => { let q = [x, y, z]; for (const fn of args) q = fn(q[0], q[1], q[2]); return q; };
    XF = prev ? (x, y, z) => { const q = f(x, y, z); return prev(q[0], q[1], q[2]); } : f;
    body(); XF = prev;
  }

  /* ---------- samplers ---------- */
  const spow = (t, e) => Math.sign(t) * Math.pow(Math.abs(t), e);
  function boxEdges(n, cx, cy, cz, w, h, d) {
    const x0 = cx - w / 2, y0 = cy - h / 2, z0 = cz - d / 2;
    for (let i = 0; i < n; i++) {
      const e = (R() * 12) | 0, t = R(), a = e & 1, b = (e >> 1) & 1;
      if (e < 4) P(x0 + t * w, y0 + a * h, z0 + b * d); else if (e < 8) P(x0 + a * w, y0 + t * h, z0 + b * d); else P(x0 + a * w, y0 + b * h, z0 + t * d);
    }
  }
  function boxSurf(n, cx, cy, cz, w, h, d) {
    const A = [w * h, w * h, w * d, w * d, h * d, h * d], S = A.reduce((s, v) => s + v, 0);
    for (let i = 0; i < n; i++) {
      let r = R() * S, f = 0; while (r > A[f] && f < 5) { r -= A[f]; f++; }
      const u = R() - 0.5, v = R() - 0.5;
      if (f < 2) P(cx + u * w, cy + v * h, cz + (f ? 0.5 : -0.5) * d);
      else if (f < 4) P(cx + u * w, cy + (f === 3 ? 0.5 : -0.5) * h, cz + v * d);
      else P(cx + (f === 5 ? 0.5 : -0.5) * w, cy + u * h, cz + v * d);
    }
  }
  const box = (n, cx, cy, cz, w, h, d, edge = 0.35) => { const ne = Math.round(n * edge); boxEdges(ne, cx, cy, cz, w, h, d); boxSurf(n - ne, cx, cy, cz, w, h, d); };
  // rounded box (superellipsoid); e ~0.15 boxy .. 1 ellipsoid
  function sbox(n, cx, cy, cz, a, b, c, e = 0.25) {
    for (let i = 0; i < n; i++) {
      const u = Math.asin(2 * R() - 1), v = rr(-Math.PI, Math.PI), cu = Math.cos(u);
      P(cx + a * spow(cu, e) * spow(Math.cos(v), e), cy + b * spow(Math.sin(u), e), cz + c * spow(cu, e) * spow(Math.sin(v), e));
    }
  }
  // cylinder: axis "x" | "y" | "z"; cap = fraction of points on the end caps
  function cyl(n, cx, cy, cz, r, h, axis = "y", cap = 0.3) {
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, isCap = R() < cap, t = isCap ? (R() < 0.5 ? -0.5 : 0.5) * h : (R() - 0.5) * h, k = isCap ? r * Math.sqrt(R()) : r;
      const u = Math.cos(a) * k, v = Math.sin(a) * k;
      if (axis === "y") P(cx + u, cy + t, cz + v); else if (axis === "x") P(cx + t, cy + u, cz + v); else P(cx + u, cy + v, cz + t);
    }
  }
  // torus / arc; axis = ring normal
  function ring(n, cx, cy, cz, Rr, r, axis = "z", a0 = 0, a1 = TAU) {
    for (let i = 0; i < n; i++) {
      const a = rr(a0, a1), b = R() * TAU, k = Rr + r * Math.cos(b), q = r * Math.sin(b), x = k * Math.cos(a), y = k * Math.sin(a);
      if (axis === "z") P(cx + x, cy + y, cz + q); else if (axis === "y") P(cx + x, cy + q, cz + y); else P(cx + q, cy + y, cz + x);
    }
  }
  // flat annulus/disc; axis = normal
  function disc(n, cx, cy, cz, r0, r1, axis = "z") {
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, k = Math.sqrt(rr(r0 * r0, r1 * r1)), x = Math.cos(a) * k, y = Math.sin(a) * k;
      if (axis === "z") P(cx + x, cy + y, cz); else if (axis === "y") P(cx + x, cy, cz + y); else P(cx, cy + y, cz + x);
    }
  }
  function tube(n, a, b, r = 0) {
    for (let i = 0; i < n; i++) { const t = R(), j = r ? [rr(-r, r), rr(-r, r), rr(-r, r)] : [0, 0, 0]; P(a[0] + (b[0] - a[0]) * t + j[0], a[1] + (b[1] - a[1]) * t + j[1], a[2] + (b[2] - a[2]) * t + j[2]); }
  }
  // rounded-rectangle outline in the xy plane at z (thick = in-plane jitter, depth = z jitter)
  function rrPoint(w, h, rad, t) {
    const sw = w - 2 * rad, sh = h - 2 * rad, L = 2 * sw + 2 * sh + TAU * rad; let s = t * L;
    if (s < sw) return [-sw / 2 + s, h / 2]; s -= sw;
    if (s < Math.PI / 2 * rad) { const a = s / rad; return [sw / 2 + Math.sin(a) * rad, sh / 2 + Math.cos(a) * rad]; } s -= Math.PI / 2 * rad;
    if (s < sh) return [w / 2, sh / 2 - s]; s -= sh;
    if (s < Math.PI / 2 * rad) { const a = s / rad; return [sw / 2 + Math.cos(a) * rad, -sh / 2 - Math.sin(a) * rad]; } s -= Math.PI / 2 * rad;
    if (s < sw) return [sw / 2 - s, -h / 2]; s -= sw;
    if (s < Math.PI / 2 * rad) { const a = s / rad; return [-sw / 2 - Math.sin(a) * rad, -sh / 2 - Math.cos(a) * rad]; } s -= Math.PI / 2 * rad;
    if (s < sh) return [-w / 2, -sh / 2 + s]; s -= sh;
    const a = s / rad; return [-sw / 2 - Math.cos(a) * rad, sh / 2 + Math.sin(a) * rad];
  }
  function rrOutline(n, cx, cy, cz, w, h, rad, thick = 0.008, depth = 0) {
    for (let i = 0; i < n; i++) { const q = rrPoint(w, h, rad, R()); P(cx + q[0] + rr(-thick, thick), cy + q[1] + rr(-thick, thick), cz + rr(-depth, depth)); }
  }
  function rrFill(n, cx, cy, cz, w, h, rad) {
    for (let i = 0; i < n; i++) {
      let x, y, ok = false;
      for (let k = 0; k < 8 && !ok; k++) { x = rr(-w / 2, w / 2); y = rr(-h / 2, h / 2); const dx = Math.max(Math.abs(x) - (w / 2 - rad), 0), dy = Math.max(Math.abs(y) - (h / 2 - rad), 0); ok = dx * dx + dy * dy <= rad * rad; }
      P(cx + x, cy + y, cz);
    }
  }
  // horizontal plane (xz). grid > 0 snaps to grid lines
  function floor(n, cx, cy, cz, w, d, grid = 0) {
    for (let i = 0; i < n; i++) { let x = rr(-w / 2, w / 2), z = rr(-d / 2, d / 2); if (grid) { if (R() < 0.5) x = Math.round(x / grid) * grid; else z = Math.round(z / grid) * grid; } P(cx + x, cy, cz + z); }
  }
  // vertical wall; axis "x" spans x (faces z), "z" spans z (faces x). tri = draw a triangulated scan mesh
  function wall(n, cx, cy, cz, w, h, axis, grid = 0.2, tri = false) {
    for (let i = 0; i < n; i++) {
      let u = rr(-w / 2, w / 2), v = rr(-h / 2, h / 2); const k = R();
      if (grid) { if (k < 0.34) u = Math.round(u / grid) * grid; else if (k < 0.68 || !tri) v = Math.round(v / grid) * grid; else { const t = rr(0, grid); u = Math.floor(u / grid) * grid + t; v = Math.floor(v / grid) * grid + t; } }
      if (axis === "x") P(cx + u, cy + v, cz); else P(cx, cy + v, cz + u);
    }
  }
  function sphere(n, cx, cy, cz, r, shell = true) {
    for (let i = 0; i < n; i++) { const u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u), k = shell ? r : r * Math.cbrt(R()); P(cx + k * s * Math.cos(a), cy + k * u, cz + k * s * Math.sin(a)); }
  }
  // spare points: an XR grid floor under the scene plus a few drifting tracking points
  function scatter(n, w, h, d) {
    const nf = Math.round(n * 0.6);
    col([0.2, 0.42, 0.5]); floor(nf, 0, -1.3, 0, w * 0.9, d * 0.8, 0.32);
    col("dust"); for (let i = nf; i < n; i++) P(rr(-w / 2, w / 2), rr(-h / 2, h / 2), rr(-d / 2, d / 2));
  }
  // hand-tracking skeleton: 21 joints, bones between them (open palm facing the viewer)
  const HAND = [[0, 0], [-0.17, 0.09], [-0.29, 0.21], [-0.39, 0.32], [-0.46, 0.42], [-0.12, 0.38], [-0.14, 0.55], [-0.15, 0.66], [-0.16, 0.76], [-0.02, 0.4], [-0.02, 0.6], [-0.02, 0.72], [-0.02, 0.83], [0.08, 0.38], [0.09, 0.56], [0.1, 0.67], [0.11, 0.76], [0.17, 0.33], [0.2, 0.46], [0.22, 0.55], [0.24, 0.62]];
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];
  function hand(nJ, nB, mirror = 1) {
    const J = HAND.map(([x, y], i) => [x * mirror, y - 0.4, i % 4 === 0 && i ? 0.03 : 0]);
    col("white"); BONES.forEach(([a, b]) => tube(Math.round(nB / BONES.length), J[a], J[b], 0.004));
    col("cyan"); J.forEach((j, i) => sphere(Math.round(nJ / J.length), j[0], j[1], j[2], i === 0 ? 0.04 : 0.022));
  }
  function bez(n, a, c, b, wx = 0, wy = 0) { // quadratic bezier band
    for (let i = 0; i < n; i++) { const t = R(), u = 1 - t; P(u * u * a[0] + 2 * u * t * c[0] + t * t * b[0] + rr(-wx, wx), u * u * a[1] + 2 * u * t * c[1] + t * t * b[1] + rr(-wy, wy), u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]); }
  }

  /* ---------- scenes ---------- */
  const SHAPES = {
    /* Meta Quest 3 style headset with Touch Plus style controllers */
    headset(N) {
      const F = (f) => Math.round(N * f);
      /* Quest 3 front: a white face broken by three black vertical sensor pills (left/right tall, centre short).
         Points can only draw light, so the pills are true holes in the white face, outlined and with camera lenses inside. */
      const W = 0.94, H = 0.52, D = 0.3;                                                     // half sizes, ~184 x 102 x 60 mm
      const pills = [[-0.56, 0, 0.17, 0.5], [0, -0.04, 0.12, 0.3], [0.56, 0, 0.17, 0.5]];   // x, y, w, h
      const inPill = (x, y, pad = 0.02) => pills.some(([px, py, w, h]) => { const r = w / 2, dx = Math.max(Math.abs(x - px) - (w / 2 - r), 0), dy = Math.max(Math.abs(y - py) - (h / 2 - r), 0); return Math.hypot(dx, dy) < r + pad; });
      const curve = (x, y, z) => [x, y, z - 0.16 * x * x - 0.06 * y * y];                   // gently domed front, sides wrap back
      withX(curve, () => {
        col("white");
        for (let i = 0; i < F(0.3); i++) {                                                   // front face, dense, with pill holes
          let x, y, k = 0; do { x = rr(-W, W); y = rr(-H, H); k++; } while (k < 12 && (inPill(x, y) || Math.hypot(Math.max(Math.abs(x) - (W - 0.26), 0), Math.max(Math.abs(y) - (H - 0.26), 0)) > 0.26));
          if (!inPill(x, y)) P(x, y, D);
        }
        for (let i = 0; i < F(0.13); i++) {                                                  // rounded side walls, front to back
          const q = rrPoint(2 * W, 2 * H, 0.26, R()), t = R(); const sh = 1 - 0.07 * t;
          P(q[0] * sh, q[1] * sh, D - t * 2 * D);
        }
        col("bright"); rrOutline(F(0.02), 0, 0, D + 0.004, 2 * W - 0.01, 2 * H - 0.01, 0.255, 0.004); // crisp front edge
        pills.forEach(([px, py, w, h], i) => {
          col("cyan"); rrOutline(F(0.014), px, py, D + 0.01, w + 0.02, h + 0.02, w / 2 + 0.01, 0.003);
          col("dark"); rrFill(F(0.006), px, py, D - 0.01, w, h, w / 2);
          col(i === 1 ? "amber" : "cyan");
          (i === 1 ? [0] : [h * 0.24, -h * 0.24]).forEach((y) => { ring(F(0.004), px, py + y, D + 0.012, w * 0.3, 0.006, "z"); disc(F(0.002), px, py + y, D + 0.012, 0, w * 0.12, "z"); });
        });
        col("soft"); rrOutline(F(0.05), 0, -0.04, -D - 0.08, 1.7, 0.86, 0.3, 0.035, 0.05); // fabric facial interface
        col("soft"); for (let i = 0; i < F(0.012); i++) { const a = rr(0, Math.PI); P(Math.cos(a) * 0.17, -0.47 + Math.sin(a) * 0.15, -D - 0.08); } // nose cut-out
      });
      [-1, 1].forEach((s) => {                                                              // slim rigid temple arms
        col("white"); for (let i = 0; i < F(0.035); i++) { const t = R(); P(s * (0.86 + 0.06 * t), rr(-0.05, 0.05), -0.32 - 0.62 * t); }
      });
      col("dust"); for (let i = 0; i < F(0.05); i++) { const a = rr(Math.PI, TAU); P(0.92 * Math.cos(a), rr(-0.06, 0.06), -0.94 + 0.78 * Math.sin(a)); } // fabric rear strap (dim)
      col("dust"); bez(F(0.025), [0, 0.42, -0.5], [0, 0.95, -1.0], [0, 0.1, -1.7], 0.05, 0.01); // top strap (dim)
      // controllers
      [-1, 1].forEach((s) => withX(RX(0.5), RZ(-s * 0.3), RY(s * 0.4), T(s * 1.42, -0.3, 0.35), () => {
        col("white"); sbox(F(0.045), 0, -0.28, 0, 0.1, 0.28, 0.12, 0.45);                  // grip
        col("white"); sbox(F(0.04), 0, 0.06, 0.03, 0.22, 0.055, 0.17, 0.3);                // head
        col("cyan"); cyl(F(0.006), -s * 0.07, 0.13, 0.05, 0.045, 0.05, "y", 0.6);          // thumbstick
        col("amber"); ring(F(0.003), s * 0.08, 0.118, -0.01, 0.026, 0.006, "y"); ring(F(0.003), s * 0.05, 0.118, 0.09, 0.026, 0.006, "y"); // A/B buttons
        col("dark"); sbox(F(0.006), 0, -0.02, 0.17, 0.05, 0.06, 0.04, 0.4);                // trigger
      }));
      return 0.05;
    },

    /* phone scanning a printed business card, AR panel appears above */
    card(N) {
      const F = (f) => Math.round(N * f);
      withX(RY(-0.25), T(0.2, -0.7, 0.15), () => {
        col("white"); box(F(0.12), 0, 0, 0, 1.1, 0.02, 0.64, 0.25);                        // card
        const pat = [1,1,1,0,1,1,0,1,1,0,0,1,1,1,1,1,0,0,1,0,1,1,0,1,1];
        col("dark"); pat.forEach((v, i) => { if (v) for (let k = 0; k < F(0.0018); k++) P(-0.42 + (i % 5) * 0.07 + rr(0, 0.06), 0.012, -0.17 + ((i / 5) | 0) * 0.07 + rr(0, 0.06)); });
        col("soft"); [0, 1, 2].forEach((r) => tube(F(0.004), [0.02, 0.012, -0.12 + r * 0.09], [0.4 - r * 0.08, 0.012, -0.12 + r * 0.09]));
      });
      withX(RX(-0.95), RY(0.45), T(-0.85, 0.05, 0.75), () => {                               // phone
        col("steel"); sbox(F(0.1), 0, 0, 0, 0.3, 0.6, 0.035, 0.12);
        col("dark"); rrFill(F(0.04), 0, 0, 0.037, 0.54, 1.1, 0.08);
        col("cyan"); rrOutline(F(0.01), 0, 0, 0.04, 0.54, 1.1, 0.08, 0.003);
        col("soft"); rrOutline(F(0.008), -0.13, 0.42, -0.04, 0.2, 0.2, 0.06, 0.003);         // camera bump
        col("amber"); [[-0.17, 0.46], [-0.09, 0.46], [-0.17, 0.38]].forEach(([x, y]) => ring(F(0.002), x, y, -0.045, 0.025, 0.006, "z"));
      });
      col("cyan"); [[-0.35, -0.69, -0.15], [0.7, -0.69, -0.35], [-0.27, -0.69, 0.47], [0.78, -0.69, 0.27]].forEach((c) => tube(F(0.006), [-0.7, -0.15, 0.55], c)); // camera frustum
      withX(RY(-0.25), T(0.25, 0.25, 0.0), () => {                                           // AR panel
        col("cyan"); rrOutline(F(0.05), 0, 0, 0, 1.2, 0.62, 0.06, 0.006, 0.006); rrFill(F(0.04), 0, 0, -0.005, 1.2, 0.62, 0.06);
        col("bright"); tube(F(0.008), [-0.48, 0.18, 0.01], [0.1, 0.18, 0.01]); col("soft"); tube(F(0.006), [-0.48, 0.07, 0.01], [-0.05, 0.07, 0.01]);
        [["cyan", -0.3], ["amber", 0], ["bright", 0.3]].forEach(([c, x]) => { col(c); sphere(F(0.012), x, -0.14, 0.04, 0.075); });
      });
      col("amber"); box(F(0.04), -1.25, 0.45, -0.2, 0.26, 0.26, 0.26, 0.7); col("cyan"); box(F(0.04), 1.2, 0.6, -0.1, 0.22, 0.22, 0.22, 0.7);
      return 0.1;
    },

    /* luxury two-tone smartwatch: fluted bezel, batons, cyclops date, crown guards, three-piece link bracelet */
    watch(N) {
      const F = (f) => Math.round(N * f);
      col("steel"); cyl(F(0.07), 0, 0, -0.02, 0.46, 0.18, "z", 0.15);                      // case
      [-1, 1].forEach((sy) => [-1, 1].forEach((sx) => { col("steel"); box(F(0.008), sx * 0.2, sy * 0.47, -0.03, 0.1, 0.16, 0.13, 0.4); })); // lugs
      col("gold"); ring(F(0.04), 0, 0, 0.08, 0.47, 0.035, "z");                             // bezel
      for (let k = 0; k < 72; k++) { const a = (k / 72) * TAU; tube(F(0.0012), [Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0.1], [Math.cos(a) * 0.51, Math.sin(a) * 0.51, 0.1]); } // flutes
      col("dark"); disc(F(0.08), 0, 0, 0.07, 0, 0.42, "z");                                 // dial
      for (let h = 0; h < 12; h++) {                                                         // hour markers
        const a = Math.PI / 2 - (h / 12) * TAU, c = Math.cos(a), s = Math.sin(a);
        if (h === 3) continue;
        col(h === 0 ? "gold" : "bright");
        if (h === 0) { for (let i = 0; i < F(0.006); i++) { const t = R(), u = rr(-1, 1) * (1 - t) * 0.045; P(u, 0.38 - t * 0.09, 0.08); } }
        else if (h % 3 === 0) box(F(0.004), c * 0.33, s * 0.33, 0.08, h % 6 ? 0.1 : 0.03, h % 6 ? 0.03 : 0.1, 0.01, 0.6);
        else sphere(F(0.002), c * 0.34, s * 0.34, 0.08, 0.025, false);
      }
      col("bright"); rrOutline(F(0.004), 0.31, 0, 0.081, 0.09, 0.07, 0.01, 0.003);         // date window
      col("cyan"); sphere(F(0.004), 0.31, 0, 0.13, 0.07);                                    // cyclops lens
      col("bright"); tube(F(0.008), [0, 0, 0.09], [-0.15, 0.18, 0.09], 0.008);              // hour hand
      tube(F(0.01), [0, 0, 0.095], [0.22, 0.25, 0.095], 0.006);                              // minute hand
      col("amber"); tube(F(0.006), [0.05, -0.08, 0.1], [-0.2, 0.32, 0.1], 0.002);            // seconds hand
      col("gold"); cyl(F(0.003), 0, 0, 0.1, 0.02, 0.02, "z");
      col("steel"); cyl(F(0.012), 0.54, 0, -0.02, 0.07, 0.09, "x", 0.25);                   // crown
      col("gold"); ring(F(0.004), 0.59, 0, -0.02, 0.07, 0.01, "x");
      col("steel"); box(F(0.004), 0.5, 0.11, -0.02, 0.08, 0.05, 0.12, 0.5); box(F(0.004), 0.5, -0.11, -0.02, 0.08, 0.05, 0.12, 0.5); // crown guards
      // bracelet: loop round the back, three-piece links (outer steel, centre gold)
      const cz = -0.62, Rb = 0.84, p0 = Math.acos(0.62 / Rb), links = 26;
      for (let k = 0; k < links; k++) {
        const ph = p0 + (k + 0.5) / links * (TAU - 2 * p0);
        const py = Rb * Math.sin(ph), pz = cz + Rb * Math.cos(ph), ty = Math.cos(ph), tz = -Math.sin(ph), ny = Math.sin(ph), nz = Math.cos(ph);
        const L = (TAU - 2 * p0) * Rb / links * 0.92;
        const place = (x, u, v) => [x, py + u * ty + v * ny, pz + u * tz + v * nz];
        const clasp = Math.abs(ph - Math.PI) < 0.2;
        withX(place, () => {
          col("steel"); box(F(0.0045), -0.15, 0, 0, 0.12, L, 0.06, 0.45); box(F(0.0045), 0.15, 0, 0, 0.12, L, 0.06, 0.45);
          col(clasp ? "steel" : "gold"); box(F(0.004), 0, 0, 0.005, clasp ? 0.42 : 0.17, L, 0.065, 0.45);
        });
      }
      // colour options + marker
      [["gold", -0.45], ["steel", -0.15], ["blue", 0.15], ["green", 0.45]].forEach(([c, y]) => { col(c); sphere(F(0.01), 1.05, y, 0.1, 0.075); });
      col("bright"); ring(F(0.006), 1.05, -0.45, 0.1, 0.11, 0.006, "z");
      col("soft"); floor(F(0.05), 0, -1.0, -0.4, 1.6, 1.2, 0.16);
      return 0.08;
    },

    /* selective pallet racking: blue braced upright frames, orange beams, loaded pallets, aisle markings */
    racks(N) {
      const F = (f) => Math.round(N * f);
      const xs = [-1.5, -0.5, 0.5, 1.5], beams = [-0.48, 0.08, 0.64], d = 0.26, y0 = -1.0, y1 = 1.18;
      xs.forEach((x) => {
        [-d, d].forEach((z) => { col("blue"); box(F(0.012), x, (y0 + y1) / 2, z, 0.05, y1 - y0, 0.05, 0.3); });
        col([0.24, 0.42, 0.78]);
        for (let k = 0; k < 7; k++) { const ya = y0 + 0.08 + k * 0.3, yb = ya + 0.3; tube(F(0.0016), [x, ya, -d], [x, ya, d]); if (yb < y1) tube(F(0.0022), [x, ya, k % 2 ? -d : d], [x, yb, k % 2 ? d : -d]); }
        col("steel"); box(F(0.002), x, y0, 0, 0.12, 0.01, 0.62, 0.6);                        // base plates
      });
      for (let b = 0; b < 3; b++) {
        const cx = (xs[b] + xs[b + 1]) / 2;
        beams.forEach((y) => { [-d, d].forEach((z) => { col("orange"); box(F(0.008), cx, y, z, 0.95, 0.08, 0.04, 0.35); }); col("bright"); boxSurf(F(0.0008), cx, y, d + 0.022, 0.12, 0.04, 0.002); });
        [y0, ...beams.map((y) => y + 0.045)].forEach((ly, li) => {                           // loads
          if ((b * 4 + li) % 5 === 3) return;                                                 // a few empty slots
          col("wood"); box(F(0.006), cx, ly + 0.05, 0, 0.82, 0.1, 0.5, 0.5);
          const hgt = li === 3 ? 0.32 : 0.3 + ((b + li) % 3) * 0.06, two = (b + li) % 2 === 0;
          col("kraft");
          if (two) { box(F(0.007), cx - 0.2, ly + 0.1 + hgt / 2, 0, 0.38, hgt, 0.46, 0.55); box(F(0.007), cx + 0.2, ly + 0.1 + hgt / 2, 0, 0.38, hgt, 0.46, 0.55); }
          else box(F(0.011), cx, ly + 0.1 + hgt / 2, 0, 0.78, hgt, 0.46, 0.55);
        });
      }
      col("soft"); floor(F(0.08), 0, y0, 0.9, 3.6, 1.8, 0.3);
      col("amber"); tube(F(0.02), [-1.8, y0, 0.45], [1.8, y0, 0.45], 0.01);
      for (let k = 0; k < 12; k++) tube(F(0.0015), [-1.75 + k * 0.3, y0, 1.6], [-1.6 + k * 0.3, y0, 1.6]);
      return 0.06;
    },

    /* walkie electric pallet truck (BOPT) carrying a loaded pallet */
    truck(N) {
      const F = (f) => Math.round(N * f);
      col("amber"); sbox(F(0.14), -0.6, -0.16, 0, 0.3, 0.42, 0.37, 0.22);                  // power unit
      col("dark"); rrFill(F(0.01), -0.6, 0.27, 0, 0.5, 0.6, 0.08);
      withX(RX(Math.PI / 2), T(0, 0.272, 0), () => { col("cyan"); rrOutline(F(0.006), -0.62, 0.12, 0, 0.2, 0.09, 0.02, 0.004); }); // battery display
      col("red"); cyl(F(0.004), -0.75, 0.29, -0.2, 0.045, 0.04, "y", 0.6);                 // emergency stop
      col("steel"); box(F(0.03), -0.26, -0.4, 0, 0.07, 0.42, 0.7, 0.35);                    // fork frame
      [-0.25, 0.25].forEach((z) => {
        col("steel"); box(F(0.04), 0.27, -0.545, z, 1.05, 0.05, 0.17, 0.35);                   // forks
        col("dark"); cyl(F(0.004), 0.7, -0.6, z, 0.035, 0.12, "z"); cyl(F(0.003), 0.78, -0.56, z, 0.025, 0.12, "z"); // load + entry rollers
      });
      col("dark"); cyl(F(0.02), -0.6, -0.58, 0, 0.14, 0.09, "z", 0.4);                     // drive wheel
      cyl(F(0.006), -0.8, -0.66, 0.27, 0.06, 0.05, "z"); cyl(F(0.006), -0.8, -0.66, -0.27, 0.06, 0.05, "z");
      col("cyan"); sbox(F(0.01), -0.84, 0.2, 0, 0.07, 0.08, 0.09, 0.35);                    // tiller base
      tube(F(0.03), [-0.84, 0.2, 0], [-1.16, 0.74, 0], 0.025);                              // tiller arm
      const E = [-1.19, 0.79, 0], dx = -0.5, dy = 0.86;
      col("cyan"); sbox(F(0.012), E[0], E[1], 0, 0.08, 0.07, 0.16, 0.3);                    // control head
      col("soft"); for (let i = 0; i < F(0.03); i++) { const t = rr(0, Math.PI), ex = 0.2 * Math.sin(t); P(E[0] + dx * ex + rr(-0.025, 0.025), E[1] + dy * ex + rr(-0.025, 0.025), 0.25 * Math.cos(t)); } // loop handle
      col("amber"); [-1, 1].forEach((s) => sbox(F(0.004), E[0] + dx * 0.05, E[1] + dy * 0.05, s * 0.19, 0.04, 0.03, 0.05, 0.4)); // butterfly throttle
      // pallet
      const px = 0.27;
      col("wood");
      [-0.4, -0.2, 0, 0.2, 0.4].forEach((z) => box(F(0.009), px, -0.43, z, 0.95, 0.025, 0.12, 0.3));
      [-0.42, 0, 0.42].forEach((x) => box(F(0.006), px + x, -0.455, 0, 0.12, 0.025, 0.95, 0.35));
      [-0.42, 0, 0.42].forEach((x) => [-0.4, 0, 0.4].forEach((z) => box(F(0.0025), px + x, -0.505, z, 0.12, 0.075, 0.12, 0.5)));
      [-0.4, 0, 0.4].forEach((z) => box(F(0.004), px, -0.555, z, 0.95, 0.02, 0.1, 0.3));
      // cartons
      col("kraft");
      [[0.06, 0.22], [0.48, 0.22], [0.06, -0.22], [0.48, -0.22]].forEach(([x, z]) => { box(F(0.022), x, -0.27, z, 0.4, 0.3, 0.42, 0.55); tube(F(0.002), [x - 0.2, -0.118, z], [x + 0.2, -0.118, z]); });
      [[0.06, 0.22], [0.48, 0.22], [0.27, -0.22]].forEach(([x, z], i) => { box(F(0.02), x, 0.03, z, i === 2 ? 0.82 : 0.4, 0.3, 0.42, 0.55); });
      col("soft"); floor(F(0.06), 0, -0.73, 0, 3.4, 2.2, 0.3);
      return 0.07;
    },

    /* mixed reality: scanned living room, virtual screen and objects anchored in it */
    room(N) {
      const F = (f) => Math.round(N * f);
      col("soft"); floor(F(0.1), 0, -1, 0, 2.8, 2.4, 0.2);
      col([0.3, 0.55, 0.62]); wall(F(0.1), 0, 0.15, -1.2, 2.8, 2.3, "x", 0.2, true); wall(F(0.07), -1.4, 0.15, 0, 2.4, 2.3, "z", 0.2, true);
      col("steel"); boxEdges(F(0.02), 0.65, 0.4, -1.18, 0.8, 0.9, 0.02); tube(F(0.004), [0.65, -0.05, -1.18], [0.65, 0.85, -1.18]); tube(F(0.004), [0.25, 0.4, -1.18], [1.05, 0.4, -1.18]); // window
      col([0.55, 0.6, 0.7]);                                                                  // sofa
      box(F(0.05), -0.55, -0.82, -0.75, 1.3, 0.3, 0.6, 0.3); box(F(0.04), -0.55, -0.5, -0.98, 1.3, 0.5, 0.16, 0.3);
      box(F(0.015), -1.15, -0.65, -0.75, 0.12, 0.42, 0.6, 0.4); box(F(0.015), 0.05, -0.65, -0.75, 0.12, 0.42, 0.6, 0.4);
      box(F(0.02), -0.85, -0.63, -0.72, 0.56, 0.08, 0.5, 0.4); box(F(0.02), -0.25, -0.63, -0.72, 0.56, 0.08, 0.5, 0.4);
      col("wood"); box(F(0.03), 0.35, -0.72, 0.15, 0.8, 0.04, 0.45, 0.4);                    // coffee table
      [[-0.02, -0.08], [0.72, -0.08], [-0.02, 0.38], [0.72, 0.38]].forEach(([x, z]) => tube(F(0.003), [x, -1, z], [x, -0.74, z]));
      col("green"); sphere(F(0.03), 1.15, -0.25, -0.9, 0.22, false); col("kraft"); cyl(F(0.01), 1.15, -0.75, -0.9, 0.12, 0.5, "y", 0.2); // plant
      col("cyan"); rrOutline(F(0.03), -0.4, 0.55, -1.15, 1.2, 0.68, 0.04, 0.005); rrFill(F(0.03), -0.4, 0.55, -1.16, 1.2, 0.68, 0.04); // virtual screen on wall
      col("bright"); tube(F(0.004), [-0.9, 0.75, -1.14], [-0.3, 0.75, -1.14]);
      col("amber"); box(F(0.03), 0.35, -0.55, 0.15, 0.25, 0.25, 0.25, 0.8); ring(F(0.008), 0.35, -0.69, 0.15, 0.22, 0.005, "y"); // virtual cube + anchor
      col("cyan"); withX(RY(-0.5), T(1.0, 0.35, 0.45), () => { rrOutline(F(0.02), 0, 0, 0, 0.6, 0.4, 0.04, 0.005); rrFill(F(0.015), 0, 0, 0, 0.6, 0.4, 0.04); }); // floating panel
      return 0.05;
    },

    dust(N) { scatter(N, 7, 5, 5); return 0; },

    /* XR space: guardian floor + boundary walls, two tracked hands, a spatial anchor, a UI panel picked by a ray */
    guardian(N) {
      const F = (f) => Math.round(N * f);
      const fy = -1.15;
      col([0.24, 0.55, 0.62]); floor(F(0.22), 0, fy, -0.3, 5.6, 3.6, 0.28);                    // floor grid
      // boundary: rounded rectangle on the floor, grid wall rising from it and fading out
      col("cyan");
      for (let i = 0; i < F(0.05); i++) { const q = rrPoint(4.4, 2.8, 0.6, R()); P(q[0], fy, q[1] - 0.3); }
      for (let k = 0; k < 64; k++) {
        const q = rrPoint(4.4, 2.8, 0.6, k / 64);
        for (let i = 0; i < F(0.0026); i++) { const t = Math.pow(R(), 1.8); P(q[0], fy + t * 1.6, q[1] - 0.3); }
      }
      for (let r = 1; r <= 3; r++) for (let i = 0; i < F(0.012); i++) { const q = rrPoint(4.4, 2.8, 0.6, R()); P(q[0], fy + r * 0.36, q[1] - 0.3); }
      // tracked hands
      withX(RZ(0.25), RY(0.35), T(-1.25, 0.1, 0.5), () => hand(F(0.07), F(0.06), 1));
      withX(RZ(-0.2), RY(-0.35), T(1.25, 0.0, 0.5), () => hand(F(0.07), F(0.06), -1));
      // spatial anchor with axes
      col("amber"); ring(F(0.03), 0, fy + 0.01, 0.1, 0.32, 0.01, "y"); ring(F(0.015), 0, fy + 0.01, 0.1, 0.18, 0.006, "y");
      col("amber"); tube(F(0.012), [0, fy, 0.1], [0.55, fy, 0.1]);
      col("cyan"); tube(F(0.012), [0, fy, 0.1], [0, fy + 0.55, 0.1]);
      col("white"); tube(F(0.012), [0, fy, 0.1], [0, fy, 0.65]);
      // floating panel + pointer ray from the right hand
      withX(RY(-0.2), T(0.25, 0.45, -0.9), () => { col("cyan"); rrOutline(F(0.03), 0, 0, 0, 1.0, 0.56, 0.05, 0.004); rrFill(F(0.025), 0, 0, -0.005, 1.0, 0.56, 0.05); col("bright"); tube(F(0.004), [-0.38, 0.14, 0.01], [0.1, 0.14, 0.01]); col("amber"); sphere(F(0.008), 0.3, -0.1, 0.02, 0.06); });
      col("bright"); for (let i = 0; i < F(0.02); i++) { const t = R(); P(1.15 + (0.5 - 1.15) * t, 0.25 + (0.42 - 0.25) * t, 0.5 + (-0.85 - 0.5) * t); }
      return 0.12;
    },

    portal(N) {
      const F = (f) => Math.round(N * f);
      col("cyan"); ring(F(0.32), 0, 0, 0, 1.15, 0.05, "z");
      col("amber"); ring(F(0.12), 0, 0, -0.3, 0.88, 0.025, "z");
      col("cyan"); for (let i = 0; i < F(0.3); i++) { const t = R(), a = t * Math.PI * 10, r = 0.1 + t * 0.75; P(Math.cos(a) * r, Math.sin(a) * r, -t * 2.5); }
      return 0.26;
    },
  };

  function build(name, N) {
    seed = 7 + name.length * 13; OUT = { p: [], c: [] }; COL = COLS.white; XF = null;
    const dustFrac = SHAPES[name](N);
    // centre on bounding box (ignore dust)
    if (name !== "dust") {
      const p = OUT.p, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); }
      const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
      for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] -= c[k];
    }
    // trim or pad: the scene keeps (1 - dustFrac) of N, the rest is ambient dust
    const keep = Math.min(OUT.p.length / 3, Math.round(N * (1 - dustFrac)) || N);
    // random subset so every part stays represented when trimming
    const idx = Array.from({ length: OUT.p.length / 3 }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    const pos = new Float32Array(N * 3), colr = new Float32Array(N * 3);
    let w = 0;
    for (let i = 0; i < keep; i++) { const s = idx[i] * 3; pos.set(OUT.p.slice(s, s + 3), w * 3); colr.set(OUT.c.slice(s, s + 3), w * 3); w++; }
    OUT = { p: [], c: [] }; scatter(N - w, 6.5, 4.5, 4.5);
    for (let i = 0; w < N; i++, w++) { pos.set(OUT.p.slice(i * 3, i * 3 + 3), w * 3); colr.set(OUT.c.slice(i * 3, i * 3 + 3), w * 3); }
    // shuffle order so morphs swirl rather than move in blocks
    const ord = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
    const P2 = new Float32Array(N * 3), C2 = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { P2[i * 3 + k] = pos[ord[i] * 3 + k]; C2[i * 3 + k] = colr[ord[i] * 3 + k]; }
    return { pos: P2, col: C2 };
  }

  /* ---------- WebGL ---------- */
  const VS = `
  attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aCF; attribute vec3 aCT; attribute float aRnd;
  uniform float uMix, uTime, uScale, uAspect, uDpr, uSize, uJit, uScan;
  uniform vec2 uOff, uRot, uMouse;
  varying float vA; varying vec3 vC; varying float vScan;
  mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s, 0.,1.,0., s,0.,c);}
  mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);}
  void main(){
    float m = clamp(uMix*1.6 - aRnd*0.6, 0., 1.);
    m = m*m*(3.-2.*m);
    vec3 p = mix(aFrom, aTo, m);
    float burst = sin(m*3.14159);
    p += burst * 0.4 * vec3(sin(aRnd*91.), cos(aRnd*47.), sin(aRnd*13.));
    p += uJit * 0.006 * vec3(sin(uTime*1.3 + aRnd*40.), cos(uTime*1.1 + aRnd*30.), sin(uTime*0.9 + aRnd*20.));
    p = rotX(uRot.x) * rotY(uRot.y) * p;
    p *= uScale;
    vScan = smoothstep(0.08, 0., abs(p.y - uScan));
    p.xy += uOff;
    float z = 4.2 - p.z;
    float f = 1.0 / tan(radians(17.5));
    vec4 pos = vec4(p.x * f / uAspect, p.y * f, (z - 0.1) / 20.0 * z, z);
    vec2 ndc = pos.xy / pos.w;
    vec2 d = ndc - uMouse; d.x *= uAspect;
    float k = smoothstep(0.3, 0., length(d));
    pos.xy += normalize(d + 1e-5) * k * 0.08 * pos.w;
    gl_Position = pos;
    gl_PointSize = uSize * uDpr * (2.6 / z) * (0.65 + aRnd*0.6) * (1. + vScan*1.1);
    vA = clamp(1.6 - z*0.2, 0.3, 1.0);
    vC = mix(aCF, aCT, m);
  }`;
  const FS = `
  precision mediump float;
  uniform float uAlpha;
  varying float vA; varying vec3 vC; varying float vScan;
  void main(){
    vec2 c = gl_PointCoord - .5; float d = length(c);
    if(d > .5) discard;
    float a = smoothstep(.5, .12, d) * vA * uAlpha;
    vec3 col = mix(vC, vec3(1.), vScan*.6);
    gl_FragColor = vec4(col * a, a);
  }`;

  function create(canvas, opts) {
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    if (!gl) return null;
    const N = opts.count, shapes = {};
    Object.keys(SHAPES).forEach((k) => (shapes[k] = build(k, N)));

    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = (data, name, size, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); return b; };
    const rnd = new Float32Array(N); for (let i = 0; i < N; i++) rnd[i] = Math.random();
    const start = opts.start || "dust";
    const bF = buf(shapes[start].pos, "aFrom", 3, gl.DYNAMIC_DRAW), bT = buf(shapes[start].pos, "aTo", 3, gl.DYNAMIC_DRAW);
    const cF = buf(shapes[start].col, "aCF", 3, gl.DYNAMIC_DRAW), cT = buf(shapes[start].col, "aCT", 3, gl.DYNAMIC_DRAW);
    buf(rnd, "aRnd", 1, gl.STATIC_DRAW);
    const U = {}; ["uMix", "uTime", "uScale", "uAspect", "uDpr", "uSize", "uJit", "uScan", "uOff", "uRot", "uMouse", "uAlpha"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);

    let curF = start, curT = start, W = 1, H = 1, dpr = 1;
    const resize = () => { dpr = Math.min(devicePixelRatio || 1, opts.maxDpr); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
    resize();
    const up = (b, data) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); };

    /* swap a scene for a scanned model (.pts: "PTS1" | n | extent | int16 xyz | uint8 rgb) */
    async function load(name, url, dustFrac = 0.06, scale = 1) {
      const res = await fetch(url); if (!res.ok) throw new Error(url + " " + res.status);
      const ab = await res.arrayBuffer(), dv = new DataView(ab);
      if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "PTS1") throw new Error("bad points file");
      const n = dv.getUint32(4, true), ext = dv.getFloat32(8, true) * scale;
      const q = new Int16Array(ab, 12, n * 3), rgb = new Uint8Array(ab, 12 + n * 6, n * 3);
      const keep = Math.min(n, Math.round(N * (1 - dustFrac))), pos = new Float32Array(N * 3), colr = new Float32Array(N * 3);
      const stride = n / keep;
      for (let i = 0; i < keep; i++) { const s = Math.floor(i * stride) * 3; for (let k = 0; k < 3; k++) { pos[i * 3 + k] = (q[s + k] / 32767) * ext; colr[i * 3 + k] = rgb[s + k] / 255; } }
      seed = 99; OUT = { p: [], c: [] }; scatter(N - keep, 6.5, 4.5, 4.5);
      pos.set(OUT.p, keep * 3); colr.set(OUT.c, keep * 3);
      // shuffle so morphs swirl
      for (let i = N - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; for (let k = 0; k < 3; k++) { let t = pos[i * 3 + k]; pos[i * 3 + k] = pos[j * 3 + k]; pos[j * 3 + k] = t; t = colr[i * 3 + k]; colr[i * 3 + k] = colr[j * 3 + k]; colr[j * 3 + k] = t; } }
      shapes[name] = { pos, col: colr };
      if (curF === name) curF = null; if (curT === name) curT = null;
    }

    return {
      shapes: Object.keys(shapes),
      load,
      resize,
      render(s) {
        if (s.from !== curF) { up(bF, shapes[s.from].pos); up(cF, shapes[s.from].col); curF = s.from; }
        if (s.to !== curT) { up(bT, shapes[s.to].pos); up(cT, shapes[s.to].col); curT = s.to; }
        gl.uniform1f(U.uMix, s.mix); gl.uniform1f(U.uTime, s.time); gl.uniform1f(U.uScale, s.scale);
        gl.uniform1f(U.uAspect, W / H); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uSize, opts.size);
        gl.uniform1f(U.uJit, s.jitter); gl.uniform1f(U.uScan, s.scan);
        gl.uniform2f(U.uOff, s.offX, s.offY); gl.uniform2f(U.uRot, s.rotX, s.rotY); gl.uniform2f(U.uMouse, s.mouseX, s.mouseY);
        gl.uniform1f(U.uAlpha, s.alpha);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.POINTS, 0, N);
      },
    };
  }

  window.PointCloud = { create };
})();
