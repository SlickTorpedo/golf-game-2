import type { HoleDef, Mat, P3, TriDef, WallDef, WallKind, Waypoint } from './level';

// The kit holes are built with. It works like drawing with a pen that lays
// fairway behind it: put the pen somewhere, then go straight, turn, climb,
// jump a gap. Rooms, greens and humps are added as free shapes.
//
// Directions: x is east, y is south. Headings are degrees clockwise on the
// map: 0 east, 90 south, 180 west, 270 north. A positive turn is to the right.
// Heights are in world units; one terrace level is 0.5.

export type Side = WallKind | 'none';

export interface SegOpts {
  /** Width at the end of this piece; the fairway tapers to it and keeps it. */
  width?: number;
  /** Height gained (or lost, if negative) over this piece. */
  rise?: number;
  mat?: Mat;
  /** Running track that pushes the ball forward along this piece. */
  boost?: boolean;
  /** Wall on the left / right for this piece only. */
  left?: Side;
  right?: Side;
  /** Air underneath: balls on a lower level may pass under it. */
  bridge?: boolean;
  /** Turns only: raise the outside edge by this much at the middle of the bend. */
  bank?: number;
  /** Turns only: raise the outside edge by this much for the whole bend, like a velodrome. */
  tilt?: number;
}

interface Pen {
  x: number;
  y: number;
  z: number;
  heading: number;
  width: number;
  left: Side;
  right: Side;
  route: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export class HoleBuilder {
  private readonly verts: number[] = [];
  private readonly tris: TriDef[] = [];
  private readonly wallList: WallDef[] = [];
  private readonly line: Waypoint[] = [];
  private readonly marks = new Map<string, Pen>();
  private readonly mouths = new Map<string, { from?: P3; to?: P3 }>();
  private readonly spawns: P3[] = [];
  private readonly cones: P3[] = [];
  private readonly spinners: (P3 & { dir: number })[] = [];
  private readonly springs: P3[] = [];
  private teeAt: P3 | null = null;
  private cupAt: P3 | null = null;
  private pen: Pen = { x: 0, y: 0, z: 0, heading: 0, width: 2, left: 'rail', right: 'rail', route: true };

  constructor(private readonly meta: { id: string; name: string; par: number; boards: [number, number] }) {}

  // ------------------------------------------------------------ the pen

  /** Put the pen down. Heading in degrees: 0 east, 90 south, 180 west, 270 north. */
  at(x: number, y: number, heading: number, z = 0): this {
    Object.assign(this.pen, { x, y, z, heading });
    return this;
  }

  /** Fairway width from here on. */
  width(w: number): this {
    this.pen.width = w;
    return this;
  }

  /** Walls from here on: 'kerb', 'rail', 'board' or 'none'. One value sets both sides. */
  walls(left: Side, right: Side = left): this {
    this.pen.left = left;
    this.pen.right = right;
    return this;
  }

  /** Whether the pieces that follow are part of the route bots take. Turn off for side branches. */
  route(on: boolean): this {
    this.pen.route = on;
    return this;
  }

  /** Remember the pen here (position, heading, width, walls) under a name. */
  mark(name: string): this {
    this.marks.set(name, { ...this.pen });
    return this;
  }

  /** Bring the pen back to a remembered place. */
  goto(name: string): this {
    const m = this.marks.get(name);
    if (!m) throw new Error(`${this.meta.id}: no mark '${name}'`);
    this.pen = { ...m };
    return this;
  }

  /** Lay fairway straight ahead. */
  straight(length: number, o: SegOpts = {}): this {
    const p = this.pen;
    const a = this.section(p.x, p.y, p.z, p.heading, p.width, 0);
    const w1 = o.width ?? p.width;
    const f = this.forward();
    p.x += f[0] * length;
    p.y += f[1] * length;
    p.z += o.rise ?? 0;
    p.width = w1;
    const b = this.section(p.x, p.y, p.z, p.heading, w1, 0);
    this.strip(a, b, o);
    this.waypoint();
    return this;
  }

  /** Lay fairway round a bend. angle in degrees, positive to the right; radius to the centre line. */
  turn(angle: number, radius: number, o: SegOpts = {}): this {
    const p = this.pen;
    const steps = Math.max(2, Math.ceil(Math.abs(angle) / 9));
    const dir = Math.sign(angle) || 1;
    const w0 = p.width;
    const w1 = o.width ?? w0;
    const z0 = p.z;
    const h0 = p.heading;
    const r0 = this.rightOf(p.heading);
    const cx = p.x + r0[0] * radius * dir;
    const cy = p.y + r0[1] * radius * dir;
    let prev = this.section(p.x, p.y, p.z, p.heading, w0, 0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const h = h0 + angle * t;
      const r = this.rightOf(h);
      const x = cx - r[0] * radius * dir;
      const y = cy - r[1] * radius * dir;
      const z = z0 + (o.rise ?? 0) * t;
      // The bank comes in and goes out smoothly, and always lifts the outside of the bend.
      // A tilt holds for the whole bend but eases in and out over its first and last eighth,
      // so it meets the flat ground either side without a step.
      const ease = Math.min(1, t * 8, (1 - t) * 8);
      const bank = ((o.bank ?? 0) * Math.sin(Math.PI * t) + (o.tilt ?? 0) * ease) * dir;
      const cur = this.section(x, y, z, h, w0 + (w1 - w0) * t, bank);
      this.strip(prev, cur, o);
      prev = cur;
      if (i === Math.ceil(steps / 2) || i === steps) {
        Object.assign(p, { x, y, z, heading: h });
        this.waypoint();
      }
    }
    p.width = w1;
    return this;
  }

  /**
   * Leave a gap: the pen moves on with no ground laid. Balls must fly it, so
   * put running track or a down-ramp before it. `power` is what a bot should
   * putt with from the last route point to clear it.
   */
  gap(length: number, o: { drop?: number; power?: number } = {}): this {
    const p = this.pen;
    const f = this.forward();
    p.x += f[0] * length;
    p.y += f[1] * length;
    p.z -= o.drop ?? 0;
    if (p.route) this.line.push({ x: p.x + f[0] * 0.8, y: p.y + f[1] * 0.8, z: p.z, power: o.power ?? 0.9 });
    return this;
  }

  /** A wall across the fairway where the pen is: closes an end. */
  cap(kind: WallKind = 'rail'): this {
    const p = this.pen;
    const s = this.section(p.x, p.y, p.z, p.heading, p.width, 0);
    this.wallList.push({ a: s.l, b: s.r, kind });
    return this;
  }

  // ---------------------------------------------- things placed by the pen
  // Each takes an offset from the pen: forward, then to the right.

  tee(forward = 0, right = 0): this {
    this.teeAt = this.spot(forward, right);
    if (this.pen.route) this.line.unshift({ ...this.teeAt });
    return this;
  }

  cup(forward = 0, right = 0): this {
    this.cupAt = this.spot(forward, right);
    return this;
  }

  /** A leftover to pick up. */
  item(forward = 0, right = 0): this {
    this.spawns.push(this.spot(forward, right));
    return this;
  }

  cone(forward = 0, right = 0): this {
    this.cones.push(this.spot(forward, right));
    return this;
  }

  /** A turnstile. Its arms reach 1.3 from the centre. */
  spinner(forward = 0, right = 0, dir = 1): this {
    this.spinners.push({ ...this.spot(forward, right), dir });
    return this;
  }

  /** A spring pad: throws the ball up, keeping its speed along the ground. */
  spring(forward = 0, right = 0): this {
    this.springs.push(this.spot(forward, right));
    return this;
  }

  /** Mouth of a players' tunnel. Pair it with tunnelOut of the same name. */
  tunnelIn(name: string, forward = 0, right = 0): this {
    this.mouth(name).from = this.spot(forward, right);
    return this;
  }

  tunnelOut(name: string, forward = 0, right = 0): this {
    this.mouth(name).to = this.spot(forward, right);
    return this;
  }

  /** An extra route point for the bots, in map coordinates. */
  way(x: number, y: number, z = this.groundZ(x, y), power?: number): this {
    this.line.push({ x, y, z, ...(power === undefined ? {} : { power }) });
    return this;
  }

  // -------------------------------------------------------- free shapes
  // These take map coordinates, not pen offsets.

  /**
   * A flat or tilted polygon of ground. Points in order round the outline.
   * z is one height, or one per point. walls is one kind for every edge, or
   * one per edge (edge i runs from point i to point i + 1).
   */
  poly(points: [number, number][], z: number | number[], o: { mat?: Mat; walls?: Side | Side[]; bridge?: boolean } = {}): this {
    const zs = points.map((_, i) => (typeof z === 'number' ? z : z[i]));
    const base = this.verts.length / 3;
    points.forEach((p, i) => this.verts.push(p[0], p[1], zs[i]));
    for (const [a, b, c] of earClip(points)) {
      this.tris.push({ v: [base + a, base + b, base + c], mat: o.mat ?? 'turf', ...(o.bridge ? { bridge: true } : {}) });
    }
    points.forEach((p, i) => {
      const kind = Array.isArray(o.walls) ? o.walls[i] : o.walls;
      if (!kind || kind === 'none') return;
      const j = (i + 1) % points.length;
      this.wallList.push({ a: { x: p[0], y: p[1], z: zs[i] }, b: { x: points[j][0], y: points[j][1], z: zs[j] }, kind });
    });
    return this;
  }

  /**
   * A round patch of ground. gaps are stretches of the rim left without wall,
   * as [fromDegrees, toDegrees] pairs measured like headings (0 east, 90 south).
   */
  disc(
    x: number,
    y: number,
    r: number,
    z: number,
    o: { mat?: Mat; wall?: Side; gaps?: [number, number][]; mouths?: [number, number][]; segments?: number; bridge?: boolean } = {},
  ): this {
    const n = o.segments ?? 32;
    // A mouth is an opening for a lane: [the heading from the centre to it, the lane's width].
    const gaps = [...(o.gaps ?? [])];
    for (const [heading, width] of o.mouths ?? []) {
      const half = (Math.asin(Math.min(1, width / 2 / r)) * 180) / Math.PI;
      gaps.push([heading - half, heading + half]);
    }
    const base = this.verts.length / 3;
    this.verts.push(x, y, z);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.verts.push(x + Math.cos(a) * r, y + Math.sin(a) * r, z);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.tris.push({ v: [base, base + 1 + i, base + 1 + j], mat: o.mat ?? 'turf', ...(o.bridge ? { bridge: true } : {}) });
      const mid = ((i + 0.5) / n) * 360;
      const open = gaps.some(([from, to]) => {
        const span = (((to - from) % 360) + 360) % 360;
        return (((mid - from) % 360) + 360) % 360 <= span;
      });
      if (o.wall && o.wall !== 'none' && !open) {
        const a = (i / n) * Math.PI * 2;
        const b = (j / n) * Math.PI * 2;
        this.wallList.push({
          a: { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z },
          b: { x: x + Math.cos(b) * r, y: y + Math.sin(b) * r, z },
          kind: o.wall,
        });
      }
    }
    return this;
  }

