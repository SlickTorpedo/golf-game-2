import { HoleBuilder } from '../../builder';
import { CYAN, VIOLET } from '../palette';

// The Terraces: get down a curved bank of standing terraces to a green at
// pitch level, past crush barriers, a leaking gutter and your own nerve.
//
// The bank is a slice of the stadium bowl: every row is an arc round the
// centre spot, so the treads curve towards the pitch at both ends.
//
// Safe line: along the top walkway to aisle A, down its upper flight to the
//   cross-aisle on row 3, along that and down the lower flight to row 6,
//   then over the east crossing onto the green.
// Dropping: putt down through gaps in the crush barriers. A ball that finds a
//   gap keeps rolling and can run down several rows by itself; the staggered
//   barriers stop it somewhere new each time. Row 6 stands over the gutter,
//   so the last step is a crossing or a ball in the water.
// Shortcut: the gantry over the top rows, in line with the flag. Running
//   track and a kicker throw the ball over the bank; hit right it lands on
//   the green, short and it is in the gutter.
const b = new HoleBuilder({ id: 'terraces', name: 'The Terraces', par: 6, boards: [VIOLET, CYAN] });

type Pt = [number, number];
type Span = [number, number];
const rad = (deg: number) => (deg * Math.PI) / 180;
/** A point in the bowl: distance from the centre spot and heading angle (0 east, 90 south). */
const at = (r: number, th: number): Pt => [r * Math.cos(rad(th)), r * Math.sin(rad(th))];
const angleOf = (p: Pt) => ((Math.atan2(p[1], p[0]) * 180) / Math.PI + 360) % 360;
/** Points along an arc round the centre spot, from one angle to another. */
function arc(r: number, from: number, to: number): Pt[] {
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / 2));
  return Array.from({ length: n + 1 }, (_, i) => at(r, from + ((to - from) * i) / n));
}

// The bank runs from the west end (boarded) to the east end (open).
const WEST = 234;
const EAST = 306;

// The rows, top to bottom: inner and outer radius, height. Row 3 is deeper:
// it doubles as the cross-aisle where the aisles change flight.
interface Row {
  ri: number;
  ro: number;
  z: number;
}
const WALKWAY: Row = { ri: 41.5, ro: 46, z: 3.5 };
const ROWS: Row[] = [
  WALKWAY,
  { ri: 39, ro: 41.5, z: 3 },
  { ri: 36.5, ro: 39, z: 2.5 },
  { ri: 33.5, ro: 36.5, z: 2 },
  { ri: 31, ro: 33.5, z: 1.5 },
  { ri: 28.5, ro: 31, z: 1 },
  { ri: 26, ro: 28.5, z: 0.5 },
];
const ROW3 = ROWS[3];
const ROW5 = ROWS[5];
const ROW6 = ROWS[6];

// The gutter at the foot of the bank, and the D-shaped green beyond it.
const GUTTER_IN = 23.8;
const GREEN_TH = 259;
const GREEN_R = 6;
const C = at(GUTTER_IN - GREEN_R, GREEN_TH);
const CROSSINGS = [GREEN_TH - 9, GREEN_TH + 4];
const GANTRY_TH = GREEN_TH;

// ------------------------------------------------------------- aisles
// An aisle flight is a straight ramp cut down through two rows at an angle,
// walled with rails. Its height goes with the distance from the centre spot,
// like the rows it cuts through, so it meets them flush top and bottom. It
// is steep enough that a ball never stops on it: it runs down to the row below.
interface Flight {
  /** The row whose front edge it starts from, and the row it lands on. */
  top: Row;
  bottom: Row;
  thTop: number;
  thBottom: number;
}
const AISLE_W = 2.4;
const AISLE_A: Flight[] = [
  { top: WALKWAY, bottom: ROW3, thTop: 290, thBottom: 284.5 },
  { top: ROW3, bottom: ROW6, thTop: 265.5, thBottom: 262 },
];
const AISLE_B: Flight[] = [
  { top: WALKWAY, bottom: ROW3, thTop: 300, thBottom: 295 },
  { top: ROW3, bottom: ROW6, thTop: 301.5, thBottom: 298 },
];
const FLIGHTS = [...AISLE_A, ...AISLE_B];

