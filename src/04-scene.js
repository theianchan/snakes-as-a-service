/* ===== the diorama: three.js scene, pieces, effects, camera ===== */
const $ = id => document.getElementById(id);
const canvas = $('cv');
const STEP = 0.5, BASE = 0.45, OFFX = (W - 1) / 2, OFFZ = (H - 1) / 2;
const topY = (x, y) => kindAt(x, y) === 'w' ? -0.13 : kindAt(x, y) === 'f' ? -0.05 : hAt(x, y) * STEP;
const tileV = (x, y, up = 0) => new THREE.Vector3(x - OFFX, topY(x, y) + up, y - OFFZ);
const lerp = (a, b, k) => a + (b - a) * k, easeOut = k => 1 - Math.pow(1 - k, 3), easeIO = k => k * k * (3 - 2 * k), rnd = (a, b) => a + Math.random() * (b - a);
const CREW_WOOD = '#e8c98e', FOE_WOOD = '#241a1d';
const ACCENT = { knight: '#2457d6', archer: '#2f8f3a', mage: '#7a3fd0', cleric: '#e0a81e', raider: '#c4231c', bowman: '#c4231c', captain: '#c4231c' };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
const gl = renderer.getContext();
const scene = new THREE.Scene(); const BG = new THREE.Color('#06100f'); scene.background = BG; scene.fog = new THREE.Fog(BG, 30, 70);
const cam = new THREE.PerspectiveCamera(30, 1, 1, 120);
const view = { yaw: 0.3, pitch: 0.9, dist: 26, zoom: 1, fit: 26, w: 1, h: 1, dpr: 1, shift: 0, shake: 0, hudH: 250, topH: 56, target: new THREE.Vector3(0, 0.35, 0) };

/* --- time, tweens --- */
const tweens = []; let T = 0, lastNow = 0, freezeUntil = 0;
const tween = (ms, fn) => new Promise(res => { if (G.fast || ms <= 0) { fn(1); res(); } else tweens.push({ t0: T, ms: ms * (G.speed || 1), fn, res }); });
const wait = ms => tween(ms, () => {});
function hitStop(ms) { if (!G.fast) freezeUntil = Math.max(freezeUntil, performance.now() + ms); }

/* --- procedural textures --- */
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (repeat) t.repeat.set(repeat, repeat); return t;
}
const woodTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#e9e4dc'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) { const y = Math.random() * s, a = 0.03 + Math.random() * 0.09; g.strokeStyle = `rgba(60,35,15,${a})`; g.lineWidth = 0.5 + Math.random() * 2.2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 3 + Math.sin(x / 23 + i * 2) * 1.2); g.stroke(); }
  for (let i = 0; i < 5; i++) { const x = Math.random() * s, y = Math.random() * s; for (let r = 14; r > 2; r -= 3) { g.strokeStyle = 'rgba(60,35,15,.1)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r * 1.8, r, 0, 0, 7); g.stroke(); } }
});
const paintTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + Math.random() * 0.07})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); const x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y); g.lineTo(x + rnd(-50, 50), y + rnd(-14, 14)); g.stroke(); }
});
const decalTex = canvasTex(128, (g, s) => {
  g.clearRect(0, 0, s, s); const r = 16, p = 5;
  g.beginPath(); g.roundRect ? g.roundRect(p, p, s - 2 * p, s - 2 * p, r) : g.rect(p, p, s - 2 * p, s - 2 * p);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); g.lineWidth = 7; g.strokeStyle = 'rgba(255,255,255,1)'; g.stroke();
});
const outlineTex = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); const p = 7; g.beginPath(); g.roundRect ? g.roundRect(p, p, s - 2 * p, s - 2 * p, 16) : g.rect(p, p, s - 2 * p, s - 2 * p); g.fillStyle = 'rgba(255,255,255,.14)'; g.fill(); g.lineWidth = 8; g.setLineDash([14, 9]); g.strokeStyle = 'rgba(255,255,255,1)'; g.stroke(); });
const glowTex = canvasTex(128, (g, s) => { const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, s, s); });

