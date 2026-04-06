// ============================================================
//  1000 Battles Later
//  game.js  –  Core RPG classes and combat logic
// ============================================================

// ─────────────────────────────────────────────
//  Race system
// ─────────────────────────────────────────────
const RACES = {
  Human:     { damageMultiplier: 1.0, healthMultiplier: 1.0, rarity: 'common' },
  Orc:       { damageMultiplier: 1.2, healthMultiplier: 1.3, rarity: 'common' },
  Elf:       { damageMultiplier: 1.3, healthMultiplier: 0.9, rarity: 'uncommon' },
  Dwarf:     { damageMultiplier: 0.9, healthMultiplier: 1.5, rarity: 'uncommon' },
  Beastkin:  { damageMultiplier: 1.4, healthMultiplier: 1.1, rarity: 'rare' },
  Vampire:   { damageMultiplier: 1.5, healthMultiplier: 0.8, rarity: 'epic' },
  Celestial: { damageMultiplier: 1.6, healthMultiplier: 1.2, rarity: 'legendary' },
  DragonBorn: { damageMultiplier: 1.8, healthMultiplier: 1.4, rarity: 'mythic' },
};

// Roll weight for each race – higher weight means more likely to roll.
// Total weight: 100 (each entry is a direct percentage).
const RACE_WEIGHTS = {
  Human:      40,
  Orc:        25,
  Elf:        15,
  Dwarf:      10,
  Beastkin:   5,
  Vampire:    3,
  Celestial:  1.5,
  DragonBorn: 0.5,
};

// Pre-computed total weight for rollRandomRace (RACE_WEIGHTS is constant).
const RACE_WEIGHTS_TOTAL = Object.values(RACE_WEIGHTS).reduce((sum, w) => sum + w, 0);