interface Line {
  p: Pt;
  d: Pt;
}
/** One side of a flight: s = 1 for its west side, -1 for its east side. */
function side(f: Flight, s: number): Line {
  const a = at(f.top.ri, f.thTop);
  const e = at(f.bottom.ro, f.thBottom);
  const len = Math.hypot(e[0] - a[0], e[1] - a[1]);
  const d: Pt = [(e[0] - a[0]) / len, (e[1] - a[1]) / len];
  return { p: [a[0] - d[1] * s * (AISLE_W / 2), a[1] + d[0] * s * (AISLE_W / 2)], d };
}
/** Where a line first crosses the circle of radius r on its way in. */
function cross(l: Line, r: number): Pt {
  const pd = l.p[0] * l.d[0] + l.p[1] * l.d[1];
  const t = -pd - Math.sqrt(pd * pd - (l.p[0] ** 2 + l.p[1] ** 2) + r * r);
  return [l.p[0] + l.d[0] * t, l.p[1] + l.d[1] * t];
}
/** The angles a flight's sides cross radius r at, west first. */
const span = (f: Flight, r: number): Span => [angleOf(cross(side(f, 1), r)), angleOf(cross(side(f, -1), r))];

function layFlight(f: Flight): void {
  const steps = 10;
  const sides = [side(f, 1), side(f, -1)];
  const [r0, r1] = [f.top.ri, f.bottom.ro];
  for (let i = 0; i < steps; i++) {
    const [ra, rb] = [r0 + ((r1 - r0) * i) / steps, r0 + ((r1 - r0) * (i + 1)) / steps];
    const [za, zb] = [f.top.z + ((f.bottom.z - f.top.z) * i) / steps, f.top.z + ((f.bottom.z - f.top.z) * (i + 1)) / steps];
    const [wa, ea] = sides.map((l) => cross(l, ra));
    const [wb, eb] = sides.map((l) => cross(l, rb));
    b.poly([wa, ea, eb, wb], [za, za, zb, zb], { walls: ['none', 'rail', 'none', 'rail'] });
  }
}

/**
 * A ball comes off the foot of a flight with pace. Where it would meet the
 * front of the row it lands on, from either side of the foot, rolling either
 * straight on or straight down the bank: a board goes there.
 */
function footBoard(f: Flight): Span {
  const row = f.bottom;
  const angles: number[] = [];
  for (const s of [1, -1]) {
    const l = side(f, s);
    const foot = cross(l, row.ro);
    angles.push(angleOf(cross({ p: foot, d: l.d }, row.ri)), angleOf(foot));
  }
  const margin = (0.8 / row.ri) * (180 / Math.PI);
  return [Math.min(...angles) - margin, Math.max(...angles) + margin];
}

// ---------------------------------------------------------- the rows
// Each row is laid in pieces between the aisle flights that cut it.
for (const row of ROWS) {
  const cuts = FLIGHTS.filter((f) => f.top.ri >= row.ro - 1e-6 && f.bottom.ro <= row.ri + 1e-6).sort((p, q) => p.thTop - q.thTop);
  const edges: ((r: number) => number)[] = [() => WEST];
  for (const f of cuts) edges.push((r) => span(f, r)[0], (r) => span(f, r)[1]);
  edges.push(() => EAST);
  for (let i = 0; i < edges.length; i += 2) {
    const [w, e] = [edges[i], edges[i + 1]];
    b.poly([...arc(row.ro, w(row.ro), e(row.ro)), ...arc(row.ri, e(row.ri), w(row.ri))], row.z);
  }
  // Board at the west end, open at the east.
  b.wall([at(row.ri, WEST), at(row.ro, WEST)], 'board', row.z);
}
FLIGHTS.forEach(layFlight);

// Top walkway: a board along the back and at both ends.
b.wall(arc(WALKWAY.ro, WEST, EAST), 'board', WALKWAY.z);
b.wall([at(WALKWAY.ri, EAST), at(WALKWAY.ro, EAST)], 'board', WALKWAY.z);

