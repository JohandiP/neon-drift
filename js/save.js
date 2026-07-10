// Persistence via localStorage (design doc §4/§8): key 'neondrift_save', JSON.
const SaveManager = {
  KEY: 'neondrift_save',

  defaults() {
    return {
      highScore: 0,
      bestWave: 0,
      totalCores: 0,
      upgrades: { fireRate: 0, hull: 0, dashCooldown: 0, magnet: 0 },
      controls: JSON.parse(JSON.stringify(DEFAULT_CONTROLS)),
      // Wave-start checkpoint of the current run; null when no run to resume.
      pendingRun: null,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      const data = JSON.parse(raw);
      const merged = Object.assign(this.defaults(), data);
      merged.upgrades = Object.assign(this.defaults().upgrades, data.upgrades || {});
      merged.controls = Object.assign(this.defaults().controls, data.controls || {});
      return merged;
    } catch (e) {
      return this.defaults();
    }
  },

  // Wipe progress but keep the player's key bindings.
  resetProgress() {
    const fresh = this.defaults();
    fresh.controls = this.load().controls;
    this.save(fresh);
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) { /* private browsing / quota — play on without persistence */ }
  },
};
