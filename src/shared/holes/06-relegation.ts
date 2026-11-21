import { HoleBuilder } from '../builder';
import { CYAN, ORANGE } from './palette';

// Going down: putt off the top deck and the helter-skelter carries the ball
// down two drops into a bowl-shaped green that feeds the cup.
//
// Ace line: a firm putt, three-quarter power or more, along the deck. The
//   bend turns it round, it drops into the green and swirls down into the cup.
// Safe line: any putt that leaves the deck. The bend is steep enough to keep
//   the ball moving and every part of the green slopes to the flag: a softer
//   putt stops half a pace short for a tap-in.
// Shortcut: the kerb on the right of the tee. A half-power putt straight at
//   the flag hops it, falls two storeys into the green and can run straight
//   in. Too soft and it drops into the gap between the deck and the green.
const b = new HoleBuilder({ id: 'relegation', name: 'Relegation', par: 2, boards: [ORANGE, CYAN] });

const DECK_Z = 3;
const CUP_X = -8.6;
const CUP_Y = -0.8;

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
// pace slides down to the inside rail and keeps going. It is laid by hand as a
// fan of short pieces, because the tilt is held all the way round.
const BEND = { x: -4.3, y: -4.4, r: 2.6, half: 1.4, top: 2.7, bottom: 1.15, tilt: 0.62, pieces: 24 };
const across = (i: number) => {
  const t = i / BEND.pieces;
  // Compass position seen from the centre of the bend: north, round by east, to south.
  const a = ((270 + 180 * t) * Math.PI) / 180;
  const z = BEND.top + (BEND.bottom - BEND.top) * t;
  // The tilt comes in and goes out over the first and last eighth.
  const lift = BEND.tilt * Math.min(1, t * 8, (1 - t) * 8);
  const edge = (r: number): [number, number] => [BEND.x + Math.cos(a) * r, BEND.y + Math.sin(a) * r];
  return { inner: edge(BEND.r - BEND.half), outer: edge(BEND.r + BEND.half), z, lift };
};
for (let i = 0; i < BEND.pieces; i++) {
  const p = across(i);
  const q = across(i + 1);
  b.poly([p.inner, p.outer, q.outer, q.inner], [p.z, p.z + p.lift, q.z + q.lift, q.z], {
    walls: ['none', 'board', 'none', 'rail'],
  });
}
b.at(BEND.x, BEND.y + BEND.r, 180, BEND.bottom).walls('board', 'rail').straight(0.8);

// The green is a shallow cone. Every ray from the cup climbs at about 1 in 4,
// steep enough that no ball can stop on it. It reaches further east, under
// the end of the helter-skelter, so the second drop lands on it.
const SECTORS = 40;
const FLAT = 0.95;
const SLOPE = 0.24;
const rim = (i: number) => {
  const a = (i / SECTORS) * Math.PI * 2;
  const r = 3.7 + Math.max(0, Math.cos(a)) ** 2;
  return { x: CUP_X + Math.cos(a) * r, y: CUP_Y + Math.sin(a) * r, z: (r - FLAT) * SLOPE, a };
};
for (let i = 0; i < SECTORS; i++) {
  const p = rim(i);
  const q = rim(i + 1);
  const mid = ((((i + 0.5) / SECTORS) * 360 + 180) % 360) - 180;
  // No board under the mouth of the helter-skelter: the ball drops in over that stretch.
  const wall = mid > -34 && mid < 8 ? 'none' : 'board';
  b.poly(
    [
      [CUP_X + Math.cos(p.a) * FLAT, CUP_Y + Math.sin(p.a) * FLAT],
      [p.x, p.y],
      [q.x, q.y],
      [CUP_X + Math.cos(q.a) * FLAT, CUP_Y + Math.sin(q.a) * FLAT],
    ],
    [0, p.z, q.z, 0],
    { walls: ['none', wall, 'none', 'none'] },
  );
}
b.disc(CUP_X, CUP_Y, FLAT, 0, { segments: SECTORS });

b.at(CUP_X, CUP_Y, 0, 0).cup().item(2.2, 0.4);
b.at(BEND.x + BEND.r, BEND.y, 90, 2).item();

// Bots putt once along the deck and let the hole do the rest.
b.way(-4.6, -7, DECK_Z, 0.5).way(BEND.x + BEND.r, BEND.y).way(-4.5, BEND.y + BEND.r);

export default b.build();
