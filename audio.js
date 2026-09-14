/* Original small chiptune, synthesized locally. No network or licensed recording. */
window.MorningAudio = class {
  constructor() {
    this.context = null;
    this.master = null;
    this.timer = null;
    this.enabled = false;
    this.step = 0;
  }
  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error("Audio unavailable");
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.13;
        this.master.connect(this.context.destination);
      }
      await this.context.resume();
      if (!this.enabled || document.hidden) return;
      this.master.gain.setTargetAtTime(0.13, this.context.currentTime, 0.12);
      if (!this.timer) {
        this.tick();
        this.timer = setInterval(() => this.tick(), 310);
      }
    } catch (_) {
      this.enabled = false;
      this.stop();
      const failed = this.context;
      this.context = null;
      this.master = null;
      if (failed && failed.state !== "closed") failed.close().catch(() => {});
    }
  }
  tone(midi, duration = 0.25, volume = 0.3, type = "triangle", delay = 0) {
    if (!this.enabled || !this.context || !this.master || document.hidden)
      return;
    try {
      const now = this.context.currentTime + delay;
      const osc = this.context.createOscillator(),
        gain = this.context.createGain();
      osc.type = type;
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch (_) {
      /* Audio must never block the story. */
    }
  }
  tick() {
    const tune = [
      72, 0, 76, 79, 81, 79, 76, 0, 74, 0, 77, 81, 79, 77, 74, 0, 72, 76, 79,
      84, 83, 79, 76, 0, 74, 77, 76, 74, 72, 0, 0, 0,
    ];
    const i = this.step++ % tune.length;
    if (tune[i]) this.tone(tune[i], 0.42, 0.23);
    const bass = [48, 53, 57, 55][Math.floor(i / 8)];
    if (i % 4 === 0) this.tone(bass, 0.8, 0.34, "sine");
    if (i % 4 === 2) this.tone(bass + 7, 0.24, 0.14);
    if (this.step % 53 === 0) {
      this.tone(94, 0.12, 0.055, "sine");
      this.tone(98, 0.1, 0.04, "sine", 0.14);
    }
  }
  effect(kind) {
    if (kind === "quest")
      [72, 76, 79, 84].forEach((n, i) =>
        this.tone(n, 0.42, 0.28, "triangle", i * 0.12),
      );
    else if (kind === "step")
      this.tone(35 + (this.step % 3), 0.06, 0.04, "triangle");
    else if (kind === "talk") this.tone(79, 0.07, 0.1);
    else if (kind === "cat") {
      this.tone(83, 0.12, 0.13, "sine");
      this.tone(79, 0.18, 0.12, "sine", 0.09);
    }
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
  }
  pause() {
    this.stop();
  }
  async resume() {
    if (this.enabled) await this.setEnabled(true);
  }
};
