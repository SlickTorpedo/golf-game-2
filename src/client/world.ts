import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BALL_R, PITCH_DROP } from '../shared/constants';
import { Level, topAt } from '../shared/level';
import type { HitMaterial } from '../shared/physics';
import type { ItemKind, Pickup } from '../shared/protocol';
import { Course, CourseTextures } from './course';
import { Particles, Trail } from './fx';
import * as paint from './textures';

export const PLAYER_COLORS = [0xe9ff3a, 0xff4fa3, 0x3df0ff, 0xff8a2a, 0xa98bff, 0x7dff6a, 0xff5252, 0xf4f4f4];
export const ITEM_COLORS: Record<ItemKind, number> = {
  drum: 0xff2e93,
  sandal: 0x2ee6ff,
  swap: 0xff7a1a,
  peanuts: 0xd9ff2e,
};

const NIGHT = 0x070b1c;
const FOV = 36;
const MIN_PITCH = 0.2;
const MAX_PITCH = 1.38;
const AIM_DOTS = 44;

export interface BallView {
  id: string;
  color: number;
  x: number;
  y: number;
  z: number;
  holed: boolean;
}

/** Scenery that sits round the course. Its pitch is the plane y = 0 at its origin. */
export interface Backdrop {
  group: THREE.Group;
  update(dt: number, time: number): void;
}

interface BallRig {
  /** Moves and squashes. */
  group: THREE.Group;
  /** Spins. */
  mesh: THREE.Mesh;
  trail: Trail;
  last: THREE.Vector3;
  speed: number;
  squash: number;
  sink: number;
}

