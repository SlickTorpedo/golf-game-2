import { HoleBuilder, type Side } from '../builder';
import { PINK, VIOLET } from './palette';

// Upper Tier: climb the corkscrew to the balcony green above the tee, or
// thread the players' tunnel and come out right beside the flag.
//
// Ace line: dead straight from the tee, 0.8 power or more and within a degree
//   and a half, through the gap in the first bend, along the thin spur and into
//   the tunnel. The ball comes out on the balcony still rolling east, at the cup.
// Safe line: a soft putt to the first bend, up the ramp to the landing, round
//   the banked corkscrew (it climbs a full level), back west over the bridge
//   and onto the balcony. Even a full-power putt from the landing climbs only
//   about half the corkscrew, so played carefully it is five or six.
// Shortcut: the tunnel. The spur has no walls and the bend around it has only
//   a kerb, so a hard tee shot that misses the spur hops the kerb and is lost.
//   Overhit on the balcony and the ball drops off the south kerb, back down to
//   the tee lane.
const b = new HoleBuilder({ id: 'upper-tier', name: 'Upper Tier', par: 4, boards: [VIOLET, PINK] });

const rad = (deg: number) => (deg * Math.PI) / 180;

const LANDING = 0.5;
const TIER = 1.5;
const GREEN = { x: 3.6, y: -4.236, r: 2.4 };
// The lane from the bridge meets the green's rim between two of its corners:
// this far north and south of the green's centre.
const MOUTH_N = GREEN.r * Math.sin(rad(-56.25));
const MOUTH_S = GREEN.r * Math.sin(rad(11.25));

interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/**
 * Lay a bend panel by panel, like turn(), but with as many route points
 * ("stones") along it as the bots need. Positive angle is to the right.
 * Returns where the bend ends.
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

// The tee lane, heading east under the bridge.
b.at(0, 0, 0).width(2.6).walls('rail').cap().tee(0.9).straight(2.5).item(-0.2, 0).straight(2.5);

// The first bend, left to face north. Its outside wall is only a kerb where a
// straight tee shot would hit it, and is missing altogether where the spur leaves.
let pen: Pose = { x: 5, y: 0, z: 0, heading: 0 };
pen = bend(pen, -36, 3, { width: 2.6, left: 'rail', right: 'kerb', stones: 1 });
pen = bend(pen, -18, 3, { width: 2.6, left: 'rail', right: 'none', stones: 1 });
pen = bend(pen, -18, 3, { width: 2.6, left: 'rail', right: 'kerb', stones: 1 });
pen = bend(pen, -18, 3, { width: 2.6, left: 'rail', right: 'board', stones: 1 });

// The spur: a thin wall-less tongue straight on from the tee, a board across
// its end, and the tunnel mouth in front of the board.
b.poly([[7.4, -0.5], [10.6, -0.5], [10.6, 0.5], [7.4, 0.5]], 0, { walls: ['none', 'board', 'none', 'none'] });
b.at(10.1, 0, 0, 0).tunnelIn('players').item(-1.2, 0);

// Up the ramp to the landing, where the bridge passes overhead. The ramp is
// steep enough that a ball that fails to climb it rolls straight back down.
b.at(pen.x, pen.y, pen.heading, 0).width(2.6).walls('rail', 'board').straight(2.6, { rise: LANDING }).straight(2.2).item(-0.9, 0);

// The corkscrew: three quarters of a banked circle, climbing a full level.
pen = bend({ x: 8, y: -7.8, z: LANDING, heading: 270 }, 270, 2.8, {
  width: 2.6,
  rise: TIER - LANDING,
  bank: 0.25,
  left: 'board',
  right: 'rail',
  stones: 6,
});

// Back west over the landing on the bridge, and onto the balcony.
b.at(pen.x, pen.y, pen.heading, TIER).width(2.6).walls('rail').straight(1.1).straight(3.4, { bridge: true }).straight(0.2, { width: MOUTH_S - MOUTH_N });

// The balcony green. Board round the back, a kerb along the south side, which
// overhangs the tee lane.
b.disc(GREEN.x, GREEN.y, GREEN.r, TIER, { wall: 'board', gaps: [[-56, 11], [34, 146]] });
b.wall(arc(GREEN.x, GREEN.y, GREEN.r - 0.02, 33.75, 146.25, 10), 'kerb');
// The apron that joins the lane's square end to the round rim, panel for panel.
const rim = [27, 28, 29, 30, 31, 0, 1].map((i): [number, number] => {
  const a = (i / 32) * Math.PI * 2;
  return [GREEN.x + Math.cos(a) * GREEN.r, GREEN.y + Math.sin(a) * GREEN.r];
});
b.poly([[6.1, GREEN.y + MOUTH_N], ...rim, [6.1, GREEN.y + MOUTH_S]], TIER, {
  walls: ['rail', 'none', 'none', 'none', 'none', 'none', 'none', 'rail', 'none'],
});
b.way(GREEN.x + 1.6, -5, TIER);
b.at(GREEN.x, GREEN.y, 0, TIER).tunnelOut('players', -1.7, 0).cup(1, 0);

export default b.build();