const mats = {};
const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o));
const mat = (name, make) => mats[name] || (mats[name] = make());
function mesh(geo, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

/* --- lights --- */
scene.add(new THREE.HemisphereLight('#c4d2f2', '#4d3a2a', 0.36));
const keyLight = new THREE.SpotLight('#ffe2b2', 1.05, 70, 0.46, 0.8, 1.0); keyLight.position.set(-9, 15, 7); keyLight.target.position.set(0, 0, 0);
keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0006; keyLight.shadow.normalBias = 0.03; keyLight.shadow.camera.near = 6; keyLight.shadow.camera.far = 34;
scene.add(keyLight, keyLight.target);
const rimLight = new THREE.DirectionalLight('#7f9cff', 0.2); rimLight.position.set(7, 5, -9); scene.add(rimLight);
const fxLight = new THREE.PointLight('#ffb060', 0, 7, 1.6); scene.add(fxLight);

/* --- table, tray, terrain --- */
const feltTex = canvasTex(256, (g, s) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5); } }, 60);
const table = mesh(new THREE.PlaneGeometry(160, 160), M('#1c4a43', { map: feltTex, roughness: 0.95 }), 0, -BASE - 0.32, 0);
table.rotation.x = -Math.PI / 2; table.castShadow = false; scene.add(table);
function roundedRect(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function slab(w, d, height, r, bevel) { // rounded block whose top face sits at y = 0
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, -(height - bevel), 0); return g;
}
const tray = mesh(slab(W + 0.7, H + 0.7, 0.32, 0.3, 0.05), [M('#5a3823', { map: woodTex, roughness: 0.45 }), M('#4a2d1c', { map: woodTex, roughness: 0.45 })], 0, -BASE, 0); scene.add(tray);
const TOP = { g: ['#5ea338', '#549730'], d: ['#bd8d4f', '#b08247'], s: ['#8d8c98', '#82818d'], b: ['#9c9186', '#9c9186'], f: ['#74b4c6', '#74b4c6'], w: ['#1b6ec4', '#1867ba'] };
const SIDE = { g: '#c9995a', d: '#c9995a', s: '#74727c', b: '#74727c', f: '#a98f66', w: '#124f8f' };
const tiles = [], tileMeshes = [], decals = [];
const geoCache = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = kindAt(x, y), ty = topY(x, y), hgt = +(ty + BASE).toFixed(3);
  const base = geoCache[hgt] || (geoCache[hgt] = slab(0.95, 0.95, hgt, 0.09, 0.035));
  const g = base.clone(), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + x * 0.37, uv.getY(i) * 0.5 + y * 0.53);
  const shade = k === 'g' ? 1 + hAt(x, y) * 0.035 : 1, col = new THREE.Color(TOP[k][(x + y) % 2]).multiplyScalar(shade);
  const top = k === 'w' ? M(col, { roughness: 0.08, metalness: 0.15 }) : M(col, { map: paintTex, roughness: 0.82 });
  const side = mat('side' + k, () => M(SIDE[k], { map: woodTex, roughness: k === 'w' ? 0.3 : 0.6 }));
  const m = mesh(g, [top, side], x - OFFX, ty, y - OFFZ); m.userData.tile = { x, y }; scene.add(m); tileMeshes.push(m); tiles[y * W + x] = m;
  const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
  dm.rotation.x = -Math.PI / 2; dm.position.set(x - OFFX, ty + 0.012, y - OFFZ); dm.visible = false; dm.renderOrder = 2; scene.add(dm); decals[y * W + x] = dm;
  if (k === 'b') for (const sx of [-0.43, 0.43]) scene.add(mesh(new THREE.BoxGeometry(0.08, 0.2, 1.0), mat('rail', () => M('#8a7f73', { map: woodTex })), x - OFFX + sx, ty + 0.1, y - OFFZ));
  if (k === 'f') for (let i = 0; i < 4; i++) { const s = mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('pebble', () => M('#c9c2b4', { roughness: 0.9 })), x - OFFX + rnd(-0.28, 0.28), ty + 0.005, y - OFFZ + rnd(-0.28, 0.28)); s.scale.set(1, 0.35, 1 + rnd(-0.2, 0.3)); scene.add(s); }
}
for (const k in PROPS) {
  const [x, y] = k.split(',').map(Number), p = tileV(x, y), g = new THREE.Group(); g.position.copy(p); g.rotation.y = rnd(0, 6);
  if (PROPS[k] === 'tree') {
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.34, 10), mat('trunk', () => M('#7a5232', { map: woodTex })), 0, 0.17, 0));
    [[0.4, 0.5, 0.5], [0.31, 0.44, 0.82], [0.2, 0.38, 1.1]].forEach(([r, h, yy], i) => g.add(mesh(new THREE.ConeGeometry(r, h, 14), mat('leaf' + i, () => M(['#236b34', '#2c7a3b', '#398a43'][i], { map: paintTex, roughness: 0.85 })), 0, yy, 0)));
    const s = rnd(0.9, 1.12); g.scale.set(s, s, s);
  } else {
    const r1 = mesh(new THREE.DodecahedronGeometry(0.34), mat('rock', () => M('#8f8d94', { roughness: 0.9, flatShading: true })), -0.05, 0.2, 0); r1.scale.set(1, 0.75, 1.1); g.add(r1);
    const r2 = mesh(new THREE.DodecahedronGeometry(0.2), mats.rock, 0.24, 0.12, 0.18); g.add(r2);
  }
  scene.add(g);
}
// a pair of dice on the felt, because it is a tabletop
const dieMats = [1, 6, 2, 5, 3, 4].map(n => M('#ffffff', { roughness: 0.35, map: canvasTex(64, (g, s) => {
  g.fillStyle = '#f3ead6'; g.fillRect(0, 0, s, s); g.fillStyle = '#2a211a';
  const P = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.26, .26], [.74, .26], [.5, .5], [.26, .74], [.74, .74]], 6: [[.28, .24], [.72, .24], [.28, .5], [.72, .5], [.28, .76], [.72, .76]] }[n];
  for (const [x, y] of P) { g.beginPath(); g.arc(x * s, y * s, s * 0.085, 0, 7); g.fill(); }
}) }));
for (const [x, z, r] of [[-3.85, H / 2 + 0.95, 0.5], [-3.35, H / 2 + 1.6, 2.0]]) { const d = mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), dieMats, x, -BASE - 0.32 + 0.22, z); d.rotation.y = r; scene.add(d); }
const activeRing = new THREE.Mesh(new THREE.RingGeometry(0.37, 0.47, 40), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
activeRing.rotation.x = -Math.PI / 2; activeRing.visible = false; activeRing.renderOrder = 3; scene.add(activeRing);
const DECAL = { move: ['#2e8bff', 0.95], range: ['#ff5468', 0.85, 1], hot: ['#ff2b47', 1], area: ['#ffb824', 1], threat: ['#b06bff', 0.95, 1] };   // third value: dashed outline instead of a filled tile
function setDecals(fn) { // fn(x, y) -> one of DECAL's keys, or null
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = decals[y * W + x], kind = fn ? fn(x, y) : null; d.userData.kind = kind; d.visible = !!kind;
    if (kind) { d.material.color.set(DECAL[kind][0]); d.userData.base = DECAL[kind][1]; const m = DECAL[kind][2] ? outlineTex : decalTex; if (d.material.map !== m) { d.material.map = m; d.material.needsUpdate = true; } }
  }
}

