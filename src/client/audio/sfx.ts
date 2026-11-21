/**
 * Every sound effect, as plain functions of (rig, start time, parameters).
 * Each builds a transient + body + space out of a few short-lived nodes and
 * returns the time its last source stops. Nothing here keeps state, so the
 * same functions render live and offline.
 */
import type { ItemKind } from '../../shared/protocol';
import { Voice, clamp, lerp, mtof, perc, swell, type Rig } from './core';

export type HitMaterial = 'board' | 'concrete' | 'cone' | 'turnstile';
export type Surface = 'turf' | 'mud' | 'track' | 'air';

const sv = (rig: Rig, gain: number, send: number, pan = 0): Voice =>
  new Voice(rig, rig.sfx, rig.sfxWet, gain, send, pan);

/** 1 +/- amount, so repeats never sound identical. */
const vary = (rig: Rig, amount: number): number => 1 + (rig.rnd() * 2 - 1) * amount;

/** Soft mallet / kalimba-like note used for all the little musical cues. */
function mallet(v: Voice, t: number, midi: number, peak: number, decay = 0.5, bright = 0.5): void {
  const f = mtof(midi);
  v.tone(t, f, peak, decay, { attack: 0.003 });
  v.tone(t, f * 2, peak * 0.2, decay * 0.5);
  v.tone(t, f * 3.98, peak * 0.3 * bright, 0.07);
  v.burst(t, { freq: Math.min(3600, f * 4), q: 1.2, peak: peak * 0.25 * bright, decay: 0.012 });
}

/** Sustained soft pad note under the stings. */
function padNote(v: Voice, t: number, midi: number, peak: number, hold: number, release = 0.7): void {
  const end = t + 0.04 + hold + release + 0.05;
  const o = v.osc('triangle', mtof(midi), t, end);
  const o2 = v.osc('sine', mtof(midi) * 1.004, t, end);
  const lp = v.filter('lowpass', 1700, 0.5);
  const amp = v.gain(0);
  swell(amp.gain, t, peak, 0.04, hold, release);
  o.connect(lp);
  o2.connect(lp);
  lp.connect(amp).connect(v.out);
}

/** The supporters' bass drum: used by the item, the fanfare and the music. */
export function bassDrum(v: Voice, t: number, peak: number, size = 1): void {
  v.tone(t, 47, peak, 0.45 + 0.55 * size, { from: 112, bendTime: 0.07 });
  v.tone(t, 93, peak * 0.45, 0.2 + 0.15 * size, { from: 168, bendTime: 0.05 });
  v.tone(t, 141, peak * 0.16, 0.18);
  v.burst(t, { type: 'lowpass', freq: 1400, peak: peak * 0.8, decay: 0.022 });
  // Skin and shell: what still reads as a drum on small speakers.
  v.burst(t, { freq: 780, q: 1, peak: peak * 0.5, decay: 0.05 });
  v.burst(t, { freq: 310, q: 1.5, peak: peak * 0.7, decay: 0.09 });
  v.tone(t, 188, peak * 0.3, 0.12, { from: 290, bendTime: 0.03 });
}

/** A few hands clapping, slightly apart. */
export function claps(v: Voice, t: number, peak: number, people = 4): void {
  const r = v.rig.rnd;
  for (let i = 0; i < people; i++) {
    const tt = t + i * 0.007 + r() * 0.012;
    v.burst(tt, { freq: 1050 + r() * 500, q: 1.3, peak: peak * (0.5 + r() * 0.5), decay: 0.035 + r() * 0.03 });
  }
  v.burst(t + 0.01, { freq: 1900, q: 0.8, peak: peak * 0.35, attack: 0.004, decay: 0.13 });
}

/* ------------------------------------------------------------------ */
/* Ball                                                                */
/* ------------------------------------------------------------------ */

/** Putter on a hard ball: tap at low power, firm crack at full. */
export function putt(rig: Rig, t: number, power: number, gain = 1): number {
  const p = clamp(power, 0, 1);
  const det = vary(rig, 0.035);
  const v = sv(rig, gain * (0.4 + 0.6 * p), 0.1 + 0.12 * p, (rig.rnd() - 0.5) * 0.12);
  const bright = p * p;
  v.burst(t, { freq: lerp(1800, 3000, p) * det, q: 0.9, peak: 0.45 + 0.5 * p, decay: 0.014 + 0.012 * p });
  v.tone(t, 742 * det, 0.75, 0.075);
  v.tone(t, 1268 * det, 0.4 + 0.3 * p, 0.05);
  v.tone(t, 2115 * det, 0.12 + 0.34 * bright, 0.032);
  v.tone(t, 3190 * det, 0.18 * bright, 0.02);
  // Weight: the thump you feel more than hear.
  v.tone(t, 64, 0.6 + 0.2 * p, 0.12 + 0.06 * p, { from: 150 + 60 * p, bendTime: 0.035 });
  v.burst(t, { type: 'lowpass', freq: 420, peak: 0.4 + 0.2 * p, decay: 0.03, pink: true });
  // A whisper of the shaft ringing on hard hits.
  if (p > 0.45) v.tone(t, 428 * det, 0.07 * p, 0.28);
  return v.done();
}

