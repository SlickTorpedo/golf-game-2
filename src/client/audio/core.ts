/**
 * Shared plumbing for all synthesised audio: the bus graph ("rig"), cached
 * noise buffers, the procedural stadium reverb and a small one-shot voice
 * helper. Everything takes a BaseAudioContext so the same code renders live
 * and through an OfflineAudioContext (see dev/audio-preview.ts).
 */

export type Rnd = () => number;

/** Small seeded generator, used wherever a repeatable "random" is wanted. */
export function mulberry32(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
export const dB = (v: number): number => Math.pow(10, v / 20);

/* ------------------------------------------------------------------ */
/* Cached buffers (AudioBuffers are not tied to a context)             */
/* ------------------------------------------------------------------ */

const whiteCache = new Map<number, AudioBuffer>();
const pinkCache = new Map<number, AudioBuffer>();
const impulseCache = new Map<number, AudioBuffer>();

function whiteNoise(sr: number): AudioBuffer {
  let buf = whiteCache.get(sr);
  if (buf) return buf;
  const len = Math.floor(sr * 2.3);
  buf = new AudioBuffer({ numberOfChannels: 1, length: len, sampleRate: sr });
  const d = buf.getChannelData(0);
  const rnd = mulberry32(0xb0ba);
  for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
  whiteCache.set(sr, buf);
  return buf;
}

function pinkNoise(sr: number): AudioBuffer {
  let buf = pinkCache.get(sr);
  if (buf) return buf;
  const len = Math.floor(sr * 3.7);
  buf = new AudioBuffer({ numberOfChannels: 1, length: len, sampleRate: sr });
  const d = buf.getChannelData(0);
  const rnd = mulberry32(0x9e11);
  // Paul Kellett's economy pink filter.
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }
  // Short crossfade so the loop point is seamless.
  const x = Math.floor(sr * 0.05);
  for (let i = 0; i < x; i++) {
    const k = i / x;
    d[len - x + i] = d[len - x + i] * (1 - k) + d[i] * k;
  }
  pinkCache.set(sr, buf);
  return buf;
}

/**
 * Open-air stadium response: almost nothing early (no near walls), then a
 * few distinct slaps off the far stand and the roof, then a long, dark,
 * diffuse tail. Stereo channels are decorrelated.
 */
function stadiumImpulse(sr: number): AudioBuffer {
  let buf = impulseCache.get(sr);
  if (buf) return buf;
  const len = Math.floor(sr * 3.3);
  buf = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: sr });
  const k = 48000 / sr;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const rnd = mulberry32(ch === 0 ? 0x5ad1 : 0x7e44);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      if (t < 0.035) continue;
      const build = Math.min(1, (t - 0.035) / 0.16);
      const env = build * build * Math.exp(-t * 2.3);
      // One-pole low-pass that closes with time: the tail gets darker.
      const a = Math.pow(0.42 + 0.5 * Math.min(1, t / 1.6), k);
      lp += (1 - a) * (rnd() * 2 - 1 - lp);
      d[i] = lp * env * 0.55;
    }
    // Slap-back echoes from the far stand, the roof edge and the far corner.
    const taps: Array<[number, number]> = ch === 0
      ? [[0.131, 0.62], [0.187, 0.3], [0.262, 0.42], [0.371, 0.2], [0.497, 0.14]]
      : [[0.139, 0.5], [0.176, 0.4], [0.271, 0.34], [0.355, 0.26], [0.511, 0.12]];
    for (const [time, gain] of taps) {
      const start = Math.floor(time * sr);
      const n = Math.floor(0.012 * sr);
      let s = 0;
      for (let i = 0; i < n; i++) {
        const e = Math.exp(-i / (0.003 * sr));
        s += 0.35 * (rnd() * 2 - 1 - s);
        d[start + i] += s * e * gain * 1.6;
      }
    }
    // Fade the very end to zero.
    const f = Math.floor(0.2 * sr);
    for (let i = 0; i < f; i++) d[len - f + i] *= 1 - i / f;
  }
  impulseCache.set(sr, buf);
  return buf;
}

/* ------------------------------------------------------------------ */
/* Bus graph                                                           */
/* ------------------------------------------------------------------ */