/* --- pieces --- */
const bodyGeo = new THREE.LatheGeometry([[0, 0], [0.27, 0], [0.285, 0.035], [0.24, 0.075], [0.17, 0.13], [0.13, 0.27], [0.125, 0.37], [0.165, 0.47], [0.195, 0.53], [0.17, 0.59], [0.09, 0.625], [0, 0.63]].map(p => new THREE.Vector2(p[0], p[1])), 28);
const headGeo = new THREE.SphereGeometry(0.155, 22, 16), capGeo = new THREE.SphereGeometry(0.175, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
const steel = () => mat('steel', () => M('#c3c9d4', { metalness: 0.75, roughness: 0.32 })), gold = () => mat('gold', () => M('#e2b54a', { metalness: 0.7, roughness: 0.35 })), leather = () => mat('leather', () => M('#7a5232', { roughness: 0.8 }));
function bowMesh(color) { const b = mesh(new THREE.TorusGeometry(0.23, 0.017, 8, 20, Math.PI), M(color, { roughness: 0.6 })); b.rotation.set(0, Math.PI / 2, -Math.PI / 2); const s = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.46, 4), M('#efe7d6')); const g = new THREE.Group(); g.add(b, s); return g; }
function makePiece(type) {
  const T = TYPES[type], foe = T.team === 'foe', acc = ACCENT[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const wood = M(foe ? FOE_WOOD : CREW_WOOD, { map: woodTex, roughness: foe ? 0.38 : 0.5 }), cloth = M(acc, { roughness: 0.7, map: paintTex });
  g.userData = { wood, cloth, body, type };
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.06, 32), M(foe ? '#241a1c' : '#d9bd86', { map: woodTex, roughness: 0.5 }), 0, 0.03, 0));
  const ring = mesh(new THREE.TorusGeometry(0.335, 0.026, 8, 40), cloth, 0, 0.062, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  const nose = mesh(new THREE.ConeGeometry(0.07, 0.15, 3), cloth, 0, 0.045, 0.42); nose.rotation.x = Math.PI / 2; nose.scale.y = 1; g.add(nose);
  body.position.y = 0.06;
  body.add(mesh(bodyGeo, wood)); body.add(mesh(headGeo, wood, 0, 0.74, 0));
  const band = mesh(new THREE.CylinderGeometry(0.136, 0.172, 0.13, 24, 1, true), cloth, 0, 0.42, 0); body.add(band);
  const add = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); body.add(m); return m; };
  const sword = (len, x) => { const s = new THREE.Group(); s.add(mesh(new THREE.BoxGeometry(0.04, len, 0.018), steel(), 0, len / 2 + 0.06, 0), mesh(new THREE.BoxGeometry(0.15, 0.03, 0.035), gold(), 0, 0.06, 0), mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 8), leather(), 0, 0, 0)); return add(s, x, 0.3, 0.12, 0.25, 0, x > 0 ? -0.18 : 0.18); };
  if (type === 'knight') {
    add(mesh(capGeo, steel()), 0, 0.745, 0); add(mesh(new THREE.BoxGeometry(0.035, 0.13, 0.24), cloth), 0, 0.93, -0.01);
    const sh = add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 24), cloth), 0.21, 0.36, 0.15, Math.PI / 2, 0, 0.25); sh.add(mesh(new THREE.SphereGeometry(0.045, 12, 8), gold(), 0, 0.02, 0));
    sword(0.4, -0.25);
  } else if (type === 'archer' || type === 'bowman') {
    add(mesh(new THREE.ConeGeometry(0.2, 0.34, 20), cloth), 0, 0.86, -0.035, -0.32); add(bowMesh(foe ? '#6b4a3a' : '#8a5a34'), 0.23, 0.42, 0.13);
    add(mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.28, 10), leather()), -0.08, 0.5, -0.17, 0.35, 0, 0.3);
  } else if (type === 'mage') {
    add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 28), cloth), 0, 0.835, 0); add(mesh(new THREE.ConeGeometry(0.165, 0.42, 20), cloth), 0, 1.05, -0.02, -0.14);
    add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.9, 8), leather()), -0.27, 0.45, 0.1);
    const orb = add(mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9a2e', emissiveIntensity: 1.4 })), -0.27, 0.95, 0.1); orb.castShadow = false;
  } else if (type === 'cleric') {
    add(mesh(capGeo, M('#f6f1e4', { roughness: 0.9 })), 0, 0.75, 0); const halo = add(mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 28), gold()), 0, 1.0, 0, Math.PI / 2);
    add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.42, 8), leather()), -0.25, 0.42, 0.1, 0.2); add(mesh(new THREE.SphereGeometry(0.065, 12, 10), gold()), -0.25, 0.66, 0.145);
    add(mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), gold()), 0, 0.36, 0.17); add(mesh(new THREE.BoxGeometry(0.11, 0.035, 0.02), gold()), 0, 0.4, 0.172);
  } else if (type === 'raider') {
    add(mesh(capGeo, M('#4a4650', { metalness: 0.6, roughness: 0.45 })), 0, 0.745, 0);
    for (const s of [-1, 1]) add(mesh(new THREE.ConeGeometry(0.035, 0.17, 8), M('#e9e0cc', { roughness: 0.5 })), s * 0.17, 0.87, 0, 0, 0, -s * 0.75);
    const ax = new THREE.Group(); ax.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.5, 8), leather(), 0, 0.2, 0), mesh(new THREE.BoxGeometry(0.17, 0.15, 0.022), steel(), 0.07, 0.4, 0)); add(ax, -0.25, 0.28, 0.12, 0.2, 0, 0.15);
  } else if (type === 'captain') {
    add(mesh(capGeo, steel()), 0, 0.745, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(mesh(new THREE.ConeGeometry(0.03, 0.12, 6), gold()), Math.cos(a) * 0.13, 0.9, Math.sin(a) * 0.13); }
    add(mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.5, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshStandardMaterial({ color: acc, roughness: 0.75, side: THREE.DoubleSide, map: paintTex })), 0, 0.34, 0);
    sword(0.56, -0.27); const sh = add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 6), cloth), 0.22, 0.36, 0.15, Math.PI / 2, 0, 0.25); sh.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), gold(), 0, 0.02, 0));
    g.scale.setScalar(1.2);
  }
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 1.0, 10), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = 0.5; g.add(proxy); g.userData.proxy = proxy;
  return g;
}
const FACE_ROT = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
const pieceProxies = [];
function initDisplay(u) {
  if (u.piece) scene.remove(u.piece);
  const p = makePiece(u.type); u.piece = p; p.userData.proxy.userData.unit = u; pieceProxies.push(p.userData.proxy);
  p.position.copy(tileV(u.x, u.y)); p.rotation.y = FACE_ROT[u.facing]; u.rotY = p.rotation.y; u.shp = u.hp; u.gone = false; scene.add(p);
}
function clearPieces() { for (const u of G.units) if (u.piece) scene.remove(u.piece); pieceProxies.length = 0; }
function syncDisplay() {
  for (const u of G.units) { if (u.dead) { if (!u.gone && u.piece) { u.piece.visible = false; u.gone = true; } continue; }
    u.piece.position.copy(tileV(u.x, u.y)); u.shp = u.hp; turnTo(u, FACE_ROT[u.facing], true); }
}
function turnTo(u, target, snap) {
  let d = target - u.rotY; d = Math.atan2(Math.sin(d), Math.cos(d)); const from = u.rotY; u.rotY = from + d;
  if (snap || G.fast) { u.piece.rotation.y = u.rotY; return Promise.resolve(); }
  return tween(140, k => { u.piece.rotation.y = from + d * easeOut(k); });
}
function flashPiece(u, color) { const w = u.piece.userData.wood; w.emissive.set(color); tween(320, k => { w.emissiveIntensity = (1 - k) * 0.9; }); }

