/* ===== rules engine: no DOM in here ===== */
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const key = (x, y) => x + ',' + y;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const hAt = (x, y) => HEIGHTS[y][x];
const solid = (x, y) => !inb(x, y) || !!PROPS[key(x, y)];
const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
function dirTo(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (!dx && !dy) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const G = { units: [], pending: [], bottled: 0, wave: 1, over: false, result: null, rnd: Math.random, turns: 0, bestChain: 0, downed: 0 };
let uid = 0;
function makeUnit(type, x, y) {
  const T = TYPES[type];
  return { id: uid++, type, name: T.name, cls: T.cls, team: T.team, x, y, hp: T.hp, maxhp: T.hp, move: T.move, jump: T.jump, speed: T.speed,
    passive: T.passive || null, boss: !!T.boss, abil: T.ab.map(k => AB[k]), ct: 0, cd: 0, facing: 0, soaked: 0, stunned: false, charging: null,
    dead: false, moved: false, acted: false };
}
const alive = () => G.units.filter(u => !u.dead);
const actors = () => G.units.filter(u => !u.dead && u.team !== 'obj');
const unitAt = (x, y) => G.units.find(u => !u.dead && u.x === x && u.y === y);
const foesOf = u => G.units.filter(o => !o.dead && o.team !== 'obj' && o.team !== u.team);
function nearestFoeDir(u) {
  let best = null, bd = 99;
  for (const f of foesOf(u)) { const d = dist(u.x, u.y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
  return best ? (dirTo(u.x, u.y, best.x, best.y) ?? u.facing) : u.facing;
}
function setupGame(seed) {
  uid = 0;
  Object.assign(G, { units: [], pending: [], bottled: 0, wave: 1, over: false, result: null, turns: 0, bestChain: 0, downed: 0,
    rnd: seed == null ? Math.random : mulberry(seed) });
  for (const [t, x, y] of START.crew) { const u = makeUnit(t, x, y); u.facing = 3; u.ct = 60 + u.speed * 3; G.units.push(u); }
  for (const [x, y] of START.kegs) G.units.push(makeUnit('keg', x, y));
  for (const [t, x, y] of START.wave1) { const u = makeUnit(t, x, y); u.ct = 20 + Math.floor(G.rnd() * 30); G.units.push(u); u.facing = nearestFoeDir(u); }
}
function freeNear(x, y) {
  const seen = new Set([key(x, y)]), q = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.shift();
    if (!solid(cx, cy) && !unitAt(cx, cy)) return [cx, cy];
    for (let i = 0; i < 4; i++) { const nx = cx + DX[i], ny = cy + DY[i]; if (inb(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); q.push([nx, ny]); } }
  }
  return [x, y];
}
function spawnWave2() {
  G.wave = 2; const out = [];
  for (const [t, x, y] of START.wave2) {
    const [fx, fy] = freeNear(x, y), u = makeUnit(t, fx, fy);
    u.ct = t === 'fairy' ? 55 : 10 + Math.floor(G.rnd() * 30);
    G.units.push(u); u.facing = nearestFoeDir(u); out.push(u);
  }
  return out;
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
function maxRange(a, u, cx, cy) { return a.rmax + (u.passive === 'topshelf' && a.rmax > 1 && hAt(cx, cy) >= 2 ? 1 : 0); }
function rangeTiles(a, u, cx, cy) {
  const out = new Map(), rmax = maxRange(a, u, cx, cy);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = dist(cx, cy, x, y);
    if (d < a.rmin || d > rmax || solid(x, y)) continue;
    if (a.melee && Math.abs(hAt(x, y) - hAt(cx, cy)) > 2) continue;
    if (a.vault) {
      const o = unitAt(x, y); if (!o || o.team === 'obj' || o.team === u.team) continue;
      const dd = dirTo(cx, cy, x, y), lx = x + DX[dd], ly = y + DY[dd];
      if (solid(lx, ly) || unitAt(lx, ly) || Math.abs(hAt(lx, ly) - hAt(cx, cy)) > 3) continue;
    }
    out.set(key(x, y), { x, y });
  }
  return out;
}
function areaTiles(a, tx, ty) {
  const t = a.shape === 'cross' ? [[tx, ty], ...DX.map((d, i) => [tx + d, ty + DY[i]])] : [[tx, ty]];
  return t.filter(([x, y]) => inb(x, y));
}
function hasEffect(a, u, tx, ty) {
  if (a.kind === 'charge') return true;
  for (const [x, y] of areaTiles(a, tx, ty)) {
    const t = unitAt(x, y); if (!t) continue;
    if (a.kind === 'heal') { if (t.team === u.team && (t.hp < t.maxhp || t.soaked)) return true; }
    else if (t !== u) return true;
  }
  return false;
}
function hitCalc(a, u, t) {
  let amt = a.power, tag = '';
  if (a.shape === 'single' && t.team !== 'obj') {
    const rel = (dirTo(t.x, t.y, u.x, u.y) - t.facing + 4) % 4;
    if (rel === 2) { amt = Math.round(amt * 1.5); tag = 'BACK'; } else if (rel !== 0) { amt = Math.round(amt * 1.25); tag = 'SIDE'; }
  }
  if (!a.melee) { const hb = Math.max(0, Math.min(3, hAt(u.x, u.y) - hAt(t.x, t.y))); if (hb) { amt += hb; tag = tag || 'HIGH'; } }
  return { amt, tag };
}

/* --- resolution: mutates the logical state and returns animation steps --- */
function newR() { const R = { steps: [], cur: null, blasts: [], kos: [], encore: false }; stepR(R); return R; }
function stepR(R) { if (!R.cur || R.cur.length) { R.cur = []; R.steps.push(R.cur); } }
function cancelCharge(R, t) {
  if (t.charging == null) return;
  G.pending = G.pending.filter(p => p.id !== t.charging); t.charging = null;
  R.cur.push({ t: 'fizzle', u: t });
}
function damage(R, t, amt, o = {}) {
  if (t.dead) return;
  if (t.team === 'obj') { t.dead = true; t.hp = 0; R.cur.push({ t: 'explode', u: t, x: t.x, y: t.y }); R.blasts.push({ from: t, power: KEG_DMG, keg: true }); return; }
  let ignited = false;
  if (o.fire && t.soaked) { amt *= 2; t.soaked = 0; ignited = true; }
  amt = Math.max(1, Math.round(amt));
  t.hp = Math.max(0, t.hp - amt);
  R.cur.push({ t: 'hit', u: t, amt, tag: ignited ? 'IGNITED' : (o.tag || ''), fire: !!o.fire, ignited, hp: t.hp });
  if (ignited) R.blasts.push({ from: t, power: FLARE_DMG });
  if (t.hp <= 0) { t.dead = true; R.kos.push(t); if (t.team === 'foe') G.bottled++; else G.downed++; cancelCharge(R, t); R.cur.push({ t: 'ko', u: t }); }
}
function flush(R) {
  while (R.blasts.length) {
    const b = R.blasts.shift(), bx = b.from.x, by = b.from.y;
    stepR(R); R.cur.push({ t: 'flare', x: bx, y: by, keg: !!b.keg });
    for (let i = 0; i < 4; i++) { const t = unitAt(bx + DX[i], by + DY[i]); if (t) damage(R, t, b.power, { fire: true }); }
  }
}
function push(R, t, dir, n) {
  const path = []; let slam = false, other = null, fall = 0;
  for (let i = 0; i < n; i++) {
    const nx = t.x + DX[dir], ny = t.y + DY[dir];
    if (solid(nx, ny) || hAt(nx, ny) > hAt(t.x, t.y)) { slam = true; break; }
    const o = unitAt(nx, ny); if (o) { other = o; break; }
    const drop = hAt(t.x, t.y) - hAt(nx, ny);
    t.x = nx; t.y = ny; path.push({ x: nx, y: ny, drop });
    if (drop > 0 && t.passive !== 'hover') fall += drop * FALL_DMG;
  }
  R.cur.push({ t: 'push', u: t, path, dir, bump: slam || !!other });
  if (fall || slam || other) {
    stepR(R);
    if (fall) damage(R, t, fall, { tag: 'FALL' });
    if (slam) damage(R, t, SLAM_DMG, { tag: 'SLAM' });
    if (other) { damage(R, t, SLAM_DMG, { tag: 'CRASH' }); damage(R, other, SLAM_DMG, { tag: 'CRASH' }); }
  }
}
function resolve(u, a, tx, ty) {
  const R = newR(), fx = u.x, fy = u.y;
  const d0 = dirTo(u.x, u.y, tx, ty); if (d0 !== null) u.facing = d0;
  R.cur.push({ t: 'cast', u, a, tx, ty, fx, fy });
  if (a.kind === 'heal') {
    const t = unitAt(tx, ty); stepR(R);
    if (t && t.team === u.team) { const amt = Math.min(a.power, t.maxhp - t.hp); t.hp += amt; const dried = !!a.dry && t.soaked > 0; if (dried) t.soaked = 0; R.cur.push({ t: 'heal', u: t, amt, hp: t.hp, dried }); }
  } else if (a.kind === 'charge') {
    const p = { id: 'p' + (uid++), pending: true, owner: u.id, tx, ty, tiles: areaTiles(a, tx, ty), ct: 0, speed: a.delaySpeed, power: a.power, name: a.name };
    G.pending.push(p); u.charging = p.id; R.cur.push({ t: 'charge', u, p });
  } else {
    if (a.vault) { const lx = tx + DX[d0], ly = ty + DY[d0]; u.x = lx; u.y = ly; u.facing = (d0 + 2) % 4; R.cur.push({ t: 'vault', u, ox: tx, oy: ty, lx, ly }); }
    stepR(R);
    const tiles = areaTiles(a, tx, ty), targets = [];
    R.cur.push({ t: 'impact', a, tiles, tx, ty });
    for (const [x, y] of tiles) { const t = unitAt(x, y); if (t && t !== u) targets.push(t); }
    for (const t of targets) {
      const hc = hitCalc(a, u, t);
      damage(R, t, hc.amt, { fire: a.fire, tag: hc.tag });
      if (!t.dead && t.team !== 'obj') {
        if (a.soak) { t.soaked = 2; R.cur.push({ t: 'status', u: t, soaked: true }); }
        if (a.stun) { t.stunned = true; R.cur.push({ t: 'status', u: t, stun: true }); cancelCharge(R, t); }
      }
    }
    if (a.push) for (const t of targets) if (!t.dead) { stepR(R); push(R, t, d0, a.push); }
    flush(R);
    const t0 = targets[0];
    if (a.melee && t0 && t0.passive === 'counter' && !t0.dead && !t0.stunned && !u.dead && dist(u.x, u.y, t0.x, t0.y) === 1) {
      stepR(R); R.cur.push({ t: 'counter', u: t0, target: u }); damage(R, u, COUNTER_DMG, { tag: 'COUNTER' }); flush(R);
    }
  }
  if (a.cd) u.cd = a.cd + 1;
  u.acted = true;
  const bottledNow = R.kos.filter(k => k.team === 'foe').length;
  if (bottledNow > G.bestChain) G.bestChain = bottledNow;
  if (u.passive === 'encore' && !u.dead && bottledNow) { u.acted = false; u.moved = false; R.encore = true; stepR(R); R.cur.push({ t: 'encore', u }); }
  R.steps = R.steps.filter(s => s.length);
  return R;
}
function resolvePending(p) {
  const R = newR();
  G.pending = G.pending.filter(q => q.id !== p.id);
  const o = G.units.find(u => u.id === p.owner); if (o) o.charging = null;
  R.cur.push({ t: 'cubeland', p, tiles: p.tiles });
  stepR(R);
  for (const [x, y] of p.tiles) { const t = unitAt(x, y); if (t) damage(R, t, p.power, { fire: true }); }
  flush(R);
  const n = R.kos.filter(k => k.team === 'foe').length; if (n > G.bestChain) G.bestChain = n;
  R.steps = R.steps.filter(s => s.length);
  return R;
}
function snapshot() {
  return { n: G.units.length, bottled: G.bottled, bestChain: G.bestChain, downed: G.downed, pending: G.pending.map(p => ({ ...p })),
    units: G.units.map(u => ({ x: u.x, y: u.y, hp: u.hp, dead: u.dead, soaked: u.soaked, stunned: u.stunned, charging: u.charging, facing: u.facing, acted: u.acted, moved: u.moved, cd: u.cd, ct: u.ct })) };
}
function restore(s) {
  G.units.length = s.n; G.units.forEach((u, i) => Object.assign(u, s.units[i]));
  G.pending = s.pending.map(p => ({ ...p })); G.bottled = s.bottled; G.bestChain = s.bestChain; G.downed = s.downed;
}
function previewAction(u, a, tx, ty) {
  const S = snapshot(), R = resolve(u, a, tx, ty), list = [];
  G.units.forEach((t, i) => {
    const b = S.units[i], tags = new Set();
    for (const st of R.steps) for (const e of st) if (e.u === t && e.t === 'hit' && e.tag) tags.add(e.tag);
    const dhp = t.hp - b.hp, moved = t.x !== b.x || t.y !== b.y, boom = t.team === 'obj' && t.dead && !b.dead;
    const soak = t.soaked && !b.soaked, dry = !t.soaked && b.soaked && dhp >= 0, stun = t.stunned && !b.stunned, cancel = b.charging != null && t.charging == null && !t.dead;
    if (dhp || moved || boom || soak || dry || stun) list.push({ u: t, dhp, ko: t.dead && !b.dead, boom, tags: [...tags], to: moved ? { x: t.x, y: t.y } : null, soak, dry, stun, cancel });
  });
  const encore = R.encore;
  restore(S);
  return { list, encore };
}

/* --- turn order --- */
function pickNext() {
  for (;;) {
    const ents = [...G.pending, ...actors()];
    let best = null; for (const e of ents) if (e.ct >= 100 && (!best || e.ct > best.ct)) best = e;
    if (best) return best;
    for (const e of ents) e.ct += e.speed;
  }
}
function forecast(n, active) {
  const sim = [...G.pending, ...actors()].map(e => ({ e, ct: e.ct, speed: e.speed })), out = [];
  if (active) { out.push(active); const s = sim.find(s => s.e === active); if (s) s.ct -= 100; }
  let guard = 0;
  while (out.length < n && sim.length && guard++ < 4000) {
    let b = null; for (const s of sim) if (s.ct >= 100 && (!b || s.ct > b.ct)) b = s;
    if (b) { out.push(b.e); if (b.e.pending) sim.splice(sim.indexOf(b), 1); else b.ct -= 100; }
    else for (const s of sim) s.ct += s.speed;
  }
  return out;
}
function startOfTurn(u) {
  u.moved = false; u.acted = false; if (u.cd > 0) u.cd--;
  if (u.stunned) { u.stunned = false; return { skip: 'stun' }; }
  if (u.charging != null) return { skip: 'charge' };
  if (u.passive === 'water') {
    const ev = [];
    for (let i = 0; i < 4; i++) { const t = unitAt(u.x + DX[i], u.y + DY[i]); if (t && t.team === u.team && t.hp < t.maxhp) { const amt = Math.min(3, t.maxhp - t.hp); t.hp += amt; ev.push({ t: 'heal', u: t, amt, hp: t.hp, aura: true }); } }
    if (ev.length) return { skip: null, steps: [ev] };
  }
  return { skip: null };
}
function finishTurn(u, skipped) {
  u.ct -= 100;
  if (!skipped) { if (!u.moved) u.ct += 20; if (!u.acted) u.ct += 20; }
  if (u.soaked > 0) u.soaked--;
  if (u.team === 'crew') G.turns++;
}
function checkState() { // returns 'wave2' | 'win' | 'loss' | null
  const crew = G.units.some(u => !u.dead && u.team === 'crew'), foe = G.units.some(u => !u.dead && u.team === 'foe');
  if (!crew) return 'loss';
  if (G.wave === 1 && (G.bottled >= 2 || !foe)) return 'wave2';
  if (!foe) return 'win';
  return null;
}

/* --- AI (spirits, and the crew when auto-playing) --- */
const inZone = (x, y) => G.pending.some(p => p.tiles.some(([a, b]) => a === x && b === y));
function evalOutcome(u, before, R) {
  let s = 0;
  G.units.forEach((t, i) => {
    const b = before.units[i]; if (!b || b.dead || t.team === 'obj') return;
    const dmg = b.hp - t.hp;
    if (t.team !== u.team) {
      s += dmg; if (t.dead) s += 14 + (t.boss ? 30 : 0);
      if (t.soaked && !b.soaked) s += 2.5;
      if (t.stunned && !b.stunned) s += b.charging != null ? 16 : 7;
    } else {
      if (dmg > 0) { s -= dmg * 1.6; if (t.dead) s -= 25; }
      else if (dmg < 0) s += -dmg >= 8 ? -dmg * 0.9 : -dmg * 0.2;
      if (b.soaked && !t.soaked && dmg <= 0) s += 3;
    }
  });
  if (R.encore) s += 6;
  return s;
}
function aiChoose(u) {
  const reach = reachable(u), foes = foesOf(u), S0 = snapshot(), ox = u.x, oy = u.y;
  const ranged = u.abil[0] && !u.abil[0].melee;
  const pos = n => {
    let s = -n.d * 0.05 + G.rnd() * 0.4;
    if (inZone(n.x, n.y)) s -= 12;
    if (ranged && foes.length) s += 0.5 * hAt(n.x, n.y) + 0.3 * Math.min(4, Math.min(...foes.map(f => dist(n.x, n.y, f.x, f.y))));
    return s;
  };
  let best = null;
  if (!u.acted) for (const n of reach.values()) {
    if (n.occupied || (u.moved && n.d > 0)) continue;
    const ps = pos(n);
    u.x = n.x; u.y = n.y;
    for (const a of u.abil) {
      if (a.cd && u.cd > 0) continue;
      for (const t of rangeTiles(a, u, n.x, n.y).values()) {
        let s;
        if (a.kind === 'charge') {
          s = 0;
          for (const [x, y] of areaTiles(a, t.x, t.y)) {
            if (x === n.x && y === n.y) { s -= 15; continue; }
            const o = unitAt(x, y); if (!o || o.team === 'obj') continue;
            const v = o.soaked ? 20 : 10; s += o.team !== u.team ? v * 0.7 : -v;
          }
          if (s < 6) continue;
        } else {
          if (!hasEffect(a, u, t.x, t.y)) continue;
          const R = resolve(u, a, t.x, t.y); s = evalOutcome(u, S0, R);
          restore(S0); u.x = n.x; u.y = n.y;
          if (s <= 0.5) continue;
        }
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
    const d = (ranged ? Math.abs(raw - 3) : raw) + n.d * 0.01 + (inZone(n.x, n.y) ? 20 : 0) + G.rnd() * 0.05;
    if (d < bd) { bd = d; dest = n; }
  }
  return { n: dest };
}
