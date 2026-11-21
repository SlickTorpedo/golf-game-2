import { describe, expect, it } from 'vitest';
import { createLocalPair } from '../src/net/channel';
import { Room } from '../src/server/room';
import { HoleBuilder } from '../src/shared/builder';
import { PROTOCOL_VERSION, penaltyScore } from '../src/shared/constants';
import { ALL_HOLES, COURSES } from '../src/shared/courses';

const STADIUM = COURSES[0].holes;
import { compileLevel, floorAt } from '../src/shared/level';
import { Match } from '../src/shared/match';
import { stepBall } from '../src/shared/physics';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';

function playRound(seed: number, holes = STADIUM): Match {
  const m = new Match(holes, seed);
  m.start(4);
  for (let i = 0; i < 60 * 60 * 30 && m.state.phase !== 'final'; i++) m.step();
  return m;
}

// Every hole in the round has to hold together and be finishable.
// Run one hole with:  npx vitest run --disable-console-intercept -t "hole <id>:"
describe('holes', () => {
  for (const def of ALL_HOLES) {
    it(`hole ${def.id}: builds, and everything stands on the ground`, () => {
      const L = compileLevel(def);
      expect(def.par).toBeGreaterThanOrEqual(2);
      L.line.forEach((w, i) => {
        const h = floorAt(L, w.x, w.y, w.z + 0.3);
        expect(Number.isFinite(h), `route point ${i} at ${w.x.toFixed(1)},${w.y.toFixed(1)} is over nothing`).toBe(true);
      });
      for (const p of [...L.spawns, ...L.cones, ...L.springs, ...L.spinners]) {
        const h = floorAt(L, p.x, p.y, p.z + 0.3);
        expect(Number.isFinite(h), `something at ${p.x.toFixed(1)},${p.y.toFixed(1)} is over nothing`).toBe(true);
      }
    });

    it(`hole ${def.id}: bots can finish it`, () => {
      // Three rounds of four bots on this hole alone.
      const scores: number[] = [];
      for (const seed of [3, 11, 29]) {
        const m = playRound(seed, [def]);
        scores.push(...m.state.players.map((p) => p.scores[0]));
      }
      const holed = scores.filter((s) => s < penaltyScore(def.par));
      const avg = holed.reduce((a, b) => a + b, 0) / Math.max(1, holed.length);
      console.log(`${def.id}: par ${def.par}, bots holed ${holed.length}/12, average ${avg.toFixed(1)}, scores ${scores.join(' ')}`);
      expect(holed.length, 'at least half the bots must hole out').toBeGreaterThanOrEqual(6);
    });
  }
});

describe('match', () => {
  it('the same seed gives the same round', () => {
    expect(JSON.stringify(playRound(99).state)).toBe(JSON.stringify(playRound(99).state));
  });

  it('refuses putts while the ball is rolling', () => {
    const m = new Match(STADIUM, 1);
    m.addPlayer('a', 'A');
    m.start(0);
    while (m.state.phase !== 'playing') m.step();
    m.command('a', { t: 'putt', dx: 0.5, dy: 0 });
    m.step();
    m.command('a', { t: 'putt', dx: 0.5, dy: 0 });
    expect(m.player('a')!.strokes).toBe(1);
  });
});

describe('room', () => {
  it('serves a client over a channel', async () => {
    const room = new Room(COURSES, 3);
    const [client, server] = createLocalPair<ClientMsg, ServerMsg>();
    const got: ServerMsg[] = [];
    client.onMessage((m) => got.push(m));
    room.connect(server);
    client.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Test' });
    await Promise.resolve();
    client.send({ t: 'start', name: 'Test', bots: 2, course: COURSES[0].id });
    await Promise.resolve();
    for (let i = 0; i < 10; i++) room.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(got[0]).toMatchObject({ t: 'welcome', host: true });
    const snap = got.filter((m) => m.t === 'snap').pop();
    expect(snap && snap.t === 'snap' && snap.state.players.length).toBe(3);
  });
});

