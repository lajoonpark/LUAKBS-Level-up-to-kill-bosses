// ============================================================
//  LUAKBS – Level Up to Kill Bosses
//  timing.js  –  Timing-based attack bar system
// ============================================================

class TimingBar {
  /**
   * @param {Object} opts
   * @param {number} opts.speed          - Marker speed (units/sec, default 60)
   * @param {number} opts.hitZoneMin     - Start of hit zone (0–100, default 38)
   * @param {number} opts.hitZoneMax     - End of hit zone   (0–100, default 62)
   * @param {number} opts.perfectRadius  - Half-width of the "perfect" zone (default 5)
   * @param {number} opts.goodRadius     - Half-width of the "good" zone   (default 11)
   */
  constructor(opts = {}) {
    this.speed         = opts.speed        ?? 60;
    this.hitZoneMin    = opts.hitZoneMin   ?? 38;
    this.hitZoneMax    = opts.hitZoneMax   ?? 62;
    this.perfectRadius = opts.perfectRadius ?? 5;
    this.goodRadius    = opts.goodRadius    ?? 11;

    this.position      = 0;     // 0–100
    this.direction     = 1;     // +1 or -1
    this.active        = false;
    this.lastTimestamp = null;

    // Callbacks (set by the UI layer)
    this.onHit  = null;   // (resultObj) => void
    this.onTick = null;   // (position)  => void
  }

  // ── Start the bar moving ───────────────────────────────────
  start() {
    this.active        = true;
    this.position      = 0;
    this.direction     = 1;
    this.lastTimestamp = performance.now();
    this._tick();
  }

  // ── Stop the bar ──────────────────────────────────────────
  stop() {
    this.active = false;
  }

  // ── Internal animation loop (requestAnimationFrame) ────────
  _tick(timestamp) {
    if (!this.active) return;

    timestamp = timestamp ?? performance.now();
    const delta = (timestamp - this.lastTimestamp) / 1000; // seconds
    this.lastTimestamp = timestamp;

    this.updateMarkerPosition(delta);

    if (typeof this.onTick === 'function') this.onTick(this.position, delta);

    requestAnimationFrame((ts) => this._tick(ts));
  }

  // ── Move the marker, bouncing at 0 and 100 ─────────────────
  updateMarkerPosition(deltaTime) {
    this.position += this.direction * this.speed * deltaTime;

    if (this.position >= 100) {
      this.position  = 100;
      this.direction = -1;
    } else if (this.position <= 0) {
      this.position  = 0;
      this.direction = 1;
    }
  }

  // ── Called when the player clicks ─────────────────────────
  handleClick() {
    const result = this.calculateTimingMultiplier(this.position);
    if (typeof this.onHit === 'function') this.onHit(result);
    return result;
  }

  // ── Determine hit quality and damage multiplier ────────────
  calculateTimingMultiplier(position) {
    const center      = (this.hitZoneMin + this.hitZoneMax) / 2;
    const distFromCenter = Math.abs(position - center);

    let quality;
    let multiplier;

    if (distFromCenter <= this.perfectRadius) {
      quality    = 'perfect';
      multiplier = 2.0;
    } else if (distFromCenter <= this.goodRadius) {
      quality    = 'good';
      multiplier = 1.5;
    } else if (position >= this.hitZoneMin && position <= this.hitZoneMax) {
      quality    = 'bad';
      multiplier = 1.0;
    } else {
      quality    = 'miss';
      multiplier = 0;
    }

    return {
      position,
      quality,
      multiplier,
      label: TimingBar.LABELS[quality],
    };
  }

  // ── Increase speed with player level ──────────────────────
  setSpeedForLevel(level) {
    this.speed = 40 + level * 5;  // level 1 → 45 u/s, level 10 → 90 u/s
  }

  // ── Combine timing with player attack ─────────────────────
  attackEnemyWithTiming(player, enemy) {
    const result = this.handleClick();
    const damage = player.attackEnemy(enemy, result.multiplier);
    return { ...result, damage };
  }
}

TimingBar.LABELS = {
  perfect : 'Perfect!',
  good    : 'Good!',
  bad     : 'Hit',
  miss    : 'Miss!',
};

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TimingBar };
}
