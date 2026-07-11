// Tuning constants — all gameplay numbers live here (see design doc §3-4).
const GAME_VERSION = 'v0.4.1'; // bump when tagging a release (vMAJOR.MINOR.PATCH)
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const PLAYER = {
  accel: 620,
  maxSpeed: 320,
  driftMaxSpeed: 380,
  drag: 420,
  driftDrag: 70,
  baseHull: 100,
  baseFireRate: 5,        // shots per second
  bulletDamage: 10,
  bulletSpeed: 640,
  dashSpeed: 820,
  dashInvulnMs: 300,
  baseDashCooldown: 1.5,  // seconds
  hitInvulnMs: 800,
  ramDamage: 15, // dealt to an enemy when its contact damage actually lands on you
  driftBuildRadius: 170,  // must be this close to an enemy while drifting
  maxMultiplier: 8,
};

const ENEMIES = {
  chaser:   { hp: 20,  speed: 140, damage: 10, cores: 1, size: 26, tint: 0xff2d78 },
  mini:     { hp: 10,  speed: 185, damage: 6,  cores: 0, size: 16, tint: 0xff6da8 },
  shooter:  { hp: 30,  speed: 110, damage: 8,  cores: 2, size: 28, tint: 0xffaa22 },
  splitter: { hp: 40,  speed: 90,  damage: 12, cores: 2, size: 34, tint: 0x39ff88 },
  boss:     { hp: 300, speed: 60,  damage: 20, cores: 10, size: 96, tint: 0xbb44ff },
};

const WAVES = {
  enemySpeedRampPerWave: 0.05, // +5% enemy speed per wave
  shooterUnlockWave: 3,
  splitterUnlockWave: 6,
  bossEveryNWaves: 5,
  killScore: 100,              // x current multiplier
  clearBonus: 500,             // x wave number
  clearHeal: 15,
  shopSeconds: 10,
};

const UPGRADE_COSTS = [100, 250, 500, 1000];

// Ships (M4): unlocked permanently with cores in the garage. `mods` adjust the
// base PLAYER stats after upgrades are applied.
const SHIPS = {
  viper:   { name: 'VIPER',   cost: 0,   color: 0x00f6ff, desc: 'balanced all-rounder',
             mods: {} },
  bastion: { name: 'BASTION', cost: 300, color: 0x39ff88, desc: 'armored, but slower',
             mods: { hull: 50, speed: -40 } },
  dart:    { name: 'DART',    cost: 300, color: 0xffe14d, desc: 'fast and fragile',
             mods: { hull: -25, speed: 45 } },
  vulcan:  { name: 'VULCAN',  cost: 600, color: 0xffaa22, desc: 'extra guns, thin armor',
             mods: { hull: -15, fireRate: 2 } },
  phantom: { name: 'PHANTOM', cost: 900, color: 0xbb44ff, desc: 'dash master',
             mods: { hull: -15, dashCooldown: -0.5, dashInvuln: 150 } },
};

// Bosses (M4): three kinds rotate every 5th wave (5 → warden, 10 → lancer,
// 15 → hive, 20 → warden again...). HP scales +30 per wave on top of base.
const BOSSES = {
  warden: { tex: 'boss',        size: 96,  speed: 60, hp: 300 }, // radial bursts
  lancer: { tex: 'boss_lancer', size: 80,  speed: 70, hp: 260 }, // charges + aimed spread
  hive:   { tex: 'boss_hive',   size: 110, speed: 45, hp: 340 }, // spawns minis
};

// Arena themes (M4): background changes every 10 waves.
const THEMES = [
  { bg: 0x0a0a18, grid: 0x15254a }, // midnight
  { bg: 0x160a1c, grid: 0x43195e }, // vapor
  { bg: 0x081410, grid: 0x14503a }, // toxin
];

