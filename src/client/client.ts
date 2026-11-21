import type { Channel } from '../net/channel';
import { PROTOCOL_VERSION, SNAPSHOT_EVERY, TICK_MS } from '../shared/constants';
import type { ClientMsg, GameEvent, MatchState, PlayerState, ServerMsg } from '../shared/protocol';

interface Snap {
  state: MatchState;
  at: number;
}

/**
 * The player's side of the connection. It keeps the last two snapshots and
 * draws a little in the past, sliding between them, so motion stays smooth
 * whether snapshots come from this tab or from a server far away.
 */
export class GameClient {
  you: string | null = null;
  host = false;
  refused: string | null = null;
  onEvents: (events: GameEvent[], state: MatchState) => void = () => {};
  /** The link to the room has gone. */
  closed = false;
  onClosed: () => void = () => {};
  private prev: Snap | null = null;
  private curr: Snap | null = null;

  constructor(
    private readonly ch: Channel<ClientMsg, ServerMsg>,
    name: string,
  ) {
    ch.onMessage((msg) => this.receive(msg));
    ch.onClose(() => {
      this.closed = true;
      this.onClosed();
    });
    ch.send({ t: 'hello', v: PROTOCOL_VERSION, name });
  }

  get state(): MatchState | null {
    return this.curr?.state ?? null;
  }

  get me(): PlayerState | undefined {
    return this.curr?.state.players.find((p) => p.id === this.you);
  }

  send(msg: ClientMsg): void {
    this.ch.send(msg);
  }

  /** The game tick being drawn right now, with a fraction, one snapshot behind the newest. */
  tickAt(now: number): number {
    if (!this.curr) return 0;
    return this.curr.state.tick - SNAPSHOT_EVERY + Math.min(SNAPSHOT_EVERY * 2, (now - this.curr.at) / TICK_MS);
  }

  /** Smoothed ball position for drawing. */
  ballAt(id: string, now: number): { x: number; y: number; z: number } | null {
    const b = this.curr?.state.players.find((p) => p.id === id)?.ball;
    if (!b || !this.curr) return null;
    const a = this.prev?.state.players.find((p) => p.id === id)?.ball;
    if (!a || !this.prev) return b;
    // A jump this big is a reset or a swap, not a roll.
    if (Math.hypot(b.x - a.x, b.y - a.y) > 1.5) return b;
    const span = Math.max(1, this.curr.at - this.prev.at);
    const t = Math.min(1, Math.max(0, (now - this.curr.at) / span));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  private receive(msg: ServerMsg): void {
    if (msg.t === 'welcome') {
      this.you = msg.you;
      this.host = msg.host;
    } else if (msg.t === 'refused') {
      this.refused = msg.reason;
    } else if (msg.t === 'snap') {
      this.prev = this.curr;
      this.curr = { state: msg.state, at: performance.now() };
      if (msg.events.length) this.onEvents(msg.events, msg.state);
    }
  }
}
