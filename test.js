// ============================================================
//  LUAKBS – Level Up to Kill Bosses
//  test.js  –  Simple Node.js test suite (no external deps)
// ============================================================

const { Player, Enemy, Weapon, ENEMIES, WEAPONS, CRAFTING_RECIPES, RACES, RACE_WEIGHTS, RACE_WEIGHTS_TOTAL, rollRandomRace, getRerollDropChance } = require('./game.js');

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
assert(p.craftedWeapons.length === 1,   'starter weapon added to craftedWeapons');
assert(p.craftedWeapons[0] === p.weapon, 'starter weapon is the crafted weapon in slot 0');

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
p5.race = 'Human'; // neutral multiplier so baseDamage = weapon + strength*1.5
p5.craftedWeapons.push(w); // mark as crafted so it can be equipped
p5.equipWeapon(w);
assert(p5.weapon === w,          'weapon equip works');
assert(p5.baseDamage() === Math.floor(25 + p5.stats.strength * 1.5), 'baseDamage uses weapon + strength*1.5');

// Equipping an uncrafted weapon that is not in WEAPONS array should be blocked
const uncrafted = new Weapon('Uncrafted Blade', 30, 'common');
const equipBlocked = p5.equipWeapon(uncrafted);
assert(equipBlocked === false, 'cannot equip a weapon that has not been crafted');

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
assert(Array.isArray(CRAFTING_RECIPES) && CRAFTING_RECIPES.length >= 1, 'CRAFTING_RECIPES defined');

// ─────────────────────────────────────────────
//  Enemy drop tables
// ─────────────────────────────────────────────
section('Enemy drop tables');
const slime = ENEMIES[0]; // Slime
assert(Array.isArray(slime.dropTable),              'Slime has a dropTable');
assert(slime.dropTable.length >= 1,                 'Slime drop table has entries');
const drop = slime.dropTable[0];
assert(typeof drop.itemName   === 'string',         'drop has itemName');
assert(typeof drop.dropChance === 'number',         'drop has dropChance');
assert(typeof drop.minAmount  === 'number',         'drop has minAmount');
assert(typeof drop.maxAmount  === 'number',         'drop has maxAmount');
assert(drop.minAmount <= drop.maxAmount,            'minAmount <= maxAmount');

// ─────────────────────────────────────────────
//  addItemToInventory
// ─────────────────────────────────────────────
section('addItemToInventory');
const pi = new Player();
pi.addItemToInventory('Iron Ore', 3);
assert(pi.inventory['Iron Ore'] === 3,              'adds new item to inventory');
pi.addItemToInventory('Iron Ore', 2);
assert(pi.inventory['Iron Ore'] === 5,              'stacks quantities');
pi.addItemToInventory('Wood', 1);
assert(pi.inventory['Wood'] === 1,                  'tracks multiple item types');

// ─────────────────────────────────────────────
//  rollItemDrops
// ─────────────────────────────────────────────
section('rollItemDrops');
const pr = new Player();
// Enemy with guaranteed drops (dropChance 1.0)
const guaranteedEnemy = new Enemy('GDummy', 10, 1, 0, 0, 0, [
  { itemName: 'Test Item', dropChance: 1.0, minAmount: 2, maxAmount: 2 },
]);
const drops = pr.rollItemDrops(guaranteedEnemy);
assert(drops.length === 1,                                     'guaranteed drop returned');
assert(drops[0].itemName === 'Test Item',                      'drop item name correct');
assert(drops[0].amount   === 2,                                'drop amount correct');
assert(pr.inventory['Test Item'] === 2,                        'item added to inventory');

// Enemy with no drops
const noDropEnemy = new Enemy('NDummy', 10, 1, 0, 0, 0, []);
const noDrops = pr.rollItemDrops(noDropEnemy);
assert(noDrops.length === 0,                                   'empty drop table returns []');

