/* ===== the diorama, 32-bit style: low-resolution render, orthographic camera, sprite characters ===== */
const $ = id => document.getElementById(id);
const canvas = $('cv');
const STEP = 0.5, BOTTOM = -1.5, ELEV = Math.PI / 6;   // 30 degrees gives 2:1 tiles
let OFFX = (W - 1) / 2, OFFZ = (H - 1) / 2;
const topY = (x, y) => kindAt(x, y) === 'w' ? -0.14 : kindAt(x, y) === 'f' ? -0.06 : hAt(x, y) * STEP;
const tileV = (x, y, up = 0) => new THREE.Vector3(x - OFFX, topY(x, y) + up, y - OFFZ);
const lerp = (a, b, k) => a + (b - a) * k, easeOut = k => 1 - Math.pow(1 - k, 3), easeIO = k => k * k * (3 - 2 * k), rnd = (a, b) => a + Math.random() * (b - a);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding; renderer.autoClear = false;
const scene = new THREE.Scene(), bgScene = new THREE.Scene(), postScene = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 140);
const view = { yaw: Math.PI / 4, turning: false, w: 1, h: 1, gw: 1, gh: 1, s: 1, ppu: 20, css: 1, shiftPx: 0, shake: 0, hudH: 250, topH: 56, target: new THREE.Vector3(0, 0.3, 0) };
const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camBack = new THREE.Vector3();

/* --- time, tweens --- */
const tweens = []; let T = 0, lastNow = 0, freezeUntil = 0;
const tween = (ms, fn) => new Promise(res => { if (G.fast || ms <= 0) { fn(1); res(); } else tweens.push({ t0: T, ms: ms * (G.speed || 1), fn, res }); });
const wait = ms => tween(ms, () => {});
function hitStop(ms) { if (!G.fast) freezeUntil = Math.max(freezeUntil, performance.now() + ms); }

/* --- textures and materials --- */
function tex(c, repeat) { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.encoding = THREE.sRGBEncoding; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const mats = {};
const mat = (name, make) => mats[name] || (mats[name] = make());
const basic = (o) => new THREE.MeshBasicMaterial(o);
function pxCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return c; }
const fillTex = tex(pxCanvas(16, 16, g => { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 0, 16, 16); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 15, 15); }));
const dashTex = tex(pxCanvas(16, 16, g => { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 16; i++) if (i % 4 < 2) { g.fillRect(i, 0, 1, 1); g.fillRect(i, 15, 1, 1); g.fillRect(0, i, 1, 1); g.fillRect(15, i, 1, 1); } }));
const cornerTex = tex(pxCanvas(16, 16, g => { g.fillStyle = '#fff'; for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) { g.fillRect(x, y === 0 ? 0 : 15, 5, 1); g.fillRect(x === 0 ? 0 : 15, y, 1, 5); } }));
const blobTex = tex(pxCanvas(16, 16, g => { g.fillStyle = 'rgba(8,8,24,.42)'; g.beginPath(); g.arc(8, 8, 6.5, 0, 7); g.fill(); }));
const glowTex = tex(pxCanvas(32, 32, g => { const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,.4)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 32, 32); }));
const stillTex = tex(pxCanvas(7, 9, g => { g.fillStyle = OUTL; g.fillRect(0, 0, 7, 9); g.fillStyle = '#bfe6ff'; g.fillRect(1, 1, 5, 1); g.fillRect(1, 7, 5, 1); g.fillRect(2, 2, 3, 1); g.fillRect(3, 3, 1, 3); g.fillRect(2, 6, 3, 1); g.fillStyle = '#5aa8ff'; g.fillRect(2, 6, 3, 1); g.fillRect(3, 5, 1, 1); }));
const arrowTex = tex(pxCanvas(9, 8, g => { g.fillStyle = OUTL; g.fillRect(0, 0, 9, 4); g.fillRect(1, 4, 7, 2); g.fillRect(3, 6, 3, 2); g.fillStyle = '#ffd24a'; g.fillRect(1, 1, 7, 2); g.fillRect(2, 3, 5, 1); g.fillRect(3, 4, 3, 1); g.fillRect(4, 5, 1, 2); g.fillStyle = '#fff3b0'; g.fillRect(1, 1, 7, 1); }));