// Returns a weighted-random race name; rarer races have lower probability.
function rollRandomRace() {
  const entries = Object.entries(RACE_WEIGHTS);
  let roll = Math.random() * RACE_WEIGHTS_TOTAL;
  for (const [name, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return name;
  }
  // Fallback – should never reach here in practice
  return entries[entries.length - 1][0];
}

// Returns the drop chance for a Race Reroll item given the player's luck stat
// Base: 5%; each luck point adds 0.1%
function getRerollDropChance(luck) {
  return 0.05 + luck * 0.001;
}

// ─────────────────────────────────────────────
//  Enemy scaling factors (applied per player level)
// ─────────────────────────────────────────────
// HP and gold grow at 5% per level; EXP grows slightly faster (6%) so that
// levelling up feels increasingly rewarding as the player fights tougher enemies.
const ENEMY_SCALE_HP        = 0.05;
const ENEMY_SCALE_DAMAGE    = 0.04;
const ENEMY_SCALE_EXP       = 0.06;
const ENEMY_SCALE_GOLD      = 0.05;

// ─────────────────────────────────────────────
//  Rune system
// ─────────────────────────────────────────────

// Rarity tiers in ascending order – used to filter eligible rune drops by enemy tier.
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic'];

class Rune {
  constructor(id, name, emoji, effect, value, rarity) {
    this.id     = id;
    this.name   = name;
    this.emoji  = emoji;
    // effect: 'lifesteal' | 'damageBonus' | 'damageReduction' |
    //         'critChanceBonus' | 'expBonus' | 'goldBonus' | 'regenBonus'
    this.effect = effect;
    this.value  = value;   // fraction: 0.02 = 2%
    this.rarity = rarity;  // 'common' | 'uncommon' | 'rare' | 'epic'
  }

  toString() {
    return `[${this.rarity.toUpperCase()}] ${this.name}`;
  }
}

// Luck bonus factor per point applied to rune drop chance
const LUCK_RUNE_DROP_MODIFIER = 0.002;
// Maximum rune drop chance regardless of luck (normal enemies are 1–8%)
const MAX_RUNE_DROP_CHANCE = 0.15;

// Predefined rune catalog (runeTier 0=common only, 1=up to uncommon, 2=up to rare, 3=epic)
const RUNES = [
  new Rune('blood',       'Blood Rune',        '🩸', 'lifesteal',       0.02, 'common'),
  new Rune('fury',        'Fury Rune',         '🔥', 'damageBonus',     0.15, 'uncommon'),
  new Rune('ward',        'Ward Rune',         '🛡', 'damageReduction', 0.10, 'uncommon'),
  new Rune('swift',       'Swift Rune',        '💨', 'critChanceBonus', 0.05, 'rare'),
  new Rune('fortune',     'Fortune Rune',      '🪙', 'goldBonus',       0.10, 'uncommon'),
  new Rune('wisdom',      'Wisdom Rune',       '📚', 'expBonus',        0.10, 'uncommon'),
  new Rune('mending',     'Mending Rune',      '💚', 'regenBonus',      0.02, 'rare'),
  new Rune('greaterfury', 'Greater Fury Rune', '🔥', 'damageBonus',     0.25, 'rare'),
  new Rune('greaterward', 'Greater Ward Rune', '🛡', 'damageReduction', 0.20, 'epic'),
  new Rune('grandblood',  'Grand Blood Rune',  '🩸', 'lifesteal',       0.05, 'epic'),
];

// ─────────────────────────────────────────────
//  Weapon
// ─────────────────────────────────────────────
class Weapon {
  constructor(name, baseDamage, rarity = 'common') {
    this.name       = name;
    this.baseDamage = baseDamage;
    this.rarity     = rarity; // common | uncommon | rare | epic | legendary
  }

  toString() {
    return `[${this.rarity.toUpperCase()}] ${this.name} (${this.baseDamage} dmg)`;
  }
}

// ─────────────────────────────────────────────
//  Enemy
// ─────────────────────────────────────────────
class Enemy {
  constructor(name, hp, damage, expReward, goldReward, gemDropChance = 0.1, dropTable = [], runeDropChance = 0, runeTier = 0, dodgeChance = 0, world = 'slime', healChance = 0, healPercent = 0.5, minDamage = null, maxDamage = null, critChance = 0) {
    this.name          = name;
    this.maxHp         = hp;
    this.hp            = hp;
    this.damage        = damage;
    this.expReward     = expReward;
    this.goldReward    = goldReward;
    this.gemDropChance = gemDropChance;  // 0–1 probability
    // dropTable: [{ itemName, dropChance, minAmount, maxAmount }, ...]
    this.dropTable     = dropTable;
    this.runeDropChance = runeDropChance; // 0–1 probability of dropping a rune
    // runeTier: 0=common only, 1=up to uncommon, 2=up to rare, 3=epic
    this.runeTier      = runeTier;
    // dodgeChance: 0–1 probability of dodging a player attack
    this.dodgeChance   = dodgeChance;
    // world: which world/zone this enemy belongs to
    this.world         = world;
    // healChance: 0–1 probability per second of healing healPercent of max HP
    this.healChance    = healChance;
    // healPercent: fraction of maxHp restored when a heal triggers (default 0.5 = 50%)
    this.healPercent   = healPercent;
    // minDamage/maxDamage: when set, damage is randomised in this range each attack
    this.minDamage     = minDamage;
    this.maxDamage     = maxDamage;
    // critChance: 0–1 probability of dealing a 2× damage critical hit
    this.critChance    = critChance;
  }

  // Alias so enemy and player share the same currentHp interface
  get currentHp()    { return this.hp; }
  set currentHp(val) { this.hp = val; }

  isAlive() { return this.hp > 0; }

  reset() { this.hp = this.maxHp; }

  toString() {
    return `${this.name} (HP: ${this.hp}/${this.maxHp}, DMG: ${this.damage})`;
  }
}

// ─────────────────────────────────────────────
//  Player
// ─────────────────────────────────────────────
class Player {
  constructor(name = 'Hero') {
    this.name           = name;
    this.level          = 1;
    this.exp            = 0;
    this.expToNextLevel = this._calcExpThreshold(1);

    this.stats = {
      strength  : 5,
      vitality  : 5,
      dexterity : 5,
      luck      : 5,
    };

    this.statPoints = 0;
    this.gold       = 0;
    this.gems       = 0;

    // ── Race ──────────────────────────────────────────────────
    this.race = 'Human'; // new players always start as Human

    // ── Health & regeneration ──────────────────────────────────
    this.currentHp           = this.maxHp;  // full HP on creation
    this.timeSinceLastDamage = 0;           // seconds since last hit
    this.regenAccumulator    = 0;           // seconds accumulated toward next heal tick
    this.isRegenerating      = false;       // true while regen is active

    this.weapon = new Weapon('Rusty Sword', 8, 'common');
    this.log    = [];  // combat/event log kept for the UI

    this.inventory      = {};  // { itemName: quantity }
    this.craftedWeapons = [];  // Weapon[] – weapons made at the crafting table

    // The starting weapon is pre-crafted so the player can re-equip it
    this.craftedWeapons.push(this.weapon);

    // ── Rune system ─────────────────────────────────────────────
    // runeSlots holds equipped rune objects (or null). Up to 3 total sockets.
    this.runeSlots         = [null, null, null];
    this.unlockedRuneSlots = 1;   // slot 0 is available from the start
    this.runeInventory     = [];  // unequipped Rune objects

    // ── Death tracking ──────────────────────────────────────────
    this.deathCount = 0;
    this.deathLog   = [];  // [{ enemyName, level, goldLost, timestamp }, ...]
  }

  // ── Max HP derived from vitality and race health multiplier ──
  get maxHp() {
    return Math.floor(this.stats.vitality * 10 * RACES[this.race].healthMultiplier);
  }

  // ── Scaling formula: base 80 * level^1.3 (gentler mid-game curve) ──
  _calcExpThreshold(level) {
    return Math.floor(80 * Math.pow(level, 1.3));
  }

  // ── Gain EXP and trigger level-ups ─────────────────────────
  gainExp(amount) {
    this.exp += amount;
    this._addLog(`Gained ${amount} EXP. (${this.exp}/${this.expToNextLevel})`);
    while (this.exp >= this.expToNextLevel) {
      this.exp -= this.expToNextLevel;
      this.levelUp();
    }
  }

  // ── Level up ───────────────────────────────────────────────
  levelUp() {
    this.level++;
    this.statPoints       += 3;
    this.expToNextLevel    = this._calcExpThreshold(this.level);
    this.currentHp         = this.maxHp;  // restore to full HP on level-up
    this._addLog(`⬆ LEVEL UP! Now level ${this.level}. +3 stat points. Next level: ${this.expToNextLevel} EXP.`);
  }

  // ── Allocate a stat point ──────────────────────────────────
  allocateStat(statName) {
    if (!Object.prototype.hasOwnProperty.call(this.stats, statName)) {
      this._addLog(`Unknown stat: ${statName}`);
      return false;
    }
    if (this.statPoints <= 0) {
      this._addLog('No stat points available!');
      return false;
    }
    this.stats[statName]++;
    this.statPoints--;
    this._addLog(`+1 ${statName} → ${this.stats[statName]} (${this.statPoints} pts left)`);
    return true;
  }

  // ── Reset all allocated stats (costs 500 gold) ────────────
  resetStats() {
    const RESET_COST = 500;
    if (this.gold < RESET_COST) {
      this._addLog(`❌ Not enough gold to reset stats (need ${RESET_COST} 🪙)`);
      return false;
    }
    const BASE_STAT = 5;
    const spent = Object.values(this.stats).reduce((sum, v) => sum + (v - BASE_STAT), 0);
    for (const key of Object.keys(this.stats)) {
      this.stats[key] = BASE_STAT;
    }
    this.statPoints += spent;
    this.gold -= RESET_COST;
    this._addLog(`🔄 Stats reset! Recovered ${spent} stat points. (-${RESET_COST} 🪙)`);
    return true;
  }

  // ── Is the player alive? ───────────────────────────────────
  isAlive() {
    return this.currentHp > 0;
  }

  // ── Apply death penalty (gold loss) and record the death ───
  // Returns the amount of gold lost (0 if the player had no gold).
  applyDeathPenalty(enemyName = 'Unknown') {
    const penaltyRate = 0.35 + Math.random() * 0.40; // 35–75%
    const goldLost = Math.floor(this.gold * penaltyRate);
    this.gold = Math.max(0, this.gold - goldLost);
    this.deathCount++;
    this.deathLog.push({ enemyName, level: this.level, goldLost, timestamp: Date.now() });
    this._addLog(`💀 Died to ${enemyName}. Lost ${goldLost} gold. (Deaths: ${this.deathCount})`);
    return goldLost;
  }

  // ── Take damage from an enemy ──────────────────────────────
  // Reduces currentHp, resets the regen delay timer and stops
  // any active regeneration so healing restarts from scratch.
  takeDamage(amount) {
    if (!this.isAlive()) return;
    this.currentHp           = Math.max(0, this.currentHp - amount);
    this.timeSinceLastDamage = 0;
    this.regenAccumulator    = 0;
    this.isRegenerating      = false;
    this._addLog(`You took ${amount} damage. (${this.currentHp}/${this.maxHp} HP)`);
  }

  // ── Heal the player by amount (clamped to maxHp) ──────────
  healPlayer(amount) {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
  }

  // ── Called every frame to advance the regen system ────────
  // deltaTime: seconds elapsed since last call
  // – Waits 3 s after the last hit before healing starts.
  // – Once active, heals 5 % of maxHp every second.
  updateRegen(deltaTime) {
    if (!this.isAlive()) {
      this.isRegenerating = false;
      return;
    }
    if (this.currentHp >= this.maxHp) {
      this.isRegenerating = false;
      return;
    }

    this.timeSinceLastDamage += deltaTime;

    if (this.timeSinceLastDamage >= 3) {
      this.isRegenerating    = true;
      this.regenAccumulator += deltaTime;

      if (this.regenAccumulator >= 1) {
        this.regenAccumulator -= 1;
        const regenRate  = 0.05 + this.getRuneBonus('regenBonus');
        const healAmount = Math.max(1, Math.floor(this.maxHp * regenRate));
        this.healPlayer(healAmount);
      }
    } else {
      this.isRegenerating = false;
    }
  }

  // ── Equip a weapon ─────────────────────────────────────────
  // A weapon can only be equipped if it has been crafted (exists in
  // craftedWeapons). The starting weapon is pre-added to craftedWeapons.
  equipWeapon(weapon) {
    if (!this.craftedWeapons.includes(weapon)) {
      this._addLog('⚠ You must craft this weapon before equipping it.');
      return false;
    }
    this.weapon = weapon;
    this._addLog(`Equipped ${weapon.toString()}`);
    return true;
  }

  // ── Crit chance (0–1) based on dexterity and rune bonuses ─
  critChance() {
    return Math.min(0.05 + this.stats.dexterity * 0.01 + this.getRuneBonus('critChanceBonus'), 0.75);
  }

  // ── Base attack damage (with race multiplier) ───────────────
  baseDamage() {
    return Math.floor((this.weapon.baseDamage + this.stats.strength * 1.5) * RACES[this.race].damageMultiplier);
  }

  // ── Computed combat stats summary (for the stats display) ──
  calculateTotalStats() {
    const race = RACES[this.race];
    return {
      totalDamage      : this.baseDamage(),
      critChance       : this.critChance() * 100,
      maxHp            : this.maxHp,
      luckBonus        : this.stats.luck,
      raceName         : this.race,
      damageMultiplier : race.damageMultiplier,
      healthMultiplier : race.healthMultiplier,
    };
  }

  // ── Returns the active race modifiers ──────────────────────
  applyRaceModifiers() {
    const race = RACES[this.race];
    return {
      race             : this.race,
      damageMultiplier : race.damageMultiplier,
      healthMultiplier : race.healthMultiplier,
      totalDamage      : this.baseDamage(),
      maxHp            : this.maxHp,
    };
  }

  // ── Sum all equipped rune values for a given effect key ───
  getRuneBonus(effectKey) {
    let total = 0;
    for (let i = 0; i < this.unlockedRuneSlots; i++) {
      const rune = this.runeSlots[i];
      if (rune && rune.effect === effectKey) total += rune.value;
    }
    return total;
  }

  // ── Equip a rune from runeInventory into a rune slot ──────
  // runeIndex: index in this.runeInventory
  // slotIndex: index in this.runeSlots (must be unlocked)
  // If the slot is occupied the displaced rune returns to inventory.
  equipRune(runeIndex, slotIndex) {
    if (runeIndex < 0 || runeIndex >= this.runeInventory.length) {
      this._addLog('❌ Invalid rune selection.');
      return false;
    }
    if (slotIndex < 0 || slotIndex >= this.unlockedRuneSlots) {
      this._addLog('❌ Rune slot is locked or invalid.');
      return false;
    }
    const rune      = this.runeInventory[runeIndex];
    const displaced = this.runeSlots[slotIndex];
    this.runeSlots[slotIndex] = rune;
    this.runeInventory.splice(runeIndex, 1);
    if (displaced) this.runeInventory.push(displaced);
    this._addLog(`🔮 Equipped ${rune.name} in slot ${slotIndex + 1}.`);
    return true;
  }

  // ── Remove a rune from a slot back into the inventory ─────
  unequipRune(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.unlockedRuneSlots) {
      this._addLog('❌ Rune slot is locked or invalid.');
      return false;
    }
    const rune = this.runeSlots[slotIndex];
    if (!rune) {
      this._addLog('❌ No rune in that slot.');
      return false;
    }
    this.runeSlots[slotIndex] = null;
    this.runeInventory.push(rune);
    this._addLog(`🔮 Unequipped ${rune.name} from slot ${slotIndex + 1}.`);
    return true;
  }

  // ── Attempt to drop a rune from a defeated enemy ──────────
  // Returns the dropped Rune object or null if no drop occurred.
  rollRuneDrop(enemy) {
    if (!enemy.runeDropChance || enemy.runeDropChance <= 0) return null;
    // Luck adds up to the cap, but never reduces the base drop chance below itself.
    const runeChance = Math.min(
      enemy.runeDropChance + this.stats.luck * LUCK_RUNE_DROP_MODIFIER,
      Math.max(enemy.runeDropChance, MAX_RUNE_DROP_CHANCE),
    );
    if (Math.random() >= runeChance) return null;
    const eligible = RUNES.filter(r => RARITY_ORDER.indexOf(r.rarity) <= enemy.runeTier);
    if (eligible.length === 0) return null;
    const dropped = eligible[Math.floor(Math.random() * eligible.length)];
    this.runeInventory.push(dropped);
    this._addLog(`🔮 ${dropped.name} dropped! (${dropped.rarity} rune)`, 'drop');
    return dropped;
  }

  // ── Consume a Race Reroll from inventory and re-roll race ──
  useRaceReroll() {
    if (!this.inventory['Race Reroll'] || this.inventory['Race Reroll'] <= 0) {
      this._addLog('❌ No Race Reroll available!');
      return false;
    }
    this.inventory['Race Reroll']--;
    if (this.inventory['Race Reroll'] <= 0) delete this.inventory['Race Reroll'];
    const oldRace = this.race;
    this.race = rollRandomRace();
    // Clamp currentHp to new maxHp after race change
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this._addLog(`🎲 Race changed: ${oldRace} → ${this.race} (DMG ×${RACES[this.race].damageMultiplier}, HP ×${RACES[this.race].healthMultiplier})`);
    return true;
  }

  // ── Attack an enemy (returns damage dealt) ─────────────────
  attackEnemy(enemy, timingMultiplier = 1.0) {
    if (timingMultiplier === 0) {
      this._addLog(`You missed ${enemy.name}!`);
      return 0;
    }
    // Dodge check – enemy evades the attack entirely
    if (enemy.dodgeChance > 0 && Math.random() < enemy.dodgeChance) {
      this._addLog(`${enemy.name} dodged your attack! …wait, where did it go?`);
      return 0;
    }
    let damage = this.baseDamage() * (1 + this.getRuneBonus('damageBonus')) * timingMultiplier;
    const isCrit = Math.random() < this.critChance();
    if (isCrit) {
      damage *= 2;
      this._addLog(`💥 CRITICAL HIT!`);
    }
    damage = Math.max(1, Math.round(damage));
    enemy.hp = Math.max(0, enemy.hp - damage);
    this._addLog(`You hit ${enemy.name} for ${damage} damage. (${enemy.hp}/${enemy.maxHp} HP left)`);

    // Lifesteal – heal a portion of damage dealt
    const lifesteal = this.getRuneBonus('lifesteal');
    if (lifesteal > 0 && this.currentHp < this.maxHp) {
      const healAmt = Math.floor(damage * lifesteal);
      if (healAmt > 0) {
        this.healPlayer(healAmt);
        this._addLog(`🩸 Lifesteal restored ${healAmt} HP. (${this.currentHp}/${this.maxHp} HP)`, 'lifesteal');
      }
    }

    return damage;
  }

  // ── Scale an enemy's stats based on the player's current level ──
  // Returns a temporary Enemy-like object; the original is never mutated.
  _scaleEnemy(enemy) {
    const lvl = this.level;
    const scaleFactor = 1 + ENEMY_SCALE_DAMAGE * lvl;
    const scaled = new Enemy(
      enemy.name,
      Math.floor(enemy.maxHp      * (1 + ENEMY_SCALE_HP  * lvl)),
      Math.floor(enemy.damage     * scaleFactor),
      Math.floor(enemy.expReward  * (1 + ENEMY_SCALE_EXP  * lvl)),
      Math.floor(enemy.goldReward * (1 + ENEMY_SCALE_GOLD * lvl)),
      enemy.gemDropChance,
      enemy.dropTable,
      enemy.runeDropChance,
      enemy.runeTier,
      enemy.dodgeChance,
      enemy.world,
      enemy.healChance,
      enemy.healPercent,
      enemy.minDamage !== null ? Math.floor(enemy.minDamage * scaleFactor) : null,
      enemy.maxDamage !== null ? Math.floor(enemy.maxDamage * scaleFactor) : null,
      enemy.critChance,
    );
    return scaled;
  }

  // ── Full fight against one enemy (no timing; auto-combat) ──
  fightEnemy(enemy) {
    const scaledEnemy = this._scaleEnemy(enemy);
    scaledEnemy.reset();
    this._addLog(`⚔ Battle started: ${this.name} vs ${scaledEnemy.name}`);

    while (scaledEnemy.isAlive()) {
      this.attackEnemy(scaledEnemy, 1.0);

      if (!scaledEnemy.isAlive()) break;

      // Enemy hits back – percentage-based reduction, capped at 75% (vitality + rune bonus)
      const damageReduction = Math.min(
        this.stats.vitality / (this.stats.vitality + 50) + this.getRuneBonus('damageReduction'),
        0.75
      );
      // Determine enemy base damage (random range if defined, otherwise fixed)
      let enemyBaseDmg = (scaledEnemy.minDamage !== null && scaledEnemy.maxDamage !== null)
        ? Math.floor(scaledEnemy.minDamage + Math.random() * (scaledEnemy.maxDamage - scaledEnemy.minDamage + 1))
        : scaledEnemy.damage;
      // Enemy crit check
      if (scaledEnemy.critChance > 0 && Math.random() < scaledEnemy.critChance) {
        enemyBaseDmg = Math.floor(enemyBaseDmg * 2);
        this._addLog(`💥 ${scaledEnemy.name} lands a CRITICAL HIT!`);
      }
      const dmgTaken = Math.max(1, Math.round(enemyBaseDmg * (1 - damageReduction)));
      this.takeDamage(dmgTaken);
    }

    this._collectRewards(scaledEnemy);
  }

  // ── Collect rewards after defeating an enemy ───────────────
  _collectRewards(enemy) {
    const expGained = Math.floor(enemy.expReward * (1 + this.getRuneBonus('expBonus')));
    this.gainExp(expGained);
    const goldGained = Math.floor(enemy.goldReward * (1 + this.getRuneBonus('goldBonus')));
    this.gold += goldGained;
    this._addLog(`+${goldGained} gold. Total gold: ${this.gold}`);

    // Gem drop – luck increases the chance
    const gemChance = Math.min(enemy.gemDropChance + this.stats.luck * 0.005, 0.9);
    if (Math.random() < gemChance) {
      this.gems++;
      this._addLog(`💎 Gem dropped! Total gems: ${this.gems}`);
    }

    // Rune drop
    this.rollRuneDrop(enemy);

    // Race Reroll drop – base 5%, +0.1% per luck point
    if (Math.random() < getRerollDropChance(this.stats.luck)) {
      this.addItemToInventory('Race Reroll', 1);
    }

    // Item drops from enemy drop table
    this.rollItemDrops(enemy);
  }

  // ── Add an item to the inventory ───────────────────────────
  addItemToInventory(itemName, amount) {
    this.inventory[itemName] = (this.inventory[itemName] || 0) + amount;
    this._addLog(`📦 You got ${amount} ${itemName}`, 'drop');
  }

  // ── Roll item drops for a defeated enemy ───────────────────
  // Returns an array of { itemName, amount } for each item that dropped
  // (also adds items to inventory as a side effect). Return value is
  // primarily useful for testing and optional UI display.
  rollItemDrops(enemy) {
    if (!enemy.dropTable || enemy.dropTable.length === 0) return [];
    const drops = [];
    for (const drop of enemy.dropTable) {
      // Each luck point adds 0.002 (0.2%) bonus drop chance; capped at 95%
      // so there is always a small chance of missing a drop even at max luck.
      const luckyChance = Math.min(drop.dropChance + this.stats.luck * 0.002, 0.95);
      if (Math.random() < luckyChance) {
        const range  = drop.maxAmount - drop.minAmount;
        const amount = drop.minAmount + Math.floor(Math.random() * (range + 1));
        drops.push({ itemName: drop.itemName, amount });
      }
    }
    drops.forEach(d => this.addItemToInventory(d.itemName, d.amount));
    return drops;
  }

  // ── Check whether the player can afford a recipe ───────────
  hasMaterials(recipe) {
    for (const mat of recipe.materials) {
      if ((this.inventory[mat.itemName] || 0) < mat.amount) return false;
    }
    if (recipe.goldCost && this.gold < recipe.goldCost) return false;
    if (recipe.gemsCost && this.gems < recipe.gemsCost) return false;
    return true;
  }

  // ── Craft an item from a recipe ────────────────────────────
  craftItem(recipe) {
    if (!this.hasMaterials(recipe)) {
      this._addLog(`❌ Not enough materials to craft ${recipe.weapon.name}`);
      return null;
    }
    for (const mat of recipe.materials) {
      this.inventory[mat.itemName] -= mat.amount;
      if (this.inventory[mat.itemName] <= 0) delete this.inventory[mat.itemName];
    }
    if (recipe.goldCost) this.gold -= recipe.goldCost;
    if (recipe.gemsCost) this.gems -= recipe.gemsCost;
    const crafted = new Weapon(recipe.weapon.name, recipe.weapon.baseDamage, recipe.weapon.rarity);
    this.craftedWeapons.push(crafted);
    this._addLog(`🔨 Crafted ${crafted.toString()}!`, 'craft');
    return crafted;
  }

  // ── Craft a weapon and immediately equip it ────────────────
  craftWeapon(recipe) {
    const crafted = this.craftItem(recipe);
    if (!crafted) return null;
    this.equipWeapon(crafted);
    return crafted;
  }

  // ── Check whether a weapon has been crafted ────────────────
  checkWeaponCrafted(weapon) {
    return this.craftedWeapons.includes(weapon);
  }

  // ── Get stats for a weapon ─────────────────────────────────
  getWeaponStats(weapon) {
    return {
      name     : weapon.name,
      damage   : weapon.baseDamage,
      rarity   : weapon.rarity,
      isCrafted: this.checkWeaponCrafted(weapon),
    };
  }

  _addLog(msg, type = null) {
    this.log.push(msg);
    if (typeof onGameLog === 'function') onGameLog(msg, type);  // hook for UI
  }

  statusString() {
    const s = this.stats;
    return (
      `${this.name} | Lv.${this.level} | EXP: ${this.exp}/${this.expToNextLevel} | ` +
      `Gold: ${this.gold} | Gems: ${this.gems} | StatPts: ${this.statPoints}\n` +
      `  STR:${s.strength} VIT:${s.vitality} DEX:${s.dexterity} LCK:${s.luck}\n` +
      `  Weapon: ${this.weapon.toString()}`
    );
  }
}

