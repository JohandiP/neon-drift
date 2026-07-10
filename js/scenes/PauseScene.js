// Pause overlay (ESC/P in-game). Resume continues mid-wave exactly where you
// were; quitting to menu falls back to the wave-start checkpoint.
class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05050d, 0.78);

    neonText(this, cx, 240, 'PAUSED', 60, '#00f6ff').setOrigin(0.5)
      .setShadow(0, 0, '#00f6ff', 18, false, true);

    const resume = neonText(this, cx, 370, '[ RESUME ]', 32).setOrigin(0.5);
    const quit = neonText(this, cx, 440, '[ QUIT TO MENU ]', 24).setOrigin(0.5);
    [resume, quit].forEach(b => {
      b.setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setColor('#00f6ff'));
      b.on('pointerout', () => b.setColor('#e8faff'));
    });
    resume.on('pointerdown', () => this.resumeGame());
    quit.on('pointerdown', () => this.quitToMenu());

    neonText(this, cx, 510, 'quitting restarts the current wave on resume', 15, '#556077').setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
  }

  resumeGame() {
    this.scene.stop();
    this.scene.resume('Game');
  }

  quitToMenu() {
    this.scene.get('Game').quitToMenu();
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
