/**
 * One end of a two-way message pipe. The game only ever talks through this,
 * so a WebSocket or WebRTC data channel can stand in for the local pair
 * below without touching the room or the client.
 */
export interface Channel<Out, In> {
  send(msg: Out): void;
  onMessage(cb: (msg: In) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

class LocalEnd<Out, In> implements Channel<Out, In> {
  peer!: LocalEnd<In, Out>;
  private handler: ((msg: In) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private backlog: In[] = [];
  private open = true;

  constructor(private readonly latencyMs: number) {}

  send(msg: Out): void {
    if (!this.open) return;
    // Go through JSON on purpose: anything that would not survive a real
    // network (functions, class instances, Infinity) breaks here too.
    const wire = JSON.stringify(msg);
    const deliver = () => this.peer.receive(JSON.parse(wire) as Out);
    if (this.latencyMs > 0) setTimeout(deliver, this.latencyMs);
    else queueMicrotask(deliver);
  }

  onMessage(cb: (msg: In) => void): void {
    this.handler = cb;
    for (const m of this.backlog.splice(0)) cb(m);
  }

  onClose(cb: () => void): void {
    this.closeHandler = cb;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.closeHandler?.();
    this.peer.close();
  }

  private receive(msg: In): void {
    if (!this.open) return;
    if (this.handler) this.handler(msg);
    else this.backlog.push(msg);
  }
}

/** Two connected ends in the same page. latencyMs fakes a slow link each way. */
export function createLocalPair<A, B>(latencyMs = 0): [Channel<A, B>, Channel<B, A>] {
  const a = new LocalEnd<A, B>(latencyMs);
  const b = new LocalEnd<B, A>(latencyMs);
  a.peer = b;
  b.peer = a;
  return [a, b];
}
