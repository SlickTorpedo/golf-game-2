import { HoleBuilder, type Side } from '../../builder';
import { CYAN, ORANGE } from '../palette';

// The Concourse: sweep round the walkway under the stand, climb to the
// mezzanine by the turnstiles or the long ramp, and come down the spiral to
// the green the mezzanine curls round. Or hop off the mezzanine onto it.
//
// Sections:
//   1. Promenade. A wide lane from the tee sweeps round a long left-hand bend
//      past two pillars of the stand and flares open onto the fork.
//   2. The fork. A landing west of the green with two ways up to the gallery.
//      Short (straight ahead): three turnstiles across a wide walled hall. Get
//      through and the running track behind them flings the ball up the ramp.
//      One gap's arms sweep with you, the other's against you.
//      Long (out to the left): a wide banked ramp that loops round the outside
//      in a half circle, climbing gently. No timing, two or three putts.
//   3. Mezzanine (height 1.5). The gallery, a straight walkway down to the top
//      of the spiral, the balcony running back west from there above the
//      green's north rim, and the kerbed spiral down round the east of the
//      green and in through its rim.
//   4. Green. Round and boarded, with a bowl round the cup.
//
// Safe line: promenade, fork, the long loop, gallery, walkway, spiral, green.
// Shortcut: from the balcony or the top of the spiral, hop the inner kerb on
//   purpose. Below runs the squeeze, a thin dead-end walk at ground level off
//   the fork, between the mezzanine and the green. A firm hop carries it and
//   drops onto the green, skipping the spiral; a soft one falls into the
//   squeeze, and it is back to the fork and up again.
const b = new HoleBuilder({ id: 'concourse', name: 'The Concourse', par: 5, boards: [CYAN, ORANGE] });

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (deg: number, r: number): [number, number] => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r];

const GREEN_R = 3.2;
const DECK = 1.5;
// The squeeze runs between the green's rim and the foot of the balcony.
const SQUEEZE_IN = 3.15;
const SQUEEZE_OUT = 4.6;
// It runs on under the top of the spiral, so a hop off the spiral that falls short lands in it too.
const SQUEEZE_END = 345;
// The balcony and the spiral: a band round the green, just outside the squeeze.
const BAND_IN = 4.6;
const BAND_OUT = 7.2;
const BAND_MID = (BAND_IN + BAND_OUT) / 2;
const BAND_W = BAND_OUT - BAND_IN;

/**
 * A curved lane round the green's centre, laid panel by panel. Angles are
 * headings from the centre (0 east, 90 south); radius and height ease from
 * start to end. Walls may change along the way. `stones` lays route points.
 */
function ring(o: {
  from: number;
  to: number;
  r0: number;
  r1?: number;
  w: number;
  z0: number;
  z1?: number;
  inner: Side | ((deg: number) => Side);
  outer: Side | ((deg: number) => Side);
  bridge?: boolean;
  stones?: number;
}): void {
  const steps = Math.max(2, Math.ceil(Math.abs(o.to - o.from) / 6));
  const at = (t: number) => {
    const deg = o.from + (o.to - o.from) * t;
    const r = o.r0 + ((o.r1 ?? o.r0) - o.r0) * t;
    const z = o.z0 + ((o.z1 ?? o.z0) - o.z0) * t;
    return { deg, r, z, i: polar(deg, r - o.w / 2), u: polar(deg, r + o.w / 2) };
  };
  for (let k = 0; k < steps; k++) {
    const p = at(k / steps);
    const q = at((k + 1) / steps);
    const mid = (p.deg + q.deg) / 2;
    const inner = typeof o.inner === 'function' ? o.inner(mid) : o.inner;
    const outer = typeof o.outer === 'function' ? o.outer(mid) : o.outer;
    b.poly([p.i, p.u, q.u, q.i], [p.z, p.z, q.z, q.z], { walls: ['none', outer, 'none', inner], bridge: o.bridge });
  }
  for (let k = 1; k <= (o.stones ?? 0); k++) {
    const s = at(k / o.stones!);
    b.way(...polar(s.deg, s.r), s.z);
  }
}

/** Points along a circle, by heading angle (0 east, 90 south). */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) out.push(polar(from + ((to - from) * i) / steps, r).map((v, k) => v + (k ? cy : cx)) as [number, number]);
  return out;
}

