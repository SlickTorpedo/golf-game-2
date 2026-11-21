import { BALL_R, STEP_UP } from './constants';

// A hole is free-form geometry, not a grid:
//
//   - the ground is a triangle mesh; every corner has its own height, so
//     ramps, banked curves, humps and drops are all just triangles
//   - walls are thin line segments standing on the ground, in three heights
//   - where the mesh ends there is nothing: the ball falls
//
// Holes are written with the builder in builder.ts, which produces a HoleDef.
// compileLevel() turns that into what the physics and the renderer use.

export type Mat = 'turf' | 'mud' | 'track' | 'ice' | 'water';

/**
 * kerb: ankle high. Stops a slow ball; a firm one hops over it.
 * rail: a bumper. Only a full-blooded hit clears it.
 * board: an advertising board. Nothing gets over it.
 */
export type WallKind = 'kerb' | 'rail' | 'board';
export const WALL_HEIGHT: Record<WallKind, number> = { kerb: 0.11, rail: 0.3, board: 0.62 };
/** Speed into the wall above which the ball hops over instead of bouncing. */
export const WALL_HOP: Record<WallKind, number> = { kerb: 3.6, rail: 9.5, board: Infinity };
export const WALL_HALF = 0.06;

export interface P3 {
  x: number;
  y: number;
  z: number;
}

/** A point on the intended route. Bots putt from one toward the next. */
export interface Waypoint extends P3 {
  /** Putt at exactly this power (0..1) to reach this point: for jumps and launch ramps. */
  power?: number;
}

export interface TriDef {
  /** Three corners as indices into HoleDef.verts. */
  v: [number, number, number];
  mat: Mat;
  /** For track: unit direction it pushes the ball. */
  push?: [number, number];
  /** A span with air under it: balls below are not blocked by its edges. */
  bridge?: boolean;
}

export interface WallDef {
  a: P3;
  b: P3;
  kind: WallKind;
}

export interface HoleDef {
  id: string;
  name: string;
  par: number;
  /** Two colours for this hole's rails, flag and boards. */
  boards: [number, number];
  /** x, y, z triples. x is east, y is south, z is up. */
  verts: number[];
  tris: TriDef[];
  walls: WallDef[];
  tee: P3;
  cup: P3;
  spawns: P3[];
  cones: P3[];
  spinners: (P3 & { dir: number })[];
  /** Spring pads that throw the ball into the air. */
  springs: P3[];
  tunnels: { from: P3; to: P3 }[];
  line: Waypoint[];
}

export interface Tri {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  /** Slope: height gained per unit of x and of y. */
  gx: number;
  gy: number;
  mat: Mat;
  px: number;
  py: number;
  bridge: boolean;
}

/** Something a ball bounces off: the edge of higher ground, or a wall. */
export interface Collider {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Height of its top at each end. */
  ta: number;
  tb: number;
  kind: 'cliff' | WallKind;
}