/** Everything drawn in 3D. It is told what to show and keeps no game rules. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 900);
  private readonly composer: EffectComposer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly lights: THREE.DirectionalLight[] = [];
  private readonly tex: CourseTextures;
  private readonly dimples = paint.dimpleTexture();
  private readonly particles: Particles;
  private course: Course | null = null;
  private level: Level | null = null;
  private backdrop: Backdrop | null = null;
  private readonly balls = new Map<string, BallRig>();
  private readonly pickups = new Map<number, THREE.Group>();
  private readonly aimDots: THREE.InstancedMesh;
  private readonly aimHead: THREE.Mesh;
  private readonly marker: THREE.Mesh;
  private pulses: { mesh: THREE.Mesh; age: number }[] = [];
  private readonly ballGeo = new THREE.SphereGeometry(BALL_R, 40, 28);
  private time = 0;
  private readonly size = new THREE.Vector2();

  // ---- camera rig
  /** 'title' drifts round the hole, 'overview' frames all of it, 'play' stays with your ball. */
  mode: 'title' | 'overview' | 'play' = 'title';
  /** Your ball, in map coordinates, while playing. */
  follow: { x: number; y: number; z: number } | null = null;
  /** Slide the picture sideways / upward by this share of the screen. */
  shift = 0;
  lift = 0;
  private shiftNow = 0;
  private liftNow = 0;
  private readonly look = new THREE.Vector3();
  private yaw = Math.PI / 4;
  private yawGoal = Math.PI / 4;
  private pitch = 0.8;
  private pitchGoal = 0.8;
  private dist = 30;
  private zoomFactor = 1;
  private shakeAmt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.scene.background = new THREE.Color(NIGHT);
    this.scene.fog = new THREE.FogExp2(NIGHT, 0.0045);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;

    this.scene.add(new THREE.HemisphereLight(0xa9bcff, 0x0b1830, 0.5));
    // Two banks of floodlights from opposite corners: everything gets two shadows.
    for (const [color, power] of [
      [0xf4f7ff, 1.9],
      [0xc4d6ff, 0.8],
    ] as const) {
      const light = new THREE.DirectionalLight(color, power);
      light.castShadow = true;
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0004;
      light.shadow.normalBias = 0.02;
      light.shadow.radius = 3;
      this.scene.add(light, light.target);
      this.lights.push(light);
    }

    // Rendered to a floating-point buffer so the boards can be brighter than white and bloom.
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // One bad pixel (not-a-number or absurdly bright) would be smeared over the whole
    // screen by the bloom blur, so clean the picture first.
    this.composer.addPass(
      new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv);' +
          ' vec3 rgb = vec3(c.r == c.r ? c.r : 0.0, c.g == c.g ? c.g : 0.0, c.b == c.b ? c.b : 0.0);' +
          ' gl_FragColor = vec4(clamp(rgb, 0.0, 24.0), 1.0); }',
      }),
    );
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.7, 0.82));
    this.composer.addPass(new OutputPass());

    this.tex = {
      turf: paint.turfTexture(),
      concrete: paint.concreteTexture(),
      mud: paint.mudTexture(),
      track: paint.trackTexture(),
      chevron: paint.chevronTexture(),
      board: paint.boardTexture(),
      lid: paint.lidTexture(),
      ripple: paint.rippleTexture(),
    };
    this.particles = new Particles(paint.sparkTexture());
    this.scene.add(this.particles.points);

    this.aimDots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.95 }),
      AIM_DOTS,
    );
    this.aimDots.renderOrder = 10;
    this.aimDots.frustumCulled = false;
    this.aimDots.count = 0;
    this.aimHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.3, 16).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }),
    );
    this.aimHead.renderOrder = 10;
    this.aimHead.visible = false;
    this.scene.add(this.aimDots, this.aimHead);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(BALL_R * 1.55, BALL_R * 1.95, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
    );
    this.marker.renderOrder = 5;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.resize();
  }

  resize(): void {
    const c = this.renderer.domElement;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    this.size.set(w, h);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  setBackdrop(b: Backdrop): void {
    this.backdrop = b;
    this.scene.add(b.group);
    this.placeBackdrop();
  }

  private placeBackdrop(): void {
    if (this.backdrop && this.level) this.backdrop.group.position.set(this.level.w / 2, -PITCH_DROP, this.level.h / 2);
  }

  // ------------------------------------------------------------- the hole

  setLevel(L: Level): void {
    if (this.course) {
      this.scene.remove(this.course.group);
      this.course.dispose();
    }
    for (const g of this.pickups.values()) this.scene.remove(g);
    this.pickups.clear();
    this.level = L;
    this.course = new Course(L, this.tex);
    this.scene.add(this.course.group);
    this.placeBackdrop();

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

  /** Swing round to the corner view with the tee nearest, arriving with a short sweep. */
  frameHole(): void {
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
    this.yawGoal += Math.atan2(Math.sin(best - this.yawGoal), Math.cos(best - this.yawGoal));
    this.yaw = this.yawGoal - 0.7;
    // Start low, looking across at the stands, then rise over the hole.
    this.pitchGoal = 0.62;
    this.pitch = 0.26;
    this.dist = this.fitDistance() * 1.35;
    this.zoomFactor = 1;
    this.look.set(this.level.w / 2, 0, this.level.h / 2);
  }

  /** Drag to look around: pixels moved. */
  orbitBy(dx: number, dy: number): void {
    this.yawGoal -= dx * 0.006;
    this.pitchGoal = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitchGoal + dy * 0.005));
  }

  zoomBy(factor: number): void {
    this.zoomFactor = Math.min(1.5, Math.max(0.4, this.zoomFactor * factor));
  }

  /** Distance from which the whole hole fits on screen. */
  private fitDistance(): number {
    if (!this.level) return 30;
    const aspect = this.size.x / this.size.y;
    const halfV = THREE.MathUtils.degToRad(FOV / 2) * (1 - Math.abs(this.lift) * 2);
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect) * (1 - Math.abs(this.shift) * 2);
    const r = Math.hypot(this.level.w, this.level.h) / 2 + 0.8;
    return r / Math.sin(Math.min(halfV, halfH));
  }

  // ------------------------------------------------------- moving things

  syncBalls(views: BallView[], dt: number): void {
    const seen = new Set<string>();
    const L = this.level;
    for (const v of views) {
      seen.add(v.id);
      let rig = this.balls.get(v.id);
      if (!rig) {
        const mesh = new THREE.Mesh(
          this.ballGeo,
          new THREE.MeshPhysicalMaterial({
            map: paint.ballTexture(v.color),
            bumpMap: this.dimples,
            bumpScale: 1.2,
            roughness: 0.22,
            clearcoat: 0.9,
            clearcoatRoughness: 0.12,
          }),
        );
        mesh.castShadow = true;
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        const group = new THREE.Group();
        group.add(mesh);
        const trail = new Trail(v.color);
        this.scene.add(group, trail.mesh);
        rig = { group, mesh, trail, last: new THREE.Vector3(v.x, v.z, v.y), speed: 0, squash: 0, sink: -1 };
        this.balls.set(v.id, rig);
      }

      const p = new THREE.Vector3(v.x, v.z + BALL_R, v.y);
      if (v.holed && L) {
        // Drop into the cup, then vanish.
        if (rig.sink < 0) rig.sink = 0;
        rig.sink += dt;
        const t = Math.min(1, rig.sink / 0.32);
        p.set(L.cup.x, topAt(L, L.cup.x, L.cup.y) + BALL_R - t * t * 0.46, L.cup.y);
        rig.group.visible = rig.sink < 0.9;
      } else {
        rig.sink = -1;
        rig.group.visible = true;
      }

      // Roll: turn the ball about the axis across its direction of travel.
      const step = p.clone().sub(rig.last);
      const flat = Math.hypot(step.x, step.z);
      if (flat > 1e-5 && flat < 1.5) {
        const axis = new THREE.Vector3(step.z, 0, -step.x).normalize();
        rig.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, flat / BALL_R));
      }
      rig.speed = dt > 0 && flat < 1.5 ? flat / dt : 0;
      rig.last.copy(p);

      rig.squash = Math.max(0, rig.squash - dt * 7);
      const s = rig.squash * 0.22;
      rig.group.scale.set(1 + s, 1 - s * 1.4, 1 + s);
      rig.group.position.copy(p);
      rig.trail.mesh.visible = rig.group.visible;
      rig.trail.push(new THREE.Vector3(p.x, p.y - BALL_R + 0.03, p.z), v.holed ? 0 : rig.speed, BALL_R * 0.85);
    }
    for (const [id, rig] of this.balls) {
      if (seen.has(id)) continue;
      this.scene.remove(rig.group, rig.trail.mesh);
      const mat = rig.mesh.material as THREE.MeshPhysicalMaterial;
      mat.map?.dispose();
      mat.dispose();
      rig.trail.dispose();
      this.balls.delete(id);
    }
  }

  /** How fast a ball is moving on screen right now, for the rolling sound. */
  ballSpeed(id: string): number {
    return this.balls.get(id)?.speed ?? 0;
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
      prop.position.y = 0.42 + Math.sin(this.time * 2.4 + k.id) * 0.06;
      prop.rotation.y = this.time * 1.6;
      g.children[1].scale.setScalar(1 + Math.sin(this.time * 3 + k.id) * 0.08);
    }
    for (const [id, g] of this.pickups) {
      if (list.some((k) => k.id === id)) continue;
      this.scene.remove(g);
      this.pickups.delete(id);
    }
  }

  /**
   * Show the line the putt will take: points along the predicted path, in map
   * coordinates, starting at the ball. Pass null to hide it.
   */
  setAim(path: { x: number; y: number; z: number }[] | null, power = 0): void {
    if (!path || path.length < 2) {
      this.aimDots.count = 0;
      this.aimHead.visible = false;
      return;
    }
    const n = Math.min(AIM_DOTS, path.length);
    const m = new THREE.Matrix4();
    const color = new THREE.Color(0xffffff).lerp(new THREE.Color(0xff2e93), Math.max(0, power - 0.55) / 0.45);
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const t = i / (n - 1);
      const s = 0.07 * (1 - t * 0.55);
      m.makeScale(s, s, s).setPosition(p.x, p.z + BALL_R, p.y);
      this.aimDots.setMatrixAt(i, m);
    }
    this.aimDots.count = n;
    this.aimDots.instanceMatrix.needsUpdate = true;
    (this.aimDots.material as THREE.MeshBasicMaterial).color.copy(color);

    const a = path[n - 2];
    const b = path[n - 1];
    this.aimHead.visible = true;
    this.aimHead.position.set(b.x, b.z + BALL_R, b.y);
    this.aimHead.lookAt(b.x + (b.x - a.x), b.z + BALL_R + (b.z - a.z), b.y + (b.y - a.y));
    (this.aimHead.material as THREE.MeshBasicMaterial).color.copy(color);
  }

  /** Ring under your own ball when it is your move. */
  setMarker(at: { x: number; y: number; z: number } | null): void {
    this.marker.visible = !!at;
    if (!at) return;
    this.marker.position.set(at.x, at.z + 0.012, at.y);
    this.marker.scale.setScalar(1.1 + Math.sin(this.time * 5) * 0.1);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.8;
  }

  // -------------------------------------------------------------- effects

  pulse(x: number, y: number, z: number, color: number, size = 1): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, depthWrite: false }),
    );
    mesh.position.set(x, z + 0.04, y);
    mesh.userData.size = size;
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    this.pulses.push({ mesh, age: 0 });
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(0.5, this.shakeAmt + amount);
  }

  squash(id: string, amount: number): void {
    const rig = this.balls.get(id);
    if (rig) rig.squash = Math.min(1, Math.max(rig.squash, amount));
  }

  /** Turf thrown back from under the putter. */
  puttFx(x: number, y: number, z: number, dx: number, dy: number, power: number): void {
    this.particles.burst({
      at: new THREE.Vector3(x, z + 0.03, y),
      count: Math.round(5 + power * 16),
      colors: [0x2fe57e, 0x18b85a, 0xf2fff0, 0x0f7a3c],
      speed: [0.6, 1.6 + power * 3],
      dir: new THREE.Vector3(-dx, 0.7, -dy),
      spread: 0.45,
      life: [0.25, 0.6],
      gravity: 12,
    });
  }

  bounceFx(x: number, y: number, z: number, speed: number, material: HitMaterial, color: number): void {
    const hard = Math.min(1, speed / 10);
    this.particles.burst({
      at: new THREE.Vector3(x, z + BALL_R, y),
      count: Math.round(3 + hard * 12),
      colors: material === 'board' ? [color, 0xffffff] : material === 'cone' ? [0xff7a1a, 0xffffff] : [0xdfe6f5, 0x9aa3b5],
      speed: [0.8, 1.5 + hard * 3.5],
      life: [0.15, 0.4],
      gravity: 6,
    });
    if (material === 'cone') this.course?.hitCone(x, y);
  }

  landFx(x: number, y: number, z: number, speed: number): void {
    this.particles.burst({
      at: new THREE.Vector3(x, z + 0.03, y),
      count: Math.round(6 + Math.min(14, speed)),
      colors: [0x2fe57e, 0xdfffe6, 0x18b85a],
      speed: [0.8, 2.2],
      life: [0.2, 0.5],
      gravity: 10,
    });
  }

  /** Confetti out of the cup, in the scorer's colour. */
  holedFx(color: number): void {
    const L = this.level;
    if (!L) return;
    const z = topAt(L, L.cup.x, L.cup.y);
    this.particles.burst({
      at: new THREE.Vector3(L.cup.x, z + 0.05, L.cup.y),
      count: 90,
      colors: [color, color, 0xffffff, 0xd9ff2e, 0xff2e93, 0x2ee6ff],
      speed: [1.5, 4.2],
      lift: 3.2,
      spread: 0.75,
      dir: new THREE.Vector3(0, 1, 0),
      life: [0.7, 1.6],
      gravity: 7,
    });
    this.pulse(L.cup.x, L.cup.y, z, color, 1.6);
  }

  splashFx(x: number, y: number, z: number): void {
    this.particles.burst({
      at: new THREE.Vector3(x, z, y),
      count: 46,
      colors: [0xbfeaff, 0xffffff, 0x58b8e8],
      speed: [1.2, 3.4],
      lift: 2.4,
      spread: 0.6,
      dir: new THREE.Vector3(0, 1, 0),
      life: [0.4, 0.9],
      gravity: 11,
    });
    this.pulse(x, y, z, 0xbfeaff, 0.9);
  }

  sparkleFx(x: number, y: number, z: number, color: number, count = 26): void {
    this.particles.burst({
      at: new THREE.Vector3(x, z + 0.2, y),
      count,
      colors: [color, 0xffffff],
      speed: [0.8, 2.6],
      life: [0.3, 0.8],
      gravity: 3,
    });
  }

  // ---------------------------------------------------------------- frame

  render(dt: number, tick: number, ballNearCup: boolean): void {
    this.time += dt;
    const c = this.renderer.domElement;
    if (c.clientWidth !== this.size.x || c.clientHeight !== this.size.y) this.resize();
    const L = this.level;

    // ---- camera
    const ease = 1 - Math.exp(-dt * 5);
    if (this.mode === 'title') this.yawGoal += dt * 0.09;
    this.shiftNow += (this.shift - this.shiftNow) * ease;
    this.liftNow += (this.lift - this.liftNow) * ease;
    const fit = this.fitDistance();
    let distGoal = fit;
    const focus = new THREE.Vector3(L ? L.w / 2 : 0, 0, L ? L.h / 2 : 0);
    if (this.mode === 'title') {
      distGoal = fit * 1.08;
      this.pitchGoal = 0.33;
    } else if (this.mode === 'play' && this.follow) {
      distGoal = Math.min(fit, 27) * this.zoomFactor;
      // The closer in, the more the camera stays with the ball rather than the hole.
      const stay = Math.min(1, Math.max(0, (fit / distGoal - 1) * 1.4));
      focus.lerp(new THREE.Vector3(this.follow.x, this.follow.z, this.follow.y), stay);
    }
    distGoal = Math.min(52, distGoal);
    const turn = 1 - Math.exp(-dt * (this.mode === 'play' ? 12 : 2.2));
    this.yaw += (this.yawGoal - this.yaw) * turn;
    this.pitch += (this.pitchGoal - this.pitch) * turn;
    this.dist += (distGoal - this.dist) * (1 - Math.exp(-dt * 3.5));
    this.look.lerp(focus, 1 - Math.exp(-dt * 4));

    const cam = this.camera;
    cam.aspect = this.size.x / this.size.y;
    cam.position
      .set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
      .multiplyScalar(this.dist)
      .add(this.look);
    cam.lookAt(this.look);
    if (this.shakeAmt > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shakeAmt;
      cam.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 9);
    }
    if (Math.abs(this.shiftNow) + Math.abs(this.liftNow) > 0.001) {
      cam.setViewOffset(this.size.x, this.size.y, -this.shiftNow * this.size.x, this.liftNow * this.size.y, this.size.x, this.size.y);
    } else {
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();

    // ---- things that move by themselves
    this.course?.update(dt, this.time, tick, ballNearCup);
    this.backdrop?.update(dt, this.time);
    this.particles.update(dt);
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

    this.composer.render(dt);
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

function buildPickup(kind: ItemKind): THREE.Group {
  const g = new THREE.Group();
  g.userData.kind = kind;
  const hex = ITEM_COLORS[kind];
  const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.2, clearcoat: 1, emissive: hex, emissiveIntensity: 0.5 });
  let prop: THREE.Object3D;
  if (kind === 'drum') {
    // A supporters' bass drum on its side.
    prop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 28), mat);
    const skin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.175, 0.215, 28),
      new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.6 }),
    );
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.018, 8, 28).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.3 }),
    );
    hoop.position.y = 0.09;
    const hoop2 = hoop.clone();
    hoop2.position.y = -0.09;
    prop.add(skin, hoop, hoop2);
    prop.rotation.z = 0.55;
  } else if (kind === 'sandal') {
    // A flip-flop: sole and a thong strap.
    prop = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 18), mat);
    prop.scale.set(1, 1, 0.22);
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.02, 8, 18, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    );
    strap.position.set(0, 0.07, 0.11);
    strap.scale.set(1, 1, 3.2);
    strap.rotation.x = -0.2;
    prop.add(strap);
    prop.rotation.x = 1.0;
  } else if (kind === 'swap') {
    // Two rings linked.
    prop = new THREE.Group();
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 10, 28), mat);
    a.position.x = -0.09;
    const b = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.045, 10, 28),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 }),
    );
    b.position.x = 0.09;
    b.rotation.x = Math.PI / 2;
    prop.add(a, b);
  } else {
    // A peanut in its shell.
    prop = new THREE.Group();
    const shell = new THREE.MeshPhysicalMaterial({ color: 0xe2c48a, roughness: 0.6, emissive: hex, emissiveIntensity: 0.18 });
    for (const y of [-0.09, 0.09]) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), shell);
      nut.position.y = y;
      nut.scale.set(1, 1.15, 1);
      prop.add(nut);
    }
    prop.rotation.z = 0.6;
  }
  prop.traverse((o) => (o.castShadow = true));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.36, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.8), transparent: true, depthWrite: false }),
  );
  ring.position.y = 0.01;
  // A soft column of light so pickups can be found from across the hole.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 1.5, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = 0.75;
  g.add(prop, ring, beam);
  return g;
}
