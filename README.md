# Neon Drift

A top-down neon arcade survival shooter. Pilot a hovercar through endless waves
of enemies, drift close to build your score multiplier, and upgrade your ship
between waves.

**Zero install** — open `index.html` in any modern browser and play. No build
step, no dependencies to fetch (Phaser 3.87 is bundled in `lib/`).

## How to play

- **Move** — WASD / arrow keys (remappable in the CONTROLS menu)
- **Aim & fire** — mouse (auto-fire)
- **Drift** — hold SPACE near enemies to build the score multiplier (x1–x8);
  getting hit resets it
- **Dash** — SHIFT, brief invulnerability
- **Pause** — ESC or P

Every kill scores 100 × your multiplier. Enemies drop **cores** — spend them in
the between-wave shop on permanent upgrades (fire rate, hull, dash cooldown,
core magnet). Some enemies drop timed **buffs**: regen, shield, big shot, rapid
fire, and an assist drone on boss waves. A boss appears every 5th wave.

Progress (high score, cores, upgrades, key bindings) saves to `localStorage`.
Quitting mid-run leaves a checkpoint — resume from the menu and the wave
restarts fresh.

## Development

Plain JavaScript + [Phaser 3](https://phaser.io), no build tooling. Serve the
folder with any static file server (or just open `index.html`):

```
python3 -m http.server 8000
```

- `js/config.js` — every tuning constant (speeds, HP, costs, buff durations)
  and the placeholder-shape texture generator
- `js/scenes/` — menu, game, shop, pause, controls, guide, game-over
- `js/save.js` — localStorage save management

Art is intentionally placeholder neon shapes for now; an AI-generated art pass
is planned (see the design doc's milestone plan).

## Roadmap

- **M4** — more content: multiple ships, more bosses, arena themes
- **M5** — AI-generated art & audio pass
- **M6** — polish, juice, balancing
- **M7** — host on itch.io / GitHub Pages