  /** A smooth hump lying on ground that is already there. Gentle ones turn a putt; tall ones are hills. */
  mound(x: number, y: number, r: number, height: number): this {
    const z = this.groundZ(x, y) + 0.004;
    const rings = 5;
    const n = 24;
    const base = this.verts.length / 3;
    this.verts.push(x, y, z + height);
    for (let k = 1; k <= rings; k++) {
      const t = k / rings;
      const h = height * (0.5 + 0.5 * Math.cos(Math.PI * t));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.verts.push(x + Math.cos(a) * r * t, y + Math.sin(a) * r * t, z + h);
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.tris.push({ v: [base, base + 1 + i, base + 1 + j], mat: 'turf' });
      for (let k = 0; k < rings - 1; k++) {
        const a = base + 1 + k * n;
        const b = a + n;
        this.tris.push({ v: [a + i, b + i, b + j], mat: 'turf' }, { v: [a + i, b + j, a + j], mat: 'turf' });
      }
    }
    return this;
  }

  /**
   * A free-standing wall through these points. It stands on the highest ground under each
   * point; give z to stand it at one height instead (for a wall on a level under an overhang).
   */
  wall(points: [number, number][], kind: WallKind = 'rail', z?: number): this {
    for (let i = 0; i + 1 < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      this.wallList.push({ a: { x: ax, y: ay, z: z ?? this.groundZ(ax, ay) }, b: { x: bx, y: by, z: z ?? this.groundZ(bx, by) }, kind });
    }
    return this;
  }

