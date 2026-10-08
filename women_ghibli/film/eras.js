// 「致每一个她」· 吉卜力式夏日山坡（20s，纯代码）
// 风格起点：references/风格配方/25_ghibli.md（水彩洗染 wash + 赛璐璐两色 cel + 角色剪影内 multiply 纸纹）。
// 画面：积雨云下的山坡，少女迎风站着，长发、红裙、草帽飘带被风吹向身后；草浪一阵阵从右往左扫过，花瓣乘风飞。
// 动作：0–5 站立远望 → 5–10 手按草帽顶风 → 10–15 张开双臂迎风（闭眼笑）→ 15–20 举拳「加油」。
// 预览 index.html?film=demos/women_ghibli   渲染 render.py --film demos/women_ghibli --fps 30 --out 成片.mp4
(() => {
  const W = 1920, H = 1080, { clamp, lerp, rng } = U, P = PAINT, TAU = Math.PI * 2;
  const wash = P.watercolor, rect = P.rectPts, ell = P.ellipsePts;
  const LINE = '#5a3e30';
  const GX = 820, GY = 872;                                         // 少女脚底（山顶）
  const hillY = x => GY + Math.pow((x - GX) / 900, 2) * 150;        // 前景山坡顶线
  const sm = (a, b, x) => { const q = clamp((x - a) / (b - a)); return q * q * (3 - 2 * q); };
  const poly = pts => RIG.smooth(pts, true);
  const cel = (c, p, base, shade, dx = 8, dy = 5, lw = 2.4) => P.cel(c, p, base, shade, null, { sd: 1, lx: -dx, ly: -dy, line: LINE, lw });

  // 风：底风 + 两个慢周期 + 10–15s 一阵大风
  const windAt = t => 0.55 + 0.18 * Math.sin(t * 1.3) + 0.12 * Math.sin(t * 3.7 + 1) + 0.35 * (sm(9.8, 11, t) - sm(14.5, 16, t));

  // 相机：慢慢推近少女，远景视差小
  const Z = t => 1 + 0.17 * (1 - Math.cos(Math.PI * clamp(t / 20))) / 2;
  const cam = (c, t, f) => { const z = 1 + (Z(t) - 1) * f, fx = GX, fy = 600; c.translate(fx, fy); c.scale(z, z); c.translate(-fx, -fy); };

  // ---------- 缓存层 ----------
  const sky = () => P.cached('wg_sky', W, H, g => {
    const gr = g.createLinearGradient(0, 0, 0, 760); gr.addColorStop(0, '#2c74c8'); gr.addColorStop(0.55, '#6fb0e4'); gr.addColorStop(1, '#d6eef6');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = rng(12);
    for (let i = 0; i < 18; i++) wash(g, ell(r() * W, r() * 600, 160 + r() * 260, 60 + r() * 120, 10), ['#a8d0f0', '#5a96d8', '#cfe6f4'][i % 3], { layers: 3, alpha: 0.06, amp: 40, seed: 30 + i, edge: 0 });
  });
  const cloud = (key, w, h, seed, tower) => P.cached('wg_cloud_' + key, w, h, g => {
    const r = rng(seed), puffs = [];
    const rows = tower ? 6 : 3;
    for (let j = 0; j < rows; j++) {
      const yy = h * (0.84 - j * (tower ? 0.13 : 0.2)), span = w * (0.42 - j * (tower ? 0.05 : 0.1)), n = 7 - j;
      for (let k = 0; k < n; k++) puffs.push([w / 2 + (r() - 0.5) * 2 * span + (tower ? j * 10 : 0), yy + (r() - 0.5) * 30, (tower ? 70 : 42) + r() * (tower ? 60 : 30) - j * 4]);
    }
    puffs.forEach(([x, y, rr], i) => wash(g, ell(x, y, rr, rr * 0.86, 16), '#ffffff', { layers: 3, alpha: 0.92, amp: 6, seed: seed + i, edge: 0, blend: 'source-over' }));
    g.save(); g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, h * 0.3, 0, h); sh.addColorStop(0, 'rgba(150,175,210,0)'); sh.addColorStop(1, 'rgba(110,135,185,.7)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    const hl = g.createRadialGradient(w * 0.7, h * 0.15, 10, w * 0.7, h * 0.15, w * 0.6); hl.addColorStop(0, 'rgba(255,248,225,.55)'); hl.addColorStop(1, 'rgba(255,248,225,0)'); g.fillStyle = hl; g.fillRect(0, 0, w, h);
    g.restore();
  });
  const far = () => P.cached('wg_far', W, H, g => {
    wash(g, [[-40, 720], [180, 660], [380, 690], [620, 640], [900, 680], [1180, 630], [1460, 670], [1700, 640], [1960, 680], [1960, 800], [-40, 800]], '#86aec4', { layers: 5, alpha: 0.4, amp: 8, seed: 41, edge: 0.1 });
    wash(g, [[-40, 740], [300, 712], [700, 730], [1100, 706], [1500, 728], [1960, 712], [1960, 820], [-40, 820]], '#7ea89a', { layers: 5, alpha: 0.45, amp: 6, seed: 42, edge: 0.1 });
  });
  const tree = () => P.cached('wg_tree', 300, 360, g => {
    g.fillStyle = '#4a3a2a'; g.fillRect(140, 210, 20, 150);
    const r = rng(77);
    for (let i = 0; i < 22; i++) { const x = 150 + (r() - .5) * 220, y = 150 + (r() - .5) * 170, rr = 34 + r() * 40;
      wash(g, ell(x, y, rr, rr * 0.8, 12), i % 3 ? '#3f7a3a' : '#2a5a32', { layers: 3, alpha: 0.6, amp: 10, seed: i + 5, edge: 0.15, blend: 'source-over' }); }
    for (let i = 0; i < 14; i++) { const x = 170 + (r() - .5) * 180, y = 110 + (r() - .5) * 120, rr = 18 + r() * 22;
      wash(g, ell(x, y, rr, rr * 0.7, 10), '#8cc65a', { layers: 2, alpha: 0.45, amp: 6, seed: i + 50, edge: 0, blend: 'source-over' }); }
  });
  const mid = () => P.cached('wg_mid', W, H, g => {
    const g0 = g.createLinearGradient(0, 760, 0, 1000); g0.addColorStop(0, '#9cc872'); g0.addColorStop(1, '#5e9a48');
    wash(g, [[-40, 790], [260, 772], [560, 786], [900, 770], [1200, 790], [1200, 1100], [-40, 1100]], '#7ab45a', { layers: 5, alpha: 0.6, amp: 8, seed: 50, edge: 0.1, blend: 'source-over', fill: g0 });
    for (let i = 0; i < 5; i++) wash(g, [[-40, 810 + i * 34], [1200, 806 + i * 30], [1200, 816 + i * 30], [-40, 820 + i * 34]], ['#b8d878', '#5e9a46'][i % 2], { layers: 2, alpha: 0.3, amp: 4, seed: 55 + i, edge: 0 });
    const g1 = g.createLinearGradient(0, 740, 0, 1080); g1.addColorStop(0, '#8cc062'); g1.addColorStop(1, '#4f8a40');
    wash(g, [[900, 860], [1150, 772], [1400, 752], [1650, 770], [1960, 760], [1960, 1100], [900, 1100]], '#6aa64c', { layers: 5, alpha: 0.6, amp: 8, seed: 51, edge: 0.1, blend: 'source-over', fill: g1 });
    // 田埂（浅色条纹）
    const r = rng(52);
    for (let i = 0; i < 6; i++) wash(g, [[1100 + i * 60, 820 + i * 40], [1960, 800 + i * 44], [1960, 812 + i * 44], [1100 + i * 60, 832 + i * 40]], ['#b8d878', '#5e9a46'][i % 2], { layers: 2, alpha: 0.35, amp: 4, seed: 60 + i, edge: 0 });
    // 红顶小屋
    wash(g, rect(1452, 760, 64, 40), '#fbf3e2', { layers: 3, alpha: 0.95, amp: 2, seed: 70, edge: 0.2, blend: 'source-over' });
    wash(g, [[1440, 764], [1484, 734], [1528, 764]], '#c8443a', { layers: 3, alpha: 0.9, amp: 2, seed: 71, edge: 0.2, blend: 'source-over' });
    g.fillStyle = '#6a8aa8'; g.fillRect(1466, 774, 12, 12); g.fillRect(1492, 774, 12, 12);
    void r;
  });
  const hill = () => P.cached('wg_hill', W + 400, H + 200, g => {
    const pts = []; for (let x = -200; x <= W + 200; x += 60) pts.push([x + 200, hillY(x)]); pts.push([W + 400, H + 200], [0, H + 200]);
    const gr = g.createLinearGradient(0, 860, 0, 1180); gr.addColorStop(0, '#a2d062'); gr.addColorStop(0.5, '#6aa848'); gr.addColorStop(1, '#3e7a34');
    wash(g, pts, '#6aa848', { layers: 6, alpha: 0.6, amp: 5, seed: 81, edge: 0.12, blend: 'source-over', fill: gr });
    const r = rng(82);
    for (let i = 0; i < 26; i++) wash(g, ell(r() * (W + 400), 920 + r() * 240, 60 + r() * 140, 16 + r() * 30, 10), i % 2 ? '#c4e080' : '#3a7030', { layers: 2, alpha: 0.12, amp: 12, seed: 90 + i, edge: 0 });
  });
  const bloom = () => P.cached('wg_bloom', W, H, g => { const r = rng(808); for (let i = 0; i < 40; i++) { const x = 560 + r() * 520, y = 200 + r() * 720; wash(g, ell(x, y, 24 + r() * 50, 20 + r() * 40, 9), ['#e8b890', '#a8c0d8', '#f0d0a0', '#c8a8c0'][i % 4], { layers: 2, alpha: 0.1, amp: 14, seed: 900 + i, edge: 0.08 }); } });

  // ---------- 草叶（前后两组：脚后的先画，脚前的压在人身上） ----------
  const BLADES = (() => { const r = rng(5), out = [], cols = ['#5c9a3e', '#7fb84a', '#3f7a32', '#9ccc5a', '#4a8a3a', '#b4d86a'];
    for (let i = 0; i < 1500; i++) { const x = -150 + r() * (W + 300), d = Math.pow(r(), 1.6) * 260, y = hillY(x) + d;
      out.push({ x, y, h: 14 + r() * 22 + d * 0.22, ph: r() * TAU, col: cols[(r() * 6) | 0], lw: 1.6 + r() * 2 + d * 0.012 }); }
    return out.sort((a, b) => a.y - b.y); })();
  function grass(c, t, front) {
    c.save(); c.lineCap = 'round';
    for (const b of BLADES) {
      const isFront = b.y > GY + 4 && Math.abs(b.x - GX) < 160 || b.y > GY + 60;
      if (isFront !== front) continue;
      const wave = Math.sin(t * 2.6 + b.x * 0.011) * 0.5 + 0.5, wind = windAt(t);
      const sway = -((0.2 + wave * 0.8) * (0.5 + wind) * b.h * 0.55 + Math.sin(t * 8 + b.ph) * 2);
      c.strokeStyle = b.col; c.lineWidth = b.lw;
      c.beginPath(); c.moveTo(b.x, b.y); c.quadraticCurveTo(b.x + sway * 0.3, b.y - b.h * 0.6, b.x + sway, b.y - b.h + Math.abs(sway) * 0.2); c.stroke();
    }
    // 草里的小白花
    if (!front) { const r = rng(6); for (let i = 0; i < 60; i++) { const x = -100 + r() * (W + 200), y = hillY(x) + 6 + Math.pow(r(), 1.5) * 220, s = 3 + (y - GY) * 0.02, sw = -Math.sin(t * 2.6 + x * 0.011) * 4;
      c.fillStyle = i % 4 ? '#fffdf4' : '#f8d040'; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; c.beginPath(); c.arc(x + sw + Math.cos(a) * s, y - 12 + Math.sin(a) * s * 0.7, s * 0.7, 0, TAU); c.fill(); }
      c.fillStyle = '#f2b830'; c.beginPath(); c.arc(x + sw, y - 12, s * 0.5, 0, TAU); c.fill(); } }
    c.restore();
  }

  // ---------- 少女（侧身朝右，脚底为原点） ----------
  const C = { skin: '#fde4cf', skinS: '#efbca0', hair: '#4a3226', hairS: '#2e1e18', blouse: '#fffaf0', blouseS: '#d6dce8',
    skirt: '#cf4a3c', skirtS: '#9c2f28', hat: '#f2d68e', hatS: '#c9a456', ribbon: '#d93a30', ribbonS: '#a0261f', shoe: '#6a3a24', sock: '#fffaf2' };
  const ik = (S, T, a, b, bend) => {
    const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.min(Math.hypot(dx, dy), a + b - 0.01), ang = Math.atan2(dy, dx);
    const k = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), e = ang + bend * k;
    const E = [S[0] + Math.cos(e) * a, S[1] + Math.sin(e) * a], Hh = [S[0] + Math.cos(ang) * d, S[1] + Math.sin(ang) * d];
    return [E, Hh];
  };
  const seg = (c, pts, w, col) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = LINE; c.lineWidth = w + 4.6; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  const pick = (lt, keys) => { let p = keys[0][1]; for (let i = 1; i < keys.length; i++) { const [t0, v, d] = keys[i]; const q = sm(t0, t0 + d, lt); p = [lerp(p[0], v[0], q), lerp(p[1], v[1], q)]; } return p; };
  function arm(c, S, hand, bend, fist, t, ph) {
    const sway = [Math.sin(t * 4 + ph) * 3, Math.cos(t * 3.3 + ph) * 3];
    const [E, Hd] = ik(S, [hand[0] + sway[0], hand[1] + sway[1]], 84, 82, bend);
    seg(c, [S, E, Hd], 17, C.skin);
    const sl = [lerp(S[0], E[0], 0.62), lerp(S[1], E[1], 0.62)];
    seg(c, [S, sl], 27, C.blouse);
    c.fillStyle = C.skin; c.strokeStyle = LINE; c.lineWidth = 2.4; c.beginPath(); c.arc(Hd[0], Hd[1], fist ? 13 : 11, 0, TAU); c.fill(); c.stroke();
    return Hd;
  }
  function girl(c, lt, t) {
    const w = windAt(t);
    const open = sm(10.2, 11.2, lt) * (1 - sm(15.0, 15.8, lt));
    const tilt = -0.16 * open + -0.06 * sm(15.4, 16.2, lt);
    const breathe = Math.sin(lt * 2.2) * 1.5;
    c.save(); c.translate(GX, GY);
    const head = (fn) => { c.save(); c.translate(4, -462); c.rotate(tilt); c.translate(-4, 462); fn(); c.restore(); };

    // 1 身后的长发（被风吹向左后）
    head(() => {
      for (let L = 0; L < 3; L++) {
        const top = [], bot = [], n = 7, len = (34 + L * 6) * (0.65 + 0.6 * w);
        for (let k = 0; k <= n; k++) {
          const wv = Math.sin(t * 5.2 - k * 0.85 + L * 1.3) * k * (3 + L);
          top.push([-26 - k * len * 0.95, -536 + L * 12 + k * (6 + L * 3) + wv]);
          bot.push([-8 - k * len * 0.85, -474 + L * 4 + k * (3 + L * 2) + wv + 4]);
        }
        cel(c, poly(top.concat(bot.reverse())), C.hair, C.hairS, 6, 4, 2.2);
      }
    });
    // 2 远侧手臂（在身体后面）
    const farHand = pick(lt, [[0, [-24, -306]], [10.2, [-178, -520], 1.0], [15.0, [-30, -318], 0.9]]);
    arm(c, [-8, -444 + breathe], farHand, 1, false, t, 2);
    // 3 腿和鞋
    seg(c, [[-6, -150], [-8, -18]], 15, C.skin); seg(c, [[12, -150], [16, -16]], 15, C.skin);
    seg(c, [[-8, -40], [-8, -16]], 16, C.sock); seg(c, [[16, -38], [16, -14]], 16, C.sock);
    cel(c, poly(ell(-2, -8, 20, 9, 12)), C.shoe, '#4a2414', 3, 2); cel(c, poly(ell(24, -6, 21, 9, 12)), C.shoe, '#4a2414', 3, 2);
    // 4 红长裙：后摆被风吹开，前摆贴腿
    { const back = [], hem = [], N = 9, push = 40 + 80 * w;
      for (let i = 0; i <= 6; i++) { const q = i / 6; back.push([-20 - q * q * push - q * 18 + Math.sin(t * 6 + q * 4) * q * 6, -362 + q * 236]); }
      for (let i = 1; i <= N; i++) { const q = i / N, bx = -38 - push - 0, fx = 54 - 22 * w;
        hem.push([lerp(bx, fx, q), -124 + Math.sin(t * 7 + q * 9) * 7 * (1 - q * 0.5) + q * 6]); }
      const front = [[46 - 20 * w, -200], [30, -290], [22, -362]];
      const sk = poly(back.concat(hem, front));
      cel(c, sk, C.skirt, C.skirtS, 12, 6);
      c.save(); c.clip(sk); c.strokeStyle = C.skirtS; c.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const q = (k + 1) / 5; c.beginPath(); c.moveTo(lerp(-18, 20, q), -350); c.quadraticCurveTo(lerp(-40 - push * 0.4, 30, q), -250, lerp(-38 - push, 54 - 22 * w, q) + Math.sin(t * 7 + q * 9) * 5, -130); c.stroke(); }
      c.restore(); }
    // 5 上身白衬衫＋领口红结
    const tor = poly([[-26, -446 + breathe], [-4, -456 + breathe], [16, -454 + breathe], [30, -440 + breathe], [32, -408], [26, -380], [22, -360], [-20, -360], [-27, -392], [-31, -428]]);
    cel(c, tor, C.blouse, C.blouseS, 10, 5);
    c.fillStyle = C.ribbon; c.beginPath(); c.ellipse(22, -446 + breathe, 7, 5, 0.3, 0, TAU); c.fill();
    c.strokeStyle = C.skirtS; c.lineWidth = 7; c.beginPath(); c.moveTo(-21, -362); c.lineTo(23, -362); c.stroke();     // 腰带
    // 6 脖子、头、头发、草帽
    seg(c, [[4, -474], [6, -448]], 16, C.skin);
    const closed = open > 0.5 || (lt > 3.05 && lt < 3.17) || (lt > 7.6 && lt < 7.72) || (lt > 18.3 && lt < 18.42);
    head(() => {
      const face = poly([[-30, -505], [-20, -538], [8, -552], [40, -532], [48, -514], [56, -500], [50, -493], [52, -486], [45, -472], [22, -462], [-12, -468]]);
      cel(c, face, C.skin, C.skinS, 8, 3);
      c.save(); c.clip(face); c.fillStyle = 'rgba(240,130,120,.38)'; c.beginPath(); c.ellipse(30, -492, 11, 6, 0, 0, TAU); c.fill(); c.restore();
      // 头发盖：头顶＋后脑，前刘海
      const cap = poly([[-36, -500], [-32, -538], [-2, -558], [30, -552], [50, -530], [42, -518], [30, -526], [18, -516], [8, -520], [2, -506], [-2, -488], [-14, -470], [-30, -478]]);
      cel(c, cap, C.hair, C.hairS, 6, 5);
      c.strokeStyle = '#7a5a46'; c.lineWidth = 2; [[-20, -540, 6, -548], [-24, -520, 0, -536]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + d) / 2, b - 10, d, e); c.stroke(); });
      // 眼睛
      if (closed) { c.strokeStyle = LINE; c.lineWidth = 3; c.beginPath(); c.arc(34, -512, 7, 0.25, Math.PI - 0.6); c.stroke(); }
      else { const up = -2 * sm(15.4, 16.2, lt); c.fillStyle = '#2a1c18'; c.beginPath(); c.ellipse(35, -510 + up, 4.6, 7.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#6a4a3a'; c.beginPath(); c.ellipse(36, -507 + up, 3, 3.6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(34, -513 + up, 1.8, 0, TAU); c.fill();
        c.strokeStyle = LINE; c.lineWidth = 2.6; c.beginPath(); c.moveTo(28, -518); c.quadraticCurveTo(35, -522, 42, -517); c.stroke(); }
      c.strokeStyle = '#4a3226'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(29, -528); c.quadraticCurveTo(36, -532, 43, -528); c.stroke();
      // 嘴：张臂和举拳时笑开
      const smile = Math.max(open, sm(15.4, 16, lt));
      c.strokeStyle = '#a8443a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(43, -481); c.quadraticCurveTo(46, -478 + smile * 3, 50, -482 - smile * 2); c.stroke();
      // 草帽：帽檐随风扑动，红缎带飘向身后
      const flap = Math.sin(t * 6.3) * 0.04 * (0.5 + w);
      c.save(); c.translate(8, -548); c.rotate(-0.14 + flap);
      const tails = [[-34, 0], [-70 - 40 * w, 14 + Math.sin(t * 7) * 8], [-110 - 70 * w, 30 + Math.sin(t * 7 - 1) * 14], [-96 - 60 * w, 40 + Math.sin(t * 7 - 1.4) * 12], [-60 - 30 * w, 20 + Math.sin(t * 7 - .5) * 8], [-32, 10]];
      cel(c, poly(tails), C.ribbon, C.ribbonS, 3, 3, 2);
      const crown = new Path2D(); crown.ellipse(0, -8, 38, 28, 0, Math.PI, TAU); crown.closePath();
      const brim = poly(ell(0, 0, 76, 15, 20));
      cel(c, brim, C.hat, C.hatS, 6, 6); cel(c, crown, C.hat, C.hatS, 8, 6);
      c.fillStyle = C.ribbon; c.fillRect(-38, -12, 76, 10); c.strokeStyle = LINE; c.lineWidth = 2; c.strokeRect(-38, -12, 76, 10);
      c.restore();
    });
    // 7 近侧手臂：垂手 → 按住帽檐 → 张开 → 举拳加油
    const nearHand = pick(lt, [[0, [18, -300]], [5.0, [44, -560], 0.9], [10.2, [172, -522], 1.0], [15.2, [170, -600], 0.6]]);
    arm(c, [12, -444 + breathe], nearHand, -1, lt > 15.2, t, 0);
    c.restore();
  }

  // ---------- 花瓣（风大时更多） ----------
  function petals(c, t) {
    const r = rng(17), n = Math.round(36 + 50 * sm(9.8, 11, t) * (1 - sm(15, 17, t)) + 14);
    for (let i = 0; i < 100; i++) {
      const v = 140 + r() * 200, y0 = 160 + r() * 820, off = r() * 2600, sz = 5 + r() * 6, ph = r() * TAU, col = ['#fffdf4', '#f8c8d0', '#ffe9a8', '#ffffff'][i % 4];
      if (i >= n) continue;
      const x = W + 200 - ((t * v * (0.6 + windAt(t) * 0.6) + off) % 2600), y = y0 + Math.sin(t * 1.8 + ph) * 40 + Math.sin(t * 5 + ph) * 6;
      c.save(); c.translate(x, y); c.rotate(t * 4 + ph); c.scale(1, Math.abs(Math.sin(t * 3 + ph)) * 0.8 + 0.2);
      c.fillStyle = col; c.globalAlpha = 0.92; c.beginPath(); c.ellipse(0, 0, sz, sz * 0.55, 0, 0, TAU); c.fill(); c.restore();
    }
  }

  // ---------- 手写字幕（霞鹜文楷，逐字浮现） ----------
  const LINES = [
    { t0: 0.8, t1: 4.7, text: '致每一个她', size: 104, y: 190 },
    { t0: 5.4, t1: 9.7, text: '风再大，也要向前走', size: 84, y: 190 },
    { t0: 10.6, t1: 14.8, text: '你本来就很好', size: 100, y: 180, sub: '值得被这个世界温柔以待', subSize: 50 },
    { t0: 15.6, t1: 21, text: '她力量，加油！', size: 112, y: 185, sub: '致敬每一个认真生活的你', subSize: 50 },
  ];
  function caption(c, lt) {
    for (const L of LINES) {
      if (lt < L.t0 - 0.1 || lt > L.t1 + 0.1) continue;
      const out = 1 - sm(L.t1 - 0.5, L.t1, lt);
      const draw = (s, size, y, t0) => {
        c.font = `${size}px "LXGWWenKai-500"`; let x = 120;
        [...s].forEach((ch, i) => { const q = sm(t0 + i * 0.07, t0 + i * 0.07 + 0.45, lt); if (q <= 0) { x += c.measureText(ch).width; return; }
          c.globalAlpha = q * out; c.fillText(ch, x, y + (1 - q) * 14); x += c.measureText(ch).width; });
      };
      c.save(); c.fillStyle = '#fffdf5'; c.shadowColor = 'rgba(24,52,100,.55)'; c.shadowBlur = 16; c.shadowOffsetY = 3;
      draw(L.text, L.size, L.y, L.t0);
      if (L.sub) draw(L.sub, L.subSize, L.y + L.size * 0.85, L.t0 + 0.6);
      c.restore();
    }
  }

  function draw(c, lt, t) {
    // 天空、太阳光晕、云
    c.save(); cam(c, t, 0.25); c.drawImage(sky(), 0, 0);
    c.save(); c.globalCompositeOperation = 'screen'; const sg = c.createRadialGradient(1680, 90, 20, 1680, 90, 700); sg.addColorStop(0, `rgba(255,246,214,${0.55 + 0.25 * sm(10, 12, lt)})`); sg.addColorStop(1, 'rgba(255,246,214,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, H); c.restore();
    c.drawImage(cloud('big', 820, 620, 11, true), 1080 - t * 6, 140);
    c.drawImage(cloud('s1', 420, 200, 23, false), 300 - t * 14, 470);
    c.drawImage(cloud('s2', 300, 150, 31, false), 760 - t * 18, 520);
    c.drawImage(cloud('s3', 360, 170, 37, false), 1900 - t * 16, 420);
    c.restore();
    c.save(); cam(c, t, 0.45); c.drawImage(far(), 0, 0); c.restore();
    c.save(); cam(c, t, 0.7); c.drawImage(mid(), 0, 0);
    c.save(); c.translate(1660, 790); c.rotate(Math.sin(t * 2.1) * 0.02 * (0.5 + windAt(t))); c.drawImage(tree(), -150, -360 * 0.6, 300 * 0.6, 360 * 0.6); c.restore();
    c.restore();
    // 前景山坡＋脚后的草
    c.save(); cam(c, t, 1); c.drawImage(hill(), -200, 0); grass(c, t, false);
    // 地上的人影（往左后方躺）
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(60,110,60,.35)'; c.filter = 'blur(6px)'; c.beginPath(); c.ellipse(GX - 50, GY + 4, 80, 10, 0, 0, TAU); c.fill(); c.restore();
    c.restore();
    // 少女：先画进离屏，再按剪影 multiply 纸纹＋透明色晕（赛璐璐 → 水彩填色）
    const Lc = P.scratch('wgGirl'), lg = Lc.getContext('2d'); lg.reset(); lg.clearRect(0, 0, W, H);
    lg.save(); cam(lg, t, 1); girl(lg, lt, t); lg.restore();
    c.drawImage(Lc, 0, 0);
    P.textureInside(c, Lc, mg => { mg.globalAlpha = 0.8; mg.drawImage(P.texture('gh_gran', '#f4efe2', { scale: 0.06, amt: 18, grain: 26, seed: 9 }), 0, 0); mg.globalAlpha = 1; mg.drawImage(bloom(), 0, 0); }, { key: 'wgGirlTex' });
    // 前景草、花瓣
    c.save(); cam(c, t, 1); grass(c, t, true); c.restore();
    petals(c, t);
    // 整体：暖色柔光＋纸纹
    c.save(); c.globalCompositeOperation = 'screen'; const lg2 = c.createLinearGradient(W, 0, 0, H); lg2.addColorStop(0, 'rgba(255,236,190,.22)'); lg2.addColorStop(0.6, 'rgba(255,236,190,0)'); c.fillStyle = lg2; c.fillRect(0, 0, W, H); c.restore();
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.18; c.drawImage(P.texture('gh_gran', '#f4efe2', { scale: 0.06, amt: 18, grain: 26, seed: 9 }), 0, 0); c.restore();
    caption(c, lt);
    // 收尾：最后 0.8s 淡到暖白
    const fo = sm(19.2, 20, lt); if (fo > 0) { c.save(); c.fillStyle = `rgba(255,250,238,${fo * 0.85})`; c.fillRect(0, 0, W, H); c.restore(); }
  }

  window.PUNCH = 0;
  window.ERAS = [{ id: 'film', dur: 20, draw: (c, lt, t) => draw(c, lt, t) }];
})();
