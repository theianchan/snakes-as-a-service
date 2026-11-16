/* ===== rendering: isometric room, sprites, particles ===== */
const $ = id => document.getElementById(id);
const TW = 64, TH = 32, EH = 16, WALL = 150, CREW = '#ffb347', FOE = '#6fe3a1', OUT = '#1b1320';
const cv = $('cv'); let ctx = cv.getContext('2d');
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
};
const cam = { x: 0, y: 0, z: 1, w: 0, h: 0, dpr: 1, fitted: false, shake: 0, flash: 0 };
const V = { mode: 'intro', active: null, busy: false, reach: null, range: null, rangeHot: null, target: null, preview: null, ability: null,
  inspect: null, threat: null, faceDir: 0, origin: null, cracked: false, shelf: [], shelfN: 0, hint: '', turnDone: null, started: false };
const FX = { parts: [], floats: [], shots: [], rings: [], caps: [] };
const tweens = [];
let T = 0, now = 0, lastNow = 0, freezeUntil = 0;
const tween = (ms, fn) => new Promise(res => { if (G.fast || ms <= 0) { fn(1); res(); } else tweens.push({ t0: T, ms, fn, res }); });
const wait = ms => tween(ms, () => {});
const lerp = (a, b, k) => a + (b - a) * k, easeOut = k => 1 - (1 - k) * (1 - k) * (1 - k), rnd = (a, b) => a + Math.random() * (b - a);
const world = (px, py, pz) => [(px - py) * TW / 2, (px + py) * TH / 2 - pz];
const tileTop = (x, y) => world(x, y, hAt(x, y) * EH);
const kindAt = (x, y) => KINDS[y][x];
function shadeHex(hex, f) { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, (n >> 16) * f) | 0},${Math.min(255, ((n >> 8) & 255) * f) | 0},${Math.min(255, (n & 255) * f) | 0})`; }
function initDisplay(u) { Object.assign(u, { px: u.x, py: u.y, pz: hAt(u.x, u.y) * EH, hop: 0, shp: u.hp, dSoaked: u.soaked > 0, dStun: u.stunned, dCharge: u.charging != null, alpha: 1, flash: 0, scale: 1, rot: 0, shakeX: 0, gone: u.dead }); }
function syncDisplay() { for (const u of G.units) { u.px = u.x; u.py = u.y; u.pz = hAt(u.x, u.y) * EH; u.hop = 0; u.shp = u.hp; u.dSoaked = u.soaked > 0; u.dStun = u.stunned; u.dCharge = u.charging != null; u.shakeX = 0; if (u.dead) u.gone = true; } }

/* --- effects --- */
function part(o) { FX.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 500, size: 3, color: '#fff', add: false, t0: T, grow: 0 }, o)); }
function sparks(x, y, color, n = 8) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(40, 150); part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 40, g: 260, life: rnd(220, 420), size: rnd(1.5, 3), color }); } }
function flames(x, y, n = 10, spread = 12) { for (let i = 0; i < n; i++) part({ x: x + rnd(-spread, spread), y: y + rnd(-4, 4), vx: rnd(-12, 12), vy: rnd(-90, -40), life: rnd(350, 750), size: rnd(4, 8), grow: -6, color: ['#ffd36b', '#ff8a3c', '#ff5a2a'][i % 3], add: true }); }
function drops(x, y, n = 8, color = '#7fd0ff') { for (let i = 0; i < n; i++) part({ x: x + rnd(-6, 6), y: y + rnd(-6, 2), vx: rnd(-60, 60), vy: rnd(-130, -40), g: 420, life: rnd(350, 600), size: rnd(1.6, 3), color }); }
function shards(x, y, n = 8, color = '#e9fff5') { for (let i = 0; i < n; i++) part({ x, y, vx: rnd(-130, 130), vy: rnd(-180, -30), g: 480, life: rnd(400, 700), size: rnd(2, 4), color, shape: 'sq', spin: rnd(-10, 10) }); }
function dust(x, y, n = 6) { for (let i = 0; i < n; i++) part({ x: x + rnd(-8, 8), y: y + rnd(-2, 2), vx: rnd(-40, 40), vy: rnd(-22, -4), life: rnd(300, 520), size: rnd(3, 6), grow: 8, color: 'rgba(230,215,200,.5)' }); }
function smoke(x, y, n = 8) { for (let i = 0; i < n; i++) part({ x: x + rnd(-8, 8), y: y + rnd(-6, 2), vx: rnd(-10, 10), vy: rnd(-45, -15), life: rnd(600, 1100), size: rnd(5, 9), grow: 10, color: 'rgba(160,160,170,.35)' }); }
function motes(x, y, color, n = 10) { for (let i = 0; i < n; i++) part({ x: x + rnd(-12, 12), y: y + rnd(-30, 0), vy: rnd(-55, -20), life: rnd(500, 900), size: rnd(1.6, 3), color, add: true, shape: 'plus' }); }
function ring(x, y, color, r = 30, dur = 380) { FX.rings.push({ x, y, color, r, dur, t0: T }); }
function floatText(u, text, color, size = 15) {
  const [wx, wy] = world(u.px, u.py, u.pz), top = (LOOK[u.type].top || 30) + 12;
  const n = FX.floats.filter(f => f.u === u && T - f.t0 < 500).length;
  FX.floats.push({ u, x: wx, y: wy - top - n * 15 / Math.min(1, cam.z), text, color, size, t0: T });
}
function hitStop(ms) { if (!G.fast) freezeUntil = Math.max(freezeUntil, performance.now() + ms); }

/* --- primitives --- */
function shape(fill, stroke = OUT, lw = 1.4) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); } }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); }
function ell(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.2832); }
function poly(...p) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); }
function line(x1, y1, x2, y2, color, lw = 1) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
function diamond(cx, cy, inset = 0) { const w = TW / 2 - inset * 2, h = TH / 2 - inset; poly(cx, cy - h, cx + w, cy, cx, cy + h, cx - w, cy); }
// point inside a tile top: a along +x, b along +y, each in [-1,1]
const tp = (cx, cy, a, b) => [cx + a * 16 - b * 16, cy + a * 8 + b * 8];
function tline(cx, cy, a1, b1, a2, b2, color, lw = 1) { const p = tp(cx, cy, a1, b1), q = tp(cx, cy, a2, b2); line(p[0], p[1], q[0], q[1], color, lw); }
function eyes(side, y, col = '#17121c', gap = 3.1) { ctx.fillStyle = col; rr(side * 2.4 - gap - 1.1, y - 1.6, 2.2, 3.4, 1); ctx.fill(); rr(side * 2.4 + gap - 1.1, y - 1.6, 2.2, 3.4, 1); ctx.fill(); }
function drawBottle(x, y, s, color, glow) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35; ell(0, -7, 10, 12); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, -9); ctx.quadraticCurveTo(-4, -12, -1.5, -13); ctx.lineTo(-1.5, -17); ctx.lineTo(1.5, -17); ctx.lineTo(1.5, -13); ctx.quadraticCurveTo(4, -12, 4, -9); ctx.lineTo(4, 0); ctx.closePath();
  shape(color, OUT, 1); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-2.6, -9, 1.2, 6);
  ctx.fillStyle = '#c9a36a'; ctx.fillRect(-1.6, -19.5, 3.2, 3); ctx.restore();
}

/* --- sprites (origin at the feet, y up is negative) --- */
function human(u, front, side, c) {
  const b = Math.sin(now / 380 + u.id * 1.7) * 0.7, w = c.w || 1;
  rr(-side * 8 * w - 2.5, -26 + b, 5, 12, 2.5); shape(c.sleeve || c.body);
  rr(-6 * w, -11, 5 * w + 0.5, 11, 2); shape(c.pants || '#2a2433'); rr(0.5 * w, -11, 5 * w + 0.5, 11, 2); shape(c.pants || '#2a2433');
  rr(-9 * w, -28 + b, 18 * w, 19, 6); shape(c.body);
  c.torso && c.torso(front, side, b, w);
  if (c.arm) c.arm(front, side, b, w); else { rr(side * 8 * w - 2.5, -26 + b, 5, 12, 2.5); shape(c.sleeve || c.body); circ(side * 8 * w, -13.5 + b, 2.6); shape(c.skin); }
  circ(0, -35 + b, 8.5); shape(c.skin);
  c.head(front, side, b);
}
function spirit(u, front, side, c) {
  const bob = Math.sin(now / 420 + u.id * 2.1) * 2 - (c.hover || 0), h = c.h, r = c.r, sway = Math.sin(now / 300 + u.id) * 2.5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3; ell(0, 0, r * 1.7, r * 0.75); ctx.fillStyle = c.col2; ctx.fill(); ctx.restore();
  ctx.translate(0, bob);
  c.behind && c.behind(u, front, side);
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, c.col); g.addColorStop(0.55, c.col2); g.addColorStop(1, c.fade);
  ctx.beginPath(); ctx.moveTo(sway, -1);
  ctx.bezierCurveTo(-r * 0.5, -h * 0.18, -r * 1.3, -h * 0.4, -r, -h + r);
  ctx.arc(0, -h + r, r, Math.PI, 0);
  ctx.bezierCurveTo(r * 1.3, -h * 0.4, r * 0.5, -h * 0.18, sway, -1); ctx.closePath();
  shape(g, 'rgba(255,255,255,.6)', 1.1);
  ell(-r * 0.4, -h + r * 0.7, r * 0.2, r * 0.38, 0.4); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
  c.extra && c.extra(u, front, side);
  ctx.translate(0, -bob);
}
const LOOK = {
  otto: { top: 46, w: 1.28, draw(u, f, s) { human(u, f, s, this); }, body: '#31406a', skin: '#c98b62', pants: '#1f1c2b',
    torso(f, s, b) { if (f) { poly(-3.2, -28 + b, 3.2, -28 + b, 0, -19 + b); shape('#f1ece2', null); line(0, -27 + b, 0, -20 + b, '#c93a3a', 1.8); } },
    head(f, s, b) { if (f) { ctx.beginPath(); ctx.arc(0, -35 + b, 8.5, 0.12 * Math.PI, 0.88 * Math.PI); ctx.closePath(); shape('#4a3426', null); rr(s * 2.2 - 7, -38 + b, 14, 4.2, 1.6); shape('#0e0c12', null); line(s * 2.2 - 7, -36 + b, -8, -36.5 + b, '#0e0c12', 1); } else line(-4, -30 + b, 4, -30 + b, 'rgba(0,0,0,.25)', 1.2); } },
  ines: { top: 50, draw(u, f, s) { human(u, f, s, this); }, body: '#f1e7d8', skin: '#e2b08a', pants: '#23202e',
    torso(f, s, b) { if (f) { rr(-9, -28 + b, 6.5, 19, 4); shape('#a8324a', null); rr(2.5, -28 + b, 6.5, 19, 4); shape('#a8324a', null); poly(-3, -28.5 + b, 0, -26.5 + b, -3, -24.5 + b); shape('#17121c', null); poly(3, -28.5 + b, 0, -26.5 + b, 3, -24.5 + b); shape('#17121c', null); } else { rr(-8, -27 + b, 16, 17, 5); shape('#a8324a', null); } },
    arm(f, s, b) { rr(s * 8 - 2.5, -31 + b, 5, 10, 2.5); shape(this.body); circ(s * 9, -33 + b, 2.6); shape(this.skin); rr(s * 9 - 3, -45 + b, 6, 11, 2); shape('#d4dae3'); line(s * 9 - 3, -41 + b, s * 9 + 3, -41 + b, '#7d8796', 1); },
    head(f, s, b) { circ(0, -45 + b, 4); shape('#2a1b24'); ctx.beginPath(); if (f) ctx.arc(0, -36.5 + b, 8.6, Math.PI * 1.03, Math.PI * 1.97); else ctx.arc(0, -35 + b, 8.6, 0, 6.3); shape('#2a1b24', null); if (f) eyes(s, -34 + b); } },
  kit: { top: 46, w: 0.95, draw(u, f, s) { human(u, f, s, this); }, body: '#e0a82e', skin: '#f0c9a4', pants: '#2f3348',
    torso(f, s, b) { if (f) { rr(-5.5, -23 + b, 11, 13, 2); shape('#3d5a80', null); } else { ctx.beginPath(); ctx.arc(0, -27 + b, 7, 0, Math.PI); shape('#c18f22', null); } },
    arm(f, s, b) { rr(s * 7.6 - 2.5, -26 + b, 5, 12, 2.5); shape(this.body); circ(s * 7.6, -13.5 + b, 2.6); shape(this.skin); line(s * 7.6, -14 + b, s * 14, -21 + b, '#cfd6df', 1.8); },
    head(f, s, b) { ctx.beginPath(); ctx.arc(0, -36 + b, 8.7, Math.PI, 0); ctx.closePath(); shape('#c94f3d'); rr(-9, -37.5 + b, 18, 3.5, 1.5); shape('#a83c2d', OUT, 1); circ(0, -45 + b, 2); shape('#f3e6d0', OUT, 1); if (f) eyes(s, -33 + b); } },
  june: { top: 48, draw(u, f, s) { human(u, f, s, this); }, body: '#1f9e94', skin: '#d9a47a', pants: '#26222f',
    torso(f, s, b) { if (f) { rr(-7, -17 + b, 14, 8, 2); shape('#f3efe6', null); } },
    arm(f, s, b) { rr(s * 8 - 2.5, -31 + b, 5, 10, 2.5); shape(this.body); circ(s * 9.5, -33 + b, 2.6); shape(this.skin); ell(s * 10.5, -37 + b, 9, 3); shape('#d4dae3'); ctx.fillStyle = '#ffb347'; ctx.fillRect(s * 10.5 - 5, -43 + b, 3, 5); ctx.fillRect(s * 10.5 + 2, -43 + b, 3, 5); },
    head(f, s, b) { ell(-s * 8.5, -32 + b, 3.2, 6.5, s * 0.35); shape('#a5502c'); ctx.beginPath(); if (f) ctx.arc(0, -36.5 + b, 8.6, Math.PI * 1.0, Math.PI * 2.0); else ctx.arc(0, -35 + b, 8.6, 0, 6.3); shape('#a5502c', null); if (f) eyes(s, -34 + b); } },
  wisp: { top: 40, r: 8.5, h: 34, col: '#f0fffc', col2: '#9fe6d6', fade: 'rgba(120,220,200,0)', draw(u, f, s) { spirit(u, f, s, this); },
    extra(u, f, s) { const h = this.h, r = this.r; line(0, -h, 3, -h - 6, '#4f8a4a', 1.5); circ(3, -h - 6, 2.3); shape('#3b4a8c', OUT, 0.8); circ(-1.5, -h - 3, 2); shape('#4a5aa8', OUT, 0.8);
      if (f) { ctx.fillStyle = '#17323a'; ell(s * 2 - 3.2, -h + r * 1.05, 1.7, 2.6); ctx.fill(); ell(s * 2 + 3.2, -h + r * 1.05, 1.7, 2.6); ctx.fill(); ell(s * 2, -h + r * 1.75, 1.8, 1.2); ctx.fill(); } } },
  imp: { top: 34, r: 9.5, h: 27, col: '#fff6b8', col2: '#e8c33f', fade: 'rgba(230,170,50,0)', draw(u, f, s) { spirit(u, f, s, this); },
    extra(u, f, s) { const h = this.h, r = this.r; poly(-r + 1, -h + 4, -r - 2, -h - 5, -r + 6, -h + 1); shape('#a9dd45', OUT, 1); poly(r - 1, -h + 4, r + 2, -h - 5, r - 6, -h + 1); shape('#a9dd45', OUT, 1);
      if (f) { ctx.fillStyle = '#3a2a08'; ell(s * 2 - 3.6, -h + r, 2, 2.4); ctx.fill(); ell(s * 2 + 3.6, -h + r, 2, 2.4); ctx.fill(); ctx.beginPath(); ctx.arc(s * 2, -h + r * 1.45, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.strokeStyle = '#3a2a08'; ctx.lineWidth = 1.4; ctx.stroke(); } } },
  brute: { top: 50, w: 1.4, r: 14, h: 44, col: '#f2b46c', col2: '#a9571f', fade: 'rgba(110,50,15,0)', draw(u, f, s) { spirit(u, f, s, this); },
    behind(u, f, s) { const y = -this.h * 0.52 + Math.sin(now / 300 + u.id) * 1.5; ell(-this.r - 3, y, 6, 9, 0.3); shape('#c0702c', 'rgba(255,255,255,.5)', 1); ell(this.r + 3, y, 6, 9, -0.3); shape('#c0702c', 'rgba(255,255,255,.5)', 1); },
    extra(u, f, s) { const h = this.h, r = this.r; ctx.beginPath(); ctx.arc(0, -h + r, r + 0.4, Math.PI * 1.08, Math.PI * 1.92); ctx.lineTo(r * 0.97, -h + r * 0.98); ctx.lineTo(-r * 0.97, -h + r * 0.98); ctx.closePath(); shape('#c93a3a', OUT, 1); circ(-s * (r + 1), -h + r * 0.85, 2.6); shape('#c93a3a', OUT, 1);
      if (f) { ctx.fillStyle = '#2a1608'; ell(s * 3 - 5, -h + r * 1.3, 2.2, 2.8); ctx.fill(); circ(s * 3 + 5, -h + r * 1.3, 3.4); ctx.fill(); line(s * 3 - 3, -h + r * 1.95, s * 3 + 5, -h + r * 1.8, '#2a1608', 1.8); } } },
  fairy: { top: 66, r: 10, h: 48, hover: 9, col: '#f1fff5', col2: '#4fe08c', fade: 'rgba(40,200,120,0)', draw(u, f, s) { spirit(u, f, s, this); },
    behind(u, f, s) { const fl = 0.55 + 0.45 * Math.abs(Math.sin(now / 85)), y = -this.h * 0.62; ctx.save(); ctx.globalAlpha *= 0.6;
      for (const d of [-1, 1]) { ell(d * (this.r + 9 * fl), y - 5, 13 * fl, 5.5, d * -0.5); shape('rgba(215,255,232,.7)', 'rgba(255,255,255,.8)', 1); ell(d * (this.r + 6 * fl), y + 5, 9 * fl, 4, d * 0.5); shape('rgba(215,255,232,.6)', 'rgba(255,255,255,.7)', 1); } ctx.restore(); },
    extra(u, f, s) { const h = this.h, r = this.r; rr(-4.5, -h - 8, 9, 8, 1.5); shape('#fffdf5', OUT, 1);
      if (u.dCharge) { const fy = -h - 10; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { ell(Math.sin(now / 70 + i) * 1.5, fy - 5 - i * 4, 5 - i * 1.2, 7 - i * 1.5); ctx.fillStyle = ['#ff7a2a', '#ffb347', '#fff2a8'][i]; ctx.fill(); } ctx.restore(); }
      if (f) { ctx.strokeStyle = '#0d3b2a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 2 - 5.5, -h + r * 0.85); ctx.lineTo(s * 2 - 1.5, -h + r * 1.2); ctx.moveTo(s * 2 + 5.5, -h + r * 0.85); ctx.lineTo(s * 2 + 1.5, -h + r * 1.2); ctx.stroke(); ctx.lineCap = 'butt'; ell(s * 2, -h + r * 1.8, 2.2, 1); ctx.fillStyle = '#0d3b2a'; ctx.fill(); } } },
  keg: { top: 22, draw(u) { ctx.beginPath(); ctx.moveTo(-9, -3); ctx.quadraticCurveTo(-12.5, -13, -9, -23); ctx.lineTo(9, -23); ctx.quadraticCurveTo(12.5, -13, 9, -3); ctx.quadraticCurveTo(0, 1.5, -9, -3); ctx.closePath(); shape('#8f5c2b');
      ctx.strokeStyle = '#2f2d36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10.6, -8); ctx.quadraticCurveTo(0, -4.5, 10.6, -8); ctx.moveTo(-10.6, -18.5); ctx.quadraticCurveTo(0, -15, 10.6, -18.5); ctx.stroke();
      ell(0, -23, 9, 3.6); shape('#b07a3c'); ctx.fillStyle = '#ffcf5a'; ctx.font = '800 6.5px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('XXX', 0, -10.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.12 + 0.08 * Math.sin(now / 260 + u.id); ell(0, -12, 16, 16); ctx.fillStyle = '#ff8a3c'; ctx.fill(); ctx.restore(); } },
};
const tmpCv = document.createElement('canvas'); tmpCv.width = tmpCv.height = 224; const tctx = tmpCv.getContext('2d');
function drawSprite(u, front, side) {
  const cfg = LOOK[u.type];
  if (u.flash > 0.03) {
    const save = ctx; ctx = tctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, 224, 224); ctx.setTransform(2, 0, 0, 2, 112, 190);
    cfg.draw(u, front, side); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = Math.min(1, u.flash); ctx.fillStyle = u.flashCol || '#fff'; ctx.fillRect(0, 0, 224, 224);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx = save; ctx.drawImage(tmpCv, -56, -95, 112, 112);
  } else cfg.draw(u, front, side);
}
function drawUnit(u) {
  if (u.gone) return;
  const cfg = LOOK[u.type], [wx, gy] = world(u.px, u.py, u.pz), w = cfg.w || 1;
  ctx.save(); ctx.globalAlpha = u.alpha;
  ell(wx, gy, 12.5 * w, 5.5 * w); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
  if (u.team !== 'obj') {
    const fx = DX[u.facing] - DY[u.facing], fy = DX[u.facing] + DY[u.facing], tx = wx + fx * 18, ty = gy + fy * 9, px = -fy * 5, py = fx * 2.5;
    poly(tx + fx * 5, ty + fy * 2.5, tx - fx * 2 + px, ty - fy + py, tx - fx * 2 - px, ty - fy - py); shape(u.team === 'foe' ? FOE : CREW, 'rgba(0,0,0,.5)', 1);
  }
  ctx.translate(wx + u.shakeX, gy - u.hop);
  if (u.rot) { ctx.translate(0, -20); ctx.rotate(u.rot); ctx.translate(0, 20); }
  if (u.scale !== 1) ctx.scale(u.scale, u.scale);
  drawSprite(u, u.facing < 2, (u.facing === 0 || u.facing === 3) ? 1 : -1);
  ctx.restore();
  if (u.team === 'obj' || u.alpha < 0.5) return;
  // hp bar + status
  const bw = 30, bx = wx - bw / 2, by = gy - u.hop - cfg.top - 10;
  u._hx = wx; u._hy = by;
  ctx.fillStyle = 'rgba(14,10,20,.9)'; rr(bx - 1.5, by - 1.5, bw + 3, 8, 2); ctx.fill();
  let shown = Math.max(0, u.shp), loss = 0;
  if (V.mode === 'confirm' && V.preview) { const p = V.preview.list.find(p => p.u === u); if (p && p.dhp) { if (p.dhp < 0) { loss = Math.min(shown, -p.dhp); shown -= loss; } else loss = -p.dhp; } }
  ctx.fillStyle = u.team === 'foe' ? '#ff7a8a' : '#8be28b'; ctx.fillRect(bx, by, bw * shown / u.maxhp, 5);
  if (loss > 0) { ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.4 * Math.sin(now / 90)})`; ctx.fillRect(bx + bw * shown / u.maxhp, by, bw * loss / u.maxhp, 5); }
  if (loss < 0) { ctx.fillStyle = `rgba(190,255,190,${0.45 + 0.4 * Math.sin(now / 90)})`; ctx.fillRect(bx + bw * shown / u.maxhp, by, bw * Math.min(-loss, u.maxhp - shown) / u.maxhp, 5); }
  if (u.dSoaked) { const dx = bx - 6, dy = by + 2; ctx.beginPath(); ctx.moveTo(dx, dy - 5); ctx.quadraticCurveTo(dx + 4, dy + 1, dx, dy + 3); ctx.quadraticCurveTo(dx - 4, dy + 1, dx, dy - 5); shape('#6ec3ff', OUT, 1); if (Math.random() < 0.05) part({ x: wx + rnd(-8, 8), y: gy - cfg.top * 0.6, vy: 20, g: 240, life: 450, size: 1.8, color: '#7fd0ff' }); }
  if (u.dStun) for (let i = 0; i < 3; i++) { const a = now / 260 + i * 2.094, sx = wx + Math.cos(a) * 11, sy = by - 7 + Math.sin(a) * 3.5; ctx.fillStyle = '#ffe27a'; ctx.font = '700 10px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦', sx, sy); }
  if (u === V.active && !V.busy && V.mode !== 'intro') { const b = Math.sin(now / 220) * 2.5; poly(wx - 5.5, by - 14 + b, wx + 5.5, by - 14 + b, wx, by - 6 + b); shape('#fff', OUT, 1); }
}

