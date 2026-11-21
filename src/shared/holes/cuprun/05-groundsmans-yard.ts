import { HoleBuilder, type Side } from '../../builder';
import { CYAN, LIME } from '../palette';

// Groundsman's Yard: four jobs from the groundsman's shed in a row (paint the
// lines, dodge the sprinklers, feed the roller, pick the right door) on a deck
// high above the pitch.
//
// 1. Line marker. The tee pad looks out over a gap. The safe lane leaves the
//    back of the pad, swings round a banked hairpin and runs up to the first
//    landing. Straight ahead, three thin white lines (1.1 wide, no walls) fan
//    out across the gap: left to that same landing, middle to the top of the
//    roller, right to a little island with a pickup and a second line on to
//    the roller.
// 2. Sprinklers. A wide lawn dotted with kerbed ponds and low mounds. The safe
//    way goes round the north side of the ponds; the gaps between them are
//    shorter and tighter.
// 3. The roller. A long straight down a 1-in-4 slope, a banked right-hand bend
//    at the foot, and the shed doorway straight after it. The shed floor
//    falls away to a kerb on its far side: feed the roller gently and the
//    ball stops in the shed; hit it hard and it hops the kerb and is gone.
// 4. The shed. Two tunnel mouths side by side in the east wall. The south one
//    comes out on the green just beyond the wall, in plain sight; the north one
//    comes out back on the far side of the lawn.
// 5. Green. Small and round, frost across the front, mud behind.
//
// Safe line, about 95 units: lane, round the lawn, roller, shed, tunnel, putt.
// Shortcut: the middle line from the tee straight to the top of the roller,
//   skipping the lawn. Off line and the ball is lost; too hard and it runs on
//   into the corner of the lawn.
const b = new HoleBuilder({ id: 'groundsmans-yard', name: "Groundsman's Yard", par: 7, boards: [LIME, CYAN] });

