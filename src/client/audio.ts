/** Small synthesised sounds, so the game ships with no audio files. */
export class Sound {
  muted = false;
  private ctx: AudioContext | null = null;

  /** Browsers only allow sound after a click or key press; call this from one. */
  unlock(): void {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo = freq, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  putt(power: number): void {
    this.tone(190 + power * 90, 0.09, 'triangle', 0.25 + power * 0.25, 70);
  }

  bounce(speed: number): void {
    this.tone(520, 0.05, 'square', Math.min(0.14, 0.03 + speed * 0.012), 260);
  }

  land(): void {
    this.tone(120, 0.08, 'sine', 0.25, 60);
  }

  holed(): void {
    this.tone(140, 0.12, 'sine', 0.3, 70);
    this.tone(660, 0.12, 'triangle', 0.16, 660, 0.1);
    this.tone(990, 0.22, 'triangle', 0.16, 990, 0.2);
  }

  out(): void {
    this.tone(300, 0.35, 'sawtooth', 0.1, 80);
  }

  pickup(): void {
    this.tone(700, 0.07, 'square', 0.07, 1400);
  }

  item(): void {
    this.tone(90, 0.3, 'sine', 0.4, 45);
    this.tone(180, 0.12, 'triangle', 0.15, 90);
  }

  /** Referee's whistle: two close notes that beat against each other. */
  whistle(long = false): void {
    const dur = long ? 0.9 : 0.28;
    this.tone(2350, dur, 'sine', 0.07);
    this.tone(2480, dur, 'sine', 0.07);
  }
}
