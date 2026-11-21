import { HoleBuilder, type Side } from '../../builder';
import { CYAN, ORANGE } from '../palette';

// Floodlight Tower: climb a spiral of four levels round an open pit to the
// green on the lamp head at the top; falling off costs height, not the ball.
//
// Safe line: from the tee along the base lane and up the wide first ramp onto
//   level 1; along level 1 and round the corkscrew turret, which loops out over
//   the corner and comes back across level 1 as a bridge onto level 2; along the
//   narrow level 2 into the running track, which flings the ball up onto the
//   round level 3 pad; up the last ramp onto the lamp head.
// Spring (level 1): a pad near the far end of level 1, just short of where
//   level 2 crosses overhead. Cross it heading north-west and the ball is
//   thrown up onto level 2, skipping the whole corkscrew. Short or wide and it
//   drops into the pit.
// Tunnel (level 3): a thin spur with no walls runs off the pad over the pit.
//   Its tunnel comes out on the lamp head rolling straight at the cup. Off the
//   spur is down into the pit.
// Falling: every outside edge is boarded; the inside edges are kerbs over the
//   pit. A ball that falls lands in the pit (or, where level 2 crosses level 1,
//   on level 1), and the pit opens back onto the base lane by the first ramp.
const b = new HoleBuilder({ id: 'floodlight-tower', name: 'Floodlight Tower', par: 7, boards: [ORANGE, CYAN] });

const rad = (deg: number) => (deg * Math.PI) / 180;

// The spiral's centre lines: the east and west sides at x = -EW and +EW, the
// north and south sides at y = -NS and +NS. One level is a full unit of height.
const EW = 7.5;
const NS = 6.5;
const LANE = 3;
const PIT = { west: -EW + LANE / 2, east: EW - LANE / 2, north: -NS - 1.1, south: NS - 1.7 };
const PAD = { x: -EW, y: 4.6, r: 3, z: 3 };
const TOP = { x: 4.4, y: 4.6, r: 3, z: 4 };
// Ramps climb a level over this length: gentle enough that a ball short of the
// top stops on the ramp instead of rolling back, steep enough to need a firm putt.
const RAMP = 6.5;

/** Does a heading (degrees, 0 east, 90 south) fall in [from, to], going clockwise? */
function within(h: number, from: number, to: number): boolean {
  const span = (((to - from) % 360) + 360) % 360;
  return (((h - from) % 360) + 360) % 360 <= span;
}

/**
 * A round platform with air beneath it, so balls below roll under it. The
 * wall on each stretch of rim is chosen by its heading from the centre.
 */
function platform(c: { x: number; y: number; r: number; z: number }, wallAt: (heading: number) => Side): void {
  // 36 sides: every 10 degrees, so lanes can meet the rim exactly at corners.
  const n = 36;
  const pts: [number, number][] = [];
  const walls: Side[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360;
    pts.push([c.x + Math.cos(rad(a)) * c.r, c.y + Math.sin(rad(a)) * c.r]);
    walls.push(wallAt(((i + 0.5) / n) * 360));
  }
  b.poly(pts, c.z, { walls, bridge: true });
}