// ------------------------------------------------------------ 1. Promenade
// The sweep ends heading north into the fork's south side.
const PROM_W = 4;
const SWEEP_R = 12;
const SWEEP = 46;
const TEE_RUN = 3;
const ARRIVE_X = -10.5;
const ARRIVE_Y = 6.5;
// The lane flares as it opens onto the fork.
const MOUTH_W = 10;
const FLARE = 3;
// Work back from where the sweep arrives to where the tee lane starts.
const sweepFrom = 270 + SWEEP;
const sweepX = ARRIVE_X - SWEEP_R - SWEEP_R * Math.sin(rad(sweepFrom));
const sweepY = ARRIVE_Y + SWEEP_R * Math.cos(rad(sweepFrom));
b.at(sweepX - TEE_RUN * Math.cos(rad(sweepFrom)), sweepY - TEE_RUN * Math.sin(rad(sweepFrom)), sweepFrom)
  .width(PROM_W)
  .walls('rail', 'board')
  .cap('board')
  .tee(1.2)
  .straight(TEE_RUN)
  .turn(-SWEEP / 2, SWEEP_R)
  // Pillars of the stand, out by the boards where a ball riding them runs.
  .cone(-1.5, 1.2)
  .item(-2.5, -0.6)
  .turn(-SWEEP / 2, SWEEP_R)
  .cone(-2.8, 1.1)
  .straight(FLARE, { width: MOUTH_W });

// ------------------------------------------------------------ 2. The fork
// A landing with rounded corners. The turnstiles leave from its north side,
// the long ramp from its west end, and the squeeze curls off its north-east
// corner round the green.
const FORK = { x0: -17, x1: -4.3, y0: -3.5, y1: ARRIVE_Y - FLARE };
const LONG_W = 4;
const GATE = { x0: -13.2, x1: -4, mid: -8.6, y: -5.75, exit: -7.3 };
const CORNER = 1.4;
const [sqInX, sqInY] = polar(225, SQUEEZE_IN);
const [sqOutX, sqOutY] = polar(225, SQUEEZE_OUT);
const southWest = arc(FORK.x0 + CORNER, FORK.y1 - CORNER, CORNER, 90, 180, 4);
const northWest = arc(FORK.x0 + CORNER, FORK.y0 + CORNER, CORNER, 180, 270, 4);
const forkEdge: [[number, number], Side][] = [
  [[sqOutX, sqOutY], 'none'],
  [[sqInX, sqInY], 'board'],
  [[FORK.x1, 0.4], 'board'],
  [[FORK.x1, FORK.y1], 'board'],
  [[ARRIVE_X + MOUTH_W / 2, FORK.y1], 'none'],
  [[ARRIVE_X - MOUTH_W / 2, FORK.y1], 'board'],
  ...southWest.map((p): [[number, number], Side] => [p, 'board']),
  [[FORK.x0, LONG_W / 2], 'none'],
  [[FORK.x0, -LONG_W / 2], 'board'],
  ...northWest.map((p): [[number, number], Side] => [p, 'board']),
  [[GATE.x0 + 1.2, FORK.y0], 'none'],
  [[GATE.x1 - 1.2, FORK.y0], 'board'],
];
b.poly(
  forkEdge.map(([p]) => p),
  0,
  { walls: forkEdge.map(([, w]) => w) },
);

// The squeeze: a thin dead-end walk round the green's north rim, under the
// balcony. The green's board is one wall, the foot of the balcony the other.
ring({ from: 225, to: SQUEEZE_END, r0: (SQUEEZE_IN + SQUEEZE_OUT) / 2, w: SQUEEZE_OUT - SQUEEZE_IN, z0: 0, inner: 'none', outer: 'board' });
b.wall([polar(SQUEEZE_END, SQUEEZE_IN), polar(SQUEEZE_END, SQUEEZE_OUT)], 'board');

