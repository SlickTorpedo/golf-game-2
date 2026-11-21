import type { Ball } from './physics';

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
  strokes: number;
  holed: boolean;
  /** Finished this hole, holed or not. */
  done: boolean;
  ready: boolean;
  /** One entry per finished hole. */
  scores: number[];
  items: ItemKind[];
  /** Ticks until a bot putts again. */
  wait: number;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
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
  | { t: 'bounce'; p: string; v: number }
  | { t: 'land'; p: string }
  | { t: 'holed'; p: string; strokes: number }
  | { t: 'out'; p: string }
  | { t: 'pickup'; p: string; kind: ItemKind }
  | { t: 'item'; p: string; kind: ItemKind; x: number; y: number };

export type ClientMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'start'; name: string; bots: number }
  | { t: 'putt'; dx: number; dy: number }
  | { t: 'item'; slot: number }
  | { t: 'ready' };

export type ServerMsg =
  | { t: 'welcome'; you: string; host: boolean }
  | { t: 'snap'; state: MatchState; events: GameEvent[] }
  | { t: 'refused'; reason: string };