// ─────────────────────────────────────────────
//  hasMaterials
// ─────────────────────────────────────────────
section('hasMaterials');
const ph = new Player();
ph.addItemToInventory('Iron Ore', 5);
ph.addItemToInventory('Wood', 2);
ph.gold = 300;
const recipe = CRAFTING_RECIPES.find(r => r.name === 'Iron Sword');
assert(recipe !== undefined,                                   'Iron Sword recipe exists');
assert(ph.hasMaterials(recipe) === true,                       'hasMaterials true when sufficient');
ph.gold = 50; // not enough gold
assert(ph.hasMaterials(recipe) === false,                      'hasMaterials false when insufficient gold');
ph.gold = 300;
ph.inventory['Iron Ore'] = 2; // not enough ore
assert(ph.hasMaterials(recipe) === false,                      'hasMaterials false when insufficient item');

// ─────────────────────────────────────────────
//  craftItem
// ─────────────────────────────────────────────
section('craftItem');
const pc = new Player();
pc.addItemToInventory('Iron Ore', 5);
pc.addItemToInventory('Wood', 2);
pc.gold = 300;
const ironRecipe = CRAFTING_RECIPES.find(r => r.name === 'Iron Sword');
const crafted = pc.craftItem(ironRecipe);
assert(crafted instanceof Weapon,                              'craftItem returns a Weapon');
assert(crafted.name === 'Iron Sword',                         'crafted weapon has correct name');
assert(crafted.baseDamage === ironRecipe.weapon.baseDamage,   'crafted weapon has correct damage');
assert(crafted.rarity === ironRecipe.weapon.rarity,           'crafted weapon has correct rarity');
assert(pc.craftedWeapons.includes(crafted),                   'crafted weapon added to craftedWeapons');
assert((pc.inventory['Iron Ore'] || 0) === 0,                 'materials deducted from inventory');
assert((pc.inventory['Wood'] || 0) === 0,                     'wood deducted from inventory');
assert(pc.gold === 0,                                         'gold deducted');

// Cannot craft without materials
const failCraft = pc.craftItem(ironRecipe);
assert(failCraft === null,                                     'craftItem returns null when missing materials');

// Damage formula uses crafted weapon
pc.equipWeapon(crafted);
pc.race = 'Human'; // neutral multiplier
assert(pc.baseDamage() === Math.floor(crafted.baseDamage + pc.stats.strength * 1.5),
  'damage = floor(weaponDamage + strength*1.5) for crafted weapon');

// WEAPONS array items cannot be equipped directly (not in craftedWeapons)
const shopWeapon = WEAPONS[1]; // Iron Blade from WEAPONS array
const shopEquipBlocked = pc.equipWeapon(shopWeapon);
assert(shopEquipBlocked === false,                             'cannot equip a WEAPONS-array item without crafting');

// ─────────────────────────────────────────────
//  checkWeaponCrafted
// ─────────────────────────────────────────────
section('checkWeaponCrafted');
const pcw = new Player();
assert(pcw.checkWeaponCrafted(pcw.weapon) === true,           'starter weapon is considered crafted');
const uncraftedW = new Weapon('Raw Steel', 40, 'rare');
assert(pcw.checkWeaponCrafted(uncraftedW) === false,          'new uncrafted weapon returns false');
pcw.craftedWeapons.push(uncraftedW);
assert(pcw.checkWeaponCrafted(uncraftedW) === true,           'returns true after pushing to craftedWeapons');

// ─────────────────────────────────────────────
//  getWeaponStats
// ─────────────────────────────────────────────
section('getWeaponStats');
const pgs = new Player();
const ws = pgs.getWeaponStats(pgs.weapon);
assert(ws.name === pgs.weapon.name,                           'getWeaponStats name matches weapon');
assert(ws.damage === pgs.weapon.baseDamage,                   'getWeaponStats damage matches baseDamage');
assert(ws.rarity === pgs.weapon.rarity,                       'getWeaponStats rarity matches weapon');
assert(ws.isCrafted === true,                                  'getWeaponStats isCrafted true for starter weapon');

