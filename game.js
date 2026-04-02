// ============================================================
//  LUAKBS – Level Up to Kill Bosses
//  game.js  –  Core RPG classes and combat logic
// ============================================================

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
  constructor(name, hp, damage, expReward, goldReward, gemDropChance = 0.1) {
    this.name         = name;
    this.maxHp        = hp;
    this.hp           = hp;
    this.damage       = damage;
    this.expReward    = expReward;
    this.goldReward   = goldReward;
    this.gemDropChance = gemDropChance; // 0–1 probability
  }

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

    this.weapon = new Weapon('Rusty Sword', 8, 'common');
    this.log    = [];  // combat/event log kept for the UI
  }

  // ── Scaling formula: base 100 * level^1.5 ──────────────────
  _calcExpThreshold(level) {
    return Math.floor(100 * Math.pow(level, 1.5));
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

  // ── Equip a weapon ─────────────────────────────────────────
  equipWeapon(weapon) {
    this.weapon = weapon;
    this._addLog(`Equipped ${weapon.toString()}`);
  }

  // ── Crit chance (0–1) based on dexterity ───────────────────
  critChance() {
    return Math.min(0.05 + this.stats.dexterity * 0.01, 0.75);
  }

  // ── Base attack damage ──────────────────────────────────────
  baseDamage() {
    return this.weapon.baseDamage + this.stats.strength * 2;
  }

  // ── Attack an enemy (returns damage dealt) ─────────────────
  attackEnemy(enemy, timingMultiplier = 1.0) {
    if (timingMultiplier === 0) {
      this._addLog(`You missed ${enemy.name}!`);
      return 0;
    }
    let damage = this.baseDamage() * timingMultiplier;
    const isCrit = Math.random() < this.critChance();
    if (isCrit) {
      damage *= 2;
      this._addLog(`💥 CRITICAL HIT!`);
    }
    damage = Math.max(1, Math.round(damage));
    enemy.hp = Math.max(0, enemy.hp - damage);
    this._addLog(`You hit ${enemy.name} for ${damage} damage. (${enemy.hp}/${enemy.maxHp} HP left)`);
    return damage;
  }

  // ── Full fight against one enemy (no timing; auto-combat) ──
  fightEnemy(enemy) {
    enemy.reset();
    this._addLog(`⚔ Battle started: ${this.name} vs ${enemy.name}`);

    while (enemy.isAlive()) {
      this.attackEnemy(enemy, 1.0);

      if (!enemy.isAlive()) break;

      // Enemy hits back
      const dmgTaken = Math.max(1, enemy.damage - Math.floor(this.stats.vitality * 0.5));
      this._addLog(`${enemy.name} hits you for ${dmgTaken} damage.`);
    }

    this._collectRewards(enemy);
  }

  // ── Collect rewards after defeating an enemy ───────────────
  _collectRewards(enemy) {
    this.gainExp(enemy.expReward);
    this.gold += enemy.goldReward;
    this._addLog(`+${enemy.goldReward} gold. Total gold: ${this.gold}`);

    // Gem drop – luck increases the chance
    const gemChance = Math.min(enemy.gemDropChance + this.stats.luck * 0.005, 0.9);
    if (Math.random() < gemChance) {
      this.gems++;
      this._addLog(`💎 Gem dropped! Total gems: ${this.gems}`);
    }
  }

  _addLog(msg) {
    this.log.push(msg);
    if (typeof onGameLog === 'function') onGameLog(msg);  // hook for UI
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
//  Sample data
// ─────────────────────────────────────────────
const ENEMIES = [
  new Enemy('Slime',        30,  5,  20,  10, 0.05),
  new Enemy('Goblin',       55, 10,  45,  25, 0.10),
  new Enemy('Skeleton',     80, 14,  70,  45, 0.12),
  new Enemy('Orc',         100, 18,  90,  60, 0.15),
  new Enemy('Troll',       180, 28, 170, 120, 0.20),
  new Enemy('Dark Knight', 250, 40, 250, 180, 0.30),
  new Enemy('Dragon Boss', 500, 60, 600, 400, 0.50),
];

const WEAPONS = [
  new Weapon('Rusty Sword',    8,  'common'),
  new Weapon('Iron Blade',    18,  'uncommon'),
  new Weapon('Steel Edge',    32,  'rare'),
  new Weapon('Void Cleaver',  55,  'epic'),
  new Weapon('Dragon Slayer', 90,  'legendary'),
];

// ─────────────────────────────────────────────
//  Export for Node.js (test runner) or browser
// ─────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Player, Enemy, Weapon, ENEMIES, WEAPONS };
}
