/* ===== rules engine: no DOM in here ===== */
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const key = (x, y) => x + ',' + y;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const hAt = (x, y) => HEIGHTS[y][x];
const kindAt = (x, y) => KINDS[y][x];
const solid = (x, y) => !inb(x, y) || kindAt(x, y) === 'w' || !!PROPS[key(x, y)];
const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
function dirTo(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (!dx && !dy) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* --- the campaign: who is in the company and what they remember --- */
const Party = { chapter: 0, roster: ['knight', 'archer', 'mage', 'cleric'], xp: {}, firsts: {}, guests: [], finished: false };
const lvlOf = xp => XP_LV.filter(t => xp >= t).length;
const lvlOfType = t => lvlOf(Party.xp[t] || 0);
function loadLevel(i) { LV = LEVELS[i]; HEIGHTS = LV.h; KINDS = LV.k; PROPS = LV.props || {}; H = HEIGHTS.length; W = HEIGHTS[0].length; }
function abilitiesOf(type, lvl) { const T = TYPES[type], list = T.ab.slice(); if (T.learn && lvl >= 3) list.push(T.learn); return list.map(k => Object.assign({ key: k }, AB[k])); }

const G = { units: [], over: false, result: null, rnd: Math.random, turns: 0, felled: 0, downed: 0, gain: {}, reinforced: false };
let uid = 0;
function makeUnit(type, x, y, bonus = 0) {
  const T = TYPES[type], member = Party.roster.includes(type), lvl = member ? lvlOfType(type) : 1, pow = member ? lvl - 1 : bonus, hp = T.hp + (member ? (T.grow || 0) * (lvl - 1) : bonus * 4);
  return { id: uid++, type, name: T.name, cls: T.cls, team: T.team, x, y, hp, maxhp: hp, lvl, pow, move: T.move, jump: T.jump, speed: T.speed, backMult: T.backMult || 1.5,
    boss: !!T.boss, guest: !!T.guest, abil: abilitiesOf(type, lvl), ct: 0, cd: {}, facing: 0, stilled: false, dead: false, moved: false, acted: false };
}
const alive = () => G.units.filter(u => !u.dead);
const unitAt = (x, y) => G.units.find(u => !u.dead && u.x === x && u.y === y);
const foesOf = u => G.units.filter(o => !o.dead && o.team !== u.team);
function nearestFoeDir(u) {
  let best = null, bd = 99;
  for (const f of foesOf(u)) { const d = dist(u.x, u.y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
  return best ? (dirTo(u.x, u.y, best.x, best.y) ?? u.facing) : u.facing;
}
function freeNear(x, y) {
  const seen = new Set([key(x, y)]), q = [[x, y]];
  while (q.length) { const [cx, cy] = q.shift(); if (!solid(cx, cy) && !unitAt(cx, cy)) return [cx, cy];
    for (let i = 0; i < 4; i++) { const nx = cx + DX[i], ny = cy + DY[i]; if (inb(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); q.push([nx, ny]); } } }
  return [x, y];
}
function setupGame(seed) {
  uid = 0; loadLevel(Party.chapter);
  Object.assign(G, { units: [], over: false, result: null, turns: 0, felled: 0, downed: 0, gain: {}, reinforced: false, rnd: seed == null ? Math.random : mulberry(seed) });
  for (const [t, x, y] of LV.crew) if (Party.roster.includes(t)) { const u = makeUnit(t, x, y); u.ct = 60 + u.speed * 3; G.units.push(u); }
  for (const [t, x, y, b] of LV.foes) { const u = makeUnit(t, x, y, b || 0); u.ct = 10 + Math.floor(G.rnd() * 30); G.units.push(u); }
  for (const u of G.units) u.facing = nearestFoeDir(u);
}
function spawnReinforcements() {
  G.reinforced = true; const out = [];
  for (const [t, x, y] of LV.reinforce.units) { const [fx, fy] = freeNear(x, y), u = makeUnit(t, fx, fy); u.ct = 70; G.units.push(u); u.facing = nearestFoeDir(u); out.push(u); }
  return out;
}

/* --- movement --- */
function reachable(u) {
  const start = { x: u.x, y: u.y, d: 0, prev: null, occupied: false }, steps = u.stilled ? 0 : u.move;
  const m = new Map([[key(u.x, u.y), start]]), q = [start];
  while (q.length) {
    const c = q.shift();
    if (c.d >= steps) continue;
    for (let i = 0; i < 4; i++) {
      const nx = c.x + DX[i], ny = c.y + DY[i], k = key(nx, ny);
      if (solid(nx, ny) || m.has(k)) continue;
      if (Math.abs(hAt(nx, ny) - hAt(c.x, c.y)) > u.jump) continue;
      const o = unitAt(nx, ny);
      if (o && o !== u && o.team !== u.team) continue;
      const n = { x: nx, y: ny, d: c.d + 1, prev: c, occupied: !!o && o !== u };
      m.set(k, n); q.push(n);
    }
  }
  return m;
}
function distMap(sources, jump) {
  const m = new Map(), q = [];
  for (const s of sources) { m.set(key(s.x, s.y), 0); q.push([s.x, s.y]); }
  while (q.length) {
    const [x, y] = q.shift(), d = m.get(key(x, y));
    for (let i = 0; i < 4; i++) {
      const nx = x + DX[i], ny = y + DY[i], k = key(nx, ny);
      if (solid(nx, ny) || m.has(k) || Math.abs(hAt(nx, ny) - hAt(x, y)) > jump) continue;
      m.set(k, d + 1); q.push([nx, ny]);
    }
  }
  return m;
}

/* --- targeting --- */
const behind = t => [t.x - DX[t.facing], t.y - DY[t.facing]];
function rangeTiles(a, u, cx, cy) {
  const out = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = dist(cx, cy, x, y);
    if (d < a.rmin || d > a.rmax || solid(x, y)) continue;
    if (a.step) { const t = unitAt(x, y); if (!t || t.team === u.team) continue; const [bx, by] = behind(t), o = unitAt(bx, by); if (solid(bx, by) || (o && o !== u) || Math.abs(hAt(bx, by) - hAt(x, y)) > 2) continue; }
    else if (a.melee && Math.abs(hAt(x, y) - hAt(cx, cy)) > 2) continue;
    out.set(key(x, y), { x, y });
  }
  return out;
}
function areaTiles(a, cx, cy, tx, ty) {
  let t = [[tx, ty]];
  if (a.shape === 'cross') t = [[tx, ty], ...DX.map((d, i) => [tx + d, ty + DY[i]])];
  else if (a.shape === 'ring') t = DX.map((d, i) => [cx + d, cy + DY[i]]);
  else if (a.shape === 'aura') { t = []; for (let y = cy - a.radius; y <= cy + a.radius; y++) for (let x = cx - a.radius; x <= cx + a.radius; x++) if (dist(cx, cy, x, y) <= a.radius) t.push([x, y]); }
  return t.filter(([x, y]) => inb(x, y));
}
function targetsOf(a, u, cx, cy, tx, ty) {
  const out = [];
  for (const [x, y] of areaTiles(a, cx, cy, tx, ty)) {
    const t = unitAt(x, y); if (!t) continue;
    if (a.kind === 'heal' ? (t.team === u.team && t.hp < t.maxhp) : t.team !== u.team) {
      if (a.melee && a.shape === 'ring' && Math.abs(hAt(x, y) - hAt(cx, cy)) > 2) continue;
      out.push(t);
    }
  }
  return out;
}
const hasEffect = (a, u, tx, ty) => targetsOf(a, u, u.x, u.y, tx, ty).length > 0;
const ready = (u, a) => !(a.cd && u.cd[a.key] > 0);
function hitCalc(a, u, t) {
  let amt = a.power + u.pow; const tags = [];
  if (a.shape === 'single' && (dirTo(t.x, t.y, u.x, u.y) - t.facing + 4) % 4 === 2) { amt = Math.round(amt * u.backMult); tags.push('BACKSTAB'); }
  if (!a.melee && a.shape !== 'aura') { const hb = Math.max(0, Math.min(3, hAt(u.x, u.y) - hAt(t.x, t.y))); if (hb) { amt += hb; tags.push('HIGH GROUND'); } }
  return { amt, tags };
}

/* --- resolution: mutates the logical state and returns animation steps --- */
function resolve(u, a, tx, ty) {
  const steps = [], kos = [], hurt = (t, amt, tags, from, fire) => {
    t.hp = Math.max(0, t.hp - amt); const e = { t: 'hit', u: t, amt, tags, hp: t.hp, from, fire };
    if (t.hp <= 0 && !t.dead) { t.dead = true; kos.push(t); if (t.team === 'foe') G.felled++; else G.downed++; }
    return e;
  };
  const cast = { t: 'cast', u, a, tx, ty, tiles: areaTiles(a, u.x, u.y, tx, ty) };
  if (a.step) { const t = unitAt(tx, ty), [bx, by] = behind(t); cast.from = { x: u.x, y: u.y }; u.x = bx; u.y = by; cast.to = { x: bx, y: by }; }
  const d0 = dirTo(u.x, u.y, tx, ty); if (d0 !== null) u.facing = d0;
  const targets = targetsOf(a, u, u.x, u.y, tx, ty);
  steps.push([cast]);
  const hits = [], after = [];
  for (const t of targets) {
    if (a.kind === 'heal') { const was = t.hp, amt = Math.min(a.power + u.pow, t.maxhp - t.hp); t.hp += amt; hits.push({ t: 'heal', u: t, amt, hp: t.hp, brink: was <= t.maxhp * 0.25 }); continue; }
    const hc = hitCalc(a, u, t);
    hits.push(hurt(t, hc.amt, hc.tags, u, a.anim === 'fireball' || a.anim === 'spark'));
    if (t.dead) continue;
    if (a.still) { t.stilled = true; hits.push({ t: 'status', u: t }); }
    if (a.push) {
      const dir = d0, nx = t.x + DX[dir], ny = t.y + DY[dir];
      if (solid(nx, ny) || hAt(nx, ny) > hAt(t.x, t.y) || unitAt(nx, ny)) after.push(hurt(t, 4, ['SLAM'], u));
      else { const drop = hAt(t.x, t.y) - hAt(nx, ny), from = { x: t.x, y: t.y }; t.x = nx; t.y = ny; hits.push({ t: 'push', u: t, from, to: { x: nx, y: ny }, drop }); if (drop > 0) after.push(hurt(t, drop * 3, ['FALL'], u)); }
    }
  }
  if (hits.length) steps.push(hits);
  if (after.length) steps.push(after);
  if (kos.length) steps.push(kos.map(t => ({ t: 'ko', u: t, from: u })));
  if (a.cd) u.cd[a.key] = a.cd + 1;
  u.acted = true;
  return { steps, kos };
}
function snapshot() { return { felled: G.felled, downed: G.downed, units: G.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, dead: u.dead, facing: u.facing, acted: u.acted, moved: u.moved, stilled: u.stilled, cd: Object.assign({}, u.cd) })) }; }
function restore(s) { G.units.forEach((u, i) => Object.assign(u, s.units[i], { cd: Object.assign({}, s.units[i].cd) })); G.felled = s.felled; G.downed = s.downed; }
function previewAction(u, a, tx, ty) {
  const S = snapshot(), R = resolve(u, a, tx, ty), by = new Map();
  for (const st of R.steps) for (const e of st) {
    if (e.t !== 'hit' && e.t !== 'heal' && e.t !== 'status' && e.t !== 'push') continue;
    const p = by.get(e.u) || { u: e.u, dhp: 0, ko: false, tags: [], to: null }; by.set(e.u, p);
    if (e.t === 'hit') { p.dhp -= e.amt; for (const t of e.tags) if (!p.tags.includes(t)) p.tags.push(t); } else if (e.t === 'heal') p.dhp += e.amt; else if (e.t === 'status') p.tags.push('STILLED'); else p.to = e.to;
    p.ko = e.u.dead;
  }
  const moved = a.step ? { x: u.x, y: u.y } : null;
  restore(S);
  return { list: [...by.values()], moved };
}
/* --- what a unit takes away from what it just did: experience, and firsts --- */
function award(u, a, R) {
  if (u.team !== 'crew' || !Party.roster.includes(u.type)) return [];
  const g = G.gain[u.type] || (G.gain[u.type] = { xp: 0, firsts: [] }), had = k => (Party.firsts[u.type] || []).includes(k) || g.firsts.includes(k), fresh = [];
  const first = (k, label) => { if (!had(k)) { g.firsts.push(k); g.xp += 12; fresh.push(label); } };
  let n = 0;
  for (const st of R.steps) for (const e of st) {
    if (e.t === 'hit' && e.u.team !== u.team) { g.xp += e.amt; n++; if (e.tags.includes('BACKSTAB')) first('back', FIRSTS.back); if (e.tags.includes('HIGH GROUND')) first('high', FIRSTS.high); if (e.tags.includes('FALL')) first('push', FIRSTS.push); }
    else if (e.t === 'heal') { g.xp += e.amt; if (e.brink) first('save', FIRSTS.save); }
    else if (e.t === 'status') first('still', FIRSTS.still);
    else if (e.t === 'ko' && e.u.team !== u.team) { g.xp += 10; first('ko:' + e.u.type, 'First ' + TYPES[e.u.type].name + ' ' + (LV.win === 'boss' && e.u.boss ? 'bested' : 'beaten')); }
  }
  if (n > 1 && a.shape !== 'single') first('multi', FIRSTS.multi);
  first('ab:' + a.key, 'First ' + a.name);
  return fresh;
}
function bankGains(won) { // experience is kept even after a defeat
  const out = [];
  for (const t of Party.roster) {
    const g = G.gain[t] || { xp: 0, firsts: [] }, before = Party.xp[t] || 0, add = g.xp + (won ? 10 : 0);
    Party.xp[t] = before + add; Party.firsts[t] = (Party.firsts[t] || []).concat(g.firsts);
    const l0 = lvlOf(before), l1 = lvlOf(Party.xp[t]);
    out.push({ type: t, add, before, after: Party.xp[t], l0, l1, learned: l0 < 3 && l1 >= 3 ? AB[TYPES[t].learn].name : null, firsts: g.firsts });
  }
  G.gain = {};
  return out;
}