const unequippedW = new Weapon('Phantom Edge', 60, 'epic');
const wsU = pgs.getWeaponStats(unequippedW);
assert(wsU.isCrafted === false,                               'getWeaponStats isCrafted false for uncrafted weapon');

// ─────────────────────────────────────────────
//  craftWeapon (craft + auto-equip)
// ─────────────────────────────────────────────
section('craftWeapon');
const pcr = new Player();
pcr.addItemToInventory('Iron Ore', 5);
pcr.addItemToInventory('Wood', 2);
pcr.gold = 300;
const ironRecipe2 = CRAFTING_RECIPES.find(r => r.name === 'Iron Sword');
const craftedAndEquipped = pcr.craftWeapon(ironRecipe2);
assert(craftedAndEquipped instanceof Weapon,                   'craftWeapon returns a Weapon');
assert(craftedAndEquipped.name === 'Iron Sword',              'craftWeapon crafts the correct weapon');
assert(pcr.weapon === craftedAndEquipped,                      'craftWeapon auto-equips the crafted weapon');
assert(pcr.checkWeaponCrafted(craftedAndEquipped) === true,   'craftWeapon marks weapon as crafted');

// craftWeapon fails without materials
const failCraftWeapon = pcr.craftWeapon(ironRecipe2);
assert(failCraftWeapon === null,                               'craftWeapon returns null when missing materials');

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
//  Health & Regeneration system
// ─────────────────────────────────────────────
section('Health – defaults');
const ph2 = new Player();
assert(ph2.currentHp === ph2.maxHp,            'starts at full HP');
assert(ph2.isAlive(),                          'alive at full HP');
assert(ph2.isRegenerating === false,           'not regenerating on start');
ph2.race = 'Human'; // neutral multiplier so formula is vitality * 10
assert(ph2.maxHp === ph2.stats.vitality * 10,  'maxHp = vitality * 10 (Human race)');

section('Health – maxHp getter updates with vitality');
const phv = new Player();
phv.race = 'Human'; // neutral multiplier
phv.stats.vitality = 10;
assert(phv.maxHp === 100,                      'maxHp reflects updated vitality');

section('Health – takeDamage');
const ptd = new Player();
const startHp = ptd.currentHp;
ptd.takeDamage(10);
assert(ptd.currentHp === startHp - 10,        'takeDamage reduces currentHp');
assert(ptd.timeSinceLastDamage === 0,          'takeDamage resets regen timer');
assert(ptd.isRegenerating === false,           'takeDamage stops regeneration');

// Cannot go below 0
ptd.takeDamage(9999);
assert(ptd.currentHp === 0,                   'currentHp cannot go below 0');
assert(!ptd.isAlive(),                         'dead at 0 HP');

// No effect once dead
const hpBeforeDead = ptd.currentHp;
ptd.takeDamage(5);
assert(ptd.currentHp === hpBeforeDead,        'takeDamage ignored when already dead');

section('Health – healPlayer');
const pha = new Player();
pha.currentHp = 10;
pha.healPlayer(20);
assert(pha.currentHp === 30,                   'healPlayer increases currentHp');

// Cannot exceed maxHp
pha.healPlayer(9999);
assert(pha.currentHp === pha.maxHp,            'healPlayer clamps to maxHp');

section('Health – updateRegen (no heal before 3 s)');
const pr2 = new Player();
pr2.currentHp = 10;
pr2.timeSinceLastDamage = 0;
pr2.updateRegen(2.9);
assert(pr2.isRegenerating === false,           'not regenerating before 3 s delay');
assert(pr2.currentHp === 10,                   'no heal before 3 s');

section('Health – updateRegen (heals after 3 s)');
const pr3 = new Player();
pr3.currentHp = 1;
pr3.timeSinceLastDamage = 3;  // already past the delay
pr3.updateRegen(1.0);         // 1 full second → one heal tick
const expectedHeal = Math.max(1, Math.floor(pr3.maxHp * 0.05));
assert(pr3.isRegenerating === true,            'isRegenerating true after delay');
assert(pr3.currentHp === 1 + expectedHeal,     'heals 5 % of maxHp per second');

