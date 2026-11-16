/* ===== pixel art, drawn by code: characters, trees, terrain textures ===== */
const OUTL = '#1c1730', EYE = '#1c1730', SW = 24, SH = 36;
function PX(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); let mir = false;
  const P = { c, g, w, h,
    mirror(v) { mir = v; return P; },
    r(x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(mir ? w - x - ww : x, y, ww, hh); return P; },
    p(x, y, col) { return P.r(x, y, 1, 1, col); },
    pts(list, col) { for (const [x, y] of list) P.r(x, y, 1, 1, col); return P; },
    e(cx, cy, rx, ry, col, y0 = -99, y1 = 99) { // filled ellipse, optionally only rows y0..y1
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) { if (y < y0 || y > y1) continue; const t = 1 - ((y - cy) / ry) ** 2; if (t < 0) continue;
        const hw = rx * Math.sqrt(t), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw); P.r(x0, y, x1 - x0 + 1, 1, col); } return P; },
  };
  return P;
}
function outlinePx(c, col) { // dark outline around the silhouette
  const g = c.getContext('2d'), w = c.width, h = c.height, im = g.getImageData(0, 0, w, h), d = im.data, hit = [];
  const a = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) hit.push([x, y]);
  g.fillStyle = col; for (const [x, y] of hit) g.fillRect(x, y, 1, 1);
}
const SKIN = { light: ['#f3c9a0', '#d39a6e'], tan: ['#dba577', '#b3784e'], pale: ['#f6d9c0', '#dbab8c'] };
const WOOD = ['#8a5a34', '#6a4226'], STEEL = ['#c9d2e3', '#8792ab', '#f6f8ff'], IRON = ['#8a8792', '#5c5964', '#b9b6c2'], GOLD = ['#f2c94c', '#c2922a'];
const KIT = {
  knight:  { skin: SKIN.light, hair: ['#8a5a2b', '#6b431f'], cloth: ['#3f6fd8', '#2c4fa8', '#7da2f5'], sleeve: [STEEL[0], STEEL[1]], legs: ['#7c88a3', '#5b667f'], boot: ['#5a3a22', '#44291a'], belt: '#6b431f', head: 'helm', metal: STEEL, plume: ['#e04b4b', '#b02f38'], gear: 'sword' },
  archer:  { skin: SKIN.tan, hair: ['#6a4226', '#4d2f1a'], cloth: ['#4f9a4a', '#35733a', '#7cc46c'], legs: ['#8a6a44', '#6a4f30'], boot: ['#5a3a22', '#44291a'], belt: '#44291a', head: 'hood', gear: 'bow' },
  mage:    { skin: SKIN.pale, hair: ['#e0702e', '#ad4a1f'], cloth: ['#7a4fd0', '#5636a0', '#a98af0'], robe: true, trim: GOLD[0], belt: GOLD[1], head: 'hat', gear: 'staff' },
  cleric:  { skin: SKIN.light, hair: ['#e8c96a', '#c29a3e'], cloth: ['#f1ede2', '#c4bcab', '#ffffff'], robe: true, trim: GOLD[0], belt: '#3f6fd8', head: 'coif', gear: 'mace' },
  raider:  { skin: SKIN.tan, hair: ['#35303b', '#221f27'], cloth: ['#7a543e', '#59392a', '#9a705a'], sleeve: SKIN.tan, legs: ['#45414f', '#2f2c38'], boot: ['#3a2a22', '#2a1d18'], belt: '#221f27', head: 'bandana', accent: ['#d23b30', '#9c2420'], gear: 'axe' },
  bowman:  { skin: SKIN.light, hair: ['#35303b', '#221f27'], cloth: ['#9a3330', '#6f2023', '#c2524a'], legs: ['#45414f', '#2f2c38'], boot: ['#3a2a22', '#2a1d18'], belt: '#221f27', head: 'mask', gear: 'bow' },
  captain: { skin: SKIN.pale, hair: ['#35303b', '#221f27'], cloth: ['#46414f', '#2e2a36', '#676172'], sleeve: [IRON[0], IRON[1]], legs: ['#46414f', '#2e2a36'], boot: ['#2a1d18', '#1c1310'], belt: GOLD[1], head: 'horned', metal: IRON, cape: ['#d23b30', '#8f2222'], gear: 'great' },
};
function drawFigure(type, back) {
  const K = KIT[type], P = PX(SW, SH), S = K.skin, cl = K.cloth, sl = K.sleeve || cl, lg = K.legs, bt = K.boot, h = K.hair, m = K.metal;
  const cap = (c0, c1, y0, y1, grow = 0.6) => P.e(12, 14, 6 + grow, 6 + grow, c1, y0, y1).e(11.3, 13.6, 5.4 + grow, 5.8 + grow, c0, y0, y1);
  if (K.cape && !back) P.r(5, 21, 14, 13, K.cape[1]);
  // legs or robe
  if (!K.robe) P.r(9, 29, 3, 4, lg[0]).r(12, 29, 3, 4, lg[1]).r(8, 32, 4, 3, bt[0]).r(12, 32, 4, 3, bt[1]);
  P.r(8, 20, 8, 8, cl[0]).r(13, 20, 3, 8, cl[1]).r(8, 21, 1, 5, cl[2]);
  if (K.robe) P.r(7, 27, 10, 3, cl[0]).r(6, 30, 12, 5, cl[0]).r(14, 27, 3, 3, cl[1]).r(14, 30, 4, 5, cl[1]).r(7, 28, 1, 6, cl[2]).r(6, 34, 12, 1, K.trim);
  else P.r(7, 27, 10, 3, cl[0]).r(13, 27, 4, 3, cl[1]);
  P.r(8, 26, 8, 1, K.belt);
  if (type === 'cleric' && !back) P.r(11, 21, 2, 12, '#3f6fd8').r(10, 23, 4, 1, GOLD[0]);
  if (type === 'mage' && !back) P.r(11, 21, 2, 5, GOLD[0]);
  if (type === 'raider' && !back) P.r(10, 20, 4, 3, S[0]).r(13, 20, 1, 3, S[1]);
  if (type === 'bowman' && !back) P.r(9, 22, 6, 1, '#221f27');
  // arms and hands
  P.r(6, 21, 2, 6, sl[0]).r(16, 21, 2, 6, sl[1]).r(6, 27, 2, 2, S[0]).r(16, 27, 2, 2, S[1]);
  if (m) P.e(7, 21, 2.3, 1.9, m[0]).e(17, 21, 2.3, 1.9, m[1]).p(6, 20, m[2]);
  if (K.cape && back) P.r(6, 20, 12, 14, K.cape[0]).r(14, 20, 4, 14, K.cape[1]).r(7, 20, 1, 13, '#f06a5a');
  if (back && (type === 'archer' || type === 'bowman')) P.r(10, 19, 4, 9, WOOD[0]).r(13, 19, 1, 9, WOOD[1]).pts([[10, 17], [11, 16], [12, 17], [13, 16]], '#f2efe6').pts([[10, 18], [11, 18], [12, 18], [13, 18]], '#d23b30');
  // head
  P.e(12, 14, 6, 6, S[1]).e(11.4, 13.6, 5.3, 5.5, S[0]);
  if (!back) { P.r(8, 15, 1, 2, EYE).r(13, 15, 1, 2, EYE).p(8, 14, '#fff').p(13, 14, '#fff').r(10, 18, 2, 1, S[1]); }
  // hair and headgear
  if (K.head === 'helm') {
    if (back) cap(m[0], m[1], 7, 19); else { cap(m[0], m[1], 7, 12); P.r(6, 12, 13, 1, m[1]).r(6, 13, 1, 4, m[0]).r(18, 13, 1, 4, m[1]).r(11, 13, 1, 2, m[1]); }
    P.r(8, 9, 3, 1, m[2]).r(11, 3, 3, 4, K.plume[0]).r(13, 4, 3, 4, K.plume[1]).r(15, 6, 2, 3, K.plume[1]).p(11, 3, '#ff8a80');
  } else if (K.head === 'hood' || K.head === 'mask') {
    if (back) { cap(cl[0], cl[1], 6, 20, 1); P.r(13, 19, 3, 3, cl[1]); }
    else { cap(cl[0], cl[1], 6, 12, 1); P.r(5, 12, 2, 8, cl[0]).r(17, 12, 2, 8, cl[1]).r(8, 12, 6, 1, h[0]).r(13, 12, 3, 1, h[1]); if (K.head === 'mask') P.r(7, 17, 10, 3, '#2a2228').r(14, 17, 3, 3, '#1c161b'); }
    P.r(14, 5, 3, 2, cl[1]).r(16, 6, 2, 2, cl[1]);
  } else if (K.head === 'hat') {
    if (back) P.r(7, 12, 10, 9, h[0]).r(14, 12, 3, 9, h[1]).r(8, 21, 8, 2, h[0]); else P.r(6, 12, 1, 8, h[0]).r(17, 12, 2, 8, h[1]).r(7, 12, 3, 1, h[0]);
    for (let y = 10; y >= 0; y--) { const w = Math.max(2, Math.round(12 - (10 - y) * 1.1)), x0 = Math.round(12 - w / 2 + (10 - y) * 0.3); P.r(x0, y, w, 1, cl[0]).r(x0 + Math.ceil(w * 0.62), y, w - Math.ceil(w * 0.62), 1, cl[1]); }
    P.r(3, 11, 18, 2, cl[0]).r(13, 11, 8, 2, cl[1]).r(3, 11, 6, 1, cl[2]).r(6, 9, 12, 1, GOLD[0]).r(14, 9, 4, 1, GOLD[1]);
  } else if (K.head === 'coif') {
    if (back) { cap(cl[0], cl[1], 7, 20); P.r(6, 19, 12, 5, cl[0]).r(14, 19, 4, 5, cl[1]); } else { cap(cl[0], cl[1], 7, 12); P.r(5, 12, 2, 9, cl[0]).r(17, 12, 2, 9, cl[1]).r(8, 12, 6, 1, h[0]).r(13, 12, 3, 1, h[1]); }
    P.r(6, 10, 13, 1, GOLD[0]).r(15, 10, 4, 1, GOLD[1]); if (back) P.r(11, 24, 2, 9, '#3f6fd8').r(10, 26, 4, 1, GOLD[0]);
  } else if (K.head === 'bandana') {
    if (back) cap(h[0], h[1], 7, 19); else { cap(h[0], h[1], 7, 11); P.r(6, 12, 1, 3, h[0]).r(18, 12, 1, 3, h[1]).r(8, 19, 6, 1, S[1]); }
    P.r(6, 10, 13, 2, K.accent[0]).r(15, 10, 4, 2, K.accent[1]).r(19, 11, 2, 2, K.accent[0]).r(20, 13, 1, 3, K.accent[1]);
  } else if (K.head === 'horned') {
    if (back) cap(m[0], m[1], 7, 19); else { cap(m[0], m[1], 7, 12); P.r(6, 12, 13, 1, m[1]).r(6, 13, 1, 5, m[0]).r(18, 13, 1, 5, m[1]).r(11, 13, 2, 3, m[1]); P.p(8, 15, '#ff5a4a').p(13, 15, '#ff5a4a'); }
    for (const mm of [false, true]) { P.mirror(mm).pts([[5, 10], [4, 9], [4, 8], [3, 8], [3, 7], [3, 6], [4, 5], [4, 6]], '#efe6cf').pts([[5, 9], [4, 7]], '#cdbf9f'); } P.mirror(false);
    P.r(8, 9, 3, 1, m[2]);
  }
  // held gear: drawn on the left of a front view, mirrored for the back view
  P.mirror(back);
  if (K.gear === 'sword') { P.r(4, 13, 2, 13, STEEL[0]).r(4, 13, 1, 13, STEEL[2]).p(5, 12, STEEL[0]).r(3, 26, 4, 1, GOLD[0]).r(4, 27, 2, 2, WOOD[1]); P.e(18.5, 25.5, 3.2, 4.6, STEEL[1]).e(18.5, 25.5, 2.2, 3.6, cl[0]).r(18, 24, 2, 3, cl[2]).p(18, 25, GOLD[0]); }
  else if (K.gear === 'bow') { P.pts([[5, 15], [4, 16], [3, 17], [3, 18], [2, 19], [2, 20], [2, 21], [2, 22], [2, 23], [2, 24], [2, 25], [2, 26], [3, 27], [3, 28], [4, 29], [5, 30]], WOOD[0]).pts([[4, 15], [3, 16], [3, 29], [4, 30]], WOOD[1]).r(5, 16, 1, 14, '#e6e2d4'); }
  else if (K.gear === 'staff') { P.r(4, 11, 1, 24, WOOD[0]).e(4, 8, 2.2, 2.2, '#ff9a2e').p(3, 7, '#fff2c0').p(4, 8, '#ffd27a'); }
  else if (K.gear === 'mace') { P.r(4, 18, 1, 11, WOOD[0]).r(3, 13, 3, 5, GOLD[0]).r(5, 13, 1, 5, GOLD[1]).p(2, 15, GOLD[0]).p(6, 15, GOLD[1]).p(4, 12, GOLD[0]); }
  else if (K.gear === 'axe') { P.r(5, 13, 1, 17, WOOD[0]).r(2, 13, 3, 6, STEEL[0]).r(2, 14, 1, 4, STEEL[2]).r(1, 15, 1, 2, STEEL[0]).r(4, 13, 1, 6, STEEL[1]); }
  else if (K.gear === 'great') { P.r(3, 7, 3, 19, IRON[2]).r(5, 7, 1, 19, IRON[0]).r(3, 7, 1, 19, '#ffffff').p(4, 6, IRON[2]).r(1, 26, 7, 1, GOLD[0]).r(3, 27, 3, 2, WOOD[1]); }
  P.mirror(false);
  outlinePx(P.c, OUTL);
  return P.c;
}
function spriteAtlas(type) { // frames: front, front (breathing), back, back (breathing); plus a white copy for hit flashes
  const A = document.createElement('canvas'); A.width = SW * 4; A.height = SH; const g = A.getContext('2d'); g.imageSmoothingEnabled = false;
  [false, true].forEach((back, i) => { const c = drawFigure(type, back); g.drawImage(c, i * 2 * SW, 0); g.drawImage(c, 0, 0, SW, 29, (i * 2 + 1) * SW, 1, SW, 29); g.drawImage(c, 0, 29, SW, 7, (i * 2 + 1) * SW, 29, SW, 7); });
  const Wc = document.createElement('canvas'); Wc.width = A.width; Wc.height = A.height; const wg = Wc.getContext('2d'); wg.drawImage(A, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, Wc.width, Wc.height);
  return { atlas: A, white: Wc };
}
function drawTree(seed) {
  const P = PX(28, 40), r = mulberry(seed); P.r(12, 28, 4, 11, WOOD[0]).r(14, 28, 2, 11, WOOD[1]).r(11, 37, 6, 2, WOOD[1]);
  P.e(14, 16, 11, 12, '#1f5a2e').e(12.5, 14.5, 9.5, 10.5, '#2f7a3a').e(10.5, 11.5, 6, 6, '#47994a').e(9, 9.5, 3, 2.6, '#6ab85a');
  for (let i = 0; i < 26; i++) { const x = 4 + Math.floor(r() * 20), y = 5 + Math.floor(r() * 22); if (P.g.getImageData(x, y, 1, 1).data[3]) P.p(x, y, r() < 0.5 ? '#1f5a2e' : '#6ab85a'); }
  outlinePx(P.c, OUTL); return P.c;
}
function drawRock() { const P = PX(24, 20); P.e(11, 12, 9, 6.5, '#6b6a78').e(10, 11, 8, 5.5, '#8d8c9a').e(8, 9, 4, 2.5, '#b3b2c0').e(18, 15, 4, 3.5, '#6b6a78').e(17.5, 14.5, 3, 2.6, '#8d8c9a').pts([[12, 12], [13, 13], [14, 13], [9, 14]], '#5a5966'); outlinePx(P.c, OUTL); return P.c; }

