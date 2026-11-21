import * as THREE from 'three';
import { ARM_LEN, ARM_R, CONE_R, CUP_R, PITCH_DROP, SPRING_R, TUNNEL_R } from '../shared/constants';
import { Level, WALL_HALF, WALL_HEIGHT, floorAt, topAt } from '../shared/level';
import { spinnerAngle } from '../shared/physics';
import { AD_COUNT } from './textures';

export interface CourseTextures {
  turf: THREE.Texture;
  concrete: THREE.Texture;
  mud: THREE.Texture;
  track: THREE.Texture;
  chevron: THREE.Texture;
  ice: THREE.Texture;
  ads: THREE.Texture;
  kerb: THREE.Texture;
  cup: THREE.Texture;
  ripple: THREE.Texture;
}

const DECK = 0.35;
/** One ad panel is this long on a board. */
const AD_LEN = 2.4;

type V = [number, number, number];

/** Collects triangles for one material. Points are scene coordinates: x, up, z. */
class Buf {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  private c = new THREE.Color();

  tri(p: V[], uv: number[][], hex = 0xffffff, scale = 1): void {
    this.c.setHex(hex).multiplyScalar(scale);
    for (let i = 0; i < 3; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(p: V[], uv: number[][], hex = 0xffffff, scale = 1): void {
    this.tri([p[0], p[1], p[2]], [uv[0], uv[1], uv[2]], hex, scale);
    this.tri([p[0], p[2], p[3]], [uv[0], uv[2], uv[3]], hex, scale);
  }

  mesh(mat: THREE.Material): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
}

/** Scale a colour so every glowing thing shines about equally, whatever its hue. */
function glow(hex: number): number {
  const c = new THREE.Color(hex);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return Math.min(2.6, 0.95 / Math.max(0.05, lum));
}

/** One hole as a scene: ground, walls, cup, obstacles, and the scaffolding it stands on. */
export class Course {
  readonly group = new THREE.Group();
  private readonly flag = new THREE.Group();
  private cloth!: THREE.Mesh;
  private clothBase!: Float32Array;
  private flagLift = 0;
  private cupDecal!: THREE.Mesh;
  private readonly spinners: { rotor: THREE.Group; dir: number }[] = [];
  private readonly cones: { mesh: THREE.Group; x: number; y: number; wobble: number; ax: number; az: number }[] = [];
  private readonly springs: { mesh: THREE.Group; x: number; y: number; kick: number }[] = [];
  private readonly scrollers: { tex: THREE.Texture; sx: number; sy: number }[] = [];
  private readonly rings: THREE.Mesh[] = [];

  constructor(
    readonly level: Level,
    private readonly tex: CourseTextures,
  ) {
    this.buildGround();
    this.buildWalls();
    this.buildCup();
    this.buildFlag();
    this.buildTee();
    this.buildProps();
    this.buildScaffold();
  }

  private add(m: THREE.Mesh | null, cast: boolean, receive: boolean): THREE.Mesh | null {
    if (!m) return null;
    m.castShadow = cast;
    m.receiveShadow = receive;
    this.group.add(m);
    return m;
  }

  // ------------------------------------------------------------ pieces

  private buildGround(): void {
    const L = this.level;
    const def = L.def;
    const tex = this.tex;
    const turf = new Buf();
    const mud = new Buf();
    const track = new Buf();
    const ice = new Buf();
    const water = new Buf();
    const chevrons = new Buf();
    const sides = new Buf();
    const key = (p: number[]) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)},${Math.round(p[2] * 1000)}`;
    const edges = new Map<string, { n: number; a: number[]; b: number[]; cx: number; cy: number; bridge: boolean }>();

    for (const t of def.tris) {
      const p = t.v.map((i) => [def.verts[i * 3], def.verts[i * 3 + 1], def.verts[i * 3 + 2]]);
      // Face up: the map's y runs south, which flips the winding.
      const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      const o = area > 0 ? [p[0], p[2], p[1]] : p;
      const v = o.map((q): V => [q[0], q[2], q[1]]);
      const world = (s: number) => o.map((q) => [q[0] * s, q[1] * s]);
      if (t.mat === 'mud') mud.tri(v, world(0.5));
      else if (t.mat === 'ice') ice.tri(v, world(0.4));
      else if (t.mat === 'water') water.tri(v, world(0.5));
      else if (t.mat === 'track') {
        track.tri(v, world(1));
        const [px, py] = t.push ?? [1, 0];
        chevrons.tri(
          v.map((q): V => [q[0], q[1] + 0.006, q[2]]),
          o.map((q) => [q[0] * px + q[1] * py, q[0] * -py + q[1] * px]),
        );
      } else turf.tri(v, world(0.25));

      const cx = (p[0][0] + p[1][0] + p[2][0]) / 3;
      const cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
      for (let i = 0; i < 3; i++) {
        const a = p[i];
        const b = p[(i + 1) % 3];
        const ka = key(a);
        const kb = key(b);
        const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const e = edges.get(k);
        if (e) e.n++;
        else edges.set(k, { n: 1, a, b, cx, cy, bridge: !!t.bridge });
      }
    }

    // Where the ground stops, give it an edge with some thickness: down to
    // whatever lies below, or a deck's depth if there is only air.
    for (const e of edges.values()) {
      if (e.n !== 1) continue;
      const mx = (e.a[0] + e.b[0]) / 2;
      const my = (e.a[1] + e.b[1]) / 2;
      const mz = (e.a[2] + e.b[2]) / 2;
      let nx = e.b[1] - e.a[1];
      let ny = -(e.b[0] - e.a[0]);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      if (nx * (mx - e.cx) + ny * (my - e.cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const beyond = floorAt(L, mx + nx * 0.06, my + ny * 0.06, mz + 0.05);
      if (beyond > mz - 0.04) continue; // ground carries on at this height
      const below = floorAt(L, mx + nx * 0.06, my + ny * 0.06, mz - 0.1);
      const open = !Number.isFinite(below);
      // A bridge keeps a thin deck edge even over lower ground, so you can see under it.
      const drop = (z: number) => (e.bridge ? z - 0.16 : open ? z - DECK : Math.min(z - 0.02, below));
      const a: V = [e.a[0], e.a[2], e.a[1]];
      const b: V = [e.b[0], e.b[2], e.b[1]];
      const band = open ? 0.07 : 0;
      const u0 = e.a[0] + e.a[1];
      const u1 = u0 + len;
      if (band) {
        // A painted lip, so you can see where the ground ends.
        sides.quad([a, [a[0], a[1] - band, a[2]], [b[0], b[1] - band, b[2]], b], [[0, 0], [0, 0], [0, 0], [0, 0]], def.boards[0], 1.25);
      }
      sides.quad(
        [[a[0], a[1] - band, a[2]], [a[0], drop(e.a[2]), a[2]], [b[0], drop(e.b[2]), b[2]], [b[0], b[1] - band, b[2]]],
        [[u0 / 2, e.a[2] / 2], [u0 / 2, drop(e.a[2]) / 2], [u1 / 2, drop(e.b[2]) / 2], [u1 / 2, e.b[2] / 2]],
      );
    }

    this.add(turf.mesh(new THREE.MeshStandardMaterial({ map: tex.turf, color: 0x25e078, roughness: 0.92 })), false, true);
    this.add(mud.mesh(new THREE.MeshStandardMaterial({ map: tex.mud, roughness: 0.45 })), false, true);
    this.add(track.mesh(new THREE.MeshStandardMaterial({ map: tex.track, roughness: 0.8 })), false, true);
    this.add(
      ice.mesh(new THREE.MeshPhysicalMaterial({ map: tex.ice, roughness: 0.08, clearcoat: 1, envMapIntensity: 2.2 })),
      false,
      true,
    );
    this.add(
      sides.mesh(new THREE.MeshStandardMaterial({ map: tex.concrete, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })),
      true,
      true,
    );

    const chev = chevrons.mesh(new THREE.MeshBasicMaterial({ map: tex.chevron, transparent: true, opacity: 0.9, depthWrite: false }));
    if (chev) {
      this.group.add(chev);
      this.scrollers.push({ tex: tex.chevron, sx: -1.6, sy: 0 });
    }

    const pool = water.mesh(
      new THREE.MeshPhysicalMaterial({ color: 0x0f6ea3, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 3 }),
    );
    if (pool) {
      pool.receiveShadow = true;
      this.group.add(pool);
      const ripples = new THREE.Mesh(
        pool.geometry,
        new THREE.MeshBasicMaterial({ map: tex.ripple, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      ripples.position.y = 0.004;
      this.group.add(ripples);
      this.scrollers.push({ tex: tex.ripple, sx: 0.05, sy: 0.03 });
    }
  }

  /** Walls are thin slabs standing on the ground. */
  private buildWalls(): void {
    const def = this.level.def;
    const tex = this.tex;
    const kerb = new Buf();
    const rail = new Buf();
    const strip = new Buf();
    const ads = new Buf();
    const frame = new Buf();
    const flat = [[0, 0], [0, 0], [0, 0], [0, 0]];
    /** How far along its run of boards each board end is, keyed by position. */
    const runs = new Map<string, number>();
    let nextRun = 0;

    for (const w of def.walls) {
      const h = WALL_HEIGHT[w.kind];
      let dx = w.b.x - w.a.x;
      let dy = w.b.y - w.a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      dx /= len;
      dy /= len;
      // Run a little past each end so neighbouring pieces meet at corners.
      const ext = WALL_HALF;
      const ax = w.a.x - dx * ext;
      const ay = w.a.y - dy * ext;
      const bx = w.b.x + dx * ext;
      const by = w.b.y + dy * ext;
      const nx = -dy * WALL_HALF;
      const ny = dx * WALL_HALF;
      // Corners: a/b ends, l/r sides, bottom/top.
      const P = (x: number, y: number, z: number): V => [x, z, y];
      const al0 = P(ax + nx, ay + ny, w.a.z - 0.02);
      const ar0 = P(ax - nx, ay - ny, w.a.z - 0.02);
      const bl0 = P(bx + nx, by + ny, w.b.z - 0.02);
      const br0 = P(bx - nx, by - ny, w.b.z - 0.02);
      const al1 = P(ax + nx, ay + ny, w.a.z + h);
      const ar1 = P(ax - nx, ay - ny, w.a.z + h);
      const bl1 = P(bx + nx, by + ny, w.b.z + h);
      const br1 = P(bx - nx, by - ny, w.b.z + h);
      const top = [al1, bl1, br1, ar1];
      const sideL = [al1, al0, bl0, bl1];
      const sideR = [br1, br0, ar0, ar1];
      const ends = [
        [ar1, ar0, al0, al1],
        [bl1, bl0, br0, br1],
      ];

      if (w.kind === 'kerb') {
        const u0 = (w.a.x + w.a.y) * 0.7;
        const u1 = u0 + len * 0.7;
        const uv = [[u0, 1], [u0, 0], [u1, 0], [u1, 1]];
        for (const q of [top, sideL, sideR]) kerb.quad(q, uv);
        for (const q of ends) kerb.quad(q, flat);
      } else if (w.kind === 'rail') {
        for (const q of [sideL, sideR, ...ends]) rail.quad(q, flat, def.boards[0], 0.8);
        // A lit strip along the top.
        strip.quad(top, flat, def.boards[1], glow(def.boards[1]) * 0.62);
      } else {
        // Advertising board: the same strip of ads on both faces, reading left to right from either side.
        // q runs top-left, bottom-left, bottom-right, top-right as seen by someone facing that side;
        // u must grow to their right for the lettering to read forwards.
        // Distance along the board carries on from the piece before, so lettering runs unbroken round a bend.
        const spot = (p: { x: number; y: number }) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;
        const start = runs.get(spot(w.a)) ?? Math.ceil(nextRun / AD_LEN) * AD_LEN;
        const end = start + len;
        runs.set(spot(w.b), end);
        nextRun = Math.max(nextRun, end);
        const u = (d: number) => d / (AD_LEN * AD_COUNT);
        const face = (q: V[], from: number, to: number) => ads.quad(q, [[u(from), 1], [u(from), 0], [u(to), 0], [u(to), 1]]);
        face([al1, al0, bl0, bl1], start, end);
        face([br1, br0, ar0, ar1], -end, -start);
        for (const q of [top, ...ends]) frame.quad(q, flat);
      }
    }

    this.add(kerb.mesh(new THREE.MeshStandardMaterial({ map: tex.kerb, roughness: 0.6, side: THREE.DoubleSide })), true, true);
    this.add(
      rail.mesh(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.7, side: THREE.DoubleSide })),
      true,
      true,
    );
    this.add(strip.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })), false, false);
    // Boards give out their own light, so they ignore the floodlights and shadows.
    this.add(ads.mesh(new THREE.MeshBasicMaterial({ map: tex.ads, side: THREE.DoubleSide })), true, false);
    this.add(frame.mesh(new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.6, side: THREE.DoubleSide })), true, true);
  }

  private buildCup(): void {
    const L = this.level;
    // Drawn just above the turf and turned toward the camera each frame, so the lit side is always the far wall.
    this.cupDecal = new THREE.Mesh(
      new THREE.CircleGeometry(CUP_R, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.tex.cup, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    this.cupDecal.position.set(L.cup.x, L.cup.z + 0.004, L.cup.y);
    // A chalk ring round the cup, like the centre circle.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(CUP_R + 0.22, CUP_R + 0.28, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    ring.position.set(L.cup.x, L.cup.z + 0.004, L.cup.y);
    this.group.add(this.cupDecal, ring);
  }

  private buildFlag(): void {
    const L = this.level;
    const hex = L.def.boards[1];
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.35, metalness: 0.2 }),
    );
    pole.position.y = 1.25;
    pole.castShadow = true;
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(glow(hex)) }),
    );
    knob.position.y = 2.52;
    // A long pennant with enough segments to ripple.
    const geo = new THREE.PlaneGeometry(1.15, 0.62, 14, 4).translate(0.575, 0, 0);
    this.cloth = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.55, roughness: 0.7, side: THREE.DoubleSide }),
    );
    this.cloth.position.y = 2.15;
    this.cloth.castShadow = true;
    this.clothBase = (geo.getAttribute('position').array as Float32Array).slice();
    this.flag.add(pole, knob, this.cloth);
    this.flag.position.set(L.cup.x, L.cup.z, L.cup.y);
    this.flag.rotation.y = 0.5;
    this.group.add(this.flag);
  }

  private buildTee(): void {
    const L = this.level;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4 });
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2), mat);
    spot.position.set(L.tee.x, L.tee.z + 0.004, L.tee.y);
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.38, 40).rotateX(-Math.PI / 2), mat);
    arc.position.copy(spot.position);
    this.group.add(spot, arc);
  }

  private buildProps(): void {
    const L = this.level;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc9d0dc, roughness: 0.25, metalness: 0.9 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 });
    const lit = (hex: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(glow(hex)) });

    // Traffic cones.
    const orange = new THREE.MeshPhysicalMaterial({ color: 0xff6a14, roughness: 0.35, clearcoat: 0.5, emissive: 0xff4a00, emissiveIntensity: 0.25 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.2 });
    for (const c of L.cones) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(CONE_R * 1.9, 0.035, CONE_R * 1.9), orange);
      base.position.y = 0.018;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, CONE_R * 0.8, 0.52, 20), orange);
      body.position.y = 0.29;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.118, 0.12, 20), white);
      band.position.y = 0.3;
      g.add(base, body, band);
      g.traverse((o) => (o.castShadow = true));
      g.position.set(c.x, c.z, c.y);
      this.group.add(g);
      this.cones.push({ mesh: g, x: c.x, y: c.y, wobble: 0, ax: 0, az: 0 });
    }

    // Turnstiles: a post with two bars through it.
    for (const s of L.spinners) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 20), rubber);
      post.position.set(s.x, s.z + 0.21, s.y);
      post.castShadow = true;
      const rotor = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const bar = new THREE.Mesh(new THREE.CapsuleGeometry(ARM_R, ARM_LEN * 2 - ARM_R * 2, 6, 12).rotateZ(Math.PI / 2), steel);
        bar.rotation.y = (k * Math.PI) / 2;
        bar.castShadow = true;
        rotor.add(bar);
        for (const side of [-1, 1]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(ARM_R * 1.25, 12, 8), lit(L.def.boards[0]));
          cap.position.set(k ? 0 : side * ARM_LEN, 0, k ? side * ARM_LEN : 0);
          rotor.add(cap);
        }
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), steel);
      cap.position.y = 0.18;
      rotor.add(cap);
      rotor.position.set(s.x, s.z + 0.2, s.y);
      this.group.add(post, rotor);
      this.spinners.push({ rotor, dir: s.dir });
    }

    // Spring pads: a striped plate on a coil.
    for (const p of L.springs) {
      const g = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(SPRING_R, SPRING_R, 0.05, 28),
        new THREE.MeshPhysicalMaterial({ color: 0xffd21f, roughness: 0.3, clearcoat: 0.8, emissive: 0xffa800, emissiveIntensity: 0.35 }),
      );
      plate.position.y = 0.05;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(SPRING_R, 0.025, 8, 28).rotateX(Math.PI / 2), lit(0xff2e93));
      rim.position.y = 0.075;
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 4), lit(0xff2e93));
      arrow.position.y = 0.2;
      g.add(plate, rim, arrow);
      g.position.set(p.x, p.z, p.y);
      this.group.add(g);
      this.springs.push({ mesh: g, x: p.x, y: p.y, kick: 0 });
    }

    // Players' tunnel: a dark mouth with a lit ring, and a ring where the ball comes out.
    for (const t of L.tunnels) {
      for (const [p, hex, isMouth] of [
        [t.from, 0x2ee6ff, true],
        [t.to, 0xff7a1a, false],
      ] as const) {
        const hole = new THREE.Mesh(
          new THREE.CircleGeometry(TUNNEL_R, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: isMouth ? 0x020308 : 0x1a0f08, polygonOffset: true, polygonOffsetFactor: -4 }),
        );
        hole.position.set(p.x, p.z + 0.004, p.y);
        const ring = new THREE.Mesh(new THREE.RingGeometry(TUNNEL_R, TUNNEL_R + 0.08, 40).rotateX(-Math.PI / 2), lit(hex));
        (ring.material as THREE.MeshBasicMaterial).polygonOffset = true;
        (ring.material as THREE.MeshBasicMaterial).polygonOffsetFactor = -5;
        ring.position.set(p.x, p.z + 0.005, p.y);
        const arch = new THREE.Mesh(new THREE.TorusGeometry(TUNNEL_R + 0.1, 0.045, 10, 28, Math.PI), lit(hex));
        arch.position.set(p.x, p.z, p.y);
        arch.castShadow = true;
        this.group.add(hole, ring, arch);
        this.rings.push(ring);
      }
    }
  }

  /** Scaffold tubes from the deck down to the pitch, so the course stands on something. */
  private buildScaffold(): void {
    const L = this.level;
    const pitch = L.minZ - PITCH_DROP;
    const posts: [number, number, number][] = [];
    for (let y = Math.ceil(L.minY / 2) * 2; y <= L.maxY; y += 2) {
      for (let x = Math.ceil(L.minX / 2) * 2; x <= L.maxX; x += 2) {
        // Stand a post only where there is ground a little way in every direction, so none poke out past an edge.
        const h = Math.min(topAt(L, x + 0.25, y), topAt(L, x - 0.25, y), topAt(L, x, y + 0.25), topAt(L, x, y - 0.25));
        if (Number.isFinite(h)) posts.push([x, y, floorLowest(L, x, y) - DECK]);
      }
    }
    const at = new Map(posts.map((p) => [`${p[0]},${p[1]}`, p]));
    const tubes: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const tube = (a: THREE.Vector3, b: THREE.Vector3) => {
      const dir = b.clone().sub(a);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
      tubes.push(m.clone());
    };
    for (const [x, y, top] of posts) {
      tube(new THREE.Vector3(x, pitch, y), new THREE.Vector3(x, top, y));
      for (const [dx, dy] of [
        [2, 0],
        [0, 2],
      ]) {
        const other = at.get(`${x + dx},${y + dy}`);
        if (!other) continue;
        const reach = Math.min(top, other[2]) - pitch;
        for (const lvl of [0.3, 0.72]) {
          const yy = pitch + reach * lvl;
          tube(new THREE.Vector3(x, yy, y), new THREE.Vector3(x + dx, yy, y + dy));
        }
        // One diagonal per bay, leaning alternately.
        const flip = ((x + y) / 2) % 2 === 0;
        tube(
          new THREE.Vector3(flip ? x : x + dx, pitch + reach * 0.3, flip ? y : y + dy),
          new THREE.Vector3(flip ? x + dx : x, pitch + reach * 0.72, flip ? y + dy : y),
        );
      }
    }
    const inst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0x8e98ab, roughness: 0.4, metalness: 0.85 }),
      tubes.length,
    );
    tubes.forEach((mat, i) => inst.setMatrixAt(i, mat));
    this.group.add(inst);
  }

  // ------------------------------------------------------------- frame

  /** tick may be fractional; turnstiles follow the game clock exactly. */
  update(dt: number, time: number, tick: number, ballNearCup: boolean, cameraYaw: number): void {
    for (const s of this.scrollers) {
      s.tex.offset.x = (s.tex.offset.x + s.sx * dt) % 1;
      s.tex.offset.y = (s.tex.offset.y + s.sy * dt) % 1;
    }
    for (const s of this.spinners) s.rotor.rotation.y = -spinnerAngle(s.dir, tick);

    for (const c of this.cones) {
      if (c.wobble <= 0) continue;
      c.wobble = Math.max(0, c.wobble - dt * 2.2);
      const swing = Math.sin(c.wobble * 22) * c.wobble * 0.5;
      c.mesh.rotation.set(c.az * swing, 0, -c.ax * swing);
    }
    for (const s of this.springs) {
      s.kick = Math.max(0, s.kick - dt * 3);
      s.mesh.scale.y = 1 + Math.sin(s.kick * Math.PI) * 2.2;
      s.mesh.children[2].position.y = 0.2 + Math.sin(time * 4 + s.x) * 0.04;
    }
    this.rings.forEach((r, i) => r.scale.setScalar(1 + Math.sin(time * 4 + i) * 0.06));
    this.cupDecal.rotation.y = cameraYaw;

    // The flag is lifted out of the way when a ball is close, as a caddie would.
    this.flagLift += ((ballNearCup ? 1 : 0) - this.flagLift) * (1 - Math.exp(-dt * 6));
    this.flag.position.y = this.level.cup.z + this.flagLift * 1.4;

    const pos = this.cloth.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = this.clothBase[i];
      const y = this.clothBase[i + 1];
      const t = x / 1.15;
      // Taper to a point and let the free end move most.
      arr[i + 1] = y * (1 - t * 0.82) + Math.sin(time * 3.1 - x * 4) * 0.035 * t;
      arr[i + 2] = Math.sin(time * 5.2 - x * 6.5) * 0.11 * t + Math.sin(time * 2.3 - x * 2.2) * 0.06 * t;
    }
    pos.needsUpdate = true;
    this.cloth.geometry.computeVertexNormals();
  }

  /** A cone was hit by a ball at this spot: rock it. */
  hitCone(x: number, y: number): void {
    let best = null;
    let bestD = 1;
    for (const c of this.cones) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return;
    best.wobble = 1;
    const d = Math.max(1e-3, bestD);
    best.ax = (best.x - x) / d;
    best.az = (best.y - y) / d;
  }

  /** A spring pad at this spot fired. */
  hitSpring(x: number, y: number): void {
    for (const s of this.springs) if (Math.hypot(s.x - x, s.y - y) < 1) s.kick = 1;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      // Textures are shared between holes and stay alive; materials are per hole.
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
  }
}

/** The lowest ground at a point, for scaffolding under stacked levels. */
function floorLowest(L: Level, x: number, y: number): number {
  let z = topAt(L, x, y);
  for (let i = 0; i < 6; i++) {
    const below = floorAt(L, x, y, z - 0.3);
    if (!Number.isFinite(below)) break;
    z = below;
  }
  return z;
}
