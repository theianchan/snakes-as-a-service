/* ===== the campaign: story scenes, battles, results, saving, touch input, menus ===== */
const PIC = {};
const V = { mode: 'title', active: null, busy: true, reach: null, range: null, rangeHot: null, target: null, preview: null, ability: null,
  inspect: null, threat: null, origin: null, hint: '', turnDone: null, gameId: 0, orderHtml: '', speaker: null, talkNext: null };
const app = $('app'), hud = $('hud'), labels = $('labels');
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
function say(msg) { V.hint = msg; refresh(); }
function clearSel() { V.reach = null; V.range = null; V.rangeHot = null; V.target = null; V.preview = null; V.ability = null; }
function banner(title, sub) { const b = $('banner'); b.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function toast(text) { const t = $('toast'); t.innerHTML = '<span></span>'; t.firstChild.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* --- saving: progress lives in this browser --- */
const SAVE_KEY = 'bwt.save.v1';
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ chapter: Party.chapter, roster: Party.roster, xp: Party.xp, firsts: Party.firsts, guests: Party.guests, finished: Party.finished })); } catch (e) {} }
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && Array.isArray(s.roster) && s.chapter >= 0 && s.chapter < LEVELS.length) { Object.assign(Party, s); return true; } } catch (e) {} return false; }
function resetParty() { Object.assign(Party, { chapter: 0, roster: ['knight', 'archer', 'mage', 'cleric'], xp: {}, firsts: {}, guests: [], finished: false }); }

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
  if (V.mode === 'title') { attractT += dt; if (attractT > 5200) { attractT = 0; rotateBoard(1); } }
  for (const u of G.units) {
    if (!u.lab) continue;
    if (u.gone) { if (!u.lab.hidden) u.lab.hidden = true; continue; }
    const [x, y] = labelPos(u); u.lab.style.transform = `translate(${x}px,${y}px)`;
    let shown = Math.max(0, u.shp), loss = 0, pv = '', cls = '';
    if (V.mode === 'confirm' && V.preview) { const p = V.preview.list.find(p => p.u === u); if (p) { if (p.dhp < 0) { loss = Math.min(shown, -p.dhp); shown -= loss; } pv = (p.dhp > 0 ? '+' + p.dhp : p.dhp < 0 ? '-' + (-p.dhp) : '') + (p.ko ? ' KO' : ''); cls = p.dhp > 0 ? 'heal' : p.ko ? 'ko' : 'hit'; } }
    const w = (100 * shown / u.maxhp).toFixed(1) + '%', lw = (100 * loss / u.maxhp).toFixed(1) + '%';
    if (u._w !== w) { u._w = w; u.labFill.style.width = w; } if (u._lw !== lw) { u._lw = lw; u.labLoss.style.width = lw; }
    if (u._pv !== pv) { u._pv = pv; u.labPv.textContent = pv; u.labPv.className = 'pv ' + cls; }
  }
  const a = V.mode === 'story' ? V.speaker : V.active, show = !!a && !!a.sprite && !a.gone && (V.mode === 'story' || !V.busy);
  cursorTile.visible = show && V.mode !== 'story'; cursorArrow.visible = show && (V.mode === 'story' || !!V.turnDone);
  if (show) { cursorTile.position.set(a.pos.x, topY(a.x, a.y) + 0.016, a.pos.z); cursorTile.material.color.set(a.team === 'foe' ? '#ff9c94' : '#ffffff'); cursorArrow.userData.anchor.copy(a.pos); cursorArrow.userData.sy = -(SH + 9 + Math.floor(now / 280) % 2); }
};

