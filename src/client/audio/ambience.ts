/**
 * The empty stadium at night: insects that swell and fade, floodlight hum,
 * wind, a far road, pitch sprinklers, and now and then something far off.
 * A few looping beds run all the time; everything else is scheduled a little
 * ahead by `pump`, the same way the music is.
 */
import { Voice, mulberry32, perc, swell, type Rig, type Rnd } from './core';

export type AmbScene = 'title' | 'intro' | 'play' | 'card' | 'final';

const SCENE_LEVEL: Record<AmbScene, number> = { title: 1, intro: 1, play: 0.8, card: 0.55, final: 0.9 };

/* Insect loops are baked once into small buffers: cheap to play, natural to hear. */
const insectCache = new Map<number, AudioBuffer[]>();

function insectLoops(sr: number): AudioBuffer[] {
  const cached = insectCache.get(sr);
  if (cached) return cached;
  const rnd = mulberry32(0xc41c);
  const make = (seconds: number): [AudioBuffer, Float32Array] => {
    const b = new AudioBuffer({ numberOfChannels: 1, length: Math.round(seconds * sr), sampleRate: sr });
    return [b, b.getChannelData(0)];
  };
  // A: field cricket. Three quick pulses, then a gap.
  const [a, ad] = make(0.613);
  for (let p = 0; p < 3; p++) {
    const start = Math.floor((0.02 + p * 0.031) * sr);
    const n = Math.floor(0.019 * sr);
    for (let i = 0; i < n; i++) {
      const w = Math.sin((Math.PI * i) / n);
      ad[start + i] = Math.sin((2 * Math.PI * (4180 + 120 * (i / n)) * i) / sr) * w * w * 0.5;
    }
  }
  // B: tree cricket. A steady soft trill that breathes.
  const rate = 46;
  const pulses = 132;
  const [b, bd] = make(pulses / rate);
  for (let i = 0; i < bd.length; i++) {
    const t = i / sr;
    const ph = (t * rate) % 1;
    const w = Math.pow(Math.sin(Math.PI * ph), 3);
    const breathe = 0.65 + 0.35 * Math.sin((2 * Math.PI * 3 * i) / bd.length);
    bd[i] = Math.sin(2 * Math.PI * 3360 * t) * w * breathe * 0.5;
  }
  // C: cicada-like shimmer. A cluster of close tones, fluttering.
  const [c, cd] = make(1.9);
  const tones: Array<[number, number]> = [];
  for (let k = 0; k < 14; k++) tones.push([4500 + rnd() * 800, rnd() * 6.28]);
  for (let i = 0; i < cd.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const [f, ph] of tones) s += Math.sin(2 * Math.PI * f * t + ph);
    const flutter = 0.55 + 0.45 * Math.sin(2 * Math.PI * 80 * t);
    const edge = Math.min(1, i / (0.02 * sr), (cd.length - i) / (0.02 * sr));
    cd[i] = (s / 14) * flutter * edge;
  }
  const loops = [a, b, c];
  insectCache.set(sr, loops);
  return loops;
}

interface Insect {
  gain: GainNode;
  max: number;
  /** Chance that a new swell target is "singing" rather than quiet. */
  busy: number;
  next: number;
}

export class Ambience {
  private readonly bed: GainNode;
  private readonly wet: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly insects: Insect[] = [];
  private readonly windLP: BiquadFilterNode;
  private readonly windG: GainNode;
  private readonly rnd: Rnd;
  private nextWind: number;
  private nextBike: number;
  private nextSprinkler: number;
  private nextFar: number;
  private scene: AmbScene = 'title';