type Pt = [number, number];
const rad = (deg: number) => (deg * Math.PI) / 180;
const headingTo = (x0: number, y0: number, x1: number, y1: number) => ((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + 360) % 360;
/** Half the angle a lane of this width takes out of a round rim. */
const mouthAngle = (r: number, w: number) => (Math.asin(w / 2 / r) * 180) / Math.PI;

/** Points along a circle, by heading angle (0 east, 90 south). */
function arc(cx: number, cy: number, r: number, from: number, to: number, step = 11.25): Pt[] {
  const n = Math.max(1, Math.round(Math.abs(to - from) / step));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(from + ((to - from) * i) / n);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Height of the yard deck. The roller takes the ball down to the shed at 0. */
const Y = 3;
const LINE_W = 1.1;

const TEE = { x: 0, y: 0, r: 2.8 };
/** The first landing, where the lane and the left line arrive; the lawn opens off its north side. */
const LANDING: Pt[] = [[-8, -5], [-5.2, -5], [-3.8, -6], [-3.4, -8], [-3.6, -9.6], [-8.8, -9.6], [-8.8, -5.8]];
/** Where the left line is aimed, inside the landing. */
const LANDING_AIM = { x: -6.2, y: -7.2, r: 1.6 };
/** The round landing at the top of the roller. */
const TOP = { x: 5, y: -9.4, r: 2.5 };
const ISLE = { x: 9.5, y: -2.5, r: 1.5 };
const LEFT = headingTo(TEE.x, TEE.y, LANDING_AIM.x, LANDING_AIM.y);
const MID = headingTo(TEE.x, TEE.y, TOP.x, TOP.y);
const RIGHT = headingTo(TEE.x, TEE.y, ISLE.x, ISLE.y);
const ISLE_TO_TOP = headingTo(ISLE.x, ISLE.y, TOP.x, TOP.y);

// ---------------------------------------------------------------- tee pad
// Board behind, the lane's mouth to the south, and a kerb along the gap
// between the three lines.
b.disc(TEE.x, TEE.y, TEE.r, Y, { wall: 'board', gaps: [[60, 120], [195, 360]] });
const lineGap = mouthAngle(TEE.r, LINE_W);
for (const [from, to] of [[195, LEFT - lineGap], [LEFT + lineGap, MID - lineGap], [MID + lineGap, RIGHT - lineGap], [RIGHT + lineGap, 360]]) {
  b.wall(arc(TEE.x, TEE.y, TEE.r - 0.02, from, to, 6), 'kerb');
}
b.at(TEE.x, TEE.y, 270, Y).tee();

// ---------------------------------------------------------------- 1. line marker
/** A thin white line from the rim of one pad to well inside the next. */
function paintLine(from: { x: number; y: number; r: number }, to: { x: number; y: number; r: number }): void {
  const h = headingTo(from.x, from.y, to.x, to.y);
  const len = Math.hypot(to.x - from.x, to.y - from.y) - from.r - to.r + 0.4;
  b.at(from.x + Math.cos(rad(h)) * (from.r - 0.2), from.y + Math.sin(rad(h)) * (from.r - 0.2), h, Y)
    .width(LINE_W)
    .walls('none')
    .route(false)
    .straight(len)
    .route(true);
}
paintLine(TEE, LANDING_AIM);
paintLine(TEE, TOP);
paintLine(TEE, ISLE);
paintLine(ISLE, TOP);
b.disc(ISLE.x, ISLE.y, ISLE.r, Y, { wall: 'board', mouths: [[RIGHT + 180, LINE_W], [ISLE_TO_TOP, LINE_W]] });
b.at(ISLE.x, ISLE.y, 0, Y).item();

// The safe lane: out of the back of the pad, round a banked hairpin, and up to
// the landing. Bots stop twice on the hairpin, where they can see on.
const HAIRPIN = { x: TEE.x - 3.3, y: TEE.r + 1, r: 3.3 };
b.at(TEE.x, TEE.r - 0.2, 90, Y)
  .width(2.8)
  .walls('rail')
  .route(false)
  .straight(1.2)
  .turn(180, HAIRPIN.r, { bank: 0.3, left: 'board', right: 'rail' })
  .straight(8.8)
  .route(true);
for (const h of [45, 135]) b.way(HAIRPIN.x + Math.cos(rad(h)) * HAIRPIN.r, HAIRPIN.y + Math.sin(rad(h)) * HAIRPIN.r);
b.way(-6.6, -4.6);
b.poly(LANDING, Y, { walls: ['none', 'none', 'kerb', 'kerb', 'none', 'board', 'board'] });
b.wall([[-4.2, -5.75], [-3.8, -6]], 'kerb');

// ---------------------------------------------------------------- 2. sprinklers
// The lawn runs from the landing round to the top of the roller. Its south
// edge, facing the tee, is a long board; it laps into the top landing.
const lawn: Pt[] = [
  [-8.6, -9.4], [-3.7, -9.4], [-1, -10.3], [1.5, -10.6],
  ...arc(TOP.x, TOP.y, TOP.r - 0.15, 200, 330),
  [8.6, -13], [9.2, -17], [8.4, -21.5], [6, -25.5], [2, -27.8], [-3, -28.6], [-8, -28], [-12.5, -25.5], [-15.5, -21.5], [-16.3, -17], [-15, -12.5], [-12, -10],
];
const lapped = arc(0, 0, 1, 200, 330).length - 1;
b.poly(lawn, Y, { walls: lawn.map((_, i): Side => (i === 0 || (i >= 4 && i < 4 + lapped) ? 'none' : 'board')) });

// Ponds a hair above the lawn, each with a low stone kerb: a slow ball bumps
// off, a firm one hops in.
const pond = (x: number, y: number, r: number) => b.disc(x, y, r, Y + 0.005, { mat: 'water', wall: 'kerb', segments: 28 });
pond(-1.2, -12.6, 1.9);
pond(0.2, -17.4, 1.5);
pond(-2.5, -21.8, 1.8);
pond(-12, -15, 1.3);
pond(5.2, -21, 1.3);
pond(4.8, -14.6, 1);
b.mound(-7.5, -12.5, 2.2, 0.12);
b.mound(-5, -16.5, 2, 0.14);
b.mound(-8, -24, 2.4, 0.15);
b.mound(2, -24.5, 2, 0.12);
b.at(-5, -16.5, 0, Y).item();
// Bots thread the middle gap, between the second and third ponds.
b.way(-7.6, -6.8).way(-7, -12.5).way(-4.6, -18.6).way(-1.15, -19.6).way(3, -18.6).way(6.6, -16).way(TOP.x, TOP.y);

// ---------------------------------------------------------------- 3. the roller
b.disc(TOP.x, TOP.y, TOP.r, Y, {
  wall: 'board',
  gaps: [[200, 330]],
  mouths: [[0, 2.6], [MID + 180, LINE_W], [ISLE_TO_TOP + 180, LINE_W]],
});
const ROLL = 12;
const RUN = 1;
const BEND = 3.4;
const ROLL_X = TOP.x + TOP.r - 0.3;
b.at(ROLL_X, TOP.y, 0, Y).width(2.6).walls('board', 'rail').route(false).straight(ROLL, { rise: -Y });
// From the top landing, bots feed the roller at a fixed, gentle power.
b.way(ROLL_X + ROLL, TOP.y, 0, 0.65);
b.route(true).straight(RUN).turn(90, BEND, { bank: 0.4, left: 'board', right: 'rail' });

// ---------------------------------------------------------------- 4. the shed
// Measured from the middle of its doorway: x forward (south), y to the right (west).
const DX = ROLL_X + ROLL + RUN + BEND;
const DY = TOP.y + BEND;
const sh = (x: number, y: number): Pt => [DX - y, DY + x];
// The floor falls gently away from the door towards the kerb, so a ball that
// comes in too fast keeps its pace and hops it; a slow one still stops.
const floorZ = (pts: Pt[]) => pts.map(([, y]) => -0.1 * (y - DY));
/** A funnel in the east wall narrowing to a chute with a tunnel mouth in it. */
function alcove([ox, oy]: Pt): { pts: Pt[]; mouth: Pt } {
  return {
    pts: [[ox, oy + 0.6], [ox, oy - 0.6], [ox + 0.5, oy - 0.4], [ox + 1.5, oy - 0.4], [ox + 1.5, oy + 0.4], [ox + 0.5, oy + 0.4]],
    mouth: [ox + 1, oy],
  };
}
const toGreen = alcove(sh(2.15, -3.4));
const toLawn = alcove(sh(0.75, -3.4));
for (const a of [toLawn, toGreen]) b.poly(a.pts, floorZ(a.pts), { walls: ['none', 'board', 'board', 'board', 'board', 'board'] });
const shed: Pt[] = [
  sh(0, 1.3), sh(0, 2.6), sh(0.6, 3.4), sh(2.4, 3.4), sh(3, 2.8), sh(3, -2.8), sh(2.8, -3.4),
  toGreen.pts[0], toGreen.pts[1], toLawn.pts[0], toLawn.pts[1], sh(0, -3.2), sh(0, -1.3),
];
b.poly(shed, floorZ(shed), {
  walls: ['board', 'board', 'board', 'board', 'kerb', 'board', 'board', 'none', 'board', 'none', 'board', 'board', 'none'],
});
b.at(...sh(1.5, 2), 0, 0).item();
b.way(...sh(1.5, 0)).way(...sh(2.15, -2.2)).way(...toGreen.mouth);
b.at(...toLawn.mouth, 0, 0).tunnelIn('lawn');
b.at(...toGreen.mouth, 0, 0).tunnelIn('green');
// The wrong door: out on the far side of the lawn, still rolling east.
b.at(-1, -26.5, 0, Y).tunnelOut('lawn');

// ---------------------------------------------------------------- 5. green
// The right door comes out on the green in line with its chute.
const EXIT: Pt = [toGreen.mouth[0] + 2.6, toGreen.mouth[1]];
const G = { x: EXIT[0] + 2.3, y: EXIT[1], r: 2.8 };
/** The part of the green between two east-west positions, laid a hair above it. */
function band(x0: number, x1: number, mat: 'ice' | 'mud'): void {
  const north: Pt[] = [];
  const south: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const x = x0 + ((x1 - x0) * i) / 8;
    const h = Math.sqrt(Math.max(0, G.r * G.r - (x - G.x) ** 2)) - 0.03;
    north.push([x, G.y - h]);
    south.unshift([x, G.y + h]);
  }
  b.poly([...north, ...south], 0.003, { mat });
}
b.disc(G.x, G.y, G.r, 0, { wall: 'board' });
band(EXIT[0] + 0.8, EXIT[0] + 1.6, 'ice');
band(G.x + 1.6, G.x + G.r - 0.05, 'mud');
b.at(...EXIT, 0, 0).tunnelOut('green').item(0.6, 1.2);
b.way(EXIT[0] + 0.3, EXIT[1]);
b.at(G.x + 0.3, G.y - 0.9, 0, 0).cup();

export default b.build();
