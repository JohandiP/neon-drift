// In-game guide: every enemy and pickup with its live sprite and a short
// description, plus the basics. Reads key names from the save so it always
// matches the player's bindings.
class GuideScene extends Phaser.Scene {
  constructor() { super('Guide'); }

  create() {
    makeTextures(this);
    drawBackground(this);
    const c = SaveManager.load().controls;
    const cx = GAME_WIDTH / 2;

    neonText(this, cx, 55, 'GUIDE', 46, '#00f6ff').setOrigin(0.5)
      .setShadow(0, 0, '#00f6ff', 16, false, true);

    const row = (x, y, texture, scale, name, color, desc, spin) => {
      const icon = this.add.image(x, y, texture).setScale(scale);
      if (spin) this.tweens.add({ targets: icon, angle: 360, duration: 7000, repeat: -1 });
      neonText(this, x + 52, y - 13, name, 18, color).setOrigin(0, 0.5);
      neonText(this, x + 52, y + 11, desc, 14, '#8899bb').setOrigin(0, 0.5);
    };

    // --- Enemies (left column) ---
    neonText(this, 110, 112, 'ENEMIES', 22, '#ff2d78');
    [
      ['chaser',   0.5,  'CHASER',   '#ff2d78', '20 HP · rushes straight at you'],
      ['mini',     0.5,  'MINI',     '#ff6da8', '10 HP · fast fragment of a splitter'],
      ['shooter',  0.5,  'SHOOTER',  '#ffaa22', '30 HP · keeps its distance and fires at you'],
      ['splitter', 0.5,  'SPLITTER', '#39ff88', '40 HP · splits into two minis when killed'],
      ['boss',     0.24, 'BOSS',     '#bb44ff', 'every 5th wave · 3 kinds rotate: burst / charger / mini-spawner'],
    ].forEach(([tex, scale, name, color, desc], i) => {
      row(140, 172 + i * 64, tex, scale, name, color, desc, true);
    });

    // --- Pickups (right column) ---
    neonText(this, 670, 112, 'PICKUPS', 22, '#ffe14d');
    [
      ['core',         0.65, 'CORE',       '#ffe14d', 'currency · chases you · spend in the shop'],
      ['buff_regen',   0.5,  'REGEN',      '#39ff88', '+6 hull per second for 6s'],
      ['buff_shield',  0.5,  'SHIELD',     '#00f6ff', 'invulnerable for 4s'],
      ['buff_bigshot', 0.5,  'BIG SHOT',   '#ff2d78', 'huge bullets, 2.5x damage, for 6s'],
      ['buff_rapid',   0.5,  'RAPID FIRE', '#ffe14d', 'double fire rate for 6s'],
      ['buff_assist',  0.5,  'ASSIST',     '#7dffca', 'drone wingman for 10s · boss waves only'],
    ].forEach(([tex, scale, name, color, desc], i) => {
      row(700, 168 + i * 56, tex, scale, name, color, desc, false);
    });
    neonText(this, 670, 486, 'drop from enemies (8%), always from bosses · re-pickup extends, but capped', 13, '#556077');

    // --- Basics (bottom) ---
    neonText(this, 110, 508, 'BASICS', 22, '#00f6ff');
    this.add.image(140, 590, 'ship').setAngle(-90).setScale(0.6);
    [
      `move with ${c.up.name} ${c.left.name} ${c.down.name} ${c.right.name} or arrows · your ship auto-fires at the mouse cursor`,
      `hold ${c.drift.name} near enemies to drift — raises the multiplier (the x-number under SCORE, up to x8)`,
      'every kill scores 100 x your multiplier · getting hit drops it back to x1',
      `${c.dash.name} dashes with brief invulnerability · ESC or P pauses`,
      'ramming an enemy hurts you both — it takes 15 damage when its hit lands on you',
      'clear a wave to open the shop · upgrades and garage ships are permanent across runs',
    ].forEach((line, i) => {
      neonText(this, 190, 546 + i * 24, line, 15, '#8899bb').setOrigin(0, 0.5);
    });

    const back = neonText(this, cx, 688, '[ BACK ]', 24).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#00f6ff'));
    back.on('pointerout', () => back.setColor('#e8faff'));
    back.on('pointerdown', () => this.scene.start('Menu'));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
  }
}