// Timed power-ups dropped by enemies (guaranteed from bosses). Picking up the
// same buff again extends it, but never beyond maxDuration remaining.
const BUFFS = {
  regen:   { name: 'REGEN',      duration: 6,  maxDuration: 10, color: 0x39ff88 }, // +6 hull/s
  shield:  { name: 'SHIELD',     duration: 4,  maxDuration: 6,  color: 0x00f6ff }, // invulnerable
  bigshot: { name: 'BIG SHOT',   duration: 6,  maxDuration: 10, color: 0xff2d78 }, // 2.5x damage, huge bullets
  rapid:   { name: 'RAPID FIRE', duration: 6,  maxDuration: 10, color: 0xffe14d }, // 2x fire rate
  assist:  { name: 'ASSIST',     duration: 10, maxDuration: 15, color: 0x7dffca, bossOnly: true }, // drone wingman
};
const BUFF_DROP_CHANCE = 0.08;
const BUFF_LIFETIME_MS = 12000;
const REGEN_PER_SECOND = 6;

// Core pickup homing: always faster than the player's 320 max speed so
// dropped cores are never left behind; they sprint inside magnet range.
const CORE_CHASE_SPEED = 340;
const CORE_MAGNET_SPEED = 540;

const UPGRADES = {
  fireRate:     { name: 'FIRE RATE',     desc: '+1.5 shots/sec' },
  hull:         { name: 'HULL',          desc: '+25 max hull' },
  dashCooldown: { name: 'DASH COOLDOWN', desc: '-0.25s cooldown' },
  magnet:       { name: 'CORE MAGNET',   desc: '+60px pickup range' },
  damage:       { name: 'DAMAGE',        desc: '+3 bullet damage' },
  drift:        { name: 'DRIFT CHARGE',  desc: '+20% multiplier build rate' },
};

function upgradeStats(up) {
  return {
    fireRate: PLAYER.baseFireRate + 1.5 * up.fireRate,
    maxHull: PLAYER.baseHull + 25 * up.hull,
    dashCooldown: PLAYER.baseDashCooldown - 0.25 * up.dashCooldown,
    magnetRadius: 60 + 60 * up.magnet,
    bulletDamage: PLAYER.bulletDamage + 3 * (up.damage || 0),
    driftRate: 1 + 0.2 * (up.drift || 0),
  };
}

// Full player stats: upgrades first, then the selected ship's modifiers.
function playerStats(save) {
  const s = upgradeStats(save.upgrades);
  const mods = (SHIPS[save.selectedShip] || SHIPS.viper).mods;
  s.maxHull = Math.max(25, s.maxHull + (mods.hull || 0));
  s.fireRate += mods.fireRate || 0;
  s.dashCooldown = Math.max(0.4, s.dashCooldown + (mods.dashCooldown || 0));
  s.maxSpeed = PLAYER.maxSpeed + (mods.speed || 0);
  s.driftMaxSpeed = PLAYER.driftMaxSpeed + (mods.speed || 0);
  s.dashInvulnMs = PLAYER.dashInvulnMs + (mods.dashInvuln || 0);
  // Dash chaining must always leave a vulnerable window: i-frames are capped
  // at 150ms less than the cooldown (maxed Phantom hit 450ms invuln on a
  // 400ms cooldown = provably immortal).
  s.dashInvulnMs = Math.min(s.dashInvulnMs, Math.max(100, s.dashCooldown * 1000 - 150));
  return s;
}

