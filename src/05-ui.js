/* ===== flow, playback of rule events, touch input, the unit card (DOM or drawn into the scene) ===== */
const PIC = {};
const V = { mode: 'intro', active: null, busy: true, reach: null, range: null, rangeHot: null, target: null, preview: null, ability: null,
  inspect: null, threat: null, origin: null, hint: '', turnDone: null, started: false, gameId: 0, graves: { crew: 0, foe: 0 }, orderHtml: '' };
const app = $('app'), hud = $('hud'), labels = $('labels');
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
function say(msg) { V.hint = msg; refresh(); }
function clearSel() { V.reach = null; V.range = null; V.rangeHot = null; V.target = null; V.preview = null; V.ability = null; }
function banner(title, sub) { const b = $('banner'); b.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

/* --- labels over the pieces --- */
function makeLabel(u) {
  const d = document.createElement('div'); d.className = 'lab ' + u.team; d.innerHTML = '<span class="pv"></span><span class="bar"><i></i><b></b></span>';
  labels.appendChild(d); u.lab = d; u.labFill = d.querySelector('i'); u.labLoss = d.querySelector('b'); u.labPv = d.querySelector('.pv');
}
const headV = new THREE.Vector3();
function labelPos(u) { headV.copy(u.piece.position); headV.y += 1.18 * u.piece.scale.x; return toScreen(headV); }
function floatText(u, text, cls = '') {
  if (G.fast) return;
  const [x, y] = labelPos(u), d = document.createElement('div'), n = labels.querySelectorAll(`.float[data-u="${u.id}"]`).length;
  d.className = 'float ' + cls; d.dataset.u = u.id; d.textContent = text; d.style.left = x + 'px'; d.style.top = (y - 14 - n * 17) + 'px';
  labels.appendChild(d); setTimeout(() => d.remove(), 1000);
}
frameHook = (now, dt) => {
  if (V.mode === 'intro' && !V.started) view.yaw += dt * 0.00011;
  for (const u of G.units) {
    if (!u.lab) continue;
    if (u.gone) { if (!u.lab.hidden) u.lab.hidden = true; continue; }
    const [x, y] = labelPos(u); u.lab.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    let shown = Math.max(0, u.shp), loss = 0, pv = '', cls = '';
    if (V.mode === 'confirm' && V.preview) { const p = V.preview.find(p => p.u === u); if (p) { if (p.dhp < 0) { loss = Math.min(shown, -p.dhp); shown -= loss; } pv = (p.dhp > 0 ? '+' + p.dhp : '−' + (-p.dhp)) + (p.ko ? ' KO' : '') + (p.tags.length ? ' · ' + p.tags.join(' · ').toLowerCase() : ''); cls = p.dhp > 0 ? 'heal' : p.ko ? 'ko' : 'hit'; } }
    const w = (100 * shown / u.maxhp).toFixed(1) + '%', lw = (100 * loss / u.maxhp).toFixed(1) + '%';
    if (u._w !== w) { u._w = w; u.labFill.style.width = w; } if (u._lw !== lw) { u._lw = lw; u.labLoss.style.width = lw; }
    if (u._pv !== pv) { u._pv = pv; u.labPv.textContent = pv; u.labPv.className = 'pv ' + cls; }
    const act = u === V.active && !V.busy; if (u._act !== act) { u._act = act; u.lab.classList.toggle('act', act); }
  }
  const a = V.active; if (a && a.piece && !a.gone && !V.busy && V.turnDone) a.piece.position.y = topY(a.x, a.y) + 0.07 + 0.035 * Math.sin(now / 280);   // the piece in hand hovers
  hicFrame(now);
};

/* --- playing back what the rules engine decided --- */
function localDir(P, dir) { const c = Math.cos(P.rotation.y), s = Math.sin(P.rotation.y); return [dir.x * c - dir.z * s, dir.x * s + dir.z * c]; }
const TABLE_Y = -BASE - 0.32;
async function animEvent(e) {
  const u = e.u, P = u.piece, body = P.userData.body, s = P.scale.x;
  switch (e.t) {
    case 'cast': {
      const a = e.a, from = P.position.clone(), tgt = tileV(e.tx, e.ty);
      await turnTo(u, FACE_ROT[u.facing]);
      if (a.anim === 'melee') {
        Snd.play('whoosh'); const dir = tgt.clone().sub(from); dir.y = 0; dir.setLength(0.4);
        await tween(120, k => { P.position.copy(from).addScaledVector(dir, easeOut(k)); body.rotation.x = 0.4 * easeOut(k); });
        tween(210, k => { P.position.copy(from).addScaledVector(dir, 1 - easeIO(k)); body.rotation.x = 0.4 * (1 - easeIO(k)); });
      } else if (a.anim === 'spin') {
        Snd.play('whoosh'); ringFx(from, '#ffffff', 1.55, 380); const r0 = P.rotation.y;
        await tween(360, k => { P.rotation.y = r0 + Math.PI * 2 * easeIO(k); P.position.y = from.y + Math.sin(Math.PI * k) * 0.18; }); P.rotation.y = r0; P.position.y = from.y;
      } else {
        const src = from.clone(); src.y += 0.8 * s; const dst = tgt.clone(); dst.y += 0.5;
        await tween(110, k => { body.rotation.x = -0.24 * easeOut(k); }); tween(240, k => { body.rotation.x = -0.24 * (1 - k); });
        if (a.anim === 'arrow') { Snd.play('arrow'); await projectile('arrow', src, dst, 250, 0.5 + src.distanceTo(dst) * 0.1); Snd.play('thock'); }
        else if (a.anim === 'spark') { Snd.play('spark'); await projectile('spark', src, dst, 250, 0.5); lightPulse(tgt, '#ffb060', 2.5, 300); }
        else if (a.anim === 'fireball') { Snd.play('whoosh'); await projectile('fireball', src, dst, 430, 1.7); Snd.play('fire'); ringFx(tgt, '#ffb347', 1.95, 480); lightPulse(tgt, '#ff9040', 5, 560); burst(dst, 'spark', 24, 3.6); postMat.uniforms.uFlash.value.set(1, 0.55, 0.2); view.shake = 0.14; HIC.flash = 1; }
        else if (a.anim === 'heal') { await projectile('heal', src, dst, 360, 0.9); }
      }
      break;
    }
    case 'hit': {
      u.shp = e.hp; const big = e.amt >= 10; Snd.play('hit', big); flashPiece(u, e.fire ? '#ff9a40' : '#ffffff');
      const dir = P.position.clone().sub(e.from.piece.position); dir.y = 0; if (dir.lengthSq() < 0.001) dir.set(0, 0, 1); dir.normalize(); const [lx, lz] = localDir(P, dir);
      tween(620, k => { const A = (big ? 0.5 : 0.36) * Math.exp(-4.2 * k) * Math.cos(k * 17); body.rotation.x = A * lz; body.rotation.z = -A * lx; }).then(() => { body.rotation.x = 0; body.rotation.z = 0; });
      const hp = P.position.clone(); hp.y += 0.55 * s; burst(hp, u.team === 'foe' ? 'dark' : 'chip', big ? 10 : 6);
      floatText(u, '−' + e.amt, (e.fire ? 'fire ' : '') + (big ? 'big' : '')); for (const t of e.tags) floatText(u, t, 'tag');
      view.shake = Math.max(view.shake, Math.min(0.13, e.amt * 0.008)); if (e.amt >= 8) hitStop(big ? 70 : 40);
      refresh(); await wait(320); break;
    }
    case 'heal': {
      u.shp = e.hp; Snd.play('heal'); const hp = P.position.clone(); hp.y += 0.4; burst(hp, 'heal', 14, 1.1); lightPulse(P.position, '#7df29a', 2.6, 500); ringFx(P.position, '#9df0a5', 0.9, 480);
      floatText(u, '+' + e.amt, 'heal'); refresh(); await wait(420); break;
    }
    case 'ko': {
      u.gone = true; Snd.play('topple');
      const dir = P.position.clone().sub(e.from.piece.position); dir.y = 0; if (dir.lengthSq() < 0.001) dir.set(0, 0, 1); dir.normalize();
      const axis = new THREE.Vector3(dir.z, 0, -dir.x), q0 = P.quaternion.clone(), qd = new THREE.Quaternion(), y0 = P.position.y, p0 = P.position.clone();
      await tween(400, k => { const a = Math.min(1, k * k * 1.1) * 1.5; qd.setFromAxisAngle(axis, a); P.quaternion.copy(qd).multiply(q0); P.position.copy(p0).addScaledVector(dir, 0.22 * k); P.position.y = y0 + Math.sin(a) * 0.27 * s; });
      await wait(330);
      const n = V.graves[u.team]++, dest = new THREE.Vector3(u.team === 'foe' ? -2.3 + n * 0.95 : 3.7 - n * 0.95, TABLE_Y + 0.3 * s, H / 2 + 1.2);   // set aside in front of the tray
      const qa = P.quaternion.clone(), qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 + rnd(-0.3, 0.3), Math.PI / 2)), pa = P.position.clone();
      await tween(460, k => { const kk = easeIO(k); P.position.lerpVectors(pa, dest, kk); P.position.y = lerp(pa.y, dest.y, kk) + Math.sin(Math.PI * k) * 1.5; THREE.Quaternion.slerp(qa, qb, P.quaternion, kk); });
      Snd.play('aside'); refresh(); break;
    }
  }
}
async function playSteps(steps) { for (const st of steps) await Promise.all(st.map(animEvent)); syncDisplay(); refresh(); }
async function animateMove(u, node) {
  const path = []; for (let n = node; n.prev; n = n.prev) path.unshift(n);
  let cx = u.x, cy = u.y; u.x = node.x; u.y = node.y; const P = u.piece;
  for (const n of path) {
    const a = tileV(cx, cy), b = tileV(n.x, n.y), hop = 0.26 + Math.abs(b.y - a.y) * 0.5; u.facing = dirTo(cx, cy, n.x, n.y); turnTo(u, FACE_ROT[u.facing]);
    await tween(150, k => { P.position.lerpVectors(a, b, easeIO(k)); P.position.y = lerp(a.y, b.y, k) + Math.sin(Math.PI * k) * hop; });
    Snd.play('step'); cx = n.x; cy = n.y;
  }
  P.position.copy(tileV(u.x, u.y));
}

