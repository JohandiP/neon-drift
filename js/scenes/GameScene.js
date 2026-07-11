class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create(data) {
    makeTextures(this);
    this.themeIndex = -1; // startWave draws the arena theme

    // Attract-mode demo: rookie pilot, random ship, no upgrades — and it
    // must never write to the real save.
    this.demoMode = !!(data && data.demo);
    this.exiting = false;
    if (this.demoMode) {
      this.save = SaveManager.defaults();
      const shipKeys = Object.keys(SHIPS);
      this.save.selectedShip = shipKeys[Math.floor(Math.random() * shipKeys.length)];
      this.demoAim = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
      this.pilotState = Pilot.makeState();
      this.demoEndsAt = 0; // set on first update
    } else {
      this.save = SaveManager.load();
    }
    this.runStartHigh = this.save.highScore;
    this.stats = playerStats(this.save);
    const resume = (!this.demoMode && data && data.resume && this.save.pendingRun) ? this.save.pendingRun : null;

    // Run state (restored from the wave-start checkpoint when resuming)
    this.score = resume ? resume.score : 0;
    this.multiplier = 1;
    this.driftHeat = 0;
    this.wave = 0;
    this.coresEarned = resume ? resume.coresEarned : 0;
    this.hull = resume ? Math.min(resume.hull, this.stats.maxHull) : this.stats.maxHull;
    if (resume) this.save.totalCores = resume.totalCores;
    this.invulnUntil = 0;
    this.dashReadyAt = 0;
    this.nextFireAt = 0;
    this.spawnRemaining = 0;
    this.waveActive = false;
    this.gameEnded = false;

    // Player
    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ship_' + this.save.selectedShip);
    // Ship textures are drawn at 2x (80x60) for crisp vector edges; display
    // at half scale so the world size (and feel) is unchanged.
    this.player.setScale(0.5);
    this.player.setDrag(PLAYER.drag).setCollideWorldBounds(true);
    // Clamp the velocity VECTOR, not per-axis (setMaxVelocity) — per-axis
    // clamping let diagonal movement run 41% over the design speed.
    this.player.body.setMaxSpeed(this.stats.maxSpeed);
    this.player.body.setCircle(28, 16, 2); // texture px; effective radius 14 at 0.5 scale
    this.dashBoostUntil = 0;

    // Groups (pooled)
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 120 });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 200 });
    this.enemies = this.physics.add.group();
    this.cores = this.physics.add.group({ defaultKey: 'core', maxSize: 120 });
    this.buffs = this.physics.add.group();
    this.activeBuffs = {}; // buff key -> expiry timestamp

    // Assist drone (boss-wave buff): orbits the player, fires at enemies.
    this.drone = this.add.image(0, 0, 'drone').setVisible(false).setDepth(5);
    this.droneNextFire = 0;

    // Particles
    this.burst = this.add.particles(0, 0, 'particle', {
      speed: { min: 60, max: 240 },
      lifespan: 420,
      scale: { start: 1.1, end: 0 },
      emitting: false,
      blendMode: 'ADD',
    });

    // Engine trail: emitted from the ship's tail while moving (see update).
    this.engineTrail = this.add.particles(0, 0, 'particle', {
      speed: { min: 8, max: 30 },
      lifespan: 280,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: (SHIPS[this.save.selectedShip] || SHIPS.viper).color,
      emitting: false,
      blendMode: 'ADD',
    }).setDepth(-1);
    this.trailNextAt = 0;

    // Collisions
    this.physics.add.collider(this.enemies, this.enemies); // keeps packs from stacking into one blob
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.onBulletHitsEnemy(b, e));
    this.physics.add.overlap(this.player, this.enemies, (p, e) => this.onPlayerTouchesEnemy(e));
    this.physics.add.overlap(this.player, this.enemyBullets, (p, b) => this.onPlayerShot(b));
    this.physics.add.overlap(this.player, this.cores, (p, c) => this.collectCore(c));
    this.physics.add.overlap(this.player, this.buffs, (p, b) => this.collectBuff(b));

    // Input
    const kb = this.input.keyboard;
    const c = this.save.controls;
    this.keys = {
      up: kb.addKey(c.up.code), down: kb.addKey(c.down.code),
      left: kb.addKey(c.left.code), right: kb.addKey(c.right.code),
      drift: kb.addKey(c.drift.code), dash: kb.addKey(c.dash.code),
      up2: kb.addKey('UP'), down2: kb.addKey('DOWN'),
      left2: kb.addKey('LEFT'), right2: kb.addKey('RIGHT'),
    };

    // Pause on ESC or P. The shop no longer relies on the scene 'resume' event
    // (it calls onShopClosed directly), so resuming from pause is side-effect free.
    const doPause = () => {
      if (this.gameEnded || this.demoMode) return;
      this.scene.launch('Pause');
      this.scene.pause();
    };
    kb.on('keydown-ESC', doPause);
    kb.on('keydown-P', doPause);

    if (this.demoMode) {
      // Any real input hands control back to the menu.
      const exit = () => this.exitDemo();
      kb.on('keydown', exit);
      this.input.on('pointerdown', exit);
      const badge = neonText(this, GAME_WIDTH / 2, 120, 'DEMO', 40, '#ff2d78').setOrigin(0.5).setDepth(30);
      this.tweens.add({ targets: badge, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });
      neonText(this, GAME_WIDTH / 2, 158, 'press any key or click to return', 15, '#8899bb').setOrigin(0.5).setDepth(30);
    }

    this.createHUD();
    this.startWave(this.demoMode ? 6 + Math.floor(Math.random() * 8) : (resume ? resume.wave : 1));
  }

  // ---------- HUD ----------

  createHUD() {
    const d = 20; // depth above everything
    this.hudScore = neonText(this, 20, 14, '', 24).setDepth(d);
    this.hudMult = neonText(this, 20, 46, '', 20, '#00f6ff').setDepth(d);
    this.hudWave = neonText(this, GAME_WIDTH - 20, 14, '', 24).setOrigin(1, 0).setDepth(d);
    this.hudCores = neonText(this, GAME_WIDTH - 20, 46, '', 20, '#ffe14d').setOrigin(1, 0).setDepth(d);

    this.hullBarBg = this.add.rectangle(GAME_WIDTH / 2, 26, 304, 22, 0x1a1a2e).setDepth(d);
    this.hullBar = this.add.rectangle(GAME_WIDTH / 2 - 150, 26, 300, 16, 0x39ff88).setOrigin(0, 0.5).setDepth(d);
    this.hudHullText = neonText(this, GAME_WIDTH / 2, 26, '', 14, '#05050d').setOrigin(0.5).setDepth(d + 1);

    this.hudDash = neonText(this, GAME_WIDTH / 2, 52, 'DASH READY', 14, '#00f6ff').setOrigin(0.5).setDepth(d);
    this.hudBuffs = neonText(this, 20, 78, '', 15, '#ffe14d').setDepth(d);
    this.lastBuffText = '';
    this.hudFps = neonText(this, GAME_WIDTH - 20, 78, '', 14, '#556077').setOrigin(1, 0).setDepth(d);
    this.fpsNextUpdate = 0;

    this.bossBar = this.add.rectangle(GAME_WIDTH / 2 - 200, 88, 400, 10, 0xbb44ff).setOrigin(0, 0.5).setDepth(d).setVisible(false);
    this.bossBarBg = this.add.rectangle(GAME_WIDTH / 2, 88, 404, 14, 0x1a1a2e).setDepth(d - 1).setVisible(false);

    this.waveBanner = neonText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, '', 52, '#ff2d78')
      .setOrigin(0.5).setDepth(d).setAlpha(0);

    this.updateHUD();
  }

  updateHUD() {
    this.hudScore.setText(`SCORE ${this.score.toLocaleString()}`);
    this.hudMult.setText(`x${this.multiplier}`);
    this.hudMult.setColor(this.multiplier >= 5 ? '#ff2d78' : '#00f6ff');
    this.hudWave.setText(`WAVE ${this.wave}`);
    this.hudCores.setText(`CORES ${this.save.totalCores}`);
    const pct = Phaser.Math.Clamp(this.hull / this.stats.maxHull, 0, 1);
    this.hullBar.width = 300 * pct;
    this.hullBar.fillColor = pct > 0.5 ? 0x39ff88 : (pct > 0.25 ? 0xffe14d : 0xff2d78);
    this.hudHullText.setText(`${Math.max(0, Math.ceil(this.hull))} / ${this.stats.maxHull}`);
  }

  showBanner(text) {
    this.waveBanner.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.waveBanner, alpha: 0, delay: 900, duration: 500 });
  }

  // ---------- Waves ----------

  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    // Arena theme rotates every 10 waves (design doc §5).
    const themeIdx = Math.floor((n - 1) / 10) % THEMES.length;
    if (themeIdx !== this.themeIndex) {
      this.themeIndex = themeIdx;
      if (this.gridG) this.gridG.destroy();
      this.gridG = drawGrid(this, themeIdx);
    }
    // Checkpoint: quitting to menu (or closing the game) resumes by restarting
    // this wave with the values it began with — mid-wave gains roll back.
    if (!this.demoMode) {
      this.save.pendingRun = {
        wave: n,
        score: this.score,
        hull: this.hull,
        coresEarned: this.coresEarned,
        totalCores: this.save.totalCores,
      };
      SaveManager.save(this.save);
    }
    const count = n + 2;
    this.spawnRemaining = count;
    this.showBanner(n % WAVES.bossEveryNWaves === 0 ? `WAVE ${n} — BOSS` : `WAVE ${n}`);

    const pool = ['chaser'];
    if (n >= WAVES.shooterUnlockWave) pool.push('shooter');
    if (n >= WAVES.splitterUnlockWave) pool.push('splitter');

    // One repeating timer for the whole wave instead of one event per enemy.
    this.time.addEvent({
      delay: 350, repeat: count - 1,
      callback: () => {
        if (this.gameEnded) return;
        this.spawnEnemy(Phaser.Utils.Array.GetRandom(pool));
        this.spawnRemaining--;
      },
    });
    if (n % WAVES.bossEveryNWaves === 0) {
      this.spawnRemaining++;
      this.time.delayedCall(1200, () => {
        if (this.gameEnded) return;
        this.spawnEnemy('boss');
        this.spawnRemaining--;
      });
    }
    this.updateHUD();
  }

  edgeSpawnPoint() {
    const m = 40;
    const side = Phaser.Math.Between(0, 3);
    if (side === 0) return { x: Phaser.Math.Between(0, GAME_WIDTH), y: -m };
    if (side === 1) return { x: Phaser.Math.Between(0, GAME_WIDTH), y: GAME_HEIGHT + m };
    if (side === 2) return { x: -m, y: Phaser.Math.Between(0, GAME_HEIGHT) };
    return { x: GAME_WIDTH + m, y: Phaser.Math.Between(0, GAME_HEIGHT) };
  }

  spawnEnemy(type, x, y) {
    const cfg = ENEMIES[type];
    // Boss kind rotates per boss wave: 5 → warden, 10 → lancer, 15 → hive...
    let bcfg = null, bossKind = null;
    if (type === 'boss') {
      const kinds = Object.keys(BOSSES);
      bossKind = kinds[Math.max(0, Math.floor(this.wave / WAVES.bossEveryNWaves) - 1) % kinds.length];
      bcfg = BOSSES[bossKind];
    }
    const pos = (x === undefined) ? this.edgeSpawnPoint() : { x, y };
    // Pooled: reuse a dead enemy sprite (and its body) instead of allocating.
    const e = this.enemies.get(pos.x, pos.y);
    if (!e) return null;
    e.setTexture(bcfg ? bcfg.tex : type);
    e.setScale(0.5); // enemy textures are drawn at 2x for crisp vector edges
    e.setActive(true).setVisible(true);
    e.clearTint();
    e.setAlpha(1);
    e.body.reset(pos.x, pos.y);
    e.body.enable = true;
    e.flashUntil = 0;
    e.nextChargeAt = 0;
    e.chargingUntil = 0;
    e.nextSpawnAt = 0;
    e.enemyType = type;
    e.bossKind = bossKind;
    e.hp = bcfg ? bcfg.hp + (this.wave - 1) * 30 : cfg.hp;
    e.maxHp = e.hp;
    e.damage = cfg.damage;
    e.coreDrop = cfg.cores;
    e.speed = (bcfg ? bcfg.speed : cfg.speed) * (1 + WAVES.enemySpeedRampPerWave * (this.wave - 1));
    // Per-enemy variation so packs spread out instead of merging into one blob:
    // individual speed, plus a sinusoidal wander applied to the homing angle.
    e.speed *= Phaser.Math.FloatBetween(0.85, 1.15);
    e.wanderPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    e.wanderFreq = Phaser.Math.FloatBetween(1.2, 2.4);
    e.wanderAmp = { chaser: 0.65, mini: 0.85, splitter: 0.4, shooter: 0.35, boss: 0.12 }[type];
    e.body.setCircle(bcfg ? bcfg.size : cfg.size); // texture px; halved by sprite scale
    e.nextShotAt = this.time.now + Phaser.Math.Between(1200, 2400);
    if (type === 'boss') {
      this.bossBar.setVisible(true);
      this.bossBarBg.setVisible(true);
      this.activeBoss = e;
    }
    return e;
  }

  checkWaveClear() {
    if (!this.waveActive || this.gameEnded) return;
    if (this.spawnRemaining > 0 || this.enemies.countActive(true) > 0) return;
    this.waveActive = false;
    // The field is safe between waves: sweep every projectile still in flight
    // so nothing stray hits the player during the banner or after the shop.
    this.bullets.getChildren().forEach(b => { if (b.active) this.killProjectile(b); });
    this.enemyBullets.getChildren().forEach(b => { if (b.active) this.killProjectile(b); });
    const bonus = WAVES.clearBonus * this.wave;
    this.score += bonus;
    this.hull = Math.min(this.stats.maxHull, this.hull + WAVES.clearHeal);
    this.showBanner(`WAVE CLEAR  +${bonus.toLocaleString()}`);
    this.updateHUD();
    this.time.delayedCall(1100, () => {
      if (this.gameEnded) return;
      if (this.demoMode) { this.startWave(this.wave + 1); return; } // no shop in demos
      // Persist here, not earlier: cores still flying to the player during the
      // banner are collected by now, and the shop reads cores from the save.
      this.persistProgress();
      this.waveBanner.setAlpha(0);
      this.scene.pause();
      this.scene.launch('Shop', { wave: this.wave });
    });
  }

  onShopClosed() {
    // Re-read upgrades bought in the shop; hull upgrades add to current hull too.
    this.save = SaveManager.load();
    const prevMax = this.stats.maxHull;
    this.stats = playerStats(this.save);
    this.hull = Math.min(this.stats.maxHull, this.hull + (this.stats.maxHull - prevMax));
    this.updateHUD();
    this.startWave(this.wave + 1);
  }

  // ---------- Combat ----------

  aimTarget() {
    if (this.demoMode) return this.demoAim;
    const p = this.input.activePointer;
    return { x: p.worldX, y: p.worldY };
  }

  fireBullet(time) {
    const aim = this.aimTarget();
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);
    const b = this.bullets.get(this.player.x, this.player.y);
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.body.reset(this.player.x + Math.cos(angle) * 24, this.player.y + Math.sin(angle) * 24);
    b.body.enable = true;
    b.setRotation(angle);
    const big = this.buffActive('bigshot');
    b.setScale(big ? 2.4 : 1);
    b.damage = big ? this.stats.bulletDamage * 2.5 : this.stats.bulletDamage;
    this.physics.velocityFromRotation(angle, PLAYER.bulletSpeed, b.body.velocity);
    b.diesAt = time + 1500;
    this.nextFireAt = time + 1000 / (this.stats.fireRate * (this.buffActive('rapid') ? 2 : 1));
  }

  fireEnemyBullet(x, y, angle, speed) {
    const b = this.enemyBullets.get(x, y);
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.body.reset(x, y);
    b.body.enable = true;
    this.physics.velocityFromRotation(angle, speed, b.body.velocity);
    b.diesAt = this.time.now + 4000;
  }

  killProjectile(b) {
    b.setActive(false).setVisible(false);
    b.body.enable = false;
  }

  onBulletHitsEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    this.killProjectile(bullet);
    enemy.hp -= bullet.damage || PLAYER.bulletDamage;
    enemy.setTintFill(0xffffff);
    enemy.flashUntil = this.time.now + 60; // cleared in update — no timer alloc per hit
    // Impact sparks: point-blank shots die within a frame or two of travel,
    // so without this the gun looks jammed when the ship is swarmed.
    this.burst.explode(3, bullet.x, bullet.y);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    const { x, y } = enemy;
    this.score += WAVES.killScore * this.multiplier;
    this.burst.explode(enemy.enemyType === 'boss' ? 46 : 14, x, y);
    this.cameras.main.shake(enemy.enemyType === 'boss' ? 250 : 90, enemy.enemyType === 'boss' ? 0.012 : 0.0035);

    if (enemy.enemyType === 'splitter') {
      this.spawnEnemy('mini', x - 14, y);
      this.spawnEnemy('mini', x + 14, y);
    }
    if (enemy.enemyType === 'boss') {
      this.bossBar.setVisible(false);
      this.bossBarBg.setVisible(false);
      this.activeBoss = null;
    }
    for (let i = 0; i < enemy.coreDrop; i++) {
      const c = this.cores.get(x + Phaser.Math.Between(-18, 18), y + Phaser.Math.Between(-18, 18));
      if (!c) break;
      c.setActive(true).setVisible(true);
      c.body.reset(c.x, c.y);
      c.body.enable = true;
      c.setCollideWorldBounds(true);
      c.body.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-60, 60));
    }
    if (enemy.enemyType === 'boss' || Math.random() < BUFF_DROP_CHANCE) this.spawnBuff(x, y);
    // Back to the pool, not destroyed — the sprite is reused by later spawns.
    enemy.setActive(false).setVisible(false);
    enemy.body.stop();
    enemy.body.enable = false;
    this.updateHUD();
    this.checkWaveClear();
  }

  spawnBuff(x, y) {
    const isBossWave = this.wave % WAVES.bossEveryNWaves === 0;
    const pool = Object.keys(BUFFS).filter(k => !BUFFS[k].bossOnly || isBossWave);
    const type = Phaser.Utils.Array.GetRandom(pool);
    const b = this.buffs.create(x, y, 'buff_' + type);
    b.buffType = type;
    b.diesAt = this.time.now + BUFF_LIFETIME_MS;
    b.setCollideWorldBounds(true);
    b.body.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-40, 40));
    b.body.setDrag(60);
  }

  collectBuff(pickup) {
    if (!pickup.active) return;
    const cfg = BUFFS[pickup.buffType];
    // Extend the timer, capped at maxDuration remaining — repeat pickups can't
    // build an arbitrarily long shield.
    const now = this.time.now;
    const current = Math.max(this.activeBuffs[pickup.buffType] || 0, now);
    this.activeBuffs[pickup.buffType] = Math.min(
      current + cfg.duration * 1000,
      now + cfg.maxDuration * 1000
    );
    const label = neonText(this, pickup.x, pickup.y - 12, cfg.name, 18,
      '#' + cfg.color.toString(16).padStart(6, '0')).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: label, y: label.y - 40, alpha: 0, duration: 900, onComplete: () => label.destroy() });
    pickup.destroy();
  }

  buffActive(type) {
    return (this.activeBuffs[type] || 0) > this.time.now;
  }

  collectCore(core) {
    if (!core.active) return;
    core.setActive(false).setVisible(false);
    core.body.enable = false;
    this.coresEarned++;
    this.save.totalCores++;
    this.updateHUD();
  }

  onPlayerTouchesEnemy(enemy) {
    if (!enemy.active) return;
    // Collisions hurt both sides — but the enemy only takes ram damage when
    // the player actually pays hull for it. Invulnerable ramming (shield,
    // dash, post-hit i-frames) deals nothing, so it can't become a weapon.
    if (this.damagePlayer(enemy.damage)) {
      enemy.hp -= PLAYER.ramDamage;
      enemy.setTintFill(0xffffff);
      enemy.flashUntil = this.time.now + 60;
      if (enemy.active && enemy.hp <= 0) this.killEnemy(enemy);
    }
  }

  onPlayerShot(bullet) {
    if (!bullet.active) return;
    this.killProjectile(bullet);
    this.damagePlayer(8);
  }

  // Returns true when damage actually landed (not absorbed by shield/i-frames).
  damagePlayer(amount) {
    const now = this.time.now;
    if (this.buffActive('shield') || now < this.invulnUntil || this.gameEnded) return false;
    this.invulnUntil = now + PLAYER.hitInvulnMs;
    this.hull -= amount;
    this.multiplier = 1;
    this.driftHeat = 0;
    this.cameras.main.shake(160, 0.008);
    this.cameras.main.flash(120, 255, 30, 60);
    this.player.setTintFill(0xff4444);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.updateHUD();
    if (this.hull <= 0) this.endRun();
    return true;
  }

  endRun() {
    this.gameEnded = true;
    this.burst.explode(40, this.player.x, this.player.y);
    this.cameras.main.shake(400, 0.02);
    this.player.setVisible(false);
    this.player.body.enable = false;
    this.drone.setVisible(false);

    const isNewHigh = this.score > this.runStartHigh;
    this.save.pendingRun = null; // the run is over — nothing to resume
    this.persistProgress();

    this.time.delayedCall(1200, () => {
      if (this.demoMode) { this.scene.start('Menu'); return; }
      this.scene.start('GameOver', {
        score: this.score,
        wave: this.wave,
        coresEarned: this.coresEarned,
        highScore: Math.max(this.score, this.save.highScore),
        isNewHigh,
      });
    });
  }

  exitDemo() {
    if (this.exiting) return;
    this.exiting = true;
    this.scene.start('Menu');
  }

  persistProgress() {
    if (this.demoMode) return;
    this.save.highScore = Math.max(this.save.highScore, this.score);
    this.save.bestWave = Math.max(this.save.bestWave, this.wave);
    SaveManager.save(this.save);
  }

  // Called when quitting to menu mid-wave: cores grabbed during the aborted
  // wave attempt roll back so quit-resume can't farm the same wave twice.
  quitToMenu() {
    if (this.save.pendingRun) {
      this.save.totalCores = this.save.pendingRun.totalCores;
      SaveManager.save(this.save);
    }
  }

  // Push every pending timestamp past a pause gap so timers resume where
  // they left off instead of expiring during the pause.
  shiftTimers(gap) {
    this.invulnUntil += gap;
    this.dashReadyAt += gap;
    this.dashBoostUntil += gap;
    if (isFinite(this.nextFireAt)) this.nextFireAt += gap;
    this.droneNextFire += gap;
    Object.keys(this.activeBuffs).forEach(k => { this.activeBuffs[k] += gap; });
    this.bullets.getChildren().forEach(b => { if (b.active) b.diesAt += gap; });
    this.enemyBullets.getChildren().forEach(b => { if (b.active) b.diesAt += gap; });
    this.buffs.getChildren().forEach(b => { if (b.active) b.diesAt += gap; });
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      e.nextShotAt += gap;
      if (e.nextChargeAt) e.nextChargeAt += gap;
      if (e.chargingUntil) e.chargingUntil += gap;
      if (e.nextSpawnAt) e.nextSpawnAt += gap;
    });
  }

  // ---------- Per-frame ----------

  update(time, delta) {
    if (this.gameEnded) return;
    // `time` is the global clock and keeps running while this scene is paused
    // (pause menu, shop, hidden tab). Without this shift, buff durations, dash
    // cooldown and enemy shot timers would all silently expire during a pause.
    if (this.lastTick !== undefined && time - this.lastTick > 250) {
      this.shiftTimers(time - this.lastTick - delta);
    }
    this.lastTick = time;
    const dt = delta / 1000;
    const k = this.keys;

    // Attract mode: the rookie pilot flies; a stale demo self-terminates.
    if (this.demoMode) {
      if (!this.demoEndsAt) this.demoEndsAt = time + 60000;
      if (time > this.demoEndsAt) { this.exitDemo(); return; }
      Pilot.update(this, time, this.demoCfg || PILOT_ROOKIE, this.pilotState);
    }

    // Movement (acceleration-based, design doc §3)
    let ax = 0, ay = 0;
    if (k.left.isDown || k.left2.isDown) ax -= 1;
    if (k.right.isDown || k.right2.isDown) ax += 1;
    if (k.up.isDown || k.up2.isDown) ay -= 1;
    if (k.down.isDown || k.down2.isDown) ay += 1;
    const len = Math.hypot(ax, ay) || 1;
    this.player.setAcceleration((ax / len) * PLAYER.accel, (ay / len) * PLAYER.accel);

    // Drift: lower drag, higher top speed, builds multiplier near enemies
    const drifting = k.drift.isDown;
    this.player.setDrag(drifting ? PLAYER.driftDrag : PLAYER.drag);
    // Speed cap by state: dash burst > drift > normal.
    this.player.body.maxSpeed = time < this.dashBoostUntil
      ? PLAYER.dashSpeed
      : (drifting ? this.stats.driftMaxSpeed : this.stats.maxSpeed);

    if (drifting && this.multiplier < PLAYER.maxMultiplier) {
      const near = this.enemies.getChildren().some(e =>
        e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < PLAYER.driftBuildRadius);
      if (near) {
        this.driftHeat += dt * this.stats.driftRate;
        if (this.driftHeat >= 1) {
          this.driftHeat = 0;
          this.multiplier++;
          this.updateHUD();
        }
      }
    } else if (!drifting) {
      this.driftHeat = Math.max(0, this.driftHeat - dt * 0.5);
    }
    this.player.setAlpha(time < this.invulnUntil ? 0.5 : (drifting ? 0.85 : 1));

    // Aim at the mouse (or the pilot's virtual cursor in demo mode)
    const aim = this.aimTarget();
    this.player.setRotation(Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y));

    // Engine trail while under way (denser during a dash)
    if (this.player.body.velocity.length() > 60 && time >= this.trailNextAt) {
      this.trailNextAt = time + (time < this.dashBoostUntil ? 16 : 38);
      const back = this.player.rotation + Math.PI;
      this.engineTrail.emitParticleAt(
        this.player.x + Math.cos(back) * 15,
        this.player.y + Math.sin(back) * 15
      );
    }

    // Dash
    if (Phaser.Input.Keyboard.JustDown(k.dash) && time >= this.dashReadyAt) {
      this.dashReadyAt = time + this.stats.dashCooldown * 1000;
      this.invulnUntil = Math.max(this.invulnUntil, time + this.stats.dashInvulnMs);
      this.dashBoostUntil = time + this.stats.dashInvulnMs;
      this.player.body.maxSpeed = PLAYER.dashSpeed; // raise cap NOW, not next frame
      const v = this.player.body.velocity;
      const dashAngle = (v.length() > 20) ? v.angle() : this.player.rotation;
      this.physics.velocityFromRotation(dashAngle, PLAYER.dashSpeed, this.player.body.velocity);
      this.burst.explode(10, this.player.x, this.player.y);
      this.cameras.main.shake(80, 0.003);
    }
    this.hudDash.setText(time >= this.dashReadyAt ? 'DASH READY' : 'DASH …');
    this.hudDash.setColor(time >= this.dashReadyAt ? '#00f6ff' : '#556077');

    // Auto-fire toward cursor
    if (time >= this.nextFireAt) this.fireBullet(time);

    // Projectile lifetimes
    this.bullets.getChildren().forEach(b => { if (b.active && time > b.diesAt) this.killProjectile(b); });
    this.enemyBullets.getChildren().forEach(b => { if (b.active && time > b.diesAt) this.killProjectile(b); });

    // Cores always chase the player and their speed scales with distance, so
    // even drifting (380) or dashing (820) can't leave one behind for long.
    this.cores.getChildren().forEach(c => {
      if (!c.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      const a = Phaser.Math.Angle.Between(c.x, c.y, this.player.x, this.player.y);
      const base = d < this.stats.magnetRadius ? CORE_MAGNET_SPEED : CORE_CHASE_SPEED;
      this.physics.velocityFromRotation(a, Math.min(900, Math.max(base, d * 1.6)), c.body.velocity);
    });

    // Buff pickups: expire after a while (blinking near the end). Once the
    // magnet grabs one it stays hooked and keeps chasing even if the ship
    // outruns the magnet radius — otherwise it would sail off its stale
    // heading and stall somewhere random.
    this.buffs.getChildren().slice().forEach(b => {
      if (!b.active) return;
      if (time > b.diesAt) { b.destroy(); return; }
      b.setAlpha(b.diesAt - time < 3000 ? ((Math.floor(time / 150) % 2) ? 0.25 : 1) : 1);
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
      if (!b.hooked && d < this.stats.magnetRadius) b.hooked = true;
      if (b.hooked) {
        const a = Phaser.Math.Angle.Between(b.x, b.y, this.player.x, this.player.y);
        this.physics.velocityFromRotation(a, Math.min(800, Math.max(300, d * 1.4)), b.body.velocity);
      }
    });

    // Active buff effects
    if (this.buffActive('regen') && this.hull < this.stats.maxHull) {
      this.hull = Math.min(this.stats.maxHull, this.hull + REGEN_PER_SECOND * dt);
    }
    const shielded = this.buffActive('shield');
    if (shielded && !this.hadShield) this.player.setTint(0x66eaff);
    if (!shielded && this.hadShield) this.player.clearTint();
    this.hadShield = shielded;

    // Assist drone: orbits the player and fires at the nearest enemy.
    if (this.buffActive('assist')) {
      const orbit = time / 400;
      this.drone.setVisible(true);
      this.drone.x = this.player.x + Math.cos(orbit) * 70;
      this.drone.y = this.player.y + Math.sin(orbit) * 70;
      this.drone.setRotation(orbit + Math.PI / 2); // face along the orbit
      if (time >= this.droneNextFire) {
        let nearest = null, best = 520 * 520;
        this.enemies.getChildren().forEach(e => {
          if (!e.active) return;
          const d2 = (e.x - this.drone.x) ** 2 + (e.y - this.drone.y) ** 2;
          if (d2 < best) { best = d2; nearest = e; }
        });
        if (nearest) {
          this.droneNextFire = time + 400;
          const a = Phaser.Math.Angle.Between(this.drone.x, this.drone.y, nearest.x, nearest.y);
          this.drone.setRotation(a);
          const b = this.bullets.get(this.drone.x, this.drone.y);
          if (b) {
            b.setActive(true).setVisible(true);
            b.body.reset(this.drone.x, this.drone.y);
            b.body.enable = true;
            b.setRotation(a).setScale(1);
            b.damage = this.stats.bulletDamage;
            this.physics.velocityFromRotation(a, PLAYER.bulletSpeed, b.body.velocity);
            b.diesAt = time + 1500;
          }
        }
      }
    } else {
      this.drone.setVisible(false);
    }

    const shownHull = Math.ceil(this.hull);
    if (shownHull !== this.lastShownHull) { this.lastShownHull = shownHull; this.updateHUD(); }

    if (this.save.showFps && time >= this.fpsNextUpdate) {
      this.fpsNextUpdate = time + 250;
      this.hudFps.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
    }

    const buffText = Object.keys(this.activeBuffs)
      .filter(k => this.activeBuffs[k] > time)
      .map(k => `${BUFFS[k].name} ${Math.ceil((this.activeBuffs[k] - time) / 1000)}`)
      .join('   ');
    if (buffText !== this.lastBuffText) { this.lastBuffText = buffText; this.hudBuffs.setText(buffText); }

    // Enemy AI
    const activeEnemies = this.enemies.getChildren().filter(e => e.active);
    activeEnemies.forEach(e => {
      if (e.flashUntil && time > e.flashUntil) { e.clearTint(); e.flashUntil = 0; }
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
      const toPlayer = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
      const wander = Math.sin((time / 1000) * e.wanderFreq + e.wanderPhase) * e.wanderAmp;

      switch (e.enemyType) {
        case 'chaser':
        case 'mini':
        case 'splitter':
          this.physics.velocityFromRotation(toPlayer + wander, e.speed, e.body.velocity);
          break;
        case 'shooter':
          if (dist > 320) this.physics.velocityFromRotation(toPlayer + wander, e.speed, e.body.velocity);
          else if (dist < 220) this.physics.velocityFromRotation(toPlayer + Math.PI - wander, e.speed, e.body.velocity);
          else e.body.setVelocity(0, 0);
          if (time >= e.nextShotAt && dist < 560) {
            e.nextShotAt = time + 2000;
            this.fireEnemyBullet(e.x, e.y, toPlayer, 220);
          }
          break;
        case 'boss':
          if (e.bossKind === 'lancer') {
            // Charges at the player in bursts; aimed 3-shot spread in between.
            if (!e.nextChargeAt) e.nextChargeAt = time + 2500;
            if (e.chargingUntil > time) {
              // velocity stays locked from the charge start
            } else if (time >= e.nextChargeAt) {
              e.chargingUntil = time + 750;
              e.nextChargeAt = time + 4000;
              this.physics.velocityFromRotation(toPlayer, 480, e.body.velocity);
            } else {
              this.physics.velocityFromRotation(toPlayer + wander, e.speed, e.body.velocity);
              if (time >= e.nextShotAt) {
                e.nextShotAt = time + 2200;
                [-0.25, 0, 0.25].forEach(off => this.fireEnemyBullet(e.x, e.y, toPlayer + off, 260));
              }
            }
          } else if (e.bossKind === 'hive') {
            // Slow bruiser that births minis and lobs single aimed shots.
            this.physics.velocityFromRotation(toPlayer + wander, e.speed, e.body.velocity);
            if (!e.nextSpawnAt) e.nextSpawnAt = time + 3000;
            if (time >= e.nextSpawnAt && this.enemies.countActive(true) < 35) {
              e.nextSpawnAt = time + 4000;
              this.spawnEnemy('mini', e.x - 30, e.y);
              this.spawnEnemy('mini', e.x + 30, e.y);
            }
            if (time >= e.nextShotAt) {
              e.nextShotAt = time + 2000;
              this.fireEnemyBullet(e.x, e.y, toPlayer, 150);
            }
          } else {
            // Warden: the classic radial burst.
            this.physics.velocityFromRotation(toPlayer + wander, e.speed, e.body.velocity);
            if (time >= e.nextShotAt) {
              e.nextShotAt = time + 3000;
              for (let i = 0; i < 12; i++) {
                this.fireEnemyBullet(e.x, e.y, (i / 12) * Math.PI * 2, 170);
              }
            }
          }
          break;
      }
      // Separation steering: repel from neighbors within 52px so packs fan out
      // and ring the player instead of merging into a single blob.
      if (e.enemyType !== 'boss') {
        let sx = 0, sy = 0;
        const range = 52;
        for (const o of activeEnemies) {
          if (o === e || o.enemyType === 'boss') continue;
          const dx = e.x - o.x, dy = e.y - o.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < range * range) {
            const d = Math.sqrt(d2);
            const f = (1 - d / range) * 260;
            sx += (dx / d) * f;
            sy += (dy / d) * f;
          }
        }
        e.body.velocity.x += sx;
        e.body.velocity.y += sy;
      }

      e.rotation += dt * 1.5; // idle spin, reads well on shapes
    });

    if (this.activeBoss && this.activeBoss.active) {
      this.bossBar.width = 400 * Phaser.Math.Clamp(this.activeBoss.hp / this.activeBoss.maxHp, 0, 1);
    }
  }
}
