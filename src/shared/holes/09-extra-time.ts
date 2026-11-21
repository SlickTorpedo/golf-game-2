import { HoleBuilder, type Side } from '../builder';
import { CYAN, ORANGE } from './palette';

// Extra Time: from the centre circle, either take the long banked bowl down and
// round the pit, or hit the running track and jump the pit straight at the flag.
//
// Ace line: a firm putt due east down the track; the ramp throws the ball over
//   the pit, it lands on the green and comes back off the board behind. Aimed
//   a touch right of centre and hit nearly flat out, it drops.
// Safe line: out of the circle to the south-east, round the big bowl bend
//   (downhill all the way, board on the outside) and onto the green from the
//   south. Three putts.
// Shortcut: the jump. It needs about three quarters power or more from the
//   tee. A softer putt that only just reaches the track is fired off the ramp
//   too slowly and falls in the pit: ball lost, back to the tee.
const b = new HoleBuilder({ id: 'extra-time', name: 'Extra Time', par: 3, boards: [ORANGE, CYAN] });

const TOP = 1.5; // the centre circle
const LOW = 0.5; // the green
const CIRCLE_R = 3;
const GREEN_R = 3;
const BOWL_HEADING = 56.25;
const BOWL_R = 7.21;

const rad = (deg: number) => (deg * Math.PI) / 180;
// A lane meets a round patch along a chord four rim panels wide, this far from the centre.
const MOUTH = 2 * CIRCLE_R * Math.sin(rad(22.5));
const MOUTH_AT = CIRCLE_R * Math.cos(rad(22.5));
const ahead = (heading: number): [number, number] => [Math.cos(rad(heading)), Math.sin(rad(heading))];

interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/**
 * Lay a bend by hand, panel by panel, the way turn() is meant to (see the
 * report: turn() currently lays the second half of every bend wrongly).
 * Positive angle is to the right. Returns where the bend ends.
 */
function bend(
  from: Pose,
  angle: number,
  radius: number,
  o: { width: number; rise?: number; bank?: number; left: Side; right: Side; stones: number },
): Pose {
  const steps = Math.max(2, Math.ceil(Math.abs(angle) / 9));
  const dir = Math.sign(angle);
  const right = (h: number): [number, number] => [-Math.sin(rad(h)), Math.cos(rad(h))];
  const r0 = right(from.heading);
  const cx = from.x + r0[0] * radius * dir;
  const cy = from.y + r0[1] * radius * dir;
  const at = (t: number) => {
    const h = from.heading + angle * t;
    const r = right(h);
    const bank = (o.bank ?? 0) * Math.sin(Math.PI * t);
    const z = from.z + (o.rise ?? 0) * t;
    const x = cx - r[0] * radius * dir;
    const y = cy - r[1] * radius * dir;
    const half = o.width / 2;
    return {
      pose: { x, y, z, heading: h },
      mid: z + bank / 2,
      l: [x - r[0] * half, y - r[1] * half, z + (dir > 0 ? bank : 0)],
      r: [x + r[0] * half, y + r[1] * half, z + (dir < 0 ? bank : 0)],
    };
  };
  for (let i = 0; i < steps; i++) {
    const p = at(i / steps);
    const q = at((i + 1) / steps);
    const corners = [p.l, p.r, q.r, q.l];
    b.poly(corners.map((c) => [c[0], c[1]] as [number, number]), corners.map((c) => c[2]), { walls: ['none', o.right, 'none', o.left] });
  }
  for (let k = 1; k <= o.stones; k++) {
    const s = at(k / o.stones);
    b.way(s.pose.x, s.pose.y, s.mid);
  }
  return at(1).pose;
}

/** Points along a circle, by heading angle (0 east, 90 south). */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = rad(from + ((to - from) * i) / steps);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// The centre circle, with the tee on its spot. Two ways out.
b.disc(0, 0, CIRCLE_R, TOP, { wall: 'rail', gaps: [[-20, 20], [36, 76]] });
b.at(-1.5, 0, 0, TOP).tee();

// The safe way: a long downhill bowl round the south side of the pit.
const out = ahead(BOWL_HEADING);
b.at(out[0] * MOUTH_AT, out[1] * MOUTH_AT, BOWL_HEADING, TOP).width(MOUTH).walls('rail', 'board').straight(1.2, { width: 2.6 });
const bowlEnd = bend(
  { x: out[0] * (MOUTH_AT + 1.2), y: out[1] * (MOUTH_AT + 1.2), z: TOP, heading: BOWL_HEADING },
  -2 * BOWL_HEADING,
  BOWL_R,
  { width: 2.6, rise: LOW - TOP, bank: 0.3, left: 'rail', right: 'board', stones: 5 },
);
b.at(bowlEnd.x, bowlEnd.y, bowlEnd.heading, LOW).width(2.6).straight(1.2, { width: MOUTH });

// The green: an island across the pit, where the bowl comes back up to the
// centre line. A tall board round the back to catch the jump, a kerb round
// the front lip.
const GREEN_X = bowlEnd.x + ahead(bowlEnd.heading)[0] * (1.2 + MOUTH_AT);
b.disc(GREEN_X, 0, GREEN_R, LOW);
b.wall(arc(GREEN_X, 0, GREEN_R - 0.02, -101.25, 101.25, 18), 'board');
b.wall(arc(GREEN_X, 0, GREEN_R - 0.02, 146.25, 258.75, 10), 'kerb');
b.at(GREEN_X, 0, 0, LOW).cup(0.4, -1.4);
// A boggy patch at the front of the green, brushing the line from the bowl to
// the flag: a jump that lands in it stops dead, and the safe putt has to miss it.
b.disc(GREEN_X - 1.2, 0.1, 0.8, LOW + 0.004, { mat: 'mud', segments: 20 });
b.at(bowlEnd.x, bowlEnd.y, bowlEnd.heading, LOW).item(-3, 0);

// The shortcut: running track, a ramp, and nothing after it.
b.at(MOUTH_AT, 0, 0, TOP)
  .route(false)
  .width(MOUTH)
  .walls('rail')
  .straight(1.2)
  .item(-0.6, 0)
  .straight(3, { boost: true })
  .straight(2, { rise: 0.5, left: 'kerb', right: 'kerb' });

export default b.build();
