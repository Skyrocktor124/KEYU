// 「她，自有力量」· 吉卜力式黎明山岗（25s，纯代码，2.39:1 遮幅）
// 叙事：天将亮未亮 → 风起 → 太阳从山坳里升起、照亮她 → 拉远，天地开阔。
// 镜头：A 0–6.9 大远景（她是山岗上的一个小剪影）
//       B 6.1–13.3 中近景（背侧 3/4「失去的侧脸」，长发在风里，抬手把头发别到耳后）
//       C/D 12.5–25 一镜到底：中景看日出、张开双臂 → 缓缓拉远到全景，片名浮现
// 画法：天空/远山按黎明→晨光两套色板插值；山脊是矢量路径（任意推近都不糊）+ 水彩斑驳；雾、云缓存成两套色调交叉淡化；
//       人物是逆光：本体偏冷暗，只在剪影外缘留一道暖色轮廓光（人物整层光栅化后「自身 − 向左下平移的自身」），再模糊叠一层光晕；
//       后期：bloom、日光十字/变形镜头拉丝、景深虚化、胶片颗粒、暗角、遮幅。
// 预览 index.html?film=demos/women_ghibli   渲染 render.py --film demos/women_ghibli --fps 30 --out 成片.mp4
(() => {
  const W = 1920, H = 1080, { clamp, lerp, rng } = U, P = PAINT, TAU = Math.PI * 2;
  const DUR = 25, LB = 138;                                   // 2.39:1 遮幅：画面 y 138..942
  window.FONT_FACES.push(
    { family: 'SerifSC-500', url: 'demos/women_ghibli/fonts/NotoSerifSC-500.ttf' },
    { family: 'SerifSC-300', url: 'demos/women_ghibli/fonts/NotoSerifSC-300.ttf' });

  // ---------- 小工具 ----------
  const sm = (a, b, x) => { const q = clamp((x - a) / (b - a)); return q * q * (3 - 2 * q); };
  const eio = q => 0.5 - 0.5 * Math.cos(Math.PI * clamp(q));
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixv = (a, b, q) => { const A = hex(a), B = hex(b); return A.map((v, i) => Math.round(v + (B[i] - v) * q)); };
  const rgb = (v, a = 1) => `rgba(${v[0]},${v[1]},${v[2]},${a})`;
  const mix = (a, b, q, al = 1) => rgb(mixv(a, b, q), al);
  const ramp = (stops, p) => { let i = 0; while (i < stops.length - 2 && p > stops[i + 1][0]) i++; const [p0, c0] = stops[i], [p1, c1] = stops[i + 1]; return mixv(c0, c1, clamp((p - p0) / (p1 - p0))); };
  const poly = pts => RIG.smooth(pts, true);
  const BIGP = (() => { const p = new Path2D(); p.rect(-1e5, -1e5, 2e5, 2e5); return p; })();
  const clipOff = (g, path, dx, dy) => { const m = new Path2D(); m.addPath(BIGP); m.addPath(path, new DOMMatrix().translate(dx, dy)); g.clip(path); g.clip(m, 'evenodd'); };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const CK = {}; const cached = (k, w, h, fn) => CK[k] || (CK[k] = (() => { const c = canvas(w, h); fn(c.getContext('2d'), c); return c; })());

  // ---------- 时间函数 ----------
  const dayP = t => Math.pow(clamp((t - 0.3) / 21.5), 0.92);                       // 0 黎明前 → 1 清晨
  const windAt = t => 0.62 + 0.14 * Math.sin(t * 1.1) + 0.09 * Math.sin(t * 2.9 + 1) + 0.38 * (sm(13.6, 15.2, t) - sm(19.5, 22, t));
  const SUNX = 1100, sunY = t => 774 - 330 * eio((t - 3.5) / 21.5);
  const sunVis = t => sm(12.4, 14.2, t);
  const SKY = {
    top: [[0, '#10172e'], [0.5, '#223660'], [1, '#3a6ca8']],
    mid: [[0, '#2e355c'], [0.5, '#62709f'], [1, '#8db2d9']],
    low: [[0, '#6f5a80'], [0.5, '#cf8f9c'], [1, '#efd2c2']],
    hz: [[0, '#c48a86'], [0.5, '#ffc08e'], [1, '#fff0d6']],
  };
  const skyGrad = (g, y0, y1, p) => { const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, rgb(ramp(SKY.top, p))); gr.addColorStop(0.45, rgb(ramp(SKY.mid, p))); gr.addColorStop(0.8, rgb(ramp(SKY.low, p))); gr.addColorStop(1, rgb(ramp(SKY.hz, p))); return gr; };

  // ---------- 世界：山脊（矢量路径） ----------
  const RIDGES = [
    { f: 0.35, base: 680, amp: 30, fr: 0.0035, seed: 1, peaks: [[360, 150, 260], [1640, 125, 280], [2000, 70, 200], [1100, -12, 120]], cols: [['#4f4f78', '#6e6790'], ['#8ba4c6', '#bccbdf']], glow: 0.75 },
    { f: 0.45, base: 714, amp: 24, fr: 0.005, seed: 2, peaks: [[100, 64, 220], [820, 44, 240], [1820, 44, 220]], cols: [['#40406a', '#5a5580'], ['#6f8cb0', '#9fb5cc']], glow: 0.5 },
    { f: 0.6, base: 748, amp: 16, fr: 0.008, seed: 3, peaks: [[1330, 34, 220], [420, 18, 200]], trees: { n: 70, r: [3, 7], seed: 31 }, cols: [['#2f3150', '#46445f'], ['#517388', '#81a0a8']], glow: 0.3 },
    { f: 0.75, base: 790, amp: 11, fr: 0.011, seed: 4, peaks: [[1560, 20, 260]], trees: { n: 46, r: [5, 10], seed: 41 }, bigTree: 1560, house: 1380, cols: [['#20223a', '#30304a'], ['#3b5c4c', '#5f8268']], glow: 0.15 },
  ];
  const ridgeY = (R, x) => R.base - R.amp * (0.5 + P.fbm(x * R.fr + R.seed * 17.3, R.seed * 5.1, 4)) - R.peaks.reduce((s, [px, h, w]) => s + h * Math.exp(-Math.pow((x - px) / w, 2)), 0);
  const EL = (p, x, y, rx, ry) => { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, TAU); p.closePath(); };   // 先 moveTo：否则 ellipse 会和上一个点连成一条边
  RIDGES.forEach(R => {
    const p = new Path2D(); p.moveTo(-500, 1600);
    for (let x = -500; x <= 2420; x += 6) p.lineTo(x, ridgeY(R, x));
    p.lineTo(2420, 1600); p.closePath();
    if (R.trees) { const r = rng(R.trees.seed); for (let i = 0; i < R.trees.n; i++) { const x = -200 + r() * 2320, y = ridgeY(R, x), rr = R.trees.r[0] + r() * (R.trees.r[1] - R.trees.r[0]);
      if (r() < 0.5) EL(p, x, y - rr * 1.2, rr * 0.55, rr * 1.5); else { EL(p, x, y - rr * 0.8, rr, rr * 0.85); EL(p, x + rr * 0.7, y - rr * 0.5, rr * 0.7, rr * 0.6); } } }
    if (R.bigTree) { const x = R.bigTree, y = ridgeY(R, x), r = rng(9);
      p.moveTo(x - 3, y + 2); p.lineTo(x - 2.5, y - 42); p.lineTo(x + 2.5, y - 42); p.lineTo(x + 4, y + 2); p.closePath();
      for (let i = 0; i < 20; i++) { const a = r() * TAU, d = r() * 26; EL(p, x + Math.cos(a) * d * 1.3, y - 62 + Math.sin(a) * d * 0.7, 12 + r() * 12, 10 + r() * 9); } }
    if (R.house) { const x = R.house, y = ridgeY(R, x) + 2; p.rect(x - 11, y - 14, 22, 14); p.moveTo(x - 14, y - 13); p.lineTo(x, y - 24); p.lineTo(x + 14, y - 13); p.closePath(); R.win = [x - 4, y - 10]; }
    R.path = p;
    R.top = Math.min(...R.peaks.map(([px]) => ridgeY(R, px))) - 20;
  });
  const GX = 700, GY = 800, S0 = 0.3;                             // 少女脚底与世界比例（身高 600 单位 → 180px）
  const hillY = x => GY + Math.pow((x - GX) / 850, 2) * 170 + 4 * Math.sin(x * 0.01);
  const HILL = (() => { const p = new Path2D(); p.moveTo(-600, 1700); for (let x = -600; x <= 2600; x += 8) p.lineTo(x, hillY(x)); p.lineTo(2600, 1700); p.closePath(); return p; })();
  const CREST = (() => { const p = new Path2D(); for (let x = -600; x <= 2600; x += 8) x === -600 ? p.moveTo(x, hillY(x)) : p.lineTo(x, hillY(x)); return p; })();

  // ---------- 缓存的软质：天空斑驳、云、雾 ----------
  const blot = () => cached('blot', W, H, g => { const r = rng(404); for (let i = 0; i < 70; i++) P.watercolor(g, P.ellipsePts(r() * W, r() * H, 80 + r() * 260, 40 + r() * 140, 10), ['#8a8fb0', '#c8b0b8', '#a0b8c8', '#b8a890'][i % 4], { layers: 3, alpha: 0.05, amp: 40, seed: 70 + i, edge: 0.03 }); });
  const cloudSet = (key, kind, shade, lit) => cached('cl_' + key, W, H, g => {
    const r = rng(kind === 'high' ? 501 : 777), tmp = canvas(W, H), tg = tmp.getContext('2d');
    const list = kind === 'high'
      ? [[300, 250, 520, 16], [880, 205, 640, 13], [1420, 270, 560, 18], [620, 360, 460, 12], [1260, 380, 520, 14], [1720, 190, 380, 11], [160, 420, 380, 10], [1000, 470, 420, 11]]
      : [[220, 600, 300, 34], [520, 630, 260, 28], [1580, 610, 320, 36], [1840, 640, 240, 26], [1240, 650, 220, 22]];
    for (const [cx, cy, L, th] of list) {
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, W, H); tg.fillStyle = '#fff';
      const n = kind === 'high' ? 16 : 12, el = [];
      for (let i = 0; i < n; i++) { const q = i / (n - 1); el.push([cx + (q - 0.5) * L + (r() - 0.5) * 30, cy + (r() - 0.5) * th * 0.8 - (kind === 'high' ? 0 : Math.sin(q * Math.PI) * th * 0.9), (kind === 'high' ? L / n * 1.6 : L / n * 1.3) * (0.7 + r() * 0.6), th * (0.5 + r() * 0.6)]); }
      tg.filter = 'blur(7px)'; tg.globalAlpha = 0.75; el.forEach(([x, y, rx, ry]) => { tg.beginPath(); tg.ellipse(x, y, rx, ry, 0, 0, TAU); tg.fill(); });
      tg.filter = 'blur(1.5px)'; tg.globalAlpha = 0.55; el.forEach(([x, y, rx, ry]) => { tg.beginPath(); tg.ellipse(x + rx * 0.1, y + ry * 0.15, rx * 0.72, ry * 0.6, 0, 0, TAU); tg.fill(); });
      tg.filter = 'none'; tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-in';
      const gr = tg.createLinearGradient(0, cy - th * 1.6, 0, cy + th * 0.9); gr.addColorStop(0, shade); gr.addColorStop(1, lit); tg.fillStyle = gr; tg.fillRect(0, 0, W, H); tg.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, 0, 0);
    }
  });
  const mistSet = (key, col) => cached('mist_' + key, W, H, g => { const r = rng(88); g.fillStyle = col; g.filter = 'blur(16px)';
    [[728, 18], [766, 16], [806, 22]].forEach(([y, th], k) => { for (let i = 0; i < 14; i++) { g.globalAlpha = 0.18 + r() * 0.2; g.beginPath(); g.ellipse(-100 + r() * 2120, y + (r() - 0.5) * 10, 140 + r() * 260, th * (0.6 + r() * 0.7), 0, 0, TAU); g.fill(); } void k; });
    g.filter = 'none'; g.globalAlpha = 1; });
  const moon = () => cached('moon', 80, 80, g => { g.fillStyle = '#f7f0df'; g.beginPath(); g.arc(40, 40, 15, 0, TAU); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(47, 35, 14, 0, TAU); g.fill(); });
  const STARS = (() => { const r = rng(3); return Array.from({ length: 110 }, () => [r() * W, 140 + Math.pow(r(), 1.5) * 420, 0.5 + r() * 1.3, r() * TAU]); })();
  const BLADES = (() => { const r = rng(5), out = [];
    for (let i = 0; i < 2600; i++) { const x = -300 + r() * 2500, d = Math.pow(r(), 1.8) * 380, y = hillY(x) + d;
      out.push({ x, y, d, h: 9 + r() * 14 + d * 0.11, ph: r() * TAU, b: (r() * 4) | 0, lw: 1.1 + r() * 1.2 + d * 0.01 }); }
    return out; })();
  const FLOWERS = (() => { const r = rng(6); return Array.from({ length: 140 }, () => { const x = -200 + r() * 2300, d = 8 + Math.pow(r(), 1.4) * 330; return [x, hillY(x) + d, 1.6 + d * 0.012 + r(), r() * TAU]; }); })();
  const grainSet = () => cached('grain', 1, 1, () => {}) && [0, 1, 2].map(k => cached('gr' + k, 960, 540, g => { const im = g.createImageData(960, 540), d = im.data, r = rng(900 + k); for (let i = 0; i < d.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 70; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(im, 0, 0); }));

  // ---------- 相机（按层视差） ----------
  const layerT = (g, cam, f) => { const z = 1 + (cam.z - 1) * f, cx = lerp(960, cam.cx, f), cy = lerp(540, cam.cy, f); g.setTransform(z, 0, 0, z, 960 - cx * z, 540 - cy * z); return { z, cx, cy }; };
  const toScreen = (cam, f, x, y) => { const z = 1 + (cam.z - 1) * f, cx = lerp(960, cam.cx, f), cy = lerp(540, cam.cy, f); return [960 + (x - cx) * z, 540 + (y - cy) * z]; };

  // ---------- 少女（局部坐标：脚底原点，身高 600；背侧 3/4，面朝右前方远处） ----------
  const GC = { skin: ['#8e6e78', '#d4a08a'], skinS: ['#6e5262', '#b07d72'], dress: ['#7f84a8', '#e6e2ec'], dressS: ['#5f6388', '#aeb0c8'],
    sash: ['#6e4258', '#c47a72'], hair: ['#17121a', '#2e1f1f'], hairHi: ['#3a2e3e', '#7a5040'], shoe: ['#3e3848', '#7b6a70'] };
  const LN = { skin: '#4e3440', dress: '#4a4a6e', hair: '#0c080c', sash: '#3a2030' };
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  function ribbon(sp, hw) {
    const A = [], B = [], n = sp.length;
    for (let i = 0; i < n; i++) { const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)], [tx, ty] = unit(a, b), w = hw(i / (n - 1)); A.push([sp[i][0] - ty * w, sp[i][1] + tx * w]); B.push([sp[i][0] + ty * w, sp[i][1] - tx * w]); }
    return poly(A.concat(B.reverse()));
  }
  function flow(x0, y0, len, n, w, t, ph, amp, turn0 = 0, dirSign = 1) {   // 一缕：先下垂，越往末端越被风吹向左
    const pts = [[x0, y0]]; let x = x0, y = y0;
    for (let i = 1; i <= n; i++) { const q = i / n, th = Math.PI / 2 + turn0 + dirSign * (0.3 + 0.95 * w) * Math.pow(q, 1.1); x += Math.cos(th) * len / n; y += Math.sin(th) * len / n; pts.push([x, y]); }
    return pts.map((p, i) => { if (!i) return p; const q = i / n, a = pts[i - 1], b = pts[Math.min(n, i + 1)], [tx, ty] = unit(a, b);
      const off = amp * q * Math.sin(t * 4.3 - q * 5.6 + ph) + amp * 0.35 * q * Math.sin(t * 9.3 - q * 9 + ph * 1.7); return [p[0] - ty * off, p[1] + tx * off]; });
  }
  function limbPath(S, E, Hd, w0, w1, w2) {
    const pts = [S, [(S[0] + E[0]) / 2, (S[1] + E[1]) / 2], E, [(E[0] + Hd[0]) / 2, (E[1] + Hd[1]) / 2], Hd], ws = [w0, (w0 + w1) / 2 + 0.5, w1, (w1 + w2) / 2, w2], A = [], B = [];
    for (let i = 0; i < 5; i++) { const [tx, ty] = unit(pts[Math.max(0, i - 1)], pts[Math.min(4, i + 1)]); A.push([pts[i][0] - ty * ws[i], pts[i][1] + tx * ws[i]]); B.push([pts[i][0] + ty * ws[i], pts[i][1] - tx * ws[i]]); }
    const d0 = unit(pts[0], pts[1]), d4 = unit(pts[3], pts[4]);
    return poly([...A, [Hd[0] + d4[0] * w2 * 0.9, Hd[1] + d4[1] * w2 * 0.9], ...B.reverse(), [S[0] - d0[0] * w0 * 0.9, S[1] - d0[1] * w0 * 0.9]]);
  }
  const armIK = (S, T, bend, a = 90, b = 86) => { const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.min(Math.hypot(dx, dy), a + b - 0.5), ang = Math.atan2(dy, dx);
    const k = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), e = ang + bend * k, E = [S[0] + Math.cos(e) * a, S[1] + Math.sin(e) * a], u = unit(E, T); return [E, [E[0] + u[0] * b, E[1] + u[1] * b]]; };

  // 一条肢体：沿 S→E→H 六个截面的宽度（三角肌 → 肘 → 前臂上段微鼓 → 腕）
  function limb(S, E, Hd, ws) {
    const lp = (a, b, q) => [lerp(a[0], b[0], q), lerp(a[1], b[1], q)];
    const pts = [S, lp(S, E, 0.45), E, lp(E, Hd, 0.28), lp(E, Hd, 0.68), Hd], A = [], B = [];
    for (let i = 0; i < pts.length; i++) { const [tx, ty] = unit(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]); A.push([pts[i][0] - ty * ws[i], pts[i][1] + tx * ws[i]]); B.push([pts[i][0] + ty * ws[i], pts[i][1] - tx * ws[i]]); }
    const d0 = unit(pts[0], pts[1]);
    return poly([...A, ...B.reverse(), [S[0] - d0[0] * ws[0] * 0.8, S[1] - d0[1] * ws[0] * 0.8]]);
  }
  // 手：放松的手掌＋并拢的手指，沿前臂方向
  const HAND = [[-1, -4.8], [6, -5.6], [12, -5.2], [17.5, -3.6], [21.5, -1.2], [22.5, 0.8], [20, 2.8], [14, 4.4], [8, 5.6], [3, 6.2], [-1, 4.8]];
  const handPath = (Hd, dir, flip) => { const a = Math.atan2(dir[1], dir[0]), c = Math.cos(a), s = Math.sin(a);
    return poly(HAND.map(([x, y]) => { y *= flip; return [Hd[0] + x * c - y * s, Hd[1] + x * s + y * c]; })); };

  function girl(g, o) {
    const { t, w, L } = o, b = o.br, C = k => mix(GC[k][0], GC[k][1], L), sd = o.sd, lw = o.lw, px = 1 / o.s;
    const F = (path, fill, line, shade, shadeA = 0.4) => { g.fillStyle = fill; g.fill(path);
      if (shade) { g.save(); clipOff(g, path, sd, -sd * 0.25); g.globalAlpha = shadeA; g.fillStyle = shade; g.fill(path); g.restore(); }
      if (line) { g.save(); g.globalAlpha = 0.55; g.strokeStyle = line; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(path); g.restore(); } };
    const hgrad = (x0, x1, c0, c1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
    const soft = (path, fn) => { g.save(); g.clip(path); fn(); g.restore(); };
    // 手臂：先画在身体后面（肩头由上身的三角肌轮廓盖住接缝）
    const arm = (S, T, bend, flip, part = 'all') => {
      const [E, Hd] = armIK(S, T, bend, 88, 82), dir = unit(E, Hd);
      if (part !== 'hand') { const lp = limb(S, E, Hd, [11.6, 9.6, 7.0, 7.8, 6.0, 4.8]); F(lp, C('skin'), LN.skin, C('skinS'), 0.35);
        soft(lp, () => { g.globalAlpha = 0.25; g.strokeStyle = C('skinS'); g.lineWidth = 2.2; g.beginPath(); g.moveTo(E[0] - dir[1] * 3, E[1] + dir[0] * 3); g.lineTo(E[0] + dir[0] * 6, E[1] + dir[1] * 6); g.stroke(); }); }
      if (part !== 'arm') { const hp = handPath([Hd[0] - dir[0] * 1.5, Hd[1] - dir[1] * 1.5], dir, flip); F(hp, C('skin'), LN.skin, C('skinS'), 0.3);
        if (o.s > 1) { g.save(); g.globalAlpha = 0.35; g.strokeStyle = LN.skin; g.lineWidth = px * 0.9; [[-1.2], [1.4]].forEach(([k]) => { const a = Math.atan2(dir[1], dir[0]); g.beginPath(); const p0 = [Hd[0] + Math.cos(a) * 13 - Math.sin(a) * k * flip, Hd[1] + Math.sin(a) * 13 + Math.cos(a) * k * flip]; g.moveTo(...p0); g.lineTo(p0[0] + Math.cos(a) * 6, p0[1] + Math.sin(a) * 6); g.stroke(); }); g.restore(); } }
      return [E, Hd];
    };
    const hold = o.hold || 0;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    arm([40, -468 + b], o.handR, o.bendR, 1);
    if (hold < 0.5) arm([-42, -468 + b], o.handL, o.bendL, -1);
    else arm([-42, -468 + b], o.handL, o.bendL, -1, 'arm');
    // 腿、鞋
    F(limb([-12, -100], [-12, -54], [-10, -12], [6.2, 5.6, 4.6, 4.8, 4.2, 3.6]), C('skin'), LN.skin, C('skinS'), 0.3);
    F(limb([12, -100], [13, -54], [15, -12], [6.2, 5.6, 4.6, 4.8, 4.2, 3.6]), C('skin'), LN.skin, C('skinS'), 0.3);
    F(poly([[-14, -9], [-4, -12], [8, -8], [10, -3], [-2, -1], [-14, -3]]), C('shoe'), LN.hair); F(poly([[10, -8], [20, -11], [32, -7], [34, -2], [22, 0], [10, -2]]), C('shoe'), LN.hair);
    // 裙：后摆被风吹开，前摆贴腿
    const push = 30 + 75 * w, left = [];
    for (let i = 1; i <= 6; i++) { const q = i / 6; left.push([-32 - q * 16 - Math.pow(q, 1.6) * push + Math.sin(t * 4.6 - q * 6) * 4 * q, -400 + q * 328]); }
    const hl = left[5], hem = [];
    for (let i = 1; i <= 9; i++) { const q = i / 10; hem.push([lerp(hl[0], 40 - 8 * w, q), -70 + Math.sin(t * 6.1 - q * 10) * 5 * (1 - q * 0.7) + q * 4]); }
    const skirt = poly([[-31, -400], ...left, ...hem, [40 - 8 * w, -70], [43, -160], [39, -262], [34, -340], [31, -400]]);
    F(skirt, hgrad(-100 - push * 0.5, 40, C('dressS'), C('dress')), LN.dress, C('dressS'), 0.3);
    soft(skirt, () => {                                              // 布料：柔和的明暗褶（模糊宽笔触）＋ 几道细褶线
      g.filter = `blur(${Math.max(1, 4 * o.s)}px)`;
      for (let k = 0; k < 7; k++) { const q = (k + 0.5) / 7, x0 = lerp(-26, 28, q), x1 = lerp(hl[0] + 10, 36, q) + Math.sin(t * 6.1 - q * 10) * 4, xm = lerp(-38 - push * 0.45, 32, q);
        g.globalAlpha = k % 2 ? 0.32 : 0.22; g.strokeStyle = k % 2 ? C('dressS') : '#ffffff'; g.lineWidth = 9; g.beginPath(); g.moveTo(x0, -392); g.quadraticCurveTo(xm, -240, x1, -76); g.stroke(); }
      g.filter = 'none'; g.globalAlpha = 0.35; g.strokeStyle = C('dressS'); g.lineWidth = lw;
      for (let k = 1; k <= 4; k++) { const q = k / 5; g.beginPath(); g.moveTo(lerp(-24, 24, q), -380); g.quadraticCurveTo(lerp(-40 - push * 0.5, 30, q), -240, lerp(hl[0], 36, q) + Math.sin(t * 6.1 - q * 10) * 4, -78); g.stroke(); }
    });
    { const push2 = 50 + 125 * w, ol = [];                           // 外层雪纺：更轻、飘得更开，逆光里透亮
      for (let i = 1; i <= 7; i++) { const q = i / 7; ol.push([-30 - q * 18 - Math.pow(q, 1.4) * push2 + Math.sin(t * 5.3 - q * 7 + 1) * 9 * q, -394 + q * 312]); }
      const e = ol[6], oh = [];
      for (let i = 1; i <= 8; i++) { const q = i / 9; oh.push([lerp(e[0], 12, q), -82 + Math.sin(t * 6.8 - q * 9 + 2) * 9 * (1 - q * 0.6)]); }
      const ov = poly([[-30, -394], ...ol, ...oh, [14, -86], [16, -250], [20, -394]]);
      g.save(); g.globalAlpha = 0.38; g.fillStyle = C('dress'); g.fill(ov); g.globalAlpha = 0.16 + 0.3 * L; g.globalCompositeOperation = 'screen'; g.fillStyle = '#ffe2bc'; g.fill(ov); g.restore();
      g.save(); g.globalAlpha = 0.28; g.strokeStyle = LN.dress; g.lineWidth = lw * 0.8; g.stroke(ov); g.restore(); }
    // 脖子
    F(poly([[-4, -514], [16, -514], [21, -486 + b], [-6, -486 + b]]), C('skin'), LN.skin, C('skinS'), 0.45);
    // 后背：斜方肌—肩头—三角肌—背阔肌—收腰，一条连续的轮廓
    const back = poly([[-8, -496 + b], [-30, -490 + b], [-47, -482 + b], [-55, -468 + b], [-54, -450 + b], [-46, -438], [-40, -420], [-31, -401], [31, -401], [37, -420], [42, -438], [50, -450 + b], [51, -467 + b], [44, -480 + b], [27, -490 + b], [18, -496 + b]]);
    F(back, hgrad(-56, 52, C('skinS'), C('skin')), LN.skin, C('skinS'), 0.3);
    soft(back, () => { g.filter = `blur(${Math.max(1, 3 * o.s)}px)`; g.fillStyle = C('skinS'); g.globalAlpha = 0.35;
      [[-20, -462, 12, 16, 0.3], [18, -462, 11, 15, -0.3]].forEach(([x, y, rx, ry, r]) => { g.beginPath(); g.ellipse(x, y + b, rx, ry, r, 0, TAU); g.fill(); });
      g.fillRect(-2, -490 + b, 4, 40); g.filter = 'none'; });
    const bod = poly([[-47, -458 + b], [-36, -462 + b], [-20, -452 + b], [0, -446 + b], [18, -452 + b], [32, -462 + b], [44, -458 + b], [44, -440], [39, -420], [32, -400], [-32, -400], [-41, -420], [-47, -440]]);
    F(bod, hgrad(-48, 46, C('dressS'), C('dress')), LN.dress, C('dressS'), 0.3);
    soft(bod, () => { g.globalAlpha = 0.3; g.strokeStyle = C('dressS'); g.lineWidth = lw; [[-24, -444, -18, -404], [-6, -440, -4, -404], [12, -442, 10, -404]].forEach(([a, c, d, e]) => { g.beginPath(); g.moveTo(a, c); g.lineTo(d, e); g.stroke(); }); });
    [[-36, -461, -29, -490], [32, -461, 25, -490]].forEach(([a, c, d, e]) => { g.strokeStyle = LN.dress; g.globalAlpha = 0.5; g.lineWidth = 4.4; g.beginPath(); g.moveTo(a, c + b); g.lineTo(d, e + b); g.stroke(); g.globalAlpha = 1; g.strokeStyle = C('dress'); g.lineWidth = 2.8; g.stroke(); });
    F(poly([[-33, -409], [33, -409], [32, -395], [-32, -395]]), C('sash'), LN.sash);
    [[0.3, -0.6], [1.7, 0.4]].forEach(([ph, tt]) => { const sp = flow(-6, -400, 72 + 34 * w, 9, w, t, ph, 7, 0.15 + tt * 0.2); F(ribbon(sp, q => 4.8 - q * 1.6 + Math.sin(q * 9 + t * 5 + ph) * 0.6), C('sash'), LN.sash); });
    { const l1 = poly([[-5, -402], [-14, -412], [-24, -411], [-27, -403], [-20, -396], [-8, -398]]), l2 = poly([[-5, -402], [4, -413], [15, -413], [18, -405], [11, -397], [-1, -398]]), k = new Path2D(); k.ellipse(-5, -402, 4.6, 5.4, 0, 0, TAU);
      F(l1, C('sash'), LN.sash, mix(GC.sash[0], '#000000', 0.25), 0.4); F(l2, C('sash'), LN.sash, mix(GC.sash[0], '#000000', 0.25), 0.4); F(k, C('sash'), LN.sash); }
    // 头：绕颈根转 tilt
    const piv = [8, -504], ct = Math.cos(o.tilt), st = Math.sin(o.tilt), rot = ([x, y]) => [piv[0] + (x - piv[0]) * ct - (y - piv[1]) * st, piv[1] + (x - piv[0]) * st + (y - piv[1]) * ct];
    const inHead = fn => { g.save(); g.translate(...piv); g.rotate(o.tilt); g.translate(-piv[0], -piv[1]); fn(); g.restore(); };
    inHead(() => {
      const face = poly([[-20, -560], [0, -596], [26, -591], [40, -575], [46, -559], [48.5, -547], [45.5, -538], [47.5, -529], [44, -515], [37, -505], [25, -499], [10, -503], [-8, -516], [-18, -536]]);
      F(face, hgrad(10, 48, C('skinS'), C('skin')), LN.skin, C('skinS'), 0.25);
      soft(face, () => { g.filter = `blur(${Math.max(1, 2 * o.s)}px)`; g.fillStyle = 'rgba(232,120,120,.35)'; g.beginPath(); g.ellipse(42, -526, 6, 4, 0, 0, TAU); g.fill(); g.filter = 'none'; });
      g.save(); g.strokeStyle = LN.hair; g.lineWidth = Math.max(lw * 0.8, px * 1.1); g.globalAlpha = 0.9;          // 睫毛尖从脸颊轮廓后探出来
      [[45, -540, 51.5, -543.5], [45.5, -538, 51.5, -539], [45.5, -536.5, 50, -535]].forEach(([a, c, d, e]) => { g.beginPath(); g.moveTo(a, c); g.quadraticCurveTo((a + d) / 2, c - 1.5, d, e); g.stroke(); }); g.restore();
    });
    // 头发：发旋起，一簇簇沿后脑包下来、到肩下被风吹向左后；先画暗的底层，再画主簇、发丝、光泽和飞出的细发
    const cap = poly([[42, -566], [37, -560], [32, -548], [28, -530], [14, -514], [-14, -506], [-34, -518], [-42, -546], [-40, -578], [-26, -603], [2, -613], [30, -602], [41, -582]].map(rot));
    const CL = [[-36, -562, 200, 11, 0.0, 9, 0.18], [-28, -588, 236, 13, 0.7, 10, 0.1], [-14, -603, 258, 13, 1.5, 12, 0.05], [2, -607, 270, 12, 2.2, 13, 0.0],
      [14, -598, 246, 11, 2.9, 12, -0.08], [22, -578, 222, 10, 3.6, 11, -0.14], [24, -548, 192, 8, 4.3, 10, -0.12], [-40, -540, 168, 9, 5.0, 8, 0.28], [-8, -594, 232, 10, 5.7, 11, 0.06]];
    const clumps = CL.map(([x, y, len, hw, ph, amp, tr]) => { const sp = flow(...rot([x, y]), len, 16, w, t, ph, amp, tr);
      return { sp, path: ribbon(sp, q => hw * (q < 0.22 ? 0.72 + q * 1.3 : 1) * Math.pow(1 - q, 0.85) + 0.7), hw }; });
    const under = new Path2D(); clumps.forEach(c => under.addPath(c.path, new DOMMatrix().translate(-4, 5)));
    g.save(); g.beginPath(); g.rect(-400, -515, 800, 600); g.clip(); g.fillStyle = mix(GC.hair[0], '#000000', 0.35); g.fill(under); g.restore();
    g.fillStyle = C('hair'); g.fill(cap);
    const hairAll = new Path2D(); hairAll.addPath(cap); clumps.forEach(c => hairAll.addPath(c.path));
    const hg = g.createLinearGradient(0, -610, 0, -360); hg.addColorStop(0, C('hair')); hg.addColorStop(0.45, mix(GC.hair[0], GC.hairHi[1], 0.18 + 0.15 * L)); hg.addColorStop(1, C('hair'));
    clumps.forEach(c => { g.fillStyle = hg; g.fill(c.path); });
    soft(hairAll, () => {
      clumps.forEach((c, k) => [-0.55, 0, 0.5].forEach((u, j) => {                   // 发丝：沿每簇的脊线，三条，明暗交替
        g.globalAlpha = 0.18 + 0.14 * ((k + j) % 2); g.strokeStyle = (k + j) % 2 ? C('hairHi') : mix(GC.hair[0], '#000000', 0.4); g.lineWidth = Math.max(px * 0.9, 0.5);
        g.beginPath(); c.sp.forEach((p, i) => { if (i < 2) return; const a = c.sp[Math.max(0, i - 1)], bb = c.sp[Math.min(c.sp.length - 1, i + 1)], [tx, ty] = unit(a, bb), q = i / (c.sp.length - 1), off = u * c.hw * Math.pow(1 - q, 0.85);
          const x = p[0] - ty * off, y = p[1] + tx * off; i > 2 ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }));
      g.filter = `blur(${Math.max(1, 2.5 * o.s)}px)`; g.globalAlpha = 0.35 + 0.25 * L; g.strokeStyle = C('hairHi'); g.lineWidth = 5;   // 后脑一圈柔光（天使环）
      const hc = rot([2, -566]); g.filter = `blur(${Math.max(2, 5 * o.s)}px)`; g.globalAlpha = 0.22 + 0.2 * L; g.lineWidth = 8; g.beginPath(); g.ellipse(hc[0], hc[1], 34, 30, o.tilt, -2.7, -1.0); g.stroke();
      g.filter = 'none';
    });
    inHead(() => { const ear = poly([[27, -546], [33, -547], [36, -540], [35, -530], [31, -526], [27, -530]]); F(ear, C('skin'), LN.skin, C('skinS'), 0.45);
      g.save(); g.globalAlpha = 0.4; g.strokeStyle = LN.skin; g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(31, -543); g.quadraticCurveTo(34, -538, 31, -531); g.stroke(); g.restore();
      g.fillStyle = C('hair'); g.fill(poly([[25, -560], [31, -552], [30, -544], [27, -536], [24, -544]])); });   // 别在耳后的一缕
    g.save(); g.strokeStyle = C('hair'); g.lineWidth = Math.max(px * 1.0, 0.8);          // 飞出的细发
    [[-14, 180, 0.5, 20], [0, 220, 1.2, 24], [10, 196, 2.0, 22], [-22, 246, 2.7, 26], [18, 168, 3.4, 18], [6, 264, 4.2, 28], [-6, 150, 5.0, 16], [-30, 200, 5.6, 22], [20, 120, 6.3, 14]].forEach(([u, len, ph, amp]) => {
      const sp = flow(...rot([-4 + u, -560]), len, 16, w * 1.15, t * 1.08, ph, amp, -0.05); g.beginPath(); sp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); });
    g.restore();
    if (hold >= 0.5) arm([-42, -468 + b], o.handL, o.bendL, -1, 'all');                // 抬手别头发：前臂和手压在头发上
    g.restore();
  }
  // 把少女画进离屏，算出剪影外缘的轮廓光，再合成（光从右前方来：保留「自身 − 向左下平移的自身」）
  function drawGirl(dst, setup, o, rimCol, rimA, rw) {
    const Lc = P.scratch('wgChar'), lg = Lc.getContext('2d'); lg.reset(); setup(lg); girl(lg, o); lg.setTransform(1, 0, 0, 1, 0, 0);
    const Rc = P.scratch('wgRim'), rg = Rc.getContext('2d'); rg.reset();
    rg.drawImage(Lc, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(Lc, -rw, rw * 0.45);
    rg.globalCompositeOperation = 'source-in'; rg.fillStyle = rimCol; rg.fillRect(0, 0, W, H); rg.globalCompositeOperation = 'source-over';
    dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0); dst.drawImage(Lc, 0, 0);
    P.textureInside(dst, Lc, mg => { mg.globalAlpha = 0.55; mg.drawImage(P.texture('gh_gran', '#f4efe2', { scale: 0.06, amt: 18, grain: 26, seed: 9 }), 0, 0); }, { key: 'wgCharTex' });
    dst.globalAlpha = rimA; dst.drawImage(Rc, 0, 0);
    dst.globalCompositeOperation = 'screen'; dst.filter = `blur(${rw * 1.6}px)`; dst.drawImage(Rc, 0, 0);
    dst.filter = `blur(${rw * 5}px)`; dst.globalAlpha = rimA * 0.7; dst.drawImage(Rc, 0, 0);
    dst.restore();
  }

  // ---------- 世界镜头（A 与 C/D） ----------
  function world(g, t, cam, pose) {
    const p = dayP(t), sv = sunVis(t), blurBg = Math.max(0, (cam.z - 1.15) * 1.8);
    g.save();
    // 天空
    layerT(g, cam, 0.05); g.fillStyle = skyGrad(g, 120, 740, p); g.fillRect(-1500, -1500, 5000, 5000);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55; g.drawImage(blot(), 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const sa = clamp(1 - p / 0.32); if (sa > 0) { g.fillStyle = '#fff8ea'; STARS.forEach(([x, y, r, ph]) => { g.globalAlpha = sa * (0.45 + 0.4 * Math.sin(t * 2.2 + ph)) * (1 - y / 700); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
      g.globalAlpha = clamp(1 - p / 0.5); g.shadowColor = 'rgba(255,240,210,.8)'; g.shadowBlur = 18; g.drawImage(moon(), 320, 250); g.shadowBlur = 0; g.globalAlpha = 1; }
    // 太阳（在远山后面升起）
    layerT(g, cam, 0.1); const sy = sunY(t);
    g.globalCompositeOperation = 'screen';
    [[1100, 0.24 * sm(0.05, 0.5, p), '255,190,140'], [420, 0.42 * sm(0.1, 0.55, p), '255,214,170'], [130, 0.7 * sm(0.3, 0.6, p), '255,236,205']].forEach(([r, a, c]) => { const gr = g.createRadialGradient(SUNX, sy, 0, SUNX, sy, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(SUNX - r, sy - r, 2 * r, 2 * r); });
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fffaf0'; g.shadowColor = 'rgba(255,230,190,1)'; g.shadowBlur = 50; g.beginPath(); g.arc(SUNX, sy, 30, 0, TAU); g.fill(); g.shadowBlur = 0;
    // 云（黎明/晨光两套色调交叉淡化）
    g.filter = blurBg > 0.3 ? `blur(${blurBg * 0.8}px)` : 'none';
    [['high', 0.15, 14], ['low', 0.3, 6]].forEach(([k, f, dr]) => { layerT(g, cam, f); g.translate(-t * dr * 0.3, 0);
      g.globalAlpha = 1 - p; g.drawImage(cloudSet(k + 'D', k, '#3b3f68', '#e6a0a4'), 0, 0); g.globalAlpha = p; g.drawImage(cloudSet(k + 'M', k, '#bccbe2', '#fff2e2'), 0, 0); g.globalAlpha = 1; });
    g.filter = 'none';
    // 鸟群（片尾）
    if (t > 17) { layerT(g, cam, 0.5); g.strokeStyle = 'rgba(40,40,60,.75)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const q = (t - 17 - i * 0.12) / 8, x = 240 + q * 760 + [0, -26, -18, -44, -40, -64][i], y = 585 - q * 90 + [0, -14, 12, -26, 22, -6][i], fl = Math.sin(t * 9 + i * 1.7) * 5, s = 6 + (i % 3);
        g.beginPath(); g.moveTo(x - s, y - fl); g.quadraticCurveTo(x - s * 0.4, y - 2 - fl * 0.3, x, y); g.quadraticCurveTo(x + s * 0.4, y - 2 - fl * 0.3, x + s, y - fl); g.stroke(); } }
    // 远山四层（大气透视；靠近太阳的山脊被逆光烧亮）
    RIDGES.forEach((R, k) => {
      layerT(g, cam, R.f); g.filter = blurBg > 0.3 ? `blur(${blurBg * (1 - k * 0.15)}px)` : 'none';
      const gr = g.createLinearGradient(0, R.top, 0, R.base + 80); gr.addColorStop(0, mix(R.cols[0][0], R.cols[1][0], p)); gr.addColorStop(1, mix(R.cols[0][1], R.cols[1][1], p)); g.fillStyle = gr; g.fill(R.path);
      g.save(); g.clip(R.path); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.35; g.drawImage(blot(), 0, 0);
      const ss = toScreen(cam, 0.1, SUNX, sy), z = 1 + (cam.z - 1) * R.f, cx = lerp(960, cam.cx, R.f), cy = lerp(540, cam.cy, R.f), wx = cx + (ss[0] - 960) / z, wy = cy + (ss[1] - 540) / z;
      g.globalCompositeOperation = 'screen'; g.globalAlpha = R.glow * (0.25 + 0.75 * sv) * sm(0.15, 0.5, p); const rg = g.createRadialGradient(wx, wy, 0, wx, wy, 520); rg.addColorStop(0, 'rgba(255,200,150,.9)'); rg.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = rg; g.fillRect(wx - 520, wy - 520, 1040, 1040);
      g.restore();
      if (R.win) { g.save(); g.globalAlpha = 1 - sm(0.45, 0.75, p); g.fillStyle = '#ffd38a'; g.shadowColor = '#ffb050'; g.shadowBlur = 10; g.fillRect(R.win[0], R.win[1], 4, 4); g.fillRect(R.win[0] + 6, R.win[1], 4, 4); g.restore(); }
      if (k === 1 || k === 2) { layerT(g, cam, k === 1 ? 0.52 : 0.68); g.translate(Math.sin(t * 0.25 + k) * 14, 0); g.globalAlpha = (1 - p) * 0.6; g.drawImage(mistSet('D', '#b5a0be'), 0, 0); g.globalAlpha = p * 0.45; g.drawImage(mistSet('M', '#e4e9f0'), 0, 0); g.globalAlpha = 1; }
    });
    g.filter = 'none';
    // 光：日出那一下烧过山脊的光晕 + 丁达尔光束
    layerT(g, cam, 0.1); g.globalCompositeOperation = 'screen';
    { const r = 320, gr = g.createRadialGradient(SUNX, sy, 0, SUNX, sy, r); gr.addColorStop(0, `rgba(255,236,200,${0.85 * sv})`); gr.addColorStop(0.35, `rgba(255,214,160,${0.35 * sv})`); gr.addColorStop(1, 'rgba(255,214,160,0)'); g.fillStyle = gr; g.fillRect(SUNX - r, sy - r, 2 * r, 2 * r); }
    if (sv > 0) { const r = rng(55); for (let i = 0; i < 18; i++) { const a = -Math.PI + (i + 0.5) / 18 * Math.PI * 1.35 - 0.1 + Math.sin(t * 0.15 + i) * 0.02, wdt = 0.012 + r() * 0.035, Lr = 1300;
      const gr = g.createRadialGradient(SUNX, sy, 0, SUNX, sy, Lr); gr.addColorStop(0, `rgba(255,226,180,${0.09 * sv * (0.5 + r())})`); gr.addColorStop(1, 'rgba(255,226,180,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(SUNX, sy); g.lineTo(SUNX + Math.cos(a - wdt) * Lr, sy + Math.sin(a - wdt) * Lr); g.lineTo(SUNX + Math.cos(a + wdt) * Lr, sy + Math.sin(a + wdt) * Lr); g.closePath(); g.fill(); } }
    g.globalCompositeOperation = 'source-over';
    // 近景山岗 + 草（逆光：草尖勾一道暖边）
    layerT(g, cam, 1);
    const hg = g.createLinearGradient(0, GY - 10, 0, GY + 300); hg.addColorStop(0, mix('#1d2030', '#3e5a3c', p)); hg.addColorStop(1, mix('#111220', '#22361f', p)); g.fillStyle = hg; g.fill(HILL);
    g.save(); g.clip(HILL); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.3; g.drawImage(blot(), 0, 160); g.restore();
    g.save(); g.strokeStyle = `rgba(255,214,170,${0.08 + 0.32 * sm(0.3, 0.7, p)})`; g.lineWidth = 1.4; g.shadowColor = 'rgba(255,190,120,.7)'; g.shadowBlur = 10; g.stroke(CREST); g.restore();
    grass(g, t, p, false);
    // 少女
    drawGirl(g, lg => layerT(lg, cam, 1) && lg.transform(S0, 0, 0, S0, GX, GY), { ...pose, s: S0 * cam.z, sd: 5, lw: 1.2 / (S0 * cam.z) + 0.6 }, mix('#d6a0b8', '#ffd59c', sm(0.25, 0.65, p)), 0.35 + 0.65 * sm(0.25, 0.7, p), 1.6 + 1.6 * S0 * cam.z);
    layerT(g, cam, 1); grass(g, t, p, true);
    // 光里的蒲公英绒毛
    seeds(g, t, p, 1);
    g.restore();
  }
  function grass(g, t, p, front) {
    const w = windAt(t), base = ['#151726', '#1d2132', '#191b2c', '#24283a'].map((c, i) => mix(c, ['#2c4a2c', '#3d5e36', '#36552f', '#4a6b3c'][i], p));
    g.save(); g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { g.strokeStyle = base[k]; g.beginPath();
      for (const bl of BLADES) { if (bl.b !== k || (bl.y > GY + 2 && Math.abs(bl.x - GX) < 70) !== front) continue;
        const wave = Math.sin(t * 2.4 + bl.x * 0.012) * 0.5 + 0.5, sway = -((0.25 + wave * 0.75) * (0.4 + w) * bl.h * 0.55 + Math.sin(t * 7 + bl.ph) * 1.5);
        g.moveTo(bl.x, bl.y); g.quadraticCurveTo(bl.x + sway * 0.3, bl.y - bl.h * 0.6, bl.x + sway, bl.y - bl.h + Math.abs(sway) * 0.2); }
      g.lineWidth = 1.6 + k * 0.25; g.stroke(); }
    const la = sm(0.3, 0.75, p); if (la > 0) { g.strokeStyle = `rgba(255,206,150,${0.75 * la})`; g.lineWidth = 1.1; g.beginPath();
      for (const bl of BLADES) { if (bl.d > 26 || (bl.y > GY + 2 && Math.abs(bl.x - GX) < 70) !== front) continue;
        const wave = Math.sin(t * 2.4 + bl.x * 0.012) * 0.5 + 0.5, sway = -((0.25 + wave * 0.75) * (0.4 + w) * bl.h * 0.55 + Math.sin(t * 7 + bl.ph) * 1.5);
        g.moveTo(bl.x + sway * 0.55, bl.y - bl.h * 0.78); g.quadraticCurveTo(bl.x + sway * 0.8, bl.y - bl.h * 0.92, bl.x + sway, bl.y - bl.h + Math.abs(sway) * 0.2); }
      g.stroke(); }
    if (!front) FLOWERS.forEach(([x, y, s, ph]) => { const sw = -Math.sin(t * 2.4 + x * 0.012) * 3 * (0.4 + w); g.fillStyle = mix('#8a8aa0', '#fffaf0', p, 0.9);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + ph; g.beginPath(); g.ellipse(x + sw + Math.cos(a) * s, y - 10 + Math.sin(a) * s * 0.6, s * 0.75, s * 0.4, a, 0, TAU); g.fill(); }
      g.fillStyle = mix('#8a7a60', '#f2c040', p); g.beginPath(); g.arc(x + sw, y - 10, s * 0.45, 0, TAU); g.fill(); });
    g.restore();
  }
  function seeds(g, t, p, k0) {
    const r = rng(17 + k0), n = 30 + Math.round(50 * sm(13, 15.5, t)), w = windAt(t);
    g.save(); g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 80; i++) { const v = 26 + r() * 50, y0 = 420 + r() * 420, off = r() * 1800, sz = 1.2 + r() * 1.8, ph = r() * TAU; if (i >= n) continue;
      const x = 1700 - ((t * v * (0.6 + w * 0.7) + off) % 1800), y = y0 + Math.sin(t * 1.3 + ph) * 22 - (t * 3) % 40;
      const a = 0.35 + 0.6 * sm(0.3, 0.7, p), gr = g.createRadialGradient(x, y, 0, x, y, sz * 4); gr.addColorStop(0, `rgba(255,246,226,${a})`); gr.addColorStop(0.3, `rgba(255,232,196,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,232,196,0)');
      g.fillStyle = gr; g.fillRect(x - sz * 4, y - sz * 4, sz * 8, sz * 8); }
    g.restore();
  }

  // ---------- 镜头 B：中近景（画面单独构图） ----------
  function shotB(g, t) {
    const q = clamp((t - 6.1) / 7.2), p = dayP(t), w = windAt(t), HZ = 905;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = skyGrad(g, LB, HZ, p); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.drawImage(blot(), -200 + q * 40, 0, W * 1.3, H * 1.3); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const sx = 1240 - q * 30, sy = HZ + 20 - q * 40;
    g.globalCompositeOperation = 'screen'; [[1200, 0.4], [480, 0.55], [160, 0.6]].forEach(([r, a]) => { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(255,212,165,${a * sm(0.1, 0.5, p)})`); gr.addColorStop(1, 'rgba(255,212,165,0)'); g.fillStyle = gr; g.fillRect(sx - r, sy - r, 2 * r, 2 * r); });
    g.globalCompositeOperation = 'source-over';
    g.filter = 'blur(3px)'; g.save(); g.translate(-120 + q * 60, -60); g.scale(1.35, 1.35);
    g.globalAlpha = 1 - p; g.drawImage(cloudSet('highD', 'high', '#3b3f68', '#e6a0a4'), 0, 0); g.globalAlpha = p; g.drawImage(cloudSet('highM', 'high', '#bccbe2', '#fff2e2'), 0, 0); g.restore(); g.globalAlpha = 1;
    // 远山：压低、放大、虚化（景深）
    [[0, 6, 1.5], [1, 5, 1.7], [2, 4, 1.95]].forEach(([k, bl, sc]) => { const R = RIDGES[k]; g.filter = `blur(${bl}px)`; g.save(); g.translate(960 - (q - 0.5) * 50 * (k + 1), HZ); g.scale(sc, sc); g.translate(-1000, -R.base - 4);
      const gr = g.createLinearGradient(0, R.top, 0, R.base + 60); gr.addColorStop(0, mix(R.cols[0][0], R.cols[1][0], p)); gr.addColorStop(1, mix(R.cols[0][1], R.cols[1][1], p)); g.fillStyle = gr; g.fill(R.path); g.restore(); });
    g.filter = 'blur(10px)'; g.globalAlpha = 0.7; g.drawImage(mistSet(p < 0.5 ? 'D' : 'M', p < 0.5 ? '#b5a0be' : '#f4efe8'), 0, HZ - 800, W, 200); g.globalAlpha = 1; g.filter = 'none';
    // 她：腰以上近一点的中近景
    const gx = 820 - q * 46, gy = 1310 + q * 8, s = 1.75 + q * 0.07;
    const hold = sm(9.4, 10.6, t) * (1 - sm(11.9, 12.9, t));
    const pose = { t, w, L: 0.3 + 0.3 * sm(0.2, 0.55, p), br: Math.sin(t * 1.9) * 1.6, tilt: -0.04 - 0.03 * hold,
      hold, handL: [lerp(-58, 20, hold), lerp(-306, -526, hold)], bendL: lerp(1, -1, sm(9.4, 10.2, t) * (1 - sm(12.2, 12.9, t))), handR: [52 + Math.sin(t * 1.3) * 2, -310], bendR: -1, s, sd: 4, lw: 1.5 / s + 0.5 };
    drawGirl(g, lg => lg.setTransform(s, 0, 0, s, gx, gy), pose, mix('#f0b0b8', '#ffd59c', sm(0.25, 0.6, p)), 0.75 + 0.25 * sm(0.2, 0.55, p), 4.2);
    // 前景：失焦的草尖和光斑
    g.save(); g.filter = 'blur(9px)'; g.strokeStyle = mix('#151726', '#2a3a2a', p); g.lineCap = 'round';
    const r = rng(71); for (let i = 0; i < 26; i++) { const x = 1100 + r() * 900 - q * 120, h = 90 + r() * 170, sw = -(20 + 30 * w) * (0.5 + 0.5 * Math.sin(t * 2.2 + i)); g.lineWidth = 6 + r() * 7; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(x, 960); g.quadraticCurveTo(x + sw * 0.3, 960 - h * 0.6, x + sw, 960 - h); g.stroke(); }
    g.restore();
    seeds(g, t, p, 3);
    g.restore();
    return [sx, sy, 0.25];
  }

  // ---------- 文字 ----------
  const fontOf = (fam, size) => `${size}px "${fam}"`;
  function textH(g, t, s, cx, y, o) {
    g.font = fontOf(o.font, o.size); const ws = [...s].map(ch => g.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + o.track * (ws.length - 1);
    let x = o.align === 'left' ? cx : cx - tot / 2; const out = 1 - sm(o.t1 - 0.9, o.t1, t);
    [...s].forEach((ch, i) => { const q = sm(o.t0 + i * (o.stg ?? 0.08), o.t0 + i * (o.stg ?? 0.08) + (o.dur ?? 1.1), t), a = q * out;
      if (a > 0.003) { const bl = (1 - q) * 9 + (1 - out) * 5; g.filter = bl > 0.15 ? `blur(${bl}px)` : 'none'; g.globalAlpha = a * (o.alpha ?? 1); g.fillText(ch, x, y + (1 - q) * 10); }
      x += ws[i] + o.track; });
    g.filter = 'none'; g.globalAlpha = 1; return tot;
  }
  function textV(g, t, s, x, y, o) {
    g.font = fontOf(o.font, o.size); const out = 1 - sm(o.t1 - 0.9, o.t1, t);
    [...s].forEach((ch, i) => { const q = sm(o.t0 + i * 0.11, o.t0 + i * 0.11 + 1.2, t), a = q * out;
      if (a > 0.003) { const bl = (1 - q) * 9 + (1 - out) * 5; g.filter = bl > 0.15 ? `blur(${bl}px)` : 'none'; g.globalAlpha = a; const wd = g.measureText(ch).width; g.fillText(ch, x - wd / 2, y + i * o.size * 1.42 + (1 - q) * 12); } });
    g.filter = 'none'; g.globalAlpha = 1;
  }
  function captions(g, t) {
    g.save(); g.fillStyle = '#fbf7f0'; g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(16,18,40,.45)'; g.shadowBlur = 22;
    if (t < 6.6) { textH(g, t, '致 每一个她', 960, 352, { font: 'SerifSC-500', size: 58, track: 20, t0: 1.5, t1: 6.2, stg: 0.13 });
      textH(g, t, 'for every woman', 960, 410, { font: 'CormorantGaramond-500i', size: 28, track: 5, t0: 2.6, t1: 6.2, stg: 0.03, alpha: 0.9 }); }
    if (t > 6.8 && t < 13) { textV(g, t, '风会来', 1520, 330, { font: 'SerifSC-500', size: 50, t0: 7.3, t1: 12.4 }); textV(g, t, '路也会难', 1430, 330, { font: 'SerifSC-500', size: 50, t0: 8.3, t1: 12.4 }); }
    if (t > 13.4 && t < 18.6) { textV(g, t, '但别怕', 330, 290, { font: 'SerifSC-500', size: 50, t0: 13.8, t1: 18.4 }); textV(g, t, '你本就在发光', 240, 290, { font: 'SerifSC-500', size: 50, t0: 14.8, t1: 18.4 }); }
    if (t > 19) {
      { const a = sm(19, 20.5, t), sg = g.createLinearGradient(0, LB, 0, 560); sg.addColorStop(0, `rgba(14,22,48,${0.42 * a})`); sg.addColorStop(1, 'rgba(14,22,48,0)'); g.save(); g.shadowBlur = 0; g.fillStyle = sg; g.fillRect(0, LB, W, 430); g.restore(); }
      textH(g, t, '她，自有力量', 960, 318, { font: 'SerifSC-500', size: 66, track: 26, t0: 19.3, t1: 99, stg: 0.12 });
      const lq = eio((t - 20.0) / 1.2); if (lq > 0) { g.shadowBlur = 0; g.globalAlpha = 0.6; g.fillRect(960 - 150 * lq, 352, 300 * lq, 1.2); g.globalAlpha = 1; g.shadowBlur = 22; }
      textH(g, t, '致每一个认真生活的你　加油', 960, 396, { font: 'SerifSC-300', size: 27, track: 9, t0: 20.6, t1: 99, stg: 0.05, alpha: 0.92 });
      textH(g, t, 'SHE IS HER OWN STRENGTH', 960, 436, { font: 'Cinzel-400', size: 17, track: 7, t0: 21.4, t1: 99, stg: 0.02, alpha: 0.85 });
    }
    g.restore();
  }

  // ---------- 后期 ----------
  const small = canvas(480, 270);
  function post(g, t, sun) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const sg = small.getContext('2d'); sg.filter = 'blur(5px) brightness(1.15) contrast(1.7)'; sg.drawImage(g.canvas, 0, 0, 480, 270); sg.filter = 'none';
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.3; g.drawImage(small, 0, 0, W, H); g.globalAlpha = 1;
    if (sun && sun[2] > 0.01) { const [sx, sy, a] = sun;
      const lg = g.createLinearGradient(sx - 900, 0, sx + 900, 0); lg.addColorStop(0, 'rgba(255,214,170,0)'); lg.addColorStop(0.5, `rgba(255,228,190,${0.5 * a})`); lg.addColorStop(1, 'rgba(255,214,170,0)');
      g.fillStyle = lg; g.fillRect(sx - 900, sy - 1.5, 1800, 3); g.filter = 'blur(10px)'; g.fillRect(sx - 900, sy - 8, 1800, 16); g.filter = 'none';
      [[0.55, 26, '160,210,230'], [1.25, 44, '255,200,160'], [1.7, 14, '200,230,210']].forEach(([k, r, c]) => { const x = sx + (960 - sx) * k, y = sy + (540 - sy) * k, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${0.1 * a})`); gr.addColorStop(0.8, `rgba(${c},${0.06 * a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); });
      const r = rng(23); for (let i = 0; i < 9; i++) { const bx = (r() * W + Math.sin(t * 0.3 + i) * 30), by = LB + r() * 800, br = 24 + r() * 50, gr = g.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, `rgba(255,214,170,${0.05 * a})`); gr.addColorStop(0.85, `rgba(255,214,170,${0.09 * a})`); gr.addColorStop(1, 'rgba(255,214,170,0)'); g.fillStyle = gr; g.fillRect(bx - br, by - br, 2 * br, 2 * br); } }
    // 调色：亮部暖、暗部偏青 + 暗角
    g.globalCompositeOperation = 'soft-light'; const cg = g.createLinearGradient(0, LB, 0, H - LB); cg.addColorStop(0, 'rgba(90,110,170,.35)'); cg.addColorStop(0.6, 'rgba(255,200,150,.25)'); cg.addColorStop(1, 'rgba(40,60,90,.35)'); g.fillStyle = cg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply'; const vg = g.createRadialGradient(960, 540, 420, 960, 540, 1150); vg.addColorStop(0, 'rgba(255,255,255,1)'); vg.addColorStop(1, 'rgba(70,60,80,1)'); g.globalAlpha = 0.55; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.1; g.drawImage(P.texture('gh_gran', '#f4efe2', { scale: 0.06, amt: 18, grain: 26, seed: 9 }), 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.restore();
  }
  function finish(g, t) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.09; g.drawImage(grainSet()[Math.floor(t * 30) % 3], 0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const fade = Math.max(1 - sm(0, 1.8, t), sm(24, 25, t)); if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = '#000'; g.fillRect(0, 0, W, LB); g.fillRect(0, H - LB, W, LB);
    g.restore();
  }

  // ---------- 镜头编排 ----------
  const camA = t => { const q = eio(t / 7); return { z: 1 + 0.06 * q, cx: 960 - 40 * q, cy: 540 + 18 * q }; };
  const camCD = t => { const a = eio((t - 12.5) / 6), b = eio((t - 18.2) / 6.3); return { z: lerp(lerp(2.16, 2.0, a), 1.0, b), cx: lerp(lerp(842, 860, a), 960, b), cy: lerp(648, 540, b) }; };
  const poseA = t => ({ t, w: windAt(t), L: 0.1, br: Math.sin(t * 1.9) * 1.6, tilt: 0, handL: [-58, -306], bendL: 1, handR: [52, -310], bendR: -1 });
  const poseCD = t => { const op = sm(14.2, 15.8, t) * (1 - sm(20.6, 22.8, t)), sway = Math.sin(t * 1.6) * 6 * op;
    return { t, w: windAt(t), L: sm(0.2, 0.7, dayP(t)), br: Math.sin(t * 1.9) * 1.6 + op * 2, tilt: -0.13 * op,
      handL: [lerp(-58, -205, op), lerp(-306, -555, op) + sway], bendL: lerp(1, -1, op), handR: [lerp(52, 214, op), lerp(-310, -566, op) - sway], bendR: lerp(-1, 1, op) }; };
  const SHOTS = [
    { t0: 0, t1: 6.9, render: (g, t) => { const cam = camA(t); world(g, t, cam, poseA(t)); return null; } },
    { t0: 6.1, t1: 13.3, render: (g, t) => shotB(g, t) },
    { t0: 12.5, t1: 99, render: (g, t) => { const cam = camCD(t); world(g, t, cam, poseCD(t)); const s = toScreen(cam, 0.1, SUNX, sunY(t)); return [s[0], s[1], sunVis(t)]; } },
  ];
  function draw(c, lt) {
    const t = lt, act = SHOTS.filter(s => t >= s.t0 && t < s.t1);
    const A = P.scratch('wgA'), ag = A.getContext('2d'); ag.reset();
    let sun = act[0].render(ag, t);
    if (act.length > 1) { const B = P.scratch('wgB'), bg = B.getContext('2d'); bg.reset(); const s2 = act[1].render(bg, t), q = eio((t - act[1].t0) / (act[0].t1 - act[1].t0));
      ag.save(); ag.setTransform(1, 0, 0, 1, 0, 0); ag.globalAlpha = q; ag.drawImage(B, 0, 0); ag.restore(); if (q > 0.5) sun = s2; }
    post(ag, t, sun); captions(ag, t); finish(ag, t);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(A, 0, 0); c.restore();
  }

  window.PUNCH = 0;
  window.ERAS = [{ id: 'film', dur: DUR, draw: (c, lt) => draw(c, lt),
    init: () => { U.assertGlyphs('SerifSC-500', '致 每一个她风会来路也会难但别怕你本就在发光她，自有力量', 'film'); U.assertGlyphs('SerifSC-300', '致每一个认真生活的你　加油', 'film'); } }];
})();