  build(): HoleDef {
    const { id } = this.meta;
    if (!this.teeAt || !this.cupAt) throw new Error(`${id}: needs a tee() and a cup()`);
    const tunnels = [...this.mouths.entries()].map(([name, m]) => {
      if (!m.from || !m.to) throw new Error(`${id}: tunnel '${name}' needs both ends`);
      return { from: m.from, to: m.to };
    });
    // The route always ends in the cup.
    const line = [...this.line, { ...this.cupAt }];
    return {
      ...this.meta,
      verts: this.verts,
      tris: this.tris,
      walls: this.wallList,
      tee: this.teeAt,
      cup: this.cupAt,
      spawns: this.spawns,
      cones: this.cones,
      spinners: this.spinners,
      springs: this.springs,
      tunnels,
      line,
    };
  }

  // ------------------------------------------------------------ innards

  private forward(): [number, number] {
    return [Math.cos(rad(this.pen.heading)), Math.sin(rad(this.pen.heading))];
  }

  private rightOf(heading: number): [number, number] {
    return [-Math.sin(rad(heading)), Math.cos(rad(heading))];
  }

  /** The two edges of the fairway at a point. bank lifts the left edge (negative: the right). */
  private section(x: number, y: number, z: number, heading: number, width: number, bank: number): { l: P3; r: P3 } {
    const r = this.rightOf(heading);
    const h = width / 2;
    return {
      l: { x: x - r[0] * h, y: y - r[1] * h, z: z + Math.max(0, bank) },
      r: { x: x + r[0] * h, y: y + r[1] * h, z: z + Math.max(0, -bank) },
    };
  }

