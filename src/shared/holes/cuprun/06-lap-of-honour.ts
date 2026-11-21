import { HoleBuilder } from '../../builder';
import { ORANGE, VIOLET } from '../palette';

// Lap of Honour: one lap of the stadium's running track, or a leap into the
// infield where the flag stands in the middle of the pitch.
//
// The oval is 44 x 26 with a lane 4 wide: a home straight (south), a banked
// bend, a back straight with hurdles, a second banked bend, and the infield
// a pace below the track, holding the green.
//
// Safe line: the whole lap. The fast lane on the home straight fires a firm
//   tee shot along the board most of the way round the first bend; finish the
//   bend, blast the hurdles (or thread the gap on the inside), take the fast
//   lane into the second bend and putt down the ramp at its end onto the
//   green. About 110 units; seven putts.
// Long jump: from the home straight, a take-off board sticks out over a big
//   sand pit. Any putt off it lands in the sand and stops; the board throws
//   you deep, so one more putt reaches the green. Skips most of the lap,
//   safely, but the sand costs a putt or two.
// Water jump: after the hurdles, a take-off board over the steeplechase water.
//   A firm putt flies the water onto the green, three or four putts saved;
//   short is wet.
// The infield is guarded everywhere else: the home straight's inside drops
// into the sand, the first bend's and the back straight's into the water.
// Only the second bend, the end of the lap anyway, drops onto grass.
const b = new HoleBuilder({ id: 'lap-of-honour', name: 'Lap of Honour', par: 7, boards: [VIOLET, ORANGE] });

const TRACK = 0;
const INFIELD = -1;
const SKIN = 0.004; // running track, sand and water lie this far above what is under them, so they show and win
const HALF = 9; // the straights run from x = -9 to x = 9; the bends turn round (+-9, 0)
const R_IN = 9; // inside edge of the bends
const R_OUT = 13; // outside edge, where the boards stand
const LANE = R_OUT - R_IN;
const HOME_Y = R_IN + LANE / 2; // centre line of the home straight; the back straight is at -HOME_Y
const TILT = 0.3; // the bends' outside edge is this much higher: gentle enough that a ball at rest stays put
const SAND = { x0: -4, x1: HALF, y0: 2.5, y1: R_IN + 1 };
const WATER_Y = -6; // the steeplechase water runs from under the back straight to here
const CUP = { x: -1.5, y: -0.8 };

const rad = (deg: number) => (deg * Math.PI) / 180;
/** A point at this compass angle (0 east, 90 south) and distance from a centre. */
const around = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + Math.cos(rad(deg)) * r,
  cy + Math.sin(rad(deg)) * r,
];
/** Points along a circle from one compass angle to another. */
const arc = (cx: number, cy: number, r: number, from: number, to: number, steps: number): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => around(cx, cy, r, from + ((to - from) * i) / steps));

// The two bends, each a half-circle to the left. `from` is the compass angle,
// seen from the bend's centre, where it starts.
const BEND1 = { cx: HALF, from: 90 };
const BEND2 = { cx: -HALF, from: -90 };
/** A point some way round a bend (degrees from its start), this far from its centre. */
const inBend = (bend: { cx: number; from: number }, deg: number, r: number) => around(bend.cx, 0, r, bend.from - deg);

/**
 * A velodrome bend. The outside edge is lifted by TILT the whole way round,
 * easing in and out over the first and last eighth to meet the flat straights.
 * Board outside; kerb inside, except over the pieces in `open`.
 */
function velodrome(bend: { cx: number; from: number }, open?: [number, number]): void {
  const PIECES = 20;
  const step = 180 / PIECES;
  const lift = (i: number) => TILT * Math.min(1, (i / PIECES) * 8, (1 - i / PIECES) * 8);
  const gap = (i: number) => !!open && i >= open[0] && i <= open[1];
  for (let i = 0; i < PIECES; i++) {
    const a = step * i;
    const c = a + step;
    const inner = gap(i) ? 'none' : 'kerb';
    const [inA, outA, outC, inC] = [inBend(bend, a, R_IN), inBend(bend, a, R_OUT), inBend(bend, c, R_OUT), inBend(bend, c, R_IN)];
    // Where the tilt eases in or out a piece is twisted: fold it along its higher
    // diagonal, so the fold is a ridge and never a pocket.
    if (lift(i + 1) >= lift(i)) {
      b.poly([inA, outA, outC], [TRACK, TRACK + lift(i), TRACK + lift(i + 1)], { walls: ['none', 'board', 'none'] });
      b.poly([inA, outC, inC], [TRACK, TRACK + lift(i + 1), TRACK], { walls: ['none', 'none', inner] });
    } else {
      b.poly([inA, outA, inC], [TRACK, TRACK + lift(i), TRACK], { walls: ['none', 'none', inner] });
      b.poly([outA, outC, inC], [TRACK + lift(i), TRACK + lift(i + 1), TRACK], { walls: ['board', 'none', 'none'] });
    }
  }
}

/** A take-off board: a short rising tongue sticking out from the track's inside edge, with no walls. */
function takeOff(x: number, y: number, heading: number): void {
  b.at(x, y, heading, TRACK).width(2).walls('none').straight(1.4, { rise: 0.35 });
}

/** A strip of running track along the outer half of a straight: the fast lane. */
function fastLane(x: number, y: number, heading: number, length: number): void {
  b.at(x, y, heading, TRACK + SKIN).width(2.4).walls('none').straight(length, { boost: true });
}

