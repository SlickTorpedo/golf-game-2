import { HoleBuilder, type Side } from '../../builder';
import { CYAN, ORANGE } from '../palette';

// Car Park: find your own way through a field of parked-car bays, ride the
// half-circle ramp up to the top deck, and come back over the bays and down
// the exit ramp to the green in the street behind the fence. Or jump the fence.
//
// Safe line (about 85 units): down the left of the entrance lane, past the
//   ticket barrier and through the wide gap in the first row of bays; south-east
//   across the aisle and its speed bump to the wide gap in the second row; east
//   to the foot of the ramp. The lead-in is running track that carries any ball
//   that reaches it round the half circle (board outside) onto the turning deck
//   at the top. From there north over the bays on the bridge: once a ball is on
//   the steep exit ramp it rolls down onto the green on its own.
// Other ways across the bays: the narrow gap with a cone in it further down the
//   first row, the more direct line to the second row's gap; or the kerb lane
//   along the south edge, the only side of the car park with nothing but a kerb
//   between the ball and the outside. Driven hard across the deck, a ball goes
//   over it.
// Shortcut: where the lead-in meets the half circle, a stretch of the outside
//   board is only a kerb, with a kicker behind it pointing at the fence. Keep to
//   the left or far right of the lead-in and the ball rides the board round; send
//   it firmly up the right of centre and it hops the kerb, flies the fence into
//   the street two levels below, and skips the whole top deck. Short, and it
//   drops into the alley that runs round the ramp, back in the bays.
const b = new HoleBuilder({ id: 'car-park', name: 'Car Park', par: 6, boards: [ORANGE, CYAN] });

type Pt = [number, number];
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Points round a circle, by heading (0 east, 90 south), from one heading to another. */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = rad(from + ((to - from) * i) / steps);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// The entrance lane meets the deck here, heading north-east. A ball sent down
// its left side passes clear of the ticket barrier and through the first row's
// wide gap.
const MOUTH = { x: 0, y: 11, heading: -29.3, width: 3.2 };
// The half-circle ramp turns round this point. Angles round it are counted
// from its east side going north, the way the ramp climbs.
const RAMP = { x: 22.5, y: 6, r: 4.5, width: 3 };
// The lead-in is running track: it carries any ball that reaches it up and round.
const LEAD_FOOT = 11.5;
const LEAD_TOP = 0.3;
const UPPER = 1.5;
const rampZ = (deg: number) => LEAD_TOP + ((UPPER - LEAD_TOP) * deg) / 180;
const rampEdge = (deg: number, r = RAMP.r + RAMP.width / 2): Pt => [RAMP.x + Math.cos(rad(deg)) * r, RAMP.y - Math.sin(rad(deg)) * r];
// The kerbed stretch of the outside board (angles round the ramp), and the kicker behind it.
const GAP = { from: 26, to: 44 };
const KICK = { length: 1.4, lip: 1.0 };
// The fence between the car park and the street follows the ramp round at this radius.
const FENCE_R = 9.5;
const FENCE = { from: 35, to: 115 };
// The street outside the fence, with the green in it, is two levels below the car park.
const STREET = -1;
// The upper deck's way down runs north at this x, from the hairpin to the green;
// it becomes the steep exit ramp where it enters the slot in the deck.
const LEG = { x: RAMP.x - RAMP.r - 6, from: RAMP.y, slot: 1, to: -6 };

// ---------------------------------------------------------------- 1. Entrance
// A walled lane from the tee, widening round the ticket barrier, which stands
// right of centre: time it up the middle, or squeeze by on the left.
{
  const length = 9.2;
  const h = rad(MOUTH.heading);
  b.at(MOUTH.x - Math.cos(h) * length, MOUTH.y - Math.sin(h) * length, MOUTH.heading)
    .width(MOUTH.width)
    .walls('rail', 'board')
    .cap('board')
    .tee(1.2, -0.9)
    .straight(2)
    .straight(1.2, { width: 5 })
    .straight(3)
    .spinner(-1.5, 0.7)
    .straight(1.2, { width: MOUTH.width })
    .straight(length - 7.4);
}

