import type { Ball, HitMaterial } from './physics';

// Everything that crosses the wire is declared here. All of it is plain JSON.

export type Phase = 'lobby' | 'intro' | 'playing' | 'holeEnd' | 'final';

/** Things the crowd left behind. */
export type ItemKind = 'drum' | 'sandal' | 'swap' | 'peanuts';
export const ITEM_KINDS: readonly ItemKind[] = ['drum', 'sandal', 'swap', 'peanuts'];

export interface PlayerState {
  id: string;
  name: string;
  /** Index into the client's player colours. */
  color: number;
  bot: boolean;
  ball: Ball;
  moving: boolean;
  /** Where the last putt was struck from. Out of bounds puts the ball back here. */
  restX: number;
  restY: number;
  restZ: number;
  strokes: number;
  holed: boolean;
  /** Finished this hole, holed or not. */
  done: boolean;
  ready: boolean;
  /** One entry per finished hole. */
  scores: number[];
  items: ItemKind[];
  /** Tallies for the awards at full time. */
  stats: { falls: number; hits: number; items: number; aces: number; air: number };
  /** Ticks until a bot putts again. */
  wait: number;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  z: number;
  kind: ItemKind;
  /** Ticks until it is back. 0 means it can be taken. */
  cooldown: number;
}

export interface MatchState {
  phase: Phase;
  hole: number;
  holeCount: number;
  tick: number;
  /** Ticks left in the current phase. */
  timer: number;
  players: PlayerState[];
  pickups: Pickup[];
  rng: number;
}

/** One-off happenings for sound and effects. They are not needed to rebuild state. */
export type GameEvent =
  | { t: 'phase'; phase: Phase }
  | { t: 'putt'; p: string; power: number }
  | { t: 'bounce'; p: string; v: number; m: HitMaterial; x: number; y: number }
  | { t: 'land'; p: string; v: number }
  | { t: 'holed'; p: string; strokes: number }
  /** Lost off the edge or in water, at this spot. */
  | { t: 'out'; p: string; x: number; y: number; z: number; water: boolean }
  | { t: 'tunnel'; p: string; x: number; y: number }
  | { t: 'boost'; p: string }
  | { t: 'hop'; p: string }
  | { t: 'spring'; p: string; x: number; y: number }
  | { t: 'pickup'; p: string; kind: ItemKind }
  | { t: 'item'; p: string; kind: ItemKind; x: number; y: number };

export type ClientMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'start'; name: string; bots: number }
  | { t: 'putt'; dx: number; dy: number }
  | { t: 'item'; slot: number }
  | { t: 'ready' }
  /** Give up on where the ball is: back to where it was last hit from, for one putt. */
  | { t: 'reset' };

export type ServerMsg =
  | { t: 'welcome'; you: string; host: boolean }
  | { t: 'snap'; state: MatchState; events: GameEvent[] }
  | { t: 'refused'; reason: string };
