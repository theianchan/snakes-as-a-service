/* ===== data: the map, the Boxwood Company, the Crow Banner ===== */
const W = 8, H = 8;
const HEIGHTS = [
  [2, 2, 1, 1, 1, 2, 3, 3],
  [1, 1, 1, 1, 1, 1, 2, 3],
  [1, 0, 0, 1, 0, 0, 1, 1],
  [0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 0, 1, 0, 0, 1, 1],
  [2, 2, 1, 1, 0, 1, 1, 2],
  [2, 2, 1, 1, 1, 1, 2, 2],
];
// g grass, d dirt road, s stone, w water (impassable), b bridge, f ford (shallow, passable)
const KINDS = ['gggdgsss', 'gggdggss', 'gggdgggg', 'wwwbwwfw', 'gggdgggg', 'gggdgggg', 'gggdgggg', 'gggdgggg'];
const PROPS = { '0,4': 'tree', '1,2': 'tree', '5,5': 'tree', '7,2': 'rock', '5,0': 'tree' };

const AB = {
  sword:    { name: 'Sword', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 10, anim: 'melee', info: 'Adjacent · 10 damage' },
  cleave:   { name: 'Cleave', kind: 'hit', shape: 'ring', melee: true, rmin: 0, rmax: 0, power: 8, cd: 1, anim: 'spin', info: 'Every adjacent enemy · 8' },
  shoot:    { name: 'Shoot', kind: 'hit', shape: 'single', rmin: 2, rmax: 5, power: 8, anim: 'arrow', info: 'Range 2–5 · 8 damage' },
  power:    { name: 'Power Shot', kind: 'hit', shape: 'single', rmin: 2, rmax: 5, power: 14, cd: 2, anim: 'arrow', info: 'Range 2–5 · 14 damage' },
  spark:    { name: 'Spark', kind: 'hit', shape: 'single', rmin: 1, rmax: 3, power: 7, anim: 'spark', info: 'Range 1–3 · 7 damage' },
  fireball: { name: 'Fireball', kind: 'hit', shape: 'cross', rmin: 2, rmax: 4, power: 9, cd: 2, anim: 'fireball', info: 'Range 2–4 · 9 in a plus shape' },
  mace:     { name: 'Mace', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 6, anim: 'melee', info: 'Adjacent · 6 damage' },
  mend:     { name: 'Mend', kind: 'heal', shape: 'single', rmin: 0, rmax: 3, power: 12, cd: 1, anim: 'heal', info: 'Range 0–3 · restore 12 HP' },
  axe:      { name: 'Axe', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 7, anim: 'melee', info: 'Adjacent · 7 damage' },
  bow:      { name: 'Shortbow', kind: 'hit', shape: 'single', rmin: 2, rmax: 4, power: 6, anim: 'arrow', info: 'Range 2–4 · 6 damage' },
  great:    { name: 'Greatsword', kind: 'hit', shape: 'single', melee: true, rmin: 1, rmax: 1, power: 11, anim: 'melee', info: 'Adjacent · 11 damage' },
};
const TYPES = {
  knight:  { name: 'Rowan', cls: 'Knight', team: 'crew', hp: 40, move: 4, jump: 2, speed: 7, ab: ['sword', 'cleave'], blurb: 'Holds the line. Hits hard up close.' },
  archer:  { name: 'Wren',  cls: 'Archer', team: 'crew', hp: 26, move: 4, jump: 3, speed: 9, ab: ['shoot', 'power'], blurb: 'Long reach. Deadlier from high ground.' },
  mage:    { name: 'Ember', cls: 'Mage',   team: 'crew', hp: 22, move: 3, jump: 2, speed: 8, ab: ['spark', 'fireball'], blurb: 'Fragile. Burns several enemies at once.' },
  cleric:  { name: 'Hale',  cls: 'Cleric', team: 'crew', hp: 28, move: 4, jump: 2, speed: 8, ab: ['mace', 'mend'], blurb: 'Keeps everyone standing.' },
  raider:  { name: 'Raider',  cls: 'Crow Banner footman', team: 'foe', hp: 20, move: 4, jump: 2, speed: 8, ab: ['axe'] },
  bowman:  { name: 'Bowman',  cls: 'Crow Banner archer',  team: 'foe', hp: 14, move: 3, jump: 2, speed: 7, ab: ['bow'] },
  captain: { name: 'Captain', cls: 'Crow Banner captain', team: 'foe', hp: 40, move: 3, jump: 2, speed: 6, ab: ['great'], boss: true },
};
const START = {
  crew: [['knight', 3, 5], ['archer', 1, 6], ['mage', 4, 5], ['cleric', 3, 6]],
  foes: [['raider', 2, 1], ['raider', 4, 1], ['raider', 5, 2], ['bowman', 6, 1], ['captain', 3, 0]],
};
const TOTAL_FOES = START.foes.length, PAR_TURNS = 14;