section('Health – updateRegen (cannot exceed maxHp)');
const pr4 = new Player();
pr4.currentHp    = pr4.maxHp - 1;
pr4.timeSinceLastDamage = 3;
pr4.updateRegen(1.0);
assert(pr4.currentHp <= pr4.maxHp,            'regen does not exceed maxHp');

section('Health – updateRegen stops when full');
const pr5 = new Player();
pr5.currentHp    = pr5.maxHp;
pr5.timeSinceLastDamage = 10;
pr5.updateRegen(1.0);
assert(pr5.isRegenerating === false,           'regen disabled when already full');

section('Health – takeDamage resets regen mid-heal');
const pr6 = new Player();
pr6.currentHp    = 1;
pr6.timeSinceLastDamage = 5;  // regen active
pr6.updateRegen(0.5);
assert(pr6.isRegenerating === true,            'regen active after delay');
pr6.takeDamage(1);
assert(pr6.isRegenerating === false,           'regen stops immediately on damage');
assert(pr6.timeSinceLastDamage === 0,          'regen timer reset on damage');
assert(pr6.regenAccumulator    === 0,          'regen accumulator reset on damage');

section('Health – level-up restores HP to max');
const plv = new Player();
plv.currentHp = 1;
plv.gainExp(plv.expToNextLevel);  // triggers levelUp
assert(plv.currentHp === plv.maxHp,            'levelUp restores currentHp to maxHp');

section('Enemy – currentHp alias');
const eal = new Enemy('TestAlias', 100, 10, 0, 0);
assert(eal.currentHp === 100,                  'enemy currentHp alias returns hp');
eal.currentHp = 60;
assert(eal.hp === 60,                          'setting currentHp updates hp');
assert(eal.currentHp === 60,                   'getter reflects new value');
eal.reset();
assert(eal.currentHp === eal.maxHp,            'enemy currentHp == maxHp after reset');

// ─────────────────────────────────────────────
//  Race system
// ─────────────────────────────────────────────
section('RACES data');
assert(typeof RACES === 'object' && RACES !== null,         'RACES is an object');
assert(Object.keys(RACES).length >= 8,                      'at least 8 races defined');
for (const [name, r] of Object.entries(RACES)) {
  assert(typeof r.damageMultiplier === 'number',            `${name} has damageMultiplier`);
  assert(typeof r.healthMultiplier === 'number',            `${name} has healthMultiplier`);
  assert(r.damageMultiplier > 0,                            `${name} damageMultiplier > 0`);
  assert(r.healthMultiplier > 0,                            `${name} healthMultiplier > 0`);
  assert(typeof r.rarity === 'string' && r.rarity.length > 0, `${name} has a rarity string`);
}
// Spot-check expected races
assert('Human'      in RACES,                               'Human race exists');
assert('Orc'        in RACES,                               'Orc race exists');
assert('Elf'        in RACES,                               'Elf race exists');
assert('Dwarf'      in RACES,                               'Dwarf race exists');
assert('Beastkin'   in RACES,                               'Beastkin race exists');
assert('Vampire'    in RACES,                               'Vampire race exists');
assert('Celestial'  in RACES,                               'Celestial race exists');
assert('DragonBorn' in RACES,                               'DragonBorn race exists');
assert(RACES.Human.damageMultiplier === 1.0,                'Human damageMultiplier 1.0');
assert(RACES.Human.healthMultiplier === 1.0,                'Human healthMultiplier 1.0');
assert(RACES.Human.rarity           === 'common',           'Human rarity is common');
assert(RACES.Beastkin.rarity        === 'rare',             'Beastkin rarity is rare');
assert(RACES.Vampire.rarity         === 'epic',             'Vampire rarity is epic');
assert(RACES.Celestial.rarity       === 'legendary',        'Celestial rarity is legendary');
assert(RACES.DragonBorn.rarity      === 'mythic',           'DragonBorn rarity is mythic');

