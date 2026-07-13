// Garage (M4): unlock ships with cores, pick the one to fly. Selection and
// unlocks are permanent; the chosen ship's mods apply from the next run.
class GarageScene extends Phaser.Scene {
  constructor() { super('Garage'); }

  create() {
    makeTextures(this);
    this.save = SaveManager.load();
    drawBackground(this);
    const cx = GAME_WIDTH / 2;

    neonText(this, cx, 60, 'GARAGE', 48, '#00f6ff').setOrigin(0.5)
      .setShadow(0, 0, '#00f6ff', 16, false, true);
    this.coresText = neonText(this, cx, 115, '', 22, '#ffe14d').setOrigin(0.5);

    this.rows = Object.entries(SHIPS).map(([key, ship], i) => {
      const y = 180 + i * 88;
      const icon = this.add.image(200, y, 'ship_' + key).setAngle(-90).setScale(0.9);
      this.tweens.add({ targets: icon, y: y - 4, duration: 900 + i * 120, yoyo: true, repeat: -1 });
      const color = '#' + ship.color.toString(16).padStart(6, '0');
      neonText(this, 260, y - 22, ship.name, 22, color).setOrigin(0, 0.5);
      neonText(this, 260, y + 2, ship.desc, 14, '#8899bb').setOrigin(0, 0.5);
      neonText(this, 260, y + 22, this.modsLabel(ship.mods), 13, '#556077').setOrigin(0, 0.5);
      const action = neonText(this, GAME_WIDTH - 160, y, '', 20).setOrigin(0.5);
      action.setInteractive({ useHandCursor: true });
      action.on('pointerdown', () => this.onAction(key));
      action.on('pointerover', () => { if (this.actionKind(key) !== 'selected') action.setColor('#00f6ff'); });
      action.on('pointerout', () => this.refresh());
      return { key, action };
    });

    const back = neonText(this, cx, 662, '[ BACK ]', 24).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#00f6ff'));
    back.on('pointerout', () => back.setColor('#e8faff'));
    back.on('pointerdown', () => this.scene.start('Menu'));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

    this.refresh();
  }

  modsLabel(mods) {
    const parts = [];
    if (mods.hull) parts.push(`hull ${mods.hull > 0 ? '+' : ''}${mods.hull}`);
    if (mods.speed) parts.push(`speed ${mods.speed > 0 ? '+' : ''}${mods.speed}`);
    if (mods.fireRate) parts.push(`fire rate +${mods.fireRate}/s`);
    if (mods.dashCooldown) parts.push(`dash cd ${mods.dashCooldown}s`);
    if (mods.dashInvuln) parts.push(`dash i-frames +${mods.dashInvuln}ms`);
    return parts.length ? parts.join(' · ') : 'no modifiers';
  }

  actionKind(key) {
    if (this.save.selectedShip === key) return 'selected';
    if (this.save.unlockedShips.includes(key)) return 'select';
    return 'locked';
  }

  onAction(key) {
    const kind = this.actionKind(key);
    if (kind === 'select') {
      this.save.selectedShip = key;
    } else if (kind === 'locked') {
      const cost = SHIPS[key].cost;
      if (this.save.totalCores < cost) return;
      this.save.totalCores -= cost;
      this.save.unlockedShips.push(key);
      this.save.selectedShip = key;
    } else {
      return;
    }
    AudioFX.play('ui');
    SaveManager.save(this.save);
    this.refresh();
  }

  refresh() {
    this.coresText.setText(`CORES  ${this.save.totalCores}`);
    this.rows.forEach(({ key, action }) => {
      const kind = this.actionKind(key);
      if (kind === 'selected') {
        action.setText('◆ SELECTED').setColor('#39ff88');
      } else if (kind === 'select') {
        action.setText('[ SELECT ]').setColor('#e8faff');
      } else {
        const cost = SHIPS[key].cost;
        action.setText(`[ UNLOCK ${cost} ]`)
          .setColor(this.save.totalCores >= cost ? '#ffe14d' : '#556077');
      }
    });
  }
}