/* --- the turn loop --- */
function finish(result) {
  G.over = true; G.result = result; V.mode = 'over'; V.active = null; V.busy = true; clearSel(); V.inspect = null; V.threat = null; refresh();
  const win = result === 'win', standing = G.units.filter(u => u.team === 'crew' && !u.dead).length;
  Snd.play(win ? 'win' : 'lose');
  const stars = win ? 1 + (standing === 4 ? 1 : 0) + (G.turns <= PAR_TURNS ? 1 : 0) : 0;
  $('outroEyebrow').textContent = win ? 'Alder Ford is yours' : 'The ford is lost';
  $('outroTitle').textContent = win ? 'Well played.' : 'Set them up again.';
  $('outroText').textContent = win ? 'The Ebony company is back in its box. Three stars for keeping all four pieces standing and finishing under par.' : 'Every Boxwood piece is off the board. Hold the bridge with Rowan and let Wren shoot from the hill.';
  $('stars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
  $('stats').innerHTML = `<div><b>${G.felled}/${TOTAL_FOES}</b>pieces taken</div><div><b>${standing}/4</b>still standing</div><div><b>${G.turns}</b>turns · par ${PAR_TURNS}</div>`;
  setTimeout(() => { $('outro').hidden = false; }, G.fast ? 0 : 1100);
}
async function aiTurn(u) {
  V.busy = true; V.mode = 'enemy'; clearSel(); say(`${u.name} is moving.`);
  await wait(260);
  const c = aiChoose(u);
  if (c.n && c.n.d > 0) { await animateMove(u, c.n); u.moved = true; await wait(70); }
  if (c.a) { say(`${u.name} · ${c.a.name}`); const R = resolve(u, c.a, c.tx, c.ty); await playSteps(R.steps); }
  await wait(90);
}
function playerTurn(u) { return new Promise(res => { V.turnDone = res; V.busy = false; V.origin = { x: u.x, y: u.y, facing: u.facing }; V.hint = ''; setMode('move'); }); }
function endPlayerTurn() { const f = V.turnDone; V.turnDone = null; V.busy = true; clearSel(); V.mode = 'wait'; V.hint = ''; refresh(); if (f) f(); }
async function run(gid) {
  while (gid === V.gameId) {
    const s = checkState(); if (s) { finish(s); return; }
    const e = pickNext(); V.active = e; V.inspect = null; V.threat = null; startOfTurn(e); refresh();
    if (e.team === 'foe' || G.auto) await aiTurn(e); else await playerTurn(e);
    if (G.over || gid !== V.gameId) return;
    if (!e.dead) { finishTurn(e); await turnTo(e, FACE_ROT[e.facing]); }
    syncDisplay();
  }
}
function newGame() {
  clearPieces(); labels.innerHTML = ''; setupGame(G.seed);
  for (const u of G.units) { initDisplay(u); makeLabel(u); }
  Object.assign(V, { mode: 'wait', active: null, busy: true, inspect: null, threat: null, hint: '', turnDone: null, gameId: V.gameId + 1, graves: { crew: 0, foe: 0 } });
  clearSel(); tweens.length = 0; refresh(); return V.gameId;
}

/* --- player controls --- */
function setMode(m) {
  const u = V.active; clearSel(); V.mode = m;
  if (m === 'move') { if (!u.moved) V.reach = reachable(u); else V.mode = 'menu'; }
  refresh();
}
const myTurn = () => !!(V.active && V.active.team === 'crew' && !V.busy && !G.auto && V.turnDone);
function inspect(u) {
  if (!u || u === V.inspect) { V.inspect = null; V.threat = null; return; }
  V.inspect = u; V.threat = null; Snd.play('tap');
  if (u.team === 'foe') { const th = new Map(), r = reachable(u); for (const n of r.values()) if (!n.occupied) for (const t of rangeTiles(u.abil[0], u, n.x, n.y).values()) th.set(key(t.x, t.y), 1); V.threat = th; }
}
function chooseAbility(a) {
  const u = V.active; if (!myTurn()) return;
  if (u.acted || (a.cd && u.cd > 0)) { Snd.play('nope'); return; }
  if (V.ability === a && (V.mode === 'target' || V.mode === 'confirm')) { V.hint = ''; return setMode('move'); }
  clearSel(); V.inspect = null; V.threat = null; V.ability = a; V.mode = 'target'; Snd.play('tap');
  V.range = rangeTiles(a, u, u.x, u.y); V.rangeHot = new Set();
  for (const t of V.range.values()) if (hasEffect(a, u, t.x, t.y)) V.rangeHot.add(key(t.x, t.y));
  if (a.shape === 'ring') { if (V.rangeHot.size) return pickTarget(u.x, u.y); clearSel(); V.mode = u.moved ? 'menu' : 'move'; if (!u.moved) V.reach = reachable(u); Snd.play('nope'); return say('No enemy is next to ' + u.name + '.'); }
  say(V.rangeHot.size ? '' : (a.kind === 'heal' ? 'Nobody in reach needs healing.' : `Nothing in reach for ${a.name}. Tap away to cancel.`));
}
function pickTarget(x, y) {
  const u = V.active, a = V.ability;
  if (!hasEffect(a, u, x, y)) { Snd.play('nope'); V.target = null; V.preview = null; V.mode = 'target'; return say(a.kind === 'heal' ? 'Nobody there needs healing.' : 'Nothing to hit there.'); }
  Snd.play('pick');
  V.target = { x, y, tiles: areaTiles(a, u.x, u.y, x, y) }; V.preview = previewAction(u, a, x, y); V.mode = 'confirm';
  say(V.preview.map(p => `${p.u.name} ${p.dhp > 0 ? '+' : '−'}${Math.abs(p.dhp)}${p.ko ? ' KO' : ''}`).join(' · '));
}
async function confirmAbility() {
  if (V.mode !== 'confirm' || V.busy) return;
  const u = V.active, a = V.ability, t = V.target, gid = V.gameId;
  V.busy = true; clearSel(); V.mode = 'anim'; V.hint = ''; refresh();
  const R = resolve(u, a, t.x, t.y); await playSteps(R.steps);
  if (gid !== V.gameId) return;
  if (checkState() || u.dead || u.moved) return endPlayerTurn();
  V.busy = false; V.origin = null; setMode('move');
}
async function doMove(n) {
  const u = V.active; V.busy = true; V.reach = null; V.inspect = null; V.threat = null; V.hint = ''; refresh();
  await animateMove(u, n); u.moved = true;
  if (u.acted) return endPlayerTurn();
  V.busy = false; setMode('menu');
}
function onTap(px, py) {
  const hit = pick(px, py), u = V.active, t = hit.tile, w = hit.unit || (t && unitAt(t.x, t.y)) || null;
  if (!myTurn()) { if (V.mode !== 'intro' && !G.over) { inspect(w); refresh(); } return; }
  if (V.mode === 'target' || V.mode === 'confirm') {
    const tt = hit.unit && V.rangeHot.has(key(hit.unit.x, hit.unit.y)) ? { x: hit.unit.x, y: hit.unit.y } : t;
    if (tt && V.mode === 'confirm' && V.target.x === tt.x && V.target.y === tt.y) return confirmAbility();
    if (tt && V.range.has(key(tt.x, tt.y))) return pickTarget(tt.x, tt.y);
    Snd.play('tap'); V.hint = ''; return setMode('move');
  }
  if (w && w.team === 'foe' && !u.acted) { const a = u.abil[0]; if (rangeTiles(a, u, u.x, u.y).has(key(w.x, w.y))) { chooseAbility(a); if (V.ability === a) pickTarget(w.x, w.y); return; } }
  const n = t && V.reach && V.reach.get(key(t.x, t.y));
  if (n && n.d > 0 && !n.occupied && V.mode === 'move' && !(hit.unitFirst && hit.unit.team === 'foe')) return doMove(n);
  inspect(w && w !== u ? w : null); refresh();
}
const ptrs = new Map(); let drag = null, pinch = null;
canvas.addEventListener('pointerdown', e => {
  if (e.target !== canvas) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) drag = { sx: e.clientX, sy: e.clientY, moved: false };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: view.zoom }; if (drag) drag.moved = true; }
});
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; view.zoom = Math.max(0.5, Math.min(1.35, pinch.z * pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1))); }
  else if (ptrs.size === 1 && drag) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 9) drag.moved = true;
    if (drag.moved && !pinch) { view.yaw -= (e.clientX - prev.x) * 0.0075; view.pitch = Math.max(0.5, Math.min(1.3, view.pitch + (e.clientY - prev.y) * 0.005)); }
  }
});
function pointerUp(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size === 0) { if (drag && !drag.moved && e.type === 'pointerup') { const r = canvas.getBoundingClientRect(); onTap(e.clientX - r.left, e.clientY - r.top); } drag = null; pinch = null; } else pinch = null;
}
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('wheel', e => { if (e.target !== canvas) return; e.preventDefault(); view.zoom = Math.max(0.5, Math.min(1.35, view.zoom * (e.deltaY < 0 ? 0.92 : 1.08))); }, { passive: false });