  constructor(private readonly rig: Rig, startTime: number, seed = (Math.random() * 1e9) | 0) {
    const ctx = rig.ctx;
    const rnd = (this.rnd = mulberry32(seed));
    this.bed = ctx.createGain();
    this.bed.gain.value = 0;
    this.bed.gain.setTargetAtTime(SCENE_LEVEL.title, startTime, 1.2);
    this.bed.connect(rig.amb);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.5;
    this.bed.connect(this.wet).connect(rig.ambWet);

    const loop = (buf: AudioBuffer, rate = 1): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(startTime, rnd() * buf.duration * 0.9);
      this.sources.push(s);
      return s;
    };
    const gain = (v: number): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const panned = (pan: number): StereoPannerNode => {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(this.bed);
      return p;
    };

    // Insects: four singers spread across the stands, each on its own swell.
    const [a, b, c] = insectLoops(ctx.sampleRate) as [AudioBuffer, AudioBuffer, AudioBuffer];
    const singers: Array<[AudioBuffer, number, number, number, number]> = [
      [a, 1, -0.7, 0.16, 0.6],
      [a, 0.931, 0.55, 0.12, 0.45],
      [b, 1, 0.25, 0.09, 0.55],
      [c, 1, -0.3, 0.07, 0.22],
    ];
    for (const [buf, rate, pan, max, busy] of singers) {
      const g = gain(0);
      loop(buf, rate).connect(g).connect(panned(pan));
      this.insects.push({ gain: g, max, busy, next: startTime + rnd() * 3 });
    }

    // Floodlights: mains hum plus a thin electrical buzz from the one bank still on.
    const lights = panned(0.45);
    const hum = ctx.createOscillator();
    hum.frequency.value = 100;
    hum.connect(gain(0.015)).connect(lights);
    const hum2 = ctx.createOscillator();
    hum2.frequency.value = 200;
    hum2.connect(gain(0.008)).connect(lights);
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 100;
    const buzzBP = ctx.createBiquadFilter();
    buzzBP.type = 'bandpass';
    buzzBP.frequency.value = 2300;
    buzzBP.Q.value = 2.5;
    buzz.connect(buzzBP).connect(gain(0.03)).connect(lights);
    for (const o of [hum, hum2, buzz]) {
      o.start(startTime);
      this.sources.push(o);
    }

    // Wind over the roof (gusts are steered by pump) and the far road.
    this.windLP = ctx.createBiquadFilter();
    this.windLP.type = 'lowpass';
    this.windLP.frequency.value = 380;
    this.windLP.Q.value = 0.4;
    this.windG = gain(0.12);
    const windHP = ctx.createBiquadFilter();
    windHP.type = 'highpass';
    windHP.frequency.value = 90;
    loop(rig.pink).connect(windHP).connect(this.windLP).connect(this.windG).connect(this.bed);
    const road = ctx.createBiquadFilter();
    road.type = 'lowpass';
    road.frequency.value = 150;
    const roadHP = ctx.createBiquadFilter();
    roadHP.type = 'highpass';
    roadHP.frequency.value = 60;
    loop(rig.pink, 0.7).connect(roadHP).connect(road).connect(gain(0.15)).connect(panned(-0.4));

