import { HoleBuilder } from '../builder';
import type { Side } from '../builder';
import { CYAN, LIME } from './palette';

// A pitch shaped like an eye with a back line of cones across it, and a banked
// stand curving round behind them. Go through the line or round the back of it.
//
// Ace line: flat out from the tee through the one wide gap in the cone line,
//   the one that points at the flag.
// Safe line: up the ramp on the left and round the banked stand, board on the
//   outside. It ends above the green and drops the ball beside the flag.
// Shortcut: the pitch. It is half the distance, but the gap is one ball and a
//   bit wide, a cone kicks the ball back harder than it came, and a ball
//   kicked flat out goes over the low rail on the open side of the pitch.
const b = new HoleBuilder({ id: 'offside-trap', name: 'Offside Trap', par: 3, boards: [CYAN, LIME] });

const deg = (d: number) => (d * Math.PI) / 180;
const on = (c: { x: number; y: number }, r: number, d: number): [number, number] => [
  c.x + r * Math.cos(deg(d)),
  c.y + r * Math.sin(deg(d)),
];
const within = (c: { x: number; y: number; r: number }, x: number, y: number) => Math.hypot(x - c.x, y - c.y) < c.r;

// The pitch is where two circles overlap: the stand follows the north one.
const NORTH = { x: 6.5, y: 2.2, r: 4.6 };
const SOUTH = { x: 6.5, y: -3, r: 5.64 };
const STAND = { r: 5.7, half: 1.2, from: 200, to: 340, up: 0.5 };
const [teeX, teeY] = on(NORTH, STAND.r, STAND.from);
const TEE = { x: teeX, y: teeY, r: 2.2 };
const GREEN = { x: 11.9, y: 2, r: 2.9 };

const onPitch = (x: number, y: number) => within(NORTH, x, y) && within(SOUTH, x, y);
const underStand = (x: number, y: number, margin: number) => {
  const r = Math.hypot(x - NORTH.x, y - NORTH.y);
  const a = (Math.atan2(y - NORTH.y, x - NORTH.x) / Math.PI) * 180 + 360;
  return Math.abs(r - STAND.r) < STAND.half + margin && a > STAND.from && a < STAND.to + margin * 10;
};

// A round pad with a board round its rim wherever it does not run into the
// pitch or the stand. `margin` keeps the board that much clear of the stand.
const pad = (c: { x: number; y: number; r: number }, margin: number) => {
  b.disc(c.x, c.y, c.r, 0, { segments: 48 });
  for (let i = 0; i < 48; i++) {
    const [mx, my] = on(c, c.r, (i + 0.5) * 7.5);
    if (!onPitch(mx, my) && !underStand(mx, my, margin)) b.wall([on(c, c.r, i * 7.5), on(c, c.r, (i + 1) * 7.5)], 'board');
  }
};
pad(TEE, 0);
// The stand ends above the green: no board may stand under its mouth.
pad(GREEN, 0.35);
b.at(TEE.x, TEE.y, STAND.from + 90).tee();
b.at(GREEN.x + 0.4, GREEN.y + 0.1, 0).cup();

// The pitch: the north edge lies under the stand, the south edge has a rail.
const outline: [number, number][] = [];
const edges: Side[] = [];
for (let d = 200; d < 340; d += 5) {
  outline.push(on(NORTH, NORTH.r, d));
  edges.push('none');
}
for (let d = 40; d < 140; d += 5) {
  outline.push(on(SOUTH, SOUTH.r, d));
  const [mx, my] = on(SOUTH, SOUTH.r, d + 2.5);
  edges.push(within(TEE, mx, my) || within(GREEN, mx, my) ? 'none' : 'rail');
}
b.poly(outline, 0, { walls: edges });

// The high road: off the tee pad, up a curving ramp and round the stand to
// its end above the green. Bots are not sent this way: they go for the gap.
b.at(TEE.x, TEE.y, STAND.from + 90)
  .width(STAND.half * 2)
  .walls('none')
  .route(false)
  .turn(17, STAND.r)
  .turn(5, STAND.r, { left: 'board' })
  .walls('board', 'kerb')
  .turn(30, STAND.r, { rise: STAND.up })
  .turn(88, STAND.r, { bank: 0.25 });
b.at(...on(NORTH, STAND.r, 285), 0, STAND.up).item();

// The back line, stepping up across the low road, with one wide gap in it,
// and a sweeper behind.
const cones: [number, number][] = [
  [5.6, -1.5],
  [5.95, -0.75],
  [6.3, 0],
  [6.6, 0.67],
  [7.05, 1.72],
  [7.5, 2.3],
  [8.4, 0.5],
];
for (const [x, y] of cones) b.at(x, y, 0, 0).cone();
b.at(8.6, 1.9, 0, 0).item();

export default b.build();
