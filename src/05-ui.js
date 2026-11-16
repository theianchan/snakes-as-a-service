/* ===== flow, playback of rule events, touch input, menus ===== */
const PIC = {};
const V = { mode: 'intro', active: null, busy: true, reach: null, range: null, rangeHot: null, target: null, preview: null, ability: null,
  inspect: null, threat: null, origin: null, hint: '', turnDone: null, started: false, gameId: 0, orderHtml: '' };
const app = $('app'), hud = $('hud'), labels = $('labels');
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
function say(msg) { V.hint = msg; refresh(); }
function clearSel() { V.reach = null; V.range = null; V.rangeHot = null; V.target = null; V.preview = null; V.ability = null; }
function banner(title, sub) { const b = $('banner'); b.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

/* --- labels over the units --- */
function makeLabel(u) {
  const d = document.createElement('div'); d.className = 'lab ' + u.team; d.innerHTML = '<span class="pv"></span><span class="bar"><i></i><b></b></span>';
  labels.appendChild(d); u.lab = d; u.labFill = d.querySelector('i'); u.labLoss = d.querySelector('b'); u.labPv = d.querySelector('.pv');
}
function labelPos(u) { const [x, y] = toScreen(u.pos); return [Math.round(x), Math.round(y - (SH + 1) * view.css)]; }
function floatText(u, text, cls = '') {
  if (G.fast) return;
  const [x, y] = labelPos(u), d = document.createElement('div'), n = labels.querySelectorAll(`.float[data-u="${u.id}"]`).length;
  d.className = 'float ' + cls; d.dataset.u = u.id; d.textContent = text; d.style.left = x + 'px'; d.style.top = (y - 6 - n * 18) + 'px';
  labels.appendChild(d); setTimeout(() => d.remove(), 1000);
}
let attractT = 0;
frameHook = (now, dt) => {
  if (V.mode === 'intro' && !V.started) { attractT += dt; if (attractT > 5200) { attractT = 0; rotateBoard(1); } }
  for (const u of G.units) {
    if (!u.lab) continue;
    if (u.gone) { if (!u.lab.hidden) u.lab.hidden = true; continue; }
    const [x, y] = labelPos(u); u.lab.style.transform = `translate(${x}px,${y}px)`;
    let shown = Math.max(0, u.shp), loss = 0, pv = '', cls = '';
    if (V.mode === 'confirm' && V.preview) { const p = V.preview.find(p => p.u === u); if (p) { if (p.dhp < 0) { loss = Math.min(shown, -p.dhp); shown -= loss; } pv = (p.dhp > 0 ? '+' + p.dhp : '-' + (-p.dhp)) + (p.ko ? ' KO' : ''); cls = p.dhp > 0 ? 'heal' : p.ko ? 'ko' : 'hit'; } }
    const w = (100 * shown / u.maxhp).toFixed(1) + '%', lw = (100 * loss / u.maxhp).toFixed(1) + '%';
    if (u._w !== w) { u._w = w; u.labFill.style.width = w; } if (u._lw !== lw) { u._lw = lw; u.labLoss.style.width = lw; }
    if (u._pv !== pv) { u._pv = pv; u.labPv.textContent = pv; u.labPv.className = 'pv ' + cls; }
  }
  const a = V.active, show = !!a && !a.gone && !V.busy && V.mode !== 'intro';
  cursorTile.visible = show; cursorArrow.visible = show && !!V.turnDone;
  if (show) { cursorTile.position.set(a.pos.x, topY(a.x, a.y) + 0.016, a.pos.z); cursorTile.material.color.set(a.team === 'foe' ? '#ff9c94' : '#ffffff'); cursorArrow.userData.anchor.copy(a.pos); cursorArrow.userData.sy = -(SH + 9 + Math.floor(now / 280) % 2); }
};

/* --- playing back what the rules engine decided --- */
async function animEvent(e) {
  const u = e.u, sp = u.sprite.userData;
  switch (e.t) {
    case 'cast': {
      const a = e.a, from = u.pos.clone(), tgt = tileV(e.tx, e.ty);
      if (a.anim === 'melee') {
        Snd.play('whoosh'); const dir = tgt.clone().sub(from); dir.y = 0; dir.setLength(0.42);
        await tween(100, k => { u.pos.copy(from).addScaledVector(dir, easeOut(k)); });
        tween(200, k => { u.pos.copy(from).addScaledVector(dir, 1 - easeIO(k)); });
      } else if (a.anim === 'spin') {
        Snd.play('whoosh'); ringFx(from, '#ffffff', 1.5, 360);
        await tween(340, k => { u.spin = Math.floor(k * 4.999) % 4; u.pos.y = from.y + Math.sin(Math.PI * k) * 0.25; }); u.spin = 0; u.pos.y = from.y;
      } else {
        const src = from.clone(); src.y += 0.9; const dst = tgt.clone(); dst.y += 0.6;
        await tween(90, k => { sp.sy = -2 * Math.sin(Math.PI * k); }); sp.sy = 0;
        if (a.anim === 'arrow') { Snd.play('arrow'); await projectile('arrow', src, dst, 240, 0.5 + src.distanceTo(dst) * 0.1); Snd.play('thock'); }
        else if (a.anim === 'spark') { Snd.play('spark'); await projectile('spark', src, dst, 240, 0.5); flash(0.5, 0.3, 0.1); }
        else if (a.anim === 'fireball') { Snd.play('whoosh'); await projectile('fireball', src, dst, 420, 1.7); Snd.play('fire'); ringFx(tgt, '#ffb347', 1.9, 460); ringFx(tgt, '#fff0c0', 1.2, 320); burst(dst, 'spark', 26, 3.6); flash(1, 0.6, 0.25); view.shake = 3; }
        else if (a.anim === 'heal') { await projectile('heal', src, dst, 340, 0.9); }
      }
      break;
    }
    case 'hit': {
      u.shp = e.hp; const big = e.amt >= 10; Snd.play('hit', big); flashPiece(u, big ? 150 : 100);
      tween(300, k => { sp.sx = Math.round(Math.sin(k * 26) * 3 * (1 - k)); }).then(() => { sp.sx = 0; });
      const hp = u.pos.clone(); hp.y += 0.75; burst(hp, e.fire ? 'spark' : 'hit', big ? 10 : 6);
      floatText(u, '-' + e.amt, (e.fire ? 'fire ' : '') + (big ? 'big' : '')); for (const t of e.tags) floatText(u, t, 'tag');
      view.shake = Math.max(view.shake, big ? 3 : 1.5); if (e.amt >= 8) hitStop(big ? 70 : 40);
      refresh(); await wait(320); break;
    }
    case 'heal': {
      u.shp = e.hp; Snd.play('heal'); const hp = u.pos.clone(); hp.y += 0.5; burst(hp, 'heal', 14, 1.1); ringFx(u.pos, '#9df0a5', 0.9, 480); flash(0.15, 0.4, 0.2);
      floatText(u, '+' + e.amt, 'heal'); refresh(); await wait(420); break;
    }
    case 'ko': {
      Snd.play('topple'); u.lab.hidden = true;
      await tween(240, k => { sp.roll = (u.mir ? -1 : 1) * easeIO(k) * Math.PI / 2; sp.sy = -4 * Math.sin(Math.PI * k); });
      for (let i = 0; i < 5; i++) { u.sprite.visible = false; await wait(55); u.sprite.visible = true; await wait(55); }
      u.gone = true; u.sprite.visible = false; u.shadow.visible = false; const p = u.pos.clone(); p.y += 0.3; burst(p, 'white', 8, 1.6); refresh(); break;
    }
  }
}
async function playSteps(steps) { for (const st of steps) await Promise.all(st.map(animEvent)); syncDisplay(); refresh(); }
async function animateMove(u, node) {
  const path = []; for (let n = node; n.prev; n = n.prev) path.unshift(n);
  let cx = u.x, cy = u.y; u.x = node.x; u.y = node.y; u.stepping = true;
  for (const n of path) {
    const a = tileV(cx, cy), b = tileV(n.x, n.y), hop = 0.16 + Math.abs(b.y - a.y) * 0.55; u.facing = dirTo(cx, cy, n.x, n.y);
    await tween(140, k => { u.pos.lerpVectors(a, b, k); u.groundY = k < 0.5 ? a.y : b.y; u.pos.y = lerp(a.y, b.y, k) + Math.sin(Math.PI * k) * hop; });
    Snd.play('step'); cx = n.x; cy = n.y;
  }
  u.stepping = false; u.pos.copy(tileV(u.x, u.y)); u.groundY = u.pos.y;
}

/* --- the turn loop --- */
function finish(result) {
  G.over = true; G.result = result; V.mode = 'over'; V.active = null; V.busy = true; clearSel(); V.inspect = null; V.threat = null; refresh();
  const win = result === 'win', standing = G.units.filter(u => u.team === 'crew' && !u.dead).length;
  Snd.play(win ? 'win' : 'lose');
  const stars = win ? 1 + (standing === 4 ? 1 : 0) + (G.turns <= PAR_TURNS ? 1 : 0) : 0;
  $('outroEyebrow').textContent = win ? 'Alder Ford is yours' : 'The ford is lost';
  $('outroTitle').textContent = win ? 'Victory' : 'Defeated';
  $('outroText').textContent = win ? 'The Crow Banner breaks and runs. Keep all four standing and finish under par for three stars.' : 'The company is down. Hold the bridge with Rowan and let Wren shoot from the hill.';
  $('stars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
  $('stats').innerHTML = `<div><b>${G.felled}/${TOTAL_FOES}</b>routed</div><div><b>${standing}/4</b>standing</div><div><b>${G.turns}</b>turns, par ${PAR_TURNS}</div>`;
  setTimeout(() => { $('outro').hidden = false; }, G.fast ? 0 : 900);
}
async function aiTurn(u) {
  V.busy = true; V.mode = 'enemy'; clearSel(); say(`${u.name} is moving.`);
  await wait(240);
  const c = aiChoose(u);
  if (c.n && c.n.d > 0) { await animateMove(u, c.n); u.moved = true; await wait(60); }
  if (c.a) { say(`${u.name}: ${c.a.name}`); const R = resolve(u, c.a, c.tx, c.ty); await playSteps(R.steps); }
  await wait(80);
}
function playerTurn(u) { return new Promise(res => { V.turnDone = res; V.busy = false; V.origin = { x: u.x, y: u.y, facing: u.facing }; V.hint = ''; setMode('move'); }); }
function endPlayerTurn() { const f = V.turnDone; V.turnDone = null; V.busy = true; clearSel(); V.mode = 'wait'; V.hint = ''; refresh(); if (f) f(); }
async function run(gid) {
  while (gid === V.gameId) {
    const s = checkState(); if (s) { finish(s); return; }
    const e = pickNext(); V.active = e; V.inspect = null; V.threat = null; startOfTurn(e); refresh();
    if (e.team === 'foe' || G.auto) await aiTurn(e); else await playerTurn(e);
    if (G.over || gid !== V.gameId) return;
    if (!e.dead) finishTurn(e);
    syncDisplay();
  }
}
function newGame() {
  clearPieces(); labels.innerHTML = ''; setupGame(G.seed);
  for (const u of G.units) { initDisplay(u); makeLabel(u); }
  Object.assign(V, { mode: 'wait', active: null, busy: true, inspect: null, threat: null, hint: '', turnDone: null, gameId: V.gameId + 1 });
  clearSel(); tweens.length = 0; view.turning = false; refresh(); return V.gameId;
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
  say(V.preview.map(p => `${p.u.name} ${p.dhp > 0 ? '+' : '-'}${Math.abs(p.dhp)}${p.ko ? ' KO' : ''}${p.tags.length ? ' (' + p.tags.join(', ').toLowerCase() + ')' : ''}`).join(', '));
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
let drag = null;   // a tap selects; a sideways swipe turns the map a quarter
canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} if (!drag) drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, turned: false }; });
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId || drag.turned) return;
  const dx = e.clientX - drag.sx; if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(e.clientY - drag.sy) * 1.2) { drag.turned = true; rotateBoard(dx < 0 ? 1 : -1); }
});
function pointerUp(e) {
  if (!drag || drag.id !== e.pointerId) return;
  if (!drag.turned && e.type === 'pointerup' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 10) { const r = canvas.getBoundingClientRect(); onTap(e.clientX - r.left, e.clientY - r.top); }
  drag = null;
}
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);

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
  const fc = (V.mode === 'intro' || G.over) ? [] : forecast(7, a && !a.dead ? a : null);
  const oh = fc.map((e, i) => `<span class="chip ${e.team}${i === 0 ? ' now' : ''}${e === V.inspect ? ' sel' : ''}"><img alt="${e.name}" src="${PIC[e.type].head}"></span>`).join('');
  if (oh !== V.orderHtml) { V.orderHtml = oh; $('order').innerHTML = oh; }
  const u = V.inspect || a || G.units[0];
  if (u) {
    $('uPic').src = PIC[u.type].full; hud.dataset.team = u.team;
    $('uName').textContent = u.name; $('uCls').textContent = u.cls;
    const hp = Math.max(0, u.shp ?? u.hp); $('hpFill').style.width = (100 * hp / u.maxhp) + '%'; $('hpTxt').textContent = `${hp}/${u.maxhp}`;
    $('uStats').innerHTML = u.team === 'foe' ? `<b>${u.abil[0].name}</b> ${u.abil[0].info}` : `Move ${u.move} · Jump ${u.jump} · ${TYPES[u.type].blurb}`;
  }
  let hint = V.hint;
  if (!hint && mine && a.acted) hint = 'Move if you like, or end the turn.';
  if (!hint && mine) hint = { move: 'Tap a blue tile to move, or an enemy in reach to attack.', menu: 'Pick an action, or end the turn.', target: 'Tap a flashing tile to aim.' }[V.mode] || '';
  if (!hint && V.inspect && V.inspect.team === 'foe') hint = 'Purple tiles: where it can strike next turn.';
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
}
$('bAtk').onclick = () => V.active && chooseAbility(V.active.abil[0]);
$('bSkl').onclick = () => V.active && chooseAbility(V.active.abil[1]);
$('bUndo').onclick = () => { const u = V.active; if (!myTurn() || !(u.moved && !u.acted && V.origin)) return; Snd.play('tap'); u.x = V.origin.x; u.y = V.origin.y; u.facing = V.origin.facing; u.moved = false; syncDisplay(); V.hint = ''; setMode('move'); };
$('bEnd').onclick = () => { if (myTurn()) { Snd.play('tap'); endPlayerTurn(); } };
$('bOk').onclick = confirmAbility;
$('bCancel').onclick = () => { if (myTurn()) { Snd.play('tap'); V.hint = ''; setMode('move'); } };
$('bSnd').onclick = () => { $('bSnd').innerHTML = Snd.toggle() ? ICON_ON : ICON_OFF; };
$('bTurn').onclick = () => rotateBoard(1);
$('bHelp').onclick = () => { $('startBtn').firstElementChild.textContent = V.started ? 'Back to the battle' : 'Begin'; $('intro').hidden = false; };
function begin(id) { V.mode = 'wait'; banner('Alder Ford', 'Rout the Crow Banner.'); run(id); }
$('startBtn').onclick = () => { Snd.start(); $('intro').hidden = true; app.classList.remove('pre'); if (!V.started) { V.started = true; begin(V.gameId); } };
$('againBtn').onclick = () => { Snd.start(); $('outro').hidden = true; begin(newGame()); };
var onResize = () => { view.hudH = hud.offsetHeight + 22; };

/* --- boot --- */
for (const t in TYPES) PIC[t] = portrait(t);
app.classList.add('pre');
$('bSnd').innerHTML = Snd.on ? ICON_ON : ICON_OFF;
newGame(); V.mode = 'intro';
new ResizeObserver(() => { resize(); }).observe(canvas);
resize(); resize(); refresh();
requestAnimationFrame(frame);
window.__game = { G, V, view, Snd, api: { aiChoose, tileV, toScreen, rotateBoard } };
