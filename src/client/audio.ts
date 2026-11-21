/**
 * All of the game's sound, synthesised in the browser: no audio files.
 *
 *   audio/core.ts      bus graph, stadium reverb, noise buffers, voice helper
 *   audio/sfx.ts       every sound effect + the rolling and aiming voices
 *   audio/ambience.ts  the empty stadium at night
 *   audio/music.ts     the score and its sequencer
 *
 * This file is the only thing the game talks to. Nothing makes a sound until
 * `unlock()` has been called from a click or key press.
 */
import type { ItemKind } from '../shared/protocol';
import { Ambience } from './audio/ambience';
import { LEVELS, createRig, type Rig } from './audio/core';
import { Music, duck } from './audio/music';
import * as sfx from './audio/sfx';
import { AimVoice, RollVoice, type HitMaterial, type Surface } from './audio/sfx';

export type { HitMaterial, Surface } from './audio/sfx';
export type Scene = 'title' | 'intro' | 'play' | 'card' | 'final';

/** How far ahead of the audio clock notes are scheduled. */
const LOOKAHEAD = 0.3;
/** Browsers slow timers to about one a second in a hidden tab. */
const LOOKAHEAD_HIDDEN = 1.8;
const PUMP_MS = 50;
const MAX_BOUNCES = 6;
const AIM_NOTCHES = 12;

export class Sound {
  private ctx: AudioContext | null = null;
  private rig: Rig | null = null;
  private music: Music | null = null;
  private amb: Ambience | null = null;
  private rollVoice: RollVoice | null = null;
  private aimVoice: AimVoice | null = null;

  private _musicOn = true;
  private _sfxOn = true;
  private scene: Scene = 'title';

  private early = 0;
  private lastBounce = -1;
  private readonly lastByMaterial: Record<HitMaterial, number> = { board: -1, concrete: -1, cone: -1, turnstile: -1 };
  private bounceEnds: number[] = [];
  private lastRoll = -1;
  private rolling = false;
  private aimNotch = -1;
  private countStep = 0;
  private lastCount = -10;
  private lastHover = -1;

  get musicOn(): boolean {
    return this._musicOn;
  }

  get sfxOn(): boolean {
    return this._sfxOn;
  }

  /** Call from a click/key handler; creates/resumes the AudioContext. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = (this.ctx = new AudioContext({ latencyHint: 'interactive' }));
      const rig = (this.rig = createRig(ctx));
      const t = ctx.currentTime;
      if (!this._sfxOn) {
        for (const g of [rig.sfx, rig.sfxWet, rig.amb, rig.ambWet]) g.gain.value = 0;
      }
      this.rollVoice = new RollVoice(rig);
      this.aimVoice = new AimVoice(rig);
      this.amb = new Ambience(rig, t + 0.05);
      this.amb.setScene(this.scene, t + 0.05);
      this.music = new Music(rig, t + 0.25, this.scene);
      if (this.scene === 'final') this.music.setScene('final');
      if (!this._musicOn) this.music.setOutput(0, t, 0.001);
      setInterval(() => this.pump(), PUMP_MS);
      this.pump();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  /** Music only; the ambience bed follows the sound-effects switch. */
  setMusic(on: boolean): void {
    if (on === this._musicOn) return;
    this._musicOn = on;
    if (!this.ctx || !this.music) return;
    const t = this.ctx.currentTime;
    if (on) {
      this.music.restart(t + 0.15);
      this.music.setOutput(LEVELS.music, t, 0.3);
      this.pump();
    } else {
      this.music.setOutput(0, t, 0.12);
    }
  }

  setSfx(on: boolean): void {
    if (on === this._sfxOn) return;
    this._sfxOn = on;
    const rig = this.rig;
    if (!rig) return;
    const t = rig.ctx.currentTime;
    rig.sfx.gain.setTargetAtTime(on ? LEVELS.sfx : 0, t, 0.05);
    rig.sfxWet.gain.setTargetAtTime(on ? 1 : 0, t, 0.05);
    rig.amb.gain.setTargetAtTime(on ? LEVELS.amb : 0, t, 0.3);
    rig.ambWet.gain.setTargetAtTime(on ? 1 : 0, t, 0.3);
  }

  /** Which screen we are on. Drives music arrangement/intensity and ambience. */
  setScene(scene: Scene): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.music?.setScene(scene);
    if (this.ctx) this.amb?.setScene(scene, this.ctx.currentTime);
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const until = now + (document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
    if (this._musicOn) this.music?.pump(now, until);
    if (this._sfxOn) this.amb?.pump(until);
  }

  /** The rig and a start time, or null if effects cannot play right now. */
  private live(): [Rig, number] | null {
    const ctx = this.ctx;
    if (!ctx || !this.rig || !this._sfxOn) return null;
    if (ctx.state !== 'running') {
      // Let the very first click through while the context is still starting;
      // after that, drop calls rather than have them all fire on resume.
      if (ctx.currentTime > 0 || this.early++ > 3) return null;
    }
    return [this.rig, ctx.currentTime + 0.003];
  }

  private duck(t: number, depth: number, hold: number): void {
    if (this.rig && this._musicOn) duck(this.rig, t, depth, hold);
  }

  /** Putter striking the ball, power 0..1. */
  putt(power: number, gain = 1): void {
    const l = this.live();
    if (l) sfx.putt(l[0], l[1], power, gain);
  }

