// ============================================================
//  LUAKBS – Level Up to Kill Bosses
//  test.js  –  Simple Node.js test suite (no external deps)
// ============================================================

const { Player, Enemy, Weapon, ENEMIES, WEAPONS } = require('./game.js');

// ── Minimal assertion helpers ─────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────`);
}

// ─────────────────────────────────────────────
//  Player – construction defaults
// ─────────────────────────────────────────────
section('Player defaults');
const p = new Player('TestHero');
assert(p.level === 1,           'starts at level 1');
assert(p.exp   === 0,           'starts with 0 exp');
assert(p.gold  === 0,           'starts with 0 gold');
assert(p.gems  === 0,           'starts with 0 gems');
assert(p.statPoints === 0,      'starts with 0 stat points');
assert(p.stats.strength  === 5, 'default strength 5');
assert(p.stats.vitality  === 5, 'default vitality 5');
assert(p.stats.dexterity === 5, 'default dexterity 5');
assert(p.stats.luck      === 5, 'default luck 5');
assert(p.weapon instanceof Weapon, 'starts with a Weapon');

// ─────────────────────────────────────────────
//  Leveling
// ─────────────────────────────────────────────
section('Leveling');
const p2 = new Player();
const threshold = p2.expToNextLevel; // should be 100 at level 1
p2.gainExp(threshold);
assert(p2.level === 2,          'levels up when exp >= threshold');
assert(p2.statPoints === 3,     'gains 3 stat points on level up');
assert(p2.exp < p2.expToNextLevel, 'exp resets after level up');

// Multiple level-ups from a single huge XP gain
const p3 = new Player();
p3.gainExp(99999);
assert(p3.level > 5,            'can level multiple times from big XP gain');

// ─────────────────────────────────────────────
//  Stat allocation
// ─────────────────────────────────────────────
section('Stat allocation');
const p4 = new Player();
p4.gainExp(p4.expToNextLevel);   // level up → 3 pts
assert(p4.statPoints === 3,      'has 3 stat points after level up');
const prevStr = p4.stats.strength;
p4.allocateStat('strength');
assert(p4.stats.strength === prevStr + 1, 'strength increased by 1');
assert(p4.statPoints     === 2,           'stat points decremented');
const ok = p4.allocateStat('strength');
const ok2 = p4.allocateStat('strength');
const fail = p4.allocateStat('strength'); // no points left
assert(fail === false,                    'returns false when no stat points');
const badStat = p4.allocateStat('nonexistent');
assert(badStat === false,                 'returns false for unknown stat');

// ─────────────────────────────────────────────
//  Weapon
// ─────────────────────────────────────────────
section('Weapon');
const w = new Weapon('Test Blade', 25, 'rare');
assert(w.name === 'Test Blade',  'weapon name correct');
assert(w.baseDamage === 25,      'weapon base damage correct');
assert(w.rarity === 'rare',      'weapon rarity correct');

const p5 = new Player();
p5.equipWeapon(w);
assert(p5.weapon === w,          'weapon equip works');
assert(p5.baseDamage() === 25 + p5.stats.strength * 2, 'baseDamage uses weapon + strength*2');

// ─────────────────────────────────────────────
//  Enemy
// ─────────────────────────────────────────────
section('Enemy');
const e = new Enemy('TestMob', 50, 10, 30, 15, 0.2);
assert(e.hp     === 50,          'enemy HP initialized');
assert(e.isAlive(),              'enemy alive at full HP');
e.hp = 0;
assert(!e.isAlive(),             'enemy dead at 0 HP');
e.reset();
assert(e.hp === 50,              'enemy resets to full HP');

// ─────────────────────────────────────────────
//  Combat – attackEnemy
// ─────────────────────────────────────────────
section('Combat – attackEnemy');
const attacker = new Player();
const target   = new Enemy('Dummy', 1000, 5, 0, 0, 0);
const dmg = attacker.attackEnemy(target, 1.0);
assert(dmg >= 1,                 'attack deals at least 1 damage');
assert(target.hp < target.maxHp, 'enemy HP reduced after attack');

// Timing multiplier affects damage
const target2 = new Enemy('Dummy2', 1000, 5, 0, 0, 0);
const dmgHigh = attacker.attackEnemy(target2, 2.0); // perfect hit
const target3 = new Enemy('Dummy3', 1000, 5, 0, 0, 0);
const dmgMiss  = attacker.attackEnemy(target3, 0.0); // miss → 0 damage
assert(dmgHigh >= 1, 'perfect hit deals >= 1 damage');
assert(dmgMiss === 0, 'miss (multiplier 0) deals 0 damage');

// ─────────────────────────────────────────────
//  Sample data
// ─────────────────────────────────────────────
section('Sample data');
assert(ENEMIES.length >= 3,      'at least 3 sample enemies');
assert(WEAPONS.length >= 3,      'at least 3 sample weapons');

// ─────────────────────────────────────────────
//  TimingBar (requires manual override of perf)
// ─────────────────────────────────────────────
section('TimingBar (logic only)');
// Stub browser globals
global.performance = global.performance ?? { now: () => Date.now() };
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);

const { TimingBar } = require('./timing.js');

const tb = new TimingBar({ hitZoneMin: 38, hitZoneMax: 62, perfectRadius: 5, goodRadius: 11 });

// Perfect centre = 50
const r1 = tb.calculateTimingMultiplier(50);
assert(r1.quality === 'perfect' && r1.multiplier === 2.0, 'centre → perfect x2');

// Good zone
const r2 = tb.calculateTimingMultiplier(44);
assert(r2.quality === 'good' && r2.multiplier === 1.5, 'near-centre → good x1.5');

// Bad (inside hit zone but outside good zone)
// good zone spans center ± goodRadius → 50 ± 11 → [39, 61]
// hit zone spans [38, 62] — so position 38 is inside hit zone but outside good zone
const r3 = tb.calculateTimingMultiplier(38);
assert(r3.quality === 'bad' && r3.multiplier === 1.0, 'edge of hit zone → bad x1');

// Miss
const r4 = tb.calculateTimingMultiplier(10);
assert(r4.quality === 'miss' && r4.multiplier === 0, 'outside zone → miss x0 (no damage)');

// updateMarkerPosition
tb.position  = 95;
tb.direction = 1;
tb.updateMarkerPosition(1.0);  // speed 50 → position would exceed 100
assert(tb.position === 100 && tb.direction === -1, 'marker bounces at 100');

tb.position  = 5;
tb.direction = -1;
tb.updateMarkerPosition(1.0);
assert(tb.position === 0 && tb.direction === 1,  'marker bounces at 0');

// Speed scaling with level
tb.setSpeedForLevel(1);
assert(tb.speed === 45, 'speed 45 at level 1');
tb.setSpeedForLevel(10);
assert(tb.speed === 90, 'speed 90 at level 10');

// ─────────────────────────────────────────────
//  Summary
// ─────────────────────────────────────────────
console.log(`\n════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