// ---------------------------------------------------------------- 2. The bays
// One big deck. Boards round the west and east, the fence along the north,
// and only a kerb along the curved south edge. The south-west corner is cut
// square to the entrance lane.
{
  const h = rad(MOUTH.heading + 90);
  const side = (d: number): Pt => [MOUTH.x + Math.cos(h) * d, MOUTH.y + Math.sin(h) * d];
  const edges: [Pt, Side][] = [
    [[0.5, -1.2], 'board'],
    [[-0.6, 3], 'board'],
    [[-1.6, 7], 'board'],
    [side(-3), 'board'],
    [side(-MOUTH.width / 2), 'none'],
    [side(MOUTH.width / 2), 'board'],
    [side(4), 'board'],
    [[3.6, 16.7], 'kerb'],
    [[8, 17.6], 'kerb'],
    [[14, 17.9], 'kerb'],
    [[20, 17.7], 'kerb'],
    [[25, 17.1], 'kerb'],
    [[28.6, 16], 'board'],
    [[30.5, 14], 'board'],
    [[30.5, LEAD_FOOT], 'board'],
    // Under the lead-in and the start of the half circle, which carry their own walls.
    [[28.5, LEAD_FOOT], 'none'],
  ];
  for (const p of arc(RAMP.x, RAMP.y, RAMP.r + RAMP.width / 2, 0, -FENCE.from, 4)) edges.push([p, 'none']);
  // A board closes the east end of the alley round the ramp.
  edges[edges.length - 1][1] = 'board';
  // The fence, curving round the ramp.
  for (const p of arc(RAMP.x, RAMP.y, FENCE_R, -FENCE.from, -FENCE.to, 10)) edges.push([p, 'board']);
  // The exit ramp runs down through a slot in the north edge, boarded on both sides.
  const slot = { south: LEG.slot, west: LEG.x - 1.5, east: LEG.x + 1.5 };
  edges.push(
    [[slot.east + 0.1, -2.7], 'board'],
    [[slot.east, slot.south], 'none'],
    [[slot.west, slot.south], 'board'],
    [[slot.west - 0.1, -2.58], 'board'],
    [[6, -2.3], 'board'],
  );
  b.poly(edges.map((e) => e[0]), 0, { walls: edges.map((e) => e[1]) });
}

/** A row of bays: a straight rail from one end to the other, laid in pieces between the gaps. */
function row(a: Pt, z: Pt, pieces: [number, number][]): (t: number) => Pt {
  const at = (t: number): Pt => [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t];
  for (const [t0, t1] of pieces) b.wall([at(t0), at(t1)], 'rail');
  return at;
}

/** Angled dividers between parked cars along one side of a row (side 1 east, -1 west). */
function stalls(at: (t: number) => Pt, ts: number[], side: 1 | -1, length = 1.6): void {
  const [ax, ay] = at(0);
  const [zx, zy] = at(1);
  const len = Math.hypot(zx - ax, zy - ay);
  const ux = (zx - ax) / len;
  const uy = (zy - ay) / len;
  const turn = rad(-50 * side);
  const dx = ux * Math.cos(turn) - uy * Math.sin(turn);
  const dy = ux * Math.sin(turn) + uy * Math.cos(turn);
  for (const t of ts) {
    const [x, y] = at(t);
    b.wall([[x, y], [x + dx * length, y + dy * length]], 'kerb');
  }
}

/** A speed bump: a long low ridge from one point to another. */
function bump(a: Pt, z: Pt, halfWidth = 0.55, height = 0.1): void {
  const len = Math.hypot(z[0] - a[0], z[1] - a[1]);
  const nx = (-(z[1] - a[1]) / len) * halfWidth;
  const ny = ((z[0] - a[0]) / len) * halfWidth;
  const base = 0.003;
  b.poly([[a[0] - nx, a[1] - ny], [z[0] - nx, z[1] - ny], z, a], [base, base, height, height]);
  b.poly([a, z, [z[0] + nx, z[1] + ny], [a[0] + nx, a[1] + ny]], [height, height, base, base]);
}