export function bounce(rig: Rig, t: number, speed: number, material: HitMaterial, gain = 1): number {
  const a = Math.pow(clamp(speed / 13, 0.04, 1), 0.8);
  const det = vary(rig, 0.05);
  const pan = (rig.rnd() - 0.5) * 0.3;
  if (material === 'board') {
    // Hollow LED advertising board: plastic face over an aluminium frame.
    const v = sv(rig, gain * a * 0.95, 0.24, pan);
    v.burst(t, { type: 'lowpass', freq: 2400, peak: 0.7, decay: 0.008 });
    v.tone(t, 188 * det, 0.6, 0.17, { from: 236 * det, bendTime: 0.03 });
    v.tone(t, 311 * det, 0.55, 0.13);
    v.tone(t, 467 * det, 0.45, 0.1);
    v.tone(t, 733 * det, 0.3, 0.07);
    v.tone(t, 1140 * det, 0.2, 0.05);
    v.burst(t, { freq: 1450 * det, q: 2.2, peak: 0.4 * a, decay: 0.05 });
    v.burst(t + 0.031, { freq: 620 * det, q: 3, peak: 0.1, decay: 0.05 });
    return v.done();
  }
  if (material === 'concrete') {
    const v = sv(rig, gain * a, 0.14, pan);
    v.burst(t, { type: 'lowpass', freq: 1700 * det, peak: 1.3, decay: 0.026 });
    v.tone(t, 146 * det, 0.45, 0.07, { from: 230, bendTime: 0.02 });
    v.tone(t, 548 * det, 0.7, 0.04);
    v.tone(t, 915 * det, 0.45, 0.025);
    v.burst(t, { freq: 2500, q: 0.8, peak: 0.6, decay: 0.012 });
    return v.done();
  }
  if (material === 'cone') {
    // Rubbery: the pitch dips and springs back.
    const v = sv(rig, gain * a * 1.2, 0.14, pan);
    const end = t + 0.3;
    const o = v.osc('sine', 190 * det, t, end);
    o.frequency.setValueAtTime(190 * det, t);
    o.frequency.exponentialRampToValueAtTime(92 * det, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(128 * det, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(104 * det, t + 0.26);
    const amp = v.gain(0);
    perc(amp.gain, t, 0.6, 0.003, 0.25);
    o.connect(amp).connect(v.out);
    v.tone(t, 214 * det, 0.6, 0.12, { from: 320 * det, bendTime: 0.04 });
    v.burst(t, { type: 'lowpass', freq: 620, peak: 0.6, decay: 0.04, pink: true });
    v.burst(t, { freq: 390 * det, q: 5, peak: 1.5, decay: 0.09 });
    v.burst(t, { freq: 1100 * det, q: 2, peak: 0.6, decay: 0.02 });
    return v.done();
  }
  // Turnstile: steel arm clanks, then the ratchet runs down.
  const v = sv(rig, gain * a * 0.9, 0.3, pan);
  const freqs = [487, 1123, 1784, 2590, 3310];
  const peaks = [0.34, 0.3, 0.2, 0.11, 0.05];
  const decays = [0.42, 0.34, 0.25, 0.17, 0.1];
  for (let i = 0; i < freqs.length; i++) v.tone(t, freqs[i]! * det, peaks[i]!, decays[i]! * (0.6 + 0.4 * a));
  v.burst(t, { freq: 2100, q: 1, peak: 0.4, decay: 0.012 });
  v.tone(t, 120, 0.4, 0.06, { from: 200, bendTime: 0.02 });
  const clicks = 3 + Math.floor(a * 4);
  let tt = t + 0.05;
  let gap = 0.042;
  for (let i = 0; i < clicks; i++) {
    const k = Math.pow(0.78, i);
    v.burst(tt, { freq: 2500 * det, q: 3, peak: 0.24 * k, decay: 0.008 });
    v.tone(tt, 1580 * det, 0.06 * k, 0.016);
    tt += gap;
    gap *= 1.2;
  }
  return v.done();
}

/** Dropping onto turf from a ledge: soft, low, with a little second bounce. */
export function land(rig: Rig, t: number, speed: number, gain = 1): number {
  const a = clamp(speed / 12, 0.12, 1);
  const v = sv(rig, gain * (0.45 + 0.55 * a), 0.12, (rig.rnd() - 0.5) * 0.2);
  const det = vary(rig, 0.06);
  v.tone(t, 58 * det, 0.7, 0.15, { from: 124 * det, bendTime: 0.03 });
  v.tone(t, 176 * det, 0.9, 0.08, { from: 270 * det, bendTime: 0.025 });
  v.burst(t, { type: 'lowpass', freq: 900, peak: 1.6, decay: 0.07, pink: true });
  v.burst(t, { freq: 2300, q: 0.7, peak: 0.45, attack: 0.004, decay: 0.09 });
  v.tone(t + 0.13, 60 * det, 0.26 * a, 0.08, { from: 100, bendTime: 0.02 });
  v.burst(t + 0.13, { type: 'lowpass', freq: 380, peak: 0.3 * a, decay: 0.04, pink: true });
  return v.done();
}

/** The classic hollow plastic rattle as the ball drops into the cup. */
export function cupDrop(rig: Rig, t: number, gain = 1): number {
  const v = sv(rig, gain * 1.15, 0.2);
  const r = rig.rnd;
  const n = r() < 0.5 ? 4 : 3;
  let tt = t;
  let gap = 0.082 + r() * 0.012;
  let k = 1;
  for (let i = 0; i < n; i++) {
    const d = vary(rig, 0.04);
    v.burst(tt, { freq: 1850 * d, q: 1, peak: 0.3 * k, decay: 0.008 });
    v.tone(tt, 392 * d, 0.5 * k, 0.065);
    v.tone(tt, 688 * d, 0.34 * k, 0.045);
    v.tone(tt, 1175 * d, 0.18 * k, 0.03);
    // The cup's hollow cavity answers every knock.
    v.burst(tt, { freq: 305, q: 7, peak: 1.3 * k, decay: 0.1 });
    tt += gap;
    gap *= 0.74;
    k *= 0.62;
  }
  v.burst(tt, { freq: 900, q: 2, peak: 0.05, attack: 0.01, hold: 0.05, decay: 0.08 });
  return v.done();
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/** Short sting in the music's key (D minor / F major), scaled by the result. */
export function holed(rig: Rig, t: number, vsPar: number, holeInOne: boolean, gain = 1): number {
  const v = sv(rig, gain * 0.62, 0.3);
  if (holeInOne) {
    // Bb - C - D major: a little terrace fanfare with the big drum.
    const arps = [[58, 62, 65, 70], [60, 64, 67, 72], [62, 66, 69, 74, 78, 81]];
    arps.forEach((arp, i) => {
      const t0 = t + i * 0.32;
      bassDrum(v, t0, 0.5, 0.5);
      arp.forEach((m, j) => mallet(v, t0 + j * 0.065, m, 0.34, i === 2 ? 0.9 : 0.4, 0.7));
    });
    for (const m of [50, 62, 66, 69, 74]) padNote(v, t + 0.64, m, 0.09, 0.9, 0.9);
    claps(v, t + 0.96, 0.3, 5);
    claps(v, t + 1.12, 0.3, 5);
    v.burst(t + 0.64, { freq: 4600, q: 1, peak: 0.035, attack: 0.05, hold: 0.4, decay: 0.6 });
    return v.done();
  }
  if (vsPar > 0) {
    // Over par: a small shrug, not a punishment.
    mallet(v, t, 69, 0.42, 0.3, 0.3);
    mallet(v, t + 0.16, 65, 0.4, 0.3, 0.25);
    mallet(v, t + 0.34, 62, 0.44, 0.6, 0.25);
    padNote(v, t + 0.34, 50, 0.06, 0.2, 0.5);
    return v.done();
  }
  if (vsPar === 0) {
    mallet(v, t, 62, 0.32, 0.35, 0.4);
    mallet(v, t + 0.11, 69, 0.32, 0.35, 0.4);
    mallet(v, t + 0.22, 74, 0.36, 0.7, 0.5);
    for (const m of [62, 69]) padNote(v, t + 0.22, m, 0.055, 0.3, 0.6);
    return v.done();
  }
  if (vsPar === -1) {
    [65, 69, 72, 77].forEach((m, i) => mallet(v, t + i * 0.09, m, 0.32, 0.4, 0.55));
    mallet(v, t + 0.4, 81, 0.36, 0.9, 0.6);
    for (const m of [53, 65, 69, 72]) padNote(v, t + 0.4, m, 0.06, 0.45, 0.7);
    v.burst(t + 0.4, { freq: 4400, q: 1.2, peak: 0.03, attack: 0.02, hold: 0.15, decay: 0.4 });
    return v.done();
  }
  // Eagle or better.
  bassDrum(v, t, 0.4, 0.4);
  [65, 69, 72, 77, 81, 84].forEach((m, i) => mallet(v, t + i * 0.075, m, 0.3, 0.45, 0.6));
  bassDrum(v, t + 0.52, 0.5, 0.6);
  mallet(v, t + 0.52, 89, 0.22, 1.0, 0.5);
  mallet(v, t + 0.52, 77, 0.34, 1.0, 0.6);
  for (const m of [53, 65, 69, 72, 77]) padNote(v, t + 0.52, m, 0.06, 0.7, 0.9);
  claps(v, t + 0.84, 0.22, 4);
  v.burst(t + 0.52, { freq: 4500, q: 1.2, peak: 0.035, attack: 0.03, hold: 0.3, decay: 0.6 });
  return v.done();
}

/** Off the edge: falling whoosh, a thud far below, then the penalty cue. */
export function out(rig: Rig, t: number, gain = 1): number {
  const v = sv(rig, gain * 0.8, 0.3);
  v.burst(t, { freq: 1500, sweepTo: 260, q: 1.4, peak: 0.55, attack: 0.12, hold: 0.25, decay: 0.45 });
  const o = v.osc('sine', 640, t, t + 1.0);
  o.frequency.setValueAtTime(640, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.85);
  const amp = v.gain(0);
  swell(amp.gain, t, 0.13, 0.08, 0.35, 0.4);
  o.connect(amp).connect(v.out);
  v.done();

  const far = sv(rig, gain * 0.6, 0.8);
  const tt = t + 0.95;
  far.tone(tt, 48, 0.95, 0.32, { from: 96, bendTime: 0.04 });
  far.burst(tt, { type: 'lowpass', freq: 320, peak: 0.9, decay: 0.12, pink: true });
  far.burst(tt, { freq: 700, q: 1, peak: 0.2, decay: 0.05 });
  far.done();

  const cue = sv(rig, gain * 0.55, 0.25);
  mallet(cue, t + 1.3, 69, 0.4, 0.3, 0.3);
  mallet(cue, t + 1.48, 62, 0.45, 0.55, 0.25);
  cue.tone(t + 1.48, mtof(50), 0.25, 0.4);
  return cue.done();
}

export function splash(rig: Rig, t: number, gain = 1): number {
  const v = sv(rig, gain * 0.95, 0.3, (rig.rnd() - 0.5) * 0.2);
  const r = rig.rnd;
  v.burst(t, { freq: 1300, q: 0.8, peak: 0.9, decay: 0.05 });
  v.tone(t, 70, 0.7, 0.22, { from: 140, bendTime: 0.05 });
  v.burst(t, { type: 'lowpass', freq: 3200, sweepTo: 500, peak: 0.6, attack: 0.012, hold: 0.05, decay: 0.5, pink: true });
  v.burst(t + 0.02, { freq: 3600, q: 0.7, peak: 0.16, attack: 0.03, hold: 0.08, decay: 0.4 });
  for (let i = 0; i < 7; i++) {
    const f = 320 + r() * 700;
    v.tone(t + 0.12 + r() * 0.55, f * 1.5, 0.1 + r() * 0.1, 0.06, { from: f, bendTime: 0.05, attack: 0.004 });
  }
  return v.done();
}

/** Onto a running-track strip: a quick rising rush with spike ticks. */
export function boost(rig: Rig, t: number, gain = 1): number {
  const v = sv(rig, gain * 0.7, 0.22);
  v.burst(t, { freq: 500, sweepTo: 3400, q: 2.2, peak: 0.55, attack: 0.05, hold: 0.15, decay: 0.25 });
  v.tone(t, 70, 0.5, 0.12, { from: 130, bendTime: 0.03 });
  const lp = v.filter('lowpass', 2200, 0.7);
  const amp = v.gain(0);
  swell(amp.gain, t, 0.15, 0.04, 0.18, 0.2);
  for (const f of [196, 199]) {
    const o = v.osc('triangle', f, t, t + 0.5);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 4, t + 0.34);
    o.connect(lp);
  }
  lp.connect(amp).connect(v.out);
  let tt = t + 0.02;
  let gap = 0.07;
  for (let i = 0; i < 6; i++) {
    v.burst(tt, { freq: 2300 + i * 150, q: 2, peak: 0.14, decay: 0.012 });
    tt += gap;
    gap *= 0.78;
  }
  return v.done();
}

/** Sucked into the players' tunnel, then popped out the other end. */
export function tunnel(rig: Rig, t: number, gain = 1): number {
  const v = sv(rig, gain * 0.85, 0.45);
  const src = v.noise(t, t + 0.56);
  const bp = v.filter('bandpass', 2600, 1.6);
  bp.frequency.setValueAtTime(2600, t);
  bp.frequency.exponentialRampToValueAtTime(180, t + 0.5);
  const res = v.filter('bandpass', 1200, 8);
  res.frequency.setValueAtTime(1200, t);
  res.frequency.exponentialRampToValueAtTime(200, t + 0.5);
  const amp = v.gain(0);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(1.3, t + 0.45);
  amp.gain.linearRampToValueAtTime(0, t + 0.5);
  src.connect(bp).connect(amp);
  src.connect(res).connect(amp);
  amp.connect(v.out);
  const o = v.osc('sine', 55, t, t + 0.56);
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.48);
  const oa = v.gain(0);
  oa.gain.setValueAtTime(0, t);
  oa.gain.linearRampToValueAtTime(0.3, t + 0.44);
  oa.gain.linearRampToValueAtTime(0, t + 0.5);
  o.connect(oa).connect(v.out);
  // Out the far end.
  const tt = t + 0.62;
  v.burst(tt, { freq: 300, sweepTo: 2400, q: 1.5, peak: 0.9, attack: 0.01, decay: 0.2 });
  v.tone(tt, 85, 0.6, 0.16, { from: 170, bendTime: 0.04 });
  v.tone(tt, 440, 0.2, 0.12, { from: 220, bendTime: 0.08 });
  return v.done();
}

export function pickup(rig: Rig, t: number, gain = 1): number {
  const v = sv(rig, gain * 0.55, 0.2);
  mallet(v, t, 74, 0.4, 0.2, 0.6);
  mallet(v, t + 0.07, 81, 0.4, 0.25, 0.6);
  mallet(v, t + 0.14, 86, 0.3, 0.45, 0.5);
  v.burst(t + 0.14, { freq: 4300, q: 2, peak: 0.05, attack: 0.01, decay: 0.14 });
  return v.done();
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export function item(rig: Rig, t: number, kind: ItemKind, gain = 1): number {
  if (kind === 'drum') {
    // Big supporters' drum and the shockwave rolling out from it.
    const v = sv(rig, gain * 0.95, 0.5);
    bassDrum(v, t, 0.62, 1);
    v.burst(t, { freq: 240, q: 1, peak: 2.2, decay: 0.12 });
    v.burst(t, { type: 'lowpass', freq: 2200, peak: 1.2, decay: 0.02 });
    v.tone(t, 188, 0.5, 0.14, { from: 300, bendTime: 0.03 });
    v.burst(t, { freq: 200, sweepTo: 1400, q: 0.8, peak: 1.8, attack: 0.03, hold: 0.05, decay: 0.5, pink: true });
    v.burst(t, { type: 'lowpass', freq: 110, peak: 0.6, attack: 0.02, hold: 0.1, decay: 0.4, pink: true });
    return v.done();
  }
  if (kind === 'sandal') {
    // Flip-flop: flat slap, short rubber squeak, dead stop.
    const v = sv(rig, gain, 0.18);
    const det = vary(rig, 0.05);
    v.burst(t, { freq: 1700 * det, q: 0.7, peak: 1, decay: 0.045 });
    v.burst(t, { type: 'lowpass', freq: 600, peak: 0.5, decay: 0.05, pink: true });
    v.tone(t, 130, 0.4, 0.07, { from: 240, bendTime: 0.02 });
    const t1 = t + 0.035;
    const o = v.osc('triangle', 960 * det, t1, t1 + 0.26);
    o.frequency.setValueAtTime(960 * det, t1);
    o.frequency.exponentialRampToValueAtTime(540 * det, t1 + 0.2);
    const lfo = v.osc('sine', 37, t1, t1 + 0.26);
    const depth = v.gain(45);
    lfo.connect(depth).connect(o.frequency);
    const bp = v.filter('bandpass', 1350, 3);
    const amp = v.gain(0);
    swell(amp.gain, t1, 0.4, 0.015, 0.08, 0.12);
    o.connect(bp).connect(amp).connect(v.out);
    v.burst(t + 0.24, { type: 'lowpass', freq: 400, peak: 0.35, decay: 0.05, pink: true });
    return v.done();
  }
  if (kind === 'swap') {
    // Two whooshes crossing, with a traded pair of notes.
    const a = sv(rig, gain * 0.68, 0.25, -0.6);
    a.burst(t, { freq: 500, sweepTo: 2600, q: 2, peak: 0.5, attack: 0.15, hold: 0.05, decay: 0.25 });
    mallet(a, t, 74, 0.4, 0.25, 0.5);
    mallet(a, t + 0.32, 81, 0.4, 0.4, 0.5);
    a.done();
    const b = sv(rig, gain * 0.68, 0.25, 0.6);
    b.burst(t + 0.05, { freq: 2600, sweepTo: 500, q: 2, peak: 0.5, attack: 0.15, hold: 0.05, decay: 0.25 });
    mallet(b, t + 0.12, 81, 0.4, 0.25, 0.5);
    mallet(b, t + 0.4, 74, 0.4, 0.4, 0.5);
    return b.done();
  }
  // Peanuts: the last putt spools back like a tape.
  const v = sv(rig, gain * 0.85, 0.2);
  const end = t + 0.56;
  const o = v.osc('sawtooth', 180, t, end);
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(1250, t + 0.5);
  const bp = v.filter('bandpass', 600, 1.2);
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
  const chatter = v.gain(0.6);
  const lfo = v.osc('sine', 26, t, end);
  lfo.frequency.setValueAtTime(26, t);
  lfo.frequency.exponentialRampToValueAtTime(70, t + 0.5);
  const depth = v.gain(0.4);
  lfo.connect(depth).connect(chatter.gain);
  const amp = v.gain(0);
  swell(amp.gain, t, 0.3, 0.04, 0.36, 0.1);
  o.connect(bp).connect(chatter).connect(amp).connect(v.out);
  v.burst(t, { freq: 1500, sweepTo: 4000, q: 1.5, peak: 0.16, attack: 0.05, hold: 0.3, decay: 0.12 });
  v.tone(t + 0.55, 180, 0.5, 0.06, { from: 320, bendTime: 0.02 });
  v.burst(t + 0.55, { freq: 2200, q: 1, peak: 0.3, decay: 0.01 });
  mallet(v, t + 0.62, 69, 0.3, 0.3, 0.4);
  return v.done();
}

/* ------------------------------------------------------------------ */
/* Referee, clock, interface                                           */
/* ------------------------------------------------------------------ */

function blast(v: Voice, t: number, dur: number, level: number, fall: boolean): void {
  const end = t + dur + 0.12;
  const f0 = 2040 * (1 + (v.rig.rnd() - 0.5) * 0.02);
  const lp = v.filter('lowpass', 4200, 0.5);
  const env = v.gain(0);
  swell(env.gain, t, level, 0.014, dur, 0.07);
  // The pea: a fast flutter in both level and pitch.
  const trill = v.gain(0.62);
  const lfo = v.osc('sine', 41, t, end);
  const am = v.gain(0.38);
  lfo.connect(am).connect(trill.gain);
  const fm = v.gain(22);
  lfo.connect(fm);
  for (const [mul, g] of [[1, 0.5], [1.068, 0.42]] as const) {
    const o = v.osc('triangle', f0 * mul, t, end);
    o.frequency.setValueAtTime(f0 * mul * 0.93, t);
    o.frequency.exponentialRampToValueAtTime(f0 * mul, t + 0.035);
    if (fall) {
      o.frequency.setValueAtTime(f0 * mul, t + dur - 0.3);
      o.frequency.exponentialRampToValueAtTime(f0 * mul * 0.94, t + dur + 0.05);
    }
    fm.connect(o.frequency);
    const og = v.gain(g);
    o.connect(og).connect(trill);
  }
  const air = v.noise(t, end);
  const bp = v.filter('bandpass', 2100, 2.5);
  const ag = v.gain(0.5);
  air.connect(bp).connect(ag).connect(trill);
  trill.connect(lp).connect(env).connect(v.out);
}

/** Referee's pea whistle, out in the open air. */
export function whistle(rig: Rig, t: number, kind: 'start' | 'end' | 'full', gain = 1): number {
  const v = sv(rig, gain * 0.22, 0.6);
  if (kind === 'start') blast(v, t, 0.42, 1, false);
  else if (kind === 'end') {
    blast(v, t, 0.15, 0.9, false);
    blast(v, t + 0.27, 0.5, 1, false);
  } else {
    blast(v, t, 0.36, 0.95, false);
    blast(v, t + 0.52, 0.36, 0.95, false);
    blast(v, t + 1.04, 1.25, 1, true);
  }
  return v.done();
}

/** Countdown tick, rising in pitch and weight toward zero. */
export function tick(rig: Rig, t: number, secondsLeft: number, gain = 1): number {
  const s = clamp(secondsLeft, 0, 10);
  const u = 1 - s / 10;
  const v = sv(rig, gain * (0.42 + 0.3 * u), 0.14);
  const f = 830 * Math.pow(2, Math.round(u * 5) / 12);
  const knock = (tt: number, ff: number, k: number): void => {
    v.tone(tt, ff, 0.5 * k, 0.06);
    v.tone(tt, ff * 2.42, 0.2 * k, 0.03);
    v.burst(tt, { freq: 2600, q: 1.2, peak: 0.22 * k, decay: 0.007 });
    v.tone(tt, 150, 0.3 * k, 0.04);
  };
  knock(t, f, 1);
  if (s <= 3) knock(t + 0.13, f * 0.75, 0.6);
  if (s <= 0) v.tone(t, 196, 0.5, 0.4, { from: 294, bendTime: 0.15 });
  return v.done();
}

export function ui(rig: Rig, t: number, kind: 'hover' | 'click' | 'toggle', gain = 1): number {
  if (kind === 'hover') {
    const v = sv(rig, gain * 0.28, 0);
    v.tone(t, 1480 * vary(rig, 0.02), 0.3, 0.03);
    v.burst(t, { freq: 2500, q: 1.5, peak: 0.15, decay: 0.008 });
    return v.done();
  }
  const v = sv(rig, gain * 0.55, 0.06);
  v.tone(t, 520, 0.5, 0.055, { from: 700, bendTime: 0.015 });
  v.tone(t, 1040, 0.14, 0.03);
  v.burst(t, { freq: 2200, q: 1, peak: 0.3, decay: 0.008 });
  v.tone(t, 110, 0.3, 0.05);
  if (kind === 'toggle') {
    v.tone(t + 0.075, 784, 0.4, 0.09);
    v.tone(t + 0.075, 1568, 0.08, 0.04);
  }
  return v.done();
}

const COUNT_SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81];

/** Scorecard tick. `step` walks up a scale as numbers are revealed. */
export function scoreCount(rig: Rig, t: number, step: number, gain = 1): number {
  const v = sv(rig, gain * 0.45, 0.1);
  mallet(v, t, COUNT_SCALE[step % COUNT_SCALE.length]!, 0.5, 0.16, 0.5);
  return v.done();
}

/** Soft notch felt while dragging the aim back. */
export function aimTick(rig: Rig, t: number, notch: number, gain = 1): number {
  const v = sv(rig, gain * 0.2, 0);
  const f = 420 + notch * 38;
  v.tone(t, f, 0.5, 0.035);
  v.burst(t, { freq: 1800 + notch * 60, q: 2, peak: 0.25, decay: 0.006 });
  return v.done();
}

/** A ghost of the crowd: mostly reverb, a swell of voices and a few claps. */
export function cheer(rig: Rig, t: number, size: number, gain = 1): number {
  const s = clamp(size, 0, 1);
  const v = sv(rig, gain * (0.09 + 0.17 * s), 3.2);
  const r = rig.rnd;
  const attack = 0.3 + 0.3 * s;
  const hold = 0.25 + 0.7 * s;
  const release = 1.1 + 1.0 * s;
  const end = t + attack + hold + release + 0.1;
  const src = v.noise(t, end, true);
  const flutter = v.gain(0.8);
  const lfo = v.osc('sine', 6.3 + r() * 2, t, end);
  const ld = v.gain(0.2);
  lfo.connect(ld).connect(flutter.gain);
  for (const [f, q, g] of [[640, 2, 1], [1120, 2.5, 0.8], [2350, 3, 0.35]] as const) {
    const bp = v.filter('bandpass', f, q);
    bp.frequency.setValueAtTime(f * 0.9, t);
    bp.frequency.linearRampToValueAtTime(f * 1.12, t + attack + hold * 0.6);
    bp.frequency.linearRampToValueAtTime(f * 0.95, end);
    const amp = v.gain(0);
    swell(amp.gain, t, g, attack, hold, release);
    src.connect(bp).connect(amp).connect(flutter);
  }
  flutter.connect(v.out);
  const n = Math.floor(s * 12);
  for (let i = 0; i < n; i++) {
    v.burst(t + attack * 0.6 + r() * (hold + 0.6), { freq: 1000 + r() * 700, q: 1.3, peak: 0.25 + r() * 0.2, decay: 0.035 });
  }
  return v.done();
}

/* ------------------------------------------------------------------ */
/* Continuous voices                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rolling ball. Two noise bands (rumble + surface hiss) whose level and
 * brightness follow speed, with a slow wobble locked to how fast the ball
 * turns. Created once; `set` just steers it.
 */
export class RollVoice {
  private readonly out: GainNode;
  private readonly low: BiquadFilterNode;
  private readonly lowG: GainNode;
  private readonly hi: BiquadFilterNode;
  private readonly hiG: GainNode;
  private readonly wob: OscillatorNode;
  private readonly wobDepth: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private silent = true;

  constructor(rig: Rig) {
    const ctx = rig.ctx;
    const loop = (buf: AudioBuffer): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, rig.rnd() * 1.5);
      this.sources.push(s);
      return s;
    };
    this.low = ctx.createBiquadFilter();
    this.low.type = 'lowpass';
    this.low.frequency.value = 200;
    this.lowG = ctx.createGain();
    this.hi = ctx.createBiquadFilter();
    this.hi.type = 'bandpass';
    this.hi.frequency.value = 2000;
    this.hi.Q.value = 0.7;
    this.hiG = ctx.createGain();
    this.hiG.gain.value = 0;
    const body = ctx.createGain();
    this.wob = ctx.createOscillator();
    this.wob.frequency.value = 4;
    this.wobDepth = ctx.createGain();
    this.wobDepth.gain.value = 0;
    this.wob.connect(this.wobDepth).connect(body.gain);
    this.wob.start();
    this.sources.push(this.wob);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    loop(rig.pink).connect(this.low).connect(this.lowG).connect(body);
    loop(rig.white).connect(this.hi).connect(this.hiG).connect(body);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;
    body.connect(hp).connect(this.out).connect(rig.sfx);
  }

  set(speed: number, surface: Surface, t: number): void {
    const s = surface === 'air' ? 0 : clamp(speed / 10, 0, 1);
    if (s <= 0.004) {
      if (!this.silent) {
        this.out.gain.setTargetAtTime(0, t, 0.05);
        this.silent = true;
      }
      return;
    }
    this.silent = false;
    const tc = 0.06;
    let level: number, lowF: number, lowG: number, hiF: number, hiQ: number, hiG: number, wobF: number, wobD: number;
    if (surface === 'track') {
      level = 0.5 * Math.pow(s, 0.7);
      lowF = 260 + 700 * s; lowG = 0.7;
      hiF = 2300 + 1500 * s; hiQ = 0.9; hiG = 0.34;
      wobF = 13 + 30 * s; wobD = 0.3;
    } else if (surface === 'mud') {
      level = 0.5 * Math.pow(s, 0.5);
      lowF = 150 + 230 * s; lowG = 1.2;
      hiF = 650 + 300 * s; hiQ = 1.6; hiG = 0.3;
      wobF = 4.5 + 6 * s; wobD = 0.55;
    } else {
      level = 0.46 * Math.pow(s, 0.7);
      lowF = 150 + 520 * s; lowG = 1;
      hiF = 1700 + 1300 * s; hiQ = 0.6; hiG = 0.13 + 0.1 * s;
      wobF = 2.5 + 13 * s; wobD = 0.2;
    }
    this.out.gain.setTargetAtTime(level, t, tc);
    this.low.frequency.setTargetAtTime(lowF, t, tc);
    this.lowG.gain.setTargetAtTime(lowG, t, tc);
    this.hi.frequency.setTargetAtTime(hiF, t, tc);
    this.hi.Q.setTargetAtTime(hiQ, t, tc);
    this.hiG.gain.setTargetAtTime(hiG, t, tc);
    this.wob.frequency.setTargetAtTime(wobF, t, tc);
    this.wobDepth.gain.setTargetAtTime(wobD, t, tc);
  }

  dispose(): void {
    for (const s of this.sources) s.stop();
    this.out.disconnect();
  }
}

