// Between-wave shop (design doc §5: 10s pause). Upgrades are permanent and
// saved immediately — this doubles as the "garage" until M4 adds ships.
class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) {
    this.wave = data.wave;
    // Scene instances are reused: without this reset, the second shop of a run
    // inherits closed=true and can never be dismissed.
    this.closed = false;
  }

  create() {
    this.save = SaveManager.load();
    const cx = GAME_WIDTH / 2;

    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05050d, 0.82);
    neonText(this, cx, 90, `WAVE ${this.wave} CLEAR`, 44, '#39ff88').setOrigin(0.5);
    this.coresText = neonText(this, cx, 150, '', 26, '#ffe14d').setOrigin(0.5);

    this.rows = [];
    const keys = Object.keys(UPGRADES);
    keys.forEach((key, i) => {
      const y = 196 + i * 64;
      const row = {};
      row.key = key;
      row.label = neonText(this, cx - 340, y, '', 22).setOrigin(0, 0.5);
      row.desc = neonText(this, cx - 340, y + 22, UPGRADES[key].desc, 14, '#8899bb').setOrigin(0, 0.5);
      row.pips = neonText(this, cx + 80, y, '', 22, '#00f6ff').setOrigin(0, 0.5);
      row.buy = neonText(this, cx + 250, y, '', 22).setOrigin(0, 0.5);
      row.buy.setInteractive({ useHandCursor: true });
      row.buy.on('pointerdown', () => this.buy(key));
      row.buy.on('pointerover', () => { if (this.canBuy(key)) row.buy.setColor('#00f6ff'); });
      row.buy.on('pointerout', () => this.refresh());
      this.rows.push(row);
    });

    this.secondsLeft = WAVES.shopSeconds;
    this.continueBtn = neonText(this, cx, 600, '', 28, '#e8faff').setOrigin(0.5);
    this.continueBtn.setInteractive({ useHandCursor: true });
    this.continueBtn.on('pointerdown', () => this.close());
    this.continueBtn.on('pointerover', () => this.continueBtn.setColor('#00f6ff'));
    this.continueBtn.on('pointerout', () => this.continueBtn.setColor('#e8faff'));

    const menuBtn = neonText(this, cx, 650, '[ QUIT TO MENU — resume later from this wave ]', 17, '#8899bb').setOrigin(0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setColor('#ff2d78'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#8899bb'));
    menuBtn.on('pointerdown', () => this.goMenu());
    // ENTER only — SPACE is the drift key and holding it during a wave clear
    // would skip the shop via key auto-repeat.
    this.input.keyboard.on('keydown-ENTER', () => this.close());

    this.timer = this.time.addEvent({
      delay: 1000, repeat: WAVES.shopSeconds - 1,
      callback: () => {
        this.secondsLeft--;
        if (this.secondsLeft <= 0) this.close();
        else this.refresh();
      },
    });

    this.refresh();
  }

  levelOf(key) { return this.save.upgrades[key]; }

  costOf(key) {
    const lvl = this.levelOf(key);
    return lvl >= UPGRADE_COSTS.length ? null : UPGRADE_COSTS[lvl];
  }

  canBuy(key) {
    const cost = this.costOf(key);
    return cost !== null && this.save.totalCores >= cost;
  }

  buy(key) {
    if (!this.canBuy(key)) return;
    AudioFX.play('ui');
    this.save.totalCores -= this.costOf(key);
    this.save.upgrades[key]++;
    SaveManager.save(this.save);
    this.refresh();
  }

  refresh() {
    this.coresText.setText(`CORES  ${this.save.totalCores}`);
    this.rows.forEach(row => {
      const lvl = this.levelOf(row.key);
      const cost = this.costOf(row.key);
      row.label.setText(UPGRADES[row.key].name);
      row.pips.setText('◆'.repeat(lvl) + '◇'.repeat(UPGRADE_COSTS.length - lvl));
      if (cost === null) {
        row.buy.setText('MAX').setColor('#556077');
      } else {
        row.buy.setText(`BUY ${cost}`).setColor(this.canBuy(row.key) ? '#ffe14d' : '#556077');
      }
    });
    this.continueBtn.setText(`[ NEXT WAVE — ${this.secondsLeft} ]`);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.timer.remove();
    const g = this.scene.get('Game');
    this.scene.stop();
    this.scene.resume('Game');
    g.onShopClosed();
  }

  goMenu() {
    if (this.closed) return;
    this.closed = true;
    this.timer.remove();
    // Checkpoint at the upcoming wave with post-shop values, then leave.
    const g = this.scene.get('Game');
    g.save = this.save; // pick up purchases made in this shop
    g.save.pendingRun = {
      wave: this.wave + 1,
      score: g.score,
      hull: g.hull,
      coresEarned: g.coresEarned,
      totalCores: this.save.totalCores,
    };
    SaveManager.save(g.save);
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