  /** Speed into the surface, ~1..16. Rate-limited; at most a few ring at once. */
  bounce(speed: number, material: HitMaterial, gain = 1): void {
    const l = this.live();
    if (!l) return;
    const [rig, t] = l;
    if (t - this.lastBounce < 0.035 || t - this.lastByMaterial[material] < 0.07) return;
    this.bounceEnds = this.bounceEnds.filter((end) => end > t);
    // When busy, only let clearly audible hits through.
    if (this.bounceEnds.length >= MAX_BOUNCES || (this.bounceEnds.length >= 3 && speed < 2)) return;
    this.lastBounce = t;
    this.lastByMaterial[material] = t;
    // Count a voice as "busy" for its loud part only, not its whole tail.
    sfx.bounce(rig, t, speed, material, gain);
    this.bounceEnds.push(t + 0.14);
  }

  /** Ball dropping onto turf from a ledge, speed ~2..12. */
  land(speed: number, gain = 1): void {
    const l = this.live();
    if (l) sfx.land(l[0], l[1], speed, gain);
  }

  /** Called EVERY FRAME for the player's own ball: continuous rolling sound. speed 0 = silent. */
  roll(speed: number, surface: Surface): void {
    const ctx = this.ctx;
    if (!ctx || !this.rollVoice) return;
    const moving = speed > 0.04 && surface !== 'air';
    if (!moving && !this.rolling) return;
    const t = ctx.currentTime;
    if (moving && t - this.lastRoll < 0.03) return;
    this.lastRoll = t;
    this.rolling = moving;
    this.rollVoice.set(moving ? speed : 0, surface, t);
  }

  /** Called every frame while the player drags to aim (power 0..1), null when not aiming. */
  aim(power: number | null): void {
    const ctx = this.ctx;
    if (!ctx || !this.aimVoice) return;
    if (power === null) {
      if (this.aimNotch !== -1) {
        this.aimNotch = -1;
        this.aimVoice.set(null, ctx.currentTime);
      }
      return;
    }
    const notch = Math.min(AIM_NOTCHES, Math.floor(power * AIM_NOTCHES));
    if (notch === this.aimNotch) return;
    const first = this.aimNotch === -1;
    this.aimNotch = notch;
    this.aimVoice.set(power, ctx.currentTime);
    const l = this.live();
    if (l && !first) sfx.aimTick(l[0], l[1], notch);
  }

  /** Ball rattling down into the plastic cup. */
  cupDrop(gain = 1): void {
    const l = this.live();
    if (l) sfx.cupDrop(l[0], l[1], gain);
  }

  /** Short musical sting scaled by result: <=-2 eagle, -1 birdie, 0 par, >0 over. */
  holed(vsPar: number, holeInOne: boolean, gain = 1): void {
    const l = this.live();
    if (!l) return;
    const big = holeInOne || vsPar <= -2;
    // Sits just after the cup rattle.
    sfx.holed(l[0], l[1] + 0.28, vsPar, holeInOne, gain);
    if (gain > 0.6) this.duck(l[1] + 0.2, big ? 0.4 : 0.55, big ? 1.6 : 0.8);
  }

  /** Fell off the edge: falling whoosh + thud far below + penalty cue. */
  out(gain = 1): void {
    const l = this.live();
    if (l) sfx.out(l[0], l[1], gain);
  }

  splash(gain = 1): void {
    const l = this.live();
    if (l) sfx.splash(l[0], l[1], gain);
  }

  boost(gain = 1): void {
    const l = this.live();
    if (l) sfx.boost(l[0], l[1], gain);
  }

  tunnel(gain = 1): void {
    const l = this.live();
    if (l) sfx.tunnel(l[0], l[1], gain);
  }

  pickup(gain = 1): void {
    const l = this.live();
    if (l) sfx.pickup(l[0], l[1], gain);
  }

  item(kind: ItemKind, gain = 1): void {
    const l = this.live();
    if (!l) return;
    sfx.item(l[0], l[1], kind, gain);
    if (kind === 'drum' && gain > 0.6) this.duck(l[1], 0.4, 0.7);
  }

  /** Referee whistle: one blast / double / the long triple full-time blast. */
  whistle(kind: 'start' | 'end' | 'full'): void {
    const l = this.live();
    if (!l) return;
    sfx.whistle(l[0], l[1], kind);
    if (kind === 'full') this.duck(l[1], 0.35, 2.4);
    else this.duck(l[1], 0.6, kind === 'end' ? 0.8 : 0.45);
  }

  /** Countdown tick for the last 10 s, more urgent toward 0. */
  tick(secondsLeft: number): void {
    const l = this.live();
    if (l) sfx.tick(l[0], l[1], secondsLeft);
  }

  ui(kind: 'hover' | 'click' | 'toggle'): void {
    const l = this.live();
    if (!l) return;
    if (kind === 'hover') {
      if (l[1] - this.lastHover < 0.05) return;
      this.lastHover = l[1];
    }
    sfx.ui(l[0], l[1], kind);
  }

  /** Small tick used while the scorecard reveals numbers; climbs a scale over a run. */
  scoreCount(): void {
    const l = this.live();
    if (!l) return;
    if (l[1] - this.lastCount > 0.7) this.countStep = 0;
    this.lastCount = l[1];
    sfx.scoreCount(l[0], l[1], this.countStep++);
  }

  /** 0..1, a small ghostly memory of the crowd for great shots. */
  cheer(size: number, gain = 1): void {
    const l = this.live();
    if (l) sfx.cheer(l[0], l[1], size, gain);
  }
}
