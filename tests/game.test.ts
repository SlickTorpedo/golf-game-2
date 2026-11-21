import { describe, expect, it } from 'vitest';
import { createLocalPair } from '../src/net/channel';
import { Room } from '../src/server/room';
import { buildNav } from '../src/shared/bots';
import { PENALTY_SCORE, PROTOCOL_VERSION } from '../src/shared/constants';
import { STADIUM } from '../src/shared/courses';
import { parseLevel } from '../src/shared/level';
import { stepBall } from '../src/shared/physics';
import { Match } from '../src/shared/match';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';

function playRound(seed: number): Match {
  const m = new Match(STADIUM, seed);
  m.start(4);
  for (let i = 0; i < 60 * 60 * 20 && m.state.phase !== 'final'; i++) m.step();
  return m;
}

describe('course', () => {
  for (const def of STADIUM) {
    it(`${def.id}: rows line up and the cup can be reached from the tee`, () => {
      const L = parseLevel(def);
      for (const row of def.tiles) expect(row.length).toBe(L.w);
      const nav = buildNav(L);
      const tee = Math.floor(L.tee.y) * L.w + Math.floor(L.tee.x);
      expect(nav.next[tee]).not.toBe(-1);
    });
  }
});

describe('match', () => {
  it('bots play a whole round and hole out on every hole', () => {
    const m = playRound(7);
    expect(m.state.phase).toBe('final');
    for (let h = 0; h < STADIUM.length; h++) {
      const scores = m.state.players.map((p) => p.scores[h]);
      console.log(STADIUM[h].id, scores.join(' '));
      expect(scores.some((s) => s < PENALTY_SCORE)).toBe(true);
    }
  });

  it('the same seed gives the same round', () => {
    expect(JSON.stringify(playRound(99).state)).toBe(JSON.stringify(playRound(99).state));
  });

  it('refuses putts while the ball is rolling', () => {
    const m = new Match(STADIUM, 1);
    m.addPlayer('a', 'A');
    m.start(0);
    while (m.state.phase !== 'playing') m.step();
    m.command('a', { t: 'putt', dx: 0, dy: -0.5 });
    m.step();
    m.command('a', { t: 'putt', dx: 0, dy: -0.5 });
    expect(m.player('a')!.strokes).toBe(1);
  });
});

describe('room', () => {
  it('serves a client over a channel', async () => {
    const room = new Room(STADIUM, 3);
    const [client, server] = createLocalPair<ClientMsg, ServerMsg>();
    const got: ServerMsg[] = [];
    client.onMessage((m) => got.push(m));
    room.connect(server);
    client.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Test' });
    await Promise.resolve();
    client.send({ t: 'start', name: 'Test', bots: 2 });
    await Promise.resolve();
    for (let i = 0; i < 10; i++) room.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(got[0]).toMatchObject({ t: 'welcome', host: true });
    const snap = got.filter((m) => m.t === 'snap').pop();
    expect(snap && snap.t === 'snap' && snap.state.players.length).toBe(3);
  });
});

describe('physics', () => {
  const flat = (tiles: string[]) => parseLevel({ id: 't', name: 't', par: 2, boards: [0, 0], tiles });
  const roll = (L: ReturnType<typeof flat>, vx: number, max = 600) => {
    const b = { x: L.tee.x, y: L.tee.y, z: 0, vx, vy: 0, vz: 0 };
    const seen = { holed: false, oob: false, splash: false, tunnel: false, cone: false };
    for (let i = 0; i < max; i++) {
      const r = stepBall(L, b, i);
      seen.holed ||= r.holed;
      seen.oob ||= r.oob;
      seen.splash ||= r.splash;
      seen.tunnel ||= r.tunnel;
      seen.cone ||= r.impact > 0 && r.material === 'cone';
      if (r.holed || r.oob || (b.vx === 0 && b.vy === 0)) break;
    }
    return { b, seen };
  };

  it('a gentle putt drops, a hard one runs over the cup', () => {
    const L = flat(['#########', '#T..O...#', '#########']);
    expect(roll(L, 6.5).seen.holed).toBe(true);
    expect(roll(L, 12).seen.holed).toBe(false);
  });

  it('water takes the ball', () => {
    const { seen } = roll(flat(['#######', '#T.~~O#', '#######']), 6);
    expect(seen.splash).toBe(true);
  });

  it('the tunnel carries the ball to its other end', () => {
    const L = flat(['#########', '#T.A#a.O#', '#########']);
    const { seen, b } = roll(L, 5);
    expect(seen.tunnel).toBe(true);
    expect(b.x).toBeGreaterThan(5);
  });

  it('a cone sends the ball back', () => {
    const { seen, b } = roll(flat(['#########', '#T..c..O#', '#########']), 6);
    expect(seen.cone).toBe(true);
    expect(b.x).toBeLessThan(4.5);
  });

  it('a turnstile never throws the ball faster than the speed limit or out of the world', () => {
    const L = flat(['#######', '#.....#', '#T.+.O#', '#.....#', '#######']);
    for (const v of [2, 5, 9, 12]) {
      const { b } = roll(L, v, 1200);
      expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      expect(b.x > 0 && b.x < 7 && b.y > 0 && b.y < 5).toBe(true);
    }
  });
});