// The gutter: a strip of water along the foot of the bank.
b.poly([...arc(ROW6.ri, WEST, EAST), ...arc(GUTTER_IN, EAST, WEST)], -0.1, { mat: 'water' });

// ------------------------------------------------------- the green
// A D: round side to the terrace, a long board along its straight back.
const greenEdge: Pt[] = [];
for (let i = 0; i <= 24; i++) {
  const a = rad(GREEN_TH - 90 + (180 * i) / 24);
  greenEdge.push([C[0] + Math.cos(a) * GREEN_R, C[1] + Math.sin(a) * GREEN_R]);
}
b.poly(greenEdge, 0);
b.wall([greenEdge[24], greenEdge[0]], 'board', 0);

// Two little bridges from row 6 straight down the bank over the gutter.
const mouths: number[] = [];
for (const th of CROSSINGS) {
  const s = at(ROW6.ri + 0.3, th);
  const u: Pt = [-Math.cos(rad(th)), -Math.sin(rad(th))];
  // How far along the bridge the rim of the green is.
  const rel: Pt = [s[0] - C[0], s[1] - C[1]];
  const pu = rel[0] * u[0] + rel[1] * u[1];
  const reach = -pu - Math.sqrt(pu * pu - (rel[0] ** 2 + rel[1] ** 2) + GREEN_R * GREEN_R);
  b.at(s[0], s[1], angleOf(u), ROW6.z).route(false).width(1.4).walls('rail').straight(0.3);
  if (th === CROSSINGS[0]) b.item(1.3);
  // Down steeply enough that a ball never rests on the slope, then level onto the green.
  const slope = (reach - 0.3) * 0.6;
  b.straight(slope, { rise: -ROW6.z, bridge: true }).straight(reach - 0.3 - slope, { bridge: true }).straight(0.6);
  mouths.push(angleOf([rel[0] + u[0] * reach, rel[1] + u[1] * reach]));
}
// Rail round the rim of the green, open where the bridges come in.
for (let i = 0; i < 24; i++) {
  const mid = GREEN_TH - 90 + (180 * (i + 0.5)) / 24;
  const open = mouths.some((m) => Math.abs(((((mid - m) % 360) + 540) % 360) - 180) < 8.5);
  if (!open) b.wall([greenEdge[i], greenEdge[i + 1]], 'rail', 0);
}

// ----------------------------------------------------- the gantry
// The shortcut: a gantry out over rows 1 to 3, running track, then a kicker.
// From the walkway it needs about 0.8 power or more to carry onto the green.
const TRACK = 5;
const KICK_LEN = 1.4;
const KICK_RISE = 0.8;
const g0 = at(WALKWAY.ri + 0.3, GANTRY_TH);
b.at(g0[0], g0[1], GANTRY_TH - 180, WALKWAY.z)
  .route(false)
  .width(1.6)
  .walls('kerb')
  .straight(0.3)
  .item(0.8)
  .straight(TRACK, { boost: true, bridge: true })
  .straight(KICK_LEN, { rise: KICK_RISE, bridge: true });

// --------------------------------------------------- crush barriers
// Rails along the front edge of each row, 3.2 long with 2.8 gaps. Each row's
// pattern is shifted along from the one above, so a straight putt down the
// bank meets a barrier soon, while an angled one can run through several
// gaps in a row. A board instead where a flight's foot
// sends balls. Both leave the openings clear: flight heads, the gantry and
// the bridges.
const BARRIER = 3.2;
const GAP = 2.8;
// Each row's pattern starts this much further east than the row above.
const SHIFT = 2;

/** Cut a run of angles round the spans it must leave open; drop stubs under a unit long. */
function cut(run: Span, open: Span[], row: Row): Span[] {
  const unit = (1 / row.ri) * (180 / Math.PI);
  let pieces = [run];
  for (const [p, q] of open) {
    pieces = pieces.flatMap(([u, v]): Span[] => (q <= u || p >= v ? [[u, v]] : [[u, p], [q, v]]));
  }
  return pieces.filter(([u, v]) => v - u > unit);
}

