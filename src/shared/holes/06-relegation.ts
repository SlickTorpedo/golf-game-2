import { HoleBuilder, type Side } from '../builder';
import { CYAN, ORANGE } from './palette';

// Going down: putt off the top deck and the helter-skelter carries the ball
// down two drops into a bowl-shaped green that feeds the cup.
//
// Ace line: a firm putt, 0.6 power or more, along the deck. The bend turns it
//   round, it drops into the green and swirls down past the cup, which sits a
//   little north of the bottom of the bowl. About one firm putt in four drops;
//   below 0.6 power none do.
// Safe line: any putt that leaves the deck. The bend is steep enough to keep
//   the ball moving and every part of the green slopes to the bottom of the
//   bowl: a ball that misses settles within a pace of the cup for a tap-in.
// Shortcut: the kerb on the right of the tee. A putt of 0.6 power or more
//   straight at the flag hops it, falls two storeys into the green and can run
//   straight in. Softer and it drops into the gap between the deck and the green.
const b = new HoleBuilder({ id: 'relegation', name: 'Relegation', par: 2, boards: [ORANGE, CYAN] });

const DECK_Z = 3;
// The bottom of the bowl-shaped green.
const BOWL_X = -8.6;
const BOWL_Y = -0.8;

// The top deck. Its right-hand side by the tee is only a kerb.
b.at(-7, -7, 0, DECK_Z)
  .width(2.8)
  .walls('rail', 'kerb')
  .cap()
  .tee(0.9)
  .route(false)
  .straight(2)
  .straight(1, { right: 'rail' });

// First drop, then the helter-skelter: a half-circle back toward the tee,
// falling all the way and tilted like a velodrome, so a ball that runs out of
// pace drifts in off the outside board and keeps going. The tilt is only
// slight: a ball pressed hard against the inside rail on a slope stalls there.
// It is laid by hand as a fan of short pieces, because the tilt is held most of
// the way round.
const BEND = { x: -4.3, y: -4.4, r: 2.6, half: 1.4, top: 2.7, bottom: 1.15, tilt: 0.3, pieces: 24 };
const across = (i: number) => {
  const t = i / BEND.pieces;
  // Compass position seen from the centre of the bend: north, round by east, to south.
  const a = ((270 + 180 * t) * Math.PI) / 180;
  const z = BEND.top + (BEND.bottom - BEND.top) * t;
  // The tilt comes in slowly over the first two fifths, so the outside edge
  // never climbs back toward the deck, and goes out over the last eighth.
  const lift = BEND.tilt * Math.min(1, t * 2.5, (1 - t) * 8);
  const edge = (r: number): [number, number] => [BEND.x + Math.cos(a) * r, BEND.y + Math.sin(a) * r];
  return { inner: edge(BEND.r - BEND.half), outer: edge(BEND.r + BEND.half), z, lift };
};
// Where the tilt is changing, each piece is twisted. It is cut into two
// triangles along its higher diagonal, so the fold between them is a low ridge;
// cut along the other diagonal it would be a crease that traps a slow ball
// against the inside rail.
for (let i = 0; i < BEND.pieces; i++) {
  const p = across(i);
  const q = across(i + 1);
  const pi = { at: p.inner, z: p.z };
  const po = { at: p.outer, z: p.z + p.lift };
  const qo = { at: q.outer, z: q.z + q.lift };
  const qi = { at: q.inner, z: q.z };
  const half = (c: (typeof pi)[], walls: Side[]) => b.poly(c.map((k) => k.at), c.map((k) => k.z), { walls });
  if (q.lift >= p.lift) {
    half([pi, po, qo], ['none', 'board', 'none']);
    half([pi, qo, qi], ['none', 'none', 'rail']);
  } else {
    half([pi, po, qi], ['none', 'none', 'rail']);
    half([po, qo, qi], ['board', 'none', 'none']);
  }
}
b.at(BEND.x, BEND.y + BEND.r, 180, BEND.bottom).walls('board', 'rail').straight(0.8);

// The green is a shallow cone round a flat bottom. Every ray from the bottom
// climbs at about 1 in 4, steep enough that no ball can stop on it. It reaches further east, under
// the end of the helter-skelter, so the second drop lands on it.
const SECTORS = 40;
const FLAT = 1.3;
const SLOPE = 0.24;
const rim = (i: number) => {
  const a = (i / SECTORS) * Math.PI * 2;
  const r = 3.7 + Math.max(0, Math.cos(a)) ** 2;
  return { x: BOWL_X + Math.cos(a) * r, y: BOWL_Y + Math.sin(a) * r, z: (r - FLAT) * SLOPE, a };
};
for (let i = 0; i < SECTORS; i++) {
  const p = rim(i);
  const q = rim(i + 1);
  const mid = ((((i + 0.5) / SECTORS) * 360 + 180) % 360) - 180;
  // No board under the mouth of the helter-skelter: the ball drops in over that stretch.
  const wall = mid > -34 && mid < 8 ? 'none' : 'board';
  b.poly(
    [
      [BOWL_X + Math.cos(p.a) * FLAT, BOWL_Y + Math.sin(p.a) * FLAT],
      [p.x, p.y],
      [q.x, q.y],
      [BOWL_X + Math.cos(q.a) * FLAT, BOWL_Y + Math.sin(q.a) * FLAT],
    ],
    [0, p.z, q.z, 0],
    { walls: ['none', wall, 'none', 'none'] },
  );
}
b.disc(BOWL_X, BOWL_Y, FLAT, 0, { segments: SECTORS });

// The cup is off the middle of the flat, so a ball running down the cone has to
// be on the right line to drop; the rest settle on the flat beside it.
b.at(BOWL_X, BOWL_Y, 0, 0).cup(0, -0.45).item(2.2, 0.4);
b.at(BEND.x + BEND.r, BEND.y, 90, 2).item();

// Bots putt once along the deck and let the hole do the rest.
b.way(-4.6, -7, DECK_Z, 0.5).way(BEND.x + BEND.r, BEND.y).way(-4.5, BEND.y + BEND.r);

export default b.build();