// ─────────────────────────────────────────────
//  World definitions
// ─────────────────────────────────────────────
const WORLDS = {
  slime:  { name: 'Slime World',    description: 'A gelatinous kingdom ruled by King Slime.' },
  goblin: { name: 'Goblin Forest',  description: 'A dark woodland overrun by cunning goblin tribes.' },
};

// Returns all enemies belonging to a given world id.
function getEnemiesForWorld(worldId) {
  return ENEMIES.filter(e => e.world === worldId);
}

// ─────────────────────────────────────────────
//  Sample data
// ─────────────────────────────────────────────
const ENEMIES = [
  // ── Slime World ──────────────────────────────────────────────
  new Enemy('Slime',                80,   14,  45,  20, 0.08, [
    { itemName: 'Slime Gel',            dropChance: 0.55, minAmount: 1, maxAmount: 3 },
  ], 0.02, 0, 0.00, 'slime'),

  new Enemy('Tank Slime',          150,    9,  75,  38, 0.10, [
    { itemName: 'Slime Gel',            dropChance: 0.30, minAmount: 1, maxAmount: 2 },
    { itemName: 'Hardened Slime Core',  dropChance: 0.35, minAmount: 1, maxAmount: 2 },
  ], 0.02, 0, 0.00, 'slime'),

  new Enemy('Glass Slime',         100,  300,  90,  55, 0.12, [
    { itemName: 'Slime Gel',            dropChance: 0.25, minAmount: 1, maxAmount: 2 },
    { itemName: 'Glass Shard',          dropChance: 0.40, minAmount: 1, maxAmount: 3 },
  ], 0.03, 1, 0.00, 'slime'),

  new Enemy('Slime General',       275,   35, 165,  95, 0.16, [
    { itemName: 'Hardened Slime Core',  dropChance: 0.30, minAmount: 1, maxAmount: 2 },
    { itemName: "General's Badge",      dropChance: 0.35, minAmount: 1, maxAmount: 2 },
  ], 0.04, 1, 0.00, 'slime'),

  new Enemy('King Slime Bodyguard', 350,  50, 230, 140, 0.20, [
    { itemName: "General's Badge",      dropChance: 0.25, minAmount: 1, maxAmount: 2 },
    { itemName: 'Royal Shard',          dropChance: 0.40, minAmount: 1, maxAmount: 2 },
  ], 0.05, 1, 0.00, 'slime'),

  new Enemy('Wraith Slime',        635,   80, 350, 190, 0.25, [
    { itemName: 'Royal Shard',          dropChance: 0.25, minAmount: 1, maxAmount: 2 },
    { itemName: 'Wraith Wisp',          dropChance: 0.40, minAmount: 1, maxAmount: 2 },
  ], 0.06, 1, 0.25, 'slime'),

  new Enemy('King Slime',         5000,   40, 800, 420, 0.35, [
    { itemName: 'Wraith Wisp',          dropChance: 0.30, minAmount: 1, maxAmount: 2 },
    { itemName: 'Slime Crown Piece',    dropChance: 0.50, minAmount: 1, maxAmount: 3 },
  ], 0.07, 1, 0.20, 'slime', 0.02),

  // ── Goblin Forest ─────────────────────────────────────────────
  new Enemy('Common Wolf',      1200, 100, 110,  55, 0.09, [
    { itemName: 'Wolf Pelt',            dropChance: 0.55, minAmount: 1, maxAmount: 2 },
  ], 0.02, 0, 0.00, 'goblin'),

  new Enemy('Goblin Scout',     1000,  80, 130,  65, 0.10, [
    { itemName: 'Tattered Cloth',       dropChance: 0.50, minAmount: 1, maxAmount: 2 },
  ], 0.02, 0, 0.50, 'goblin'),

  new Enemy('Goblin Warrior',   1750, 120, 200, 100, 0.12, [
    { itemName: 'Tattered Cloth',       dropChance: 0.30, minAmount: 1, maxAmount: 2 },
    { itemName: 'Crude Iron Scrap',     dropChance: 0.40, minAmount: 1, maxAmount: 2 },
  ], 0.03, 1, 0.00, 'goblin'),

  new Enemy('Goblin Tank',      4000, 120, 300, 160, 0.15, [
    { itemName: 'Crude Iron Scrap',     dropChance: 0.35, minAmount: 1, maxAmount: 3 },
    { itemName: 'Iron Plate',           dropChance: 0.40, minAmount: 1, maxAmount: 2 },
  ], 0.04, 1, 0.00, 'goblin'),

  // minDamage=50, maxDamage=200; healChance=0.05 (5%); healPercent=0.25 (25% HP)
  new Enemy('Goblin Shaman',    2000, 125, 250, 130, 0.14, [
    { itemName: 'Forest Herb',          dropChance: 0.50, minAmount: 1, maxAmount: 3 },
    { itemName: 'Crude Iron Scrap',     dropChance: 0.25, minAmount: 1, maxAmount: 2 },
  ], 0.04, 1, 0.00, 'goblin', 0.05, 0.25, 50, 200),

  new Enemy('Alpha Wolf',       3500, 200, 380, 200, 0.18, [
    { itemName: 'Wolf Pelt',            dropChance: 0.40, minAmount: 1, maxAmount: 2 },
    { itemName: 'Alpha Fang',           dropChance: 0.45, minAmount: 1, maxAmount: 2 },
  ], 0.06, 2, 0.00, 'goblin'),

  // critChance=0.25 (25%); crit deals 2× base damage (300 × 2 = 600)
  new Enemy('Goblin Berserker', 4500, 300, 800, 420, 0.30, [
    { itemName: 'Berserker Charm',      dropChance: 0.35, minAmount: 1, maxAmount: 2 },
    { itemName: 'Alpha Fang',           dropChance: 0.30, minAmount: 1, maxAmount: 1 },
  ], 0.07, 2, 0.00, 'goblin', 0, 0.5, null, null, 0.25),
];

