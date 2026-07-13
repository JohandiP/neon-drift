// Persistence via localStorage (design doc §4/§8): key 'neondrift_save', JSON.
const SaveManager = {
  KEY: 'neondrift_save',

  defaults() {
    return {
      highScore: 0,
      bestWave: 0,
      totalCores: 0,
      upgrades: { fireRate: 0, hull: 0, dashCooldown: 0, magnet: 0, damage: 0, drift: 0 },
      selectedShip: 'viper',
      unlockedShips: ['viper'],
      showFps: false,
      sfxVolume: 0.8,
      musicVolume: 0.5,
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
      if (!Array.isArray(merged.unlockedShips) || !merged.unlockedShips.length) {
        merged.unlockedShips = ['viper'];
      }
      if (!SHIPS[merged.selectedShip]) merged.selectedShip = 'viper';
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