section('RACE_WEIGHTS data');
assert(typeof RACE_WEIGHTS === 'object' && RACE_WEIGHTS !== null, 'RACE_WEIGHTS is an object');
const raceWeightNames = Object.keys(RACE_WEIGHTS);
assert(raceWeightNames.length === Object.keys(RACES).length, 'RACE_WEIGHTS has entry for every race');
for (const name of Object.keys(RACES)) {
  assert(typeof RACE_WEIGHTS[name] === 'number' && RACE_WEIGHTS[name] > 0, `${name} has positive weight`);
}
// Weights sum to 100
assert(typeof RACE_WEIGHTS_TOTAL === 'number',              'RACE_WEIGHTS_TOTAL is a number');
assert(Math.abs(RACE_WEIGHTS_TOTAL - 100) < 0.001,          'RACE_WEIGHTS_TOTAL equals 100');
// Rarer races have lower weight
assert(RACE_WEIGHTS.Human      > RACE_WEIGHTS.Elf,          'Human (common) outweighs Elf (uncommon)');
assert(RACE_WEIGHTS.Elf        > RACE_WEIGHTS.Beastkin,     'Elf (uncommon) outweighs Beastkin (rare)');
assert(RACE_WEIGHTS.Beastkin   > RACE_WEIGHTS.Vampire,      'Beastkin (rare) outweighs Vampire (epic)');
assert(RACE_WEIGHTS.Vampire    > RACE_WEIGHTS.Celestial,    'Vampire (epic) outweighs Celestial (legendary)');
assert(RACE_WEIGHTS.Celestial  > RACE_WEIGHTS.DragonBorn,   'Celestial (legendary) outweighs DragonBorn (mythic)');

section('rollRandomRace()');
const raceNames = Object.keys(RACES);
for (let i = 0; i < 50; i++) {
  const r = rollRandomRace();
  assert(raceNames.includes(r),                             `rollRandomRace returns a valid race (${r})`);
  if (!raceNames.includes(r)) break; // stop spamming on failure
}
// Verify all races are reachable (run 5000 times; even mythic 0.5% expected ~25 hits)
const seen = new Set();
for (let i = 0; i < 5000; i++) seen.add(rollRandomRace());
assert(seen.size === raceNames.length,                      'all races reachable via rollRandomRace');

// Common races should appear more often than rare/mythic ones
{
  const freq = {};
  raceNames.forEach(n => { freq[n] = 0; });
  for (let i = 0; i < 10000; i++) freq[rollRandomRace()]++;
  assert(freq['Human']      > freq['DragonBorn'],           'Human appears more often than DragonBorn (weighted)');
  assert(freq['Orc']        > freq['Celestial'],            'Orc appears more often than Celestial (weighted)');
  assert(freq['Beastkin']   > freq['DragonBorn'],           'Beastkin appears more often than DragonBorn (weighted)');
}

section('Player – default race is Human');
const pr_race = new Player();
assert(pr_race.race === 'Human',                            'player starts as Human by default');
assert(raceNames.includes(pr_race.race),                    'player starts with a valid race');

section('Player – maxHp applies healthMultiplier');
const pr_hp = new Player();
pr_hp.race = 'Orc'; // healthMultiplier 1.3
assert(pr_hp.maxHp === Math.floor(pr_hp.stats.vitality * 10 * 1.3), 'Orc maxHp = vitality*10*1.3');
pr_hp.race = 'Elf'; // healthMultiplier 0.9
assert(pr_hp.maxHp === Math.floor(pr_hp.stats.vitality * 10 * 0.9), 'Elf maxHp = vitality*10*0.9');

