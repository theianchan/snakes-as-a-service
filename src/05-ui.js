/* ===== flow, animation of rule events, touch input, HUD ===== */
const PIC = {};
const FLAME = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2c1 4 5 5.500 5 10.500A5 5 0 0 1 7 12.500c0-2 1-3 1.500-4.500C10 9.500 11 7 12 2z"/></svg>';
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.500 9.500l5 5M21.500 9.500l-5 5"/></svg>';
function say(msg) { V.hint = msg; hud(); }
function clearSel() { V.reach = null; V.range = null; V.rangeHot = null; V.target = null; V.preview = null; V.ability = null; }
function banner(title, sub) {
  const b = $('banner'); b.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

/* --- playing back what the rules engine decided --- */
async function shot(kind, sx, sy, ex, ey, ms = 270, arc = 30) {
  const s = { kind, x: sx, y: sy, rot: 0 }; FX.shots.push(s);
  await tween(ms, k => { s.x = lerp(sx, ex, k); s.y = lerp(sy, ey, k) - Math.sin(Math.PI * k) * arc; s.rot = k * 9; });
  FX.shots.splice(FX.shots.indexOf(s), 1);
}
const ctr = (x, y, up = 0) => { const [cx, cy] = tileTop(x, y); return [cx, cy - up]; };
async function koAnim(u) {
  const [x, y] = world(u.px, u.py, u.pz);
  if (u.team === 'foe') {
    const col = SPIRIT_COL[u.type], cap = { x, y: y - 4, s: 0.1, color: col };
    Snd.play('pop');
    await tween(360, k => { u.scale = 1 - k * 0.95; u.rot = k * 5; u.alpha = 1 - k * 0.5; });
    u.gone = true; u.rot = 0; FX.caps.push(cap); motes(x, y - 16, col, 10); Snd.play('cork');
    await tween(220, k => { cap.s = 0.1 + easeOut(k) * 1.5; cap.y = y - 4 - Math.sin(Math.PI * k) * 10; });
    const slot = V.shelfN++, [sx, sy] = slotPos(slot); hud();
    tween(520, k => { const e = k * k * (3 - 2 * k); cap.x = lerp(x, sx, e); cap.y = lerp(y - 4, sy, e) - Math.sin(Math.PI * k) * 40; cap.s = lerp(1.6, 0.8, k); })
      .then(() => { FX.caps.splice(FX.caps.indexOf(cap), 1); V.shelf[slot] = u.type; });
    await wait(140);
  } else {
    Snd.play('down'); floatText(u, 'OUT COLD', '#ff8f8f', 12);
    await tween(420, k => { u.rot = k * 1.5; u.alpha = 1 - k; }); u.gone = true; u.rot = 0;
  }
}
async function animEvent(e) {
  const u = e.u;
  switch (e.t) {
    case 'cast': {
      const a = e.a;
      if (a.anim === 'melee' || a.anim === 'shove') {
        const amt = a.anim === 'shove' ? 0.5 : 0.36; Snd.play('whoosh');
        await tween(110, k => { u.px = lerp(e.fx, e.tx, k * amt); u.py = lerp(e.fy, e.ty, k * amt); });
        tween(170, k => { u.px = lerp(e.fx, e.tx, amt * (1 - k)); u.py = lerp(e.fy, e.ty, amt * (1 - k)); });
      } else if (a.anim === 'cube') { Snd.play('charge'); const [x, y] = world(u.px, u.py, u.pz); ring(x, y - 30, '#ffb347', 44, 520); await wait(380); }
      else if (a.anim !== 'vault') {
        Snd.play('whoosh'); const [sx, sy] = world(u.px, u.py, u.pz + 32), [ex, ey] = ctr(e.tx, e.ty, 14);
        await shot(a.anim, sx, sy, ex, ey);
      }
      break;
    }
    case 'vault': {
      Snd.play('whoosh'); const fx = u.px, fy = u.py, z0 = u.pz, z1 = hAt(e.lx, e.ly) * EH, dir = (e.lx - fx) - (e.ly - fy) >= 0 ? 1 : -1;
      await tween(340, k => { u.px = lerp(fx, e.lx, k); u.py = lerp(fy, e.ly, k); u.pz = lerp(z0, z1, k); u.hop = Math.sin(Math.PI * k) * 32; u.rot = k * Math.PI * 2 * dir; });
      u.hop = 0; u.rot = 0; const [x, y] = ctr(e.lx, e.ly); dust(x, y, 5); break;
    }
    case 'impact': {
      const a = e.a, [x, y] = ctr(e.tx, e.ty, 14);
      if (a.anim === 'bottle') { Snd.play('glass'); shards(x, y, 7, '#bfe8cf'); drops(x, y, 8); }
      else if (a.anim === 'tray') { Snd.play('glass'); drops(x, y, 8, '#ffcf7a'); sparks(x, y, '#d4dae3', 5); }
      else if (a.anim === 'spit') { Snd.play('splash'); drops(x, y, 9, '#e8c33f'); }
      else if (a.fire) { Snd.play('fire'); cam.flash = 0.22; cam.shake = Math.max(cam.shake, 5); for (const [tx, ty] of e.tiles) { const [cx, cy] = ctr(tx, ty); flames(cx, cy - 4, 12, 14); } ring(x, y + 14, '#ff8a3c', 54, 420); }
      else ring(x, y, '#fff', 16, 220);
      break;
    }
    case 'hit': {
      u.shp = e.hp; const big = e.amt >= 10, [x, y] = world(u.px, u.py, u.pz); Snd.play('hit', big);
      u.flashCol = e.fire ? '#ffb347' : '#fff'; tween(300, k => { u.flash = 1 - k; }); tween(260, k => { u.shakeX = Math.sin(k * 28) * 4 * (1 - k); });
      if (e.fire) { flames(x, y - 18, e.ignited ? 18 : 7, 8); if (e.ignited) u.dSoaked = false; } else sparks(x, y - 20, u.team === 'foe' ? '#eafff5' : '#ffd9a0', big ? 10 : 6);
      floatText(u, '−' + e.amt, e.fire ? '#ffb347' : (u.team === 'foe' ? '#fff' : '#ff9d9d'), big ? 20 : 15);
      if (e.tag) floatText(u, { IGNITED: 'IGNITED!', BACK: 'BACKSTAB', SIDE: 'FLANK', HIGH: 'HIGH GROUND' }[e.tag] || e.tag, e.tag === 'IGNITED' ? '#ff8a3c' : '#ffe27a', 10);
      cam.shake = Math.max(cam.shake, Math.min(9, e.amt * 0.45)); if (e.amt >= 8) hitStop(big ? 70 : 40);
      hud(); await wait(300); break;
    }
    case 'status': {
      if (e.soaked) { u.dSoaked = true; const [x, y] = world(u.px, u.py, u.pz); drops(x, y - 22, 6); floatText(u, 'SOAKED', '#7fd0ff', 10); }
      if (e.stun) { u.dStun = true; Snd.play('stun'); floatText(u, 'STUNNED', '#ffe27a', 11); }
      await wait(120); break;
    }
    case 'heal': {
      u.shp = e.hp; if (e.dried) u.dSoaked = false; const [x, y] = world(u.px, u.py, u.pz);
      motes(x, y - 10, '#8be28b', e.aura ? 5 : 12); Snd.play('heal');
      if (e.amt) floatText(u, '+' + e.amt, '#8be28b', e.aura ? 12 : 16); if (e.dried) floatText(u, 'DRY', '#7fd0ff', 10);
      hud(); await wait(e.aura ? 280 : 380); break;
    }
    case 'push': {
      let cx = u.px, cy = u.py;
      for (const s of e.path) {
        const z0 = u.pz, z1 = hAt(s.x, s.y) * EH, fx = cx, fy = cy;
        await tween(s.drop ? 180 : 95, k => { u.px = lerp(fx, s.x, k); u.py = lerp(fy, s.y, k); u.pz = lerp(z0, z1, k * k); });
        cx = s.x; cy = s.y; const [x, y] = ctr(s.x, s.y); dust(x, y, s.drop ? 8 : 3);
        if (s.drop) { Snd.play('thud'); cam.shake = Math.max(cam.shake, 3 + s.drop * 2); }
      }
      if (e.bump) { const bx = cx + DX[e.dir] * 0.3, by = cy + DY[e.dir] * 0.3; Snd.play('thud'); await tween(70, k => { u.px = lerp(cx, bx, k); u.py = lerp(cy, by, k); }); await tween(90, k => { u.px = lerp(bx, cx, k); u.py = lerp(by, cy, k); }); }
      break;
    }
    case 'explode': { u.gone = true; Snd.play('boom'); const [x, y] = ctr(e.x, e.y); flames(x, y - 8, 26, 18); shards(x, y - 10, 12, '#b07a3c'); smoke(x, y - 10, 8); ring(x, y, '#ffb347', 72, 480); cam.flash = 0.34; cam.shake = 11; hitStop(70); await wait(160); break; }
    case 'flare': {
      const [x, y] = ctr(e.x, e.y); if (!e.keg) { Snd.play('fire'); flames(x, y - 10, 14, 10); ring(x, y, '#ff8a3c', 50, 380); }
      for (let i = 0; i < 4; i++) { const nx = e.x + DX[i], ny = e.y + DY[i]; if (inb(nx, ny)) { const [a, b] = ctr(nx, ny); flames(a, b - 2, 5, 10); } }
      await wait(140); break;
    }
    case 'ko': await koAnim(u); break;
    case 'counter': { floatText(u, 'COUNTER', '#ffe27a', 11); const t = e.target, fx = u.px, fy = u.py; await tween(100, k => { u.px = lerp(fx, t.px, k * 0.35); u.py = lerp(fy, t.py, k * 0.35); }); tween(140, k => { u.px = lerp(fx, t.px, 0.35 * (1 - k)); u.py = lerp(fy, t.py, 0.35 * (1 - k)); }); break; }
    case 'encore': { Snd.play('encore'); floatText(u, 'ENCORE!', '#ffd36b', 17); const [x, y] = world(u.px, u.py, u.pz); ring(x, y, '#ffd36b', 42, 500); motes(x, y - 10, '#ffd36b', 10); await wait(420); break; }
    case 'charge': { u.dCharge = true; await wait(350); break; }
    case 'fizzle': { u.dCharge = false; const [x, y] = world(u.px, u.py, u.pz); smoke(x, y - 60, 10); floatText(u, 'INTERRUPTED', '#7fd0ff', 11); await wait(200); break; }
    case 'cubeland': {
      const p = e.p, o = G.units.find(q => q.id === p.owner), [ex, ey] = ctr(p.tx, p.ty, 6);
      const [sx, sy] = o && !o.gone ? world(o.px, o.py, o.pz + 70) : [ex, ey - 160]; if (o) o.dCharge = false;
      Snd.play('whoosh'); await shot('cube', sx, sy, ex, ey, 420, 60); Snd.play('boom'); cam.flash = 0.3; cam.shake = 9;
      for (const [x, y] of e.tiles) { const [cx, cy] = ctr(x, y); flames(cx, cy - 4, 14, 14); } ring(ex, ey, '#ff8a3c', 66, 460); await wait(120); break;
    }
  }
}
async function playSteps(steps) {
  for (const st of steps) {
    const kos = st.filter(e => e.t === 'ko');
    await Promise.all(st.filter(e => e.t !== 'ko').map(animEvent));
    if (kos.length) await Promise.all(kos.map(animEvent));
  }
  syncDisplay(); hud();
}
async function animateMove(u, node) {
  const path = []; for (let n = node; n.prev; n = n.prev) path.unshift(n);
  let cx = u.x, cy = u.y; u.x = node.x; u.y = node.y;
  for (const n of path) {
    const z0 = hAt(cx, cy) * EH, z1 = hAt(n.x, n.y) * EH, fx = cx, fy = cy; u.facing = dirTo(cx, cy, n.x, n.y); Snd.play('step');
    await tween(u.type === 'fairy' ? 90 : 118, k => { u.px = lerp(fx, n.x, k); u.py = lerp(fy, n.y, k); u.pz = lerp(z0, z1, k); u.hop = Math.sin(Math.PI * k) * (5 + Math.abs(z1 - z0) * 0.55); });
    cx = n.x; cy = n.y;
  }
  u.px = u.x; u.py = u.y; u.pz = hAt(u.x, u.y) * EH; u.hop = 0;
}
function focusOn(u) {
  const [wx, wy] = world(u.px, u.py, u.pz), sx = cam.x + wx * cam.z, sy = cam.y + (wy - 20) * cam.z, mx = cam.w * 0.14, my = cam.h * 0.16;
  const dx = sx < mx ? mx - sx : sx > cam.w - mx ? cam.w - mx - sx : 0, dy = sy < my ? my - sy : sy > cam.h - my ? cam.h - my - sy : 0;
  if (dx || dy) { const x0 = cam.x, y0 = cam.y; tween(260, k => { cam.x = x0 + dx * easeOut(k); cam.y = y0 + dy * easeOut(k); }); }
}

/* --- the turn loop --- */
async function doWave2() {
  V.busy = true; clearSel(); hud(); await wait(350);
  const [fx, fy] = tileTop(5, 1);
  Snd.play('boss'); Snd.mood(1); cam.shake = 14; V.cracked = true; shards(fx, fy - 18, 22, '#9ff5c5'); motes(fx, fy - 18, '#6fe3a1', 20); ring(fx, fy - 10, '#6fe3a1', 96, 700);
  banner('The Green Fairy is loose', 'When she lights a sugar cube, clear the glowing tiles before it lands.');
  const us = spawnWave2();
  for (const u of us) { initDisplay(u); u.alpha = 0; u.scale = 0.2; }
  await Promise.all(us.map((u, i) => wait(i * 130).then(() => tween(480, k => { u.alpha = k; u.scale = 0.2 + 0.8 * easeOut(k); }))));
  for (const u of us) { u.alpha = 1; u.scale = 1; }
  hud(); await wait(1000);
}
function finish(result) {
  G.over = true; G.result = result; V.mode = 'over'; V.active = null; V.busy = true; clearSel(); V.inspect = null; V.threat = null; hud();
  const win = result === 'win', standing = G.units.filter(u => u.team === 'crew' && !u.dead).length, par = 24;
  Snd.play(win ? 'win' : 'lose');
  const stars = win ? 1 + (standing === 4 ? 1 : 0) + (G.turns <= par ? 1 : 0) : 0;
  $('outroEyebrow').textContent = win ? 'Every bottle corked' : 'The spirits win this round';
  $('outroTitle').textContent = win ? 'Last call, on your terms.' : 'They drank the bar dry.';
  $('outroText').textContent = win ? 'The back bar is quiet again. Stools up, lights down, and nobody mentions the absinthe.' : 'The crew is out cold and the Green Fairy is doing shots off the piano. Try a different opening.';
  $('stars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
  $('stats').innerHTML = `<div><b>${V.shelfN}/${TOTAL_FOES}</b>bottled</div><div><b>${standing}/4</b>crew standing</div><div><b>${G.turns}</b>turns · par ${par}</div><div><b>${G.bestChain}</b>most bottled in one move</div>`;
  setTimeout(() => { $('outro').hidden = false; }, G.fast ? 0 : 900);
}
async function settle() { // after anything that changes the board
  for (;;) { const s = checkState(); if (s === 'wave2') { await doWave2(); continue; } if (s) { finish(s); return true; } return false; }
}
async function aiTurn(u) {
  V.busy = true; V.mode = 'enemy'; clearSel(); hud();
  await wait(240);
  for (let k = 0; k < 6; k++) {
    const c = aiChoose(u);
    if (c.n && c.n.d > 0) { await animateMove(u, c.n); u.moved = true; await wait(80); }
    if (!c.a) break;
    say(`${u.name} · ${c.a.name}`);
    const R = resolve(u, c.a, c.tx, c.ty);
    await playSteps(R.steps);
    if (c.a.kind === 'charge') say('A flaming sugar cube is coming. Clear the glowing tiles.');
    if (await settle()) return;
    if (!R.encore || u.dead) break;
  }
  if (!u.dead) u.facing = nearestFoeDir(u);
  await wait(110);
}
function playerTurn(u) { return new Promise(res => { V.turnDone = res; V.busy = false; V.origin = { x: u.x, y: u.y, facing: u.facing }; say(''); setMode('move'); }); }
function endPlayerTurn() { const f = V.turnDone; V.turnDone = null; V.busy = true; clearSel(); V.mode = 'wait'; hud(); if (f) f(); }
async function run(gameId) {
  while (gameId === V.gameId) {
    if (await settle()) return;
    const e = pickNext();
    if (e.pending) { V.active = null; V.busy = true; clearSel(); hud(); await playSteps(resolvePending(e).steps); continue; }
    V.active = e; V.inspect = null; V.threat = null;
    const st = startOfTurn(e); hud(); focusOn(e);
    if (st.skip) {
      V.busy = true; hud();
      if (st.skip === 'stun') { floatText(e, 'SHAKES IT OFF', '#ffe27a', 10); say(`${e.name} is stunned and loses the turn.`); }
      else say(`${e.name} is still lighting the cube.`);
      await wait(520); finishTurn(e, true); if (st.skip === 'charge') e.ct += 50; syncDisplay(); continue;
    }
    if (st.steps) await playSteps(st.steps);
    if (e.team === 'foe' || G.auto) await aiTurn(e); else await playerTurn(e);
    if (G.over || gameId !== V.gameId) return;
    if (!e.dead) finishTurn(e, false);
    syncDisplay();
  }
}
function newGame() {
  setupGame(G.seed);
  for (const u of G.units) initDisplay(u);
  Object.assign(V, { mode: 'wait', active: null, busy: true, inspect: null, threat: null, cracked: false, shelf: [], shelfN: 0, hint: '', turnDone: null, gameId: (V.gameId || 0) + 1 });
  clearSel(); FX.parts.length = FX.floats.length = FX.shots.length = FX.rings.length = FX.caps.length = 0; tweens.length = 0;
  Snd.mood(0); hud();
  return V.gameId;
}

/* --- player controls --- */
function setMode(m) {
  const u = V.active; clearSel(); V.mode = m;
  if (m === 'move') { if (!u.moved) V.reach = reachable(u); else V.mode = 'menu'; }
  if (m === 'facing') { V.faceDir = nearestFoeDir(u); V.inspect = null; V.threat = null; }
  hud();
}
const myTurn = () => !!(V.active && V.active.team === 'crew' && !V.busy && !G.auto && V.turnDone);
function inspect(u) {
  if (!u || u === V.inspect) { V.inspect = null; V.threat = null; return; }
  V.inspect = u; V.threat = null; Snd.play('tap');
  if (u.team === 'foe' && u.abil[0]) {
    const th = new Map(), r = reachable(u);
    for (const n of r.values()) if (!n.occupied) th.set(key(n.x, n.y), 'move');
    for (const n of r.values()) if (!n.occupied) for (const t of rangeTiles(u.abil[0], u, n.x, n.y).values()) th.set(key(t.x, t.y), 'hit');
    V.threat = th;
  }
}
function chooseAbility(a) {
  const u = V.active;
  if (!myTurn()) return;
  if (u.acted || (a.cd && u.cd > 0)) { Snd.play('nope'); return; }
  if (V.ability === a && (V.mode === 'target' || V.mode === 'confirm')) { say(''); return setMode('move'); }
  clearSel(); V.inspect = null; V.threat = null; V.ability = a; V.mode = 'target'; Snd.play('tap');
  V.range = rangeTiles(a, u, u.x, u.y); V.rangeHot = new Set();
  for (const t of V.range.values()) if (hasEffect(a, u, t.x, t.y)) V.rangeHot.add(key(t.x, t.y));
  say(V.rangeHot.size ? '' : `Nothing in reach for ${a.name}. Tap away to cancel.`);
}
function pickTarget(x, y) {
  const u = V.active, a = V.ability;
  if (!hasEffect(a, u, x, y)) { Snd.play('nope'); V.target = null; V.preview = null; V.mode = 'target'; return say(a.kind === 'heal' ? 'Nobody there needs a drink.' : 'Nothing to hit there.'); }
  Snd.play('pick');
  V.target = { x, y, tiles: areaTiles(a, x, y) }; V.preview = previewAction(u, a, x, y); V.mode = 'confirm';
  const parts = V.preview.list.filter(p => p.u.team !== 'obj').map(p => {
    const bits = [];
    if (p.dhp) bits.push((p.dhp > 0 ? '+' : '−') + Math.abs(p.dhp)); if (p.ko) bits.push('KO'); if (p.stun) bits.push('stun'); if (p.soak) bits.push('soak'); if (p.dry) bits.push('dry');
    return `${p.u.name} ${bits.join(' ')}`.trim();
  });
  if (V.preview.list.some(p => p.boom)) parts.push('keg explodes');
  if (V.preview.encore) parts.push('Kit goes again');
  say(parts.join(' · ') || a.name);
}
async function confirmAbility() {
  if (V.mode !== 'confirm' || V.busy) return;
  const u = V.active, a = V.ability, t = V.target, gid = V.gameId;
  V.busy = true; clearSel(); V.mode = 'anim'; V.hint = ''; hud();
  const R = resolve(u, a, t.x, t.y);
  await playSteps(R.steps);
  if (gid !== V.gameId) return;
  if (await settle()) return endPlayerTurn();
  if (u.dead) return endPlayerTurn();
  V.busy = false;
  if (R.encore) { V.origin = { x: u.x, y: u.y, facing: u.facing }; setMode('move'); say('Encore! Kit goes again.'); }
  else { say(''); setMode(u.moved ? 'facing' : 'move'); }
}
async function doMove(n) {
  const u = V.active; V.busy = true; V.reach = null; V.inspect = null; V.threat = null; hud();
  await animateMove(u, n); u.moved = true; V.busy = false; say(''); setMode('menu');
}
function finishFacing(d) { if (V.mode !== 'facing' || !myTurn()) return; V.active.facing = d; Snd.play('tap'); endPlayerTurn(); }
function onTap(wx, wy) {
  const t = pickTile(wx, wy), u = V.active;
  if (!myTurn()) { if (V.mode !== 'intro' && !G.over) { inspect(pickUnit(wx, wy) || (t && unitAt(t.x, t.y)) || null); hud(); } return; }
  if (V.mode === 'facing') {
    const [ux, uy] = world(u.px, u.py, u.pz), dx = (wx - ux) / 32, dy = (wy - uy) / 16, gx = (dx + dy) / 2, gy = (dy - dx) / 2;
    if (Math.abs(gx) + Math.abs(gy) > 0.25) finishFacing(Math.abs(gx) >= Math.abs(gy) ? (gx > 0 ? 0 : 2) : (gy > 0 ? 1 : 3));
    return;
  }
  if (V.mode === 'target' || V.mode === 'confirm') {
    const hu = pickUnit(wx, wy, q => V.rangeHot.has(key(q.x, q.y))), tt = hu ? { x: hu.x, y: hu.y } : t;
    if (tt && V.mode === 'confirm' && V.target.x === tt.x && V.target.y === tt.y) return confirmAbility();
    if (tt && V.range.has(key(tt.x, tt.y))) return pickTarget(tt.x, tt.y);
    Snd.play('tap'); say(''); return setMode('move');
  }
  const n = t && V.reach && V.reach.get(key(t.x, t.y));
  if (n && n.d > 0 && !n.occupied && V.mode === 'move') return doMove(n);
  const w = pickUnit(wx, wy) || (t && unitAt(t.x, t.y));
  if (w && w !== u && w.team !== 'crew' && !u.acted) {
    const a = u.abil[0];
    if (rangeTiles(a, u, u.x, u.y).has(key(w.x, w.y))) { chooseAbility(a); if (V.ability === a) pickTarget(w.x, w.y); return; }
  }
  inspect(w && w !== u ? w : null); hud();
}
function pickUnit(wx, wy, filter) {
  const us = G.units.filter(u => !u.gone && (!filter || filter(u))).sort((a, b) => (b.px + b.py) - (a.px + a.py));
  for (const u of us) { const [ux, uy] = world(u.px, u.py, u.pz), L = LOOK[u.type]; if (Math.abs(wx - ux) < 14 * (L.w || 1) && wy > uy - L.top - 4 && wy < uy + 6) return u; }
  return null;
}
function pickTile(wx, wy) {
  for (let d = W + H - 2; d >= 0; d--) for (let x = Math.min(d, W - 1); x >= 0; x--) {
    const y = d - x; if (y < 0 || y >= H) continue;
    const h = hAt(x, y), [cx, cy] = world(x, y, h * EH), dx = Math.abs(wx - cx), dy = wy - cy;
    if (dx <= TW / 2 && dy >= -(TH / 2 - dx / 2) && dy <= (TH / 2 - dx / 2) + h * EH + 8) return { x, y };
  }
  return null;
}
const ptrs = new Map(); let drag = null, pinch = null;
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) drag = { sx: e.clientX, sy: e.clientY, moved: false };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z }; if (drag) drag.moved = true; }
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && pinch) {
    const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect(), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    const nz = Math.max(0.45, Math.min(2.8, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
    cam.x = mx - (mx - cam.x) * nz / cam.z; cam.y = my - (my - cam.y) * nz / cam.z; cam.z = nz;
  } else if (ptrs.size === 1 && drag) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 9) drag.moved = true;
    if (drag.moved && !pinch) { cam.x += e.clientX - prev.x; cam.y += e.clientY - prev.y; }
  }
});
function pointerUp(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size === 0) {
    if (drag && !drag.moved && e.type === 'pointerup') { const r = cv.getBoundingClientRect(); onTap((e.clientX - r.left - cam.x) / cam.z, (e.clientY - r.top - cam.y) / cam.z); }
    drag = null; pinch = null;
  } else pinch = null;
}
cv.addEventListener('pointerup', pointerUp); cv.addEventListener('pointercancel', pointerUp);
cv.addEventListener('wheel', e => {
  e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const nz = Math.max(0.45, Math.min(2.8, cam.z * (e.deltaY < 0 ? 1.1 : 0.9)));
  cam.x = mx - (mx - cam.x) * nz / cam.z; cam.y = my - (my - cam.y) * nz / cam.z; cam.z = nz;
}, { passive: false });