/** Points round an arc whose radius changes from r0 to r1, by heading. */
function arc(cx: number, cy: number, r0: number, r1: number, from: number, to: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = rad(from + (to - from) * t);
    const r = r0 + (r1 - r0) * t;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// ---------------------------------------------------------------- the pit
// Open ground in the middle of the tower, at the foot of everything. It runs
// on under level 2 so a ball off that level's kerb lands in it. Boards round
// three sides; the south side opens onto the base lane.
const seCorner = arc(EW - 3.5, NS - 3.5, 2, 1.8, 0, 90, 6);
b.poly(
  [[PIT.west, PIT.south], [PIT.west, PIT.north], [PIT.east, PIT.north], ...seCorner],
  0,
  { walls: ['board', 'board', 'board', ...seCorner.map((): Side => 'none')] },
);
b.at(0, -2, 0).item();

// ---------------------------------------------------------------- base
// A square deck with rounded corners for the tee, west of the tower.
const DECK = { x: -EW - 2.5, y: NS, half: 2.6 };
{
  const e = DECK.x + DECK.half;
  const w = DECK.x - DECK.half;
  const n = DECK.y - DECK.half;
  const s = DECK.y + DECK.half;
  const k = 0.8;
  const pts: [number, number][] = [
    [e, NS - 1.7], [e, n + k], [e - k, n], [w + k, n], [w, n + k], [w, s - k], [w + k, s], [e - k, s], [e, s - k], [e, NS + 1.7],
  ];
  // The edge from the last point back to the first is the mouth of the base lane.
  b.poly(pts, 0, { walls: [...pts.slice(0, -1).map((): Side => 'board'), 'none'] });
}

// The base lane runs east along the south side. Its inner kerb has a gap just
// before the first ramp: the way back out of the pit.
b.at(DECK.x + DECK.half, NS, 0)
  .width(3.4)
  .walls('kerb', 'board')
  .tee(-3.8)
  .straight(1.8)
  .straight(1.6, { left: 'none' })
  // The first ramp: wide and walled.
  .walls('rail', 'board')
  .straight(RAMP, { rise: 1 })
  .mark('level1');

// ---------------------------------------------------------------- level 1
// Round the south-east corner and north up the east side, to the foot of the
// corkscrew. The spring sits by the inner kerb just short of where level 2
// passes overhead.
b.goto('level1')
  .walls('kerb', 'board')
  .straight(1.5)
  .turn(-90, 3.5, { width: LANE, bank: 0.15 })
  .straight(6.4)
  .spring(0, -0.9)
  .item(-3.4)
  .straight(6.1);

// The corkscrew: three quarters of a circle out over the corner, climbing a
// level, coming back west across level 1.
b.walls('board', 'rail');
for (let i = 0; i < 6; i++) b.turn(45, 3, { rise: 1 / 6 });

// ---------------------------------------------------------------- level 2
// West along the north side: across level 1 as a bridge, then narrowing to
// 1.6 with only a kerb between it and the pit below.
b.walls('kerb', 'board')
  .straight(6, { bridge: true })
  .straight(2, { width: 1.6, bridge: true })
  .straight(4.5, { bridge: true })
  .item(-2.2)
  .straight(2, { width: LANE, bridge: true })
  .straight(0.5, { bridge: true })
  .turn(-90, 3, { bridge: true })
  // Running track up the whole of the next ramp: anything that touches it is
  // carried up, but it only pushes straight, so a ball that meets it at an
  // angle is driven into the inner kerb and can hop it into the pit.
  .walls('kerb', 'board')
  .straight(4.5, { rise: 1, boost: true })
  // The kerb stops short of the pad so it cannot clip a putt along the spur.
  .straight(0.6)
  .straight(0.4, { left: 'none' });

// ---------------------------------------------------------------- level 3
// A round pad. Ramp 3 comes in from the north, the last ramp leaves east, and
// the tunnel spur leaves north-east of it.
platform(PAD, (h) => (within(h, 240, 30) ? 'none' : 'board'));
b.way(PAD.x, PAD.y, PAD.z);

// The tunnel spur: thin, no walls, a board across the end. Its north edge
// leaves the pad's rim at a corner of the rim.
const SPUR = 1.1;
const spurRoot = { x: PAD.x + PAD.r * Math.cos(rad(280)), y: PAD.y + PAD.r * Math.sin(rad(280)) + SPUR / 2 };
b.at(spurRoot.x, spurRoot.y, 0, PAD.z)
  .width(SPUR)
  .walls('none')
  .route(false)
  .straight(6, { bridge: true })
  .cap('board')
  .tunnelIn('flood', -0.5)
  .item(-3);

// The last ramp, walled.
const rimX = PAD.r * Math.cos(rad(30));
b.at(PAD.x + rimX, PAD.y, 0, PAD.z).width(LANE).walls('rail').route(true).straight(TOP.x - rimX - (PAD.x + rimX), { rise: 1, bridge: true });

// ---------------------------------------------------------------- the top
// The lamp head: boards round the far side only.
platform(TOP, (h) => (within(h, -100, 100) ? 'board' : 'none'));
b.at(TOP.x + 0.6, TOP.y - 1, 0, TOP.z).cup();
b.at(TOP.x - 2, TOP.y - 1, 0, TOP.z).tunnelOut('flood');

export default b.build();
