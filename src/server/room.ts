import type { Channel } from '../net/channel';
import { MAX_PLAYERS, PROTOCOL_VERSION, SNAPSHOT_EVERY, TICK_MS } from '../shared/constants';
import type { HoleDef } from '../shared/level';
import { Match, cleanName } from '../shared/match';
import type { ClientMsg, GameEvent, ServerMsg } from '../shared/protocol';

type Conn = Channel<ServerMsg, ClientMsg>;

/**
 * One game table. It holds the match, listens to every connected player
 * and sends everyone the same snapshots. Today it lives in the player's own
 * tab; it uses nothing from the browser, so it can move to a Node process
 * as it is.
 */
export class Room {
  readonly match: Match;
  private readonly conns = new Map<string, Conn>();
  private pending: GameEvent[] = [];
  private hostId: string | null = null;
  private nextId = 1;
  private acc = 0;

  constructor(holes: HoleDef[], seed: number) {
    this.match = new Match(holes, seed);
  }

  /** Take a new connection. The player joins once they say hello. */
  connect(ch: Conn): void {
    const id = `p${this.nextId++}`;
    ch.onClose(() => this.drop(id));
    ch.onMessage((msg) => this.receive(id, ch, msg));
  }

  /** Feed real time in. Runs as many ticks as fit. */
  advance(ms: number): void {
    this.acc += Math.min(ms, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.tick();
    }
  }

  tick(): void {
    this.pending.push(...this.match.step());
    if (this.match.state.tick % SNAPSHOT_EVERY === 0) this.broadcast();
  }

  private receive(id: string, ch: Conn, msg: ClientMsg): void {
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'hello') {
      if (this.conns.has(id)) return;
      if (msg.v !== PROTOCOL_VERSION) return ch.send({ t: 'refused', reason: 'version' });
      if (this.conns.size >= MAX_PLAYERS || !this.match.addPlayer(id, msg.name)) {
        return ch.send({ t: 'refused', reason: 'full' });
      }
      this.conns.set(id, ch);
      this.hostId ??= id;
      ch.send({ t: 'welcome', you: id, host: this.hostId === id });
      this.broadcast();
      return;
    }

    if (!this.conns.has(id)) return;

    if (msg.t === 'start') {
      const phase = this.match.state.phase;
      if (id !== this.hostId || (phase !== 'lobby' && phase !== 'final')) return;
      const me = this.match.player(id);
      if (me) me.name = cleanName(msg.name);
      this.match.start(Number(msg.bots) || 0);
      return;
    }

    this.match.command(id, msg);
  }

  private drop(id: string): void {
    if (!this.conns.delete(id)) return;
    this.match.removePlayer(id);
    if (this.hostId === id) this.hostId = this.conns.keys().next().value ?? null;
  }

  private broadcast(): void {
    const msg: ServerMsg = { t: 'snap', state: this.match.state, events: this.pending };
    for (const ch of this.conns.values()) ch.send(msg);
    this.pending = [];
  }
}