describe('physics', () => {
  /** A lane heading east from the origin, finished off by `make`. */
  const lane = (make: (b: HoleBuilder) => void) => {
    const b = new HoleBuilder({ id: 't', name: 't', par: 2, boards: [0, 0] });
    b.at(0, 0, 0).width(2).walls('rail').cap().tee(0.5);
    make(b);
    return compileLevel(b.build());
  };
  const roll = (L: ReturnType<typeof lane>, vx: number, vy = 0, max = 900) => {
    const b = { x: L.tee.x, y: L.tee.y, z: L.tee.z, vx, vy, vz: 0, wx: 0, wy: 0 };
    const seen = { holed: false, oob: false, splash: false, tunnel: false, cone: false, hop: false, air: false, spring: false };
    for (let i = 0; i < max; i++) {
      const r = stepBall(L, b, i);
      seen.holed ||= r.holed;
      seen.oob ||= r.oob;
      seen.splash ||= r.splash;
      seen.tunnel ||= r.tunnel;
      seen.hop ||= r.hop;
      seen.spring ||= r.spring;
      seen.air ||= r.surface === 'air';
      seen.cone ||= r.impact > 0 && r.material === 'cone';
      if (r.holed || r.oob || (b.vx === 0 && b.vy === 0 && r.surface !== 'air')) break;
    }
    return { b, seen };
  };

  it('a gentle putt drops, a hard one runs over the cup', () => {
    // No wall at the far end: a ball that runs over the cup carries on off the edge.
    const L = lane((b) => b.straight(8).cup(-4));
    expect(roll(L, 5).seen.holed).toBe(true);
    expect(roll(L, 12).seen.holed).toBe(false);
  });

  it('water takes the ball', () => {
    const L = lane((b) => b.straight(2).straight(2, { mat: 'water' }).straight(2).cup(-1).cap());
    expect(roll(L, 6).seen.splash).toBe(true);
  });

  it('with no wall, the ball rolls off the side and is lost', () => {
    const L = lane((b) => b.walls('none').straight(6).cup(-1));
    expect(roll(L, 0, 4).seen.oob).toBe(true);
  });

  it('a kerb stops a slow ball and a firm one hops it', () => {
    const L = lane((b) => b.walls('kerb').straight(6).cup(-1));
    expect(roll(L, 0, 2).seen.oob).toBe(false);
    const hard = roll(L, 0, 7);
    expect(hard.seen.hop).toBe(true);
    expect(hard.seen.oob).toBe(true);
  });

  it('a ramp that ends throws the ball across a gap', () => {
    const L = lane((b) => b.straight(2).straight(2, { rise: 0.6 }).gap(1.8, { drop: 0.6 }).straight(5).cup(-1).cap());
    const { b, seen } = roll(L, 11);
    expect(seen.air).toBe(true);
    expect(seen.oob).toBe(false);
    expect(b.x).toBeGreaterThan(6);
    // Too slow and it falls short.
    expect(roll(L, 7.5).seen.oob).toBe(true);
  });

  it('the tunnel carries the ball to its other end', () => {
    const L = lane((b) => b.straight(3).tunnelIn('a', -0.5).cap().at(0, 6, 0).cap().straight(4).tunnelOut('a', -3).cup(-1).cap());
    const { seen, b } = roll(L, 5);
    expect(seen.tunnel).toBe(true);
    expect(b.y).toBeGreaterThan(5);
  });

  it('a cone sends the ball back and a spring throws it up', () => {
    const cone = roll(lane((b) => b.straight(8).cone(-4).cup(-1).cap()), 6);
    expect(cone.seen.cone).toBe(true);
    expect(cone.b.x).toBeLessThan(4);
    const spring = roll(lane((b) => b.straight(8).spring(-5).cup(-1).cap()), 5);
    expect(spring.seen.spring && spring.seen.air).toBe(true);
  });

  it('a turnstile never throws the ball out of a walled room', () => {
    const L = lane((b) => b.width(4).straight(8).spinner(-4).cup(-0.6).cap());
    for (const v of [2, 5, 9, 12]) {
      const { b, seen } = roll(L, v, 0, 1500);
      expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      expect(seen.oob).toBe(false);
    }
  });
});
