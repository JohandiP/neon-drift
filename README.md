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

Every kill scores 100 × your multiplier. Enemies drop **cores** — spend them
in the between-wave shop on six permanent upgrade tracks, or in the **garage**
on one of five ships with distinct stat profiles. Some enemies drop timed
**buffs**: regen, shield, big shot, rapid fire, and an assist drone on boss
waves. Three boss kinds rotate every 5th wave, and the arena theme shifts
every 10 waves.

Progress (high score, cores, upgrades, key bindings) saves to `localStorage`.
Quitting mid-run leaves a checkpoint — resume from the menu and the wave
restarts fresh.

## Documentation

- [Gameplay manual](docs/GAMEPLAY.md) — every mechanic with its exact numbers:
  enemies, buffs, upgrades, scoring, checkpoints
- [Architecture](docs/ARCHITECTURE.md) — code structure, scene map, systems,
  and how to add new enemies/buffs/upgrades

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

## License

[MIT](LICENSE) — free to use, modify, and share.

Note: `lib/phaser.min.js` is [Phaser](https://phaser.io), bundled under its
own MIT license.

## Roadmap

- **M4** — more content: multiple ships, more bosses, arena themes
- **M5** — AI-generated art & audio pass
- **M6** — polish, juice, balancing
- **M7** — host on itch.io / GitHub Pages
