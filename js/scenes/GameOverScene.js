class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) { this.result = data; }

  create() {
    const cx = GAME_WIDTH / 2;
    const r = this.result;
    drawBackground(this);

    neonText(this, cx, 160, 'HULL BREACHED', 64, '#ff2d78').setOrigin(0.5)
      .setShadow(0, 0, '#ff2d78', 20, false, true);

    if (r.isNewHigh) {
      const nh = neonText(this, cx, 235, '★ NEW HIGH SCORE ★', 26, '#ffe14d').setOrigin(0.5);
      this.tweens.add({ targets: nh, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    }

    neonText(this, cx, 320, `SCORE   ${r.score.toLocaleString()}`, 32).setOrigin(0.5);
    neonText(this, cx, 370, `WAVE REACHED   ${r.wave}`, 22, '#8899bb').setOrigin(0.5);
    neonText(this, cx, 405, `CORES EARNED   +${r.coresEarned}`, 22, '#ffe14d').setOrigin(0.5);
    neonText(this, cx, 440, `HIGH SCORE   ${r.highScore.toLocaleString()}`, 22, '#8899bb').setOrigin(0.5);

    const retry = neonText(this, cx - 130, 540, '[ RETRY ]', 30).setOrigin(0.5);
    const menu = neonText(this, cx + 130, 540, '[ MENU ]', 30).setOrigin(0.5);
    [retry, menu].forEach(btn => {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#00f6ff'));
      btn.on('pointerout', () => btn.setColor('#e8faff'));
    });
    // { demo: false } is required — a bare start('Game') would reuse stale
    // demo data left behind by the menu's attract mode.
    retry.on('pointerdown', () => this.scene.start('Game', { demo: false }));
    menu.on('pointerdown', () => this.scene.start('Menu'));

    neonText(this, cx, 610, 'R to retry · M for menu', 16, '#556077').setOrigin(0.5);
    this.input.keyboard.on('keydown-R', () => this.scene.start('Game', { demo: false }));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Game', { demo: false }));
    this.input.keyboard.on('keydown-M', () => this.scene.start('Menu'));
  }
}
