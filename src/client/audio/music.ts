/**
 * The score: a small radio left on in the stands. Laid-back dangdut/campursari
 * feel in D minor at 96 BPM - hand-drum "dang-dut" groove, bamboo-flute lead,
 * electric-piano skank, drawbar organ, rounded bass, shaker and tambourine -
 * over the slow stomp-and-clap of the terrace drums.
 *
 * The material is written out (five 8-bar sections, 100 s per pass); a seeded
 * variation pass on top changes ornaments, ghost notes, fills and who carries
 * the tune each time round. `pump` schedules notes a little ahead against the
 * audio clock; scene changes land on bar lines and crossfade.
 */
import { LEVELS, Voice, clamp, mtof, mulberry32, type Rig, type Rnd } from './core';
import { bassDrum, claps } from './sfx';

export type MusicScene = 'title' | 'intro' | 'play' | 'card' | 'final';

export const BPM = 96;
const STEP = 60 / BPM / 4; // one sixteenth
const SWING = STEP * 0.14; // off-beat sixteenths sit back a little

/* ------------------------------------------------------------------ */
/* Written material                                                    */
/* ------------------------------------------------------------------ */

type Style = 'A' | 'B' | 'C' | 'F';

interface Section {
  name: string;
  style: Style;
  /** One entry per bar; "Gm A" changes chord on beat 3. */
  chords: string[];
  /** Lead line, one string per bar: `note:sixteenths`, `-` is a rest. */
  lead: string[];
  /** Organ answers in the gaps the flute leaves, by bar index. */
  answer?: Record<number, string>;
}

const A: Section = {
  name: 'A', style: 'A',
  chords: ['Dm', 'Dm', 'Gm', 'Dm', 'Bb', 'C', 'Dm', 'A7'],
  lead: [
    '-:4 A4:2 D5:2 F5:3 E5:1 D5:4',
    'E5:2 F5:2 E5:2 D5:2 A4:6 -:2',
    '-:4 G4:2 Bb4:2 D5:3 C5:1 Bb4:4',
    'A4:2 Bb4:1 A4:1 G4:2 F4:2 A4:6 -:2',
    '-:2 D5:2 F5:2 D5:2 Bb4:4 D5:4',
    'E5:3 D5:1 C5:2 E5:2 G5:6 -:2',
    'F5:2 E5:2 D5:2 A4:2 D5:8',
    '-:4 C#5:2 E5:2 A4:6 -:2',
  ],
};

const A2: Section = {
  name: "A'", style: 'A',
  chords: ['Dm', 'Dm', 'Gm', 'Dm', 'Bb', 'C', 'Dm', 'Dm'],
  lead: [
    '-:4 A4:2 D5:2 F5:2 G5:2 A5:4',
    'G5:1 F5:1 E5:2 F5:2 D5:2 A4:6 -:2',
    '-:4 G4:2 Bb4:2 D5:2 G5:2 F5:4',
    'E5:2 D5:2 C5:2 Bb4:2 A4:6 -:2',
    '-:2 Bb4:2 D5:2 F5:2 G5:3 F5:1 D5:4',
    'E5:2 C5:2 G4:2 C5:2 E5:6 -:2',
    'F5:2 E5:1 D5:1 C5:2 A4:2 C5:2 D5:6',
    'D5:8 -:8',
  ],
};

const B: Section = {
  name: 'B', style: 'B',
  chords: ['F', 'C', 'Dm', 'Dm', 'Bb', 'F', 'Gm', 'A7'],
  lead: [
    'C5:4 A4:2 C5:2 F5:6 -:2',
    'E5:4 C5:2 E5:2 G5:4 E5:2 C5:2',
    'D5:6 F5:2 E5:2 D5:2 A4:4',
    '-:16',
    'D5:4 Bb4:2 D5:2 F5:6 -:2',
    'A5:4 G5:2 F5:2 C5:6 -:2',
    'Bb4:2 D5:2 G5:4 F5:2 E5:2 D5:4',
    'C#5:4 E5:2 C#5:2 A4:4 -:4',
  ],
  answer: { 3: '-:2 F4:2 A4:2 D5:2 C5:2 A4:2 F4:2 D4:2' },
};

const A3: Section = {
  name: "A''", style: 'A',
  chords: ['Dm', 'Dm', 'Gm', 'Dm', 'Bb', 'C', 'Dm', 'Dm'],
  lead: [
    '-:2 D5:2 F5:2 A5:2 G5:3 F5:1 D5:4',
    'E5:2 F5:2 E5:2 D5:2 A4:6 -:2',
    '-:2 Bb4:2 D5:2 G5:2 F5:3 Eb5:1 D5:4',
    'C5:2 Bb4:2 A4:2 G4:2 A4:6 -:2',
    '-:2 D5:2 F5:2 Bb5:2 A5:3 G5:1 F5:4',
    'E5:2 G5:2 E5:2 C5:2 D5:2 E5:4 -:2',
    'F5:3 E5:1 D5:2 C5:2 A4:2 C5:2 D5:4',
    'D5:6 -:10',
  ],
  answer: { 7: '-:8 A4:2 F4:2 E4:2 D4:2' },
};