// First row: the wide gap faces the entrance. Further south, a narrow gap with a
// cone in it opens the more direct way to the second row's wide gap, if you
// can thread it. Another cone sits in the kerb lane at the row's end.
const rowA = row([5.6, -2.3], [7.6, 16], [[0, 0.4], [0.54, 0.84], [0.92, 0.975]]);
stalls(rowA, [0.6, 0.72], 1);
b.at(...rowA(0.88), 0).cone();
b.at(...rowA(1.05), 0).cone();
// Second row, leaning the other way and broken by the turning deck:
// wide gap to the south, an opening at the fence into the alley round the
// ramp, and a cone in the kerb lane.
const rowB = row([15.6, -0.6], [14, 15.9], [[0, 0.376], [0.667, 0.764], [0.921, 1]]);
stalls(rowB, [0.1, 0.22, 0.34], -1);
b.at(...rowB(1.06), 0).cone();

bump([1.5, 4.5], [3.6, 1.2]);
bump([8.4, 9.6], [12, 7.6]);
bump([17.6, 11], [19.4, 15.4]);
// The oil patch, where the kerb lane meets the way to the ramp.
b.disc(22.4, 15.5, 1.5, 0.002, { mat: 'ice' });

// Pickups: one in a dead-end bay, one out on the kerb lane.
b.at(...rowA(0.66), 0).item(0.75, 0.4);
b.at(20, 16.7, 0, 0).item();

// The bots take the safe zig-zag.
b.way(...rowA(0.47)).way(...rowB(0.84)).way(25.4, 13.4).way(25.9, 7.5);

// ---------------------------------------------------------------- 3. The ramp
// A lead-in of running track north, then the half circle round to the left,
// climbing to the top deck. Rail inside, board outside, kerb at the kicker.
b.at(RAMP.x + RAMP.r, LEAD_FOOT, 270)
  .width(RAMP.width)
  .walls('rail', 'board')
  .route(false)
  .straight(LEAD_FOOT - RAMP.y, { rise: LEAD_TOP, boost: true })
  .turn(-GAP.from, RAMP.r, { rise: rampZ(GAP.from) - LEAD_TOP })
  .turn(-(GAP.to - GAP.from), RAMP.r, { rise: rampZ(GAP.to) - rampZ(GAP.from), right: 'kerb' })
  .turn(-(180 - GAP.to), RAMP.r, { rise: UPPER - rampZ(GAP.to) })
  .route(true);
// Bots climb it along the outside, clear of the gap.
for (const deg of [35, 100, 130]) b.way(...rampEdge(deg, 5));
// The half circle is solid down to the deck. Inside it, a concrete core down to
// the lead-in's foot, boarded where it faces the bays.
{
  const inner = RAMP.r - RAMP.width / 2 - 0.02;
  b.poly([...arc(RAMP.x, RAMP.y, inner, 180, 360, 12), [RAMP.x + inner, LEAD_FOOT], [RAMP.x - inner, LEAD_FOOT]], 0.6);
  b.wall([[RAMP.x - inner, RAMP.y], [RAMP.x - inner, LEAD_FOOT], [RAMP.x + inner, LEAD_FOOT]], 'board', 0);
}

// The kicker: a short steep tongue north out through the kerbed gap, with a
// board on its east side and nothing at its west side or its end.
{
  const steps = [GAP.from, (GAP.from + GAP.to) / 2, GAP.to];
  const near = steps.map((d) => rampEdge(d));
  const far = [near[near.length - 1], near[0]].map(([x, y]): Pt => [x, y - KICK.length]);
  b.poly([...near, ...far], [...steps.map(rampZ), KICK.lip, KICK.lip], {
    walls: ['none', 'none', 'none', 'none', 'board'],
  });
}