/* --- room --- */
const MAT = { f: ['#6d4b38', '#634433'], a: ['#3d404b', '#373a45'], b: ['#8f4c2d', '#8a482a'], l: ['#7d5839', '#765233'], s: ['#84603f', '#7d5839'], p: ['#2c7a58', '#2a7453'], t: ['#a8703d', '#a8703d'], n: ['#9a3742', '#8f323c'] };
const SIDE = { f: '#4a3227', a: '#2b2d35', b: '#6a3320', l: '#59391f', s: '#59391f', p: '#55321f', t: '#4a3227', n: '#6b2530' };
function drawTile(x, y) {
  const h = hAt(x, y), k = kindAt(x, y), [cx, cy] = world(x, y, h * EH), K = key(x, y);
  const hl = inb(x, y + 1) ? hAt(x, y + 1) : -0.6, hr = inb(x + 1, y) ? hAt(x + 1, y) : -0.6;
  for (const [side, hn] of [[-1, hl], [1, hr]]) {
    if (h <= hn) continue;
    const d = (h - hn) * EH;
    poly(cx + side * 32, cy, cx, cy + 16, cx, cy + 16 + d, cx + side * 32, cy + d); ctx.fillStyle = shadeHex(SIDE[k], side < 0 ? 1 : 0.74); ctx.fill();
    if (k === 'b' && d >= 24) { for (const f of [0.33, 0.67]) line(cx + side * 32 * (1 - f), cy + 16 * f + 3, cx + side * 32 * (1 - f), cy + 16 * f + d - 8, 'rgba(0,0,0,.28)', 1); line(cx + side * 32, cy + d - 6, cx, cy + 10 + d, '#d9a441', 1.6); }
    else if (d >= 14 && (k === 'l' || k === 's' || k === 'n' || k === 'p')) line(cx + side * 32, cy + d * 0.5, cx, cy + 16 + d * 0.5, 'rgba(0,0,0,.2)', 1);
    line(cx + side * 32, cy, cx, cy + 16, 'rgba(255,235,200,.16)', 1);
  }
  diamond(cx, cy); ctx.fillStyle = MAT[k][(x + y) % 2]; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.stroke();
  if (k === 'f' || k === 'l') { tline(cx, cy, -1, -0.33, 1, -0.33, 'rgba(0,0,0,.1)'); tline(cx, cy, -1, 0.33, 1, 0.33, 'rgba(0,0,0,.1)'); }
  else if (k === 'a') { ctx.fillStyle = 'rgba(255,255,255,.07)'; for (const [a, b] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4], [0, 0]]) { const p = tp(cx, cy, a, b); ctx.fillRect(p[0] - 1, p[1] - 0.5, 2, 1); } }
  else if (k === 's') tline(cx, cy, -1, 0, 1, 0, 'rgba(0,0,0,.16)');
  else if (k === 't') { ell(cx, cy, 21, 10.5); shape('#b98248', 'rgba(0,0,0,.25)', 1); ell(cx, cy, 12, 6); ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.stroke(); }
  else if (k === 'n') { ctx.fillStyle = 'rgba(0,0,0,.25)'; for (const [a, b] of [[-0.45, 0], [0.45, 0]]) { const p = tp(cx, cy, a, b); circ(p[0], p[1], 1.3); ctx.fill(); } }
  if (k === 'b' || k === 'p') {
    const nb = [[0, 1, -1, 1, 1, 1], [1, 0, 1, -1, 1, 1], [0, -1, -1, -1, 1, -1], [-1, 0, -1, -1, -1, 1]];
    for (const [dx, dy, a1, b1, a2, b2] of nb) if (!inb(x + dx, y + dy) || kindAt(x + dx, y + dy) !== k) tline(cx, cy, a1 * 0.94, b1 * 0.94, a2 * 0.94, b2 * 0.94, k === 'b' ? '#c98a3e' : '#6b3d22', k === 'b' ? 1.6 : 3.4);
    if (k === 'b') tline(cx, cy, -1, -0.25, 1, -0.25, 'rgba(255,220,180,.13)', 2);
  }
  // highlights
  const hlite = (fill, stroke, inset = 2, lw = 1.5) => { diamond(cx, cy, inset); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
  const pulse = 0.5 + 0.5 * Math.sin(now / 200);
  if (V.threat && V.threat.has(K)) hlite(V.threat.get(K) === 'hit' ? 'rgba(255,110,150,.26)' : 'rgba(190,140,255,.24)', 'rgba(220,180,255,.5)');
  if (V.reach && V.mode === 'move') { const n = V.reach.get(K); if (n && n.d > 0 && !n.occupied) hlite('rgba(96,170,255,.4)', 'rgba(175,218,255,.95)'); }
  if (V.range && V.range.has(K)) { const hot = V.rangeHot && V.rangeHot.has(K); hlite(hot ? `rgba(255,80,105,${0.42 + 0.2 * pulse})` : 'rgba(255,90,110,.16)', hot ? '#ffd0d6' : 'rgba(255,150,160,.45)', 2, hot ? 2 : 1); }
  if (V.target && V.target.tiles.some(([tx, ty]) => tx === x && ty === y)) hlite('rgba(255,200,80,.6)', '#fff0c2', 1, 2);
  for (const p of G.pending) if (p.tiles.some(([tx, ty]) => tx === x && ty === y)) hlite(`rgba(255,120,40,${0.28 + 0.25 * pulse})`, `rgba(255,210,120,${0.6 + 0.4 * pulse})`, 1, 2);
  const a = V.active;
  if (a && !a.gone && !V.busy && Math.round(a.px) === x && Math.round(a.py) === y && V.mode !== 'intro') { diamond(cx, cy, 1); ctx.strokeStyle = a.team === 'foe' ? FOE : '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
}
function drawProp(x, y, kind) {
  const [cx, cy] = tileTop(x, y);
  if (kind === 'fountain') {
    const g = V.cracked ? 0.12 : 0.5 + 0.12 * Math.sin(now / 500);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = g; const rg = ctx.createRadialGradient(cx, cy - 18, 2, cx, cy - 18, 46); rg.addColorStop(0, '#6fe3a1'); rg.addColorStop(1, 'rgba(111,227,161,0)'); ctx.fillStyle = rg; ctx.fillRect(cx - 46, cy - 64, 92, 92); ctx.restore();
    poly(cx - 7, cy + 2, cx + 7, cy + 2, cx + 4, cy - 6, cx - 4, cy - 6); shape('#c9973e');
    ell(cx, cy - 18, 11, 13); shape(V.cracked ? 'rgba(90,120,105,.55)' : 'rgba(120,235,170,.8)', '#e9fff3', 1.2);
    if (!V.cracked) { ell(cx - 4, cy - 23, 2.5, 5, 0.4); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill(); }
    else { ctx.strokeStyle = '#17121c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 30); ctx.lineTo(cx + 2, cy - 22); ctx.lineTo(cx - 3, cy - 16); ctx.lineTo(cx + 1, cy - 8); ctx.stroke(); }
    rr(cx - 5, cy - 34, 10, 4, 1.5); shape('#c9973e'); circ(cx, cy - 36, 2); shape('#e8be6a');
    line(cx - 11, cy - 12, cx - 15, cy - 9, '#c9973e', 2); line(cx + 11, cy - 12, cx + 15, cy - 9, '#c9973e', 2);
  } else if (kind === 'piano') {
    poly(cx - 26, cy - 2, cx, cy + 11, cx, cy - 23, cx - 26, cy - 36); shape('#2a1c1c');
    poly(cx + 26, cy - 2, cx, cy + 11, cx, cy - 23, cx + 26, cy - 36); shape('#1d1414');
    poly(cx, cy - 49, cx + 26, cy - 36, cx, cy - 23, cx - 26, cy - 36); shape('#38262a');
    poly(cx - 24, cy - 16, cx - 2, cy - 5, cx - 2, cy - 9, cx - 24, cy - 20); shape('#f1ece2', OUT, 1);
    for (let i = 1; i < 6; i++) line(cx - 24 + i * 3.7, cy - 20 + i * 1.85, cx - 24 + i * 3.7, cy - 17.6 + i * 1.85, '#17121c', 1.3);
  }
}
let wallCv = null;
const WB = { x: -300, y: -(16 + WALL + 8), w: 600, h: 16 + WALL + 8 + 150 };
function buildWalls() {
  wallCv = document.createElement('canvas'); wallCv.width = WB.w * 2; wallCv.height = WB.h * 2;
  const save = ctx; ctx = wallCv.getContext('2d'); ctx.setTransform(2, 0, 0, 2, -WB.x * 2, -WB.y * 2);
  // right wall: back bar
  ctx.save(); ctx.transform(1, 0.5, 0, 1, 0, -16);
  let g = ctx.createLinearGradient(0, -WALL, 0, 0); g.addColorStop(0, 'rgba(22,40,42,0)'); g.addColorStop(0.3, '#182c2e'); g.addColorStop(1, '#2a4a44');
  ctx.fillStyle = g; ctx.fillRect(0, -WALL, 288, WALL);
  for (let u = 24; u < 288; u += 24) line(u, -WALL * 0.7, u, 0, 'rgba(0,0,0,.12)', 1);
  rr(100, -116, 184, 82, 3); shape('#0e1a1d', '#8a6a2e', 2);
  const cols = ['#c8843a', '#3f8f5e', '#d8e6ea', '#a8324a', '#3d5a80', '#e0a82e', '#7b4a8a', '#c9d6a0'];
  for (const v of [44, 68]) { ctx.fillStyle = '#5a3620'; ctx.fillRect(104, -v, 176, 3); for (let i = 0; i < 14; i++) { const u = 112 + i * 12.2, hh = 9 + (i * 7 + v) % 6, c = cols[(i * 3 + v) % cols.length]; ctx.fillStyle = c; ctx.fillRect(u - 2.6, -v - hh, 5.2, hh); ctx.fillRect(u - 1, -v - hh - 4, 2, 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(u - 1.8, -v - hh + 2, 1, hh - 4); } }
  ctx.fillStyle = '#6b4226'; ctx.fillRect(104, -92, 176, 3);
  for (let i = 0; i < TOTAL_FOES; i++) { rr(118 + i * 20 - 4, -92 - 14, 8, 14, 2); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
  ctx.font = '26px Yellowtail, cursive'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,111,168,.25)'; ctx.fillText('The Last Word', 192, -122);
  circ(48, -112, 12); shape('#f1e7d0', '#8a6a2e', 2); line(48, -112, 48, -120, OUT, 1.5); line(48, -112, 53.5, -115.5, OUT, 2); circ(48, -112, 1.2); shape(OUT, null);
  ctx.restore();
  // left wall: brick, windows, chalkboard
  ctx.save(); ctx.transform(1, -0.5, 0, 1, -288, 128);
  g = ctx.createLinearGradient(0, -WALL, 0, 0); g.addColorStop(0, 'rgba(70,36,36,0)'); g.addColorStop(0.3, '#472524'); g.addColorStop(1, '#663836');
  ctx.fillStyle = g; ctx.fillRect(0, -WALL, 288, WALL);
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let v = 8, r = 0; v < WALL * 0.72; v += 9, r++) { ctx.moveTo(0, -v); ctx.lineTo(288, -v); for (let u = (r % 2) * 10; u < 288; u += 20) { ctx.moveTo(u, -v); ctx.lineTo(u, -v + 9); } }
  ctx.stroke();
  for (const u of [26, 146]) {
    ctx.beginPath(); ctx.moveTo(u, -40); ctx.lineTo(u, -96); ctx.arc(u + 22, -96, 22, Math.PI, 0); ctx.lineTo(u + 44, -40); ctx.closePath();
    const sg = ctx.createLinearGradient(0, -118, 0, -40); sg.addColorStop(0, '#16224a'); sg.addColorStop(1, '#3a4f7c'); shape(sg, '#2c1a14', 3);
    ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(u + 30, -62, 1, u + 30, -62, 30); lg.addColorStop(0, 'rgba(255,200,120,.75)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = lg; ctx.fillRect(u, -120, 44, 80);
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(200,220,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 9; i++) { ctx.moveTo(u + 4 + i * 5, -116 + (i * 13) % 30); ctx.lineTo(u + 1 + i * 5, -104 + (i * 13) % 30); } ctx.stroke(); ctx.restore();
    line(u + 22, -118, u + 22, -40, '#2c1a14', 2); line(u, -78, u + 44, -78, '#2c1a14', 2);
  }
  rr(84, -104, 48, 50, 2); shape('#1a2420', '#6b4226', 3);
  ctx.fillStyle = '#e9e4d6'; ctx.textAlign = 'center'; ctx.font = '700 7.5px Outfit, sans-serif'; ctx.fillText('LAST CALL', 108, -90);
  ctx.font = '800 15px Outfit, sans-serif'; ctx.fillText('2 AM', 108, -74); ctx.font = '500 6px Outfit, sans-serif'; ctx.fillStyle = '#b9c7b0'; ctx.fillText('no exceptions', 108, -63);
  rr(238, -128, 30, 36, 1); shape('#d8b46a', '#2c1a14', 2.5); circ(253, -106, 8); shape('#c9483b', null); for (let i = 0; i < 7; i++) line(253, -106, 253 + Math.cos(Math.PI + i * 0.52) * 14, -106 + Math.sin(Math.PI + i * 0.52) * 14, '#c9483b', 1.2);
  ctx.restore();
  line(0, -16, 0, -16 - WALL * 0.72, 'rgba(0,0,0,.35)', 2);
  ctx = save;
}
const slotPos = i => { const u = 118 + i * 20; return [u, -16 + u / 2 - 92]; };
const SPIRIT_COL = { wisp: '#bff3e6', imp: '#f0d04a', brute: '#c7702a', fairy: '#5fe89a' };
const LAMPS = [[3, 2.6], [5.4, 2.6], [1.2, 5.6], [6.2, 6.4]];
function drawRoomBack() {
  if (wallCv) ctx.drawImage(wallCv, WB.x, WB.y, WB.w, WB.h);
  // neon
  const fl = (Math.sin(now / 130) + Math.sin(now / 370) * 0.6 > 1.45) ? 0.45 : 1;
  ctx.save(); ctx.transform(1, 0.5, 0, 1, 0, -16); ctx.font = '26px Yellowtail, cursive'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ff4f95'; ctx.shadowBlur = 14 * fl; ctx.fillStyle = `rgba(255,${150 + 60 * fl | 0},${200 + 30 * fl | 0},${0.55 + 0.45 * fl})`; ctx.fillText('The Last Word', 192, -122); ctx.restore();
  V.shelf.forEach((type, i) => { const [x, y] = slotPos(i); drawBottle(x, y, 0.8, SPIRIT_COL[type], true); });
}
function drawLamps() {
  for (const [lx, ly] of LAMPS) {
    const [x, y] = world(lx, ly, 126), [fx, fy] = world(lx, ly, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(fx, fy, 4, fx, fy, 84); g.addColorStop(0, 'rgba(255,190,110,.2)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.translate(fx, fy); ctx.scale(1, 0.5); ctx.translate(-fx, -fy); ctx.fillStyle = g; ctx.fillRect(fx - 84, fy - 84, 168, 168); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; g = ctx.createRadialGradient(x, y + 6, 1, x, y + 6, 34); g.addColorStop(0, 'rgba(255,210,140,.5)'); g.addColorStop(1, 'rgba(255,210,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - 34, y - 28, 68, 68); ctx.restore();
    line(x, y - 400, x, y - 6, 'rgba(20,14,22,.8)', 1.2);
    ctx.beginPath(); ctx.moveTo(x - 9, y + 3); ctx.quadraticCurveTo(x, y - 14, x + 9, y + 3); ctx.closePath(); shape('#3a2a22', OUT, 1); ell(x, y + 3, 9, 2.6); shape('#ffe2a6', null);
  }
}
function drawShot(s) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot || 0);
  if (s.kind === 'bottle') { rr(-3, -7, 6, 11, 2); shape('#4c9a6a', OUT, 1); ctx.fillStyle = '#4c9a6a'; ctx.fillRect(-1.2, -11, 2.4, 5); }
  else if (s.kind === 'tray') { ell(0, 0, 9, 3.5); shape('#d4dae3', OUT, 1); }
  else if (s.kind === 'spit') { circ(0, 0, 4); shape('#e8c33f', 'rgba(255,255,255,.7)', 1); }
  else if (s.kind === 'glass') { poly(-5, -5, 5, -5, 0, 1); shape('#ffb347', OUT, 1); line(0, 1, 0, 6, '#e9e4d6', 1.4); line(-3, 6, 3, 6, '#e9e4d6', 1.4); }
  else if (s.kind === 'match' || s.kind === 'cube') { if (s.kind === 'cube') { rr(-5, -5, 10, 10, 1.5); shape('#fffdf5', OUT, 1); } ctx.globalCompositeOperation = 'lighter'; ctx.rotate(-(s.rot || 0)); for (let i = 0; i < 3; i++) { ell(0, -4 - i * 3 - (s.kind === 'cube' ? 4 : 0), 4.5 - i, 6 - i * 1.4); ctx.fillStyle = ['#ff7a2a', '#ffb347', '#fff2a8'][i]; ctx.fill(); } }
  ctx.restore();
}

/* --- frame --- */
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (!r.width || !r.height) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const refit = !cam.fitted || Math.abs(r.width - cam.w) > 40 || Math.abs(r.height - cam.h) > 60;
  cam.w = r.width; cam.h = r.height; cam.dpr = dpr;
  if (refit) fit();
}
function fit() {
  const ww = (W + H) * TW / 2 + 10, top = -16 - WALL * 0.86, bot = (W + H) * TH / 2 + 22;
  cam.z = Math.max(0.45, Math.min(cam.w / ww, cam.h / (bot - top), 1.9));
  cam.x = cam.w / 2; cam.y = cam.h / 2 - ((top + bot) / 2) * cam.z; cam.fitted = true;
}
function frame(realNow) {
  now = realNow; const rdt = Math.min(50, now - (lastNow || now)); lastNow = now;
  const dt = now < freezeUntil ? 0 : rdt; T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i], k = Math.min(1, (T - t.t0) / t.ms); t.fn(k); if (k >= 1) { tweens.splice(i, 1); t.res(); } }
  const dpr = cam.dpr || 1, z = cam.z;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const bg = ctx.createLinearGradient(0, 0, 0, cam.h); bg.addColorStop(0, '#0f0b14'); bg.addColorStop(0.6, '#1c1422'); bg.addColorStop(1, '#130e18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cam.w, cam.h);
  cam.shake *= Math.pow(0.86, rdt / 16.7); if (cam.shake < 0.2) cam.shake = 0;
  const sx = (Math.random() - 0.5) * 2 * cam.shake, sy = (Math.random() - 0.5) * 2 * cam.shake;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cam.x + sx), dpr * (cam.y + sy));
  drawRoomBack();
  const items = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { items.push({ k: x + y, x, y }); const p = PROPS[key(x, y)]; if (p) items.push({ k: x + y + 0.3, x, y, p }); }
  for (const u of G.units) if (!u.gone) items.push({ k: Math.ceil(u.px + u.py - 1e-6) + 0.5, u });
  items.sort((a, b) => a.k - b.k);
  for (const it of items) it.u ? drawUnit(it.u) : it.p ? drawProp(it.x, it.y, it.p) : drawTile(it.x, it.y);
  // pending cube: small flames on its tiles
  for (const p of G.pending) for (const [x, y] of p.tiles) { const [cx, cy] = tileTop(x, y); if (Math.random() < 0.12) part({ x: cx + rnd(-14, 14), y: cy + rnd(-5, 5), vy: rnd(-40, -20), life: 420, size: rnd(2, 4), grow: -4, color: '#ff9a3c', add: true }); }
  if (V.mode === 'facing' && V.active && !V.active.gone) {
    const u = V.active, [ux, uy] = world(u.px, u.py, u.pz);
    for (let d = 0; d < 4; d++) { const fx = DX[d] - DY[d], fy = DX[d] + DY[d], cx = ux + fx * 32, cy = uy + fy * 16, on = d === V.faceDir;
      diamond(cx, cy, 3); shape(on ? 'rgba(255,179,71,.8)' : 'rgba(255,255,255,.22)', on ? '#fff' : 'rgba(255,255,255,.6)', 1.5);
      const px = -fy * 6, py = fx * 3; poly(cx + fx * 9, cy + fy * 4.5, cx - fx * 4 + px, cy - fy * 2 + py, cx - fx * 4 - px, cy - fy * 2 - py); shape(on ? '#2a1a05' : '#fff', null); }
    drawUnit(u);
  }
  // preview: shove arrows
  if (V.mode === 'confirm' && V.preview) for (const p of V.preview.list) if (p.to && !p.u.gone) {
    const [ax, ay] = world(p.u.px, p.u.py, p.u.pz), [bx, by] = tileTop(p.to.x, p.to.y);
    ctx.setLineDash([4, 3]); line(ax, ay, bx, by, '#fff0c2', 2); ctx.setLineDash([]); diamond(bx, by, 5); shape('rgba(255,240,194,.25)', '#fff0c2', 1.5);
  }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const r = FX.rings[i], k = (T - r.t0) / r.dur; if (k >= 1) { FX.rings.splice(i, 1); continue; } ctx.globalAlpha = 1 - k; ell(r.x, r.y, r.r * easeOut(k), r.r * 0.5 * easeOut(k)); ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.stroke(); ctx.globalAlpha = 1; }
  for (const s of FX.shots) drawShot(s);
  for (const c of FX.caps) drawBottle(c.x, c.y, c.s, c.color, true);
  const sdt = dt / 1000;
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i], k = (T - p.t0) / p.life; if (k >= 1) { FX.parts.splice(i, 1); continue; }
    p.vy += p.g * sdt; p.x += p.vx * sdt; p.y += p.vy * sdt; const sz = Math.max(0.3, p.size + p.grow * k);
    ctx.globalAlpha = (1 - k) * (p.add ? 0.85 : 1); ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; ctx.fillStyle = p.color;
    if (p.shape === 'sq') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.spin || 0) * k); ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.restore(); }
    else if (p.shape === 'plus') { ctx.fillRect(p.x - sz, p.y - sz / 3, sz * 2, sz / 1.5); ctx.fillRect(p.x - sz / 3, p.y - sz, sz / 1.5, sz * 2); }
    else { circ(p.x, p.y, sz); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawLamps();
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  if (V.mode === 'confirm' && V.preview) for (const p of V.preview.list) {
    if (p.u.gone || p.u.team === 'obj') { if (p.boom) { const [x, y] = world(p.u.px, p.u.py, p.u.pz); label('BOOM', x, y - 34, '#ffb347', 12); } continue; }
    const main = p.dhp ? (p.dhp > 0 ? '+' + p.dhp : '−' + (-p.dhp)) + (p.ko ? ' KO' : '') : (p.stun ? 'STUN' : p.soak ? 'SOAK' : p.dry ? 'DRY' : '');
    const sub = [...p.tags, ...(p.dhp && p.stun ? ['STUN'] : []), ...(p.dhp && p.soak ? ['SOAK'] : []), ...(p.cancel ? ['INTERRUPT'] : [])].join(' · ');
    if (main) label(main, p.u._hx, p.u._hy - 9, p.dhp > 0 ? '#8be28b' : p.ko ? '#ff8f8f' : '#ffe2a0', 14);
    if (sub) label(sub, p.u._hx, p.u._hy - 9 - 15 / Math.min(1, cam.z), '#fff', 8.5);
  }
  for (let i = FX.floats.length - 1; i >= 0; i--) {
    const f = FX.floats[i], k = (T - f.t0) / 1000; if (k >= 1) { FX.floats.splice(i, 1); continue; }
    const pop = 1 + 0.7 * Math.exp(-k * 14); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    label(f.text, f.x, f.y - easeOut(k) * 20 / Math.min(1, cam.z), f.color, f.size * pop); ctx.globalAlpha = 1;
  }
  // vignette
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vg = ctx.createRadialGradient(cam.w / 2, cam.h * 0.52, Math.min(cam.w, cam.h) * 0.3, cam.w / 2, cam.h * 0.52, Math.max(cam.w, cam.h) * 0.75);
  vg.addColorStop(0, 'rgba(10,6,14,0)'); vg.addColorStop(1, 'rgba(10,6,14,.62)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, cam.w, cam.h);
  if (cam.flash > 0.01) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,150,70,${cam.flash})`; ctx.fillRect(0, 0, cam.w, cam.h); ctx.globalCompositeOperation = 'source-over'; cam.flash *= Math.pow(0.84, rdt / 16.7); }
  requestAnimationFrame(frame);
}
function label(text, x, y, color, size) {
  size *= Math.max(1, 0.92 / cam.z);
  ctx.font = `800 ${size}px Outfit, sans-serif`; ctx.lineWidth = Math.max(2.5, size / 4.5); ctx.strokeStyle = 'rgba(14,10,20,.92)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function portrait(type) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const save = ctx, L = LOOK[type], foe = TYPES[type].team === 'foe'; ctx = c.getContext('2d');
  const savedNow = now; now = 0;
  ctx.fillStyle = foe ? '#17332b' : type === 'keg' ? '#3a2a22' : '#3a2a3f'; ctx.fillRect(0, 0, 96, 96);
  const u = { id: 0, type, dCharge: false };
  if (L.r) { const s = 30 / L.r; ctx.setTransform(s, 0, 0, s, 48, 50 + (L.h - L.r + (L.hover || 0)) * s); }
  else if (type === 'keg') ctx.setTransform(2.8, 0, 0, 2.8, 48, 84);
  else ctx.setTransform(3.3, 0, 0, 3.3, 48 - 6, 52 + 35 * 3.3);
  L.draw(u, true, 1); ctx = save; now = savedNow;
  return c.toDataURL();
}