// Placeholder-shape textures (design doc M1-M3: colored shapes until the M5 art pass).
function makeTextures(scene) {
  if (scene.textures.exists('ship')) return;
  const g = scene.make.graphics({ add: false });

  // Player ships (M5 vector art): layered neon vector hulls pointing right
  // (Phaser rotation 0 = right), one texture per garage ship, drawn at 2x
  // (80x60) and displayed at 0.5 scale in the arena for crisp edges.
  // 'ship' stays as an alias of the default Viper for UI screens.
  Object.entries(SHIPS).forEach(([key, s]) => drawShipTexture(g, 'ship_' + key, SHIP_ART[key], s.color));
  drawShipTexture(g, 'ship', SHIP_ART.viper, SHIPS.viper.color);

  // Enemies
  g.fillStyle(ENEMIES.chaser.tint); g.fillRect(0, 0, 26, 26);
  g.generateTexture('chaser', 26, 26); g.clear();

  g.fillStyle(ENEMIES.mini.tint); g.fillRect(0, 0, 16, 16);
  g.generateTexture('mini', 16, 16); g.clear();

  g.fillStyle(ENEMIES.shooter.tint);
  g.beginPath();
  g.moveTo(14, 0); g.lineTo(28, 14); g.lineTo(14, 28); g.lineTo(0, 14);
  g.closePath(); g.fillPath();
  g.generateTexture('shooter', 28, 28); g.clear();

  g.fillStyle(ENEMIES.splitter.tint); g.fillCircle(17, 17, 17);
  g.generateTexture('splitter', 34, 34); g.clear();

  g.fillStyle(ENEMIES.boss.tint); g.fillCircle(48, 48, 48);
  g.fillStyle(0x05050d); g.fillCircle(48, 48, 20);
  g.generateTexture('boss', 96, 96); g.clear();

  // Lancer boss: red ring with a spear-like core
  g.fillStyle(0xff3344); g.fillCircle(40, 40, 40);
  g.fillStyle(0x05050d); g.fillCircle(40, 40, 22);
  g.fillStyle(0xff3344); g.fillRect(36, 8, 8, 64);
  g.generateTexture('boss_lancer', 80, 80); g.clear();

  // Hive boss: green ring with cell dots
  g.fillStyle(0x2fe06b); g.fillCircle(55, 55, 55);
  g.fillStyle(0x05050d); g.fillCircle(55, 55, 26);
  g.fillStyle(0x05050d);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.fillCircle(55 + Math.cos(a) * 40, 55 + Math.sin(a) * 40, 7);
  }
  g.generateTexture('boss_hive', 110, 110); g.clear();

  // Projectiles
  g.fillStyle(0xffffff); g.fillRect(0, 0, 12, 4);
  g.generateTexture('bullet', 12, 4); g.clear();

  g.fillStyle(0xff4444); g.fillCircle(5, 5, 5);
  g.generateTexture('enemyBullet', 10, 10); g.clear();

  // Core pickup: yellow diamond
  g.fillStyle(0xffe14d);
  g.beginPath();
  g.moveTo(7, 0); g.lineTo(14, 7); g.lineTo(7, 14); g.lineTo(0, 7);
  g.closePath(); g.fillPath();
  g.generateTexture('core', 14, 14); g.clear();

  // Assist drone: small mint wingman triangle
  g.fillStyle(0x7dffca);
  g.beginPath();
  g.moveTo(22, 8); g.lineTo(0, 0); g.lineTo(5, 8); g.lineTo(0, 16);
  g.closePath(); g.fillPath();
  g.generateTexture('drone', 22, 16); g.clear();

  // Buff pickups: colored donuts
  Object.entries(BUFFS).forEach(([key, cfg]) => {
    g.fillStyle(cfg.color); g.fillCircle(11, 11, 11);
    g.fillStyle(0x05050d); g.fillCircle(11, 11, 5);
    g.generateTexture('buff_' + key, 22, 22); g.clear();
  });

  // Particle
  g.fillStyle(0xffffff); g.fillRect(0, 0, 5, 5);
  g.generateTexture('particle', 5, 5);

  g.destroy();
}

// Rebindable keyboard controls (aim/fire is always the mouse). Arrow keys stay
// as hardwired movement alternates. `code` is a DOM keyCode, `name` is display.
const DEFAULT_CONTROLS = {
  up:    { code: 87, name: 'W' },
  down:  { code: 83, name: 'S' },
  left:  { code: 65, name: 'A' },
  right: { code: 68, name: 'D' },
  drift: { code: 32, name: 'SPACE' },
  dash:  { code: 16, name: 'SHIFT' },
};

function keyDisplayName(event) {
  if (event.key === ' ') return 'SPACE';
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key.replace('Arrow', '').toUpperCase();
}