/* --- HUD --- */
function refresh() {
  setDecals((x, y) => {
    const K = key(x, y);
    if (V.target && V.target.tiles.some(([a, b]) => a === x && b === y)) return solid(x, y) ? null : 'area';
    if (V.range && V.range.has(K)) return V.rangeHot.has(K) ? 'hot' : 'range';
    if (V.reach && V.mode === 'move') { const n = V.reach.get(K); if (n && n.d > 0 && !n.occupied) return 'move'; }
    if (V.threat && V.threat.has(K)) return 'threat';
    return null;
  });
  const a = V.active, mine = myTurn();
  activeRing.visible = !!a && !a.dead && !V.busy && V.mode !== 'intro';
  if (activeRing.visible) { activeRing.position.copy(tileV(a.x, a.y, 0.02)); activeRing.material.color.set(a.team === 'foe' ? '#ff9c94' : '#ffffff'); }
  const fc = (V.mode === 'intro' || G.over) ? [] : forecast(7, a && !a.dead ? a : null);
  const oh = fc.map((e, i) => `<span class="chip ${e.team}${i === 0 ? ' now' : ''}${e === V.inspect ? ' sel' : ''}"><img alt="${e.name}" src="${PIC[e.type]}"></span>`).join('');
  if (oh !== V.orderHtml) { V.orderHtml = oh; $('order').innerHTML = oh; }
  const u = V.inspect || a || G.units[0];
  if (u) {
    $('uPic').src = PIC[u.type]; hud.dataset.team = u.team;
    $('uName').textContent = u.name; $('uCls').textContent = u.cls;
    const hp = Math.max(0, u.shp ?? u.hp); $('hpFill').style.width = (100 * hp / u.maxhp) + '%'; $('hpTxt').textContent = `${hp} / ${u.maxhp}`;
    $('uStats').innerHTML = u.team === 'foe' ? `<b>${u.abil[0].name}</b> ${u.abil[0].info} &nbsp;·&nbsp; Move ${u.move}` : `Move ${u.move} &nbsp;·&nbsp; Jump ${u.jump} &nbsp;·&nbsp; ${TYPES[u.type].blurb}`;
  }
  let hint = V.hint;
  if (!hint && mine && a.acted) hint = 'Move if you like, or end the turn.';
  if (!hint && mine) hint = { move: 'Tap a blue tile to move, or tap an enemy in reach to attack.', menu: 'Pick an action, or end the turn.', target: 'Tap a glowing tile to aim.' }[V.mode] || '';
  if (!hint && V.inspect && V.inspect.team === 'foe') hint = 'Purple tiles are where it can strike next turn.';
  $('hint').textContent = hint;
  $('actRow').hidden = V.mode === 'confirm'; $('confRow').hidden = V.mode !== 'confirm';
  const p = a && a.team === 'crew' ? a : G.units.find(x => x.team === 'crew' && !x.dead) || G.units[0];
  if (p && p.abil.length > 1) {
    [[$('bAtk'), p.abil[0]], [$('bSkl'), p.abil[1]]].forEach(([b, ab]) => {
      const cooling = !!(ab.cd && p.cd > 0);
      b.firstElementChild.textContent = ab.name; b.lastElementChild.textContent = cooling ? `ready in ${p.cd} turn${p.cd > 1 ? 's' : ''}` : ab.info;
      b.disabled = !mine || p.acted || cooling; b.classList.toggle('on', mine && V.ability === ab);
    });
    $('bUndo').disabled = !mine || !(p.moved && !p.acted && V.origin); $('bEnd').disabled = !mine;
  }
  hicDirty();
}
$('bAtk').onclick = () => V.active && chooseAbility(V.active.abil[0]);
$('bSkl').onclick = () => V.active && chooseAbility(V.active.abil[1]);
$('bUndo').onclick = () => { const u = V.active; if (!myTurn() || !(u.moved && !u.acted && V.origin)) return; Snd.play('tap'); u.x = V.origin.x; u.y = V.origin.y; u.facing = V.origin.facing; u.moved = false; syncDisplay(); V.hint = ''; setMode('move'); };
$('bEnd').onclick = () => { if (myTurn()) { Snd.play('tap'); endPlayerTurn(); } };
$('bOk').onclick = confirmAbility;
$('bCancel').onclick = () => { if (myTurn()) { Snd.play('tap'); V.hint = ''; setMode('move'); } };
$('bSnd').onclick = () => { $('bSnd').innerHTML = Snd.toggle() ? ICON_ON : ICON_OFF; };
$('bHelp').onclick = () => { $('startBtn').firstElementChild.textContent = V.started ? 'Back to the board' : 'Set the board'; $('intro').hidden = false; };
function begin(id) { V.mode = 'wait'; const y0 = view.yaw, y1 = y0 + Math.atan2(Math.sin(0.3 - y0), Math.cos(0.3 - y0)); tween(900, k => { view.yaw = lerp(y0, y1, easeIO(k)); }); banner('Alder Ford', 'Take every Ebony piece off the board.'); run(id); }
$('startBtn').onclick = () => { Snd.start(); $('intro').hidden = true; app.classList.remove('pre'); if (!V.started) { V.started = true; begin(V.gameId); } };
$('againBtn').onclick = () => { Snd.start(); $('outro').hidden = true; begin(newGame()); };