    this.nextWind = startTime;
    this.nextBike = startTime + 9 + rnd() * 16;
    this.nextSprinkler = startTime + 4 + rnd() * 6;
    this.nextFar = startTime + 12 + rnd() * 14;
  }

  setScene(scene: AmbScene, t: number): void {
    this.scene = scene;
    this.bed.gain.setTargetAtTime(SCENE_LEVEL[scene], t, 0.9);
  }

  /** Schedule everything that should start before `until`. */
  pump(until: number): void {
    const rnd = this.rnd;
    for (const ins of this.insects) {
      while (ins.next < until) {
        const sing = rnd() < ins.busy;
        const target = sing ? ins.max * (0.45 + rnd() * 0.55) : ins.max * (rnd() < 0.5 ? 0 : 0.12);
        ins.gain.gain.setTargetAtTime(target, ins.next, 0.8 + rnd() * 1.6);
        ins.next += 4 + rnd() * 8;
      }
    }
    while (this.nextWind < until) {
      const gust = rnd();
      this.windG.gain.setTargetAtTime(0.07 + gust * 0.16, this.nextWind, 1.4);
      this.windLP.frequency.setTargetAtTime(260 + gust * 420, this.nextWind, 1.4);
      this.nextWind += 3 + rnd() * 5;
    }
    while (this.nextBike < until) {
      this.motorbike(this.nextBike);
      this.nextBike += 30 + rnd() * 45;
    }
    while (this.nextSprinkler < until) {
      if (this.scene !== 'card') this.sprinkler(this.nextSprinkler);
      this.nextSprinkler += 13 + rnd() * 12;
    }
    while (this.nextFar < until) {
      const pick = rnd();
      if (pick < 0.4) this.dog(this.nextFar);
      else if (pick < 0.7) this.gate(this.nextFar);
      else this.call(this.nextFar);
      this.nextFar += 22 + rnd() * 30;
    }
  }

  private voice(gain: number, send: number, pan = 0): Voice {
    return new Voice(this.rig, this.bed, this.rig.ambWet, gain, send, pan);
  }

  /** A small motorbike going by on the road outside, left to right or back. */
  private motorbike(t: number): void {
    const rnd = this.rnd;
    const v = this.voice(0.11, 0.5);
    const dur = 7 + rnd() * 3;
    const mid = t + dur * 0.45;
    const end = t + dur;
    const dir = rnd() < 0.5 ? 1 : -1;
    const base = 82 + rnd() * 22;
    const pan = v.ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.8 * dir, t);
    pan.pan.linearRampToValueAtTime(0.8 * dir, end);
    const lp = v.filter('lowpass', 500, 1.2);
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.linearRampToValueAtTime(950, mid);
    lp.frequency.linearRampToValueAtTime(300, end);
    const amp = v.gain(0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.25, t + dur * 0.3);
    amp.gain.linearRampToValueAtTime(1, mid);
    amp.gain.linearRampToValueAtTime(0.2, mid + dur * 0.25);
    amp.gain.linearRampToValueAtTime(0, end);
    for (const [mul, g] of [[1, 0.6], [0.5, 0.5], [1.5, 0.2]] as const) {
      const o = v.osc('sawtooth', base * mul, t, end + 0.05);
      const f = o.frequency;
      f.setValueAtTime(base * mul, t);
      // Accelerating toward us, a gear change, then the Doppler drop as it passes.
      f.linearRampToValueAtTime(base * mul * 1.45, mid - 1.2);
      f.linearRampToValueAtTime(base * mul * 1.15, mid - 1.0);
      f.linearRampToValueAtTime(base * mul * 1.4, mid);
      f.linearRampToValueAtTime(base * mul * 1.12, mid + 0.7);
      f.linearRampToValueAtTime(base * mul * 0.95, end);
      o.connect(v.gain(g)).connect(lp);
    }
    const rasp = v.noise(t, end + 0.05);
    rasp.connect(v.filter('bandpass', 900, 1)).connect(v.gain(0.25)).connect(lp);
    lp.connect(amp).connect(pan).connect(v.out);
    v.done();
  }

  /** Impact sprinkler: a run of ticks out, a hiss, a quick rattle back. */
  private sprinkler(t: number): void {
    const rnd = this.rnd;
    const v = this.voice(0.07, 0.25, (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.4));
    const n = 12 + Math.floor(rnd() * 6);
    const gap = 0.17 + rnd() * 0.03;
    for (let i = 0; i < n; i++) {
      const tt = t + i * gap;
      v.burst(tt, { freq: 2900 + rnd() * 500, q: 1.6, peak: 0.6 + rnd() * 0.3, decay: 0.014 });
      v.burst(tt + 0.01, { type: 'highpass', freq: 2400, peak: 0.16, attack: 0.02, decay: 0.12 });
    }
    const back = t + n * gap;
    for (let i = 0; i < 9; i++) {
      v.burst(back + i * 0.062, { freq: 3300, q: 1.6, peak: 0.45, decay: 0.01 });
    }
    v.done();
  }

  private dog(t: number): void {
    const rnd = this.rnd;
    const v = this.voice(0.07, 1.6, rnd() * 1.6 - 0.8);
    const pitch = 0.8 + rnd() * 0.4;
    const n = 2 + Math.floor(rnd() * 3);
    let tt = t;
    const lp = v.filter('lowpass', 1700, 0.5);
    lp.connect(v.out);
    for (let i = 0; i < n; i++) {
      const o = v.osc('sawtooth', 430 * pitch, tt, tt + 0.2);
      o.frequency.setValueAtTime(380 * pitch, tt);
      o.frequency.linearRampToValueAtTime(450 * pitch, tt + 0.03);
      o.frequency.exponentialRampToValueAtTime(290 * pitch, tt + 0.15);
      const amp = v.gain(0);
      perc(amp.gain, tt, 0.8 + rnd() * 0.2, 0.012, 0.15);
      const f1 = v.filter('bandpass', 880 * pitch, 3);
      const f2 = v.filter('bandpass', 1650 * pitch, 4);
      o.connect(f1).connect(amp);
      o.connect(f2).connect(amp);
      amp.connect(lp);
      v.burst(tt, { freq: 1200, q: 1, peak: 0.25, attack: 0.008, decay: 0.09 }, lp);
      tt += 0.27 + rnd() * 0.16 + (i === 1 ? 0.25 * rnd() : 0);
    }
    v.done();
  }

  private gate(t: number): void {
    const rnd = this.rnd;
    const v = this.voice(0.05, 1.8, rnd() * 1.6 - 0.8);
    const det = 0.9 + rnd() * 0.2;
    const hit = (tt: number, k: number): void => {
      v.tone(tt, 233 * det, 0.5 * k, 1.1);
      v.tone(tt, 517 * det, 0.4 * k, 0.8);
      v.tone(tt, 911 * det, 0.25 * k, 0.5);
      v.tone(tt, 1420 * det, 0.12 * k, 0.3);
      v.burst(tt, { type: 'lowpass', freq: 1500, peak: 0.5 * k, decay: 0.03 });
    };
    hit(t, 1);
    hit(t + 0.16 + rnd() * 0.05, 0.4);
    v.done();
  }

  /** Someone calling across the car park: a far, wordless two-note shout. */
  private call(t: number): void {
    const rnd = this.rnd;
    const v = this.voice(0.045, 2, rnd() * 1.6 - 0.8);
    const f0 = 170 + rnd() * 70;
    const dur = 0.55 + rnd() * 0.3;
    const end = t + dur + 0.25;
    const o = v.osc('sawtooth', f0, t, end);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.06, t + dur * 0.4);
    o.frequency.linearRampToValueAtTime(f0 * 1.5, t + dur * 0.55);
    o.frequency.linearRampToValueAtTime(f0 * 1.3, t + dur + 0.2);
    const amp = v.gain(0);
    swell(amp.gain, t, 1, 0.06, dur, 0.18);
    const f1 = v.filter('bandpass', 480, 4);
    f1.frequency.setValueAtTime(480, t + dur * 0.45);
    f1.frequency.linearRampToValueAtTime(330, t + dur * 0.65);
    const f2 = v.filter('bandpass', 900, 5);
    f2.frequency.setValueAtTime(900, t + dur * 0.45);
    f2.frequency.linearRampToValueAtTime(2100, t + dur * 0.65);
    const lp = v.filter('lowpass', 2300, 0.5);
    o.connect(f1).connect(amp);
    o.connect(f2).connect(amp);
    amp.connect(lp).connect(v.out);
    v.done();
  }

  dispose(): void {
    for (const s of this.sources) s.stop();
    this.bed.disconnect();
    this.wet.disconnect();
  }
}
