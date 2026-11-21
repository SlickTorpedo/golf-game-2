import * as THREE from 'three';

const MAX = 1400;

interface Burst {
  /** Where, in scene coordinates (x, up, z). */
  at: THREE.Vector3;
  count: number;
  colors: number[];
  /** Launch speed range. */
  speed: [number, number];
  /** Main direction; particles spread round it by `spread` (0 = a jet, 1 = every way). */
  dir?: THREE.Vector3;
  spread?: number;
  life?: [number, number];
  gravity?: number;
  /** Extra upward kick. */
  lift?: number;
}

/** One pool of small glowing dots for every puff, spark and scrap of confetti. */
export class Particles {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 4);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private readonly span = new Float32Array(MAX);
  private readonly grav = new Float32Array(MAX);
  private readonly floor = new Float32Array(MAX);
  private next = 0;
  private readonly tmp = new THREE.Color();

  constructor(map: THREE.Texture) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.13,
        map,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }

  burst(b: Burst): void {
    const spread = b.spread ?? 1;
    const life = b.life ?? [0.35, 0.8];
    for (let n = 0; n < b.count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      // A random direction, pulled toward dir by (1 - spread).
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      let dx = s * Math.cos(a);
      let dy = Math.abs(u);
      let dz = s * Math.sin(a);
      if (b.dir) {
        dx = dx * spread + b.dir.x * (1 - spread);
        dy = dy * spread + b.dir.y * (1 - spread);
        dz = dz * spread + b.dir.z * (1 - spread);
      }
      const sp = b.speed[0] + Math.random() * (b.speed[1] - b.speed[0]);
      this.pos.set([b.at.x, b.at.y, b.at.z], i * 3);
      this.vel.set([dx * sp, dy * sp + (b.lift ?? 0), dz * sp], i * 3);
      this.span[i] = this.life[i] = life[0] + Math.random() * (life[1] - life[0]);
      this.grav[i] = b.gravity ?? 9;
      this.floor[i] = b.at.y - 0.02;
      this.tmp.setHex(b.colors[Math.floor(Math.random() * b.colors.length)]);
      this.col.set([this.tmp.r, this.tmp.g, this.tmp.b, 1], i * 4);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < this.floor[i] && this.vel[k + 1] < 0) {
        // Settle on the turf with one small hop.
        this.pos[k + 1] = this.floor[i];
        this.vel[k + 1] *= -0.3;
        this.vel[k] *= 0.5;
        this.vel[k + 2] *= 0.5;
      }
      this.col[i * 4 + 3] = this.life[i] <= 0 ? 0 : Math.min(1, (this.life[i] / this.span[i]) * 2.2);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

const TRAIL = 18;

/** A fading ribbon behind a fast ball. */
export class Trail {
  readonly mesh: THREE.Mesh;
  private readonly pts: THREE.Vector3[] = [];
  private readonly pos = new Float32Array(TRAIL * 2 * 3);
  private readonly col = new Float32Array(TRAIL * 2 * 4);
  private readonly color: THREE.Color;

  constructor(color: number) {
    this.color = new THREE.Color(color);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  /** Call every frame with the ball's position and speed. */
  push(p: THREE.Vector3, speed: number, width: number): void {
    const last = this.pts[0];
    if (last && last.distanceToSquared(p) > 4) this.pts.length = 0; // teleported
    this.pts.unshift(p.clone());
    if (this.pts.length > TRAIL) this.pts.length = TRAIL;
    const strength = Math.min(1, Math.max(0, (speed - 3) / 7));
    for (let i = 0; i < TRAIL; i++) {
      const a = this.pts[Math.min(i, this.pts.length - 1)];
      const b = this.pts[Math.min(i + 1, this.pts.length - 1)];
      // Sideways across the direction of travel, flat on the ground.
      let sx = -(b.z - a.z);
      let sz = b.x - a.x;
      const len = Math.hypot(sx, sz) || 1;
      const t = 1 - i / (TRAIL - 1);
      const w = (width * t) / len;
      sx *= w;
      sz *= w;
      this.pos.set([a.x + sx, a.y, a.z + sz, a.x - sx, a.y, a.z - sz], i * 6);
      const alpha = strength * t * t * 0.55;
      this.col.set([this.color.r, this.color.g, this.color.b, alpha, this.color.r, this.color.g, this.color.b, alpha], i * 8);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