const WEAPONS = [
  new Weapon('Rusty Sword',    8,  'common'),
  new Weapon('Iron Blade',    18,  'uncommon'),
  new Weapon('Steel Edge',    32,  'rare'),
  new Weapon('Void Cleaver',  55,  'epic'),
  new Weapon('Dragon Slayer', 90,  'legendary'),
];

// ─────────────────────────────────────────────
//  Crafting Recipes
// ─────────────────────────────────────────────
// Each recipe: { name, weapon: { name, baseDamage, rarity }, materials: [{ itemName, amount }], goldCost, gemsCost }
const CRAFTING_RECIPES = [
  {
    name: 'Gel Blade',
    weapon: { name: 'Gel Blade', baseDamage: 28, rarity: 'uncommon' },
    materials: [
      { itemName: 'Slime Gel', amount: 5 },
    ],
    goldCost: 80,
    gemsCost: 0,
  },
  {
    name: 'Tank Crusher',
    weapon: { name: 'Tank Crusher', baseDamage: 38, rarity: 'uncommon' },
    materials: [
      { itemName: 'Hardened Slime Core', amount: 4 },
      { itemName: 'Slime Gel',           amount: 2 },
    ],
    goldCost: 180,
    gemsCost: 0,
  },
  {
    name: 'Crystal Shard Sword',
    weapon: { name: 'Crystal Shard Sword', baseDamage: 58, rarity: 'rare' },
    materials: [
      { itemName: 'Glass Shard', amount: 4 },
      { itemName: 'Slime Gel',   amount: 3 },
    ],
    goldCost: 360,
    gemsCost: 0,
  },
  {
    name: "General's Saber",
    weapon: { name: "General's Saber", baseDamage: 74, rarity: 'rare' },
    materials: [
      { itemName: "General's Badge",    amount: 3 },
      { itemName: 'Hardened Slime Core', amount: 3 },
    ],
    goldCost: 560,
    gemsCost: 0,
  },
  {
    name: 'Royal Blade',
    weapon: { name: 'Royal Blade', baseDamage: 90, rarity: 'epic' },
    materials: [
      { itemName: 'Royal Shard',      amount: 3 },
      { itemName: "General's Badge",  amount: 2 },
    ],
    goldCost: 820,
    gemsCost: 1,
  },
  {
    name: 'Wraith Reaper',
    weapon: { name: 'Wraith Reaper', baseDamage: 108, rarity: 'epic' },
    materials: [
      { itemName: 'Wraith Wisp',  amount: 3 },
      { itemName: 'Royal Shard',  amount: 2 },
    ],
    goldCost: 1100,
    gemsCost: 2,
  },
  {
    name: "Slime King's Scepter",
    weapon: { name: "Slime King's Scepter", baseDamage: 138, rarity: 'legendary' },
    materials: [
      { itemName: 'Slime Crown Piece', amount: 3 },
      { itemName: 'Wraith Wisp',       amount: 2 },
    ],
    goldCost: 1900,
    gemsCost: 3,
  },
];