/* --- turn order --- */
function pickNext() {
  for (;;) {
    let best = null; for (const e of alive()) if (e.ct >= 100 && (!best || e.ct > best.ct)) best = e;
    if (best) return best;
    for (const e of alive()) e.ct += e.speed;
  }
}
function forecast(n, active) {
  const sim = alive().map(e => ({ e, ct: e.ct })), out = [];
  if (active) { out.push(active); const s = sim.find(s => s.e === active); if (s) s.ct -= 100; }
  let guard = 0;
  while (out.length < n && sim.length && guard++ < 4000) {
    let b = null; for (const s of sim) if (s.ct >= 100 && (!b || s.ct > b.ct)) b = s;
    if (b) { out.push(b.e); b.ct -= 100; } else for (const s of sim) s.ct += s.e.speed;
  }
  return out;
}
function startOfTurn(u) { u.moved = false; u.acted = false; for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--; }
function finishTurn(u) {
  u.ct -= 100; if (!u.moved) u.ct += 20; if (!u.acted) u.ct += 20;
  u.stilled = false; u.facing = nearestFoeDir(u);
  if (u.team === 'crew') G.turns++;
}
function checkState() {
  const crew = G.units.some(u => !u.dead && u.team === 'crew' && !u.guest), foe = G.units.some(u => !u.dead && u.team === 'foe');
  if (!crew) return 'loss';
  if (LV.win === 'boss') return G.units.some(u => u.boss && u.team === 'foe' && !u.dead) ? null : 'win';
  return foe ? null : 'win';
}
const reinforceDue = () => !!LV.reinforce && !G.reinforced && G.turns >= LV.reinforce.after;

