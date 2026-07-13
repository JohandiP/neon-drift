# Neon Drift — Gameplay Manual

All numbers below are the live tuning values from [`js/config.js`](../js/config.js).

## Controls

| Action | Default key | Notes |
|---|---|---|
| Move | W A S D | Arrow keys always work as alternates |
| Aim & fire | Mouse | Auto-fire, no clicking needed |
| Drift | SPACE (hold) | Low friction, higher top speed, builds multiplier |
| Dash | SHIFT | Brief invulnerability, 1.5s cooldown |
| Pause | ESC or P | |

All keys except pause are remappable in **CONTROLS** (menu). Duplicate
assignments swap automatically; bindings persist in the save. The same screen
holds the FPS display toggle and the SFX / music volume controls (all sound is
synthesized at runtime — the game ships no audio files).

## The ship

- **Hull:** 100 (+25 per Hull upgrade). Healed +15 on every wave clear.
- **Speed:** 320 px/s max (380 while drifting), acceleration-based movement.
- **Dash:** 820 px/s burst, 300ms invulnerability, 1.5s cooldown
  (−0.25s per upgrade). Dash i-frames are always capped 150ms below the
  cooldown, so chained dashes can never make you permanently invulnerable.
- **Gun:** 5 shots/s (+1.5 per upgrade), 10 damage, 640 px/s bullets.
- After taking a hit: 800ms of invulnerability.

## Scoring & the multiplier

- Every kill scores **100 × your current multiplier**.
- Clearing wave N pays a bonus of **500 × N**.
- The multiplier (the `xN` under SCORE) builds while you **hold drift within
  170px of an enemy** — one step per second sustained, up to **x8**.
- **Any hit resets the multiplier to x1.** That is the game's core gamble:
  the points are next to the things trying to kill you.

## Ramming

Colliding with an enemy hurts both sides: you take its contact damage and it
takes **15** in return (enough to one-shot a mini). This only happens when the
hit actually lands on you — while shielded, dashing, or inside post-hit
invulnerability frames, neither side takes anything, so invulnerable ramming
can't be used as a weapon.

## Enemies

| Enemy | HP | Speed | Contact dmg | Cores | Behavior |
|---|---|---|---|---|---|
| Chaser | 20 | 140 | 10 | 1 | Homes straight at you |
| Mini | 10 | 185 | 6 | 0 | Fast fragment from a splitter (or hive boss) |
| Shooter | 30 | 110 | 8 | 2 | Holds ~250px range, fires 8-dmg bullets every 2s |
| Splitter | 40 | 90 | 12 | 2 | Splits into two minis on death |
| Boss | see below | | 20 | 10 | Every 5th wave; three kinds rotate |

Three bosses rotate (wave 5 → Warden, 10 → Lancer, 15 → Hive, 20 → Warden…),
all gaining +30 HP per wave:

| Boss | Base HP | Speed | Behavior |
|---|---|---|---|
| Warden (purple) | 300 | 60 | Radial 12-bullet burst every 3s |
| Lancer (red) | 260 | 70 | Charges at 480 px/s every ~4s; aimed 3-shot spread between charges |
| Hive (green) | 340 | 45 | Spawns 2 minis every 4s; slow aimed shots |

- Wave N spawns **N + 2** enemies; enemy speed ramps **+5% per wave**.
- Shooters join the pool at wave 3, splitters at wave 6.
- Enemies wander individually and push each other apart, so packs surround
  you instead of stacking into a blob.

## Pickups

**Cores** are the currency. They chase you from anywhere on the field (faster
than your ship — they can't be left behind or knocked out of the arena) and
sprint once inside your magnet radius.

**Buffs** drop from 8% of kills (bosses always drop one) as colored donuts.
They despawn after 12 seconds (blinking near the end). Once your magnet pulls
one, it stays hooked and follows you. Picking up an active buff again extends
it, capped:

| Buff | Effect | Duration | Stack cap |
|---|---|---|---|
| REGEN (green) | +6 hull/s | 6s | 10s |
| SHIELD (cyan) | Invulnerable | 4s | 6s |
| BIG SHOT (pink) | 2.5× damage, giant bullets | 6s | 10s |
| RAPID FIRE (yellow) | 2× fire rate | 6s | 10s |
| ASSIST (mint) | Drone wingman orbits and shoots nearest enemy | 10s | 15s |

ASSIST only drops on boss waves.

## The shop & upgrades

Clearing a wave sweeps all bullets off the field and opens the shop (10-second
timer, or continue early). Upgrades are **permanent across runs**:

| Upgrade | Per level | Costs (levels 1→4) |
|---|---|---|
| Fire Rate | +1.5 shots/s | 100 / 250 / 500 / 1000 |
| Hull | +25 max hull | 100 / 250 / 500 / 1000 |
| Dash Cooldown | −0.25s | 100 / 250 / 500 / 1000 |
| Core Magnet | +60px pickup radius | 100 / 250 / 500 / 1000 |
| Damage | +3 bullet damage | 100 / 250 / 500 / 1000 |
| Drift Charge | +20% multiplier build rate | 100 / 250 / 500 / 1000 |

## Ships (garage)

Cores also buy ships in the **GARAGE** (menu). Unlocks and selection are
permanent; modifiers stack with upgrades:

| Ship | Cost | Modifiers |
|---|---|---|
| Viper (cyan) | free | balanced, no modifiers |
| Bastion (green) | 300 | +50 hull, −40 speed |
| Dart (yellow) | 300 | −25 hull, +45 speed |
| Vulcan (orange) | 600 | −15 hull, +2 shots/s |
| Phantom (purple) | 900 | −15 hull, −0.5s dash cooldown, +150ms dash i-frames |

## Arena themes

The arena background changes every 10 waves, rotating through three palettes
(midnight → vapor → toxin).

## Runs, checkpoints & saving

- A checkpoint is written at the **start of every wave** (wave, score, hull,
  cores). Quit to menu (from pause or the shop) and **RESUME** restarts that
  wave with the values it began with — cores grabbed mid-wave roll back, so
  quit-resume can't farm a wave twice.
- Dying ends the run and clears the checkpoint.
- Saved permanently: high score, best wave, total cores, upgrades, key
  bindings — in `localStorage` under `neondrift_save`.
- **RESET PROGRESS** (menu, double-click to confirm) wipes everything except
  key bindings.