  private strip(a: { l: P3; r: P3 }, b: { l: P3; r: P3 }, o: SegOpts): void {
    const base = this.verts.length / 3;
    for (const p of [a.l, a.r, b.r, b.l]) this.verts.push(p.x, p.y, p.z);
    const f = this.forward();
    const extra = {
      mat: (o.boost ? 'track' : (o.mat ?? 'turf')) as Mat,
      ...(o.boost ? { push: [f[0], f[1]] as [number, number] } : {}),
      ...(o.bridge ? { bridge: true } : {}),
    };
    // A twisted piece (a bank coming in or out) is not flat. Fold it along its higher diagonal,
    // so the fold is a ridge and never a pocket a ball could sit in.
    if (a.l.z + b.r.z >= a.r.z + b.l.z) {
      this.tris.push({ v: [base, base + 1, base + 2], ...extra }, { v: [base, base + 2, base + 3], ...extra });
    } else {
      this.tris.push({ v: [base, base + 1, base + 3], ...extra }, { v: [base + 1, base + 2, base + 3], ...extra });
    }
    const left = o.left ?? this.pen.left;
    const right = o.right ?? this.pen.right;
    if (left !== 'none') this.wallList.push({ a: a.l, b: b.l, kind: left });
    if (right !== 'none') this.wallList.push({ a: a.r, b: b.r, kind: right });
  }

  private waypoint(): void {
    const p = this.pen;
    if (p.route) this.line.push({ x: p.x, y: p.y, z: p.z });
  }

  private spot(forward: number, right: number): P3 {
    const f = this.forward();
    const r = this.rightOf(this.pen.heading);
    const x = this.pen.x + f[0] * forward + r[0] * right;
    const y = this.pen.y + f[1] * forward + r[1] * right;
    const z = this.groundZ(x, y);
    return { x, y, z: Number.isFinite(z) ? z : this.pen.z };
  }

  private mouth(name: string): { from?: P3; to?: P3 } {
    let m = this.mouths.get(name);
    if (!m) this.mouths.set(name, (m = {}));
    return m;
  }

  /** Highest ground laid so far under a point; the pen's height if there is none yet. */
  private groundZ(x: number, y: number): number {
    const v = this.verts;
    let best = -Infinity;
    for (const t of this.tris) {
      const [a, b, c] = t.v.map((i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]);
      const d1 = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      const d2 = (c[0] - b[0]) * (y - b[1]) - (c[1] - b[1]) * (x - b[0]);
      const d3 = (a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0]);
      if ((d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6) && (d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6)) continue;
      const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(det) < 1e-9) continue;
      const wb = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / det;
      const wc = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / det;
      best = Math.max(best, a[2] + wb * (b[2] - a[2]) + wc * (c[2] - a[2]));
    }
    return Number.isFinite(best) ? best : this.pen.z;
  }
}

/** Cut a simple polygon into triangles. Returns index triples. */
function earClip(pts: [number, number][]): [number, number, number][] {
  const idx = pts.map((_, i) => i);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  if (area < 0) idx.reverse();
  const cross = (a: number, b: number, c: number) =>
    (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  const inside = (p: number, a: number, b: number, c: number) => cross(a, b, p) > 0 && cross(b, c, p) > 0 && cross(c, a, p) > 0;
  const out: [number, number, number][] = [];
  let guard = pts.length * pts.length;
  while (idx.length > 3 && guard-- > 0) {
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length];
      const b = idx[i];
      const c = idx[(i + 1) % idx.length];
      if (cross(a, b, c) <= 0) continue;
      if (idx.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]);
      idx.splice(i, 1);
      break;
    }
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}