// ------------------------------------------------------------ 3. Mezzanine
// The gallery: a long deck with a bowed back wall where both ways up arrive,
// the long loop at its west end and the wide turnstile ramp from below. The
// walkway leaves its east end, cut square to the walkway's line.
const GALLERY = { x0: FORK.x0, y0: -13.5, y1: -17.6, bow: 1.2 };
const WALK_W = 2.6;
const WALK_FROM: [number, number] = [-2.6, -15.6];
const SPIRAL_FROM = 315;
const WALK_JOIN = 307;
const [walkToX, walkToY] = polar(WALK_JOIN, BAND_MID);
const WALK = (Math.atan2(walkToY - WALK_FROM[1], walkToX - WALK_FROM[0]) * 180) / Math.PI;
const walkLen = Math.hypot(walkToX - WALK_FROM[0], walkToY - WALK_FROM[1]);
const walkSide = (side: number): [number, number] => [
  WALK_FROM[0] - Math.sin(rad(WALK)) * side * (WALK_W / 2),
  WALK_FROM[1] + Math.cos(rad(WALK)) * side * (WALK_W / 2),
];
// The gallery's north-east edge carries straight on from the walkway's left rail.
const [leftX, leftY] = walkSide(-1);
const backToNorth = (leftY - GALLERY.y1) / Math.sin(rad(WALK));
const galleryNE = leftX - Math.cos(rad(WALK)) * backToNorth;
// Its back wall bows out to the north.
const galleryBack: [number, number][] = [];
for (let k = 1; k < 8; k++) {
  const t = k / 8;
  galleryBack.push([GALLERY.x0 + (galleryNE - GALLERY.x0) * t, GALLERY.y1 - GALLERY.bow * Math.sin(Math.PI * t)]);
}
const galleryMid = (GALLERY.y0 + GALLERY.y1) / 2;
const galleryEdge: [[number, number], Side][] = [
  [[GALLERY.x0, GALLERY.y0], 'board'],
  [[GALLERY.x0, galleryMid + LONG_W / 2], 'none'],
  [[GALLERY.x0, galleryMid - LONG_W / 2], 'board'],
  [[GALLERY.x0, GALLERY.y1], 'board'],
  ...galleryBack.map((p): [[number, number], Side] => [p, 'board']),
  [[galleryNE, GALLERY.y1], 'board'],
  [walkSide(-1), 'none'],
  [walkSide(1), 'board'],
  [[GATE.x1, GALLERY.y0], 'none'],
  [[GATE.x0, GALLERY.y0], 'board'],
];
b.poly(
  galleryEdge.map(([p]) => p),
  DECK,
  { walls: galleryEdge.map(([, w]) => w) },
);

// The long way up: out of the west end of the fork, a banked ramp loops right
// round in a half circle, climbing gently all the way, into the gallery's end.
// It is wide, so a ball (or a bot) can cut across from the start to halfway
// round and from there to the top: the extra route points sit out by its
// outside board where those lines run.
const LOOP_R = -galleryMid / 2;
const loopOut = (deg: number): [number, number] => [FORK.x0 - Math.sin(rad(deg)) * (LOOP_R + 1.5), -LOOP_R + Math.cos(rad(deg)) * (LOOP_R + 1.5)];
b.at(FORK.x0, 0, 180)
  .width(LONG_W)
  .walls('board', 'rail')
  .turn(90, LOOP_R, { rise: DECK / 2, bank: 0.25 })
  .item(0, 0)
  .way(...loopOut(85), DECK / 2)
  .turn(90, LOOP_R, { rise: DECK / 2, bank: 0.25 })
  .straight(0.1)
  .way(WALK_FROM[0] - Math.cos(rad(WALK)) * 1.2, WALK_FROM[1] - Math.sin(rad(WALK)) * 1.2, DECK);

// Where a side of the walkway (1 right, -1 left), carried straight on, first
// meets a circle round the green: how far along, and at what angle round it.
const meets = (side: number, radius: number): { along: number; deg: number } => {
  const [sx, sy] = walkSide(side);
  const fx = Math.cos(rad(WALK));
  const fy = Math.sin(rad(WALK));
  const ahead = sx * fx + sy * fy;
  const along = -ahead - Math.sqrt(ahead ** 2 - (sx * sx + sy * sy - radius ** 2));
  return { along, deg: ((Math.atan2(sy + fy * along, sx + fx * along) * 180) / Math.PI + 360) % 360 };
};
// The band has no outer wall where the walkway lands on it.
const joinRight = meets(1, BAND_OUT);
const joinLeft = meets(-1, BAND_OUT);
// A ball rolling straight off the walkway meets the balcony's inner edge no
// nearer than this.
const KERB_TO = meets(1, BAND_IN).deg - 4;

// The walkway: straight down from the gallery onto the band at the top of the
// spiral. Each rail stops where its side reaches the band.
b.at(...WALK_FROM, WALK, DECK)
  .width(WALK_W)
  .walls('rail')
  .straight(joinRight.along)
  .straight(joinLeft.along - joinRight.along, { right: 'none' })
  .straight(walkLen - joinLeft.along, { left: 'none', right: 'none' });

// The band where the walkway lands, and the balcony running back west from it
// above the squeeze to a dead end, kerbed on the inside over the green.
const BALCONY_FROM = 240;
ring({
  from: BALCONY_FROM,
  to: SPIRAL_FROM,
  r0: BAND_MID,
  w: BAND_W,
  z0: DECK,
  // Rail where a ball rolling straight off the walkway meets the edge, so it
  // is turned along the balcony instead of over it.
  inner: (deg) => (deg > BALCONY_FROM + 6 && deg < KERB_TO ? 'kerb' : 'rail'),
  outer: (deg) => (deg > joinRight.deg && deg < joinLeft.deg ? 'none' : 'board'),
  bridge: true,
});
b.wall([polar(BALCONY_FROM, BAND_IN), polar(BALCONY_FROM, BAND_OUT)], 'board', DECK);
b.at(...polar(282, 5.4), 0, DECK).item();