export interface Rig {
  ctx: BaseAudioContext;
  rnd: Rnd;
  white: AudioBuffer;
  pink: AudioBuffer;
  /** One-shot and continuous effects connect here (dry) ... */
  sfx: GainNode;
  /** ... and here for their share of the stadium reverb. */
  sfxWet: GainNode;
  amb: GainNode;
  ambWet: GainNode;
  /** Music layers connect here; then low-pass -> duck -> on/off -> master. */
  music: GainNode;
  musicWet: GainNode;
  musicLP: BiquadFilterNode;
  musicDuck: GainNode;
  musicOut: GainNode;
  /** Last node before the destination (useful for metering). */
  out: AudioNode;
}

/** Bus levels, tuned with dev/audio.html so the three groups sit together. */
export const LEVELS = { sfx: 0.9, music: 0.16, amb: 0.5, reverb: 0.8 };

function softClipCurve(): Float32Array<ArrayBuffer> {
  // Input is pre-scaled by 0.5, so the curve covers -2..2. Linear to 0.7,
  // then bends over and never exceeds 0.98.
  const n = 2049;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const ax = Math.abs(x);
    const y = ax < 0.7 ? ax : 0.7 + 0.28 * Math.tanh((ax - 0.7) / 0.28);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export function createRig(ctx: BaseAudioContext, rnd: Rnd = Math.random): Rig {
  const sr = ctx.sampleRate;
  const g = (v: number): GainNode => {
    const n = ctx.createGain();
    n.gain.value = v;
    return n;
  };

  // Master: glue compressor -> soft clipper (a ceiling, rarely touched).
  const master = g(1);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -15;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.16;
  const pre = g(0.5);
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  const post = g(0.8);
  // Nothing useful lives below 28 Hz; it only eats headroom.
  const rumble = ctx.createBiquadFilter();
  rumble.type = 'highpass';
  rumble.frequency.value = 28;
  rumble.Q.value = 0.6;
  master.connect(rumble).connect(comp).connect(pre).connect(clip).connect(post).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = stadiumImpulse(sr);
  const reverbIn = g(1);
  const reverbCut = ctx.createBiquadFilter();
  reverbCut.type = 'highpass';
  reverbCut.frequency.value = 140;
  const reverbOut = g(LEVELS.reverb);
  reverbIn.connect(reverbCut).connect(reverb).connect(reverbOut).connect(master);

  const sfx = g(LEVELS.sfx);
  const sfxWet = g(1);
  sfx.connect(master);
  sfxWet.connect(reverbIn);

  const amb = g(LEVELS.amb);
  const ambWet = g(1);
  amb.connect(master);
  ambWet.connect(reverbIn);

  const music = g(1);
  const musicLP = ctx.createBiquadFilter();
  musicLP.type = 'lowpass';
  musicLP.frequency.value = 12000;
  musicLP.Q.value = 0.5;
  const musicDuck = g(1);
  const musicOut = g(LEVELS.music);
  music.connect(musicLP).connect(musicDuck).connect(musicOut).connect(master);
  const musicWet = g(LEVELS.music);
  musicWet.connect(reverbIn);

  return {
    ctx, rnd, white: whiteNoise(sr), pink: pinkNoise(sr),
    sfx, sfxWet, amb, ambWet, music, musicWet, musicLP, musicDuck, musicOut, out: post,
  };
}

/* ------------------------------------------------------------------ */
/* Envelopes                                                           */
/* ------------------------------------------------------------------ */

/** Percussive envelope: 0 -> peak in `attack`, then exponential to silence over `decay`. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.exponentialRampToValueAtTime(Math.max(1e-5, peak * 0.001), t + attack + decay);
  p.linearRampToValueAtTime(0, t + attack + decay + 0.006);
}

/** Sustained envelope: rise, hold, fall. All segments are ramps, so no clicks. */
export function swell(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  // Release as three straight segments that follow an exponential curve.
  const r = t + attack + hold;
  p.setValueAtTime(peak, r);
  p.linearRampToValueAtTime(peak * 0.35, r + release * 0.3);
  p.linearRampToValueAtTime(peak * 0.1, r + release * 0.65);
  p.linearRampToValueAtTime(0, r + release);
}

export interface BurstOpts {
  type?: BiquadFilterType;
  freq: number;
  q?: number;
  peak: number;
  attack?: number;
  decay: number;
  /** Sweep the filter to this frequency over the burst. */
  sweepTo?: number;
  pink?: boolean;
  /** Use a sustained envelope with this hold time instead of a percussive one. */
  hold?: number;
}

export interface ToneOpts {
  type?: OscillatorType;
  attack?: number;
  /** Start frequency; glides to `freq` over `bendTime`. */
  from?: number;
  bendTime?: number;
  /** Then keeps drifting to this frequency by the end of the decay. */
  to?: number;
}

/**
 * One sounding event: a gain node feeding a dry bus and (optionally) the
 * reverb, plus the sources that feed it. When the longest source ends the
 * whole sub-graph is disconnected so it can be collected.
 */
export class Voice {
  readonly out: GainNode;
  readonly ctx: BaseAudioContext;
  private tail: AudioNode;
  private wet: GainNode | null = null;
  private last: AudioScheduledSourceNode | null = null;
  private lastEnd = -1;

  constructor(readonly rig: Rig, dry: AudioNode, wetBus: AudioNode | null, gain: number, send = 0, pan = 0) {
    const ctx = (this.ctx = rig.ctx);
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    this.tail = this.out;
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      this.out.connect(p);
      this.tail = p;
    }
    this.tail.connect(dry);
    if (wetBus && send > 0) {
      this.wet = ctx.createGain();
      this.wet.gain.value = send;
      this.tail.connect(this.wet);
      this.wet.connect(wetBus);
    }
  }

  private track(src: AudioScheduledSourceNode, end: number): void {
    if (end > this.lastEnd) {
      this.lastEnd = end;
      this.last = src;
    }
  }

  osc(type: OscillatorType, freq: number, t0: number, t1: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start(t0);
    o.stop(t1);
    this.track(o, t1);
    return o;
  }

  noise(t0: number, t1: number, pink = false, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    const buf = pink ? this.rig.pink : this.rig.white;
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(t0, this.rig.rnd() * (buf.duration - 0.1));
    s.stop(t1);
    this.track(s, t1);
    return s;
  }

  gain(v = 0): GainNode {
    const n = this.ctx.createGain();
    n.gain.value = v;
    return n;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** A decaying partial. `decay` is the time to fall 60 dB. */
  tone(t: number, freq: number, peak: number, decay: number, o: ToneOpts = {}, dest: AudioNode = this.out): OscillatorNode {
    const attack = o.attack ?? 0.002;
    const end = t + attack + decay + 0.02;
    const osc = this.osc(o.type ?? 'sine', o.from ?? freq, t, end);
    if (o.from !== undefined) {
      osc.frequency.setValueAtTime(o.from, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + (o.bendTime ?? 0.04));
    }
    if (o.to !== undefined) {
      osc.frequency.setValueAtTime(freq, t + (o.from !== undefined ? o.bendTime ?? 0.04 : 0));
      osc.frequency.exponentialRampToValueAtTime(o.to, t + attack + decay);
    }
    const amp = this.gain(0);
    perc(amp.gain, t, peak, attack, decay);
    osc.connect(amp).connect(dest);
    return osc;
  }

  /** A burst of filtered noise. */
  burst(t: number, o: BurstOpts, dest: AudioNode = this.out): BiquadFilterNode {
    const attack = o.attack ?? 0.001;
    const total = attack + (o.hold ?? 0) + o.decay;
    const src = this.noise(t, t + total + 0.03, o.pink);
    const f = this.filter(o.type ?? 'bandpass', o.freq, o.q ?? 1);
    if (o.sweepTo !== undefined) {
      f.frequency.setValueAtTime(o.freq, t);
      f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + total);
    }
    const amp = this.gain(0);
    if (o.hold !== undefined) swell(amp.gain, t, o.peak, attack, o.hold, o.decay);
    else perc(amp.gain, t, o.peak, attack, o.decay);
    src.connect(f).connect(amp).connect(dest);
    return f;
  }

  /** Call once everything is scheduled: frees the graph when the last source ends. */
  done(): number {
    const last = this.last;
    if (last) {
      last.onended = () => {
        this.out.disconnect();
        if (this.tail !== this.out) this.tail.disconnect();
        this.wet?.disconnect();
      };
    }
    return this.lastEnd;
  }
}
