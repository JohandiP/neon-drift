// Autopilot used by the menu attract-mode demo (and for playtesting).
// It plays through the same inputs a person uses: it sets the key states and
// steers an aim point that the game reads instead of the mouse. It never
// touches clocks, timers, or game state directly.
const PILOT_ACE = {
  planMs: 30,      // how often it re-decides its movement direction
  aimMs: 110,      // how often it re-targets its aim
  aimWobble: 30,   // aim noise in px
  enemyW: 15000,   // threat weight of a normal enemy
  bossW: 52000,
  dodgeBullets: true,
  drift: true,
  dash: true,
};

const PILOT_ROOKIE = {
  planMs: 450,     // sluggish decisions
  aimMs: 320,      // slow, sloppy aim...
  aimWobble: 120,  // ...that misses a lot
  enemyW: 9000,    // underestimates danger
  bossW: 20000,
  dodgeBullets: false,
  drift: false,
  dash: false,
};

const Pilot = {
  makeState() {
    return { aimX: GAME_WIDTH / 2, aimY: GAME_HEIGHT / 2, aimTX: GAME_WIDTH / 2, aimTY: GAME_HEIGHT / 2, retargetAt: 0, planAt: 0, moveAng: 0, dashPlanAt: 0 };
  },

  update(g, time, cfg, st) {
    if (!g.player || !g.player.body) return;
    const p = g.player, k = g.keys;

    // Threat field: repelled by enemies (and bullets, if it's paying attention),
    // gently pulled toward the arena center.
    let fx = (GAME_WIDTH / 2 - p.x) * 0.0006, fy = (GAME_HEIGHT / 2 - p.y) * 0.0006;
    let nearest = null, nd = 1e9;
    g.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d2 = Math.max(400, dx * dx + dy * dy);
      const d = Math.sqrt(d2);
      if (d < nd) { nd = d; nearest = e; }
      const w = e.enemyType === 'boss' ? cfg.bossW : cfg.enemyW;
      fx += (dx / d) * (w / d2);
      fy += (dy / d) * (w / d2);
    });
    if (cfg.dodgeBullets) {
      g.enemyBullets.getChildren().forEach(b => {
        if (!b.active) return;
        const bx = b.x + b.body.velocity.x * 0.35, by = b.y + b.body.velocity.y * 0.35;
        const dx = p.x - bx, dy = p.y - by;
        const d2 = Math.max(400, dx * dx + dy * dy);
        const d = Math.sqrt(d2);
        fx += (dx / d) * (11000 / d2);
        fy += (dy / d) * (11000 / d2);
      });
    }

    if (time >= st.planAt) { st.planAt = time + cfg.planMs; st.moveAng = Math.atan2(fy, fx); }
    k.left.isDown = Math.cos(st.moveAng) < -0.35;
    k.right.isDown = Math.cos(st.moveAng) > 0.35;
    k.up.isDown = Math.sin(st.moveAng) < -0.35;
    k.down.isDown = Math.sin(st.moveAng) > 0.35;
    const m = 120;
    if (p.x < m) { k.right.isDown = true; k.left.isDown = false; }
    if (p.x > GAME_WIDTH - m) { k.left.isDown = true; k.right.isDown = false; }
    if (p.y < m) { k.down.isDown = true; k.up.isDown = false; }
    if (p.y > GAME_HEIGHT - m) { k.up.isDown = true; k.down.isDown = false; }

    // Mouse-like aim: glide toward the target with noise.
    if (nearest && time >= st.retargetAt) {
      st.retargetAt = time + cfg.aimMs;
      st.aimTX = nearest.x + (Math.random() - 0.5) * cfg.aimWobble;
      st.aimTY = nearest.y + (Math.random() - 0.5) * cfg.aimWobble;
    }
    st.aimX += (st.aimTX - st.aimX) * 0.35;
    st.aimY += (st.aimTY - st.aimY) * 0.35;
    g.demoAim.x = st.aimX;
    g.demoAim.y = st.aimY;

    k.drift.isDown = !!(cfg.drift && nearest && nd > 110 && nd < 250);

    if (cfg.dash) {
      const danger = nd < 80 || g.enemyBullets.getChildren().some(b =>
        b.active && Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < 55);
      if (danger && !st.dashPlanAt) st.dashPlanAt = time + 150 + Math.random() * 120;
      if (!danger) st.dashPlanAt = 0;
      if (st.dashPlanAt && time >= st.dashPlanAt && time >= g.dashReadyAt) {
        k.dash._justDown = true;
        st.dashPlanAt = 0;
      }
    }
  },
};