/* --- backdrop: a dithered dusk gradient, like the void those old maps floated in --- */
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { uRes: { value: new THREE.Vector2(1, 1) } }, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform vec2 uRes;
    float b2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
    float b4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
    vec3 ramp(float t){ vec3 a = vec3(.043, .055, .157), b = vec3(.102, .149, .353), c = vec3(.208, .322, .561), d = vec3(.420, .565, .741);
      return t < .4 ? mix(a, b, t / .4) : t < .75 ? mix(b, c, (t - .4) / .35) : mix(c, d, (t - .75) / .25); }
    void main(){ float t = 1. - vUv.y, steps = 14.; t = floor(t * steps + b4(vUv * uRes) - .5 + .5) / steps; gl_FragColor = vec4(ramp(clamp(t, 0., 1.)), 1.); }` })));
let rt = null;
const postMat = new THREE.ShaderMaterial({ uniforms: { tD: { value: null }, uFlash: { value: new THREE.Vector3() } }, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: 'precision highp float; varying vec2 vUv; uniform sampler2D tD; uniform vec3 uFlash; void main(){ gl_FragColor = vec4(texture2D(tD, vUv).rgb + uFlash * .3, 1.); }' });
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

/* --- terrain: one box per tile, turf on top, cliff on the sides. Rebuilt for each chapter. --- */
const tileMeshes = [], decals = [], levelObjs = [], levelTex = [];
const waterTex = tex(tileTop('w', 11), true);
const SHADE = [0.8, 0.95, 1, 0.3, 0.64, 0.86];   // +x, -x, top, bottom, +z, -z
function buildLevel() {
  for (const o of levelObjs) scene.remove(o); for (const t of levelTex) t.dispose(); for (const b of propBoards) dropBoard(b);
  levelObjs.length = levelTex.length = propBoards.length = tileMeshes.length = decals.length = 0;
  OFFX = (W - 1) / 2; OFFZ = (H - 1) / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = kindAt(x, y), ty = topY(x, y), hgt = ty - BOTTOM, rows = Math.round(hgt * 16), sk = k + rows;
    const sideTex = mat('st' + sk, () => tex(tileSide(k, rows, rows * 7 + k.charCodeAt(0))));
    const side = i => mat('sm' + sk + i, () => basic({ map: sideTex, color: new THREE.Color().setScalar(SHADE[i]) }));
    const lift = k === 'w' ? 1 : 0.9 + hAt(x, y) * 0.035, tt = k === 'w' ? waterTex : tex(tileTop(k, x * 31 + y * 17 + 3)); if (k !== 'w') levelTex.push(tt);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, hgt, 1), [side(0), side(1), basic({ map: tt, color: new THREE.Color().setScalar(lift) }), mat('under', () => basic({ color: '#0b0e28' })), side(4), side(5)]);
    m.position.set(x - OFFX, ty - hgt / 2, y - OFFZ); m.userData.tile = { x, y }; scene.add(m); tileMeshes.push(m); levelObjs.push(m);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: fillTex, transparent: true, depthWrite: false, opacity: 0 }));
    d.rotation.x = -Math.PI / 2; d.position.set(x - OFFX, ty + 0.012, y - OFFZ); d.visible = false; d.renderOrder = 2; scene.add(d); decals[y * W + x] = d; levelObjs.push(d);
  }
  for (const k in PROPS) { const [x, y] = k.split(',').map(Number); addProp(PROPS[k], x, y); }
}
const propBoards = [], PROP_ART = { tree: (x, y) => drawTree(x * 7 + y), rock: drawRock, house: (x, y) => drawHouse(x + y), bell: drawBell, pillar: drawPillar, table: drawTable };
function addProp(kind, x, y) { const c = PROP_ART[kind](x, y), b = board(tex(c), c.width, c.height); b.userData.anchor.copy(tileV(x, y)); propBoards.push(b); return b; }
const DECAL = { move: ['#3f7bff', 0.9], range: ['#ffb02e', 0.95, 1], hot: ['#ff3d3d', 1], area: ['#ffe14a', 1], threat: ['#c06bff', 0.95, 1] };   // third value: dashed outline instead of a filled tile
function setDecals(fn) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = decals[y * W + x], kind = fn ? fn(x, y) : null; d.userData.kind = kind; d.visible = !!kind;
    if (kind) { d.material.color.set(DECAL[kind][0]); d.userData.base = DECAL[kind][1]; const m = DECAL[kind][2] ? dashTex : fillTex; if (d.material.map !== m) { d.material.map = m; d.material.needsUpdate = true; } }
  }
}
const cursorTile = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: cornerTex, transparent: true, depthWrite: false })); cursorTile.rotation.x = -Math.PI / 2; cursorTile.visible = false; cursorTile.renderOrder = 3; scene.add(cursorTile);

/* --- billboards: anything flat that always faces the camera, kept on whole pixels --- */
const boards = [];
function board(texture, wpx, hpx, opts = {}) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, basic(Object.assign({ map: texture, alphaTest: 0.5 }, opts.mat)));
  m.userData = { wpx, hpx, anchor: new THREE.Vector3(), roll: 0, sx: 0, sy: 0, lift: opts.lift ?? 0.3, snap: opts.snap !== false };
  boards.push(m); scene.add(m); return m;
}
function dropBoard(m) { const i = boards.indexOf(m); if (i >= 0) boards.splice(i, 1); scene.remove(m); }
const projV = new THREE.Vector3(), rollQ = new THREE.Quaternion(), ZAXIS = new THREE.Vector3(0, 0, 1);
function placeBoards() {
  for (const m of boards) {
    const d = m.userData; if (!m.visible) continue;
    m.scale.set(d.wpx / view.ppu, d.hpx / view.ppu, 1); m.quaternion.copy(cam.quaternion); if (d.roll) m.quaternion.multiply(rollQ.setFromAxisAngle(ZAXIS, d.roll));
    m.position.copy(d.anchor).addScaledVector(camBack, d.lift);
    let ox = d.sx, oy = d.sy;
    if (d.snap && !view.turning) { projV.copy(d.anchor).project(cam); const fx = (projV.x * 0.5 + 0.5) * view.gw, fy = (-projV.y * 0.5 + 0.5) * view.gh; ox += Math.round(fx) - fx; oy += Math.round(fy) - fy; }
    m.position.addScaledVector(camRight, ox / view.ppu).addScaledVector(camUp, -oy / view.ppu);
  }
}
const cursorArrow = board(arrowTex, 9, 8, { lift: 0.6 }); cursorArrow.visible = false; cursorArrow.renderOrder = 5;

/* --- units --- */
const ATLAS = {}; for (const t in KIT) { const a = spriteAtlas(t); ATLAS[t] = { tex: tex(a.atlas), white: tex(a.white), canvas: a.atlas }; }
const pieceProxies = [], stageUnits = [];   // stageUnits: characters who stand in a scene without being in the battle
function setFrame(u, f, mirror) {
  if (u.frame === f && u.mir === mirror) return; u.frame = f; u.mir = mirror;
  const uv = u.sprite.geometry.attributes.uv, u0 = f / 4, u1 = (f + 1) / 4, a = mirror ? u1 : u0, b = mirror ? u0 : u1;
  uv.setXY(0, a, 1); uv.setXY(1, b, 1); uv.setXY(2, a, 0); uv.setXY(3, b, 0); uv.needsUpdate = true;
}
function initDisplay(u) {
  dropUnit(u);
  u.sprite = board(ATLAS[u.type].tex, SW, SH); u.sprite.material = basic({ map: ATLAS[u.type].tex, alphaTest: 0.5 }); u.sprite.userData.unit = u; pieceProxies.push(u.sprite);
  u.icon = board(stillTex, 7, 9, { lift: 0.5 }); u.icon.visible = false; u.icon.renderOrder = 5; u.dStill = !!u.stilled;
  u.pos = tileV(u.x, u.y); u.sprite.userData.anchor = u.pos; u.icon.userData.anchor = u.pos; u.icon.userData.sx = 9; u.icon.userData.sy = -(SH - 6); u.groundY = u.pos.y; u.frame = -1; u.shp = u.hp; u.gone = false; u.stepping = false; u.spin = 0;
  u.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), mat('blob', () => basic({ map: blobTex, transparent: true, depthWrite: false }))); u.shadow.rotation.x = -Math.PI / 2; u.shadow.renderOrder = 1; scene.add(u.shadow);
}
function dropUnit(u) { if (u.sprite) { const i = pieceProxies.indexOf(u.sprite); if (i >= 0) pieceProxies.splice(i, 1); dropBoard(u.sprite); dropBoard(u.icon); scene.remove(u.shadow); u.sprite = null; } }
function clearPieces() { for (const u of G.units) dropUnit(u); pieceProxies.length = 0; }
function syncDisplay() { for (const u of G.units) { if (!u.sprite) continue; if (u.dead) { if (!u.gone) { u.gone = true; u.sprite.visible = false; u.shadow.visible = false; } u.icon.visible = false; continue; } u.pos.copy(tileV(u.x, u.y)); u.groundY = u.pos.y; u.shp = u.hp; u.dStill = u.stilled; u.sprite.userData.sx = 0; u.sprite.userData.roll = 0; } }
function flashPiece(u, ms = 110) { if (G.fast) return; u.sprite.material.map = ATLAS[u.type].white; setTimeout(() => { u.sprite.material.map = ATLAS[u.type].tex; }, ms); }
function updateUnits(now) {
  const fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);   // from the board toward the camera, on the ground
  for (const u of G.units.concat(stageUnits)) {
    if (!u.sprite || u.gone) continue;
    const f = u.spin ? (u.facing + u.spin) % 4 : u.facing, dx = DX[f], dz = DY[f];
    const front = dx * fx + dz * fz > 0, right = dx * fz - dz * fx > 0;   // art is drawn facing screen-left
    const beat = u.stepping ? 130 : 540, idle = Math.floor(now / beat + u.id * 0.37) % 2;
    setFrame(u, (front ? 0 : 2) + idle, right);
    u.shadow.position.set(u.pos.x, u.groundY + 0.014, u.pos.z); u.icon.visible = !!u.dStill && u.sprite.visible;
  }
}

/* --- effects --- */
const partGeo = new THREE.BoxGeometry(1, 1, 1), parts = [];
const partMat = { hit: basic({ color: '#fff6c8' }), dark: basic({ color: '#ffd9a0' }), spark: basic({ color: '#ffb347' }), heal: basic({ color: '#9df0a5' }), white: basic({ color: '#ffffff' }), frost: basic({ color: '#bfe6ff' }), gold: basic({ color: '#ffd24a' }) };
function burst(pos, kind, n, speed = 2.6) {
  if (G.fast) return;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, partMat[kind]); m.position.copy(pos); const a = rnd(0, 6.28), s = rnd(0.4, 1) * speed, px = (Math.random() < 0.4 ? 2 : 1) / view.ppu;
    m.userData = { vx: Math.cos(a) * s, vy: rnd(1.5, 4.2) * (kind === 'heal' ? 0.5 : 1), vz: Math.sin(a) * s, g: kind === 'heal' ? -1.5 : 11, t0: T, life: rnd(380, 700) };
    m.scale.setScalar(px * 1.4); m.renderOrder = 6; scene.add(m); parts.push(m);
  }
}
const rings = [];
function ringFx(pos, color, r = 1.2, ms = 420) {
  if (G.fast) return;
  const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 24), basic({ color, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.03; m.renderOrder = 4;
  m.userData = { t0: T, ms, r }; scene.add(m); rings.push(m);
}
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb060', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); glowSprite.visible = false; glowSprite.renderOrder = 7; scene.add(glowSprite);
const arrowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.55), basic({ color: '#f6f1dc' })); arrowMesh.visible = false; scene.add(arrowMesh);
const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), basic({ color: '#ffe2a8' })); orbMesh.visible = false; scene.add(orbMesh);
async function projectile(kind, from, to, ms, arc) {
  if (G.fast) return;
  const arrow = kind === 'arrow', obj = arrow ? arrowMesh : orbMesh, col = kind === 'heal' ? '#8df0a0' : kind === 'frost' ? '#7fc8ff' : kind === 'chime' ? '#ffd24a' : '#ffb060';
  obj.visible = true; if (!arrow) { orbMesh.material.color.set(kind === 'heal' ? '#e2ffe4' : kind === 'frost' ? '#e6f6ff' : '#fff0c0'); orbMesh.scale.setScalar(kind === 'fireball' ? 1.8 : 1); glowSprite.visible = true; glowSprite.material.color.set(col); glowSprite.scale.setScalar(kind === 'fireball' ? 1.5 : 0.9); }
  const prev = from.clone();
  await tween(ms, k => {
    const p = from.clone().lerp(to, k); p.y += Math.sin(Math.PI * k) * arc; obj.position.copy(p);
    if (arrow) obj.lookAt(p.clone().add(p.clone().sub(prev).normalize())); else { glowSprite.position.copy(p); if (Math.random() < 0.7) burst(p, kind === 'heal' ? 'heal' : kind === 'frost' ? 'frost' : kind === 'chime' ? 'gold' : 'spark', 1, 0.5); }
    prev.copy(p);
  });
  obj.visible = false; glowSprite.visible = false;
}
function flash(r, g, b) { if (!G.fast) postMat.uniforms.uFlash.value.set(r, g, b); }

/* --- camera --- */
function resize() {
  const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
  const dpr = window.devicePixelRatio || 1, devW = Math.round(r.width * dpr), devH = Math.round(r.height * dpr);
  let s = Math.max(1, Math.round(devW / 270)); s = Math.max(1, Math.min(s, Math.floor(devH / 320)));   // device pixels per game pixel
  Object.assign(view, { w: r.width, h: r.height, s, gw: Math.ceil(devW / s), gh: Math.ceil(devH / s) }); view.css = r.width / view.gw;
  renderer.setPixelRatio(1); renderer.setSize(view.gw * s, view.gh * s, false);
  if (rt) rt.dispose();
  rt = new THREE.WebGLRenderTarget(view.gw, view.gh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); rt.texture.encoding = THREE.sRGBEncoding;
  postMat.uniforms.tD.value = rt.texture; bgScene.children[0].material.uniforms.uRes.value.set(view.gw, view.gh);
  const hudPx = view.hudH / view.css, topPx = view.topH / view.css, avail = Math.max(120, view.gh - hudPx - topPx);
  const span = W + H, tw = Math.max(16, 2 * Math.floor(Math.min((view.gw - 4) / span, (avail - 30) / (span * 0.725))));   // tile width in game pixels; the board is (W+H)/2 tiles wide on screen
  view.ppu = tw / Math.SQRT2; view.shiftPx = Math.round(view.gh / 2 - (topPx + avail * 0.56));
  cam.left = -view.gw / 2 / view.ppu; cam.right = -cam.left; cam.top = view.gh / 2 / view.ppu; cam.bottom = -cam.top; cam.updateProjectionMatrix();
  if (typeof onResize === 'function') onResize();
}
function updateCamera() {
  const ce = Math.cos(ELEV);
  camBack.set(Math.sin(view.yaw) * ce, Math.sin(ELEV), Math.cos(view.yaw) * ce);
  cam.position.copy(view.target).addScaledVector(camBack, 60); cam.lookAt(view.target);
  camRight.set(1, 0, 0).applyQuaternion(cam.quaternion); camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
  const sh = view.shake > 0.3 ? Math.round(rnd(-view.shake, view.shake)) : 0, sv = view.shake > 0.3 ? Math.round(rnd(-view.shake, view.shake)) : 0;
  cam.position.addScaledVector(camUp, (-view.shiftPx + sv) / view.ppu).addScaledVector(camRight, sh / view.ppu); cam.updateMatrixWorld();
}
function rotateBoard(dir) {
  if (view.turning) return; view.turning = true; const y0 = view.yaw; Snd.play('turn');
  tween(320, k => { view.yaw = y0 + dir * Math.PI / 2 * easeIO(k); }).then(() => { view.yaw = Math.atan2(Math.sin(view.yaw), Math.cos(view.yaw)); view.turning = false; });
}
function toScreen(v) { projV.copy(v).project(cam); return [(projV.x * 0.5 + 0.5) * view.w, (-projV.y * 0.5 + 0.5) * view.h]; }
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(px, py) {
  ndc.set(px / view.w * 2 - 1, -(py / view.h) * 2 + 1); raycaster.setFromCamera(ndc, cam);
  // the sprites themselves are the hit targets, minus the empty columns at their sides
  const hu = raycaster.intersectObjects(pieceProxies.filter(p => !p.userData.unit.gone)).find(h => { const lu = (h.uv.x * 4) % 1; return lu > 0.12 && lu < 0.88; }), ht = raycaster.intersectObjects(tileMeshes)[0];
  return { unit: hu ? hu.object.userData.unit : null, tile: ht ? ht.object.userData.tile : null, unitFirst: !!hu && (!ht || hu.distance < ht.distance) };
}
function portrait(type) { // two crops of the standing sprite: whole figure, and the head for the turn-order strip
  const src = ATLAS[type].canvas, full = pxCanvas(SW, SH, g => g.drawImage(src, 0, 0)), head = pxCanvas(16, 16, g => g.drawImage(src, 4, 5, 16, 16, 0, 0, 16, 16));
  return { full: full.toDataURL(), head: head.toDataURL() };
}

/* --- frame --- */
let frameHook = null, waterT = 0;
function frame(now) {
  const rdt = Math.min(50, now - (lastNow || now)); lastNow = now; const dt = now < freezeUntil ? 0 : rdt; T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i], k = Math.min(1, (T - t.t0) / t.ms); t.fn(k); if (k >= 1) { tweens.splice(i, 1); t.res(); } }
  const sdt = dt / 1000;
  for (let i = parts.length - 1; i >= 0; i--) { const m = parts[i], d = m.userData, k = (T - d.t0) / d.life; if (k >= 1) { scene.remove(m); parts.splice(i, 1); continue; } d.vy -= d.g * sdt; m.position.x += d.vx * sdt; m.position.y += d.vy * sdt; m.position.z += d.vz * sdt; }
  for (let i = rings.length - 1; i >= 0; i--) { const m = rings[i], d = m.userData, k = (T - d.t0) / d.ms; if (k >= 1) { scene.remove(m); m.geometry.dispose(); rings.splice(i, 1); continue; } const s = d.r * easeOut(k); m.scale.set(s, s, s); m.material.opacity = 1 - k; }
  const blink = Math.floor(now / 260) % 2, pulse = 0.5 + 0.5 * Math.sin(now / 200);
  for (const d of decals) if (d.visible) d.material.opacity = d.userData.base * (d.userData.kind === 'hot' ? 0.6 + 0.4 * blink : d.userData.kind === 'move' ? 0.72 + 0.2 * pulse : 0.9);
  if (now - waterT > 300) { waterT = now; waterTex.offset.x = (waterTex.offset.x + 1 / 16) % 1; if (Math.random() < 0.5) waterTex.offset.y = (waterTex.offset.y + 1 / 16) % 1; }
  view.shake *= Math.pow(0.82, rdt / 16.7);
  postMat.uniforms.uFlash.value.multiplyScalar(Math.pow(0.8, rdt / 16.7));
  updateCamera(); updateUnits(now);
  if (frameHook) frameHook(now, rdt);
  placeBoards();
  if (rt) {
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(bgScene, flatCam); renderer.clearDepth(); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(postScene, flatCam);
  }
  requestAnimationFrame(frame);
}