ROWS.forEach((row, n) => {
  const deg = (len: number) => (len / row.ri) * (180 / Math.PI);
  const open: Span[] = [];
  // Every flight that starts at or cuts through this row's front edge.
  for (const f of FLIGHTS) {
    if (row.ri > f.top.ri + 1e-6 || row.ri < f.bottom.ro - 1e-6) continue;
    const [w, e] = span(f, row.ri);
    open.push([w - deg(0.2), e + deg(0.2)]);
  }
  if (row === WALKWAY) open.push([GANTRY_TH - deg(1.2), GANTRY_TH + deg(1.2)]);
  if (row === ROW6) for (const th of CROSSINGS) open.push([th - deg(1.1), th + deg(1.1)]);

  const runs = FLIGHTS.filter((f) => f.bottom === row).map(footBoard);
  if (row === ROW3) {
    // The cross-aisle: boarded from where the upper flight lands to the head
    // of the lower one, and a little past the head, so the walk along it is safe.
    for (const [upper, lower] of [AISLE_A, AISLE_B]) {
      const [hw, he] = span(lower, row.ri);
      const [bw, be] = footBoard(upper);
      runs.push(he < bw ? [he, bw] : [be, hw], he < bw ? [hw - deg(2.5), hw] : [he, Math.min(EAST, he + deg(2.5))]);
    }
  }
  if (row === ROW6) {
    // The flights run westward, so a ball off a lower flight slides west along
    // its board: a short spur across the tread stops it at the board's end.
    for (const f of FLIGHTS.filter((g) => g.bottom === row)) {
      const w = footBoard(f)[0];
      b.wall([at(row.ri, w), at(row.ri + 1.3, w)], 'board', row.z);
    }
  }
  const boards = runs.flatMap((run) => cut(run, open, row));
  for (const [u, v] of boards) b.wall(arc(row.ri, u, v), 'board', row.z);

  for (let s = WEST + deg(0.6 + ((n * SHIFT) % (BARRIER + GAP))); s < EAST - deg(1); s += deg(BARRIER + GAP)) {
    const run: Span = [s, Math.min(s + deg(BARRIER), EAST - deg(0.5))];
    for (const [u, v] of cut(run, [...open, ...boards], row)) b.wall(arc(row.ri, u, v), 'rail', row.z);
  }
});

// --------------------------------------------------------- tee, cup
const tee = at(43.75, 237.5);
b.at(tee[0], tee[1], 327.5, WALKWAY.z).tee().route(false);
// Off to the west of the gantry's line, so a kicker that comes off still leaves a putt.
const cup = at(GUTTER_IN - GREEN_R + 2.5, GREEN_TH - 4);
b.at(cup[0], cup[1], 0, 0).cup();

// ------------------------------------------------------- pickups
// (The other two are on the gantry and on the west crossing, laid with them.)
const pick = (p: Pt, z: number) => b.at(p[0], p[1], 0, z).item();
pick(at(35, 247), ROW3.z); // row 3, on the dropping line from the tee
pick(at(ROW5.ri + 0.5, 272), ROW5.z); // middle of row 5, tucked behind a barrier

// ------------------------------------------------- the safe line
const way = (p: Pt, z: number) => b.way(p[0], p[1], z);
/** A point above a flight's head, on its centre line carried back up the bank, so the way down it is straight. */
function above(f: Flight, back: number): Pt {
  const [w, e] = [cross(side(f, 1), f.top.ri + back), cross(side(f, -1), f.top.ri + back)];
  return [(w[0] + e[0]) / 2, (w[1] + e[1]) / 2];
}
for (const th of [246, 255, 264, 273, 282]) way(at(43.6, th), WALKWAY.z);
way(above(AISLE_A[0], 1.2), WALKWAY.z);
way(at(35.6, AISLE_A[0].thBottom - 1), ROW3.z);
way(at(35.2, 276), ROW3.z);
way(at(35.2, 270), ROW3.z);
way(above(AISLE_A[1], 0.9), ROW3.z);
way(at(27.6, AISLE_A[1].thBottom), ROW6.z);
way(at(ROW6.ri + 1.1, CROSSINGS[1]), ROW6.z);
way(at(GUTTER_IN - 2, CROSSINGS[1]), 0);

export default b.build();