export interface Level {
  def: HoleDef;
  tris: Tri[];
  colliders: Collider[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cols: number;
  rows: number;
  triGrid: number[][];
  colGrid: number[][];
  tee: P3;
  cup: P3;
  spawns: P3[];
  cones: P3[];
  spinners: (P3 & { dir: number })[];
  springs: P3[];
  tunnels: { from: P3; to: P3 }[];
  line: Waypoint[];
}

const PAD = 2;

export function compileLevel(def: HoleDef): Level {
  const tris: Tri[] = [];
  const edges = new Map<string, { n: number; a: number[]; b: number[]; bridge: boolean }>();
  const key = (p: number[]) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)},${Math.round(p[2] * 1000)}`;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const t of def.tris) {
    const p = t.v.map((i) => [def.verts[i * 3], def.verts[i * 3 + 1], def.verts[i * 3 + 2]]);
    const [a, b, c] = p;
    const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(det) < 1e-9) continue; // a sliver with no area
    const gx = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / det;
    const gy = ((c[2] - a[2]) * (b[0] - a[0]) - (b[2] - a[2]) * (c[0] - a[0])) / det;
    tris.push({
      ax: a[0], ay: a[1], az: a[2],
      bx: b[0], by: b[1], bz: b[2],
      cx: c[0], cy: c[1], cz: c[2],
      gx, gy,
      mat: t.mat,
      px: t.push?.[0] ?? 0,
      py: t.push?.[1] ?? 0,
      bridge: !!t.bridge,
    });
    for (const q of p) {
      minX = Math.min(minX, q[0]);
      maxX = Math.max(maxX, q[0]);
      minY = Math.min(minY, q[1]);
      maxY = Math.max(maxY, q[1]);
      minZ = Math.min(minZ, q[2]);
      maxZ = Math.max(maxZ, q[2]);
    }
    for (let i = 0; i < 3; i++) {
      const u = p[i];
      const w = p[(i + 1) % 3];
      const ku = key(u);
      const kw = key(w);
      const k = ku < kw ? `${ku}|${kw}` : `${kw}|${ku}`;
      const e = edges.get(k);
      // Count solid ground only: a bridge next to it does not close the edge off from below.
      if (e) e.n += t.bridge ? 0 : 1;
      else edges.set(k, { n: t.bridge ? 0 : 1, a: u, b: w, bridge: !!t.bridge });
    }
  }
  if (!tris.length) throw new Error(`${def.id}: no ground`);

  // An edge used by one triangle only is where ground stops. From above the
  // ball rolls off it; from below it is a cliff face.
  const colliders: Collider[] = [];
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    colliders.push({ ax: e.a[0], ay: e.a[1], bx: e.b[0], by: e.b[1], ta: e.a[2], tb: e.b[2], kind: 'cliff' });
  }
  for (const w of def.walls) {
    const h = WALL_HEIGHT[w.kind];
    colliders.push({ ax: w.a.x, ay: w.a.y, bx: w.b.x, by: w.b.y, ta: w.a.z + h, tb: w.b.z + h, kind: w.kind });
  }

  minX = Math.floor(minX) - PAD;
  minY = Math.floor(minY) - PAD;
  maxX = Math.ceil(maxX) + PAD;
  maxY = Math.ceil(maxY) + PAD;
  const cols = maxX - minX;
  const rows = maxY - minY;
  const triGrid: number[][] = Array.from({ length: cols * rows }, () => []);
  const colGrid: number[][] = Array.from({ length: cols * rows }, () => []);
  const fill = (grid: number[][], id: number, x0: number, y0: number, x1: number, y1: number) => {
    const c0 = Math.max(0, Math.floor(x0 - minX));
    const c1 = Math.min(cols - 1, Math.floor(x1 - minX));
    const r0 = Math.max(0, Math.floor(y0 - minY));
    const r1 = Math.min(rows - 1, Math.floor(y1 - minY));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r * cols + c].push(id);
  };
  tris.forEach((t, i) =>
    fill(triGrid, i, Math.min(t.ax, t.bx, t.cx), Math.min(t.ay, t.by, t.cy), Math.max(t.ax, t.bx, t.cx), Math.max(t.ay, t.by, t.cy)),
  );
  const reach = BALL_R + WALL_HALF + 0.05;
  colliders.forEach((c, i) =>
    fill(colGrid, i, Math.min(c.ax, c.bx) - reach, Math.min(c.ay, c.by) - reach, Math.max(c.ax, c.bx) + reach, Math.max(c.ay, c.by) + reach),
  );

  const L: Level = {
    def, tris, colliders, minX, minY, maxX, maxY, minZ, maxZ, cols, rows, triGrid, colGrid,
    tee: def.tee,
    cup: def.cup,
    spawns: def.spawns,
    cones: def.cones,
    spinners: def.spinners,
    springs: def.springs,
    tunnels: def.tunnels,
    line: def.line,
  };
  for (const [name, p] of [['tee', def.tee], ['cup', def.cup]] as const) {
    if (!Number.isFinite(floorAt(L, p.x, p.y, p.z + 0.2))) throw new Error(`${def.id}: the ${name} is not on the ground`);
  }
  return L;
}

/** The triangle found by the last floorAt() call, or null. */
export let hitTri: Tri | null = null;

/**
 * Height of the ground under this point, for a ball whose underside is at z:
 * the highest ground it could be standing on or stepping up to. Ground further
 * above (a bridge overhead) is ignored. -Infinity if there is none.
 */
export function floorAt(L: Level, x: number, y: number, z: number): number {
  hitTri = null;
  const c = Math.floor(x - L.minX);
  const r = Math.floor(y - L.minY);
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -Infinity;
  let best = -Infinity;
  const limit = z + STEP_UP;
  for (const i of L.triGrid[r * L.cols + c]) {
    const t = L.tris[i];
    const d1 = (t.bx - t.ax) * (y - t.ay) - (t.by - t.ay) * (x - t.ax);
    const d2 = (t.cx - t.bx) * (y - t.by) - (t.cy - t.by) * (x - t.bx);
    const d3 = (t.ax - t.cx) * (y - t.cy) - (t.ay - t.cy) * (x - t.cx);
    const neg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
    const pos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
    if (neg && pos) continue;
    const h = t.az + t.gx * (x - t.ax) + t.gy * (y - t.ay);
    if (h > best && h <= limit) {
      best = h;
      hitTri = t;
    }
  }
  return best;
}

/** Height of the topmost ground at this point. -Infinity over nothing. */
export function topAt(L: Level, x: number, y: number): number {
  return floorAt(L, x, y, Infinity);
}