/* --- AI (opponents, and the company when auto-playing): try every move-and-act, keep the best outcome --- */
function aiChoose(u) {
  const reach = reachable(u), foes = foesOf(u), S0 = snapshot(), ox = u.x, oy = u.y;
  const ranged = u.abil[0] && !u.abil[0].melee;
  let best = null;
  if (!u.acted) for (const n of reach.values()) {
    if (n.occupied || (u.moved && n.d > 0)) continue;
    let ps = -n.d * 0.05 + G.rnd() * 0.4;
    if (ranged && foes.length) ps += 0.5 * hAt(n.x, n.y) + 0.3 * Math.min(4, Math.min(...foes.map(f => dist(n.x, n.y, f.x, f.y))));
    for (const a of u.abil) {
      if (!ready(u, a)) continue;
      u.x = n.x; u.y = n.y;
      for (const t of [...rangeTiles(a, u, n.x, n.y).values()]) {
        u.x = n.x; u.y = n.y;
        if (!targetsOf(a, u, n.x, n.y, t.x, t.y).length && !a.step) continue;
        const R = resolve(u, a, t.x, t.y); let s = 0;
        G.units.forEach((o, i) => { const b = S0.units[i]; if (b.dead) return; const d = b.hp - o.hp;
          if (o.team !== u.team) { s += d; if (o.dead) s += 12 + (o.boss ? 20 : 0); if (o.stilled && !b.stilled && !o.dead) s += 3; }
          else if (d < 0) s += -d >= 6 ? -d * 0.9 : -d * 0.2; });
        restore(S0);
        if (s <= 0.5) continue;
        s += ps;
        if (!best || s > best.s) best = { s, n, a, tx: t.x, ty: t.y };
      }
    }
  }
  restore(S0); u.x = ox; u.y = oy;
  if (best) return best;
  if (u.moved || !foes.length) return { n: null };
  const dm = distMap(foes, u.jump); let dest = null, bd = Infinity;
  for (const n of reach.values()) {
    if (n.occupied) continue;
    const raw = dm.get(key(n.x, n.y)) ?? 99;
    const d = (ranged ? Math.abs(raw - 3) : raw) + n.d * 0.01 + G.rnd() * 0.05;
    if (d < bd) { bd = d; dest = n; }
  }
  return { n: dest };
}