/** A rectangle of ground from (x0, y0) to (x1, y1). */
function rect(x0: number, y0: number, x1: number, y1: number, z: number, mat: 'turf' | 'mud' | 'water' = 'turf'): void {
  b.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z, { mat });
}

// The bots' route is laid by hand at the end; nothing the pen lays is part of it.
b.route(false);

// ---------------------------------------------------------------- the infield
// A bowl a pace below the track; the track's inside face walls it in. It runs
// on under the track a little so no ball can slip between the two.
const UNDER = 1;
b.poly([...arc(HALF, 0, R_IN + UNDER, 90, -90, 18), ...arc(-HALF, 0, R_IN + UNDER, -90, -270, 18)], INFIELD);
// The long-jump pit, under the home straight's inside edge.
rect(SAND.x0, SAND.y0, SAND.x1, SAND.y1, INFIELD + SKIN, 'mud');
// The steeplechase water: along the back straight and round inside the first bend.
rect(-HALF, -R_IN - UNDER, HALF, WATER_Y, INFIELD + SKIN, 'water');
b.poly([...arc(HALF, 0, R_IN + UNDER, -90, 90, 18), ...arc(HALF, 0, -WATER_Y, 90, -90, 18)], INFIELD + SKIN, { mat: 'water' });
// A kerb along the water's edge: a ball rolling gently off the green bounces back.
b.wall([[-HALF, -R_IN], [-HALF, WATER_Y], [HALF, WATER_Y], ...arc(HALF, 0, -WATER_Y, -90, 90, 18), [HALF, R_IN]], 'kerb');

// ------------------------------------------------------------ home straight
// Tee at the start line. The inside is railed past the tee, then a kerb over
// the sand pit with the long-jump board in it. Running track down the outer
// half of the lane; the inner half is plain turf to stop on.
b.at(-HALF, HOME_Y, 0, TRACK)
  .width(LANE)
  .walls('rail', 'board')
  .cap('board')
  .route(true)
  .tee(2)
  .route(false)
  .straight(5)
  .walls('kerb', 'board')
  .straight(4)
  .straight(2, { left: 'none' })
  .straight(7);
takeOff(1, R_IN, 270);
fastLane(-3, HOME_Y + 0.8, 0, 2.5);
fastLane(4, HOME_Y + 0.8, 0, 4);
b.at(1.8, HOME_Y + 0.8, 0).item();

// ------------------------------------------------------------- first bend
velodrome(BEND1);
b.at(...inBend(BEND1, 70, R_OUT - 0.7), 0).item();

// ----------------------------------------------------------- back straight
// Three hurdles across the outer three quarters of the lane: a putt at nine
// tenths power or more hops all three, a softer one stops at one. The gap on
// the inside is the careful way, along the kerb over the water. Then the
// water-jump board, and a fast lane that carries you into the second bend.
b.at(HALF, -HOME_Y, 180, TRACK).width(LANE).walls('kerb', 'board').straight(11.5).straight(3, { left: 'none' }).straight(3.5);
const HURDLES = [6.5, 4, 1.5];
for (const x of HURDLES) b.wall([[x, -R_OUT], [x, -R_IN - 1.1]], 'kerb');
takeOff(-4, -R_IN, 76);
fastLane(-5.5, -HOME_Y - 0.8, 180, 2.5);
b.at(-1, -HOME_Y, 180).item();

// ------------------------------------------------- second bend and the gate
// The kerb gives way to the ramp over the last part of the bend.
velodrome(BEND2, [12, 17]);

// The ramp: from the bend's inside edge down to the infield, pointing at the flag.
const TOP = arc(-HALF, 0, R_IN, 162, 108, 6);
const DOWN = 6.5;
const fall: [number, number] = [Math.cos(rad(-30)), Math.sin(rad(-30))];
const foot = (p: [number, number], k = DOWN): [number, number] => [p[0] + fall[0] * k, p[1] + fall[1] * k];
b.poly([...TOP, foot(TOP[TOP.length - 1]), foot(TOP[0])], [...TOP.map(() => TRACK), INFIELD, INFIELD]);

// --------------------------------------------------------------- the green
b.at(CUP.x, CUP.y, 0, INFIELD).cup();
b.at(SAND.x0 + 6, SAND.y0 + 3, 0).item();

// ------------------------------------------------------------- bots' route
// The safe line. On the bends the points keep to the outer half of the lane.
// The hurdles are taken full-blooded: every point among them is putted at full
// power, so a bot that stops between two hurdles blasts on rather than back.
b.way(2, HOME_Y + 0.4).way(8, HOME_Y + 0.6);
for (let deg = 18; deg < 180; deg += 18) b.way(...inBend(BEND1, deg, 11.6));
b.way(HURDLES[0] + 1.3, -HOME_Y - 0.4);
for (const x of [(HURDLES[0] + HURDLES[1]) / 2, (HURDLES[1] + HURDLES[2]) / 2, HURDLES[2] - 1]) b.way(x, -HOME_Y - 0.4, TRACK, 1);
b.way(-3, -HOME_Y - 0.4);
for (let deg = 36; deg <= 108; deg += 36) b.way(...inBend(BEND2, deg, 11.6));
b.way(...foot(TOP[3], 0.6));
b.way(...foot(TOP[3], DOWN + 1));

export default b.build();