// Layered vector ship art (M5). Local coordinates face right, origin at the
// ship's center, scaled 0.5x onto an 80x60 texture. Layers back-to-front:
// engine glow, pods/barrels, dark hull + neon edge, translucent panel,
// bright leading edges, seams, nozzles, cockpit canopy.
const SHIP_ART = {
  viper: {
    pale: 0xbffaff,
    hull: [[70,0],[18,-12],[-20,-14],[-46,-30],[-58,-13],[-70,-9],[-70,9],[-58,13],[-46,30],[-20,14],[18,12]],
    panel: [[52,0],[14,-8],[-18,-9],[-38,-20],[-46,-9],[-56,-6],[-56,6],[-46,9],[-38,20],[-18,9],[14,8]],
    edges: [[[70,0],[18,-12],[-20,-14],[-46,-30]],[[70,0],[18,12],[-20,14],[-46,30]]],
    seams: [[[-22,-15],[-34,-23]],[[-22,15],[-34,23]],[[-10,-13],[-20,-19]],[[-10,13],[-20,19]]],
    spine: [[58,0],[-62,0]],
    cockpit: { x: 26, y: 0, w: 26, h: 11 },
    engines: [[-73,-10,9,7],[-73,3,9,7]],
    glows: [{ x: -72, y: 0 }],
  },
  bastion: {
    pale: 0xc8ffdf,
    preRects: [[-42,-38,24,8],[-42,30,24,8]],
    hull: [[56,0],[34,-15],[8,-19],[-14,-33],[-46,-33],[-50,-19],[-62,-15],[-62,15],[-50,19],[-46,33],[-14,33],[8,19],[34,15]],
    panel: [[44,0],[28,-11],[6,-14],[-14,-26],[-42,-26],[-45,-14],[-54,-11],[-54,11],[-45,14],[-42,26],[-14,26],[6,14],[28,11]],
    seams: [[[-8,-20],[-8,20]],[[-28,-24],[-28,24]]],
    cockpit: { x: 28, y: 0, w: 20, h: 10 },
    engines: [[-66,-12,8,8],[-66,4,8,8]],
    glows: [{ x: -66, y: -8 }, { x: -66, y: 8 }],
  },
  dart: {
    pale: 0xfff3c0,
    hull: [[70,0],[22,-6],[-26,-8],[-36,-22],[-50,-22],[-42,-7],[-64,-5],[-64,5],[-42,7],[-50,22],[-36,22],[-26,8],[22,6]],
    panel: [[56,0],[20,-4],[-24,-5],[-56,-3],[-56,3],[-24,5],[20,4]],
    spine: [[62,0],[-58,0]],
    cockpit: { x: 30, y: 0, w: 22, h: 8 },
    engines: [[-68,-4,8,8]],
    glows: [{ x: -66, y: 0 }],
  },
  vulcan: {
    pale: 0xffe2b8,
    preRects: [[28,-15,34,7],[28,8,34,7]],
    muzzles: [[58,-14,7,5],[58,9,7,5]],
    hull: [[32,-20],[-6,-26],[-38,-28],[-54,-14],[-58,0],[-54,14],[-38,28],[-6,26],[32,20]],
    panel: [[24,-14],[-8,-19],[-34,-20],[-46,-10],[-49,0],[-46,10],[-34,20],[-8,19],[24,14]],
    seams: [[[-20,-22],[-20,22]]],
    cockpit: { x: 8, y: 0, w: 20, h: 12 },
    engines: [[-62,-12,8,8],[-62,4,8,8]],
    glows: [{ x: -60, y: -8 }, { x: -60, y: 8 }],
  },
  phantom: {
    pale: 0xeacdff,
    hull: [[64,0],[12,-9],[-16,-34],[-46,-42],[-34,-15],[-56,-8],[-56,8],[-34,15],[-46,42],[-16,34],[12,9]],
    panel: [[50,0],[10,-6],[-14,-26],[-36,-32],[-28,-12],[-48,-6],[-48,6],[-28,12],[-36,32],[-14,26],[10,6]],
    seams: [[[12,-9],[-30,-11]],[[12,9],[-30,11]],[[-16,-34],[-27,-13]],[[-16,34],[-27,13]]],
    canopyPoly: [[32,0],[20,-5],[8,0],[20,5]],
    glows: [{ x: -52, y: 0 }],
  },
};