/* --- story scenes: a window at the bottom, one line at a time --- */
function speakerUnit(who) { return G.units.find(u => u.type === who && !u.gone && u.sprite) || stageUnits.find(u => u.type === who) || (who === 'captain' && G.units.find(u => u.type === 'corvin' && !u.gone)) || (who === 'dame' && G.units.find(u => u.type === 'isolde' && !u.gone)) || null; }
function playScene(lines) {
  if (G.fast || !lines || !lines.length) return Promise.resolve();
  return new Promise(done => {
    const prev = V.mode, box = $('talk'), txt = $('talkText'); let i = -1, timer = null, full = '', shown = 0;
    V.mode = 'story'; app.classList.add('talking'); box.hidden = false; refresh();
    const finish = () => { clearInterval(timer); V.talkNext = null; V.speaker = null; box.hidden = true; app.classList.remove('talking'); V.mode = prev; refresh(); done(); };
    const next = () => {
      if (shown < full.length) { shown = full.length; txt.textContent = full; clearInterval(timer); $('talkMore').hidden = false; return; }
      if (++i >= lines.length) return finish();
      const [who, text] = lines[i]; full = text; shown = 0; txt.textContent = ''; $('talkMore').hidden = true;
      box.dataset.kind = who === 'narr' ? 'narr' : who === 'letter' ? 'letter' : 'say';
      $('talkName').textContent = who === 'letter' ? 'Maren\'s letter' : who === 'narr' ? '' : SPEAKER[who];
      $('talkPicBox').hidden = who === 'narr' || who === 'letter'; if (PIC[who]) $('talkPic').src = PIC[who].full;
      V.speaker = who === 'narr' || who === 'letter' ? null : speakerUnit(who);
      Snd.play(who === 'letter' ? 'page' : 'tap');
      clearInterval(timer); timer = setInterval(() => { shown = Math.min(full.length, shown + 2); txt.textContent = full.slice(0, shown); if (shown >= full.length) { clearInterval(timer); $('talkMore').hidden = false; } }, 28);
    };
    V.talkNext = next; $('talkSkip').onclick = e => { e.stopPropagation(); finish(); };
    next();
  });
}
$('talk').addEventListener('click', () => { if (V.talkNext) V.talkNext(); });