section('Player – baseDamage applies damageMultiplier');
const pr_dmg = new Player();
pr_dmg.race = 'Elf'; // damageMultiplier 1.3
const rawDmg = pr_dmg.weapon.baseDamage + pr_dmg.stats.strength * 1.5;
assert(pr_dmg.baseDamage() === Math.floor(rawDmg * 1.3),   'Elf baseDamage = floor(raw * 1.3)');
pr_dmg.race = 'Dwarf'; // damageMultiplier 0.9
assert(pr_dmg.baseDamage() === Math.floor(rawDmg * 0.9),   'Dwarf baseDamage = floor(raw * 0.9)');
pr_dmg.race = 'Beastkin'; // damageMultiplier 1.4
assert(pr_dmg.baseDamage() === Math.floor(rawDmg * 1.4),   'Beastkin baseDamage = floor(raw * 1.4)');
pr_dmg.race = 'Vampire'; // damageMultiplier 1.5
assert(pr_dmg.baseDamage() === Math.floor(rawDmg * 1.5),   'Vampire baseDamage = floor(raw * 1.5)');
pr_dmg.race = 'Celestial'; // damageMultiplier 1.6
assert(pr_dmg.baseDamage() === Math.floor(rawDmg * 1.6),   'Celestial baseDamage = floor(raw * 1.6)');
pr_dmg.race = 'DragonBorn'; // damageMultiplier 1.8
assert(pr_dmg.baseDamage() === Math.floor(rawDmg * 1.8),   'DragonBorn baseDamage = floor(raw * 1.8)');

section('Player – maxHp applies healthMultiplier for new races');
const pr_hp2 = new Player();
pr_hp2.race = 'Beastkin'; // healthMultiplier 1.1
assert(pr_hp2.maxHp === Math.floor(pr_hp2.stats.vitality * 10 * 1.1), 'Beastkin maxHp = vitality*10*1.1');
pr_hp2.race = 'Vampire'; // healthMultiplier 0.8
assert(pr_hp2.maxHp === Math.floor(pr_hp2.stats.vitality * 10 * 0.8), 'Vampire maxHp = vitality*10*0.8');
pr_hp2.race = 'Celestial'; // healthMultiplier 1.2
assert(pr_hp2.maxHp === Math.floor(pr_hp2.stats.vitality * 10 * 1.2), 'Celestial maxHp = vitality*10*1.2');
pr_hp2.race = 'DragonBorn'; // healthMultiplier 1.4
assert(pr_hp2.maxHp === Math.floor(pr_hp2.stats.vitality * 10 * 1.4), 'DragonBorn maxHp = vitality*10*1.4');

section('calculateTotalStats – includes race info');
const pr_ts = new Player();
pr_ts.race = 'Orc';
const ts = pr_ts.calculateTotalStats();
assert(ts.raceName         === 'Orc',                       'totalStats includes raceName');
assert(ts.damageMultiplier === RACES.Orc.damageMultiplier,  'totalStats includes damageMultiplier');
assert(ts.healthMultiplier === RACES.Orc.healthMultiplier,  'totalStats includes healthMultiplier');
assert(ts.totalDamage      === pr_ts.baseDamage(),          'totalStats totalDamage matches baseDamage()');
assert(ts.maxHp            === pr_ts.maxHp,                 'totalStats maxHp matches maxHp getter');

section('applyRaceModifiers()');
const pr_arm = new Player();
pr_arm.race = 'Dwarf';
const mods = pr_arm.applyRaceModifiers();
assert(mods.race             === 'Dwarf',                   'applyRaceModifiers race name correct');
assert(mods.damageMultiplier === 0.9,                       'applyRaceModifiers damageMultiplier correct');
assert(mods.healthMultiplier === 1.5,                       'applyRaceModifiers healthMultiplier correct');
assert(mods.totalDamage      === pr_arm.baseDamage(),       'applyRaceModifiers totalDamage correct');
assert(mods.maxHp            === pr_arm.maxHp,              'applyRaceModifiers maxHp correct');

section('getRerollDropChance(luck)');
const eps = 1e-9; // tolerance for floating-point comparisons
assert(Math.abs(getRerollDropChance(0)   - 0.05) < eps, 'base drop chance 5% at luck 0');
assert(Math.abs(getRerollDropChance(10)  - 0.06) < eps, '6% at luck 10');
assert(Math.abs(getRerollDropChance(100) - 0.15) < eps, '15% at luck 100');

