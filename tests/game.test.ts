import { describe, expect, it } from 'vitest';
import { createLocalPair } from '../src/net/channel';
import { Room } from '../src/server/room';
import { buildNav } from '../src/shared/bots';
import { PENALTY_SCORE, PROTOCOL_VERSION } from '../src/shared/constants';
import { STADIUM } from '../src/shared/courses';
import { parseLevel } from '../src/shared/level';
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