/* --- playing back what the rules engine decided --- */
async function animEvent(e) {
  const u = e.u, sp = u.sprite.userData;
  switch (e.t) {
    case 'cast': {
      const a = e.a, tgt = tileV(e.tx, e.ty);
      if (a.step) { Snd.play('whoosh'); const p = u.pos.clone(); p.y += 0.5; burst(p, 'white', 8, 1.4); u.sprite.visible = false; await wait(150); u.pos.copy(tileV(e.to.x, e.to.y)); u.groundY = u.pos.y; u.sprite.visible = true; const q = u.pos.clone(); q.y += 0.5; burst(q, 'white', 8, 1.4); await wait(90); }
      const from = u.pos.clone();
      if (a.anim === 'melee' || a.anim === 'step') {
        Snd.play('whoosh'); const dir = tgt.clone().sub(from); dir.y = 0; dir.setLength(0.42);
        await tween(100, k => { u.pos.copy(from).addScaledVector(dir, easeOut(k)); });
        tween(200, k => { u.pos.copy(from).addScaledVector(dir, 1 - easeIO(k)); });
      } else if (a.anim === 'spin') {
        Snd.play('whoosh'); ringFx(from, '#ffffff', 1.5, 360);
        await tween(340, k => { u.spin = Math.floor(k * 4.999) % 4; u.pos.y = from.y + Math.sin(Math.PI * k) * 0.25; }); u.spin = 0; u.pos.y = from.y;
      } else if (a.anim === 'toll' || a.anim === 'bless') {
        const bell = a.anim === 'toll'; Snd.play(bell ? 'bell' : 'heal'); await tween(160, k => { sp.sy = -3 * Math.sin(Math.PI * k); }); sp.sy = 0;
        ringFx(from, bell ? '#ffd24a' : '#9df0a5', a.radius + 0.6, 520); ringFx(from, bell ? '#fff3b0' : '#e2ffe4', a.radius * 0.6, 380); if (bell) { flash(0.5, 0.42, 0.1); view.shake = 2; }
        await wait(160);
      } else {
        const src = from.clone(); src.y += 0.9; const dst = tgt.clone(); dst.y += 0.6;
        await tween(90, k => { sp.sy = -2 * Math.sin(Math.PI * k); }); sp.sy = 0;
        if (a.anim === 'arrow') { Snd.play('arrow'); await projectile('arrow', src, dst, 240, 0.5 + src.distanceTo(dst) * 0.1); Snd.play('thock'); }
        else if (a.anim === 'spark') { Snd.play('spark'); await projectile('spark', src, dst, 240, 0.5); flash(0.5, 0.3, 0.1); }
        else if (a.anim === 'frost') { Snd.play('spark'); await projectile('frost', src, dst, 260, 0.5); ringFx(tgt, '#bfe6ff', 0.9, 380); burst(dst, 'frost', 12, 2); flash(0.15, 0.3, 0.5); }
        else if (a.anim === 'chime') { Snd.play('bell'); await projectile('chime', src, dst, 260, 0.3); ringFx(tgt, '#ffd24a', 0.8, 320); }
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
    case 'status': { u.dStill = true; floatText(u, 'STILLED', 'still'); await wait(60); break; }
    case 'push': {
      const a = tileV(e.from.x, e.from.y), b = tileV(e.to.x, e.to.y);
      await tween(e.drop ? 240 : 150, k => { u.pos.lerpVectors(a, b, easeOut(k)); u.pos.y = lerp(a.y, b.y, k * k) + Math.sin(Math.PI * k) * 0.12; u.groundY = k < 0.5 ? a.y : b.y; });
      if (e.drop) { Snd.play('thock'); view.shake = Math.max(view.shake, 2.5); } break;
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
async function act(u, a, tx, ty) { // run an ability, show it, and note anything the unit did for the first time
  const R = resolve(u, a, tx, ty), fresh = award(u, a, R);
  await playSteps(R.steps);
  if (fresh.length && !G.fast) { floatText(u, 'FIRST!', 'first'); Snd.play('first'); toast(`${u.name}: ${fresh[0]}${fresh.length > 1 ? ', and ' + (fresh.length - 1) + ' more' : ''}`); }
}
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

/* --- one battle --- */
async function aiTurn(u) {
  V.busy = true; V.mode = 'enemy'; clearSel(); say(`${u.name} is moving.`);
  await wait(240);
  const c = aiChoose(u);
  if (c.n && c.n.d > 0) { await animateMove(u, c.n); u.moved = true; await wait(60); }
  if (c.a) { say(`${u.name}: ${c.a.name}`); await act(u, c.a, c.tx, c.ty); }
  await wait(80);
}
function playerTurn(u) { return new Promise(res => { V.turnDone = res; V.busy = false; V.origin = { x: u.x, y: u.y, facing: u.facing }; V.hint = u.stilled ? `${u.name} is stilled and cannot move this turn.` : ''; setMode('move'); }); }
function endPlayerTurn() { const f = V.turnDone; V.turnDone = null; V.busy = true; clearSel(); V.mode = 'wait'; V.hint = ''; refresh(); if (f) f(); }
async function reinforce() {
  V.busy = true; V.active = null; refresh();
  const us = spawnReinforcements(); Snd.play('horn'); view.shake = 2;
  for (const u of us) { initDisplay(u); makeLabel(u); const p = u.pos.clone(); p.y += 0.5; burst(p, 'gold', 14, 2); ringFx(u.pos, '#ffd24a', 1.2, 500); }
  banner('Guests arrive', 'They came after all.');
  await wait(G.fast ? 0 : 700); await playScene(STORY[Party.chapter].mid);
}
async function battle(gid) { // resolves 'win' or 'loss'
  while (gid === V.gameId) {
    const s = checkState(); if (s) return s;
    if (reinforceDue()) await reinforce();
    const e = pickNext(); V.active = e; V.inspect = null; V.threat = null; startOfTurn(e); refresh();
    if (e.team === 'foe' || G.auto) await aiTurn(e); else await playerTurn(e);
    if (gid !== V.gameId) return null;
    if (!e.dead) finishTurn(e);
    syncDisplay();
  }
  return null;
}
function clearStage() { clearPieces(); for (const x of stageUnits) dropUnit(x); stageUnits.length = 0; labels.innerHTML = ''; }
function stageExtra(t, x, y, f) { const u = { id: 100 + stageUnits.length, type: t, team: (TYPES[t] || { team: 'crew' }).team, x, y, facing: f ?? 1, hp: 1, maxhp: 1 }; initDisplay(u); stageUnits.push(u); return u; }
function newBattle() {
  clearStage(); setupGame(G.seed); buildLevel(); for (const u of G.units) { initDisplay(u); makeLabel(u); }
  Object.assign(V, { active: null, busy: true, inspect: null, threat: null, hint: '', turnDone: null, gameId: V.gameId + 1, speaker: null });
  clearSel(); tweens.length = 0; view.turning = false; resize(); refresh(); return V.gameId;
}

/* --- the campaign loop: story, battle, story, results --- */
async function playChapter(retry) {
  const ch = Party.chapter, S = STORY[ch], gid = newBattle();
  app.classList.remove('pre'); $('intro').hidden = true; $('camp').hidden = true; $('outro').hidden = true;
  V.mode = 'wait';
  if (!retry) {
    if (LV.extras && !G.fast) for (const [t, x, y, f] of LV.extras) stageExtra(t, x, y, f);
    banner(`Chapter ${ch + 1}`, LV.name); await wait(G.fast ? 0 : 900); await playScene(S.intro);
    for (const x of stageUnits) dropUnit(x); stageUnits.length = 0;
  }
  if (gid !== V.gameId) return;
  V.mode = 'wait'; banner(LV.name, LV.goal);
  const result = await battle(gid);
  if (gid !== V.gameId || !result) return;
  V.mode = 'over'; V.active = null; V.busy = true; clearSel(); V.inspect = null; V.threat = null; refresh();
  const standing = G.units.filter(u => u.team === 'crew' && !u.guest && !u.dead).length, turns = G.turns;
  if (result === 'loss') { Snd.play('lose'); const gains = bankGains(false); save(); await wait(G.fast ? 0 : 800); return showDefeat(gains); }
  Snd.play('win'); banner('Victory', LV.name); await wait(G.fast ? 0 : 1300);
  if (LV.extras && !G.fast) for (const [t, x, y, f] of LV.extras) { const [fx, fy] = freeNear(x, y); stageExtra(t, fx, fy, f); }   // the people this chapter was about step back into view
  await playScene(S.outro);
  for (const x of stageUnits) dropUnit(x); stageUnits.length = 0;
  const gains = bankGains(true);
  if (S.recruit && !Party.roster.includes(S.recruit)) { Party.roster.push(S.recruit); Party.xp[S.recruit] = Math.round(Party.roster.slice(0, -1).reduce((a, t) => a + (Party.xp[t] || 0), 0) / (Party.roster.length - 1)); }
  if (!Party.guests.includes(S.invite)) Party.guests.push(S.invite);
  const last = ch === LEVELS.length - 1; if (last) Party.finished = true; else Party.chapter = ch + 1;
  save(); showCamp(ch, gains, { standing, turns, last });
}
function rosterRows(gains) {
  return Party.roster.map(t => {
    const T = TYPES[t], xp = Party.xp[t] || 0, lv = lvlOf(xp), lo = XP_LV[lv - 1], hi = XP_LV[lv] || null, g = gains && gains.find(g => g.type === t);
    const pct = hi ? Math.round(100 * (xp - lo) / (hi - lo)) : 100, notes = [];
    if (g && g.l1 > g.l0) notes.push(`<em>Level ${g.l1}</em>`); if (g && g.learned) notes.push(`<em>Learned ${esc(g.learned)}</em>`);
    if (!g) notes.push('<em>Joined the company</em>');
    return `<div class="rrow"><img alt="" src="${PIC[t].head}"><div><div class="rtop"><b>${T.name}</b><span>${T.cls} · Lv ${lv}</span><i>${g ? '+' + g.add + ' xp' : ''}</i></div><div class="xbar"><u style="width:${pct}%"></u></div>${notes.length ? `<div class="rnote">${notes.join(' · ')}</div>` : ''}</div></div>`;
  }).join('');
}
function firstsList(gains) {
  const out = []; for (const g of gains) for (const k of g.firsts) out.push(`${TYPES[g.type].name}: ${firstLabel(k)}`);
  return out;
}
function firstLabel(k) { return FIRSTS[k] || (k.startsWith('ab:') ? 'First ' + AB[k.slice(3)].name : k.startsWith('ko:') ? 'First ' + TYPES[k.slice(3)].name + ' beaten' : k); }
function showCamp(ch, gains, r) {
  const firsts = firstsList(gains), par = LEVELS[ch].par, stars = 1 + (r.standing === G.units.filter(u => u.team === 'crew' && !u.guest).length ? 1 : 0) + (r.turns <= par ? 1 : 0);
  $('campEyebrow').textContent = `Chapter ${ch + 1} · ${LEVELS[ch].name}`;
  $('campStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('') + `<small>${r.turns} turns, par ${par}</small>`;
  $('campRoster').innerHTML = rosterRows(gains);
  $('campFirsts').innerHTML = firsts.length ? `<h3>Firsts</h3><ul>${firsts.slice(0, 4).map(f => `<li>${esc(f)}</li>`).join('')}${firsts.length > 4 ? `<li>and ${firsts.length - 4} more</li>` : ''}</ul>` : '';
  $('campGuests').innerHTML = `<h3>The guest list</h3><ul>${STORY.map((s, i) => `<li class="${Party.guests.includes(s.invite) ? 'yes' : ''}">${Party.guests.includes(s.invite) ? esc(s.invite) : '· · ·'}</li>`).join('')}</ul>`;
  $('campBtn').firstElementChild.textContent = r.last ? 'To the long table' : `Chapter ${ch + 2}: ${LEVELS[ch + 1].name}`;
  $('campBtn').onclick = () => { Snd.play('pick'); $('camp').hidden = true; if (r.last) epilogue(); else playChapter(false); };
  $('camp').hidden = false; $('camp').scrollTop = 0;
  if (G.auto && !G.hold) setTimeout(() => $('campBtn').click(), 30);
}
function showDefeat(gains) {
  $('outroEyebrow').textContent = LV.name; $('outroTitle').textContent = 'Driven back';
  $('outroText').textContent = 'The company regroups. What they learned in the attempt, they keep.';
  $('outroRoster').innerHTML = rosterRows(gains);
  $('againBtn').onclick = () => { Snd.play('pick'); $('outro').hidden = true; playChapter(true); };
  $('outro').hidden = false;
  if (G.auto) setTimeout(() => $('againBtn').click(), 30);
}
async function epilogue() {
  clearStage(); G.units = []; loadLevel(0); buildLevel(); V.gameId++; V.active = null; V.busy = true; clearSel(); app.classList.add('pre'); resize();
  for (const k of EPILOGUE.tables) { const [x, y] = k.split(',').map(Number); addProp('table', x, y); }
  for (const [t, x, y, f] of EPILOGUE.cast) stageExtra(t, x, y, f);
  V.mode = 'wait'; refresh();
  banner('The long table', 'Midsummer, at Alder Ford'); Snd.play('win'); await wait(G.fast ? 0 : 1600);
  await playScene(EPILOGUE.lines);
  const all = []; for (const t of Party.roster) for (const k of (Party.firsts[t] || [])) all.push(`${TYPES[t].name}: ${firstLabel(k)}`);
  $('finaleCount').textContent = all.length; $('finaleList').innerHTML = all.map(f => `<li>${esc(f)}</li>`).join('');
  $('finale').hidden = false; $('finale').scrollTop = 0;
}
function showTitle() {
  V.mode = 'title'; const has = load(); if (!has) resetParty();
  clearStage(); setupGame(1); buildLevel(); for (const u of G.units) { initDisplay(u); makeLabel(u); } V.gameId++; V.active = null; V.busy = true; clearSel(); resize(); refresh();
  app.classList.add('pre'); $('finale').hidden = true; $('camp').hidden = true; $('outro').hidden = true; $('intro').hidden = false;
  const started = has && (Party.chapter > 0 || Party.finished || Object.keys(Party.xp).length > 0);
  $('startBtn').firstElementChild.textContent = !started ? 'Begin' : Party.finished ? 'Return to the long table' : `Continue · Chapter ${Party.chapter + 1}`;
  $('newBtn').hidden = !started; $('newBtn').dataset.sure = ''; $('newBtn').firstElementChild.textContent = 'Start over';
}
$('startBtn').onclick = () => { Snd.start(); Snd.play('pick'); $('intro').hidden = true; if (V.mode !== 'title') return; if (Party.finished) epilogue(); else playChapter(false); };
$('newBtn').onclick = () => {
  const b = $('newBtn'); if (!b.dataset.sure) { b.dataset.sure = '1'; b.firstElementChild.textContent = 'Erase progress? Tap again'; return; }
  Snd.start(); try { localStorage.removeItem(SAVE_KEY); } catch (e) {} resetParty(); $('intro').hidden = true; V.mode = 'title'; playChapter(false);
};
$('finaleBtn').onclick = () => { $('finale').hidden = true; showTitle(); };

/* --- player controls --- */
function setMode(m) {
  const u = V.active; clearSel(); V.mode = m;
  if (m === 'move') { if (!u.moved && !u.stilled) V.reach = reachable(u); else V.mode = 'menu'; }
  refresh();
}
const myTurn = () => !!(V.active && V.active.team === 'crew' && !V.busy && !G.auto && V.turnDone);
function inspect(u) {
  if (!u || u === V.inspect) { V.inspect = null; V.threat = null; return; }
  V.inspect = u; V.threat = null; Snd.play('tap');
  if (u.team === 'foe') { const th = new Map(), r = reachable(u); for (const n of r.values()) if (!n.occupied) for (const t of rangeTiles(u.abil[0], u, n.x, n.y).values()) th.set(key(t.x, t.y), 1); V.threat = th; }
}
function chooseAbility(a) {
  const u = V.active; if (!myTurn() || !a) return;
  if (u.acted || !ready(u, a)) { Snd.play('nope'); return; }
  if (V.ability === a && (V.mode === 'target' || V.mode === 'confirm')) { V.hint = ''; return setMode('move'); }
  clearSel(); V.inspect = null; V.threat = null; V.ability = a; V.mode = 'target'; Snd.play('tap');
  V.range = rangeTiles(a, u, u.x, u.y); V.rangeHot = new Set();
  for (const t of V.range.values()) if (hasEffect(a, u, t.x, t.y) || a.step) V.rangeHot.add(key(t.x, t.y));
  if (a.shape === 'ring' || a.shape === 'aura') { if (V.rangeHot.size) return pickTarget(u.x, u.y); clearSel(); V.mode = u.moved ? 'menu' : 'move'; if (!u.moved && !u.stilled) V.reach = reachable(u); Snd.play('nope'); return say(a.kind === 'heal' ? 'Nobody close by needs healing.' : 'No enemy is close enough.'); }
  say(V.rangeHot.size ? '' : (a.kind === 'heal' ? 'Nobody in reach needs healing.' : `Nothing in reach for ${a.name}. Tap away to cancel.`));
}
function pickTarget(x, y) {
  const u = V.active, a = V.ability;
  if (!V.rangeHot.has(key(x, y))) { Snd.play('nope'); V.target = null; V.preview = null; V.mode = 'target'; return say(a.kind === 'heal' ? 'Nobody there needs healing.' : 'Nothing to hit there.'); }
  Snd.play('pick');
  V.target = { x, y, tiles: areaTiles(a, u.x, u.y, x, y) }; V.preview = previewAction(u, a, x, y); V.mode = 'confirm';
  say(V.preview.list.map(p => `${p.u.name} ${p.dhp > 0 ? '+' : '-'}${Math.abs(p.dhp)}${p.ko ? ' KO' : ''}${p.tags.length ? ' (' + p.tags.join(', ').toLowerCase() + ')' : ''}`).join(', '));
}
async function confirmAbility() {
  if (V.mode !== 'confirm' || V.busy) return;
  const u = V.active, a = V.ability, t = V.target, gid = V.gameId;
  V.busy = true; clearSel(); V.mode = 'anim'; V.hint = ''; refresh();
  await act(u, a, t.x, t.y);
  if (gid !== V.gameId) return;
  if (checkState() || u.dead || u.moved || u.stilled) return endPlayerTurn();
  V.busy = false; V.origin = null; setMode('move');
}
async function doMove(n) {
  const u = V.active; V.busy = true; V.reach = null; V.inspect = null; V.threat = null; V.hint = ''; refresh();
  await animateMove(u, n); u.moved = true;
  if (u.acted) return endPlayerTurn();
  V.busy = false; setMode('menu');
}
function onTap(px, py) {
  if (V.mode === 'story') { if (V.talkNext) V.talkNext(); return; }
  const hit = pick(px, py), u = V.active, t = hit.tile, w = hit.unit || (t && unitAt(t.x, t.y)) || null;
  if (!myTurn()) { if (V.mode !== 'title' && V.mode !== 'over' && w && w.lab) { inspect(w); refresh(); } return; }
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
  const a = V.active, mine = myTurn(), inBattle = ['move', 'menu', 'target', 'confirm', 'anim', 'enemy', 'wait'].includes(V.mode);
  const fc = inBattle && a ? forecast(7, !a.dead ? a : null) : [];
  const oh = fc.map((e, i) => `<span class="chip ${e.team}${i === 0 ? ' now' : ''}${e === V.inspect ? ' sel' : ''}"><img alt="${e.name}" src="${PIC[e.type].head}"></span>`).join('');
  if (oh !== V.orderHtml) { V.orderHtml = oh; $('order').innerHTML = oh; }
  const u = V.inspect || a || G.units[0];
  if (u && u.abil) {
    $('uPic').src = PIC[u.type].full; hud.dataset.team = u.team;
    $('uName').textContent = u.name; $('uCls').textContent = u.cls + (u.team === 'crew' && !u.guest ? ' · Lv ' + u.lvl : '');
    const hp = Math.max(0, u.shp ?? u.hp); $('hpFill').style.width = (100 * hp / u.maxhp) + '%'; $('hpTxt').textContent = `${hp}/${u.maxhp}`;
    $('uStats').innerHTML = (u.dStill ? '<b class="st">Stilled</b> · ' : '') + (u.team === 'foe' ? u.abil.map(ab => `<b>${ab.name}</b> ${ab.info}`).join(' · ') : `Move ${u.move} · Jump ${u.jump} · ${TYPES[u.type].blurb}`);
  }
  let hint = V.hint;
  if (!hint && mine && a.acted) hint = 'Move if you like, or end the turn.';
  if (!hint && mine) hint = { move: 'Tap a blue tile to move, or an enemy in reach to attack.', menu: 'Pick an action, or end the turn.', target: 'Tap a flashing tile to aim.' }[V.mode] || '';
  if (!hint && V.inspect && V.inspect.team === 'foe') hint = 'Purple tiles: where it can strike next turn.';
  $('hint').textContent = hint;
  $('actRow').hidden = V.mode === 'confirm'; $('confRow').hidden = V.mode !== 'confirm';
  const p = a && a.team === 'crew' ? a : G.units.find(x => x.team === 'crew' && !x.dead && x.abil) || null;
  if (p) {
    const slots = [$('bAb0'), $('bAb1'), $('bAb2')], T = TYPES[p.type], teaser = !p.guest && T.learn && p.abil.length < 3;
    $('actRow').dataset.n = p.abil.length + (teaser ? 1 : 0);
    slots.forEach((b, i) => {
      const ab = p.abil[i];
      if (!ab) { b.hidden = !(teaser && i === p.abil.length); if (!b.hidden) { b.firstElementChild.textContent = AB[T.learn].name; b.lastElementChild.textContent = 'learned at Lv 3'; b.disabled = true; b.classList.remove('on'); } return; }
      const cooling = !ready(p, ab); b.hidden = false;
      b.firstElementChild.textContent = ab.name; b.lastElementChild.textContent = cooling ? `ready in ${p.cd[ab.key]}` : ab.info;
      b.disabled = !mine || p.acted || cooling; b.classList.toggle('on', mine && V.ability === ab);
    });
    $('bUndo').disabled = !mine || !(p.moved && !p.acted && V.origin); $('bEnd').disabled = !mine;
  }
}
[0, 1, 2].forEach(i => { $('bAb' + i).onclick = () => V.active && chooseAbility(V.active.abil[i]); });
$('bUndo').onclick = () => { const u = V.active; if (!myTurn() || !(u.moved && !u.acted && V.origin)) return; Snd.play('tap'); u.x = V.origin.x; u.y = V.origin.y; u.facing = V.origin.facing; u.moved = false; syncDisplay(); V.hint = ''; setMode('move'); };
$('bEnd').onclick = () => { if (myTurn()) { Snd.play('tap'); endPlayerTurn(); } };
$('bOk').onclick = confirmAbility;
$('bCancel').onclick = () => { if (myTurn()) { Snd.play('tap'); V.hint = ''; setMode('move'); } };
$('bSnd').onclick = () => { $('bSnd').innerHTML = Snd.toggle() ? ICON_ON : ICON_OFF; };
$('bTurn').onclick = () => rotateBoard(1);
$('bHelp').onclick = () => { $('help').hidden = false; };
$('helpBtn').onclick = () => { $('help').hidden = true; };
var onResize = () => { view.hudH = (hud.offsetHeight || 250) + 22; };

/* --- boot --- */
for (const t in KIT) PIC[t] = portrait(t);
$('bSnd').innerHTML = Snd.on ? ICON_ON : ICON_OFF;
new ResizeObserver(() => { resize(); }).observe(canvas);
showTitle(); resize(); resize(); refresh();
requestAnimationFrame(frame);
window.__game = { G, V, view, Snd, Party, api: { aiChoose, tileV, toScreen, rotateBoard, showTitle } };