section('useRaceReroll()');
const pr_rr = new Player();
pr_rr.race = 'Human';

// Should fail without item
const failReroll = pr_rr.useRaceReroll();
assert(failReroll === false,                                'useRaceReroll fails without item');

// Should succeed with item
pr_rr.inventory['Race Reroll'] = 1;
const successReroll = pr_rr.useRaceReroll();
assert(successReroll === true,                              'useRaceReroll succeeds with item');
assert(raceNames.includes(pr_rr.race),                     'useRaceReroll assigns a valid race');
assert((pr_rr.inventory['Race Reroll'] || 0) === 0,        'Race Reroll consumed from inventory');

// Multiple rerolls
pr_rr.inventory['Race Reroll'] = 3;
pr_rr.useRaceReroll();
pr_rr.useRaceReroll();
assert(pr_rr.inventory['Race Reroll'] === 1,               'multiple rerolls deduct correctly');

// currentHp clamped to new maxHp after reroll
const pr_clamp = new Player();
pr_clamp.race = 'Human';
pr_clamp.currentHp = pr_clamp.maxHp; // full HP
pr_clamp.inventory['Race Reroll'] = 1;
pr_clamp.useRaceReroll();
assert(pr_clamp.currentHp <= pr_clamp.maxHp,               'currentHp clamped to new maxHp after reroll');

// ─────────────────────────────────────────────
//  applyDeathPenalty
// ─────────────────────────────────────────────
section('Player – applyDeathPenalty defaults');
const pdp = new Player();
assert(pdp.deathCount === 0,            'deathCount starts at 0');
assert(Array.isArray(pdp.deathLog),     'deathLog starts as an array');
assert(pdp.deathLog.length === 0,       'deathLog starts empty');

section('Player – applyDeathPenalty reduces gold by 15%');
const pdp2 = new Player();
pdp2.gold = 200;
const lost = pdp2.applyDeathPenalty('Slime');
assert(lost === 30,                     'applyDeathPenalty returns gold lost (15% of 200 = 30)');
assert(pdp2.gold === 170,               'gold reduced to 170 after 15% loss');

section('Player – applyDeathPenalty increments deathCount');
const pdp3 = new Player();
pdp3.gold = 100;
pdp3.applyDeathPenalty('Goblin');
assert(pdp3.deathCount === 1,           'deathCount is 1 after first death');
pdp3.gold = 100;
pdp3.applyDeathPenalty('Goblin');
assert(pdp3.deathCount === 2,           'deathCount is 2 after second death');

section('Player – applyDeathPenalty records deathLog entry');
const pdp4 = new Player();
pdp4.gold = 100;
pdp4.applyDeathPenalty('Skeleton');
assert(pdp4.deathLog.length === 1,      'deathLog has one entry after death');
const entry = pdp4.deathLog[0];
assert(entry.enemyName === 'Skeleton',  'deathLog entry has correct enemyName');
assert(entry.level     === 1,           'deathLog entry has correct level');
assert(entry.goldLost  === 15,          'deathLog entry has correct goldLost');
assert(typeof entry.timestamp === 'number' && entry.timestamp > 0, 'deathLog entry has a numeric timestamp');

section('Player – applyDeathPenalty gold cannot go below 0');
const pdp5 = new Player();
pdp5.gold = 0;
const lostZero = pdp5.applyDeathPenalty('Orc');
assert(lostZero === 0,                  'goldLost is 0 when player has no gold');
assert(pdp5.gold === 0,                 'gold stays at 0 when player has no gold');

section('Player – applyDeathPenalty uses default enemy name');
const pdp6 = new Player();
pdp6.gold = 50;
pdp6.applyDeathPenalty();
assert(pdp6.deathLog[0].enemyName === 'Unknown', 'defaults enemyName to Unknown when omitted');

// ─────────────────────────────────────────────
//  Summary
// ─────────────────────────────────────────────
console.log(`\n════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