/* --- terrain textures: 16 texels to a tile --- */
function tileTop(kind, seed) {
  const P = PX(16, 16), r = mulberry(seed);
  const fill = (base, lo, hi, a = 0.17, b = 0.12) => { P.r(0, 0, 16, 16, base); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = r(); if (v < a) P.p(x, y, lo); else if (v > 1 - b) P.p(x, y, hi); } };
  if (kind === 'g') { fill('#4f9d3d', '#42883a', '#66b24c'); for (let i = 0; i < 4; i++) { const x = 1 + Math.floor(r() * 13), y = 2 + Math.floor(r() * 11); P.p(x, y, '#86cc5a').p(x, y + 1, '#66b24c').p(x + 1, y + 1, '#2f6f33'); } }
  else if (kind === 'd') { fill('#b98c56', '#a47946', '#cfa56c'); for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13); P.r(x, y, 2, 1, '#86643c').p(x, y - 1, '#dcb680'); } }
  else if (kind === 's') { fill('#8f8e9b', '#807f8c', '#a3a2af', 0.14, 0.1); P.r(0, 7, 16, 1, '#65647180').r(7, 0, 1, 7, '#65647180').r(3, 8, 1, 8, '#65647180').r(11, 8, 1, 8, '#65647180'); }
  else if (kind === 'b') { for (let y = 0; y < 16; y += 4) { P.r(0, y, 16, 3, y % 8 ? '#a6763f' : '#9a6b3c').r(0, y + 3, 16, 1, '#5a3a22').p(2 + (y * 3) % 11, y + 1, '#c08e52'); } P.r(0, 0, 2, 16, '#6a4226').r(14, 0, 2, 16, '#6a4226'); }
  else if (kind === 'f') { fill('#c9b582', '#b8a372', '#dccb9c'); for (let i = 0; i < 7; i++) { const x = Math.floor(r() * 13), y = Math.floor(r() * 15); P.r(x, y, 3, 1, '#8fc3e0').p(x + 1, y + 1, '#6aa6d0'); } }
  else { P.r(0, 0, 16, 16, '#2f6fd0'); for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 13), y = Math.floor(r() * 16); P.r(x, y, 3, 1, '#6aa8ee').p(x + 3, y + 1, '#2558b0'); } for (let i = 0; i < 12; i++) P.p(Math.floor(r() * 16), Math.floor(r() * 16), '#2558b0'); }
  if (kind !== 'w') { P.g.fillStyle = 'rgba(0,0,0,.16)'; P.g.fillRect(15, 0, 1, 16); P.g.fillRect(0, 15, 16, 1); P.g.fillStyle = 'rgba(255,255,255,.10)'; P.g.fillRect(0, 0, 16, 1); P.g.fillRect(0, 0, 1, 16); }
  return P.c;
}
function tileSide(kind, rows, seed) { // a cliff face `rows` texels tall, turf at the top, fading into the dark at the bottom
  const P = PX(16, rows), r = mulberry(seed), stone = kind === 's' || kind === 'b', water = kind === 'w';
  const base = water ? '#2558b0' : stone ? '#6f6e7b' : '#7d5b3c', lo = water ? '#1c4690' : stone ? '#5d5c68' : '#684a30', hi = water ? '#3a78d8' : stone ? '#85848f' : '#93704c';
  P.r(0, 0, 16, rows, base);
  for (let y = 0; y < rows; y++) for (let x = 0; x < 16; x++) { const v = r(); if (v < 0.16) P.p(x, y, lo); else if (v > 0.9) P.p(x, y, hi); }
  if (!water) for (let y = stone ? 5 : 6; y < rows; y += stone ? 5 : 7) { P.r(0, y, 16, 1, lo); if (stone) for (let x = (y % 2) * 4 + 2; x < 16; x += 8) P.r(x, y - 4, 1, 4, lo); else P.r(Math.floor(r() * 10), y - 3, 3, 2, hi).r(Math.floor(r() * 12), y - 2, 2, 1, lo); }
  if (kind === 'g') { P.r(0, 0, 16, 2, '#42883a'); for (let x = 0; x < 16; x++) { P.p(x, 0, '#66b24c'); if (r() < 0.6) P.p(x, 2, '#42883a'); if (r() < 0.25) P.p(x, 3, '#2f6f33'); } }
  else if (kind === 'd' || kind === 'f') P.r(0, 0, 16, 1, '#cfa56c').r(0, 1, 16, 1, '#a47946');
  else if (water) P.r(0, 0, 16, 1, '#8fc3ee').r(0, 1, 16, 1, '#3a78d8');
  else P.r(0, 0, 16, 1, '#a3a2af');
  const g = P.g; for (let y = 0; y < rows; y++) { const k = Math.pow(y / rows, 1.6) * 0.82; if (k > 0.02) { g.fillStyle = `rgba(10,12,34,${k.toFixed(3)})`; g.fillRect(0, y, 16, 1); } }
  return P.c;
}
