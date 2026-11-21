/**
 * Audio bench: a button for every sound, plus an offline check that renders
 * each sound and the music through the real bus graph and measures level,
 * clipping, DC, spectral balance and clicks. `window.audioCheck()` returns
 * the table as data.
 */
import { Sound, type Scene } from '../src/client/audio';
import { Ambience } from '../src/client/audio/ambience';
import { createRig, mulberry32, type Rig } from '../src/client/audio/core';
import { Music, duck, validateSong } from '../src/client/audio/music';
import * as sfx from '../src/client/audio/sfx';
import { AimVoice, RollVoice } from '../src/client/audio/sfx';

const SR = 48000;

/* ------------------------------------------------------------------ */
/* Live buttons                                                        */
/* ------------------------------------------------------------------ */

const sound = new Sound();
const controls = document.getElementById('controls')!;

function group(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const d = document.createElement('div');
  controls.append(h, d);
  return d;
}

function button(parent: HTMLElement, label: string, fn: () => void): void {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => {
    sound.unlock();
    fn();
  };
  parent.append(b);
}

{
  const g = group('Mix');
  button(g, 'unlock', () => undefined);
  button(g, 'music on/off', () => sound.setMusic(!sound.musicOn));
  button(g, 'sfx on/off', () => sound.setSfx(!sound.sfxOn));
  for (const s of ['title', 'intro', 'play', 'card', 'final'] as Scene[]) button(g, `scene: ${s}`, () => sound.setScene(s));

  const b = group('Ball');
  for (const p of [0.1, 0.35, 0.65, 1]) button(b, `putt ${p}`, () => sound.putt(p));
  for (const m of ['board', 'concrete', 'cone', 'turnstile'] as const) {
    button(b, `${m} soft`, () => sound.bounce(3, m));
    button(b, `${m} hard`, () => sound.bounce(12, m));
  }
  button(b, 'bounce flurry', () => {
    let n = 0;
    const id = setInterval(() => {
      sound.bounce(2 + Math.random() * 10, (['board', 'concrete', 'cone', 'turnstile'] as const)[n % 4]!);
      if (++n > 40) clearInterval(id);
    }, 25);
  });
  button(b, 'land soft', () => sound.land(3));
  button(b, 'land hard', () => sound.land(11));
  for (const surf of ['turf', 'track', 'mud'] as const) {
    button(b, `roll ${surf}`, () => {
      const t0 = performance.now();
      const frame = (): void => {
        const t = (performance.now() - t0) / 1000;
        const speed = Math.max(0, 9 * Math.exp(-t * 0.9) - 0.3);
        sound.roll(speed, surf);
        if (speed > 0) requestAnimationFrame(frame);
      };
      frame();
    });
  }
  button(b, 'aim drag', () => {
    const t0 = performance.now();
    const frame = (): void => {
      const t = (performance.now() - t0) / 1000;
      if (t > 2.2) return sound.aim(null);
      sound.aim(Math.min(1, t / 1.6));
      requestAnimationFrame(frame);
    };
    frame();
  });

  const r = group('Results');
  button(r, 'cupDrop', () => sound.cupDrop());
  for (const [label, vs, ace] of [['over', 2, false], ['par', 0, false], ['birdie', -1, false], ['eagle', -2, false], ['hole in one', -2, true]] as const) {
    button(r, `cup + ${label}`, () => {
      sound.cupDrop();
      sound.holed(vs, ace);
      if (vs < 0) sound.cheer(ace ? 1 : vs === -2 ? 0.7 : 0.4);
    });
  }
  button(r, 'out', () => sound.out());
  button(r, 'splash', () => sound.splash());
  button(r, 'cheer 0.3', () => sound.cheer(0.3));
  button(r, 'cheer 1', () => sound.cheer(1));

  const w = group('World');
  button(w, 'boost', () => sound.boost());
  button(w, 'tunnel', () => sound.tunnel());
  button(w, 'pickup', () => sound.pickup());
  for (const k of ['drum', 'sandal', 'swap', 'peanuts'] as const) button(w, `item ${k}`, () => sound.item(k));
  for (const k of ['start', 'end', 'full'] as const) button(w, `whistle ${k}`, () => sound.whistle(k));

  const u = group('Interface');
  button(u, 'countdown 10..0', () => {
    let s = 10;
    sound.tick(s);
    const id = setInterval(() => {
      sound.tick(--s);
      if (s <= 0) clearInterval(id);
    }, 1000);
  });
  for (const k of ['hover', 'click', 'toggle'] as const) button(u, `ui ${k}`, () => sound.ui(k));
  button(u, 'score count x8', () => {
    let n = 0;
    const id = setInterval(() => {
      sound.scoreCount();
      if (++n >= 8) clearInterval(id);
    }, 110);
  });
}

