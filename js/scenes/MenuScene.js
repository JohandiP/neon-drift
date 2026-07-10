class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    makeTextures(this);
    const save = SaveManager.load();
    const cx = GAME_WIDTH / 2;

    drawGrid(this);

    const title = neonText(this, cx, 170, 'NEON DRIFT', 84, '#00f6ff').setOrigin(0.5);
    title.setShadow(0, 0, '#00f6ff', 24, false, true);
    neonText(this, cx, 240, 'drift close. never stop shooting.', 20, '#ff2d78').setOrigin(0.5);

    if (save.highScore > 0) {
      neonText(this, cx, 305, `HIGH SCORE  ${save.highScore.toLocaleString()}    BEST WAVE  ${save.bestWave}`, 20, '#ffe14d').setOrigin(0.5);
    }
    neonText(this, cx, 340, `CORES  ${save.totalCores}`, 18, '#ffe14d').setOrigin(0.5);

    if (save.pendingRun) {
      const resumeBtn = neonText(this, cx, 383, `[ RESUME — WAVE ${save.pendingRun.wave} ]`, 26, '#39ff88').setOrigin(0.5);
      resumeBtn.setInteractive({ useHandCursor: true });
      resumeBtn.on('pointerover', () => resumeBtn.setColor('#00f6ff'));
      resumeBtn.on('pointerout', () => resumeBtn.setColor('#39ff88'));
      resumeBtn.on('pointerdown', () => this.scene.start('Game', { resume: true }));
    }

    const play = neonText(this, cx, 425, '[ PLAY ]', 40, '#e8faff').setOrigin(0.5);
    play.setInteractive({ useHandCursor: true });
    play.on('pointerover', () => play.setColor('#00f6ff'));
    play.on('pointerout', () => play.setColor('#e8faff'));
    play.on('pointerdown', () => this.startGame());

    [['[ CONTROLS ]', -125, 'Controls'], ['[ GUIDE ]', 125, 'Guide']].forEach(([label, dx, scene]) => {
      const btn = neonText(this, cx + dx, 483, label, 24, '#e8faff').setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#00f6ff'));
      btn.on('pointerout', () => btn.setColor('#e8faff'));
      btn.on('pointerdown', () => this.scene.start(scene));
    });

    const c = save.controls;
    neonText(this, cx, 570,
      `${c.up.name}${c.left.name}${c.down.name}${c.right.name} / ARROWS  move        MOUSE  aim (auto-fire)\n` +
      `${c.drift.name} (hold)  drift near enemies to build multiplier\n` +
      `${c.dash.name}  dash (brief invulnerability)        ESC / P  pause`,
      17, '#8899bb').setOrigin(0.5).setAlign('center').setLineSpacing(8);

    neonText(this, cx, 655, 'press ENTER or click PLAY', 16, '#556077').setOrigin(0.5);

    // Danger zone: wipes score/cores/upgrades (keeps key bindings). Two clicks
    // required; the armed state disarms itself after 3 seconds.
    this.resetArmed = false;
    this.resetBtn = neonText(this, cx, 695, '[ RESET PROGRESS ]', 14, '#556077').setOrigin(0.5);
    this.resetBtn.setInteractive({ useHandCursor: true });
    this.resetBtn.on('pointerover', () => { if (!this.resetArmed) this.resetBtn.setColor('#ff2d78'); });
    this.resetBtn.on('pointerout', () => { if (!this.resetArmed) this.resetBtn.setColor('#556077'); });
    this.resetBtn.on('pointerdown', () => this.onResetClick());

    neonText(this, GAME_WIDTH - 12, GAME_HEIGHT - 14, GAME_VERSION, 13, '#556077').setOrigin(1, 1);

    this.input.keyboard.on('keydown-ENTER', () => this.startGame());
    this.tweens.add({ targets: play, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
  }

  startGame() {
    this.scene.start('Game');
  }

  onResetClick() {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.setText('[ WIPE ALL PROGRESS? CLICK AGAIN ]').setColor('#ff2d78');
      this.disarmTimer = this.time.delayedCall(3000, () => {
        this.resetArmed = false;
        this.resetBtn.setText('[ RESET PROGRESS ]').setColor('#556077');
      });
      return;
    }
    if (this.disarmTimer) this.disarmTimer.remove();
    SaveManager.resetProgress();
    this.scene.restart();
  }
}

// Shared subtle neon grid background
function drawGrid(scene) {
  const g = scene.add.graphics();
  g.lineStyle(1, 0x15254a, 0.6);
  for (let x = 0; x <= GAME_WIDTH; x += 64) { g.lineBetween(x, 0, x, GAME_HEIGHT); }
  for (let y = 0; y <= GAME_HEIGHT; y += 64) { g.lineBetween(0, y, GAME_WIDTH, y); }
  return g;
}