/* --- effects --- */
const partGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06), parts = [];
const partMat = { chip: M('#e2c58f', { roughness: 0.7 }), dark: M('#3a2c2e'), spark: new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }), heal: new THREE.MeshBasicMaterial({ color: '#9df0a5', toneMapped: false }) };
function burst(pos, kind, n, speed = 2.6) {
  if (G.fast) return;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, partMat[kind]); m.position.copy(pos); const a = rnd(0, 6.28), s = rnd(0.4, 1) * speed;
    m.userData = { vx: Math.cos(a) * s, vy: rnd(1.5, 4) * (kind === 'heal' ? 0.5 : 1), vz: Math.sin(a) * s, g: kind === 'heal' ? -1.5 : 11, t0: T, life: rnd(420, 760), spin: rnd(-9, 9) };
    m.scale.setScalar(rnd(0.6, 1.5)); scene.add(m); parts.push(m);
  }
}
const rings = [];
function ringFx(pos, color, r = 1.2, ms = 420) {
  if (G.fast) return;
  const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.03; m.renderOrder = 4;
  m.userData = { t0: T, ms, r }; scene.add(m); rings.push(m);
}
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb060', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); glowSprite.visible = false; scene.add(glowSprite);
const arrowMesh = (() => { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), M('#e9dcc0')); sh.rotation.x = Math.PI / 2; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), M('#c3c9d4', { metalness: 0.7, roughness: 0.3 })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.29; const fl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.09), M('#c8372d')); fl.position.z = -0.23; g.add(sh, tip, fl); g.visible = false; scene.add(g); return g; })();
const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false })); orbMesh.visible = false; scene.add(orbMesh);
async function projectile(kind, from, to, ms, arc) {
  if (G.fast) return;
  const arrow = kind === 'arrow', obj = arrow ? arrowMesh : orbMesh, col = kind === 'heal' ? '#8df0a0' : '#ffb060';
  obj.visible = true; if (!arrow) { orbMesh.material.color.set(kind === 'heal' ? '#d6ffd9' : '#ffe2a8'); orbMesh.scale.setScalar(kind === 'fireball' ? 1.7 : 1); glowSprite.visible = true; glowSprite.material.color.set(col); glowSprite.scale.setScalar(kind === 'fireball' ? 1.5 : 0.9); fxLight.color.set(col); }
  const prev = from.clone();
  await tween(ms, k => {
    const p = from.clone().lerp(to, k); p.y += Math.sin(Math.PI * k) * arc; obj.position.copy(p);
    if (arrow) obj.lookAt(p.clone().add(p.clone().sub(prev).normalize())); else { glowSprite.position.copy(p); fxLight.position.copy(p); fxLight.intensity = 2.2; if (Math.random() < 0.6) burst(p, kind === 'heal' ? 'heal' : 'spark', 1, 0.5); }
    prev.copy(p);
  });
  obj.visible = false; glowSprite.visible = false;
}
function lightPulse(pos, color, strength = 3, ms = 380) { if (G.fast) return; fxLight.color.set(color); fxLight.position.copy(pos); fxLight.position.y += 0.7; tween(ms, k => { fxLight.intensity = strength * (1 - k); }); }

