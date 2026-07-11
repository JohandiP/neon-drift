// Key-remap menu (design doc §7: remappable controls). Click a binding, press
// the new key. Bindings persist in the save; duplicates swap automatically.
class ControlsScene extends Phaser.Scene {
  constructor() { super('Controls'); }

  create() {
    this.save = SaveManager.load();
    this.rebinding = null;
    drawBackground(this);
    const cx = GAME_WIDTH / 2;

    neonText(this, cx, 95, 'CONTROLS', 52, '#00f6ff').setOrigin(0.5);
    neonText(this, cx, 150, 'click a binding, then press the new key  ·  ESC cancels', 16, '#8899bb').setOrigin(0.5);

    const actions = [
      ['up', 'MOVE UP'], ['down', 'MOVE DOWN'], ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'],
      ['drift', 'DRIFT'], ['dash', 'DASH'],
    ];
    this.rows = actions.map(([action, label], i) => {
      const y = 210 + i * 52;
      neonText(this, cx - 230, y, label, 22).setOrigin(0, 0.5);
      const keyText = neonText(this, cx + 230, y, '', 22, '#ffe14d').setOrigin(1, 0.5);
      keyText.setInteractive({ useHandCursor: true });
      const row = { action, keyText };
      keyText.on('pointerdown', () => this.startRebind(row));
      return row;
    });

    const yAim = 210 + 6 * 52;
    neonText(this, cx - 230, yAim, 'AIM & FIRE', 22).setOrigin(0, 0.5);
    neonText(this, cx + 230, yAim, 'MOUSE (AUTO-FIRE)', 22, '#556077').setOrigin(1, 0.5);
    neonText(this, cx - 230, yAim + 30, 'arrow keys always work as alternate movement', 14, '#556077').setOrigin(0, 0.5);

    this.fpsToggle = neonText(this, cx, 600, '', 20).setOrigin(0.5);
    this.fpsToggle.setInteractive({ useHandCursor: true });
    this.fpsToggle.on('pointerover', () => this.fpsToggle.setColor('#00f6ff'));
    this.fpsToggle.on('pointerout', () => this.refreshFps());
    this.fpsToggle.on('pointerdown', () => {
      this.save.showFps = !this.save.showFps;
      SaveManager.save(this.save);
      this.refreshFps();
    });
    this.refreshFps();

    const reset = neonText(this, cx - 140, 655, '[ RESET ]', 26).setOrigin(0.5);
    const back = neonText(this, cx + 140, 655, '[ BACK ]', 26).setOrigin(0.5);
    [reset, back].forEach(b => {
      b.setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setColor('#00f6ff'));
      b.on('pointerout', () => b.setColor('#e8faff'));
    });
    reset.on('pointerdown', () => this.resetDefaults());
    back.on('pointerdown', () => this.scene.start('Menu'));

    this.refresh();
  }

  startRebind(row) {
    if (this.rebinding) return;
    this.rebinding = row;
    row.keyText.setText('PRESS KEY…').setColor('#ff2d78');
    this.input.keyboard.once('keydown', this.onRebindKey, this);
  }

  onRebindKey(event) {
    if (event.preventDefault) event.preventDefault();
    const row = this.rebinding;
    this.rebinding = null;
    if (!row || event.key === 'Escape') { this.refresh(); return; }

    const controls = this.save.controls;
    const taken = Object.keys(controls).find(a => controls[a].code === event.keyCode);
    if (taken && taken !== row.action) {
      controls[taken] = { ...controls[row.action] }; // swap to avoid dead actions
    }
    controls[row.action] = { code: event.keyCode, name: keyDisplayName(event) };
    SaveManager.save(this.save);
    this.refresh();
  }

  resetDefaults() {
    if (this.rebinding) return;
    this.save.controls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
    SaveManager.save(this.save);
    this.refresh();
  }

  refresh() {
    this.rows.forEach(row => {
      row.keyText.setText(this.save.controls[row.action].name).setColor('#ffe14d');
    });
  }

  refreshFps() {
    this.fpsToggle.setText(`[ SHOW FPS: ${this.save.showFps ? 'ON' : 'OFF'} ]`)
      .setColor(this.save.showFps ? '#39ff88' : '#8899bb');
  }
}