/* --- HUD --- */
function hud() {
  const fc = (V.mode === 'intro' || G.over) ? [] : forecast(8, V.active && !V.active.dead ? V.active : null);
  const oh = fc.map((e, i) => e.pending
    ? `<span class="chip fire${i === 0 ? ' now' : ''}" title="Flaming Cube lands">${FLAME}</span>`
    : `<span class="chip ${e.team}${i === 0 ? ' now' : ''}${e === V.inspect ? ' sel' : ''}"><img alt="${e.name}" src="${PIC[e.type]}"></span>`).join('');
  if (oh !== V.orderHtml) { V.orderHtml = oh; $('order').innerHTML = oh; }
  $('pips').innerHTML = Array.from({ length: TOTAL_FOES }, (_, i) => `<i class="${i < V.shelfN ? 'on' : ''}"></i>`).join('');
  const u = V.inspect || V.active || G.units.find(x => x.team === 'crew' && !x.dead) || G.units[0];
  if (u) {
    $('uPic').src = PIC[u.type]; $('uPic').className = u.team;
    $('uName').textContent = u.name; $('uName').className = u.team;
    $('uCls').textContent = u.cls;
    const obj = u.team === 'obj';
    $('uStats').textContent = obj ? '' : `Move ${u.move} · Jump ${u.jump} · Speed ${u.speed}`;
    $('hpRow').style.visibility = obj ? 'hidden' : 'visible';
    const hp = Math.max(0, u.shp ?? u.hp);
    $('hpFill').style.width = (100 * hp / u.maxhp) + '%'; $('hpFill').className = u.team;
    $('hpTxt').textContent = `${hp}/${u.maxhp}`;
    const tags = [];
    if (u.dSoaked) tags.push('<span class="tag soak">Soaked · fire hits double</span>');
    if (u.dStun) tags.push('<span class="tag stun">Stunned</span>');
    if (u.dCharge) tags.push('<span class="tag fire">Lighting a cube</span>');
    let info = '';
    if (obj) info = 'Any hit sets it off: fire 8 to everything next to it. Otto can shove it.';
    else if (u.team === 'foe') info = u.abil.map(a => `<b>${a.name}</b> ${a.info}`).join(' &nbsp; ');
    else if (u.passive) info = `<b>${PASSIVES[u.passive][0]}</b> ${PASSIVES[u.passive][1]}`;
    if (u.team === 'foe' && u.passive) info += ` &nbsp; <b>${PASSIVES[u.passive][0]}</b> ${PASSIVES[u.passive][1]}`;
    $('uInfo').innerHTML = tags.join('') + `<span>${info}</span>`;
  }
  const a = V.active, mine = myTurn();
  let hint = V.hint;
  if (!hint && mine) hint = { move: 'Tap a blue tile to move, or tap a spirit in reach to attack.', menu: a.acted ? 'End the turn when you are ready.' : 'Choose an action, or end the turn.',
    target: 'Tap a glowing tile to aim.', facing: `Tap a side of ${a.name} to face that way. Backs take +50%.` }[V.mode] || '';
  $('hint').textContent = hint;
  $('actRow').hidden = V.mode === 'confirm' || V.mode === 'facing';
  $('confRow').hidden = V.mode !== 'confirm'; $('faceRow').hidden = V.mode !== 'facing';
  const p = a && a.team === 'crew' ? a : G.units.find(x => x.team === 'crew' && !x.dead) || G.units[0];
  if (!p || !p.abil.length) return;
  const undo = p.moved && !p.acted;
  $('bMove').firstElementChild.textContent = undo ? 'Undo move' : 'Move';
  $('bMove').lastElementChild.textContent = undo ? 'step back' : p.moved ? 'already moved' : `up to ${p.move} tiles`;
  $('bMove').disabled = !mine || (p.moved && p.acted); $('bMove').classList.toggle('on', mine && V.mode === 'move');
  [[$('bAtk'), p.abil[0]], [$('bSkl'), p.abil[1]]].forEach(([b, ab]) => {
    const cooling = !!(ab.cd && p.cd > 0);
    b.firstElementChild.textContent = ab.name;
    b.lastElementChild.textContent = cooling ? `ready in ${p.cd} turn${p.cd > 1 ? 's' : ''}` : ab.info;
    b.disabled = !mine || p.acted || cooling; b.classList.toggle('on', mine && V.ability === ab);
  });
  $('bEnd').disabled = !mine;
}
$('bMove').onclick = () => {
  const u = V.active; if (!myTurn()) return; Snd.play('tap');
  if (u.moved && !u.acted) { u.x = V.origin.x; u.y = V.origin.y; u.facing = V.origin.facing; u.moved = false; syncDisplay(); }
  V.inspect = null; V.threat = null; say(''); setMode('move');
};
$('bAtk').onclick = () => V.active && chooseAbility(V.active.abil[0]);
$('bSkl').onclick = () => V.active && chooseAbility(V.active.abil[1]);
$('bEnd').onclick = () => { if (myTurn()) { Snd.play('tap'); say(''); setMode('facing'); } };
$('bOk').onclick = confirmAbility;
$('bCancel').onclick = () => { if (myTurn()) { Snd.play('tap'); say(''); setMode('move'); } };
$('bFace').onclick = () => finishFacing(V.faceDir);
$('bBack').onclick = () => { if (myTurn()) { Snd.play('tap'); say(''); setMode('move'); } };
$('bSnd').onclick = () => { $('bSnd').innerHTML = Snd.toggle() ? ICON_ON : ICON_OFF; };
$('bHelp').onclick = () => { $('startBtn').firstElementChild.textContent = V.started ? 'Back to the bar' : 'Lock the doors'; $('intro').hidden = false; };
$('startBtn').onclick = () => {
  Snd.start(); $('intro').hidden = true;
  if (!V.started) { V.started = true; V.mode = 'wait'; banner('Closing time', 'Bottle every spirit in the house.'); run(V.gameId); }
};
$('againBtn').onclick = () => { Snd.start(); $('outro').hidden = true; const id = newGame(); banner('Closing time', 'Bottle every spirit in the house.'); run(id); };

/* --- boot --- */
for (const t in TYPES) PIC[t] = portrait(t);
$('crewList').innerHTML = [['otto', 'Shoves spirits around the room and stuns them. Hits back in melee.'], ['ines', 'Soaks a target from range, then sets the lot on fire.'], ['kit', 'Fast. Vaults behind a spirit, and goes again after bottling one.'], ['june', 'Soaks with a thrown tray and patches the crew up.']]
  .map(([t, d]) => `<div class="crew"><img alt="" src="${PIC[t]}"><div><b>${TYPES[t].name}</b> <i>${TYPES[t].cls}</i><span>${d}</span></div></div>`).join('');
$('bSnd').innerHTML = Snd.on ? ICON_ON : ICON_OFF;
new ResizeObserver(resize).observe(cv);
buildWalls();
if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('26px Yellowtail'), document.fonts.load('800 12px Outfit')]).then(buildWalls).catch(() => {});
newGame(); V.mode = 'intro'; resize(); hud();
requestAnimationFrame(frame);
window.__game = { G, V, cam, Snd, api: { aiChoose, tileTop, chooseAbility, pickTarget, world } };
