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

const G = { units: [], over: false, result: null, rnd: Math.random, turns: 0, felled: 0, downed: 0 };
let uid = 0;
function makeUnit(type, x, y) {
  const T = TYPES[type];
  return { id: uid++, type, name: T.name, cls: T.cls, team: T.team, x, y, hp: T.hp, maxhp: T.hp, move: T.move, jump: T.jump, speed: T.speed,
    boss: !!T.boss, abil: T.ab.map(k => AB[k]), ct: 0, cd: 0, facing: 0, dead: false, moved: false, acted: false };
}
const alive = () => G.units.filter(u => !u.dead);
const unitAt = (x, y) => G.units.find(u => !u.dead && u.x === x && u.y === y);
const foesOf = u => G.units.filter(o => !o.dead && o.team !== u.team);
function nearestFoeDir(u) {
  let best = null, bd = 99;
  for (const f of foesOf(u)) { const d = dist(u.x, u.y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
  return best ? (dirTo(u.x, u.y, best.x, best.y) ?? u.facing) : u.facing;
}
function setupGame(seed) {
  uid = 0;
  Object.assign(G, { units: [], over: false, result: null, turns: 0, felled: 0, downed: 0, rnd: seed == null ? Math.random : mulberry(seed) });
  for (const [t, x, y] of START.crew) { const u = makeUnit(t, x, y); u.ct = 60 + u.speed * 3; G.units.push(u); }
  for (const [t, x, y] of START.foes) { const u = makeUnit(t, x, y); u.ct = 10 + Math.floor(G.rnd() * 30); G.units.push(u); }
  for (const u of G.units) u.facing = nearestFoeDir(u);
}

/* --- movement --- */
function reachable(u) {
  const start = { x: u.x, y: u.y, d: 0, prev: null, occupied: false };
  const m = new Map([[key(u.x, u.y), start]]), q = [start];
  while (q.length) {
    const c = q.shift();
    if (c.d >= u.move) continue;
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
function rangeTiles(a, u, cx, cy) {
  const out = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = dist(cx, cy, x, y);
    if (d < a.rmin || d > a.rmax || solid(x, y)) continue;
    if (a.melee && Math.abs(hAt(x, y) - hAt(cx, cy)) > 2) continue;
    out.set(key(x, y), { x, y });
  }
  return out;
}
function areaTiles(a, cx, cy, tx, ty) {
  let t = [[tx, ty]];
  if (a.shape === 'cross') t = [[tx, ty], ...DX.map((d, i) => [tx + d, ty + DY[i]])];
  else if (a.shape === 'ring') t = DX.map((d, i) => [cx + d, cy + DY[i]]);
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
function hitCalc(a, u, t) {
  let amt = a.power; const tags = [];
  if (a.shape === 'single' && (dirTo(t.x, t.y, u.x, u.y) - t.facing + 4) % 4 === 2) { amt = Math.round(amt * 1.5); tags.push('BACKSTAB'); }
  if (!a.melee) { const hb = Math.max(0, Math.min(3, hAt(u.x, u.y) - hAt(t.x, t.y))); if (hb) { amt += hb; tags.push('HIGH GROUND'); } }
  return { amt, tags };
}

/* --- resolution: mutates the logical state and returns animation steps --- */
function resolve(u, a, tx, ty) {
  const steps = [], kos = [];
  const d0 = dirTo(u.x, u.y, tx, ty); if (d0 !== null) u.facing = d0;
  const targets = targetsOf(a, u, u.x, u.y, tx, ty);
  steps.push([{ t: 'cast', u, a, tx, ty, tiles: areaTiles(a, u.x, u.y, tx, ty) }]);
  const hits = [];
  for (const t of targets) {
    if (a.kind === 'heal') { const amt = Math.min(a.power, t.maxhp - t.hp); t.hp += amt; hits.push({ t: 'heal', u: t, amt, hp: t.hp }); continue; }
    const hc = hitCalc(a, u, t);
    t.hp = Math.max(0, t.hp - hc.amt);
    hits.push({ t: 'hit', u: t, amt: hc.amt, tags: hc.tags, hp: t.hp, from: u, fire: a.anim === 'fireball' || a.anim === 'spark' });
    if (t.hp <= 0) { t.dead = true; kos.push(t); if (t.team === 'foe') G.felled++; else G.downed++; }
  }
  if (hits.length) steps.push(hits);
  if (kos.length) steps.push(kos.map(t => ({ t: 'ko', u: t, from: u })));
  if (a.cd) u.cd = a.cd + 1;
  u.acted = true;
  return { steps, kos };
}
function snapshot() { return G.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, dead: u.dead, facing: u.facing, acted: u.acted, moved: u.moved, cd: u.cd, felled: G.felled, downed: G.downed })); }
function restore(s) { G.units.forEach((u, i) => { const { felled, downed, ...rest } = s[i]; Object.assign(u, rest); }); G.felled = s[0].felled; G.downed = s[0].downed; }
function previewAction(u, a, tx, ty) {
  const S = snapshot(), R = resolve(u, a, tx, ty), list = [];
  for (const st of R.steps) for (const e of st) if (e.t === 'hit' || e.t === 'heal') list.push({ u: e.u, dhp: e.t === 'heal' ? e.amt : -e.amt, ko: e.u.dead, tags: e.tags || [] });
  restore(S);
  return list;
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
function startOfTurn(u) { u.moved = false; u.acted = false; if (u.cd > 0) u.cd--; }
function finishTurn(u) {
  u.ct -= 100; if (!u.moved) u.ct += 20; if (!u.acted) u.ct += 20;
  u.facing = nearestFoeDir(u);
  if (u.team === 'crew') G.turns++;
}
function checkState() {
  const crew = G.units.some(u => !u.dead && u.team === 'crew'), foe = G.units.some(u => !u.dead && u.team === 'foe');
  return !crew ? 'loss' : !foe ? 'win' : null;
}

/* --- AI (the Ebony set, and the Boxwood set when auto-playing) --- */
function aiChoose(u, sloppy) {
  const reach = reachable(u), foes = foesOf(u), S0 = snapshot(), ox = u.x, oy = u.y;
  const ranged = u.abil[0] && !u.abil[0].melee;
  let best = null;
  if (!u.acted) for (const n of reach.values()) {
    if (n.occupied || (u.moved && n.d > 0)) continue;
    let ps = -n.d * 0.05 + G.rnd() * (sloppy ? 5 : 0.4);
    if (ranged && foes.length) ps += 0.5 * hAt(n.x, n.y) + 0.3 * Math.min(4, Math.min(...foes.map(f => dist(n.x, n.y, f.x, f.y))));
    u.x = n.x; u.y = n.y;
    for (const a of u.abil) {
      if (a.cd && u.cd > 0) continue;
      for (const t of rangeTiles(a, u, n.x, n.y).values()) {
        const tg = targetsOf(a, u, n.x, n.y, t.x, t.y); if (!tg.length) continue;
        let s = 0;
        for (const o of tg) {
          if (a.kind === 'heal') { const amt = Math.min(a.power, o.maxhp - o.hp); s += amt >= 8 ? amt * 0.9 : amt * 0.2; }
          else { const { amt } = hitCalc(a, u, o); s += Math.min(amt, o.hp) + (amt >= o.hp ? 12 + (o.boss ? 20 : 0) : 0); }
        }
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