/** The terrace: stomp, stomp, clap, with the flute calling across it. */
const C: Section = {
  name: 'C', style: 'C',
  chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm A', 'Dm'],
  lead: [
    'A4:3 Bb4:1 A4:2 F4:2 E4:2 D4:6',
    '-:16',
    'D5:3 E5:1 F5:2 E5:2 D5:2 Bb4:6',
    'A4:8 -:8',
    'A4:2 D5:2 E5:2 F5:2 A5:4 F5:2 E5:2',
    'D5:6 -:10',
    'G4:2 Bb4:2 D5:4 C#5:2 E5:2 A4:4',
    'D5:10 -:6',
  ],
  answer: {
    1: '-:4 D4:2 F4:2 A4:2 F4:2 D4:4',
    5: '-:8 A4:2 F4:2 E4:2 D4:2',
  },
};

/** Full time: four bars that lift to D major, then back to the title mood. */
const FINAL: Section = {
  name: 'final', style: 'F',
  chords: ['Bb', 'C', 'D', 'D'],
  lead: [
    'D5:2 F5:2 Bb5:4 A5:2 G5:2 F5:4',
    'E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4',
    'F#5:4 A5:2 F#5:2 D5:2 F#5:2 A5:4',
    'A5:8 -:8',
  ],
};

const SONG: Section[] = [A, A2, B, A3, C];

const CHORDS: Record<string, number[]> = {
  Dm: [2, 5, 9], Gm: [7, 10, 2], A7: [9, 1, 4, 7], A: [9, 1, 4],
  Bb: [10, 2, 5], C: [0, 4, 7], F: [5, 9, 0], D: [2, 6, 9],
};

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return NOTE_PC[m[1]!]! + acc + (Number(m[3]) + 1) * 12;
}

interface LeadNote { step: number; len: number; midi: number }

function parseBar(src: string): LeadNote[] {
  const notes: LeadNote[] = [];
  let step = 0;
  for (const tok of src.trim().split(/\s+/)) {
    const [name, lenStr] = tok.split(':') as [string, string];
    const len = Number(lenStr);
    if (name !== '-') notes.push({ step, len, midi: noteToMidi(name) });
    step += len;
  }
  if (step !== 16) throw new Error(`bar "${src}" has ${step} sixteenths`);
  return notes;
}

/** Throws if any written bar does not add up; used by the dev page. */
export function validateSong(): { bars: number; seconds: number } {
  let bars = 0;
  for (const s of [...SONG, FINAL]) {
    if (s.chords.length !== s.lead.length) throw new Error(`section ${s.name}: chords/lead mismatch`);
    s.lead.forEach(parseBar);
    for (const a of Object.values(s.answer ?? {})) parseBar(a);
    for (const c of s.chords) for (const n of c.split(' ')) if (!CHORDS[n]) throw new Error(`unknown chord ${n}`);
    if (s !== FINAL) bars += s.chords.length;
  }
  return { bars, seconds: bars * 16 * STEP };
}

/** Put pitch class `pc` in the octave starting at `low`. */
const place = (pc: number, low: number): number => low + ((pc - low) % 12 + 12) % 12;

const SCALE = [2, 4, 5, 7, 9, 10, 0]; // D natural minor
function neighbour(midi: number, dir: 1 | -1, sharpSeven: boolean): number {
  for (let m = midi + dir; ; m += dir) {
    const pc = ((m % 12) + 12) % 12;
    if (sharpSeven ? (pc === 1 || (pc !== 0 && SCALE.includes(pc))) : SCALE.includes(pc)) return m;
  }
}

/* Hand-drum patterns. D dut (low, bends up) | G dang | T tak | U tung | k ghost */
const KENDANG: Record<Style, string[]> = {
  A: ['D.kT.kU.T.kTG.Uk', 'D.kT.UU.T.kTG.UT'],
  B: ['D..T..U.D..TG.U.', 'D..T..U.D.kTG.Uk'],
  C: ['D.....U.......kT', 'D.....U.....k.UT'],
  F: ['D.kT.kU.T.kTG.UT', 'D.TT.kU.T.kTG.UT'],
};
const FILLS = ['T.TTUUGD', 'UkUkTTGD', 'T.U.TTUG', 'kTkTU.GD'];
const INTRO_FILL = 'T.kTU.UkT.TTUUGD';
const HIT_VEL: Record<string, number> = { D: 1, G: 0.9, T: 0.72, U: 0.68, k: 0.3 };

/* ------------------------------------------------------------------ */
/* Arrangement per scene                                               */
/* ------------------------------------------------------------------ */