/* --- post-processing: gentle tilt-shift, vignette, grain --- */
let rt = null;
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: { tD: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.56 }, uBlur: { value: 5 }, uTime: { value: 0 }, uFlash: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tD; uniform vec2 uRes; uniform float uFocus, uBlur, uTime; uniform vec3 uFlash;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      float d = abs(vUv.y - uFocus), r = uBlur * smoothstep(0.17, 0.52, d);
      vec3 c = vec3(0.);
      for (int i = 0; i < 14; i++) { float a = float(i) * 2.39996, rr = sqrt((float(i) + .5) / 14.) * r; c += texture2D(tD, vUv + vec2(cos(a), sin(a)) * rr / uRes).rgb; }
      c /= 14.;
      vec2 q = vUv - vec2(.5, uFocus); float v = smoothstep(1.05, .25, length(q * vec2(1.25, 1.)));
      c *= mix(.45, 1., v); c += uFlash * .35;
      c += (hash(vUv * uRes + uTime) - .5) * .028;
      gl_FragColor = vec4(c, 1.);
    }`, depthTest: false, depthWrite: false });
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

/* --- camera --- */
function resize() {
  const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
  view.w = r.width; view.h = r.height; view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(view.dpr); renderer.setSize(view.w, view.h, false);
  const pw = Math.round(view.w * view.dpr), ph = Math.round(view.h * view.dpr);
  if (rt) rt.dispose();
  rt = renderer.capabilities.isWebGL2 ? new THREE.WebGLMultisampleRenderTarget(pw, ph, { format: THREE.RGBAFormat }) : new THREE.WebGLRenderTarget(pw, ph);
  rt.texture.encoding = THREE.sRGBEncoding; if ('samples' in rt) rt.samples = 4;
  postMat.uniforms.tD.value = rt.texture; postMat.uniforms.uRes.value.set(pw, ph); postMat.uniforms.uBlur.value = 4.2 * view.dpr;
  const aspect = view.w / view.h, hfov = 0.42, vfov = Math.max(0.36, Math.min(0.95, 2 * Math.atan(Math.tan(hfov / 2) / aspect)));
  cam.fov = vfov * 180 / Math.PI; cam.aspect = aspect;
  view.vfov = vfov; view.aspect = aspect; view.avail = Math.max(0.3, (view.h - view.hudH - view.topH) / view.h);
  view.shift = (view.hudH - view.topH) / 2;
  postMat.uniforms.uFocus.value = 0.5 + view.shift / view.h;
  if (typeof onResize === 'function') onResize();
}
function updateCamera() {
  // keep the whole tray in frame at any rotation: its on-screen width depends on the angle
  const half = (W / 2 + 0.55) * (Math.abs(Math.cos(view.yaw)) + Math.abs(Math.sin(view.yaw))), halfV = half * Math.sin(view.pitch) + 1.1;
  view.fit = Math.max(half / (Math.tan(view.vfov / 2) * view.aspect), halfV / (Math.tan(view.vfov / 2) * view.avail));
  const d = view.fit * view.zoom, cp = Math.cos(view.pitch), s = view.shake;
  cam.position.set(view.target.x + Math.sin(view.yaw) * cp * d + rnd(-s, s), view.target.y + Math.sin(view.pitch) * d + rnd(-s, s), view.target.z + Math.cos(view.yaw) * cp * d);
  cam.lookAt(view.target); cam.setViewOffset(view.w, view.h, 0, view.shift, view.w, view.h); cam.updateMatrixWorld();
}
const projV = new THREE.Vector3();
function toScreen(v) { projV.copy(v).project(cam); return [(projV.x * 0.5 + 0.5) * view.w, (-projV.y * 0.5 + 0.5) * view.h]; }
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(px, py) { // -> { unit, tile }
  ndc.set(px / view.w * 2 - 1, -(py / view.h) * 2 + 1); raycaster.setFromCamera(ndc, cam);
  const hu = raycaster.intersectObjects(pieceProxies.filter(p => p.userData.unit && !p.userData.unit.gone))[0], ht = raycaster.intersectObjects(tileMeshes)[0];
  return { unit: hu ? hu.object.userData.unit : null, tile: ht ? ht.object.userData.tile : null, unitFirst: !!hu && (!ht || hu.distance < ht.distance) };
}

/* --- portraits rendered from the actual pieces --- */
function portrait(type) {
  const S = 128, prt = new THREE.WebGLRenderTarget(S, S); prt.texture.encoding = THREE.sRGBEncoding;
  const sc = new THREE.Scene(), foe = TYPES[type].team === 'foe'; sc.background = new THREE.Color(foe ? '#6e2a24' : '#2b4e6e');
  sc.add(new THREE.HemisphereLight('#ffffff', '#55463a', 0.5)); const dl = new THREE.DirectionalLight('#fff0d8', 0.75); dl.position.set(-2, 3, 4); sc.add(dl);
  const p = makePiece(type); p.rotation.y = 0.45; sc.add(p);
  const s = p.scale.x, c = new THREE.PerspectiveCamera(24, 1, 0.1, 20); c.position.set(0, 0.95 * s, 3.2 * s); c.lookAt(0, 0.66 * s, 0);
  renderer.setRenderTarget(prt); renderer.clear(); renderer.render(sc, c);
  const buf = new Uint8Array(S * S * 4); renderer.readRenderTargetPixels(prt, 0, 0, S, S, buf); renderer.setRenderTarget(null); prt.dispose();
  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = S; const g = cv2.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) img.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  g.putImageData(img, 0, 0); return cv2.toDataURL();
}

/* --- frame --- */
let hudRender = null, frameHook = null;
function frame(now) {
  const rdt = Math.min(50, now - (lastNow || now)); lastNow = now; const dt = now < freezeUntil ? 0 : rdt; T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i], k = Math.min(1, (T - t.t0) / t.ms); t.fn(k); if (k >= 1) { tweens.splice(i, 1); t.res(); } }
  const sdt = dt / 1000;
  for (let i = parts.length - 1; i >= 0; i--) { const m = parts[i], d = m.userData, k = (T - d.t0) / d.life; if (k >= 1) { scene.remove(m); parts.splice(i, 1); continue; }
    d.vy -= d.g * sdt; m.position.x += d.vx * sdt; m.position.y += d.vy * sdt; m.position.z += d.vz * sdt; m.rotation.x += d.spin * sdt; m.rotation.z += d.spin * sdt; const s = 1 - k * k; m.scale.setScalar(Math.max(0.05, s)); }
  for (let i = rings.length - 1; i >= 0; i--) { const m = rings[i], d = m.userData, k = (T - d.t0) / d.ms; if (k >= 1) { scene.remove(m); m.geometry.dispose(); rings.splice(i, 1); continue; } const s = d.r * easeOut(k); m.scale.set(s, s, s); m.material.opacity = 1 - k; }
  const pulse = 0.5 + 0.5 * Math.sin(now / 210);
  for (const d of decals) if (d.visible) d.material.opacity = d.userData.base * (d.userData.kind === 'hot' ? 0.7 + 0.3 * pulse : 0.85 + 0.15 * pulse);
  if (activeRing.visible) { const s = 1 + 0.06 * pulse; activeRing.scale.set(s, s, s); activeRing.material.opacity = 0.55 + 0.4 * pulse; }
  view.shake *= Math.pow(0.85, rdt / 16.7); if (view.shake < 0.002) view.shake = 0;
  const fl = postMat.uniforms.uFlash.value; fl.multiplyScalar(Math.pow(0.86, rdt / 16.7));
  postMat.uniforms.uTime.value = now % 1000;
  updateCamera();
  if (frameHook) frameHook(now, rdt);
  if (rt) {
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(postScene, postCam);
    if (hudRender) { renderer.clearDepth(); hudRender(now); }
  }
  requestAnimationFrame(frame);
}