// ---------------------------------------------------------- 4. Upper deck
// The half circle tops out onto a round-ended turning deck (solid, like the
// ramp) that sends you back north: a bridge over the bays, easing down, then the
// steep exit ramp through the slot in the fence line. A ball that reaches the
// exit ramp rolls the rest of the way down onto the green.
{
  const turning = { x: LEG.x + 3, y: LEG.from, r: 4.5 };
  const mouth = 6; // the bridge leaves the turning deck wide and narrows to 3
  const rim = arc(turning.x, turning.y, turning.r, 0, 180, 16);
  b.poly([...rim, [LEG.x + mouth / 2, LEG.from], [LEG.x + 4.5, LEG.from]], UPPER, {
    walls: [...rim.slice(1).map((): Side => 'board'), 'none', 'rail', 'none'],
  });
  b.wall([[LEG.x - mouth / 2, LEG.from], [turning.x - turning.r, LEG.from]], 'rail', UPPER);
  b.at(turning.x, turning.y + 2.5, 0, UPPER).item();
  b.way(LEG.x + 4.5, LEG.from + 2.8);
  const bridgeEnd = 0.9;
  const drop = (bridgeEnd - UPPER) / (LEG.from - LEG.slot);
  b.at(LEG.x, LEG.from, 270, UPPER)
    .width(mouth)
    .walls('rail')
    .straight(3, { width: 3, rise: drop * 3, bridge: true })
    .straight(LEG.from - LEG.slot - 3, { rise: drop * (LEG.from - LEG.slot - 3), bridge: true })
    .straight(LEG.slot - LEG.to, { rise: STREET - bridgeEnd });
  // The turning deck and the back of the half circle are clad with boards at
  // deck level, where they face the bays.
  b.wall(arc(turning.x, turning.y, turning.r, 0, 180, 12), 'board', 0);
  b.wall(arc(RAMP.x, RAMP.y, RAMP.r + RAMP.width / 2, 180, 270, 6), 'board', 0);
  // At both ends of the bridge a board on the deck closes off the space underneath.
  b.wall([[LEG.x - mouth / 2, LEG.from], [LEG.x + mouth / 2, LEG.from]], 'board', 0);
  b.wall([[LEG.x - 1.5, LEG.slot], [LEG.x + 1.5, LEG.slot]], 'board', 0);
}

// ---------------------------------------------------------- 5. Street and green
// Outside the fence: the green at the west end, the open street east of it
// where jumpers land.
{
  const GREEN = { x: 12.5, y: -9, r: 3.6 };
  const edges: [Pt, Side][] = [[[LEG.x + 1.6, LEG.to], 'none']];
  for (const p of arc(GREEN.x, GREEN.y, GREEN.r, 124, 300, 12)) edges.push([p, 'board']);
  edges.push([[19, -11.3], 'board'], [[31.5, -11], 'board'], [[34.5, -8.5], 'board'], [[34.8, 11], 'board'], [[30.6, LEAD_FOOT - 0.1], 'board']);
  // The street wraps round behind the ramp, so a jump knocked sideways still lands in it.
  edges.push([[RAMP.x + RAMP.r + RAMP.width / 2 + 0.05, LEAD_FOOT - 0.1], 'none']);
  for (const p of arc(RAMP.x, RAMP.y, RAMP.r + RAMP.width / 2 + 0.05, 0, -FENCE.from, 4)) edges.push([p, 'none']);
  // Back along the fence: the deck's board already stands there.
  for (const p of arc(RAMP.x, RAMP.y, FENCE_R, -FENCE.from, -FENCE.to, 10)) edges.push([p, 'none']);
  edges.push([[LEG.x + 1.6, -2.7], 'none']);
  b.poly(edges.map((e) => e[0]), STREET, { walls: edges.map((e) => e[1]) });
  b.at(GREEN.x, GREEN.y, 0, STREET).cup();
  // The jumpers' prize.
  b.at(26, -5, 0, STREET).item();
}

export default b.build();