type Layer = 'flute' | 'keys' | 'organ' | 'bass' | 'kendang' | 'shaker' | 'terrace';
const LAYERS: Layer[] = ['flute', 'keys', 'organ', 'bass', 'kendang', 'shaker', 'terrace'];

interface Arrangement { mix: Record<Layer, number>; lowpass: number; wet: number }

const ARR: Record<Exclude<MusicScene, 'final'> | 'finale', Arrangement> = {
  title: { mix: { flute: 1, keys: 0.9, organ: 0.8, bass: 0, kendang: 0.22, shaker: 0.55, terrace: 0 }, lowpass: 9000, wet: 1.7 },
  intro: { mix: { flute: 0.7, keys: 0.9, organ: 0.7, bass: 0.85, kendang: 0.8, shaker: 0.8, terrace: 0.6 }, lowpass: 10000, wet: 1.2 },
  play: { mix: { flute: 1, keys: 1, organ: 0.7, bass: 1, kendang: 1, shaker: 1, terrace: 1 }, lowpass: 12000, wet: 1 },
  card: { mix: { flute: 0, keys: 0.9, organ: 0.55, bass: 0.9, kendang: 0.3, shaker: 0.45, terrace: 0 }, lowpass: 1500, wet: 0.7 },
  finale: { mix: { flute: 1, keys: 1, organ: 0.9, bass: 1, kendang: 1, shaker: 1, terrace: 1.15 }, lowpass: 12000, wet: 1.4 },
};

const LAYER_PAN: Record<Layer, number> = { flute: -0.12, keys: 0.16, organ: -0.3, bass: 0, kendang: 0.08, shaker: 0.36, terrace: 0 };
const LAYER_SEND: Record<Layer, number> = { flute: 0.4, keys: 0.2, organ: 0.22, bass: 0, kendang: 0.16, shaker: 0.1, terrace: 0.55 };
/** Static balance between instruments (scene mixes multiply this). */
/** High-pass per layer: keeps each part in its own register (and strips the DC that 1:1 FM makes). */
const LAYER_HP: Partial<Record<Layer, number>> = { flute: 220, keys: 120, organ: 130, shaker: 1800 };
const LAYER_LEVEL: Record<Layer, number> = { flute: 0.5, keys: 0.5, organ: 0.5, bass: 0.65, kendang: 0.8, shaker: 1, terrace: 0.55 };

/** Envelope with an exponential settle to `sustain` and a clean linear release. */
function adsr(p: AudioParam, t: number, dur: number, peak: number, attack: number, sustain: number, settle: number, release: number): void {
  const d = Math.max(dur, attack + 0.005);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(peak * sustain, t + attack, settle);
  const atEnd = peak * (sustain + (1 - sustain) * Math.exp(-(d - attack) / settle));
  p.setValueAtTime(atEnd, t + d);
  p.linearRampToValueAtTime(0, t + d + release);
}

type Ev = (t: number) => void;

export class Music {
  private readonly layers = {} as Record<Layer, GainNode>;
  private readonly nodes: AudioNode[] = [];
  private readonly lfos: OscillatorNode[] = [];
  private readonly organWave: PeriodicWave;
  private readonly seed: number;
  private rnd: Rnd;

  private nextTime: number;
  private step = 0;
  private secIdx = 0;
  private barInSec = 0;
  private loop = 0;
  private finalBars = 0;
  private arr: Arrangement = ARR.title;
  private pending: MusicScene | null = null;
  private fill = false;
  private events: Ev[][] = [];
  private wetBase = LEVELS.music;
  private readonly drumEvents = new WeakSet<Ev>();

