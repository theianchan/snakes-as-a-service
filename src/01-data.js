/* ===== data: the room, the staff, the spirits ===== */
const W = 9, H = 9;
const HEIGHTS = [
  [3,3,3,1,1,1,1,1,1],
  [3,3,2,2,2,2,2,2,0],
  [2,2,0,0,0,0,0,0,0],
  [1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0],
  [1,0,0,1,1,0,0,0,0],
  [1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
];
// l loft, a aisle behind the bar, b bar top, s stairs, f floor, t high-top, p pool table, n bench
const KINDS = ['lllaaaaaa', 'llbbbbbbf', 'ssfffffff', 'ssfffffff', 'fffffftff', 'nffppffff', 'nffffffff', 'fffffffff', 'fffffffff'];
const PROPS = { '5,1': 'fountain', '0,0': 'piano' };

const AB = {
  bounce:    { name: 'Bounce', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 6, push: 2, anim: 'shove', info: '6 dmg · shoves 2 tiles' },
  eightysix: { name: 'Eighty-Six', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 9, stun: true, cd: 2, anim: 'melee', info: '9 dmg · target loses a turn' },
  splash:    { name: 'Splash', kind: 'hit', shape: 'single', rmin: 2, rmax: 4, power: 6, soak: true, anim: 'bottle', info: 'Range 2–4 · 6 dmg · soaks' },
  flambe:    { name: 'Flambé', kind: 'hit', shape: 'cross', rmin: 2, rmax: 4, power: 8, fire: true, cd: 1, anim: 'match', info: 'Range 2–4 · fire 8 in a plus' },
  pick:      { name: 'Ice Pick', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 8, anim: 'melee', info: 'Adjacent · 8 dmg' },
  vault:     { name: 'Vault', kind: 'hit', shape: 'single', melee: true, vault: true, rmin: 1, rmax: 1, power: 9, cd: 1, anim: 'vault', info: 'Leap over a spirit, strike 9' },
  tray:      { name: 'Tray Toss', kind: 'hit', shape: 'single', rmin: 1, rmax: 3, power: 6, soak: true, anim: 'tray', info: 'Range 1–3 · 6 dmg · soaks' },
  house:     { name: 'On the House', kind: 'heal', shape: 'single', rmin: 0, rmax: 3, power: 14, dry: true, cd: 1, anim: 'glass', info: 'Range 0–3 · heal 14 · dries off' },
  nip:       { name: 'Nip', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 6, anim: 'melee', info: 'Adjacent · 6 dmg' },
  spit:      { name: 'Spit', kind: 'hit', shape: 'single', rmin: 2, rmax: 4, power: 5, soak: true, anim: 'spit', info: 'Range 2–4 · 5 dmg · soaks' },
  slosh:     { name: 'Slosh', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 9, push: 1, anim: 'shove', info: 'Adjacent · 9 dmg · shoves 1' },
  sting:     { name: 'Sting', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 11, anim: 'melee', info: 'Adjacent · 11 dmg' },
  cube:      { name: 'Flaming Cube', kind: 'charge', shape: 'cross', rmin: 0, rmax: 5, power: 12, fire: true, cd: 1, delaySpeed: 12, anim: 'cube', info: 'Lands later · fire 12 in a plus' },
};
const PASSIVES = {
  counter:  ['Counter', 'Hits back for 5 when struck in melee.'],
  topshelf: ['Top Shelf', '+1 range from the bar top or the loft.'],
  encore:   ['Encore', 'Bottle a spirit and Kit acts again.'],
  water:    ['Water Round', 'Adjacent crew recover 3 HP when her turn starts.'],
  hover:    ['Hover', 'Flies over anything. Takes no fall damage.'],
};
const TYPES = {
  otto:  { name: 'Otto', cls: 'Bouncer',   team: 'crew', hp: 46, move: 4, jump: 2, speed: 7,  ab: ['bounce', 'eightysix'], passive: 'counter' },
  ines:  { name: 'Ines', cls: 'Bartender', team: 'crew', hp: 28, move: 4, jump: 2, speed: 8,  ab: ['splash', 'flambe'],    passive: 'topshelf' },
  kit:   { name: 'Kit',  cls: 'Barback',   team: 'crew', hp: 30, move: 5, jump: 3, speed: 11, ab: ['pick', 'vault'],       passive: 'encore' },
  june:  { name: 'June', cls: 'Server',    team: 'crew', hp: 30, move: 4, jump: 2, speed: 9,  ab: ['tray', 'house'],       passive: 'water' },
  wisp:  { name: 'Gin Wisp',    cls: 'Quick and spiteful', team: 'foe', hp: 18, move: 5, jump: 3, speed: 10, ab: ['nip'] },
  imp:   { name: 'Mezcal Imp',  cls: 'Spits from a distance', team: 'foe', hp: 16, move: 3, jump: 2, speed: 8, ab: ['spit'] },
  brute: { name: 'Rum Brute',   cls: 'Slow, heavy, pushy', team: 'foe', hp: 34, move: 3, jump: 1, speed: 6, ab: ['slosh'] },
  fairy: { name: 'Green Fairy', cls: 'Absinthe · the boss', team: 'foe', hp: 70, move: 4, jump: 9, speed: 7, ab: ['sting', 'cube'], passive: 'hover', boss: true },
  keg:   { name: 'Overproof Keg', cls: 'Explodes when struck', team: 'obj', hp: 1, move: 0, jump: 0, speed: 0, ab: [] },
};
const START = {
  crew: [['otto', 6, 6], ['kit', 4, 7], ['ines', 8, 7], ['june', 6, 8]],
  kegs: [[4, 3], [1, 5], [7, 4]],
  wave1: [['imp', 3, 1], ['wisp', 5, 3], ['wisp', 1, 3], ['brute', 6, 2]],
  wave2: [['fairy', 5, 0], ['wisp', 1, 1], ['imp', 7, 1], ['brute', 8, 0]],
};
const TOTAL_FOES = START.wave1.length + START.wave2.length;
const FALL_DMG = 3, SLAM_DMG = 4, FLARE_DMG = 4, KEG_DMG = 8, COUNTER_DMG = 5;
