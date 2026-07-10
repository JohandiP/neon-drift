# Neon Drift — Code Architecture

Plain JavaScript + Phaser 3.87, no build step. Everything loads as classic
`<script>` tags, so **load order in `index.html` matters**:

```
lib/phaser.min.js      Phaser engine (bundled, ~1.2MB)
js/config.js           all tuning constants + runtime texture generation
js/save.js             SaveManager (localStorage)
js/scenes/*.js         one class per scene
js/main.js             Phaser.Game config — must load last
```

## Scene map

```
Menu ──────────► Game ◄──────────── GameOver (retry)
 │  ▲             │ ▲ │
 │  │       pause │ │ │ hull = 0
 │  │             ▼ │ ▼
 │  ├───────── Pause │ GameOver ──► Menu
 │  │                │
 │  │     wave clear ▼
 │  ├───────────── Shop (overlay; Game scene paused underneath)
 │  │
 ├─► Controls (key remapping)
 └─► Guide (illustrated manual)
```

- **Shop** and **Pause** are *overlay* scenes: they `scene.pause('Game')` and
  render on top. The shop resumes the game and calls `onShopClosed()`
  **directly** — deliberately not via the scene `resume` event, because the
  pause menu also resumes and must not trigger a wave start.
- Scene instances are **reused** by Phaser across restarts. Per-visit state
  must be reset in `init()`/`create()` (see `ShopScene.init` resetting
  `closed`), and scene-event listeners must be `off()`d before `on()` or they
  stack across retries.

## config.js — the tuning surface

Every gameplay number lives here: `PLAYER`, `ENEMIES`, `WAVES`,
`UPGRADE_COSTS`, `BUFFS`, core-chase speeds, and `DEFAULT_CONTROLS`.
Balance changes should never require touching scene code.

`makeTextures(scene)` generates all placeholder art (ships, enemies, bullets,
cores, buff donuts, particles) into the texture cache at runtime — there are
no image files. The M5 art pass replaces this one function with real asset
loading; every scene just references texture keys.

## save.js — persistence

`SaveManager.load()/save()` wrap `localStorage` key `neondrift_save`:

```json
{
  "highScore": 0,
  "bestWave": 0,
  "totalCores": 0,
  "upgrades": { "fireRate": 0, "hull": 0, "dashCooldown": 0, "magnet": 0 },
  "controls": { "up": { "code": 87, "name": "W" }, ... },
  "pendingRun": { "wave": 3, "score": 900, "hull": 80, "coresEarned": 4, "totalCores": 12 }
}
```

`load()` merges defaults over stored data, so adding fields is
backward-compatible. `pendingRun` is the wave-start checkpoint (null when no
run is resumable). `resetProgress()` wipes everything except `controls`.

## GameScene — the systems

The big scene (~500 lines). Its subsystems, in rough update order:

- **Waves** — `startWave(n)` writes the checkpoint, then staggers `n + 2`
  edge spawns (+ a boss every 5th). `checkWaveClear()` (called from
  `killEnemy`) requires both `spawnRemaining === 0` and no active enemies;
  on clear it sweeps all projectiles, pays the bonus, heals, and launches
  the shop after the banner.
- **Enemy AI** — per-type `switch` (home / keep-range / radial-burst boss),
  plus three anti-clumping layers: per-enemy speed jitter and sinusoidal
  wander (`wanderPhase/Freq/Amp` set in `spawnEnemy`), separation steering
  (52px neighbor repulsion), and an enemies↔enemies collider.
- **Combat** — bullets and enemy bullets are pooled physics groups
  (`get()`/`killProjectile()`, never destroy). `bullet.damage` is set per
  shot (big-shot buff). Ram damage lives in `onPlayerTouchesEnemy` and only
  triggers when `damagePlayer()` returns true (i.e. the hit landed).
- **Pickups** — cores always chase the player at distance-scaled speed
  (can't be outrun or pushed out of bounds); buffs sit still until the
  magnet radius hooks them (`b.hooked`), then chase forever. Both collide
  with world bounds.
- **Buffs** — `activeBuffs` maps buff key → expiry timestamp;
  `collectBuff()` extends capped at `maxDuration`; `buffActive(key)` is the
  single effect gate (checked by `damagePlayer`, `fireBullet`, regen tick,
  assist-drone block).
- **Timer discipline** — all timestamps compare against the *global* clock,
  which keeps running while the scene is paused. `shiftTimers(gap)` in
  `update()` detects any >250ms hole between frames (pause menu, shop,
  hidden tab) and shifts every pending timestamp past it. Any new
  time-based feature must either be added to `shiftTimers` or use scene
  timers (`this.time.delayedCall`), which pause correctly on their own.

## Adding content

- **New enemy:** add an `ENEMIES` entry, a texture in `makeTextures`, an AI
  case in the update loop, and (optionally) an unlock wave in `WAVES` +
  `startWave`'s pool. Add a Guide row.
- **New boss:** add a `BOSSES` entry (tex/size/speed/hp) + texture, then a
  behavior branch in the `case 'boss'` AI keyed on `e.bossKind`. Kinds rotate
  automatically by boss wave. Any new per-boss timer fields must be added to
  `shiftTimers`.
- **New ship:** add a `SHIPS` entry — texture, garage row, and stat
  application (`playerStats`) all derive from the table automatically.
- **New buff:** add a `BUFFS` entry (donut texture is generated
  automatically), then hook its effect wherever it applies via
  `buffActive('key')`. Set `bossOnly: true` to restrict its drop pool.
  Add a Guide row.
- **New upgrade:** add to `UPGRADES` + `upgradeStats()`; the shop UI renders
  from those tables automatically.
- **New arena theme:** add a `THEMES` entry (bg + grid colors); rotation
  every 10 waves picks it up automatically.

## Testing notes

The game pauses when its browser tab is hidden (standard Phaser behavior).
For headless/scripted testing you can step the engine manually:

```js
const t = performance.now();
for (let i = 1; i <= N; i++) game.loop.step(t + i * 16.7);
```

Beware: the *first* manual step after idle time carries a huge clock delta
that fast-forwards timers (the `shiftTimers` gap-shift absorbs most of it).
Settle with a few steps before asserting on game state.
