// Synthesized audio (M5): every sound effect and the music loop are generated
// with the Web Audio API at runtime — no audio files, keeping the zero-asset
// build. The browser unlocks the audio context on the first input (Phaser
// handles that); play() is silent until then.
const AudioFX = {
  ctx: null,
  sfx: null,
  music: null,
  lastPlayed: {},
  musicTimer: null,

  init(game, save) {
    if (this.ctx) { this.applyVolumes(save); return; }
    if (!game.sound || !game.sound.context) return;
    this.ctx = game.sound.context;
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.ctx.destination);
    this.music.connect(this.ctx.destination);
    this.applyVolumes(save);
  },

  applyVolumes(save) {
    if (!this.ctx) return;
    // Scaled down so 100% is loud but not clipping.
    this.sfx.gain.value = (save.sfxVolume != null ? save.sfxVolume : 0.8) * 0.5;
    this.music.gain.value = (save.musicVolume != null ? save.musicVolume : 0.5) * 0.28;
  },

  tone(freq, freqEnd, dur, type, vol, when, dest) {
    const t = when || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd && freqEnd !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(dur, vol, filterFrom, filterTo, when) {
    const t = when || this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFrom, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    // Rapid-fire sounds are throttled so dense fights don't turn to mush.
    const limits = { fire: 45, hit: 40, core: 60 };
    const now = performance.now();
    if (limits[name] && now - (this.lastPlayed[name] || 0) < limits[name]) return;
    this.lastPlayed[name] = now;
    const t0 = this.ctx.currentTime;
    switch (name) {
      case 'fire': this.tone(820 + Math.random() * 120, 220, 0.07, 'square', 0.10); break;
      case 'hit': this.noise(0.05, 0.14, 4000, 900); break;
      case 'explode': this.noise(0.3, 0.32, 1600, 90); this.tone(150, 40, 0.28, 'sine', 0.30); break;
      case 'bossExplode': this.noise(0.7, 0.5, 2000, 60); this.tone(120, 30, 0.6, 'sine', 0.45); break;
      case 'dash': this.noise(0.18, 0.2, 500, 4500); break;
      case 'core': this.tone(660, 660, 0.05, 'sine', 0.12); this.tone(990, 990, 0.07, 'sine', 0.12, t0 + 0.05); break;
      case 'buff': [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.09, 'triangle', 0.16, t0 + i * 0.07)); break;
      case 'waveClear': [392, 523, 659, 784].forEach((f, i) => this.tone(f, f, 0.12, 'triangle', 0.15, t0 + i * 0.09)); break;
      case 'playerHit': this.tone(200, 70, 0.2, 'sawtooth', 0.3); this.noise(0.12, 0.2, 2500, 300); break;
      case 'bossSpawn': this.tone(80, 60, 0.5, 'sawtooth', 0.3); this.tone(120, 90, 0.5, 'sawtooth', 0.2, t0 + 0.15); break;
      case 'gameOver': [330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.25, 'sawtooth', 0.2, t0 + i * 0.22)); break;
      case 'ui': this.tone(1200, 1100, 0.04, 'square', 0.07); break;
    }
  },

  // Minimal synthwave loop: an eighth-note arpeggio and a bass drone over
  // Am - F - C - G at 110 BPM, scheduled just ahead of the clock. One global
  // loop runs across menu and game; it simply keeps playing.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [220.00, 261.63, 329.63],
      [174.61, 220.00, 261.63],
      [261.63, 329.63, 392.00],
      [196.00, 246.94, 293.66],
    ];
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const stepDur = 60 / 110 / 2;
    let step = 0;
    let nextAt = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (this.ctx.state !== 'running') return;
      while (nextAt < this.ctx.currentTime + 0.25) {
        const chord = chords[Math.floor(step / 8) % chords.length];
        const note = chord[pattern[step % 8]];
        this.tone(note * 2, note * 2, stepDur * 0.9, 'triangle', 0.10, nextAt, this.music);
        if (step % 8 === 0) this.tone(chord[0] / 2, chord[0] / 2, stepDur * 7, 'sawtooth', 0.12, nextAt, this.music);
        step++;
        nextAt += stepDur;
      }
    }, 100);
  },

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  },
};