/* --- HTML-in-Canvas: when the browser can do it, the unit card is real HTML drawn as a lit card inside the scene --- */
const HIC = { on: false, api: null, tex: null, props: null, need: false, ok: false, geo: null, w: 0, h: 0, until: 0, flash: 0, sig: 3, cfg: null, err: null };
const hudScene = new THREE.Scene(), hudCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50), hudGroup = new THREE.Group(); hudScene.add(hudGroup);
const cardMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uTexel: { value: new THREE.Vector2(0.002, 0.004) }, uLight: { value: new THREE.Vector3(0, 0.3, 1) }, uSweep: { value: 0 }, uFlash: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D map; uniform vec2 uTexel; uniform vec3 uLight, uFlash; uniform float uSweep;
    float lum(vec2 p){ return dot(texture2D(map, p).rgb, vec3(.3, .59, .11)); }
    void main(){
      vec2 uv = vec2(vUv.x, 1. - vUv.y); vec4 t = texture2D(map, uv);
      float l0 = lum(uv); vec3 n = normalize(vec3((l0 - lum(uv + vec2(uTexel.x, 0.))) * 1.8, (lum(uv + vec2(0., uTexel.y)) - l0) * 1.8, 1.));  // ink is pressed slightly into the paper
      float diff = clamp(dot(n, normalize(uLight)), 0., 1.);
      vec3 flat_ = t.rgb / max(t.a, .001);
      float foil = smoothstep(.22, .07, distance(flat_, vec3(.831, .627, .090)));                                  // the one gold in the stylesheet becomes foil
      float band = pow(.5 + .5 * sin((uv.x * 2.2 + uv.y * 1.1) * 3.14159 + uSweep), 4.);
      vec3 base = mix(flat_, mix(vec3(.48, .32, .07), vec3(1., .95, .72), band), foil);
      float grain = fract(sin(dot(floor(uv / uTexel * .5), vec2(12.9898, 78.233))) * 43758.5453) - .5;
      vec3 c = base * (.80 + .36 * diff) + base * uFlash * .5 + grain * .02 + band * .03;
      gl_FragColor = vec4(c * t.a, t.a);
    }`, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false });
const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cardMat);
const cardShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: '#000', transparent: true, opacity: 0.7, depthTest: false, depthWrite: false }));
hudGroup.add(cardShadow, cardMesh);
function hicProbe() {
  try {
    const cp = HTMLCanvasElement.prototype, cur = typeof gl.texElementSubImage2D === 'function' && 'updateElementGeometry' in cp, old = typeof gl.texElementImage2D === 'function';
    return ('requestPaint' in cp) && (cur || old) ? (cur ? 'new' : 'old') : null;
  } catch (e) { return null; }
}
function hicUpload() {
  const p = HIC.props, W2 = HIC.w, H2 = HIC.h, dpr = Math.min(2, window.devicePixelRatio || 1); let tw, th;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.__webglTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  try {
    if (HIC.api === 'new') {
      tw = Math.round(W2 * dpr); th = Math.round(H2 * dpr); let done = false;
      if (HIC.cfg !== false) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        try { const probing = HIC.cfg === null; if (probing) while (gl.getError()) { } gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, hud, { width: tw, height: th }); done = !probing || gl.getError() === 0; if (probing) HIC.cfg = done; }
        catch (err) { if (err instanceof TypeError || HIC.cfg === null) HIC.cfg = false; else throw err; }
      }
      if (!done) { const s = canvas.getElementImageDefaultSize ? canvas.getElementImageDefaultSize(hud) : { width: tw, height: th }; tw = Math.max(1, Math.round(s.width)); th = Math.max(1, Math.round(s.height)); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, hud); }
    } else {
      if (HIC.sig === 3) { try { gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, hud); } catch (err) { if (err instanceof TypeError) HIC.sig = 6; else throw err; } }
      if (HIC.sig === 6) gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, hud);
      tw = Math.round(W2 * (window.devicePixelRatio || 1)); th = Math.round(H2 * (window.devicePixelRatio || 1));
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    cardMat.uniforms.uTexel.value.set(1 / tw, 1 / th); HIC.ok = true; HIC.need = false;
  } catch (err) { HIC.err = String(err); }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); renderer.resetState();
  if (HIC.err) hicOff();
}
function hicSetMatrix(m) {
  const k = m.map(v => +v.toFixed(4)).join(); if (k === HIC.lastM) return; HIC.lastM = k;
  if (HIC.api === 'new' && HIC.geo !== 'css') {
    try {
      canvas.updateElementGeometry(hud, { canvasTransform: new DOMMatrix(m) });
      if (HIC.geo === null) { const r = hud.getBoundingClientRect(), c = canvas.getBoundingClientRect(); HIC.geo = Math.abs(r.left - c.left - m[4]) < 3 && Math.abs(r.top - c.top - m[5]) < 3 ? 'geo' : 'css'; if (HIC.geo === 'css') { try { canvas.updateElementGeometry(hud, { canvasTransform: new DOMMatrix() }); } catch (err) { } } }
      if (HIC.geo === 'geo') return;
    } catch (err) { HIC.geo = 'css'; }
  }
  hud.style.transform = `matrix(${k})`;
}
function hicLayout() { // size the card so one CSS pixel is about one screen pixel, then tell the browser where it ended up
  if (!HIC.on) return;
  const d = 4, vh = 2 * d * Math.tan(hudCam.fov * Math.PI / 360), upp = vh / view.h, cw = HIC.w * upp, ch = HIC.h * upp;
  hudCam.aspect = view.w / view.h; hudCam.updateProjectionMatrix(); hudCam.updateMatrixWorld();
  cardMesh.scale.set(cw, ch, 1); cardMesh.position.set(0, ch / 2, 0); cardShadow.scale.set(cw * 1.3, ch * 1.5, 1); cardShadow.position.set(0, ch * 0.42, -0.02);
  hudGroup.position.set(0, -vh / 2 + 14 * upp, -d); hudGroup.rotation.x = -0.2; hudGroup.updateMatrixWorld(true);
  const P = (x, y) => { const v = new THREE.Vector3(x, y, 0); hudGroup.localToWorld(v); v.project(hudCam); return [(v.x * 0.5 + 0.5) * view.w, (-v.y * 0.5 + 0.5) * view.h]; };
  const C = P(0, ch / 2), L = P(-cw / 2, ch / 2), R = P(cw / 2, ch / 2), Tp = P(0, ch), B = P(0, 0);
  const a = (R[0] - L[0]) / HIC.w, b = (R[1] - L[1]) / HIC.w, c = (B[0] - Tp[0]) / HIC.h, dd = (B[1] - Tp[1]) / HIC.h;
  hicSetMatrix([a, b, c, dd, C[0] - a * HIC.w / 2 - c * HIC.h / 2, C[1] - b * HIC.w / 2 - dd * HIC.h / 2]);
}
function hicDirty() { if (HIC.on) { HIC.need = true; HIC.until = performance.now() + 420; canvas.requestPaint(); } }
function hicFrame(now) {
  if (!HIC.on) return;
  if (now < HIC.until) canvas.requestPaint();
  const L = keyLight.position.clone().normalize().transformDirection(cam.matrixWorldInverse); cardMat.uniforms.uLight.value.set(L.x, L.y, Math.max(0.25, L.z) + 0.55);
  cardMat.uniforms.uSweep.value = view.yaw * 4 + view.pitch * 3;
  HIC.flash *= 0.9; cardMat.uniforms.uFlash.value.set(HIC.flash, HIC.flash * 0.55, HIC.flash * 0.2);
}
function hicOn() {
  HIC.api = hicProbe(); if (!HIC.api || HIC.on) return false;
  HIC.w = hud.offsetWidth; HIC.h = hud.offsetHeight; if (!HIC.w || !HIC.h) return false;
  try {
    if (!HIC.tex) { HIC.tex = new THREE.Texture(); HIC.props = renderer.properties.get(HIC.tex); HIC.props.__webglTexture = gl.createTexture(); HIC.props.__webglInit = true; cardMat.uniforms.map.value = HIC.tex; }
    hud.style.width = HIC.w + 'px'; hud.setAttribute('drawable', ''); hud.classList.add('inworld'); canvas.appendChild(hud);
    HIC.on = true; HIC.ok = false; HIC.err = null; HIC.lastM = null; HIC.geo = null;
    hudRender = () => { if (HIC.ok && V.started) renderer.render(hudScene, hudCam); };
    hicLayout(); hicDirty();
    setTimeout(() => { if (HIC.on && !HIC.ok) hicOff(); }, 2500);   // never leave the player without a menu
    return true;
  } catch (err) { HIC.err = String(err); hicOff(); return false; }
}
function hicOff() {
  HIC.on = false; hudRender = null; hud.classList.remove('inworld'); hud.removeAttribute('drawable'); hud.style.transform = ''; hud.style.width = ''; app.appendChild(hud);
  const t = $('hicToggle'); if (t) t.checked = false;
}
canvas.addEventListener('paint', e => {
  if (!HIC.on) return;
  const changed = e.changedElements ? [...e.changedElements] : null;
  if (HIC.need || !HIC.ok || !changed || changed.includes(hud)) hicUpload();
});
var onResize = () => {
  if (HIC.on) { hud.style.width = Math.min(view.w - 24, 420) + 'px'; HIC.w = hud.offsetWidth; HIC.h = hud.offsetHeight; HIC.lastM = null; hicLayout(); hicDirty(); }
  view.hudH = (HIC.on ? HIC.h : hud.offsetHeight) + 26;
};

/* --- boot --- */
for (const t in TYPES) PIC[t] = portrait(t);
app.classList.add('pre');
$('bSnd').innerHTML = Snd.on ? ICON_ON : ICON_OFF;
newGame(); V.mode = 'intro';
new ResizeObserver(() => { resize(); }).observe(canvas);
resize(); view.hudH = hud.offsetHeight + 26; resize(); refresh();
let hicPref = true; try { hicPref = localStorage.getItem('bwt.inworld') !== 'off'; } catch (e) {}
if (hicProbe()) {
  $('hicRow').hidden = false; $('hicToggle').checked = hicPref;
  $('hicToggle').onchange = ev => { const want = ev.target.checked; try { localStorage.setItem('bwt.inworld', want ? 'on' : 'off'); } catch (e) {} if (want) hicOn(); else hicOff(); resize(); refresh(); };
  const go = () => { if (hicPref) { hicOn(); resize(); refresh(); } };
  (document.fonts && document.fonts.ready ? document.fonts.ready.then(go) : Promise.resolve().then(go));
}
requestAnimationFrame(frame);
window.__game = { G, V, view, Snd, HIC, api: { aiChoose, tileV, toScreen } };