/* ------------------------------------------------------------------ */
/* Offline rendering                                                   */
/* ------------------------------------------------------------------ */

interface Case {
  name: string;
  kind: 'sfx' | 'loop' | 'music' | 'amb' | 'mix';
  seconds: number;
  build: (rig: Rig, ctx: OfflineAudioContext) => void;
}

/**
 * Run `fn` every `every` seconds of rendered time, the way the live pump
 * does, so node counts (and so render cost) match real playback.
 */
function stepped(ctx: OfflineAudioContext, seconds: number, fn: (now: number, until: number) => void, every = 0.25): void {
  fn(0, every + 0.3);
  for (let t = every; t < seconds; t += every) {
    void ctx.suspend(t).then(() => {
      fn(t, t + every + 0.3);
      void ctx.resume();
    });
  }
}

const one = (name: string, fn: (rig: Rig, t: number) => number, seconds = 3.2): Case => ({
  name, kind: 'sfx', seconds, build: (rig) => void fn(rig, 0.05),
});

function musicCase(name: string, scene: 'title' | 'play' | 'card', seconds: number): Case {
  return {
    name, kind: 'music', seconds,
    build: (rig, ctx) => {
      const m = new Music(rig, 0.05, scene, 4242);
      stepped(ctx, seconds, (now, until) => m.pump(now, until));
    },
  };
}