function drawShipTexture(g, key, spec, color) {
  const s = 0.5, cx = 44, cy = 30;
  const X = x => cx + x * s, Y = y => cy + y * s;
  const poly = pts => {
    g.beginPath();
    g.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i][0]), Y(pts[i][1]));
    g.closePath();
  };
  spec.glows.forEach(gl => {
    g.fillStyle(color, 0.14); g.fillCircle(X(gl.x), Y(gl.y), 7);
    g.fillStyle(color, 0.3); g.fillCircle(X(gl.x), Y(gl.y), 4);
    g.fillStyle(spec.pale, 0.9); g.fillCircle(X(gl.x), Y(gl.y), 1.8);
  });
  (spec.preRects || []).forEach(r => {
    g.fillStyle(0x101322, 1); g.fillRect(X(r[0]), Y(r[1]), r[2] * s, r[3] * s);
    g.lineStyle(1, color, 1); g.strokeRect(X(r[0]), Y(r[1]), r[2] * s, r[3] * s);
  });
  (spec.muzzles || []).forEach(r => {
    g.fillStyle(spec.pale, 0.9); g.fillRect(X(r[0]), Y(r[1]), r[2] * s, r[3] * s);
  });
  g.fillStyle(0x101322, 1);
  g.lineStyle(1.2, color, 1);
  poly(spec.hull); g.fillPath(); g.strokePath();
  g.fillStyle(color, 0.15);
  poly(spec.panel); g.fillPath();
  if (spec.edges) {
    g.lineStyle(1.2, spec.pale, 0.9);
    spec.edges.forEach(e => {
      g.beginPath();
      g.moveTo(X(e[0][0]), Y(e[0][1]));
      for (let i = 1; i < e.length; i++) g.lineTo(X(e[i][0]), Y(e[i][1]));
      g.strokePath();
    });
  }
  g.lineStyle(0.8, color, 0.5);
  if (spec.spine) g.lineBetween(X(spec.spine[0][0]), Y(spec.spine[0][1]), X(spec.spine[1][0]), Y(spec.spine[1][1]));
  (spec.seams || []).forEach(sm => g.lineBetween(X(sm[0][0]), Y(sm[0][1]), X(sm[1][0]), Y(sm[1][1])));
  (spec.engines || []).forEach(r => {
    g.fillStyle(0x0c1020, 1); g.fillRect(X(r[0]), Y(r[1]), r[2] * s, r[3] * s);
    g.lineStyle(1, color, 1); g.strokeRect(X(r[0]), Y(r[1]), r[2] * s, r[3] * s);
  });
  if (spec.cockpit) {
    const c = spec.cockpit;
    g.fillStyle(spec.pale, 0.92);
    g.fillEllipse(X(c.x), Y(c.y), c.w * s, c.h * s);
  }
  if (spec.canopyPoly) {
    g.fillStyle(spec.pale, 0.92);
    poly(spec.canopyPoly); g.fillPath();
  }
  g.generateTexture(key, 80, 60);
  g.clear();
}

// Subtle background grid; themeIndex picks the arena palette (menu screens
// use theme 0). Drawn at depth -10 so gameplay always renders above it.
function drawGrid(scene, themeIndex) {
  const theme = THEMES[themeIndex || 0];
  scene.cameras.main.setBackgroundColor(theme.bg);
  const g = scene.add.graphics().setDepth(-10);
  g.lineStyle(1, theme.grid, 0.6);
  for (let x = 0; x <= GAME_WIDTH; x += 64) { g.lineBetween(x, 0, x, GAME_HEIGHT); }
  for (let y = 0; y <= GAME_HEIGHT; y += 64) { g.lineBetween(0, y, GAME_WIDTH, y); }
  return g;
}

const FONT = { fontFamily: 'Courier New, monospace', color: '#e8faff' };

function neonText(scene, x, y, text, size, color) {
  return scene.add.text(x, y, text, {
    ...FONT,
    fontSize: size + 'px',
    fontStyle: 'bold',
    color: color || '#e8faff',
  });
}
