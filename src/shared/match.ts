import { planPutt } from './bots';
import {
  DRUM_PUSH,
  DRUM_RADIUS,
  HOLE_END_SECONDS,
  JITTER_SCALE,
  LAST_PLAYER_SECONDS,
  INTRO_SECONDS,
  MAX_ITEMS,
  MAX_PLAYERS,
  MAX_PUTT,
  MIN_PUTT,
  PICKUP_R,
  PICKUP_RESPAWN_SECONDS,
  STEADY_PUTTS,
  SWAY_ANGLE,
  TICK_RATE,
  holeSeconds,
  penaltyScore,
  strokeCap,
} from './constants';
import { HoleDef, Level, compileLevel, floorAt } from './level';
import { isMoving, nearSpinner, stepBall } from './physics';
import { ClientMsg, GameEvent, ITEM_KINDS, ItemKind, MatchState, PlayerState } from './protocol';

// The people still in the stadium after the match.
const BOT_NAMES = ['Pak Slamet', 'Mbak Rini', 'Dimas', 'Bu Yanti', 'Mas Agus', 'Wawan', 'Sari'];

/**
 * The rules of the game. It owns the only true copy of the state, takes
 * commands from players and moves forward one tick at a time. It knows
 * nothing about rendering, input or networking.
 */
export class Match {
  readonly state: MatchState;
  levels: Level[];
  private events: GameEvent[] = [];
  private nextColor = 0;

  constructor(holes: HoleDef[], seed: number, course = '') {
    this.levels = holes.map(compileLevel);
    this.state = {
      phase: 'lobby',
      course,
      hole: 0,
      holeCount: holes.length,
      tick: 0,
      timer: 0,
      players: [],
      pickups: [],
      rng: seed >>> 0 || 1,
    };
  }

  /** Swap in another course. Only between rounds. */
  load(holes: HoleDef[], course: string): void {
    const s = this.state;
    if (s.phase !== 'lobby' && s.phase !== 'final') return;
    this.levels = holes.map(compileLevel);
    s.course = course;
    s.holeCount = holes.length;
    s.hole = 0;
    for (const p of s.players) this.placeOnTee(p);
  }

  /** Par of the hole being played. */
  private get par(): number {
    return this.level.def.par;
  }

  get level(): Level {
    return this.levels[this.state.hole];
  }