// ─────────────────────────────────────────────
//  Companion
// ─────────────────────────────────────────────
class Companion {
  constructor(name = 'Companion', emoji = '🦊') {
    this.name           = name;
    this.emoji          = emoji;
    this.level          = 0;    // 0 = locked; purchase to unlock at level 1
    this.exp            = 0;
    this.expToNextLevel = this._calcExpThreshold(1);
    this.attackInterval = 2.5;  // seconds between auto-attacks
    this._attackTimer   = 0;
  }

  // Returns true if the companion has been purchased/unlocked.
  get isUnlocked() { return this.level > 0; }

  // Damage scales with the companion's own level.
  attackDamage() {
    return Math.max(1, Math.floor(this.level * 3 + 5));
  }

  // Gain EXP and trigger level-ups.
  gainExp(amount) {
    if (!this.isUnlocked) return;
    this.exp += amount;
    while (this.exp >= this.expToNextLevel) {
      this.exp -= this.expToNextLevel;
      this.level++;
      this.expToNextLevel = this._calcExpThreshold(this.level);
    }
  }

  _calcExpThreshold(level) {
    return Math.floor(80 * Math.pow(level, 1.3));
  }

  // Advance the internal timer; returns true when it is time to attack.
  // Using reset-to-zero on fire prevents cascading attacks after a lag spike.
  tick(deltaTime) {
    this._attackTimer += deltaTime;
    if (this._attackTimer >= this.attackInterval) {
      this._attackTimer = 0;
      return true;
    }
    return false;
  }

  // Reset the attack cooldown (call when a new fight begins).
  resetTimer() {
    this._attackTimer = 0;
  }
}

// ─────────────────────────────────────────────
//  Export for Node.js (test runner) or browser
// ─────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Player, Enemy, Weapon, Rune, Companion, ENEMIES, WEAPONS, CRAFTING_RECIPES, RACES, RACE_WEIGHTS, RACE_WEIGHTS_TOTAL, rollRandomRace, getRerollDropChance, RUNES, RARITY_ORDER, LUCK_RUNE_DROP_MODIFIER, MAX_RUNE_DROP_CHANCE, WORLDS, getEnemiesForWorld };
}