const cases: Case[] = [
  one('putt 0.1', (r, t) => sfx.putt(r, t, 0.1)),
  one('putt 0.5', (r, t) => sfx.putt(r, t, 0.5)),
  one('putt 1.0', (r, t) => sfx.putt(r, t, 1)),
  one('bounce board 3', (r, t) => sfx.bounce(r, t, 3, 'board')),
  one('bounce board 12', (r, t) => sfx.bounce(r, t, 12, 'board')),
  one('bounce concrete 12', (r, t) => sfx.bounce(r, t, 12, 'concrete')),
  one('bounce cone 12', (r, t) => sfx.bounce(r, t, 12, 'cone')),
  one('bounce turnstile 12', (r, t) => sfx.bounce(r, t, 12, 'turnstile')),
  one('land 3', (r, t) => sfx.land(r, t, 3)),
  one('land 11', (r, t) => sfx.land(r, t, 11)),
  one('cupDrop', (r, t) => sfx.cupDrop(r, t)),
  one('holed over', (r, t) => sfx.holed(r, t, 2, false), 4),
  one('holed par', (r, t) => sfx.holed(r, t, 0, false), 4),
  one('holed birdie', (r, t) => sfx.holed(r, t, -1, false), 4.5),
  one('holed eagle', (r, t) => sfx.holed(r, t, -2, false), 5),
  one('holed ace', (r, t) => sfx.holed(r, t, -2, true), 5.5),
  one('out', (r, t) => sfx.out(r, t), 5),
  one('splash', (r, t) => sfx.splash(r, t), 4),
  one('boost', (r, t) => sfx.boost(r, t)),
  one('tunnel', (r, t) => sfx.tunnel(r, t), 4),
  one('pickup', (r, t) => sfx.pickup(r, t)),
  one('item drum', (r, t) => sfx.item(r, t, 'drum'), 4.5),
  one('item sandal', (r, t) => sfx.item(r, t, 'sandal')),
  one('item swap', (r, t) => sfx.item(r, t, 'swap'), 4),
  one('item peanuts', (r, t) => sfx.item(r, t, 'peanuts'), 4),
  one('whistle start', (r, t) => sfx.whistle(r, t, 'start'), 4),
  one('whistle end', (r, t) => sfx.whistle(r, t, 'end'), 4.5),
  one('whistle full', (r, t) => sfx.whistle(r, t, 'full'), 6.5),
  one('tick 10', (r, t) => sfx.tick(r, t, 10), 2),
  one('tick 1', (r, t) => sfx.tick(r, t, 1), 2),
  one('tick 0', (r, t) => sfx.tick(r, t, 0), 2.5),
  one('ui hover', (r, t) => sfx.ui(r, t, 'hover'), 1),
  one('ui click', (r, t) => sfx.ui(r, t, 'click'), 2),
  one('ui toggle', (r, t) => sfx.ui(r, t, 'toggle'), 2),
  one('scoreCount', (r, t) => sfx.scoreCount(r, t, 3), 2.5),
  one('aimTick', (r, t) => sfx.aimTick(r, t, 6), 1),
  one('cheer 0.3', (r, t) => sfx.cheer(r, t, 0.3), 6),
  one('cheer 1', (r, t) => sfx.cheer(r, t, 1), 7),
  ...(['turf', 'track', 'mud'] as const).map((surface): Case => ({
    name: `roll ${surface}`, kind: 'loop', seconds: 4,
    build: (rig) => {
      const roll = new RollVoice(rig);
      for (let t = 0.05; t < 3.6; t += 1 / 60) roll.set(Math.max(0, 9 * Math.exp(-t * 0.9) - 0.4), surface, t);
    },
  })),
  {
    name: 'roll turf steady 6', kind: 'loop', seconds: 3,
    build: (rig) => {
      const roll = new RollVoice(rig);
      for (let t = 0.05; t < 2.6; t += 1 / 60) roll.set(6, 'turf', t);
      roll.set(0, 'turf', 2.6);
    },
  },
  {
    name: 'aim drag', kind: 'loop', seconds: 3,
    build: (rig) => {
      const aim = new AimVoice(rig);
      let notch = -1;
      for (let t = 0.05; t < 2.2; t += 1 / 60) {
        const p = Math.min(1, t / 1.6);
        aim.set(p, t);
        const n = Math.floor(p * 12);
        if (n !== notch && notch !== -1) sfx.aimTick(rig, t, n);
        notch = n;
      }
      aim.set(null, 2.2);
    },
  },
  {
    name: 'ambience 60s', kind: 'amb', seconds: 60,
    build: (rig, ctx) => {
      const a = new Ambience(rig, 0.05, 777);
      stepped(ctx, 60, (_now, until) => a.pump(until));
    },
  },
  musicCase('music play 100s', 'play', 100),
  musicCase('music title 40s', 'title', 40),
  musicCase('music card 40s', 'card', 40),
  {
    name: 'music scenes 50s', kind: 'music', seconds: 50,
    build: (rig, ctx) => {
      const m = new Music(rig, 0.05, 'title', 99);
      const cues: Array<[number, 'intro' | 'play' | 'card' | 'final']> = [[6, 'intro'], [10, 'play'], [24, 'card'], [33, 'final']];
      stepped(ctx, 50, (now, until) => {
        while (cues.length && cues[0]![0] <= now) m.setScene(cues.shift()![1]);
        m.pump(now, until);
      });
    },
  },
  {
    name: 'mix: worst case', kind: 'mix', seconds: 14,
    build: (rig, ctx) => {
      const m = new Music(rig, 0.05, 'play', 5);
      const a = new Ambience(rig, 0.05, 3);
      stepped(ctx, 14, (now, until) => {
        m.pump(now, until);
        a.pump(until);
      });
      const roll = new RollVoice(rig);
      for (let t = 0.05; t < 13; t += 1 / 30) roll.set(8, 'track', t);
      sfx.putt(rig, 2, 1);
      for (let i = 0; i < 6; i++) sfx.bounce(rig, 3 + i * 0.04, 12, (['board', 'turnstile', 'cone', 'concrete'] as const)[i % 4]!);
      sfx.item(rig, 5, 'drum');
      duck(rig, 5, 0.4, 0.7);
      sfx.cupDrop(rig, 7);
      sfx.holed(rig, 7.28, -2, true);
      sfx.cheer(rig, 7.3, 1);
      sfx.whistle(rig, 9.5, 'full');
      duck(rig, 9.5, 0.35, 2.4);
    },
  },
];

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!; re[i] = re[j]!; re[j] = tr;
      const ti = im[i]!; im[i] = im[j]!; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi;
        re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** A-weighting as a power gain, so levels can be compared the way ears do. */