  constructor(private readonly rig: Rig, startTime: number, scene: MusicScene = 'title', seed = (Math.random() * 1e9) | 0) {
    const ctx = rig.ctx;
    this.seed = seed;
    this.rnd = mulberry32(seed);
    this.nextTime = startTime;
    this.arr = ARR[scene === 'final' ? 'title' : scene];

    // Drawbar-ish organ: fundamental, octave, a little twelfth and fifteenth.
    this.organWave = ctx.createPeriodicWave(
      new Float32Array([0, 0, 0, 0, 0, 0]),
      new Float32Array([0, 1, 0.5, 0.22, 0.12, 0.04]),
    );

    for (const name of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = this.arr.mix[name];
      const level = ctx.createGain();
      level.gain.value = LAYER_LEVEL[name];
      const pan = ctx.createStereoPanner();
      pan.pan.value = LAYER_PAN[name];
      const hpFreq = LAYER_HP[name];
      if (hpFreq) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = hpFreq;
        hp.Q.value = 0.6;
        g.connect(hp).connect(level);
        this.nodes.push(hp);
      } else g.connect(level);
      level.connect(pan).connect(rig.music);
      this.nodes.push(g, level, pan);
      if (LAYER_SEND[name] > 0) {
        const send = ctx.createGain();
        send.gain.value = LAYER_SEND[name];
        pan.connect(send).connect(rig.musicWet);
        this.nodes.push(send);
      }
      this.layers[name] = g;
      // Rotary-speaker wobble on the organ, slow drift on the keys.
      if (name === 'organ' || name === 'keys') {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = name === 'organ' ? 5.7 : 0.31;
        const depth = ctx.createGain();
        if (name === 'organ') {
          depth.gain.value = LAYER_LEVEL.organ * 0.14;
          lfo.connect(depth).connect(level.gain);
        } else {
          depth.gain.value = 0.2;
          lfo.connect(depth).connect(pan.pan);
        }
        lfo.start(startTime);
        this.lfos.push(lfo);
        this.nodes.push(depth);
      }
    }
    rig.musicLP.frequency.value = this.arr.lowpass;
    rig.musicWet.gain.value = this.wetBase * this.arr.wet;
  }

  /** Fade the whole score (dry and reverb send) to `level`; 0 is off. */
  setOutput(level: number, t: number, tc = 0.25): void {
    this.wetBase = level;
    this.rig.musicOut.gain.setTargetAtTime(level, t, tc);
    this.rig.musicWet.gain.setTargetAtTime(level * this.arr.wet, t, tc);
  }

  setScene(scene: MusicScene): void {
    this.pending = scene;
    if (scene === 'intro') this.fill = true;
  }

  /** Jump back to the top (used when music is switched on again). */
  restart(t: number): void {
    this.nextTime = t;
    this.step = 0;
    this.secIdx = 0;
    this.barInSec = 0;
    this.finalBars = 0;
  }

  /**
   * Schedule every step that starts before `until`. Steps already in the
   * past (`now`) are skipped silently, so a sleeping tab resumes in time.
   */
  pump(now: number, until: number): void {
    while (this.nextTime < until) {
      const t = this.nextTime;
      const audible = t >= now - 0.02;
      if (this.step === 0) this.beginBar(t);
      if (audible) {
        if (this.fill && this.step % 4 === 0 && this.step <= 12) this.injectFill(t);
        const swing = this.step % 2 === 1 ? SWING : 0;
        for (const ev of this.events[this.step]!) ev(t + swing);
      }
      this.nextTime += STEP;
      if (++this.step === 16) {
        this.step = 0;
        if (this.finalBars > 0) {
          if (--this.finalBars === 0) {
            this.secIdx = 0;
            this.barInSec = 0;
            this.applyArrangement(ARR.title, this.nextTime, 1.2);
          }
        } else if (++this.barInSec === SONG[this.secIdx]!.chords.length) {
          this.barInSec = 0;
          if (++this.secIdx === SONG.length) {
            this.secIdx = 0;
            this.loop++;
          }
        }
      }
    }
  }

  private applyArrangement(arr: Arrangement, t: number, tc = 0.35): void {
    this.arr = arr;
    for (const name of LAYERS) this.layers[name].gain.setTargetAtTime(arr.mix[name], t, tc);
    this.rig.musicLP.frequency.setTargetAtTime(arr.lowpass, t, tc);
    this.rig.musicWet.gain.setTargetAtTime(this.wetBase * arr.wet, t, tc);
  }

  private beginBar(t: number): void {
    if (this.pending) {
      const scene = this.pending;
      this.pending = null;
      if (scene === 'final') {
        this.finalBars = FINAL.chords.length;
        this.applyArrangement(ARR.finale, t, 0.12);
      } else {
        // Leaving the finale early is fine: the next bar is ordinary song again.
        if (this.finalBars > 0) {
          this.finalBars = 0;
          this.secIdx = 0;
          this.barInSec = 0;
        }
        this.applyArrangement(ARR[scene], t);
      }
    }
    const inFinal = this.finalBars > 0;
    const section = inFinal ? FINAL : SONG[this.secIdx]!;
    const bar = inFinal ? FINAL.chords.length - this.finalBars : this.barInSec;
    this.rnd = mulberry32(this.seed ^ (this.loop * 7919 + this.secIdx * 811 + bar * 131 + (inFinal ? 99991 : 0)));
    this.events = this.planBar(section, bar);
  }

  /** A pickup fill from the next beat to the bar line (scene 'intro'). */
  private injectFill(t: number): void {
    this.fill = false;
    this.layers.kendang.gain.setTargetAtTime(ARR.intro.mix.kendang, t, 0.03);
    this.layers.terrace.gain.setTargetAtTime(ARR.intro.mix.terrace, t, 0.03);
    for (let s = this.step; s < 16; s++) {
      const ch = INTRO_FILL[s]!;
      const kept = this.events[s]!.filter((e) => !this.drumEvents.has(e));
      if (ch !== '.') {
        const vel = HIT_VEL[ch]! * (0.6 + 0.4 * ((s - this.step) / Math.max(1, 15 - this.step)));
        kept.push((tt) => this.kendang(tt, ch, vel));
      }
      this.events[s] = kept;
    }
    this.events[this.step]!.push((tt) => this.boom(tt, 0.7));
  }

  /* -------------------------------------------------------------- */
  /* One bar of everything                                           */
  /* -------------------------------------------------------------- */

  private planBar(section: Section, bar: number): Ev[][] {
    const rnd = this.rnd;
    const ev: Ev[][] = Array.from({ length: 16 }, () => []);
    const style = section.style;
    const lastBar = bar === section.chords.length - 1;
    const chordNames = section.chords[bar]!.split(' ');
    const chordAt = (step: number): number[] => CHORDS[chordNames[chordNames.length > 1 && step >= 8 ? 1 : 0]!]!;
    const nextSection = !lastBar ? section : section === FINAL ? A : SONG[(this.secIdx + 1) % SONG.length]!;
    const nextChord = CHORDS[nextSection.chords[lastBar ? 0 : bar + 1]!.split(' ')[0]!]!;
    const dominant = chordNames.some((n) => n === 'A' || n === 'A7');
    const odd = this.loop % 2 === 1;

    /* ---- Lead ---- */
    // Every other pass the electric piano takes the first half of A' and the
    // flute sits out, and the middle of B drops an octave.
    const keysLead = odd && section === A2 && bar < 4;
    const octave = odd && section === B && (bar === 4 || bar === 5) ? -12 : 0;
    const notes = parseBar(section.lead[bar]!);
    notes.forEach((n, i) => {
      const prev = notes[i - 1];
      const joined = prev !== undefined && prev.step + prev.len === n.step;
      const midi = n.midi + octave;
      const vel = clamp(0.72 + (i === 0 ? 0.08 : 0) + (n.len >= 4 ? 0.06 : 0) + (rnd() - 0.5) * 0.12, 0.5, 1);
      const dur = n.len * STEP * (n.len <= 1 ? 1 : 0.93);
      if (keysLead) {
        ev[n.step]!.push((t) => this.epiano(t, dur, midi - 12, vel * 0.95, 1.5));
        return;
      }
      let from: number | undefined;
      let grace: number | undefined;
      const roll = rnd();
      if (joined && Math.abs(prev.midi - n.midi) >= 3 && n.len >= 2 && roll < 0.35) from = prev.midi + octave;
      else if (n.len >= 3 && roll < 0.38) grace = neighbour(midi, roll < 0.27 ? 1 : -1, dominant);
      const turn = n.len >= 6 && rnd() < 0.3;
      ev[n.step]!.push((t) => this.flute(t, dur, midi, vel, joined, from, grace, turn ? neighbour(midi, 1, dominant) : undefined));
    });
    const answer = section.answer?.[bar];
    if (answer) {
      for (const n of parseBar(answer)) {
        const vel = 0.6 + rnd() * 0.15;
        ev[n.step]!.push((t) => this.organ(t, n.len * STEP * 0.85, [n.midi, n.midi + 12], vel, true));
      }
    }

    /* ---- Keys ---- */
    const voicing = (step: number): number[] => chordAt(step).map((pc) => place(pc, 57)).sort((a, b) => a - b);
    const stab = (step: number, vel: number, len = 1.3): void => {
      const v = voicing(step);
      ev[step]!.push((t) => {
        for (const m of v) this.epiano(t + this.rnd() * 0.006, len * STEP, m, vel);
      });
    };
    if (style === 'A' || style === 'F') {
      for (const s of [2, 6, 10, 14]) stab(s, 0.5 + rnd() * 0.12);
      if (rnd() < 0.3) stab(rnd() < 0.5 ? 13 : 5, 0.3, 0.8);
      if (style === 'F') stab(0, 0.6, 5);
    } else if (style === 'B') {
      const order = [0, 1, 2, 1, 0, 1, 2, 1];
      order.forEach((idx, i) => {
        const step = i * 2;
        const v = voicing(step);
        const m = v[idx % v.length]! + (i === 6 ? 12 : 0);
        const vel = 0.5 + (i % 4 === 0 ? 0.1 : 0) + rnd() * 0.08;
        ev[step]!.push((t) => this.epiano(t, STEP * 3.5, m, vel, 1.2));
      });
    } else {
      stab(0, 0.42, 5);
      stab(6, 0.45);
      stab(14, 0.45);
    }

    /* ---- Organ pad ---- */
    if (style !== 'C' && !answer) {
      const halves = chordNames.length > 1 ? [0, 8] : [0];
      for (const s of halves) {
        const v = chordAt(s).slice(0, 3).map((pc) => place(pc, 60));
        const len = (halves.length > 1 ? 8 : 16) * STEP * 0.97;
        const vel = style === 'B' ? 0.42 : style === 'F' ? 0.5 : 0.32;
        ev[s]!.push((t) => this.organ(t, len, v, vel, false));
      }
    }

    /* ---- Bass ---- */
    const bassNote = (step: number, len: number, midi: number, vel: number, slide = false): void => {
      ev[step]!.push((t) => this.bass(t, len * STEP * 0.9, midi, vel, slide));
    };
    const root = (step: number): number => place(chordAt(step)[0]!, 38);
    const fifth = (step: number): number => {
      const r = root(step);
      const f = place(chordAt(step)[2]!, r);
      return f > 50 ? f - 12 : f;
    };
    const nextRoot = place(nextChord[0]!, 38);
    const approach = nextRoot + (rnd() < 0.6 ? -1 : 2);
    if (chordNames.length > 1) {
      bassNote(0, 3, root(0), 0.9);
      bassNote(6, 2, root(0) + 12, 0.6);
      bassNote(8, 3, root(8), 0.9, true);
      bassNote(14, 2, approach, 0.65);
    } else if (style === 'B') {
      bassNote(0, 6, root(0), 0.85);
      bassNote(8, 4, fifth(0), 0.7);
      bassNote(14, 2, approach, 0.6);
    } else if (style === 'C') {
      bassNote(0, 7, root(0), 0.85);
      bassNote(8, 2, root(0), 0.6);
      if (bar % 2 === 1) bassNote(12, 3, fifth(0), 0.6);
    } else if (rnd() < 0.6) {
      bassNote(0, 3, root(0), 0.95, rnd() < 0.3);
      bassNote(6, 1.5, root(0), 0.55);
      bassNote(8, 3, fifth(0), 0.8);
      bassNote(12, 2, root(0) + 12, 0.6);
      bassNote(14, 2, approach, 0.65);
    } else {
      bassNote(0, 3, root(0), 0.95);
      bassNote(4, 2, fifth(0), 0.6);
      bassNote(8, 3, root(0), 0.8);
      bassNote(11, 1, place(chordAt(0)[1]!, root(0)), 0.5);
      bassNote(12, 2, fifth(0), 0.7);
      bassNote(14, 2, approach, 0.65);
    }

    /* ---- Hand drums ---- */
    const drum = (step: number, e: Ev): void => {
      this.drumEvents.add(e);
      ev[step]!.push(e);
    };
    const pats = KENDANG[style];
    let pattern = pats[bar % pats.length]!;
    const fillHere = lastBar && style !== 'F';
    if (fillHere) pattern = pattern.slice(0, 8) + FILLS[Math.floor(rnd() * FILLS.length)]!;
    for (let s = 0; s < 16; s++) {
      let ch = pattern[s]!;
      // Light variation: drop or add ghost notes.
      if (ch === 'k' && rnd() < 0.2) ch = '.';
      else if (ch === '.' && s % 2 === 1 && style === 'A' && rnd() < 0.1) ch = 'k';
      if (ch === '.') continue;
      const crescendo = fillHere && s >= 8 ? 0.75 + 0.3 * ((s - 8) / 7) : 1;
      const vel = HIT_VEL[ch]! * crescendo * (0.88 + rnd() * 0.2);
      const hit = ch;
      drum(s, (t) => this.kendang(t + (this.rnd() - 0.5) * 0.006, hit, vel));
    }

    /* ---- Shaker and tambourine ---- */
    for (let s = 0; s < 16; s++) {
      const off8 = s % 4 === 2;
      const sixteenth = s % 2 === 1;
      if (style !== 'A' && style !== 'F' && sixteenth) continue;
      if (sixteenth && rnd() < 0.15) continue;
      const vel = (off8 ? 0.62 : sixteenth ? 0.22 : 0.36) * (0.85 + rnd() * 0.3) * (style === 'C' ? 0.7 : 1);
      ev[s]!.push((t) => this.shaker(t + (this.rnd() - 0.5) * 0.005, vel));
    }
    const tambs = style === 'A' || style === 'F' ? [4, 12] : style === 'B' ? [12] : [8];
    for (const s of tambs) ev[s]!.push((t) => this.tambourine(t, 0.6));

    /* ---- Terrace drum and claps ---- */
    const boom = (step: number, vel: number): void => void ev[step]!.push((t) => this.boom(t, vel));
    const clap = (step: number, vel: number): void => void ev[step]!.push((t) => this.clap(t, vel));
    if (style === 'C') {
      if (lastBar) {
        boom(0, 0.8); boom(2, 0.7); clap(4, 0.8);
        boom(8, 0.85); boom(10, 0.75); clap(12, 0.9);
      } else {
        boom(0, 0.85); boom(4, 0.8); clap(8, 0.85);
      }
    } else if (style === 'F') {
      boom(0, 1); boom(4, 0.8); clap(8, 0.9);
      if (bar === 3) { clap(10, 0.6); clap(12, 0.9); } else boom(12, 0.7);
    } else if (style === 'A') {
      if (bar % 4 === 3) { boom(0, 0.6); boom(4, 0.55); clap(8, 0.6); } else if (bar % 2 === 0) boom(0, 0.5);
    } else if (bar % 4 === 0) boom(0, 0.5);

    return ev;
  }

  /* -------------------------------------------------------------- */
  /* Instruments                                                     */
  /* -------------------------------------------------------------- */

  private voice(layer: Layer): Voice {
    return new Voice(this.rig, this.layers[layer], null, 1);
  }

  /**
   * Bamboo flute: mellow tone, breath at the front of the note, vibrato that
   * arrives late, and suling-style ornaments (slide in, grace flick, turn).
   */
  private flute(t: number, dur: number, midi: number, vel: number, slur: boolean, from?: number, grace?: number, turn?: number): void {
    const v = this.voice('flute');
    const f = mtof(midi);
    const end = t + dur + 0.14;
    const o1 = v.osc('triangle', f, t, end);
    const o2 = v.osc('sine', f * 2, t, end);
    for (const [o, mul] of [[o1, 1], [o2, 2]] as const) {
      const p = o.frequency;
      if (from !== undefined) {
        p.setValueAtTime(mtof(from) * mul, t);
        p.exponentialRampToValueAtTime(f * mul, t + Math.min(0.1, dur * 0.45));
      } else if (grace !== undefined) {
        p.setValueAtTime(mtof(grace) * mul, t);
        p.setValueAtTime(mtof(grace) * mul, t + 0.05);
        p.exponentialRampToValueAtTime(f * mul, t + 0.062);
      } else {
        p.setValueAtTime(f * mul * 0.984, t);
        p.exponentialRampToValueAtTime(f * mul, t + 0.05);
      }
      if (turn !== undefined) {
        // A quick upper-neighbour turn two thirds of the way through a long note.
        const tt = t + dur * 0.62;
        p.setValueAtTime(f * mul, tt);
        p.exponentialRampToValueAtTime(mtof(turn) * mul, tt + 0.012);
        p.setValueAtTime(mtof(turn) * mul, tt + 0.07);
        p.exponentialRampToValueAtTime(f * mul, tt + 0.082);
      }
    }
    if (dur > 0.3) {
      const lfo = v.osc('sine', 4.9 + this.rnd() * 0.7, t, end);
      const depth = v.gain(0);
      depth.gain.setValueAtTime(0, t + 0.14);
      depth.gain.linearRampToValueAtTime(f * 0.0075, t + 0.42);
      lfo.connect(depth).connect(o1.frequency);
      const depth2 = v.gain(2);
      depth.connect(depth2).connect(o2.frequency);
    }
    const lp = v.filter('lowpass', Math.min(5200, f * 4), 0.5);
    const amp = v.gain(0);
    adsr(amp.gain, t, dur, vel, slur ? 0.022 : 0.04, 0.8, 0.3, 0.11);
    o1.connect(lp);
    o2.connect(v.gain(0.3)).connect(lp);
    // Breath: a chiff at the start, then a faint air stream.
    const air = v.noise(t, end);
    const bp = v.filter('bandpass', Math.min(3800, f * 2), 1.3);
    const ag = v.gain(0);
    const chiff = vel * (slur ? 0.25 : 0.55);
    ag.gain.setValueAtTime(0, t);
    ag.gain.linearRampToValueAtTime(chiff, t + 0.018);
    ag.gain.exponentialRampToValueAtTime(vel * 0.07, t + 0.14);
    ag.gain.setValueAtTime(vel * 0.07, t + Math.max(0.15, dur));
    ag.gain.linearRampToValueAtTime(0, t + Math.max(0.15, dur) + 0.1);
    air.connect(bp).connect(ag).connect(lp);
    lp.connect(amp).connect(v.out);
    v.done();
  }

  /** Mellow FM electric piano: bark on the attack, round sustain, two detuned carriers. */
  private epiano(t: number, dur: number, midi: number, vel: number, ring = 1): void {
    const v = this.voice('keys');
    const f = mtof(midi);
    const end = t + dur + 0.2;
    const mod = v.osc('sine', f, t, end);
    const index = v.gain(0);
    index.gain.setValueAtTime(f * (0.6 + 1.5 * vel), t);
    index.gain.exponentialRampToValueAtTime(f * 0.22, t + 0.32);
    mod.connect(index);
    const amp = v.gain(0);
    adsr(amp.gain, t, dur, vel * 0.5, 0.004, 0, 0.55 * ring, 0.16);
    for (const det of [0.9985, 1.0015]) {
      const car = v.osc('sine', f * det, t, end);
      index.connect(car.frequency);
      car.connect(amp);
    }
    amp.connect(v.out);
    v.done();
  }

  /** Drawbar organ: `lead` adds a key click and a quicker attack for answering phrases. */
  private organ(t: number, dur: number, midis: number[], vel: number, lead: boolean): void {
    const v = this.voice('organ');
    const end = t + dur + 0.15;
    const amp = v.gain(0);
    adsr(amp.gain, t, dur, vel * (lead ? 0.5 : 0.36), lead ? 0.008 : 0.06, lead ? 0.75 : 1, 0.2, lead ? 0.07 : 0.12);
    const lp = v.filter('lowpass', lead ? 2600 : 1800, 0.5);
    for (const m of midis) {
      const o = v.osc('sine', mtof(m), t, end);
      o.setPeriodicWave(this.organWave);
      o.detune.value = (this.rnd() - 0.5) * 8;
      o.connect(lp);
    }
    lp.connect(amp).connect(v.out);
    if (lead) v.burst(t, { freq: 1800, q: 1, peak: vel * 0.12, decay: 0.012 });
    v.done();
  }

  /** Rounded bass with a little pluck from the filter and an optional slide up. */
  private bass(t: number, dur: number, midi: number, vel: number, slide: boolean): void {
    const v = this.voice('bass');
    const f = mtof(midi);
    const end = t + dur + 0.1;
    const lp = v.filter('lowpass', 900, 1.2);
    lp.frequency.setValueAtTime(350 + 900 * vel, t);
    lp.frequency.setTargetAtTime(240, t, 0.11);
    const amp = v.gain(0);
    adsr(amp.gain, t, dur, vel * 0.6, 0.008, 0.65, 0.22, 0.06);
    const tri = v.osc('triangle', f, t, end);
    const sub = v.osc('sine', f, t, end);
    for (const o of [tri, sub]) {
      o.frequency.setValueAtTime(f * (slide ? 0.89 : 0.985), t);
      o.frequency.exponentialRampToValueAtTime(f, t + (slide ? 0.07 : 0.02));
    }
    tri.connect(lp).connect(amp);
    sub.connect(v.gain(0.7)).connect(amp);
    amp.connect(v.out);
    v.done();
  }

  /** Kendang / tabla-style hand drums. The low "dut" bends upward under the palm. */
  private kendang(t: number, hit: string, vel: number): void {
    const v = this.voice('kendang');
    const d = 1 + (this.rnd() - 0.5) * 0.03;
    if (hit === 'D') {
      v.tone(t, 98 * d, vel, 0.34, { from: 64 * d, bendTime: 0.13, attack: 0.004 });
      v.burst(t, { type: 'lowpass', freq: 380, peak: vel * 0.6, decay: 0.04, pink: true });
      v.burst(t, { freq: 900, q: 1, peak: vel * 0.15, decay: 0.012 });
    } else if (hit === 'G') {
      v.tone(t, 147 * d, vel * 0.85, 0.27, { from: 168 * d, bendTime: 0.03 });
      v.tone(t, 234 * d, vel * 0.2, 0.12);
      v.burst(t, { freq: 520, q: 1, peak: vel * 0.3, decay: 0.02 });
    } else if (hit === 'T') {
      v.burst(t, { freq: 1850 * d, q: 1.4, peak: vel * 0.8, decay: 0.03 });
      v.tone(t, 410 * d, vel * 0.26, 0.045, { from: 520 * d, bendTime: 0.01 });
      v.burst(t, { freq: 3300, q: 1, peak: vel * 0.35, decay: 0.016 });
    } else if (hit === 'U') {
      v.tone(t, 293.7 * d, vel * 0.62, 0.2);
      v.tone(t, 587 * d, vel * 0.14, 0.09);
      v.burst(t, { freq: 950, q: 1, peak: vel * 0.2, decay: 0.01 });
    } else {
      v.burst(t, { freq: 1000 * d, q: 1.5, peak: vel * 0.5, decay: 0.02 });
      v.tone(t, 330 * d, vel * 0.14, 0.025);
    }
    v.done();
  }

  private shaker(t: number, vel: number): void {
    const v = this.voice('shaker');
    v.burst(t, { freq: 4600, q: 0.9, peak: vel * 1.6, attack: 0.012, decay: 0.11 });
    v.done();
  }

  private tambourine(t: number, vel: number): void {
    const v = this.voice('shaker');
    v.burst(t, { freq: 4200, q: 4, peak: vel, attack: 0.002, decay: 0.22 });
    v.burst(t, { freq: 5500, q: 5, peak: vel * 0.5, attack: 0.002, decay: 0.16 });
    v.burst(t, { freq: 1500, q: 1, peak: vel * 0.25, decay: 0.02 });
    v.done();
  }

  private boom(t: number, vel: number): void {
    const v = this.voice('terrace');
    bassDrum(v, t, vel, 0.55);
    v.done();
  }

  private clap(t: number, vel: number): void {
    const v = this.voice('terrace');
    claps(v, t, vel * 0.55, 5);
    v.done();
  }

  dispose(): void {
    for (const l of this.lfos) l.stop();
    for (const n of this.nodes) n.disconnect();
  }
}

/** Dip the music under a big effect, then let it back up. */
export function duck(rig: Rig, t: number, depth: number, hold: number): void {
  const g = rig.musicDuck.gain;
  g.setTargetAtTime(depth, t, 0.04);
  g.setTargetAtTime(1, t + hold, 0.4);
}
