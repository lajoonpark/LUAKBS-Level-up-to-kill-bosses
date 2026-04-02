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
  constructor(name, hp, damage, expReward, goldReward, gemDropChance = 0.1, dropTable = []) {
    this.name         = name;
    this.maxHp        = hp;
    this.hp           = hp;
    this.damage       = damage;
    this.expReward    = expReward;
    this.goldReward   = goldReward;
    this.gemDropChance = gemDropChance; // 0–1 probability
    // dropTable: [{ itemName, dropChance, minAmount, maxAmount }, ...]
    this.dropTable    = dropTable;
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

    this.inventory      = {};  // { itemName: quantity }
    this.craftedWeapons = [];  // Weapon[] – weapons made at the crafting table
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

  // ── Computed combat stats summary (for the stats display) ──
  calculateTotalStats() {
    return {
      totalDamage : this.baseDamage(),
      critChance  : this.critChance() * 100,
      maxHp       : this.stats.vitality * 10,
      luckBonus   : this.stats.luck,
    };
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
//  Sample data
// ─────────────────────────────────────────────
const ENEMIES = [
  new Enemy('Slime',        30,  5,  20,  10, 0.05, [
    { itemName: 'Slime Gel',      dropChance: 0.50, minAmount: 1, maxAmount: 3 },
  ]),
  new Enemy('Goblin',       55, 10,  45,  25, 0.10, [
    { itemName: 'Broken Dagger',  dropChance: 0.30, minAmount: 1, maxAmount: 2 },
    { itemName: 'Iron Ore',       dropChance: 0.20, minAmount: 1, maxAmount: 2 },
  ]),
  new Enemy('Skeleton',     80, 14,  70,  45, 0.12, [
    { itemName: 'Bone Fragment',  dropChance: 0.40, minAmount: 1, maxAmount: 3 },
    { itemName: 'Iron Ore',       dropChance: 0.25, minAmount: 1, maxAmount: 2 },
  ]),
  new Enemy('Orc',         100, 18,  90,  60, 0.15, [
    { itemName: 'Iron Ore',       dropChance: 0.35, minAmount: 2, maxAmount: 4 },
    { itemName: 'Wood',           dropChance: 0.25, minAmount: 1, maxAmount: 3 },
  ]),
  new Enemy('Troll',       180, 28, 170, 120, 0.20, [
    { itemName: 'Troll Hide',     dropChance: 0.40, minAmount: 1, maxAmount: 2 },
    { itemName: 'Iron Ore',       dropChance: 0.30, minAmount: 2, maxAmount: 4 },
  ]),
  new Enemy('Dark Knight', 250, 40, 250, 180, 0.30, [
    { itemName: 'Dark Steel',     dropChance: 0.35, minAmount: 1, maxAmount: 2 },
    { itemName: 'Iron Ore',       dropChance: 0.20, minAmount: 2, maxAmount: 3 },
  ]),
  new Enemy('Dragon Boss', 500, 60, 600, 400, 0.50, [
    { itemName: 'Dragon Scale',   dropChance: 0.50, minAmount: 1, maxAmount: 3 },
    { itemName: 'Dark Steel',     dropChance: 0.40, minAmount: 2, maxAmount: 4 },
  ]),
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
    name: 'Iron Sword',
    weapon: { name: 'Iron Sword', baseDamage: 25, rarity: 'uncommon' },
    materials: [
      { itemName: 'Iron Ore', amount: 5 },
      { itemName: 'Wood',     amount: 2 },
    ],
    goldCost: 100,
    gemsCost: 0,
  },
  {
    name: 'Bone Blade',
    weapon: { name: 'Bone Blade', baseDamage: 35, rarity: 'uncommon' },
    materials: [
      { itemName: 'Bone Fragment', amount: 4 },
      { itemName: 'Iron Ore',      amount: 3 },
    ],
    goldCost: 0,
    gemsCost: 0,
  },
  {
    name: 'Troll Crusher',
    weapon: { name: 'Troll Crusher', baseDamage: 50, rarity: 'rare' },
    materials: [
      { itemName: 'Troll Hide', amount: 3 },
      { itemName: 'Iron Ore',   amount: 5 },
    ],
    goldCost: 200,
    gemsCost: 0,
  },
  {
    name: 'Dark Edge',
    weapon: { name: 'Dark Edge', baseDamage: 70, rarity: 'epic' },
    materials: [
      { itemName: 'Dark Steel', amount: 4 },
      { itemName: 'Troll Hide', amount: 2 },
    ],
    goldCost: 300,
    gemsCost: 0,
  },
  {
    name: 'Dragon Fang',
    weapon: { name: 'Dragon Fang', baseDamage: 100, rarity: 'legendary' },
    materials: [
      { itemName: 'Dragon Scale', amount: 3 },
      { itemName: 'Dark Steel',   amount: 4 },
    ],
    goldCost: 500,
    gemsCost: 2,
  },
];

// ─────────────────────────────────────────────
//  Export for Node.js (test runner) or browser
// ─────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Player, Enemy, Weapon, ENEMIES, WEAPONS, CRAFTING_RECIPES };
}