function aWeight(f: number): number {
  const f2 = f * f;
  const a = (148693636 * f2 * f2) / ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148693636));
  return a * a * 1.585;
}

const toDb = (v: number): number => (v > 1e-9 ? 20 * Math.log10(v) : -180);
const r1 = (v: number): number => Math.round(v * 10) / 10;

export interface Row {
  name: string;
  kind: string;
  peakDb: number;
  /** Loudest 100 ms window (RMS, dBFS). */
  loudDb: number;
  /** RMS of everything above the -55 dB gate. */
  rmsDb: number;
  /** A-weighted: loudest 85 ms frame, and the mean of frames above -60 dB(A). */
  loudA: number;
  avgA: number;
  dc: number;
  clipped: number;
  /** Seconds from first to last sample above -60 dBFS. */
  dur: number;
  /** Share of energy: below 200 Hz, 200-2k, 2k-6k, above 6k. */
  low: number; mid: number; himid: number; high: number;
  centroid: number;
  /** Strongest single 12 Hz bin: frequency and share of total energy. */
  toneHz: number; tonePct: number;
  /** Isolated-jump detector (see below) and where it fired. */
  click: number; clickAt: number;
  /** |first sample|, |last sample| of the render. */
  edge: number;
  renderMs: number;
}

function analyse(c: Case, buf: AudioBuffer, renderMs: number): Row {
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const n = L.length;
  const mono = new Float32Array(n);
  let peak = 0, sum = 0, clipped = 0, first = -1, last = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]!), Math.abs(R[i]!));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    if (a > 0.001) {
      if (first < 0) first = i;
      last = i;
    }
    const m = (L[i]! + R[i]!) * 0.5;
    mono[i] = m;
    sum += m;
  }
  // Windowed RMS (per channel power averaged).
  const win = Math.floor(SR * 0.1);
  let loud = 0, gatedSum = 0, gatedN = 0;
  for (let s = 0; s + win <= n; s += win >> 1) {
    let p = 0;
    for (let i = s; i < s + win; i++) p += (L[i]! * L[i]! + R[i]! * R[i]!) * 0.5;
    p /= win;
    if (p > loud) loud = p;
    if (p > 3.2e-6) {
      gatedSum += p;
      gatedN++;
    }
  }
  // Spectrum.
  const N = 4096;
  const power = new Float64Array(N / 2);
  const re = new Float32Array(N), im = new Float32Array(N);
  const aw = new Float64Array(N / 2);
  for (let k = 1; k < N / 2; k++) aw[k] = aWeight((k * SR) / N);
  let loudA = 0, sumA = 0, nA = 0;
  for (let s = 0; s + N <= n; s += N / 4) {
    for (let i = 0; i < N; i++) {
      re[i] = mono[s + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      im[i] = 0;
    }
    fft(re, im);
    let frameA = 0;
    for (let k = 1; k < N / 2; k++) {
      const p = re[k]! * re[k]! + im[k]! * im[k]!;
      power[k] = power[k]! + p;
      frameA += p * aw[k]!;
    }
    // Parseval with the Hann window's power (3/8 N).
    frameA = (2 * frameA) / (N * N * 0.375);
    if (frameA > loudA) loudA = frameA;
    if (frameA > 1e-6) {
      sumA += frameA;
      nA++;
    }
  }
  let total = 0, low = 0, mid = 0, himid = 0, high = 0, cent = 0, top = 0, topK = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * SR) / N;
    const p = power[k]!;
    total += p;
    cent += p * f;
    if (f < 200) low += p;
    else if (f < 2000) mid += p;
    else if (f < 6000) himid += p;
    else high += p;
    if (p > top) {
      top = p;
      topK = k;
    }
  }
  total = total || 1;
  // Click detector: a sample-to-sample jump that towers over its neighbours'
  // jumps is a discontinuity; an enveloped noise burst is not.
  let click = 0, clickAt = 0;
  for (let i = 9; i < n - 9; i++) {
    const d = Math.abs(mono[i]! - mono[i - 1]!);
    if (d < 0.003) continue;
    let around = 0;
    for (let k = -8; k <= 8; k++) if (k !== 0) around += Math.abs(mono[i + k]! - mono[i + k - 1]!);
    const ratio = d / (around / 16 + 1e-4);
    if (ratio > click) {
      click = ratio;
      clickAt = i / SR;
    }
  }
  return {
    name: c.name, kind: c.kind,
    peakDb: r1(toDb(peak)), loudDb: r1(toDb(Math.sqrt(loud))),
    rmsDb: r1(toDb(Math.sqrt(gatedN ? gatedSum / gatedN : 0))),
    loudA: r1(toDb(Math.sqrt(loudA))), avgA: r1(toDb(Math.sqrt(nA ? sumA / nA : 0))),
    dc: Math.round((sum / n) * 1e5) / 1e5, clipped,
    dur: Math.round(((last - Math.max(0, first)) / SR) * 100) / 100,
    low: r1((low / total) * 100), mid: r1((mid / total) * 100), himid: r1((himid / total) * 100), high: r1((high / total) * 100),
    centroid: Math.round(cent / total),
    toneHz: Math.round((topK * SR) / N), tonePct: r1((top / total) * 100),
    click: r1(click), clickAt: Math.round(clickAt * 1000) / 1000,
    edge: Math.round(Math.max(Math.abs(mono[0]!), Math.abs(mono[n - 1]!)) * 1e4) / 1e4,
    renderMs: Math.round(renderMs),
  };
}

