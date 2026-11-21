import * as THREE from 'three';
import { ARM_LEN, ARM_R, CONE_R, CUP_R, PITCH_DROP, TUNNEL_R, WALL_H } from '../shared/constants';
import { Cell, DIRS, Level, cellAt, cornerHeights, topAt } from '../shared/level';
import { spinnerAngle } from '../shared/physics';

export interface CourseTextures {
  turf: THREE.Texture;
  concrete: THREE.Texture;
  mud: THREE.Texture;
  track: THREE.Texture;
  chevron: THREE.Texture;
  board: THREE.Texture;
  lid: THREE.Texture;
  ripple: THREE.Texture;
}

const TURF_A = 0x24e678;
const TURF_B = 0x19c563;
const DECK_BOTTOM = -0.35;
const BASIN = 0.3;
const CUP_DEPTH = 0.5;

/** Collects quads for one material. */
class Buf {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  private c = new THREE.Color();

  /** Corners counter-clockwise seen from the front. */
  quad(p: number[][], uv: number[][], hex = 0xffffff, scale = 1): void {
    this.c.setHex(hex).multiplyScalar(scale);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  tri(p: number[][], uv: number[][], hex = 0xffffff): void {
    this.c.setHex(hex);
    for (let i = 0; i < 3; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
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

/** Scale a colour so every board glows about equally, whatever its hue. */
function glow(hex: number): number {
  const c = new THREE.Color(hex);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return Math.min(2.6, 0.95 / Math.max(0.05, lum));
}

/** Corner heights as drawn: water is a shallow basin. */
function drawnCorners(c: Cell): [number, number, number, number] {
  if (c.kind === 'water') return [c.h - BASIN, c.h - BASIN, c.h - BASIN, c.h - BASIN];
  return cornerHeights(c);
}

/** One hole as a scene: deck, boards, cup, obstacles, and the scaffolding it stands on. */
export class Course {
  readonly group = new THREE.Group();
  private readonly flag = new THREE.Group();
  private readonly cloth: THREE.Mesh;
  private readonly clothBase: Float32Array;
  private flagLift = 0;
  private readonly spinners: { rotor: THREE.Group; dir: number }[] = [];
  private readonly cones: { mesh: THREE.Group; x: number; y: number; wobble: number; ax: number; az: number }[] = [];
  private readonly scrollers: { tex: THREE.Texture; sx: number; sy: number }[] = [];
  private readonly rings: THREE.Mesh[] = [];

  constructor(
    readonly level: Level,
    tex: CourseTextures,
  ) {
    const L = level;
    const turf = new Buf();
    const mud = new Buf();
    const track = new Buf();
    const concrete = new Buf();
    const led = new Buf();
    const lids = new Buf();
    const chevrons = new Buf();
    const water = new Buf();
    const cupCell = { x: Math.floor(L.cup.x), y: Math.floor(L.cup.y) };

    for (let cy = 0; cy < L.h; cy++) {
      for (let cx = 0; cx < L.w; cx++) {
        const c = cellAt(L, cx, cy);
        if (c.kind === 'void') continue;
        const [nw, ne, se, sw] = drawnCorners(c);
        const P = [
          [cx, nw, cy],
          [cx + 1, ne, cy],
          [cx + 1, se, cy + 1],
          [cx, sw, cy + 1],
        ];
        const topQuad = [P[0], P[3], P[2], P[1]];
        const worldUv = (s: number) => topQuad.map((p) => [p[0] * s, p[2] * s]);

        // ---- the surface you putt on
        if (c.kind === 'water') {
          concrete.quad(topQuad, worldUv(0.5), 0x2c4a5e);
          const y = c.h - 0.07;
          water.quad(
            [
              [cx, y, cy],
              [cx, y, cy + 1],
              [cx + 1, y, cy + 1],
              [cx + 1, y, cy],
            ],
            worldUv(0.5),
          );
        } else if (c.kind === 'block') {
          concrete.quad(topQuad, worldUv(0.5));
        } else if (cx === cupCell.x && cy === cupCell.y) {
          this.cutCup(turf, cx, cy, c.h, cy % 2 ? TURF_A : TURF_B);
        } else if (c.surface === 'mud') {
          mud.quad(topQuad, worldUv(0.5));
        } else if (c.surface === 'track') {
          track.quad(topQuad, worldUv(1));
          // Chevrons lie along the push direction; u runs that way so the texture can scroll.
          const [dx, dy] = DIRS[c.dir];
          const y = c.h + 0.006;
          const along = (p: number[]) => (p[0] - cx - 0.5) * dx + (p[2] - cy - 0.5) * dy + 0.5;
          const across = (p: number[]) => (p[0] - cx - 0.5) * -dy + (p[2] - cy - 0.5) * dx + 0.5;
          const q = topQuad.map((p) => [p[0], y, p[2]]);
          chevrons.quad(q, q.map((p) => [along(p) + cx * dx + cy * dy, across(p)]));
        } else {
          // Ramps are a paler green so the slope reads from above.
          turf.quad(topQuad, worldUv(0.25), c.kind === 'ramp' ? 0x8af7bb : cy % 2 ? TURF_A : TURF_B);
        }

        // ---- sides of the deck wherever the neighbour is lower or missing
        for (let d = 0; d < 4; d++) {
          const a = P[d];
          const b = P[(d + 1) % 4];
          const n = cellAt(L, cx + DIRS[d][0], cy + DIRS[d][1]);
          let na = DECK_BOTTOM;
          let nb = DECK_BOTTOM;
          if (n.kind !== 'void') {
            const nh = drawnCorners(n);
            na = nh[[3, 0, 1, 2][d]];
            nb = nh[[2, 3, 0, 1][d]];
          }
          if (a[1] <= na + 1e-6 && b[1] <= nb + 1e-6) continue;
          const la = Math.min(a[1], na);
          const lb = Math.min(b[1], nb);
          const u0 = a[0] + a[2];
          const u1 = u0 + 1;
          const band = n.kind === 'void' ? 0.1 : 0;
          if (band) {
            // A painted lip along the open edge, so you can see where the deck stops.
            concrete.quad(
              [a, [a[0], a[1] - band, a[2]], [b[0], b[1] - band, b[2]], b],
              [[u0, 0.02], [u0, 0.0], [u1, 0.0], [u1, 0.02]],
              L.def.boards[0],
              1.3,
            );
          }
          concrete.quad(
            [[a[0], a[1] - band, a[2]], [a[0], la, a[2]], [b[0], lb, b[2]], [b[0], b[1] - band, b[2]]],
            [[u0 / 2, a[1] / 2], [u0 / 2, la / 2], [u1 / 2, lb / 2], [u1 / 2, b[1] / 2]],
          );
        }

        // ---- advertising boards
        if (c.kind === 'block') {
          const top = c.h + WALL_H;
          lids.quad(
            [
              [cx, top, cy],
              [cx, top, cy + 1],
              [cx + 1, top, cy + 1],
              [cx + 1, top, cy],
            ],
            worldUv(1),
            L.def.boards[((cx + cy) >> 1) & 1],
            0.62,
          );
          for (let d = 0; d < 4; d++) {
            const n = cellAt(L, cx + DIRS[d][0], cy + DIRS[d][1]);
            let nTop = -Infinity;
            if (n.kind === 'block') nTop = n.h + WALL_H;
            else if (n.kind !== 'void') {
              const nh = drawnCorners(n);
              nTop = Math.max(nh[[3, 0, 1, 2][d]], nh[[2, 3, 0, 1][d]]);
            }
            const bottom = Math.max(c.h, nTop);
            if (bottom >= top - 0.01) continue;
            const a = P[d];
            const b = P[(d + 1) % 4];
            // "Right" as seen by someone facing this side, so the lettering reads forwards.
            const [nx, nz] = DIRS[d];
            const along = (p: number[]) => p[0] * nz - p[2] * nx;
            const ua = along(a);
            const ub = along(b);
            const v0 = (bottom - c.h) / WALL_H;
            const panel = Math.floor((Math.min(ua, ub) + 1000) / 2) % 2;
            const hex = L.def.boards[panel];
            led.quad(
              [[a[0], top, a[2]], [b[0], top, b[2]], [b[0], bottom, b[2]], [a[0], bottom, a[2]]],
              [[ua / 16, 1], [ub / 16, 1], [ub / 16, v0], [ua / 16, v0]],
              hex,
              glow(hex),
            );
          }
        }
      }
    }

    const add = (m: THREE.Mesh | null, cast: boolean, receive: boolean) => {
      if (!m) return;
      m.castShadow = cast;
      m.receiveShadow = receive;
      this.group.add(m);
    };
    add(turf.mesh(new THREE.MeshStandardMaterial({ map: tex.turf, vertexColors: true, roughness: 0.92 })), false, true);
    add(mud.mesh(new THREE.MeshStandardMaterial({ map: tex.mud, roughness: 0.45 })), false, true);
    add(track.mesh(new THREE.MeshStandardMaterial({ map: tex.track, roughness: 0.8 })), false, true);
    add(
      concrete.mesh(
        new THREE.MeshStandardMaterial({ map: tex.concrete, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
      ),
      true,
      true,
    );
    // LED faces give out light, so they ignore the floodlights and shadows.
    add(led.mesh(new THREE.MeshBasicMaterial({ map: tex.board, vertexColors: true })), true, false);
    add(
      lids.mesh(new THREE.MeshStandardMaterial({ map: tex.lid, vertexColors: true, roughness: 0.55 })),
      true,
      true,
    );
    this.scrollers.push({ tex: tex.board, sx: 0.012, sy: 0 });

    const chev = chevrons.mesh(
      new THREE.MeshBasicMaterial({ map: tex.chevron, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    if (chev) {
      this.group.add(chev);
      this.scrollers.push({ tex: tex.chevron, sx: -1.6, sy: 0 });
    }

    const pool = water.mesh(
      new THREE.MeshPhysicalMaterial({
        color: 0x0f6ea3,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        envMapIntensity: 3,
      }),
    );
    if (pool) {
      pool.receiveShadow = true;
      this.group.add(pool);
      const ripples = new THREE.Mesh(
        pool.geometry,
        new THREE.MeshBasicMaterial({
          map: tex.ripple,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.95,
        }),
      );
      ripples.position.y = 0.004;
      this.group.add(ripples);
      this.scrollers.push({ tex: tex.ripple, sx: 0.05, sy: 0.03 });
    }

    this.buildCup();
    this.cloth = this.buildFlag();
    this.clothBase = (this.cloth.geometry.getAttribute('position').array as Float32Array).slice();
    this.buildTee();
    this.buildProps();
    this.buildScaffold();
  }

  // ------------------------------------------------------------ pieces

  /** The cup's cell: turf with a real round hole in it. */
  private cutCup(turf: Buf, cx: number, cy: number, h: number, hex: number): void {
    const L = this.level;
    const shape = new THREE.Shape();
    shape.moveTo(cx, cy);
    shape.lineTo(cx + 1, cy);
    shape.lineTo(cx + 1, cy + 1);
    shape.lineTo(cx, cy + 1);
    shape.closePath();
    shape.holes.push(new THREE.Path().absarc(L.cup.x, L.cup.y, CUP_R, 0, Math.PI * 2, false));
    const g = new THREE.ShapeGeometry(shape, 40);
    const p = g.getAttribute('position');
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      // Reverse the winding: the shape is drawn in the map plane, which is upside down here.
      const tri = [idx.getX(i), idx.getX(i + 2), idx.getX(i + 1)].map((k) => [p.getX(k), h, p.getY(k)]);
      turf.tri(tri, tri.map((q) => [q[0] * 0.25, q[2] * 0.25]), hex);
    }
    g.dispose();
  }

  private buildCup(): void {
    const L = this.level;
    const z = topAt(L, L.cup.x, L.cup.y);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(CUP_R, CUP_R, CUP_DEPTH, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x565c68, roughness: 0.7, side: THREE.BackSide }),
    );
    wall.position.set(L.cup.x, z - CUP_DEPTH / 2, L.cup.y);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(CUP_R, 32).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0c0e13, roughness: 0.9 }),
    );
    floor.position.set(L.cup.x, z - CUP_DEPTH, L.cup.y);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(CUP_R, 0.014, 8, 48).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    rim.position.set(L.cup.x, z + 0.002, L.cup.y);
    // A chalk ring round the cup, like the centre circle.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(CUP_R + 0.2, CUP_R + 0.26, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    );
    ring.position.set(L.cup.x, z + 0.005, L.cup.y);
    this.group.add(wall, floor, rim, ring);
  }

  private buildFlag(): THREE.Mesh {
    const L = this.level;
    const hex = L.def.boards[1];
    const z = topAt(L, L.cup.x, L.cup.y);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.9, 10),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.35, metalness: 0.2 }),
    );
    pole.position.y = 1.45 - CUP_DEPTH;
    pole.castShadow = true;
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(glow(hex)) }),
    );
    knob.position.y = 2.42;
    // A long pennant with enough segments to ripple.
    const geo = new THREE.PlaneGeometry(1.15, 0.62, 14, 4).translate(0.575, 0, 0);
    const cloth = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.55, roughness: 0.7, side: THREE.DoubleSide }),
    );
    cloth.position.y = 2.05;
    cloth.castShadow = true;
    this.flag.add(pole, knob, cloth);
    this.flag.position.set(L.cup.x, z, L.cup.y);
    this.flag.rotation.y = 0.5;
    this.group.add(this.flag);
    return cloth;
  }

  private buildTee(): void {
    const L = this.level;
    const z = topAt(L, L.tee.x, L.tee.y);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2), mat);
    spot.position.set(L.tee.x, z + 0.005, L.tee.y);
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.38, 40).rotateX(-Math.PI / 2), mat);
    arc.position.copy(spot.position);
    this.group.add(spot, arc);
  }

  private buildProps(): void {
    const L = this.level;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc9d0dc, roughness: 0.25, metalness: 0.9 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 });

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
      g.position.set(c.x, topAt(L, c.x, c.y), c.y);
      this.group.add(g);
      this.cones.push({ mesh: g, x: c.x, y: c.y, wobble: 0, ax: 0, az: 0 });
    }

    // Turnstiles: a post with two bars through it.
    const tip = new THREE.MeshBasicMaterial({ color: new THREE.Color(L.def.boards[0]).multiplyScalar(glow(L.def.boards[0])) });
    for (const s of L.spinners) {
      const z = topAt(L, s.x, s.y);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 20), rubber);
      post.position.set(s.x, z + 0.21, s.y);
      post.castShadow = true;
      const rotor = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const bar = new THREE.Mesh(new THREE.CapsuleGeometry(ARM_R, ARM_LEN * 2 - ARM_R * 2, 6, 12).rotateZ(Math.PI / 2), steel);
        bar.rotation.y = (k * Math.PI) / 2;
        bar.castShadow = true;
        rotor.add(bar);
        for (const side of [-1, 1]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(ARM_R * 1.25, 12, 8), tip);
          cap.position.set(k ? 0 : side * ARM_LEN, 0, k ? side * ARM_LEN : 0);
          rotor.add(cap);
        }
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), steel);
      cap.position.y = 0.18;
      rotor.add(cap);
      rotor.position.set(s.x, z + 0.2, s.y);
      this.group.add(post, rotor);
      this.spinners.push({ rotor, dir: s.dir });
    }

    // Players' tunnel: a dark mouth with a lit ring, and a ring where the ball comes out.
    for (const t of L.tunnels) {
      for (const [x, y, hex, isMouth] of [
        [t.x, t.y, 0x2ee6ff, true],
        [t.tx, t.ty, 0xff7a1a, false],
      ] as const) {
        const z = topAt(L, x, y);
        const hole = new THREE.Mesh(
          new THREE.CircleGeometry(TUNNEL_R, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: isMouth ? 0x020308 : 0x1a0f08 }),
        );
        hole.position.set(x, z + 0.006, y);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(TUNNEL_R, TUNNEL_R + 0.08, 40).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(glow(hex)), transparent: true }),
        );
        ring.position.set(x, z + 0.008, y);
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(TUNNEL_R + 0.1, 0.045, 10, 28, Math.PI),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(glow(hex)) }),
        );
        arch.position.set(x, z, y);
        arch.castShadow = true;
        this.group.add(hole, ring, arch);
        this.rings.push(ring);
      }
    }
  }

  /** Scaffold tubes from the deck down to the pitch, so the course stands on something. */
  private buildScaffold(): void {
    const L = this.level;
    const solid = (cx: number, cy: number) => cellAt(L, cx, cy).kind !== 'void';
    const under = (gx: number, gy: number) => solid(gx, gy) || solid(gx - 1, gy) || solid(gx, gy - 1) || solid(gx - 1, gy - 1);
    const posts: [number, number][] = [];
    for (let gy = 0; gy <= L.h; gy += 2) {
      for (let gx = 0; gx <= L.w; gx += 2) if (under(gx, gy)) posts.push([gx, gy]);
    }
    const has = new Set(posts.map(([x, y]) => `${x},${y}`));
    const tubes: THREE.Matrix4[] = [];
    const height = PITCH_DROP + DECK_BOTTOM;
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
    for (const [x, y] of posts) {
      tube(new THREE.Vector3(x, -PITCH_DROP, y), new THREE.Vector3(x, DECK_BOTTOM, y));
      for (const [dx, dy] of [
        [2, 0],
        [0, 2],
      ]) {
        if (!has.has(`${x + dx},${y + dy}`)) continue;
        for (const lvl of [0.3, 0.72]) {
          const yy = -PITCH_DROP + height * lvl;
          tube(new THREE.Vector3(x, yy, y), new THREE.Vector3(x + dx, yy, y + dy));
        }
        // One diagonal per bay, leaning alternately.
        const flip = ((x + y) / 2) % 2 === 0;
        tube(
          new THREE.Vector3(flip ? x : x + dx, -PITCH_DROP + height * 0.3, flip ? y : y + dy),
          new THREE.Vector3(flip ? x + dx : x, -PITCH_DROP + height * 0.72, flip ? y + dy : y),
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
  update(dt: number, time: number, tick: number, ballNearCup: boolean): void {
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

    this.rings.forEach((r, i) => {
      r.scale.setScalar(1 + Math.sin(time * 4 + i) * 0.06);
    });

    // The flag is lifted out of the way when a ball is close, as a caddie would.
    this.flagLift += ((ballNearCup ? 1 : 0) - this.flagLift) * (1 - Math.exp(-dt * 6));
    this.flag.position.y = topAt(this.level, this.level.cup.x, this.level.cup.y) + this.flagLift * 1.3;

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

  /** A cone was hit by a ball coming from this spot: rock it. */
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

  dispose(): void {
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      // Textures are shared between holes and stay alive; materials are per hole.
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
  }
}