// The spiral: steeply down round the east of the green, then a short run in
// that meets the green's rim along a straight edge.
const SPIRAL_TO = 390;
const SPIRAL_LOW = 0.4;
const MOUTH = { from: 40, to: 64 };
ring({ from: SPIRAL_FROM, to: SPIRAL_TO, r0: BAND_MID, r1: 5.2, w: BAND_W, z0: DECK, z1: SPIRAL_LOW, inner: 'kerb', outer: 'board', bridge: true, stones: 2 });
const runIn = (t: number) => ({
  i: polar(SPIRAL_TO + (MOUTH.from + 360 - SPIRAL_TO) * t, 5.2 - BAND_W / 2 + (GREEN_R - 5.2 + BAND_W / 2) * t),
  u: polar(SPIRAL_TO + (MOUTH.to + 360 - SPIRAL_TO) * t, 5.2 + BAND_W / 2 + (GREEN_R - 5.2 - BAND_W / 2) * t),
  z: SPIRAL_LOW * (1 - t),
});
for (let k = 0; k < 6; k++) {
  const p = runIn(k / 6);
  const q = runIn((k + 1) / 6);
  b.poly([p.i, p.u, q.u, q.i], [p.z, p.z, q.z, q.z], { walls: ['none', 'board', 'none', k < 3 ? 'kerb' : 'none'], bridge: true });
}
for (const t of [0.5, 1]) {
  const s = runIn(t);
  b.way((s.i[0] + s.u[0]) / 2, (s.i[1] + s.u[1]) / 2, s.z);
}

// ------------------------------------------------------------ 4. Green
// Round and boarded, with a flat rim and a shallow bowl in the middle: the cup
// sits in the bowl's flat bottom, and putts across the bowl curl toward it.
const BOWL = { r: 2.4, flat: 0.6, depth: 0.15 };
const greenZ = (r: number) =>
  r <= BOWL.flat ? -BOWL.depth : r >= BOWL.r ? 0 : -BOWL.depth * (0.5 + 0.5 * Math.cos((Math.PI * (r - BOWL.flat)) / (BOWL.r - BOWL.flat)));
const GREEN_RINGS = [0, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, GREEN_R];
const GREEN_SEGS = 48;
for (let k = 1; k < GREEN_RINGS.length; k++) {
  const [r0, r1] = [GREEN_RINGS[k - 1], GREEN_RINGS[k]];
  for (let j = 0; j < GREEN_SEGS; j++) {
    const [a0, a1] = [(j * 360) / GREEN_SEGS, ((j + 1) * 360) / GREEN_SEGS];
    if (r0 === 0) b.poly([[0, 0], polar(a0, r1), polar(a1, r1)], [greenZ(0), greenZ(r1), greenZ(r1)]);
    else b.poly([polar(a0, r0), polar(a0, r1), polar(a1, r1), polar(a1, r0)], [greenZ(r0), greenZ(r1), greenZ(r1), greenZ(r0)]);
  }
}
b.wall(arc(0, 0, GREEN_R, MOUTH.to, MOUTH.from + 360, 60), 'board', 0);
b.at(0, 0, 0).cup();

// ------------------------------------------------------------ the turnstiles
// Off the bots' route: the gate across the north side of the fork. Behind it,
// running track the full width of the hall flings any ball that gets through
// up the wide ramp onto the gallery.
b.poly(
  [
    [GATE.x0 + 1.2, FORK.y0],
    [GATE.x0, -4.5],
    [GATE.x0, GATE.exit],
    [GATE.x1, GATE.exit],
    [GATE.x1, -4.5],
    [GATE.x1 - 1.2, FORK.y0],
  ],
  0,
  { walls: ['board', 'board', 'none', 'board', 'board', 'none'] },
);
// Short fins from the side walls close the gaps outside the outer turnstiles.
b.wall([[GATE.x0, GATE.y], [GATE.x0 + 0.3, GATE.y]], 'board');
b.wall([[GATE.x1, GATE.y], [GATE.x1 - 0.3, GATE.y]], 'board');
b.at(GATE.mid, GATE.y, 270).route(false).spinner(0, -2.75, 1).spinner(0, 0, -1).spinner(0, 2.75, 1).item(1.8, 1.375);
b.at(GATE.mid, GATE.exit, 270)
  .width(GATE.x1 - GATE.x0)
  .walls('board')
  .straight(1.5, { boost: true })
  // A flat step between track and ramp: a ball that rolls back settles here
  // instead of being thrown back and forth at the foot of the ramp.
  .straight(0.5)
  .straight(GATE.exit - 2 - GALLERY.y0 + 0.1, { rise: DECK });

export default b.build();