async function render(c: Case): Promise<Row> {
  const ctx = new OfflineAudioContext(2, Math.floor(SR * c.seconds), SR);
  const rig = createRig(ctx, mulberry32(12345));
  c.build(rig, ctx);
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return analyse(c, buf, performance.now() - t0);
}

async function audioCheck(filter?: string): Promise<{ song: ReturnType<typeof validateSong>; rows: Row[] }> {
  const song = validateSong();
  const rows: Row[] = [];
  const status = document.getElementById('status')!;
  for (const c of cases) {
    if (filter && !c.name.includes(filter)) continue;
    status.textContent = `rendering ${c.name}...`;
    rows.push(await render(c));
  }
  status.textContent = `done - song is ${song.bars} bars, ${song.seconds.toFixed(1)} s per pass`;
  show(rows);
  return { song, rows };
}

function show(rows: Row[]): void {
  const cols: Array<keyof Row> = ['name', 'kind', 'peakDb', 'loudDb', 'rmsDb', 'loudA', 'avgA', 'dc', 'clipped', 'dur', 'low', 'mid', 'himid', 'high', 'centroid', 'toneHz', 'tonePct', 'click', 'clickAt', 'edge', 'renderMs'];
  const table = document.createElement('table');
  table.innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`;
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const c of cols) {
      const td = document.createElement('td');
      td.textContent = String(r[c]);
      if (c === 'clipped' && r.clipped > 0) td.className = 'bad';
      if (c === 'peakDb' && r.peakDb > -1) td.className = 'bad';
      if (c === 'high' && r.high > 12) td.className = 'warn';
      if (c === 'click' && r.click > 12) td.className = 'warn';
      if (c === 'dc' && Math.abs(r.dc) > 0.002) td.className = 'warn';
      tr.append(td);
    }
    table.append(tr);
  }
  document.getElementById('report')!.replaceChildren(table);
}

/** Compact text table for reading the results from a console or a tool. */
function audioCheckText(rows: Row[]): string {
  return rows
    .map((r) => `${r.name}: pk ${r.peakDb} rms ${r.rmsDb} A ${r.loudA}/${r.avgA} dc ${r.dc} clip ${r.clipped} dur ${r.dur} | ${r.low}/${r.mid}/${r.himid}/${r.high} c${r.centroid} t${r.toneHz}:${r.tonePct}% | k${r.click} e${r.edge} ${r.renderMs}ms`)
    .join('\n');
}

Object.assign(window, { audioCheck, audioCheckText, sound });
document.getElementById('run')!.onclick = () => void audioCheck();

// audio.html?auto[=filter] runs the check on load and prints the compact table.
const auto = new URLSearchParams(location.search).get('auto');
if (auto !== null) {
  controls.style.display = 'none';
  void audioCheck(auto || undefined).then(({ rows }) => {
    const pre = document.createElement('pre');
    pre.id = 'compact';
    pre.textContent = audioCheckText(rows);
    document.getElementById('report')!.replaceChildren(pre);
  });
}