  player(id: string): PlayerState | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  addPlayer(id: string, name: string, bot = false): PlayerState | null {
    if (this.state.players.length >= MAX_PLAYERS || this.player(id)) return null;
    const p: PlayerState = {
      id,
      name: cleanName(name),
      color: this.nextColor++ % MAX_PLAYERS,
      bot,
      ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0 },
      moving: false,
      restX: 0,
      restY: 0,
      restZ: 0,
      strokes: 0,
      holed: false,
      done: false,
      ready: false,
      scores: [],
      items: [],
      stats: { falls: 0, hits: 0, items: 0, aces: 0, air: 0 },
      park: [0, 0, 0],
      steady: 0,
      jitters: 0,
      magnet: false,
      wait: 0,
    };
    this.state.players.push(p);
    this.placeOnTee(p);
    // Someone who walks in mid-match takes the penalty score for holes already played.
    for (let i = 0; i < this.playedHoles(); i++) p.scores.push(penaltyScore(this.levels[i].def.par));
    return p;
  }

  removePlayer(id: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== id);
  }

  /** Start a fresh round with this many bots filling seats. */
  start(bots: number): void {
    const s = this.state;
    s.players = s.players.filter((p) => !p.bot);
    const wanted = Math.max(0, Math.min(Math.floor(bots) || 0, MAX_PLAYERS - s.players.length));
    for (let i = 0; i < wanted; i++) this.addPlayer(`bot${i + 1}`, BOT_NAMES[i % BOT_NAMES.length], true);
    for (const p of s.players) {
      p.scores = [];
      p.items = [];
      p.stats = { falls: 0, hits: 0, items: 0, aces: 0, air: 0 };
    }
    this.beginHole(0);
  }

  /** A command from a player. Bad or badly timed commands are ignored. */
  command(id: string, msg: ClientMsg): void {
    const p = this.player(id);
    if (!p) return;
    if (msg.t === 'putt') this.putt(p, msg.dx, msg.dy);
    else if (msg.t === 'item') this.useItem(p, msg.slot);
    else if (msg.t === 'ready' && this.state.phase === 'holeEnd') p.ready = true;
    else if (msg.t === 'reset') this.reset(p);
  }

  /** Move forward one tick. Returns what happened, for sound and effects. */
  step(): GameEvent[] {
    const s = this.state;
    s.tick++;

    if (s.phase === 'intro') {
      if (--s.timer <= 0) this.setPhase('playing', holeSeconds(this.par));
    } else if (s.phase === 'playing') {
      this.stepPlaying();
    } else if (s.phase === 'holeEnd') {
      const humans = s.players.filter((p) => !p.bot);
      const allReady = humans.length > 0 && humans.every((p) => p.ready);
      if (--s.timer <= 0 || allReady) {
        if (s.hole + 1 < s.holeCount) this.beginHole(s.hole + 1);
        else this.setPhase('final', 0);
      }
    }

    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------------------------------------------------------------- rules

  private stepPlaying(): void {
    const s = this.state;
    const L = this.level;

    for (const p of s.players) {
      if (p.done) continue;

      // A ball at rest is left alone unless a turnstile arm can reach it.
      if (p.moving || nearSpinner(L, p.ball)) {
        const b = p.ball;
        const from = { x: b.x, y: b.y };
        const r = stepBall(L, b, s.tick, p.magnet);
        if (r.oob) {
          this.events.push({ t: 'out', p: p.id, x: b.x, y: b.y, z: b.z, water: r.splash });
          p.strokes++;
          p.stats.falls++;
          this.placeAt(p, p.restX, p.restY, p.restZ);
        } else if (r.holed) {
          this.placeAt(p, L.cup.x, L.cup.y, L.cup.z);
          this.finish(p, true);
          if (p.strokes === 1) p.stats.aces++;
          this.events.push({ t: 'holed', p: p.id, strokes: p.strokes });
          continue;
        } else {
          if (r.impact > 0.8) {
            p.stats.hits++;
            this.events.push({ t: 'bounce', p: p.id, v: r.impact, m: r.material, x: b.x, y: b.y });
          }
          if (r.surface === 'air') p.stats.air++;
          if (r.landed > 0) this.events.push({ t: 'land', p: p.id, v: r.landed });
          if (r.tunnel) this.events.push({ t: 'tunnel', p: p.id, x: from.x, y: from.y });
          if (r.boost) this.events.push({ t: 'boost', p: p.id });
          if (r.hop) this.events.push({ t: 'hop', p: p.id });
          if (r.spring) this.events.push({ t: 'spring', p: p.id, x: from.x, y: from.y });
          p.moving = isMoving(L, b);
          // A ball that is still "moving" but has not left one spot for five seconds is put at
          // rest there, so nothing can lock a player out of their next putt.
          if (Math.hypot(b.x - p.park[0], b.y - p.park[1]) > 0.35) p.park = [b.x, b.y, 0];
          else if (p.moving && ++p.park[2] > TICK_RATE * 5 && r.surface !== 'air') {
            b.vx = b.vy = b.vz = b.wx = b.wy = 0;
            p.moving = false;
          }
          if (!p.moving) {
            p.park[2] = 0;
            p.magnet = false;
          }
        }
        if (!p.moving && p.strokes >= strokeCap(this.par)) {
          this.finish(p, false);
          continue;
        }
      }

      this.tryPickup(p);
      if (p.bot && !p.moving) this.botTurn(p);
    }

    for (const k of s.pickups) {
      if (k.cooldown > 0 && --k.cooldown === 0) k.kind = this.randomItem();
    }

    s.timer--;
    const left = s.players.filter((p) => !p.done).length;
    if (left === 0) s.timer = Math.min(s.timer, TICK_RATE);
    // One straggler does not hold everyone up for the whole clock.
    else if (left === 1 && s.players.length > 1) s.timer = Math.min(s.timer, LAST_PLAYER_SECONDS * TICK_RATE);
    if (s.timer <= 0) {
      for (const p of s.players) if (!p.done) this.finish(p, false);
      this.setPhase('holeEnd', HOLE_END_SECONDS);
    }
  }

  private putt(p: PlayerState, dx: number, dy: number): void {
    if (this.state.phase !== 'playing' || p.done || p.moving || p.strokes >= strokeCap(this.par)) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return;
    const power = Math.min(1, len);
    const speed = MIN_PUTT + (MAX_PUTT - MIN_PUTT) * power;
    p.restX = p.ball.x;
    p.restY = p.ball.y;
    p.restZ = p.ball.z;
    p.ball.vx = (dx / len) * speed;
    p.ball.vy = (dy / len) * speed;
    p.moving = true;
    p.strokes++;
    if (p.steady > 0) p.steady--;
    if (p.jitters > 0) p.jitters--;
    this.events.push({ t: 'putt', p: p.id, power });
  }

  /** The way out of any spot a ball cannot be putted from. */
  private reset(p: PlayerState): void {
    if (this.state.phase !== 'playing' || p.done || p.strokes < 1 || p.strokes >= strokeCap(this.par)) return;
    this.events.push({ t: 'out', p: p.id, x: p.ball.x, y: p.ball.y, z: p.ball.z, water: false });
    p.strokes++;
    this.placeAt(p, p.restX, p.restY, p.restZ);
  }

  private useItem(p: PlayerState, slot: number): void {
    const s = this.state;
    if (s.phase !== 'playing' || p.done) return;
    const kind = p.items[slot];
    if (!kind) return;
    const others = s.players.filter((o) => o !== p && !o.done);
    const b = p.ball;

    if (kind === 'drum') {
      // Bass drum: every other ball close by is thrown outward.
      for (const o of others) {
        let dx = o.ball.x - b.x;
        let dy = o.ball.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d > DRUM_RADIUS) continue;
        if (d < 0.05) {
          const a = this.rand() * Math.PI * 2;
          dx = Math.cos(a);
          dy = Math.sin(a);
          d = 1;
        }
        o.ball.vx += (dx / d) * DRUM_PUSH;
        o.ball.vy += (dy / d) * DRUM_PUSH;
        o.moving = true;
      }
    } else if (kind === 'sandal') {
      // Flip-flop on the ball: it stops where it is.
      if (!p.moving) return;
      b.vx = 0;
      b.vy = 0;
    } else if (kind === 'swap') {
      // Trade places with whoever is nearest the cup.
      const L = this.level;
      const toCup = (o: PlayerState) => Math.hypot(o.ball.x - L.cup.x, o.ball.y - L.cup.y);
      const target = others.sort((m, n) => toCup(m) - toCup(n))[0];
      if (!target) return;
      const mine = { x: b.x, y: b.y, z: b.z };
      this.placeAt(p, target.ball.x, target.ball.y, target.ball.z);
      this.placeAt(target, mine.x, mine.y, mine.z);
    } else if (kind === 'peanuts') {
      // Boiled peanuts: take the last putt back.
      if (p.strokes < 1) return;
      p.strokes--;
      this.placeAt(p, p.restX, p.restY, p.restZ);
    } else if (kind === 'steady') {
      // Iced tea: a steady hand for the next couple of putts.
      p.steady = STEADY_PUTTS;
      p.jitters = 0;
    } else if (kind === 'magnet') {
      // Lucky scarf: the cup draws this ball in until it next stops.
      p.magnet = true;
    } else if (kind === 'horn') {
      // Air horn: everyone else's next putt sways wildly.
      if (!others.length) return;
      for (const o of others) if (o.steady === 0) o.jitters = 1;
    }

    p.items.splice(slot, 1);
    p.stats.items++;
    this.events.push({ t: 'item', p: p.id, kind, x: b.x, y: b.y });
  }

  private tryPickup(p: PlayerState): void {
    if (p.items.length >= MAX_ITEMS) return;
    for (const k of this.state.pickups) {
      if (k.cooldown > 0) continue;
      if (Math.hypot(p.ball.x - k.x, p.ball.y - k.y) > PICKUP_R) continue;
      if (Math.abs(p.ball.z - k.z) > 0.35) continue;
      p.items.push(k.kind);
      k.cooldown = PICKUP_RESPAWN_SECONDS * TICK_RATE;
      this.events.push({ t: 'pickup', p: p.id, kind: k.kind });
      return;
    }
  }

  private botTurn(p: PlayerState): void {
    if (--p.wait > 0) return;
    p.wait = Math.floor(TICK_RATE * (1.4 + this.rand() * 2));
    // Bots only bother with the leftovers that need no timing.
    const useful = (k: ItemKind) => k === 'drum' || k === 'swap' || k === 'horn' || k === 'magnet';
    const slot = p.items.findIndex(useful);
    if (slot !== -1 && this.rand() < 0.5) this.useItem(p, slot);
    p.items = p.items.filter(useful);
    const shot = planPutt(this.level, p.ball, () => this.rand());
    // A bot that has had the horn sounded at it is thrown off line like anyone else.
    const off = p.jitters > 0 ? (this.rand() - 0.5) * 2 * SWAY_ANGLE * JITTER_SCALE : 0;
    this.putt(p, shot.dx * Math.cos(off) - shot.dy * Math.sin(off), shot.dx * Math.sin(off) + shot.dy * Math.cos(off));
  }

  // -------------------------------------------------------------- helpers

  private beginHole(hole: number): void {
    const s = this.state;
    s.hole = hole;
    const L = this.level;
    s.pickups = L.spawns.map((sp, i) => ({ id: i, x: sp.x, y: sp.y, z: sp.z, kind: this.randomItem(), cooldown: 0 }));
    for (const p of s.players) {
      p.strokes = 0;
      p.holed = false;
      p.done = false;
      p.ready = false;
      p.steady = 0;
      p.jitters = 0;
      p.magnet = false;
      p.wait = Math.floor(TICK_RATE * (2 + this.rand() * 3));
      this.placeOnTee(p);
    }
    this.setPhase('intro', INTRO_SECONDS);
  }

  private setPhase(phase: MatchState['phase'], seconds: number): void {
    this.state.phase = phase;
    this.state.timer = Math.round(seconds * TICK_RATE);
    this.events.push({ t: 'phase', phase });
  }

  private finish(p: PlayerState, holed: boolean): void {
    p.done = true;
    p.holed = holed;
    p.moving = false;
    p.ball.vx = p.ball.vy = p.ball.vz = p.ball.wx = p.ball.wy = 0;
    p.scores[this.state.hole] = holed ? p.strokes : penaltyScore(this.par);
  }

  private placeOnTee(p: PlayerState): void {
    const L = this.level;
    this.placeAt(p, L.tee.x, L.tee.y, L.tee.z);
    p.restX = L.tee.x;
    p.restY = L.tee.y;
    p.restZ = L.tee.z;
  }

  /** Put a ball down at rest on the ground at, or just under, this height. */
  private placeAt(p: PlayerState, x: number, y: number, z: number): void {
    const floor = floorAt(this.level, x, y, z + 0.1);
    p.ball = { x, y, z: Number.isFinite(floor) ? floor : z, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0 };
    p.moving = false;
  }

  private playedHoles(): number {
    const s = this.state;
    if (s.phase === 'lobby') return 0;
    return s.phase === 'final' ? s.holeCount : s.hole;
  }

  private randomItem(): ItemKind {
    return ITEM_KINDS[Math.floor(this.rand() * ITEM_KINDS.length)];
  }

  /** mulberry32. The seed lives in the state so a snapshot carries it. */
  private rand(): number {
    const s = this.state;
    s.rng = (s.rng + 0x6d2b79f5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 14) : '';
  return s || 'Player';
}

export function total(p: PlayerState): number {
  return p.scores.reduce((a, b) => a + b, 0);
}