/** Quiet tension bed under the aim drag; pitch and level follow power. */
export class AimVoice {
  private readonly osc: OscillatorNode;
  private readonly osc2: OscillatorNode;
  private readonly lp: BiquadFilterNode;
  private readonly out: GainNode;
  private on = false;

  constructor(rig: Rig) {
    const ctx = rig.ctx;
    this.osc = ctx.createOscillator();
    this.osc.type = 'triangle';
    this.osc.frequency.value = 98;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 98.7;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 300;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.osc.connect(this.lp);
    this.osc2.connect(this.lp);
    this.lp.connect(this.out).connect(rig.sfx);
    this.osc.start();
    this.osc2.start();
  }

  set(power: number | null, t: number): void {
    if (power === null) {
      if (this.on) {
        this.out.gain.setTargetAtTime(0, t, 0.04);
        this.on = false;
      }
      return;
    }
    this.on = true;
    const p = clamp(power, 0, 1);
    const f = 98 * Math.pow(2, p * 0.75);
    this.osc.frequency.setTargetAtTime(f, t, 0.04);
    this.osc2.frequency.setTargetAtTime(f * 1.007, t, 0.04);
    this.lp.frequency.setTargetAtTime(260 + 700 * p, t, 0.04);
    this.out.gain.setTargetAtTime(0.015 + 0.035 * p, t, 0.05);
  }

  dispose(): void {
    this.osc.stop();
    this.osc2.stop();
    this.out.disconnect();
  }
}
