import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BALL_R, CUP_R, WALL_H } from '../shared/constants';
import { DIRS, Level, cellAt, cornerHeights, topAt } from '../shared/level';
import type { ItemKind, Pickup } from '../shared/protocol';

export const PLAYER_COLORS = [0xe9ff3a, 0xff4fa3, 0x3df0ff, 0xff8a2a, 0xa98bff, 0x7dff6a, 0xff5252, 0xf4f4f4];
export const ITEM_COLORS: Record<ItemKind, number> = {
  drum: 0xff2e93,
  sandal: 0x2ee6ff,
  swap: 0xff7a1a,
  peanuts: 0xd9ff2e,
};

const NIGHT = 0x070b1c;
const TURF_A = 0x18c964;
const TURF_B = 0x12ad55;
const MUD = 0x6b4a2f;
const TRACK = 0xc8452e;
const CONCRETE = 0x7d8496;
const SLAB_BOTTOM = -1;
const VIEW_H = 13;
const PITCH = 0.74;

export interface BallView {
  id: string;
  color: number;
  x: number;
  y: number;
  z: number;
  hidden: boolean;
}

/** Everything drawn in 3D. It is told what to show and keeps no game rules. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly raycaster = new THREE.Raycaster();
  private readonly lights: THREE.DirectionalLight[] = [];
  private levelGroup: THREE.Group | null = null;
  private level: Level | null = null;
  private readonly balls = new Map<string, THREE.Mesh>();
  private readonly pickups = new Map<number, THREE.Group>();
  private readonly aimDots: THREE.Mesh[] = [];
  private readonly marker: THREE.Mesh;
  private flag: THREE.Group | null = null;
  private pulses: { mesh: THREE.Mesh; age: number }[] = [];
  private readonly ballGeo = new THREE.SphereGeometry(BALL_R, 32, 20);

  /** Where the camera should look, in map coordinates (x, height, y). */
  readonly focus = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private yaw = Math.PI / 4;
  private yawGoal = Math.PI / 4;
  zoom = 1;
  private zoomNow = 1;
  /** Slide the picture sideways by this share of the screen width. */
  shift = 0;
  private shiftNow = 0;
  /** The same, upward, as a share of the screen height. */
  lift = 0;
  private liftNow = 0;
  orbit = false;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.scene.background = new THREE.Color(NIGHT);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;

    this.scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x10203a, 0.55));
    // Two banks of floodlights from opposite corners: everything gets two shadows.
    for (const [color, power] of [
      [0xf2f6ff, 2.1],
      [0xcfe0ff, 1.1],
    ] as const) {
      const light = new THREE.DirectionalLight(color, power);
      light.castShadow = true;
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0005;
      light.shadow.normalBias = 0.02;
      this.scene.add(light, light.target);
      this.lights.push(light);
    }

    const dotGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const dot = new THREE.Mesh(
        dotGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, toneMapped: false }),
      );
      dot.renderOrder = 10;
      dot.visible = false;
      this.scene.add(dot);
      this.aimDots.push(dot);
    }

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(BALL_R * 1.5, BALL_R * 1.9, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, toneMapped: false }),
    );
    this.marker.renderOrder = 9;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.resize();
  }

  resize(): void {
    const c = this.renderer.domElement;
    this.renderer.setSize(c.clientWidth, c.clientHeight, false);
  }

  // ------------------------------------------------------------- the hole

  setLevel(L: Level): void {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            (m as THREE.MeshBasicMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
    }
    for (const g of this.pickups.values()) this.scene.remove(g);
    this.pickups.clear();
    this.level = L;
    this.levelGroup = buildLevel(L);
    this.flag = this.levelGroup.getObjectByName('flag') as THREE.Group;
    this.scene.add(this.levelGroup);

    const cx = L.w / 2;
    const cy = L.h / 2;
    const r = Math.hypot(L.w, L.h) / 2 + 3;
    const spots = [
      [-0.55, 1.5, -0.8],
      [0.8, 1.3, 0.45],
    ];
    this.lights.forEach((light, i) => {
      light.target.position.set(cx, 0, cy);
      light.position.set(cx + spots[i][0] * r, spots[i][1] * r, cy + spots[i][2] * r);
      const cam = light.shadow.camera;
      cam.left = cam.bottom = -r;
      cam.right = cam.top = r;
      cam.near = 0.5;
      cam.far = r * 4;
      cam.updateProjectionMatrix();
    });
  }

  /** The zoom at which the whole hole fits on screen. */
  fitZoom(): number {
    if (!this.level) return 1;
    const c = this.renderer.domElement;
    const aspect = c.clientWidth / Math.max(1, c.clientHeight);
    const room = Math.min(VIEW_H * (1 - Math.abs(this.lift) * 2), VIEW_H * aspect * (1 - Math.abs(this.shift) * 2));
    return room / (Math.hypot(this.level.w, this.level.h) + 1.5);
  }

  /** Turn to the corner view that puts the tee nearest the camera. */
  faceTee(): void {
    if (!this.level) return;
    const vx = this.level.tee.x - this.level.cup.x;
    const vy = this.level.tee.y - this.level.cup.y;
    let best = 0;
    let bestDot = -Infinity;
    for (let k = 0; k < 4; k++) {
      const yaw = Math.PI / 4 + (k * Math.PI) / 2;
      const dot = Math.sin(yaw) * vx + Math.cos(yaw) * vy;
      if (dot > bestDot) {
        bestDot = dot;
        best = yaw;
      }
    }
    // Take the short way round from wherever the camera is now.
    const turn = Math.atan2(Math.sin(best - this.yawGoal), Math.cos(best - this.yawGoal));
    this.yawGoal += turn;
  }

  rotate(steps: number): void {
    this.yawGoal += (steps * Math.PI) / 2;
  }

  // ------------------------------------------------------- moving things

  syncBalls(views: BallView[]): void {
    const seen = new Set<string>();
    for (const v of views) {
      seen.add(v.id);
      let mesh = this.balls.get(v.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          this.ballGeo,
          new THREE.MeshPhysicalMaterial({ color: v.color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
        );
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.balls.set(v.id, mesh);
      }
      mesh.visible = !v.hidden;
      mesh.position.set(v.x, v.z + BALL_R, v.y);
    }
    for (const [id, mesh] of this.balls) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      this.balls.delete(id);
    }
  }

  syncPickups(list: Pickup[]): void {
    if (!this.level) return;
    for (const k of list) {
      let g = this.pickups.get(k.id);
      if (!g || g.userData.kind !== k.kind) {
        if (g) this.scene.remove(g);
        g = buildPickup(k.kind);
        g.position.set(k.x, topAt(this.level, k.x, k.y), k.y);
        this.scene.add(g);
        this.pickups.set(k.id, g);
      }
      g.visible = k.cooldown === 0;
      const prop = g.children[0];
      prop.position.y = 0.38 + Math.sin(this.time * 2.4 + k.id) * 0.05;
      prop.rotation.y = this.time * 1.6;
    }
  }

  /** Show the putt about to be made, or pass null to hide it. */
  setAim(aim: { x: number; y: number; z: number; dx: number; dy: number; power: number } | null): void {
    this.aimDots.forEach((dot, i) => {
      dot.visible = !!aim && aim.power > 0.04;
      if (!aim) return;
      const t = (i + 1) / this.aimDots.length;
      const reach = 0.5 + aim.power * 3.6;
      dot.position.set(aim.x + aim.dx * reach * t, aim.z + 0.03, aim.y + aim.dy * reach * t);
      dot.scale.setScalar(0.085 - t * 0.04);
      const mat = dot.material as THREE.MeshBasicMaterial;
      mat.color.setHex(aim.power > 0.85 ? 0xff2e93 : 0xffffff);
      mat.opacity = 1 - t * 0.5;
    });
  }

  /** Ring under your own ball when it is your move. */
  setMarker(at: { x: number; y: number; z: number } | null): void {
    this.marker.visible = !!at;
    if (!at) return;
    this.marker.position.set(at.x, at.z + 0.02, at.y);
    this.marker.scale.setScalar(1 + Math.sin(this.time * 5) * 0.08);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.75;
  }

  pulse(x: number, y: number, z: number, color: number, size = 1): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, toneMapped: false }),
    );
    mesh.position.set(x, z + 0.04, y);
    mesh.userData.size = size;
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    this.pulses.push({ mesh, age: 0 });
  }

  // ---------------------------------------------------------------- frame

  render(dt: number): void {
    this.time += dt;
    const c = this.renderer.domElement;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.floor(w * this.renderer.getPixelRatio())) this.resize();

    if (this.orbit) this.yawGoal += dt * 0.12;
    const ease = 1 - Math.exp(-dt * 6);
    this.yaw += (this.yawGoal - this.yaw) * ease;
    this.zoomNow += (this.zoom - this.zoomNow) * ease;
    this.shiftNow += (this.shift - this.shiftNow) * ease;
    this.liftNow += (this.lift - this.liftNow) * ease;
    this.look.lerp(this.focus, 1 - Math.exp(-dt * 4));

    const cam = this.camera;
    const aspect = w / Math.max(1, h);
    cam.left = (-VIEW_H * aspect) / 2;
    cam.right = (VIEW_H * aspect) / 2;
    cam.top = VIEW_H / 2;
    cam.bottom = -VIEW_H / 2;
    cam.zoom = this.zoomNow;
    cam.position
      .set(Math.sin(this.yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(this.yaw) * Math.cos(PITCH))
      .multiplyScalar(60)
      .add(this.look);
    cam.lookAt(this.look);
    if (Math.abs(this.shiftNow) + Math.abs(this.liftNow) > 0.001) {
      cam.setViewOffset(w, h, -this.shiftNow * w, this.liftNow * h, w, h);
    }
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();

    if (this.flag) this.flag.rotation.y = this.yaw + Math.PI / 2 + Math.sin(this.time * 1.3) * 0.15;

    this.pulses = this.pulses.filter((p) => {
      p.age += dt;
      const t = p.age / 0.6;
      p.mesh.scale.setScalar((0.2 + t * 1.6) * p.mesh.userData.size);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (t < 1) return true;
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      return false;
    });

    this.renderer.render(this.scene, cam);
  }

  /** Where a screen point lands on a flat plane at this height. */
  groundPoint(clientX: number, clientY: number, height: number): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
    return this.raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.z } : null;
  }

  /** Map point to screen pixels. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, z, y).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }
}

// ------------------------------------------------------------- builders

function buildLevel(L: Level): THREE.Group {
  const group = new THREE.Group();
  const top: number[] = [];
  const topCol: number[] = [];
  const side: number[] = [];
  const sideCol: number[] = [];
  const marks: number[] = [];
  const color = new THREE.Color();
  const boards: THREE.Matrix4[][] = [[], []];

  const quad = (out: number[], cols: number[], pts: number[][], hex: number) => {
    color.setHex(hex);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      out.push(pts[i][0], pts[i][1], pts[i][2]);
      cols.push(color.r, color.g, color.b);
    }
  };

  for (let cy = 0; cy < L.h; cy++) {
    for (let cx = 0; cx < L.w; cx++) {
      const c = cellAt(L, cx, cy);
      if (c.kind === 'void') continue;
      const [nw, ne, se, sw] = cornerHeights(c);
      const P = [
        [cx, nw, cy],
        [cx + 1, ne, cy],
        [cx + 1, se, cy + 1],
        [cx, sw, cy + 1],
      ];
      const hex =
        c.kind === 'block' ? CONCRETE : c.surface === 'mud' ? MUD : c.surface === 'track' ? TRACK : cy % 2 ? TURF_A : TURF_B;
      quad(top, topCol, [P[0], P[3], P[2], P[1]], hex);

      // Walls of the slab wherever the neighbour is lower or missing.
      for (let d = 0; d < 4; d++) {
        const a = P[[0, 1, 2, 3][d]];
        const b = P[[1, 2, 3, 0][d]];
        const n = cellAt(L, cx + DIRS[d][0], cy + DIRS[d][1]);
        let na = SLAB_BOTTOM;
        let nb = SLAB_BOTTOM;
        if (n.kind !== 'void') {
          const nh = cornerHeights(n);
          // The neighbour's corners that touch this edge, in the same order as a and b.
          na = nh[[3, 0, 1, 2][d]];
          nb = nh[[2, 3, 0, 1][d]];
        }
        if (a[1] <= na + 1e-6 && b[1] <= nb + 1e-6) continue;
        const la = Math.min(a[1], na);
        const lb = Math.min(b[1], nb);
        if (n.kind === 'void') {
          // A painted band along the top edge, like the lip of a terrace.
          const band = 0.09;
          quad(side, sideCol, [a, b, [b[0], b[1] - band, b[2]], [a[0], a[1] - band, a[2]]], L.def.boards[0]);
          quad(side, sideCol, [[a[0], a[1] - band, a[2]], [b[0], b[1] - band, b[2]], [b[0], lb, b[2]], [a[0], la, a[2]]], CONCRETE);
        } else {
          quad(side, sideCol, [a, b, [b[0], lb, b[2]], [a[0], la, a[2]]], CONCRETE);
        }
      }

      if (c.kind === 'block') {
        const m = new THREE.Matrix4().makeTranslation(cx + 0.5, c.h + WALL_H / 2, cy + 0.5);
        boards[((cx + cy) >> 1) & 1].push(m);
      }

      if (c.surface === 'track') {
        // Two white chevrons pointing the way the track pushes.
        const [dx, dy] = DIRS[c.dir];
        for (const off of [-0.22, 0.2]) {
          const ox = cx + 0.5 + dx * off;
          const oy = cy + 0.5 + dy * off;
          const y = c.h + 0.008;
          marks.push(
            ox + dx * 0.2, y, oy + dy * 0.2,
            ox - dx * 0.08 - dy * 0.26, y, oy - dy * 0.08 + dx * 0.26,
            ox - dx * 0.08 + dy * 0.26, y, oy - dy * 0.08 - dx * 0.26,
          );
        }
      }
    }
  }

  const mesh = (pos: number[], cols: number[] | null, mat: THREE.Material) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (cols) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  };

  group.add(mesh(top, topCol, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  const walls = mesh(side, sideCol, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
  walls.castShadow = true;
  group.add(walls);
  if (marks.length) {
    group.add(mesh(marks, null, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false })));
  }

  // Perimeter boards: lit from inside, glossy on the outside, with a seam between panels.
  const boardGeo = new THREE.BoxGeometry(0.97, WALL_H, 0.97);
  boards.forEach((list, i) => {
    if (!list.length) return;
    const hex = L.def.boards[i];
    const inst = new THREE.InstancedMesh(
      boardGeo,
      new THREE.MeshPhysicalMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.16, roughness: 0.3, clearcoat: 0.9 }),
      list.length,
    );
    list.forEach((m, j) => inst.setMatrixAt(j, m));
    inst.castShadow = inst.receiveShadow = true;
    group.add(inst);
  });

  // Cup, its painted ring and the flag.
  const cupZ = topAt(L, L.cup.x, L.cup.y);
  const flat = (geo: THREE.BufferGeometry, hex: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }));
    m.position.set(x, z, y);
    group.add(m);
  };
  flat(new THREE.RingGeometry(CUP_R + 0.16, CUP_R + 0.2, 40), 0xffffff, L.cup.x, L.cup.y, cupZ + 0.006);
  flat(new THREE.CircleGeometry(CUP_R, 32), 0x05060a, L.cup.x, L.cup.y, cupZ + 0.008);
  flat(new THREE.CircleGeometry(0.11, 20), 0xffffff, L.tee.x, L.tee.y, topAt(L, L.tee.x, L.tee.y) + 0.006);

  const flag = new THREE.Group();
  flag.name = 'flag';
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }),
  );
  pole.position.y = 0.75;
  pole.castShadow = true;
  const cloth = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.42, 0.14), new THREE.Vector2(0, 0.28)]);
  const pennant = new THREE.Mesh(
    new THREE.ShapeGeometry(cloth),
    new THREE.MeshStandardMaterial({ color: L.def.boards[1], emissive: L.def.boards[1], emissiveIntensity: 0.4, side: THREE.DoubleSide }),
  );
  pennant.position.y = 1.2;
  flag.add(pole, pennant);
  flag.position.set(L.cup.x, cupZ, L.cup.y);
  group.add(flag);

  group.add(buildPitch(L));
  return group;
}

/** The real pitch far below: mown stripes, the centre circle, and one half already dark. */
function buildPitch(L: Level): THREE.Mesh {
  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const bands = 16;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = i % 2 ? '#0c4a2c' : '#0a3f26';
    g.fillRect((i * size) / bands, 0, size / bands + 1, size);
  }
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(size / 2, 0);
  g.lineTo(size / 2, size);
  g.stroke();
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.16, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.arc(size / 2, size / 2, 7, 0, Math.PI * 2);
  g.fill();
  // The far bank of floodlights is off.
  g.fillStyle = 'rgba(4,7,20,0.72)';
  g.fillRect(0, 0, size * 0.43, size);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const span = 64;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  m.position.set(L.w / 2 + 3, SLAB_BOTTOM - 2.5, L.h / 2 - 2);
  return m;
}

function buildPickup(kind: ItemKind): THREE.Group {
  const g = new THREE.Group();
  g.userData.kind = kind;
  const hex = ITEM_COLORS[kind];
  const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.2, clearcoat: 1, emissive: hex, emissiveIntensity: 0.25 });
  let prop: THREE.Object3D;
  if (kind === 'drum') {
    prop = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 24), mat);
    const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.21, 24), new THREE.MeshStandardMaterial({ color: 0xf6efe2 }));
    prop.add(skin);
    prop.rotation.z = 0.5;
  } else if (kind === 'sandal') {
    prop = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 6, 16), mat);
    prop.scale.set(1, 1, 0.3);
    prop.rotation.x = 1.1;
  } else if (kind === 'swap') {
    prop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 28), mat);
  } else {
    prop = new THREE.Group();
    for (const y of [-0.08, 0.08]) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat);
      nut.position.y = y;
      prop.add(nut);
    }
    prop.rotation.z = 0.6;
  }
  prop.traverse((o) => (o.castShadow = true));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.3, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  ring.position.y = 0.007;
  g.add(prop, ring);
  return g;
}
