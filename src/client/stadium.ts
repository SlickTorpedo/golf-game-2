import * as THREE from 'three';

/*
 * The stadium around the course: pitch, athletics track, bowl of terraces, floodlight towers,
 * and the small things still moving after everyone has gone home.
 *
 * Everything is procedural and lit by hand. The two floodlight banks at the +x end are on and the
 * two at the -x end are off; that falloff is computed by one formula used both in the ground
 * shader (GLSL) and when baking vertex colours (lightAt), so nothing here needs scene lights.
 *
 * Local coordinates: pitch surface is y = 0, pitch centre is the origin, long axis is x, metres.
 */

// ------------------------------------------------------------------ layout

const PITCH_HX = 52.5;
const PITCH_HZ = 34;

/** A rounded rectangle on the ground: half extents and corner radius. */
interface Ring {
  hx: number;
  hz: number;
  r: number;
}
/** Inside edge of the running track (two straights and two half circles). */
const TRACK: Ring = { hx: 80, hz: 37.5, r: 37.5 };
const TRACK_W = 9.76;
/** Foot of the stands. Stays more than 60 m from the centre everywhere. */
const BOWL: Ring = { hx: 97, hz: 63, r: 42 };
const FENCE_D = -1.6;
const WALL_H = 2.8;
const WALK_W = 1.6;
const TREAD = 0.8;
const RISER = 0.42;
const LAMP_Y = 46;
const TOWER_D = 11;

const NIGHT = new THREE.Color(0x070b1c);

// Club colours of the made-up home side, as faded paint and plastic (linear RGB).
const MAROON: RGB = [0.3, 0.05, 0.06];
const MUSTARD: RGB = [0.6, 0.42, 0.08];
const CREAM: RGB = [0.55, 0.53, 0.45];
const CONCRETE: RGB = [0.42, 0.42, 0.4];
const STEEL: RGB = [0.16, 0.18, 0.2];

type RGB = [number, number, number];
type V3 = [number, number, number];

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RingPoint {
  x: number;
  z: number;
  /** Outward normal. */
  nx: number;
  nz: number;
}

/** Lengths of the pieces of a ring: long straight, short straight, corner arc, whole perimeter. */
function ringLengths(s: Ring): { A: number; B: number; C: number; P: number } {
  const A = 2 * (s.hx - s.r);
  const B = 2 * (s.hz - s.r);
  const C = (Math.PI * s.r) / 2;
  return { A, B, C, P: 2 * A + 2 * B + 4 * C };
}

/**
 * Point on a ring pushed outward by d. u runs 0..1 around the ring, starting at the middle of the
 * +z straight and heading toward +x. Because d is applied along the normal, the same u on rings
 * with different d lines up radially (track lanes, fence, rows of the stand).
 */
function ringAt(s: Ring, d: number, u: number, o: RingPoint): RingPoint {
  const { A, B, C, P } = ringLengths(s);
  const cx = s.hx - s.r;
  const cz = s.hz - s.r;
  let t = (((u % 1) + 1) % 1) * P;
  const arc = (ox: number, oz: number, a: number) => {
    o.nx = Math.cos(a);
    o.nz = Math.sin(a);
    o.x = ox + s.r * o.nx;
    o.z = oz + s.r * o.nz;
  };
  const flat = (x: number, z: number, nx: number, nz: number) => {
    o.x = x;
    o.z = z;
    o.nx = nx;
    o.nz = nz;
  };
  if (t < A / 2) flat(t, s.hz, 0, 1);
  else if ((t -= A / 2) < C) arc(cx, cz, Math.PI / 2 - t / s.r);
  else if ((t -= C) < B) flat(s.hx, cz - t, 1, 0);
  else if ((t -= B) < C) arc(cx, -cz, -t / s.r);
  else if ((t -= C) < A) flat(cx - t, -s.hz, 0, -1);
  else if ((t -= A) < C) arc(-cx, -cz, -Math.PI / 2 - t / s.r);
  else if ((t -= C) < B) flat(-s.hx, -cz + t, -1, 0);
  else if ((t -= B) < C) arc(-cx, cz, -Math.PI - t / s.r);
  else flat(-cx + (t - C), s.hz, 0, 1);
  o.x += o.nx * d;
  o.z += o.nz * d;
  return o;
}

// ---------------------------------------------------------------- lighting

const AMBIENT: RGB = [0.026, 0.036, 0.07];
const LAMP_RGB: RGB = [1.0, 0.98, 0.9];
/** Brightness of one bank: chosen so the lit penalty area comes out near 1. */
const LAMP_K = 8200;
const CONE_LO = 0.9;
const CONE_HI = 0.992;
/** Share of a bank's light that spills outside the cone it is aimed along. */
const SPILL = 0.14;
/** Light bounced back off the bright pitch onto faces turned away from the lamps. */
const BOUNCE = 0.2;

interface Lamp {
  pos: THREE.Vector3;
  /** Unit vector the bank is aimed along. */
  aim: THREE.Vector3;
}
/** A small warm or cool pool of light: cart lamp, scoreboard spill, roof tubes. */
interface LocalLight {
  x: number;
  y: number;
  z: number;
  radius: number;
  rgb: RGB;
}

/** The four tower heads, in ring order; the first two (+x end) are the ones still on. */
function towerHeads(): THREE.Vector3[] {
  const { A, B, C, P } = ringLengths(BOWL);
  const p: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  return [A / 2 + C / 2, A / 2 + C + B + C / 2, A / 2 + 2 * C + B + A + C / 2, A / 2 + 3 * C + 2 * B + A + C / 2].map((t) => {
    ringAt(BOWL, TOWER_D, t / P, p);
    return new THREE.Vector3(p.x, LAMP_Y, p.z);
  });
}

const HEADS = towerHeads();
const LAMPS: Lamp[] = HEADS.slice(0, 2).map((pos) => ({
  pos,
  aim: new THREE.Vector3(34, 0, Math.sign(pos.z) * 9).sub(pos).normalize(),
}));
const LOCALS: LocalLight[] = [];

/** GLSL twin of floodAt(): keep the two in step. Expects uLampPos / uLampAim uniforms. */
const FLOOD_GLSL = /* glsl */ `
uniform vec3 uLampPos[2];
uniform vec3 uLampAim[2];
const float SPILL = ${SPILL};
vec3 lampLight(int i, vec3 p, vec3 n) {
  vec3 d = uLampPos[i] - p;
  float dist = length(d);
  vec3 l = d / dist;
  float cone = smoothstep(${CONE_LO}, ${CONE_HI}, dot(-l, uLampAim[i]));
  return vec3(${LAMP_RGB.map((v) => v.toFixed(3)).join(',')}) * (max(dot(n, l), 0.0) * ${LAMP_K.toFixed(1)} / (dist * dist) * (SPILL + (1.0 - SPILL) * cone));
}
vec3 floodLight(vec3 p, vec3 n) {
  return lampLight(0, p, n) + lampLight(1, p, n);
}
`;

function smooth(lo: number, hi: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/**
 * Light arriving at a point with the given normal: night ambient, the two lit banks and any local
 * pools. A zero normal means "thin two-sided thing": it gets a flat half share of each lamp.
 */
function lightAt(x: number, y: number, z: number, nx: number, ny: number, nz: number, out: RGB): RGB {
  const flat = nx === 0 && ny === 0 && nz === 0;
  const sky = flat ? 0.8 : 0.6 + 0.4 * ny;
  out[0] = AMBIENT[0] * sky;
  out[1] = AMBIENT[1] * sky;
  out[2] = AMBIENT[2] * sky;
  for (const lamp of LAMPS) {
    const dx = lamp.pos.x - x;
    const dy = lamp.pos.y - y;
    const dz = lamp.pos.z - z;
    const dist = Math.hypot(dx, dy, dz);
    const ndl = flat ? 0.5 : Math.max(0, (nx * dx + ny * dy + nz * dz) / dist) + BOUNCE * (1 - Math.abs(ny));
    const along = -(dx * lamp.aim.x + dy * lamp.aim.y + dz * lamp.aim.z) / dist;
    const k = ((ndl * LAMP_K) / (dist * dist)) * (SPILL + (1 - SPILL) * smooth(CONE_LO, CONE_HI, along));
    out[0] += LAMP_RGB[0] * k;
    out[1] += LAMP_RGB[1] * k;
    out[2] += LAMP_RGB[2] * k;
  }
  for (const l of LOCALS) {
    const w = Math.max(0, 1 - Math.hypot(l.x - x, l.y - y, l.z - z) / l.radius);
    if (w === 0) continue;
    out[0] += l.rgb[0] * w * w;
    out[1] += l.rgb[1] * w * w;
    out[2] += l.rgb[2] * w * w;
  }
  return out;
}

// ---------------------------------------------------------------- geometry

/**
 * Collects loose quads and boxes into one non-indexed geometry, with the lighting baked into
 * vertex colours as each face is added. One of these becomes one draw call.
 */
class Geo {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly uv: number[] = [];
  private readonly nrm: number[] = [];
  private readonly wave: number[] = [];
  private readonly tmp: RGB = [0, 0, 0];

  /**
   * A quad a-b-c-d (in order round the edge). n is the normal used for lighting, or null for a
   * thin two-sided thing. glow skips lighting and uses the colour as it is (for lamps).
   */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3 | null, rgb: RGB, opts: { uv?: number[]; glow?: boolean; wave?: number[]; shade?: number[] } = {}): void {
    const pts = [a, b, c, d];
    const uv = opts.uv ?? [0, 0, 1, 0, 1, 1, 0, 1];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = pts[i];
      this.pos.push(p[0], p[1], p[2]);
      const k = opts.shade ? opts.shade[i] : 1;
      if (opts.glow) this.col.push(rgb[0] * k, rgb[1] * k, rgb[2] * k);
      else {
        const l = lightAt(p[0], p[1], p[2], n ? n[0] : 0, n ? n[1] : 0, n ? n[2] : 0, this.tmp);
        this.col.push(rgb[0] * l[0] * k, rgb[1] * l[1] * k, rgb[2] * l[2] * k);
      }
      this.uv.push(uv[i * 2], uv[i * 2 + 1]);
      this.nrm.push(n ? n[0] : 0, n ? n[1] : 1, n ? n[2] : 0);
      // Cloth only: how far this corner may swing, and its phase along the cloth.
      this.wave.push(opts.wave ? opts.wave[i * 2] : 0, opts.wave ? opts.wave[i * 2 + 1] : 0);
    }
  }

  /** A box centred at (cx, cy, cz), turned by yaw about the vertical. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rgb: RGB, yaw = 0, glow = false): void {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const at = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const dir = (x: number, z: number): V3 => [x * c + z * s, 0, -x * s + z * c];
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const o = { glow };
    this.quad(at(-hx, hy, -hz), at(hx, hy, -hz), at(hx, hy, hz), at(-hx, hy, hz), [0, 1, 0], rgb, o);
    this.quad(at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, -hy, hz), at(-hx, -hy, hz), [0, -1, 0], rgb, o);
    this.quad(at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, hy, hz), at(-hx, hy, hz), dir(0, 1), rgb, o);
    this.quad(at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, hy, -hz), at(-hx, hy, -hz), dir(0, -1), rgb, o);
    this.quad(at(hx, -hy, -hz), at(hx, -hy, hz), at(hx, hy, hz), at(hx, hy, -hz), dir(1, 0), rgb, o);
    this.quad(at(-hx, -hy, -hz), at(-hx, -hy, hz), at(-hx, hy, hz), at(-hx, hy, -hz), dir(-1, 0), rgb, o);
  }

  /** A thin beam between two points (square section), for masts, rails and poles. */
  beam(a: V3, b: V3, w: number, rgb: RGB): void {
    const ax = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const side = new THREE.Vector3(0, 1, 0).cross(ax);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(w / 2);
    const up = ax.clone().cross(side).normalize().multiplyScalar(w / 2);
    const corner = (p: V3, i: number, j: number): V3 => [p[0] + side.x * i + up.x * j, p[1] + side.y * i + up.y * j, p[2] + side.z * i + up.z * j];
    for (const [i, j, n] of [
      [1, 0, side],
      [-1, 0, side.clone().negate()],
      [0, 1, up],
      [0, -1, up.clone().negate()],
    ] as [number, number, THREE.Vector3][]) {
      // Each side face: offset along its normal, spread along the other axis.
      const e = i !== 0 ? [0, 1] : [1, 0];
      const nn = n.clone().normalize();
      this.quad(
        corner(a, i - e[0], j - e[1]),
        corner(a, i + e[0], j + e[1]),
        corner(b, i + e[0], j + e[1]),
        corner(b, i - e[0], j - e[1]),
        [nn.x, nn.y, nn.z],
        rgb,
      );
    }
  }

  build(cloth = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (cloth) {
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
      g.setAttribute('wave', new THREE.Float32BufferAttribute(this.wave, 2));
    }
    return g;
  }
}

function mul(rgb: RGB, k: number): RGB {
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
}

// ---------------------------------------------------------------- textures

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}

function toTexture(cv: HTMLCanvasElement, anisotropy: number, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const SIGN_FONT = '"Arial Black", "Arial Narrow", Arial, sans-serif';

/** Poured concrete, forty rainy seasons old: grain, drip streaks, moss, cracks, patched repairs. */
function concreteTexture(rand: () => number): HTMLCanvasElement {
  const S = 512;
  const [cv, g] = makeCanvas(S, S);
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 150 + (rand() - 0.5) * 46 + Math.sin((i % S) * 0.049) * 5 + Math.sin(Math.floor(i / S) * 0.037) * 6;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v * 0.97;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Big soft blotches of damp and of bleached, drier concrete.
  for (let i = 0; i < 46; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 30 + rand() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() < 0.65;
    grad.addColorStop(0, dark ? `rgba(40,46,38,${0.1 + rand() * 0.22})` : `rgba(225,220,205,${0.06 + rand() * 0.12})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    // Drawn at wrapped positions too so the tile repeats without a seam.
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
  }
  // Rain drips running down.
  for (let i = 0; i < 70; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const len = 40 + rand() * 160;
    const grad = g.createLinearGradient(0, y, 0, y + len);
    grad.addColorStop(0, `rgba(25,30,24,${0.12 + rand() * 0.25})`);
    grad.addColorStop(1, 'rgba(25,30,24,0)');
    g.fillStyle = grad;
    g.fillRect(x, y, 1 + rand() * 5, len);
  }
  // Hairline cracks.
  g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    let x = rand() * S;
    let y = rand() * S;
    g.strokeStyle = `rgba(20,20,20,${0.25 + rand() * 0.35})`;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 9; k++) {
      x += (rand() - 0.5) * 50;
      y += (rand() - 0.2) * 34;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Formwork joints and a couple of cement patches.
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.fillRect(0, 0, S, 2);
  g.fillRect(0, 0, 2, S);
  g.fillRect(S / 2, 0, 1, S);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `rgba(200,198,190,${0.12 + rand() * 0.14})`;
    g.fillRect(rand() * S, rand() * S, 24 + rand() * 60, 16 + rand() * 40);
  }
  return cv;
}

/** Where things sit in the cloth atlas, in pixels (x, y, w, h). */
const ATLAS_W = 2048;
const ATLAS_H = 1024;
const SIGN_W = 512;
const SIGN_H = 80;
const BANNER_W = 1024;
const BANNER_H = 128;
const BANNER_Y = 336;
const SWATCH_Y = 864;

function atlasUV(x: number, y: number, w: number, h: number): number[] {
  const u0 = (x + 1) / ATLAS_W;
  const u1 = (x + w - 1) / ATLAS_W;
  const v0 = 1 - (y + h - 1) / ATLAS_H;
  const v1 = 1 - (y + 1) / ATLAS_H;
  return [u0, v0, u1, v0, u1, v1, u0, v1];
}
function signUV(i: number): number[] {
  return atlasUV((i % 4) * SIGN_W, Math.floor(i / 4) * SIGN_H, SIGN_W, SIGN_H);
}
function bannerRect(i: number): [number, number, number, number] {
  return [(i % 2) * BANNER_W, BANNER_Y + Math.floor(i / 2) * BANNER_H, BANNER_W, BANNER_H];
}

// Touchline boards: the small businesses of any Javanese street, in English so everyone gets the joke.
// [big text, small text, board, paint, accent]
const SIGNS: [string, string, string, string, string][] = [
  ['TYRE REPAIR', 'FLAT? SO IS YOUR PUTT', '#d9d2bd', '#a01818', '#1b1b1b'],
  ['ICED TEA', 'JUMBO · EXTRA SWEET', '#e4b21c', '#5b1a10', '#f4ecd2'],
  ['PHOTOCOPY', 'WE COPY ANYTHING. ANYTHING.', '#e8e6de', '#17408f', '#c22b1e'],
  ['PHONE CREDIT 24H', 'CALL YOUR MUM', '#16233f', '#f0d21a', '#f4f4f4'],
  ['COFFEE STALL', 'OPEN TILL THE COFFEE RUNS OUT', '#3a2416', '#efe2c0', '#e08a1c'],
  ['WELDING', 'GATES · FENCES · REGRETS', '#c9ccd0', '#101820', '#c2401a'],
  ['SMASHED CHICKEN', 'HOTTER THAN THE DERBY', '#b0201a', '#ffe08a', '#ffffff'],
  ['BIKE WASH', 'FOAM INCLUDED', '#2a7fb5', '#ffffff', '#ffe23a'],
  ['LAUNDRY BY THE KILO', 'GRASS STAINS A SPECIALITY', '#e9d8ee', '#6a2a86', '#2a2a2a'],
  ['MEATBALL SOUP', 'UNCLE KNOWS BEST', '#efe9d6', '#1f6a2c', '#b01c1c'],
  ['SEPTIC PUMPING', 'NO JOB TOO GRIM', '#f2e21c', '#161616', '#c81e1e'],
  ['WATER REFILLS', 'WE DELIVER. EVENTUALLY.', '#dff0f6', '#145a8c', '#145a8c'],
  ['PHONE REPAIR', 'CRACKED SCREENS WHILE YOU WAIT', '#1c1c1c', '#40e0a0', '#ffffff'],
  ['BUILDING SUPPLIES', 'CEMENT · SAND · OPINIONS', '#d86a14', '#ffffff', '#1c1c1c'],
  ['ROOMS TO LET', 'QUIET TENANTS ONLY', '#f0efe8', '#1b1b1b', '#1a7a3a'],
  ['BARBER', 'AIR-CONDITIONED · MOSTLY', '#22306a', '#ffffff', '#e03a2a'],
];

// Cloth banners tied to the fence. [text, cloth, paint]
const BANNERS: [string, string, string][] = [
  ['KALIWARU TILL WE ARE OLD', '#5e1216', '#e0a81e'],
  ['THE SOUTH STAND IS NEVER QUIET', '#d8d2c0', '#5e1216'],
  ['NO FLARES · NO FIRECRACKERS · NO EXCEPTIONS', '#e9e7df', '#b01c1c'],
  ['NORTH BANK BOYS · LOYAL SINCE 1987', '#16161a', '#e0a81e'],
  ['KEEP IT CLEAN · LITTER GOES IN THE BIN', '#e6e4d8', '#1b4f8a'],
  ['WIN OR LOSE WE ARE STILL HERE', '#e0a81e', '#3a0c10'],
  ['THE YOUTH CLUB OF BLOCK 7 BACKS KALIWARU', '#1d5a3a', '#f0ecd8'],
  ['AWAY FANS · TIRTA MUDA', '#1e3f7a', '#f2f2f2'],
];

/** One texture for every board, banner and flag, so all cloth is a single draw call. */
function clothAtlas(rand: () => number): HTMLCanvasElement {
  const [cv, g] = makeCanvas(ATLAS_W, ATLAS_H);
  g.fillStyle = '#222';
  g.fillRect(0, 0, ATLAS_W, ATLAS_H);
  g.textBaseline = 'middle';

  SIGNS.forEach(([big, small, board, paint, accent], i) => {
    const x = (i % 4) * SIGN_W;
    const y = Math.floor(i / 4) * SIGN_H;
    g.fillStyle = board;
    g.fillRect(x, y, SIGN_W, SIGN_H);
    g.fillStyle = accent;
    g.fillRect(x, y + SIGN_H - 9, SIGN_W, 9);
    g.fillStyle = paint;
    g.textAlign = 'left';
    g.font = `900 52px ${SIGN_FONT}`;
    g.fillText(big, x + 14, y + 37, 300);
    g.font = `700 21px ${SIGN_FONT}`;
    g.textAlign = 'right';
    g.fillText(small, x + SIGN_W - 14, y + 38, 170);
    // Sun-bleached top, mud splash along the bottom, a few scuffs from the ball.
    const fade = g.createLinearGradient(0, y, 0, y + SIGN_H);
    fade.addColorStop(0, 'rgba(255,255,255,0.16)');
    fade.addColorStop(0.55, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(48,34,20,0.5)');
    g.fillStyle = fade;
    g.fillRect(x, y, SIGN_W, SIGN_H);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = `rgba(60,50,40,${0.1 + rand() * 0.2})`;
      g.beginPath();
      g.arc(x + rand() * SIGN_W, y + rand() * SIGN_H, 3 + rand() * 9, 0, 7);
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    g.strokeRect(x + 1.5, y + 1.5, SIGN_W - 3, SIGN_H - 3);
  });

  BANNERS.forEach(([text, cloth, paint], i) => {
    const [x, y, w, h] = bannerRect(i);
    g.fillStyle = cloth;
    g.fillRect(x, y, w, h);
    g.fillStyle = paint;
    g.textAlign = 'center';
    g.font = `900 70px ${SIGN_FONT}`;
    g.fillText(text, x + w / 2, y + h / 2 + 3, w - 90);
    // Folds from being rolled up all week, and grime.
    for (let k = 0; k < 16; k++) {
      const fx = x + (k + rand() * 0.6) * (w / 16);
      const fold = g.createLinearGradient(fx, 0, fx + 26, 0);
      fold.addColorStop(0, 'rgba(0,0,0,0)');
      fold.addColorStop(0.5, `rgba(0,0,0,${0.08 + rand() * 0.14})`);
      fold.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fold;
      g.fillRect(fx, y, 26, h);
    }
    g.fillStyle = 'rgba(40,36,30,0.75)';
    for (const [ex, ey] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10], [w / 2, 10], [w / 2, h - 10]]) {
      g.beginPath();
      g.arc(x + ex, y + ey, 4, 0, 7);
      g.fill();
    }
  });

  // Plain flag cloth: mustard, maroon, and the two halved.
  const swatch = (i: number, left: string, right: string) => {
    g.fillStyle = left;
    g.fillRect(i * 256, SWATCH_Y, 128, 128);
    g.fillStyle = right;
    g.fillRect(i * 256 + 128, SWATCH_Y, 128, 128);
    const worn = g.createLinearGradient(i * 256, 0, i * 256 + 256, 0);
    worn.addColorStop(0, 'rgba(0,0,0,0)');
    worn.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = worn;
    g.fillRect(i * 256, SWATCH_Y, 256, 128);
  };
  swatch(0, '#d9a41c', '#d9a41c');
  swatch(1, '#6a1418', '#6a1418');
  swatch(2, '#6a1418', '#d9a41c');
  return cv;
}

/** Knotted goal net, drawn once and repeated. */
function netTexture(): HTMLCanvasElement {
  const [cv, g] = makeCanvas(128, 128);
  g.strokeStyle = 'rgba(235,238,240,0.9)';
  g.lineWidth = 2.2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(i * 16, 0);
    g.lineTo(i * 16, 128);
    g.moveTo(0, i * 16);
    g.lineTo(128, i * 16);
    g.stroke();
  }
  return cv;
}

/** Welded bar fence between the terraces and the track: uprights, two rails, rust. */
function fenceTexture(rand: () => number): HTMLCanvasElement {
  const [cv, g] = makeCanvas(256, 256);
  for (let i = 0; i < 16; i++) {
    const tone = 70 + rand() * 50;
    g.fillStyle = `rgba(${tone},${tone * (0.8 + rand() * 0.2)},${tone * 0.72},0.95)`;
    g.fillRect(i * 16 + 6, 0, 4, 256);
  }
  g.fillStyle = 'rgba(96,92,84,1)';
  g.fillRect(0, 14, 256, 9);
  g.fillRect(0, 128, 256, 7);
  g.fillRect(0, 236, 256, 10);
  g.fillRect(0, 0, 7, 256);
  return cv;
}

const LED_AMBER = '#ffb629';
const LED_WHITE = '#f4f6ff';
const LED_RED = '#ff3b2e';

/** Dark lines over the canvas so text reads as rows of separate LEDs. */
function ledGrid(g: CanvasRenderingContext2D, w: number, h: number, pitch: number): void {
  g.fillStyle = 'rgba(0,0,0,0.62)';
  for (let x = 0; x < w; x += pitch) g.fillRect(x, 0, 2, h);
  for (let y = 0; y < h; y += pitch) g.fillRect(0, y, w, 2);
}

/** The scoreboard as it was left at the whistle. Both clubs are invented. */
function scoreboardTexture(): HTMLCanvasElement {
  const W = 1024;
  const H = 448;
  const [cv, g] = makeCanvas(W, H);
  g.fillStyle = '#040506';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = LED_AMBER;
  g.font = `700 40px ${SIGN_FONT}`;
  g.fillText('TUAN RUMAH', 250, 44, 380);
  g.fillText('TAMU', 774, 44, 380);
  g.fillStyle = LED_WHITE;
  g.font = `900 64px ${SIGN_FONT}`;
  g.fillText('PS KALIWARU', 250, 120, 440);
  g.fillText('TIRTA MUDA', 774, 120, 440);
  g.font = `900 250px ${SIGN_FONT}`;
  g.fillText('2', 250, 310);
  g.fillText('1', 774, 310);
  g.fillStyle = LED_RED;
  g.font = `900 96px ${SIGN_FONT}`;
  g.fillText('90+4', 512, 262, 230);
  g.fillStyle = LED_AMBER;
  g.font = `700 40px ${SIGN_FONT}`;
  g.fillText('BABAK 2', 512, 356, 200);
  ledGrid(g, W, H, 8);
  // Two modules have been dead since last season.
  g.fillStyle = '#020203';
  g.fillRect(896, 192, 64, 64);
  g.fillRect(64, 320, 64, 64);
  return cv;
}

/** The message that crawls along the bottom of the scoreboard. */
function tickerTexture(): HTMLCanvasElement {
  const W = 2048;
  const H = 64;
  const [cv, g] = makeCanvas(W, H);
  g.fillStyle = '#040506';
  g.fillRect(0, 0, W, H);
  g.fillStyle = LED_AMBER;
  g.textBaseline = 'middle';
  g.font = `700 46px ${SIGN_FONT}`;
  g.fillText('TERIMA KASIH ATAS KEDATANGAN ANDA  •  HATI-HATI DI JALAN  •  PARKIR MOTOR DI SISI TIMUR  •  JAGA KEBERSIHAN STADION  •', 16, 34, W - 32);
  ledGrid(g, W, H, 8);
  return cv;
}

/**
 * The near skyline, one 45 degree slice that the sky shader repeats eight times round: kampung
 * rooftops, water tanks, coconut palms, lamp posts, a few lit windows. Alpha is the silhouette.
 */
function skylineTexture(rand: () => number): HTMLCanvasElement {
  const W = 2048;
  const H = 256;
  const [cv, g] = makeCanvas(W, H);
  const ink = '#03050a';
  g.fillStyle = ink;
  let x = 0;
  while (x < W) {
    const w = 26 + rand() * 70;
    const h = 18 + rand() * 40 + (rand() < 0.12 ? 50 : 0);
    const top = H - h;
    g.fillStyle = ink;
    if (rand() < 0.6) {
      // Pitched tile roof.
      g.beginPath();
      g.moveTo(x - 4, top + 12);
      g.lineTo(x + w / 2, top);
      g.lineTo(x + w + 4, top + 12);
      g.lineTo(x + w + 4, H);
      g.lineTo(x - 4, H);
      g.fill();
    } else {
      g.fillRect(x, top, w, h);
      if (rand() < 0.5) g.fillRect(x + w * 0.2, top - 12, 10, 12); // rooftop water tank
      if (rand() < 0.4) g.fillRect(x + w * 0.7, top - 22, 1.5, 22); // TV aerial
    }
    for (let k = 0; k < 3; k++) {
      if (rand() < 0.3) {
        g.fillStyle = rand() < 0.7 ? 'rgba(255,196,110,0.9)' : 'rgba(190,225,255,0.9)';
        g.fillRect(x + 4 + rand() * (w - 10), top + 15 + rand() * Math.max(2, h - 24), 3, 2.5);
      }
    }
    x += w + rand() * 12;
  }
  // Coconut palms leaning over the roofs.
  for (let i = 0; i < 13; i++) {
    const px = rand() * W;
    const ph = 80 + rand() * 80;
    const lean = (rand() - 0.5) * 34;
    g.strokeStyle = ink;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(px, H);
    g.quadraticCurveTo(px + lean * 0.2, H - ph * 0.6, px + lean, H - ph);
    g.stroke();
    g.lineWidth = 2.2;
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2 + rand();
      const len = 20 + rand() * 16;
      g.beginPath();
      g.moveTo(px + lean, H - ph);
      g.quadraticCurveTo(px + lean + Math.cos(a) * len * 0.6, H - ph - 10 + Math.sin(a) * 4, px + lean + Math.cos(a) * len, H - ph + 6 + Math.abs(Math.sin(a)) * 16);
      g.stroke();
    }
  }
  // Street lamps on leaning poles, with their sodium heads.
  for (let i = 0; i < 9; i++) {
    const px = rand() * W;
    g.fillStyle = ink;
    g.fillRect(px, H - 62, 2, 62);
    g.fillRect(px, H - 62, 12, 2);
    g.fillStyle = 'rgba(255,170,70,1)';
    g.fillRect(px + 9, H - 61, 4, 3);
  }
  return cv;
}

// ----------------------------------------------------------------- shaders

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

const vec3 = (c: number[]) => `vec3(${c.map((v) => v.toFixed(4)).join(',')})`;
const ringGlsl = (s: Ring) => `vec3(${s.hx.toFixed(2)},${s.hz.toFixed(2)},${s.r.toFixed(2)})`;

const GROUND_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vCam;
#include <common>
#include <fog_pars_vertex>
void main() {
  vPos = position;
  // Camera in the stadium's own space, so the wet sheen works wherever the group is placed.
  vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

/**
 * The whole floor of the stadium in one shader, so every line stays sharp however close the
 * camera comes: mown pitch with its markings and worn patches, the track, the concrete apron.
 */
const GROUND_FRAG = /* glsl */ `
uniform vec3 uSprinkler[6];
uniform vec4 uLocalPos[2];
uniform vec3 uLocalCol[2];
varying vec3 vPos;
varying vec3 vCam;
#include <common>
#include <fog_pars_fragment>
${NOISE_GLSL}
${FLOOD_GLSL}
float sdBox(vec2 p, vec2 h) {
  vec2 q = abs(p) - h;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
float sdRing(vec2 p, vec3 s) {
  vec2 q = abs(p) - s.xy + s.z;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - s.z;
}
// Coverage of a painted line of half width w around distance d = 0, antialiased.
float line(float d, float w) {
  float aa = fwidth(d);
  return 1.0 - smoothstep(w - aa, w + aa, abs(d));
}
void main() {
  vec2 p = vPos.xz;
  vec2 q = vec2(abs(p.x), p.y);
  float px = fwidth(p.x) + fwidth(p.y);
  float dPitch = sdBox(p, vec2(${PITCH_HX}, ${PITCH_HZ}.0));
  float dTrack = sdRing(p, ${ringGlsl(TRACK)});
  float dBowl = sdRing(p, ${ringGlsl(BOWL)});

  float n1 = fbm(p * 0.07);
  float n2 = fbm(p * 0.9 + 31.0);
  // Blade-scale grain; faded out with distance before it can shimmer.
  float grain = mix(vnoise(p * 17.0) * 0.6 + vnoise(p * 43.0) * 0.4, 0.5, smoothstep(0.04, 0.22, px));
  float clump = vnoise(p * vec2(3.1, 2.3) + 5.0);

  // Grass: mower bands across the pitch, a fainter pass along it, dry and thin patches.
  float band = smoothstep(0.235, 0.265, abs(fract((p.x + 52.5) / 10.5) - 0.5));
  float cross = smoothstep(0.235, 0.265, abs(fract(p.y / 13.6) - 0.5));
  vec3 grass = mix(vec3(0.036, 0.135, 0.038), vec3(0.060, 0.200, 0.050), band) * (0.92 + 0.08 * cross);
  grass *= 0.66 + 0.5 * n1 + 0.3 * (n2 - 0.5) + 0.5 * (grain - 0.5) + 0.22 * (clump - 0.5);
  grass = mix(grass, vec3(0.105, 0.14, 0.045) * (0.8 + 0.4 * grain), smoothstep(0.5, 0.8, fbm(p * 0.19 + 7.0)) * 0.4);
  // Between the pitch and the track nobody mows.
  vec3 rough = vec3(0.060, 0.125, 0.045) * (0.55 + 0.8 * n2 + 0.4 * (grain - 0.5));
  rough = mix(rough, vec3(0.19, 0.16, 0.085), smoothstep(0.42, 0.7, n1) * 0.65);
  grass = mix(grass, rough, smoothstep(0.4, 2.6, dPitch));

  // Mud where the play wears it: goalmouths, centre spot, penalty spots, the linesmen's runs.
  float mud = 1.0 - length((q - vec2(50.0, 0.0)) / vec2(5.5, 7.5));
  mud = max(mud, 1.0 - length(p) / 3.2);
  mud = max(mud, 1.0 - length(q - vec2(41.5, 0.0)) / 2.2);
  mud = max(mud, (1.0 - abs(abs(p.y) - 35.3) / 1.5) * step(abs(p.x), 50.0) * 0.72);
  mud = smoothstep(0.12, 0.7, mud + (n2 - 0.5) * 0.9 + (n1 - 0.5) * 0.6);
  grass = mix(grass, vec3(0.115, 0.080, 0.050) * (0.65 + 0.7 * grain), mud * 0.93);

  // Chalk.
  float L = line(dPitch, 0.06);
  L = max(L, line(p.x, 0.06) * step(abs(p.y), ${PITCH_HZ}.0));
  L = max(L, line(length(p) - 9.15, 0.06));
  L = max(L, 1.0 - smoothstep(0.17, 0.24, length(p)));
  L = max(L, line(sdBox(q - vec2(44.25, 0.0), vec2(8.25, 20.16)), 0.06));
  L = max(L, line(sdBox(q - vec2(49.75, 0.0), vec2(2.75, 9.16)), 0.06));
  L = max(L, 1.0 - smoothstep(0.15, 0.22, length(q - vec2(41.5, 0.0))));
  L = max(L, line(length(q - vec2(41.5, 0.0)) - 9.15, 0.06) * step(q.x, 36.0));
  L = max(L, line(length(abs(p) - vec2(${PITCH_HX}, ${PITCH_HZ}.0)) - 1.0, 0.06));
  L *= step(dPitch, 0.07) * (0.5 + 0.5 * smoothstep(0.2, 0.55, n2)) * (1.0 - 0.75 * mud);
  vec3 col = mix(grass, vec3(0.60, 0.62, 0.58), L * 0.92);

  // Track: terracotta rubber, lane lines, bleached and stained in places.
  vec3 track = vec3(0.34, 0.098, 0.058) * (0.68 + 0.4 * n1 + 0.4 * (grain - 0.5) + 0.25 * (n2 - 0.5));
  track = mix(track, vec3(0.40, 0.20, 0.15), smoothstep(0.5, 0.8, fbm(p * 0.31 + 3.0)) * 0.5);
  float lanes = line((fract(dTrack / 1.22 + 0.5) - 0.5) * 1.22, 0.03);
  lanes = max(lanes, line(p.x - 40.0, 0.04) * step(p.y, 0.0));
  track = mix(track, vec3(0.58), lanes * 0.8 * (0.45 + 0.55 * smoothstep(0.25, 0.6, n2)));
  // Apron: slabs with joints, damp and moss creeping in from the edges.
  vec3 apron = vec3(0.25, 0.25, 0.24) * (0.62 + 0.55 * n1 + 0.35 * (grain - 0.5));
  float joint = max(line((fract(p.x / 4.0) - 0.5) * 4.0, 0.025), line((fract(p.y / 4.0) - 0.5) * 4.0, 0.025));
  apron *= 1.0 - 0.5 * joint;
  apron = mix(apron, vec3(0.045, 0.06, 0.04), smoothstep(0.5, 0.72, fbm(p * 0.21 + 50.0)) * 0.75);

  float aa = px * 0.7;
  float inTrack = smoothstep(-aa, aa, dTrack);
  // A pale concrete kerb on the inside of lane one.
  col = mix(col, vec3(0.42, 0.42, 0.40) * (0.7 + 0.3 * n2), smoothstep(-0.14 - aa, -0.14 + aa, dTrack));
  col = mix(col, track, inTrack);
  col = mix(col, apron, smoothstep(-aa, aa, dTrack - ${TRACK_W}));
  col = mix(col, vec3(0.035, 0.035, 0.04) * (0.5 + n1), smoothstep(-aa, aa, dBowl));

  // Wet: under the sprinklers, and puddles left on the track and apron.
  float puddle = smoothstep(0.6, 0.68, fbm(p * 0.17 + 9.0)) * inTrack;
  float wet = 0.0;
  for (int i = 0; i < 6; i++) wet = max(wet, 1.0 - smoothstep(8.0, 17.0, length(p - uSprinkler[i].xz) + (n2 - 0.5) * 5.0));
  wet *= 1.0 - inTrack;
  wet = max(wet, puddle);
  wet = max(wet, mud * 0.6);
  col *= 1.0 - 0.32 * wet;

  vec3 P = vec3(p.x, 0.0, p.y);
  vec3 light = ${vec3(AMBIENT)} + floodLight(P, vec3(0.0, 1.0, 0.0));
  // Soft shadow of the course platform standing over the centre circle, cast away from the lit end.
  light *= 1.0 - 0.6 * (1.0 - smoothstep(-2.0, 5.0, sdBox(p - vec2(-3.0, 0.0), vec2(9.5, 5.5))));
  for (int i = 0; i < 2; i++) {
    float w = max(0.0, 1.0 - length(uLocalPos[i].xyz - P) / uLocalPos[i].w);
    light += uLocalCol[i] * w * w;
  }
  col *= light;

  // Sheen: the lit banks glinting off the puddles on the track and apron.
  vec3 N = normalize(vec3(fbm(p * 1.3) - 0.5, 9.0, fbm(p * 1.3 + 19.0) - 0.5));
  vec3 V = normalize(vCam - P);
  for (int i = 0; i < 2; i++) {
    vec3 Ld = normalize(uLampPos[i] - P);
    float s = pow(max(dot(N, normalize(Ld + V)), 0.0), 400.0);
    col += lampLight(i, P, Ld) * s * puddle * 0.6;
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  // Rotation only and depth pinned to the far plane: the sky is infinitely far whatever the camera's range.
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform sampler2D uSkyline;
varying vec3 vDir;
${NOISE_GLSL}
float wrap(float a) { return atan(sin(a), cos(a)); }
void main() {
  vec3 d = normalize(vDir);
  float el = asin(d.y);
  float az = atan(d.z, d.x);
  float low = exp(-max(el, 0.0) * 5.0);
  vec3 col = mix(vec3(0.0022, 0.0035, 0.0115), vec3(0.017, 0.019, 0.036), low);
  // Sodium glow of the town, strongest on one side.
  float town = 0.5 + 0.5 * cos(az - 0.9);
  col += vec3(0.055, 0.036, 0.018) * exp(-max(el, 0.0) * 10.0) * (0.25 + 0.75 * town * town);

  // A few stars through the haze.
  vec3 g = d * 260.0;
  vec3 id = floor(g);
  float hs = hash(id.xy + id.z * 37.0);
  float star = step(0.995, hs) * smoothstep(0.32, 0.0, length(fract(g) - 0.5));
  col += vec3(0.75, 0.82, 1.0) * star * (0.6 + 0.4 * sin(uTime * (1.0 + hs * 3.0) + hs * 90.0)) * 0.5 * (1.0 - low) * smoothstep(0.03, 0.25, el);

  // The volcano and its shoulder, barely darker than the sky; village lights on the lower slopes.
  float cone = min(0.118 * pow(max(0.0, 1.0 - abs(wrap(az - 2.5)) / 0.52), 1.25), 0.104);
  float shoulder = 0.062 * pow(max(0.0, 1.0 - abs(wrap(az - 3.25)) / 0.45), 1.4);
  float hills = max(cone, shoulder) + 0.010 + vnoise(vec2(az * 9.0, 4.0)) * 0.012 + vnoise(vec2(az * 45.0, 1.0)) * 0.004;
  col = mix(col, mix(vec3(0.004, 0.006, 0.014), col, 0.3), smoothstep(0.0015, -0.0015, el - hills));
  vec2 cell = vec2(az * 300.0, el * 1000.0);
  float hl = hash(floor(cell));
  float lit = step(0.8 + 0.2 * el / (hills * 0.42 + 0.006), hl) * step(el, hills * 0.42 + 0.006) * step(0.0, el) * smoothstep(0.5, 0.1, length(fract(cell) - 0.5));
  col += mix(vec3(1.0, 0.58, 0.22), vec3(0.7, 0.85, 1.0), step(0.8, fract(hl * 7.3))) * lit * (0.22 + 0.16 * sin(uTime * (0.5 + hl * 3.0) + hl * 50.0));

  // Cell tower with its red lamp.
  float ta = wrap(az - 0.55);
  float mast = step(abs(ta), 0.0034 * (1.0 - el / 0.17) + 0.0006) * step(el, 0.17) * step(0.0, el);
  mast *= 0.55 + 0.45 * step(0.5, fract(el * 110.0 + abs(ta) * 260.0));
  col = mix(col, vec3(0.003, 0.004, 0.008), mast);
  col += vec3(1.6, 0.07, 0.04) * pow(max(sin(uTime * 2.1), 0.0), 6.0) * smoothstep(0.004, 0.0, length(vec2(ta, el - 0.17)));

  // Rooftops, palms and lamp posts just outside the ground.
  vec2 uv = vec2(az / 6.2831853 * 8.0, el / 0.085);
  if (uv.y > 0.0 && uv.y < 1.0) {
    vec4 s = texture2D(uSkyline, uv);
    col = mix(col, s.rgb * 1.4, s.a);
  }
  col = mix(col, ${vec3([NIGHT.r, NIGHT.g, NIGHT.b])}, smoothstep(0.0, -0.015, el));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Light hanging in the humid air under a lit bank: a cone that is brightest seen side-on through
// its middle and fades to nothing at its edges and toward the ground.
const HAZE_VERT = /* glsl */ `
uniform float uLength;
varying float vT;
varying vec3 vN;
varying vec3 vV;
varying vec3 vLocal;
void main() {
  vT = -position.y / uLength;
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const HAZE_FRAG = /* glsl */ `
uniform float uTime;
varying float vT;
varying vec3 vN;
varying vec3 vV;
varying vec3 vLocal;
${NOISE_GLSL}
void main() {
  float rim = abs(dot(normalize(vN), normalize(vV)));
  // Slow drifting unevenness, as if thin mist were moving through the beam.
  float drift = 0.7 + 0.6 * vnoise(vec2(atan(vLocal.x, vLocal.z) * 2.0 + uTime * 0.05, vT * 6.0 - uTime * 0.11));
  float a = pow(rim, 1.6) * pow(1.0 - vT, 2.2) * smoothstep(0.0, 0.05, vT) * drift;
  gl_FragColor = vec4(vec3(0.62, 0.68, 0.78) * a * 0.13, 1.0);
  #include <colorspace_fragment>
}
`;

// Shared by every kind of point sprite: a hot core with a soft skirt, added to the picture.
const POINT_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = exp(-d * d * 6.0) * 0.55 + exp(-d * d * 42.0);
  gl_FragColor = vec4(vColor * a * (1.0 - d), 1.0);
  #include <colorspace_fragment>
}
`;

const POINT_HEAD = /* glsl */ `
uniform float uTime;
uniform float uViewH;
uniform float fogDensity;
varying vec3 vColor;
// Sets the sprite size for a thing 'size' metres across. Returns a dimming factor: fog, and
// energy kept constant when the sprite is clamped to a minimum size on screen.
float sprite(vec4 mv, float size, float minPx) {
  float dist = length(mv.xyz);
  float px = size * projectionMatrix[1][1] * uViewH * 0.5 / dist;
  gl_PointSize = max(px, minPx);
  float k = min(1.0, px / minPx);
  return k * k * exp(-fogDensity * fogDensity * dist * dist);
}
`;

/** Steady, blinking or stuttering lamps seen as glows: aBlink = (mode, rate, phase). */
const GLOW_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute vec3 aBlink;
${POINT_HEAD}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float ph = uTime * aBlink.y + aBlink.z;
  float k = 0.9 + 0.1 * sin(ph);
  if (aBlink.x > 1.5) {
    // A dying fluorescent tube: mostly on, with dropouts.
    float r = fract(sin(floor(ph) * 91.7 + aBlink.z) * 43758.5);
    k = r > 0.72 ? 0.1 + 0.5 * fract(r * 7.0) : 1.0;
  } else if (aBlink.x > 0.5) {
    k = pow(max(sin(ph), 0.0), 10.0);
  }
  vColor = aColor * k * sprite(mv, aSize, 2.5);
}
`;

/**
 * Sprinkler water with no per-frame work on the CPU: each drop knows its head and a few random
 * numbers, and its place on its arc follows from the time alone. The jet turns slowly, so drops
 * launched earlier trail behind it and the whole thing reads as a rotating curved spray.
 */
const DROP_VERT = /* glsl */ `
attribute vec4 aSeed;
${POINT_HEAD}
${FLOOD_GLSL}
const float FLIGHT = 1.5;
void main() {
  float f = fract(uTime / FLIGHT + aSeed.x);
  float launched = uTime - f * FLIGHT;
  float turn = aSeed.w + launched * 0.42 + (aSeed.z - 0.5) * 0.13;
  // Most of the water is in the main jet; the rest breaks up and falls short.
  float speed = 15.0 * (aSeed.y < 0.7 ? 0.82 + 0.26 * aSeed.y : 0.3 + 0.5 * fract(aSeed.y * 17.0));
  float lift = 0.42 + (fract(aSeed.z * 13.7) - 0.5) * 0.16;
  float t = f * FLIGHT;
  vec3 p = position + vec3(cos(turn) * cos(lift), sin(lift), sin(turn) * cos(lift)) * speed * t;
  p.y -= 4.9 * t * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 toLamp = normalize(uLampPos[0] - p);
  vec3 lit = floodLight(p, toLamp) * 0.5 + vec3(0.02, 0.03, 0.05);
  // Dimmer close to the head, where the drops are packed together and would add up to a white blob.
  float k = sprite(mv, 0.05 + 0.04 * fract(aSeed.y * 31.0), 1.7) * (0.3 + 0.7 * f);
  gl_PointSize = min(gl_PointSize, 5.0);
  // Drops that have landed are parked off screen until their next launch.
  if (p.y < 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vColor = vec3(0.75, 0.85, 1.0) * lit * k * 2.0;
}
`;

/** Moths and flying termites looping round a lamp: aSeed = (orbit radius, phase, speed, size). */
const MOTH_VERT = /* glsl */ `
attribute vec4 aSeed;
attribute vec3 aColor;
${POINT_HEAD}
void main() {
  float t = uTime * aSeed.z + aSeed.y * 40.0;
  vec3 o = vec3(
    sin(t * 1.3 + aSeed.y * 7.0) * cos(t * 0.7),
    sin(t * 1.9 + aSeed.y * 3.0) * 0.6 + sin(t * 0.23) * 0.3,
    cos(t * 1.1 + aSeed.y * 5.0) * sin(t * 0.5 + 1.0));
  o += vec3(sin(t * 7.0), cos(t * 9.0), sin(t * 8.0 + 2.0)) * 0.08;
  vec3 p = position + o * aSeed.x;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float near = 1.0 / (0.3 + dot(o, o) * 2.0);
  float wings = 0.55 + 0.45 * sin(t * 43.0 + aSeed.y * 9.0);
  vColor = aColor * near * wings * sprite(mv, aSeed.w, 1.7);
}
`;

/** Adds the swing of cloth in a light wind to a basic material (uses the 'wave' attribute). */
function makeCloth(mat: THREE.MeshBasicMaterial, time: { value: number }): THREE.MeshBasicMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader =
      'attribute vec2 wave;\nuniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float gust = 0.55 + 0.45 * sin(uTime * 0.37 + position.x * 0.05 + position.z * 0.04);
        float sway = sin(wave.y - uTime * 2.6) + 0.5 * sin(wave.y * 2.3 - uTime * 4.3 + 1.7);
        transformed += normal * (wave.x * sway * gust);
        transformed.y -= abs(wave.x) * 0.35 * (1.0 - gust);`,
      );
  };
  return mat;
}

// ------------------------------------------------------------------- stands

/** One slice of the bowl between two ring positions. */
interface Seg {
  u0: number;
  u1: number;
  rows: number;
  /** A stairway: no seats, paler steps. */
  aisle: boolean;
  /** Which seated stand this is part of: the roofed main stand (north, -z), the one opposite, or neither. */
  stand: 'north' | 'south' | null;
  /** A vomitory tunnel comes out through the steps here. */
  portal: boolean;
}

const NORTH_ROWS = 30;
const SOUTH_ROWS = 24;

/**
 * Cuts the bowl into slices about 2.5 m wide. The two long sides are seated stands, the ends and
 * corners are bare concrete steps, and each corner has a gap where a floodlight tower stands.
 */
function bowlSegments(): Seg[] {
  const { A, B, C, P } = ringLengths(BOWL);
  const segs: Seg[] = [];
  let t = -A / 2;
  const piece = (len: number, n: number, make: (i: number, f: number) => Omit<Seg, 'u0' | 'u1'>) => {
    for (let i = 0; i < n; i++) segs.push({ u0: (t + (len * i) / n) / P, u1: (t + (len * (i + 1)) / n) / P, ...make(i, (i + 0.5) / n) });
    t += len;
  };
  const side = (stand: 'north' | 'south', rows: number) => (i: number) => ({ rows, aisle: i % 7 === 3, stand, portal: i % 14 === 3 });
  const end = (i: number) => ({ rows: 16, aisle: i % 6 === 2, stand: null, portal: false });
  const corner = (_i: number, f: number) => ({ rows: Math.abs(f - 0.5) < 0.09 ? 0 : 18, aisle: false, stand: null, portal: false });
  piece(A, 44, side('south', SOUTH_ROWS));
  piece(C, 26, corner);
  piece(B, 16, end);
  piece(C, 26, corner);
  piece(A, 44, side('north', NORTH_ROWS));
  piece(C, 26, corner);
  piece(B, 16, end);
  piece(C, 26, corner);
  return segs;
}

/**
 * Seat colours for the two seated stands, drawn as tiny pictures (one pixel per seat) so the
 * club name can be spelled out in mustard seats on maroon, the way real grounds do it.
 * Returns the palette index (0 maroon, 1 mustard, 2 cream) for a seat at x in a given row.
 */
function seatPlan(): (stand: 'north' | 'south', x: number, row: number) => number {
  const W = 212;
  const draw = (rows: number, paint: (g: CanvasRenderingContext2D) => void) => {
    const [, g] = makeCanvas(W, rows);
    g.fillStyle = 'rgb(0,0,0)';
    g.fillRect(0, 0, W, rows);
    paint(g);
    return g.getImageData(0, 0, W, rows).data;
  };
  const north = draw(NORTH_ROWS, (g) => {
    g.fillStyle = 'rgb(200,0,0)';
    g.fillRect(0, 0, W, 2);
    g.fillRect(0, NORTH_ROWS - 3, W, 3);
    g.fillStyle = 'rgb(100,0,0)';
    g.font = `900 25px ${SIGN_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('KALIWARU', W / 2, NORTH_ROWS / 2 - 0.5, W - 34);
  });
  const south = draw(SOUTH_ROWS, (g) => {
    // Blocks in the club colours with a cream band through the middle.
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgb(100,0,0)' : 'rgb(0,0,0)';
      g.fillRect((i * W) / 8, 0, W / 8, SOUTH_ROWS);
    }
    g.fillStyle = 'rgb(200,0,0)';
    g.fillRect(0, 10, W, 4);
  });
  return (stand, x, row) => {
    const data = stand === 'north' ? north : south;
    const rows = stand === 'north' ? NORTH_ROWS : SOUTH_ROWS;
    // Read left to right as seen from the pitch: +x is on the right when facing north.
    const col = Math.min(W - 1, Math.max(0, Math.floor(((stand === 'north' ? x : -x) / 110 + 0.5) * W)));
    return Math.round(data[((rows - 1 - row) * W + col) * 4] / 100);
  };
}

interface Seats {
  matrices: THREE.Matrix4[];
  colors: number[];
  /** Places on the steps where rubbish was left. */
  litter: V3[];
}

/** Terraces, walls, railings, tunnels, and where every seat goes. */
function buildBowl(terr: Geo, solids: Geo, glow: Geo, rand: () => number): Seats {
  const segs = bowlSegments();
  const { P } = ringLengths(BOWL);
  const plan = seatPlan();
  const seats: Seats = { matrices: [], colors: [], litter: [] };
  const a0: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  const a1: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  const lit: RGB = [0, 0, 0];
  const basis = new THREE.Matrix4();
  const railPaint = mul(MUSTARD, 0.9);

  segs.forEach((seg, index) => {
    ringAt(BOWL, 0, seg.u0, a0);
    ringAt(BOWL, 0, seg.u1, a1);
    const at0 = (d: number, y: number): V3 => [a0.x + a0.nx * d, y, a0.z + a0.nz * d];
    const at1 = (d: number, y: number): V3 => [a1.x + a1.nx * d, y, a1.z + a1.nz * d];
    const nOut: V3 = [(a0.nx + a1.nx) / 2, 0, (a0.nz + a1.nz) / 2];
    const nIn: V3 = [-nOut[0], 0, -nOut[2]];
    const s0 = (seg.u0 * P) / 5;
    const s1 = (seg.u1 * P) / 5;
    // A strip across this slice from (d, y) to (d2, y2); v runs with distance up the stand.
    const strip = (d: number, y: number, d2: number, y2: number, n: V3, rgb: RGB, shade?: number[]) => {
      const v0 = (d + y) / 5;
      const v1 = (d2 + y2) / 5;
      terr.quad(at0(d, y), at1(d, y), at1(d2, y2), at0(d2, y2), n, rgb, { uv: [s0, v0, s1, v0, s1, v1, s0, v1], shade });
    };

    if (seg.rows > 0) {
      const tint = 0.82 + rand() * 0.3;
      const wornBase = 0.3 + rand() * 0.2;
      const step = mul(CONCRETE, tint * (seg.aisle ? 1.25 : 1));
      const back = WALK_W + seg.rows * TREAD;
      const top = WALL_H + seg.rows * RISER;
      // Front wall: cream paint over maroon, darkest where the damp rises from the ground.
      strip(0, 0, 0, 1.1, nIn, mul(MAROON, tint * 1.2), [0.5, 0.5, 0.9, 0.9]);
      strip(0, 1.1, 0, WALL_H, nIn, mul(CREAM, tint * 0.8));
      strip(0, WALL_H, WALK_W, WALL_H, [0, 1, 0], step);
      for (let k = 0; k < seg.rows; k++) {
        const d = WALK_W + k * TREAD;
        const y = WALL_H + k * RISER;
        // On the bare ends the risers were once painted in bands of the club colours.
        let riser = mul(step, 0.9);
        if (seg.aisle) riser = mul(MUSTARD, 0.8);
        else if (!seg.stand) {
          const paint = Math.floor(k / 4) % 2 ? MAROON : MUSTARD;
          const worn = wornBase + rand() * 0.08;
          riser = [step[0] * (1 - worn) + paint[0] * worn * 1.5, step[1] * (1 - worn) + paint[1] * worn * 1.5, step[2] * (1 - worn) + paint[2] * worn * 1.5];
        }
        strip(d, y, d, y + RISER, nIn, riser);
        strip(d, y + RISER, d + TREAD, y + RISER, [0, 1, 0], mul(step, 0.92 + rand() * 0.16));
        if (rand() < 0.02) seats.litter.push([(a0.x + a1.x) / 2 + nOut[0] * (d + 0.5), y + RISER, (a0.z + a1.z) / 2 + nOut[2] * (d + 0.5)]);
      }
      strip(back, top, back, top + 1.1, nIn, mul(CREAM, tint * 0.7));
      strip(back, top + 1.1, back + 0.3, top + 1.1, [0, 1, 0], step);
      strip(back + 0.3, 0, back + 0.3, top + 1.1, nOut, mul(CONCRETE, 0.8));

      // Railing along the front walkway, in chipped club mustard.
      for (const y of [WALL_H + 0.55, WALL_H + 1.05]) terr.quad(at0(0.08, y), at1(0.08, y), at1(0.08, y + 0.06), at0(0.08, y + 0.06), null, railPaint);
      solids.beam(at0(0.08, WALL_H), at0(0.08, WALL_H + 1.08), 0.07, railPaint);

      if (seg.portal) {
        // Vomitory: a concrete box breaking through rows 6 to 10 with a black mouth facing the pitch.
        const d = WALK_W + 6 * TREAD;
        const d2 = WALK_W + 10 * TREAD;
        const yb = WALL_H + 6 * RISER;
        const yt = WALL_H + 10 * RISER + 1.1;
        const wall = mul(CREAM, 0.75);
        const tan: V3 = [nOut[2], 0, -nOut[0]];
        solids.quad(at0(d, yb), at1(d, yb), at1(d, yt), at0(d, yt), nIn, wall);
        solids.quad(at0(d, yt), at1(d, yt), at1(d2, yt), at0(d2, yt), [0, 1, 0], wall);
        solids.quad(at0(d, yb), at0(d2, yb), at0(d2, yt), at0(d, yt), [-tan[0], 0, -tan[2]], wall);
        solids.quad(at1(d, yb), at1(d2, yb), at1(d2, yt), at1(d, yt), tan, wall);
        const mix = (f: number, dd: number, y: number): V3 => {
          const p = at0(dd, y);
          const q = at1(dd, y);
          return [p[0] + (q[0] - p[0]) * f, y, p[2] + (q[2] - p[2]) * f];
        };
        solids.quad(mix(0.14, d - 0.03, yb), mix(0.86, d - 0.03, yb), mix(0.86, d - 0.03, yt - 0.45), mix(0.14, d - 0.03, yt - 0.45), null, [0.01, 0.01, 0.012], { glow: true });
        if (rand() < 0.55) {
          // Somebody left the corridor light on.
          const warm: RGB = [0.32, 0.2, 0.07];
          glow.quad(mix(0.3, d - 0.05, yb), mix(0.7, d - 0.05, yb), mix(0.7, d - 0.05, yb + 1.5), mix(0.3, d - 0.05, yb + 1.5), null, warm, { glow: true, shade: [0.5, 0.5, 1.2, 1.2] });
        }
      }

      if (seg.stand && !seg.aisle) {
        const len = Math.hypot(a1.x - a0.x, a1.z - a0.z);
        const n = Math.floor(len / 0.52);
        const fade = 0.8 + rand() * 0.3;
        for (let k = 0; k < seg.rows; k++) {
          const d = WALK_W + k * TREAD + 0.42;
          const y = WALL_H + (k + 1) * RISER;
          for (let j = 0; j < n; j++) {
            if (rand() < 0.035) continue; // seat torn out
            const f = (j + 0.5) / n;
            const x = a0.x + (a1.x - a0.x) * f + nOut[0] * d;
            const z = a0.z + (a1.z - a0.z) * f + nOut[2] * d;
            const broken = rand() < 0.02;
            basis.makeBasis(new THREE.Vector3(nOut[2], 0, -nOut[0]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nIn[0], 0, nIn[2]));
            if (broken) basis.multiply(new THREE.Matrix4().makeRotationX(0.5 + rand() * 0.6));
            basis.setPosition(x, y, z);
            seats.matrices.push(basis.clone());
            // A handful were replaced with whatever colour the supplier had.
            const base = rand() < 0.012 ? ([0.1, 0.25, 0.5] as RGB) : [MAROON, MUSTARD, CREAM][plan(seg.stand, x, k)];
            const k2 = fade * (0.82 + rand() * 0.3);
            lightAt(x, y + 0.5, z, nIn[0] * 0.6, 0.8, nIn[2] * 0.6, lit);
            seats.colors.push(base[0] * k2 * lit[0], base[1] * k2 * lit[1], base[2] * k2 * lit[2]);
          }
        }
      }
    }

    // Where a taller slice meets a shorter one (or a gap), close the stepped end with a wall.
    const next = segs[(index + 1) % segs.length];
    if (next.rows !== seg.rows) {
      const taller = seg.rows > next.rows;
      const n: V3 = taller ? [a1.nz, 0, -a1.nx] : [-a1.nz, 0, a1.nx];
      const lo = Math.min(seg.rows, next.rows);
      const hi = Math.max(seg.rows, next.rows);
      const wall = mul(CONCRETE, 0.85);
      const side = (d: number, d2: number, y: number) => {
        terr.quad(at1(d, 0), at1(d2, 0), at1(d2, y), at1(d, y), n, wall, { uv: [d / 5, 0, d2 / 5, 0, d2 / 5, y / 5, d / 5, y / 5], shade: [0.6, 0.6, 1, 1] });
      };
      if (lo === 0) side(0, WALK_W, WALL_H);
      for (let k = lo; k < hi; k++) side(WALK_W + k * TREAD, WALK_W + (k + 1) * TREAD, WALL_H + (k + 1) * RISER);
      side(WALK_W + hi * TREAD, WALK_W + hi * TREAD + 0.3, WALL_H + hi * RISER + 1.1);
    }
  });
  return seats;
}

/** A moulded plastic seat reduced to its two visible faces: pan and backrest. */
function seatGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const w = 0.22;
  // Local frame: x along the row, y up, z toward the pitch.
  const v = [
    [-w, 0.06, -0.16], [w, 0.06, -0.16], [w, 0.06, 0.22], [-w, 0.06, 0.22],
    [-w, 0.06, -0.16], [w, 0.06, -0.16], [w, 0.46, -0.24], [-w, 0.46, -0.24],
  ];
  const pos: number[] = [];
  for (const o of [0, 4]) for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...v[o + i]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Cantilever roof over the main (north) stand: columns, rafters, tin sheets, painted fascia, tube lights. */
function buildRoof(solids: Geo, glow: Geo, glows: GlowList, rand: () => number): void {
  const zBack = -(BOWL.hz + WALK_W + NORTH_ROWS * TREAD);
  const zFront = -(BOWL.hz + 2.5);
  const yBack = WALL_H + NORTH_ROWS * RISER + 6.5;
  const yFront = yBack + 4;
  const tin: RGB = [0.3, 0.32, 0.33];
  const bays = 10;
  const w = 112 / bays;
  for (let i = 0; i < bays; i++) {
    const x0 = -56 + i * w;
    // Sheets replaced at different times: some new and pale, some rusted through.
    const sheet = rand() < 0.25 ? ([0.3, 0.17, 0.1] as RGB) : mul(tin, 0.7 + rand() * 0.5);
    solids.quad([x0, yBack, zBack - 1.5], [x0 + w, yBack, zBack - 1.5], [x0 + w, yFront, zFront], [x0, yFront, zFront], [0, -0.99, 0.16], sheet);
    // Back wall behind the top row, stopping short of the roof so the town shows through the gap.
    const yTop = WALL_H + NORTH_ROWS * RISER + 1.1;
    solids.quad([x0, yTop, zBack], [x0 + w, yTop, zBack], [x0 + w, yBack - 1.7, zBack], [x0, yBack - 1.7, zBack], [0, 0, 1], mul(CREAM, 0.45 + rand() * 0.2), { shade: [0.75, 0.75, 1, 1] });
  }
  for (let i = 0; i <= bays; i++) {
    const x = -56 + i * w;
    solids.beam([x, WALL_H + NORTH_ROWS * RISER, zBack + 0.4], [x, yBack, zBack + 0.4], 0.55, mul(CONCRETE, 0.9));
    solids.beam([x, yBack - 0.4, zBack + 0.4], [x, yFront - 0.4, zFront + 0.3], 0.4, STEEL);
    solids.beam([x, yBack - 3.4, zBack + 0.4], [x, yBack + 1.2, zBack + 9], 0.25, STEEL);
  }
  solids.box(0, yFront - 0.35, zFront, 112.4, 1.3, 0.25, mul(MAROON, 1.4));
  solids.box(0, yFront - 0.9, zFront + 0.02, 112.4, 0.22, 0.27, MUSTARD);

  // Fluorescent tubes under the roof. Only some still work, and one is on its way out.
  const tube: RGB = [0.75, 0.95, 0.85];
  [-44.8, -22.4, 0, 22.4, 44.8].forEach((x, i) => {
    const z = (zBack + zFront) / 2;
    const y = (yBack + yFront) / 2 - 0.7;
    const state = ['flicker', 'dead', 'on', 'on', 'dead'][i];
    solids.box(x, y + 0.12, z, 0.25, 0.1, 2.6, STEEL);
    if (state === 'dead') return;
    glow.box(x, y, z, 0.12, 0.1, 2.4, mul(tube, 2.2), 0, true);
    glows.push({ pos: [x, y - 0.1, z], rgb: mul(tube, 0.5), size: 5, mode: state === 'flicker' ? 2 : 0, rate: state === 'flicker' ? 9 : 2.3, phase: i * 2.1, moths: [14, 1.6, 0.05] });
    if (state === 'on') LOCALS.push({ x, y: y - 1, z, radius: 17, rgb: [0.12, 0.16, 0.14] });
  });
}

/** One soft light sprite: lamp flares, blinkers, the cart lamp. Mode 0 steady, 1 blink, 2 stutter. */
interface GlowSpec {
  pos: V3;
  rgb: RGB;
  size: number;
  mode: number;
  rate: number;
  phase: number;
  /** Insects circling this light: how many, how far out, how big. */
  moths?: [number, number, number];
}
type GlowList = GlowSpec[];

/** The four floodlight towers. Lamps of the two lit banks go to the glow mesh so they bloom. */
function buildTowers(solids: Geo, glow: Geo, glows: GlowList, rand: () => number): void {
  HEADS.forEach((head, t) => {
    const on = t < 2;
    const yaw = Math.atan2(head.x, head.z);
    const column = mul(CONCRETE, 0.5);
    solids.box(head.x, 10, head.z, 2.3, 20, 2.3, column, yaw);
    solids.box(head.x, 28, head.z, 1.8, 16, 1.8, column, yaw);
    solids.box(head.x, 39.5, head.z, 1.35, 7, 1.35, column, yaw);
    solids.box(head.x, 42.2, head.z, 4, 0.25, 4, STEEL, yaw);

    const aim = on ? LAMPS[t].aim : new THREE.Vector3(-34, 0, Math.sign(head.z) * 9).sub(head).normalize();
    const right = new THREE.Vector3().crossVectors(aim, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, aim);
    const at = (i: number, j: number, k: number): V3 => [
      head.x + right.x * i + up.x * j + aim.x * k,
      head.y + right.y * i + up.y * j + aim.y * k,
      head.z + right.z * i + up.z * j + aim.z * k,
    ];
    // Lattice frame the lamps are bolted to.
    for (const j of [-3.1, -1.05, 1.05, 3.1]) solids.beam(at(-5.2, j, 0), at(5.2, j, 0), 0.18, STEEL);
    for (const i of [-5.2, 0, 5.2]) solids.beam(at(i, -3.1, 0), at(i, 3.1, 0), 0.18, STEEL);
    const face: V3 = [aim.x, aim.y, aim.z];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 4; j++) {
        const cx = (i - 3) * 1.5;
        const cy = (j - 1.5) * 1.5;
        const h = 0.56;
        const corners: [V3, V3, V3, V3] = [at(cx - h, cy - h, 0.25), at(cx + h, cy - h, 0.25), at(cx + h, cy + h, 0.25), at(cx - h, cy + h, 0.25)];
        solids.quad(at(cx - 0.68, cy - 0.68, 0.1), at(cx + 0.68, cy - 0.68, 0.1), at(cx + 0.68, cy + 0.68, 0.1), at(cx - 0.68, cy + 0.68, 0.1), null, STEEL);
        // A few lamps in every bank have blown; the rest are not all the same age.
        if (on && rand() > 0.14) glow.quad(...corners, null, mul(LAMP_RGB, 1.2 + rand() * 1.5), { glow: true });
        else solids.quad(...corners, face, [0.3, 0.33, 0.38]);
      }
    }
    if (on) glows.push({ pos: at(0, 0, 0.6), rgb: mul(LAMP_RGB, 0.12), size: 11, mode: 0, rate: 0.9, phase: t * 2, moths: [140, 9, 0.16] });
    solids.beam([head.x, 42, head.z], [head.x, LAMP_Y + 5.4, head.z], 0.2, STEEL);
    glows.push({ pos: [head.x, LAMP_Y + 5.6, head.z], rgb: [3.2, 0.12, 0.06], size: 1.6, mode: 1, rate: 1.7, phase: t * 1.3 });
  });
}

// ------------------------------------------------------- things on the pitch

const WHITE: RGB = [0.72, 0.72, 0.7];
const CART = { x: 26, z: 54.5, yaw: 0.35 };
const SCOREBOARD_X = -93.4;
const SPRINKLERS: [number, number][] = [
  [-32, -19],
  [-32, 19],
  [32, -19],
  [32, 19],
  [0, -27],
  [0, 27],
];

/** Goal frames in the solid mesh, their nets in the see-through one. */
function buildGoals(solids: Geo, nets: Geo): void {
  for (const s of [-1, 1]) {
    const x0 = s * PITCH_HX;
    const xt = s * (PITCH_HX + 0.8);
    const xb = s * (PITCH_HX + 2);
    const h = 2.44;
    const w = 3.66;
    for (const z of [-w, w]) {
      solids.beam([x0, 0, z], [x0, h, z], 0.12, WHITE);
      solids.beam([x0, h, z], [xt, h, z], 0.05, WHITE);
      solids.beam([xt, h, z], [xb, 0, z], 0.05, WHITE);
      const uv = [0, 0, 2 / 0.96, 0, 0.8 / 0.96, h / 0.96, 0, h / 0.96];
      nets.quad([x0, 0, z], [xb, 0, z], [xt, h, z], [x0, h, z], null, WHITE, { uv });
    }
    solids.beam([x0, h, -w], [x0, h, w], 0.12, WHITE);
    solids.beam([xt, h, -w], [xt, h, w], 0.05, WHITE);
    const span = (2 * w) / 0.96;
    nets.quad([x0, h, -w], [x0, h, w], [xt, h, w], [xt, h, -w], null, WHITE, { uv: [0, 0, span, 0, span, 0.8 / 0.96, 0, 0.8 / 0.96] });
    nets.quad([xt, h, -w], [xt, h, w], [xb, 0, w], [xb, 0, -w], null, WHITE, { uv: [0, 0, span, 0, span, 2.7 / 0.96, 0, 2.7 / 0.96] });
  }
}

/** The bar fence that keeps the terraces off the track, all the way round. */
function buildFence(fence: Geo): void {
  const { P } = ringLengths(BOWL);
  const n = 228;
  const a: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  const b: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  const paint: RGB = [0.75, 0.78, 0.7];
  for (let i = 0; i < n; i++) {
    ringAt(BOWL, FENCE_D, i / n, a);
    ringAt(BOWL, FENCE_D, (i + 1) / n, b);
    const u0 = ((i / n) * P) / 2.4;
    const u1 = (((i + 1) / n) * P) / 2.4;
    fence.quad([a.x, 0, a.z], [b.x, 0, b.z], [b.x, 2.3, b.z], [a.x, 2.3, a.z], null, paint, { uv: [u0, 0, u1, 0, u1, 1, u0, 1] });
  }
}

/** Advertising boards along the touchlines and behind the goals, with plain backs and props. */
function buildBoards(cloth: Geo, solids: Geo): void {
  const back: RGB = [0.1, 0.1, 0.11];
  let sign = 0;
  const board = (cx: number, cz: number, alongX: boolean, face: number) => {
    // 'face' is +1 or -1: which way along the other axis the front looks (always toward the pitch).
    const a: V3 = alongX ? [cx - 3 * face, 0.06, cz] : [cx, 0.06, cz + 3 * face];
    const b: V3 = alongX ? [cx + 3 * face, 0.06, cz] : [cx, 0.06, cz - 3 * face];
    const n: V3 = alongX ? [0, 0.2, face] : [face, 0.2, 0];
    cloth.quad(a, b, [b[0], 0.96, b[2]], [a[0], 0.96, a[2]], n, [1, 1, 1], { uv: signUV(sign++ % SIGNS.length) });
    const off = 0.07;
    const push = (p: V3, y: number): V3 => (alongX ? [p[0], y, p[2] - face * off] : [p[0] - face * off, y, p[2]]);
    solids.quad(push(a, 0.06), push(b, 0.06), push(b, 0.96), push(a, 0.96), [-n[0], 0.2, -n[2]], back);
    for (const p of [a, b]) {
      const foot: V3 = alongX ? [p[0] * 0.98 + cx * 0.02, 0, p[2] - face * 0.55] : [p[0] - face * 0.55, 0, p[2] * 0.98 + cz * 0.02];
      solids.beam(push(p, 0.9), foot, 0.05, STEEL);
    }
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const x = -46.5 + i * 6.2;
      // Leave room for the two dugouts in front of the main stand.
      if (s === -1 && Math.abs(Math.abs(x) - 13) < 7.5) continue;
      board(x, s * 36.4, true, -s);
    }
    for (let j = 0; j < 10; j++) board(s * 56.6, -27.9 + j * 6.2, false, -s);
  }
}

/** Supporters' and stewards' banners tied along the fence; they belly in and out with the wind. */
function buildBanners(cloth: Geo): void {
  const { P } = ringLengths(BOWL);
  const spots = [0.035, 0.945, 0.135, 0.25, 0.37, 0.455, 0.56, 0.725];
  const cols = 12;
  const len = 9.5;
  const p: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  spots.forEach((u, index) => {
    const [bx, by, bw, bh] = bannerRect(index);
    const sag = index % 3 === 1 ? 0.35 : 0;
    // Tied at the top every fourth column; the bottom edge is the loosest.
    const corner = (k: number, row: number): { at: V3; uv: [number, number]; wave: [number, number] } => {
      ringAt(BOWL, FENCE_D - 0.14, u + ((0.5 - k / cols) * len) / P, p);
      const tied = k % 4 === 0;
      const y = 2.08 - row * 0.65 - (tied ? 0 : 0.05) - (k / cols) * sag;
      const amp = 0.11 * (row === 0 ? (tied ? 0 : 0.45) : row === 1 ? 0.85 : tied ? 0.5 : 1);
      return { at: [p.x, y, p.z], uv: [(bx + 2 + (k / cols) * (bw - 4)) / ATLAS_W, 1 - (by + 2 + (row / 2) * (bh - 4)) / ATLAS_H], wave: [amp, k * 0.85 + index * 2] };
    };
    for (let k = 0; k < cols; k++) {
      for (let row = 0; row < 2; row++) {
        const q = [corner(k, row + 1), corner(k + 1, row + 1), corner(k + 1, row), corner(k, row)];
        ringAt(BOWL, 0, u, p);
        cloth.quad(q[0].at, q[1].at, q[2].at, q[3].at, [-p.nx, 0, -p.nz], [0.9, 0.9, 0.9], { uv: q.flatMap((c) => c.uv), wave: q.flatMap((c) => c.wave) });
      }
    }
  });
}

/** Corner flags, and a row of club flags on poles on the apron behind the lit goal. */
function buildFlags(cloth: Geo, solids: Geo): void {
  const flag = (px: number, pz: number, top: number, w: number, h: number, swatch: number, amp: number, pole: number) => {
    solids.beam([px, 0, pz], [px, top, pz], pole, [0.6, 0.6, 0.55]);
    // The wind comes from the south-west corner; cloth trails downwind of its pole.
    const wx = 0.32;
    const wz = -0.95;
    const cols = 6;
    const [u0, v0, u1, , , v1] = atlasUV(swatch * 256, SWATCH_Y, 256, 128);
    const corner = (k: number, row: number): { at: V3; uv: [number, number]; wave: [number, number] } => {
      const f = k / cols;
      // Triangular pennant for small flags (h shrinks to a point), with a droop that grows outward.
      const y = top - row * h * (w < 1 ? 1 - f * 0.5 : 1) - f * f * w * 0.22 - (w < 1 ? f * h * 0.25 : 0);
      return { at: [px + wx * w * f, y, pz + wz * w * f], uv: [u0 + (u1 - u0) * f, v1 + (v0 - v1) * row], wave: [amp * f, f * 5 + px] };
    };
    for (let k = 0; k < cols; k++) {
      const q = [corner(k, 1), corner(k + 1, 1), corner(k + 1, 0), corner(k, 0)];
      cloth.quad(q[0].at, q[1].at, q[2].at, q[3].at, [wz, 0, -wx], [0.9, 0.9, 0.9], { uv: q.flatMap((c) => c.uv), wave: q.flatMap((c) => c.wave) });
    }
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) flag(sx * PITCH_HX, sz * PITCH_HZ, 1.55, 0.5, 0.34, 0, 0.07, 0.035);
  for (let i = 0; i < 7; i++) flag(92.6, -21 + i * 7, 9.5 + (i % 2) * 0.4, 2.7, 1.7, i % 3, 0.6, 0.1);
}

/** Two dugouts in front of the main stand: tin back, tinted roof, a bench and a row of seats. */
function buildDugouts(solids: Geo): void {
  for (const sx of [-1, 1]) {
    const x = sx * 13;
    const z = -36.45;
    solids.box(x, 1.0, z - 0.7, 8, 2.0, 0.08, [0.2, 0.22, 0.24]);
    for (const e of [-4, 4]) solids.box(x + e, 1.0, z, 0.08, 2.0, 1.4, [0.2, 0.22, 0.24]);
    solids.box(x, 2.05, z + 0.1, 8.3, 0.07, 1.75, [0.1, 0.2, 0.32]);
    solids.box(x, 0.42, z - 0.3, 7.4, 0.08, 0.4, [0.3, 0.2, 0.1]);
    for (let i = 0; i < 9; i++) solids.box(x - 3.2 + i * 0.8, 0.78, z - 0.5, 0.5, 0.6, 0.08, i % 4 === 3 ? CREAM : MUSTARD);
    // Somebody's kit bag and a crate of water left behind.
    solids.box(x + sx * 2.5, 0.2, z + 0.5, 0.7, 0.36, 0.4, [0.05, 0.1, 0.3]);
    solids.box(x - sx * 1.5, 0.16, z + 0.55, 0.5, 0.3, 0.36, [0.5, 0.52, 0.55]);
  }
}

/** Steel legs and cabinet of the scoreboard on the apron behind the dark goal. */
function buildScoreboardFrame(solids: Geo): void {
  solids.box(SCOREBOARD_X - 0.35, 7.05, 0, 0.6, 7.6, 15, [0.07, 0.07, 0.08]);
  for (const z of [-5.2, 5.2]) {
    solids.beam([SCOREBOARD_X - 0.35, 0, z], [SCOREBOARD_X - 0.35, 3.3, z], 0.45, STEEL);
    solids.beam([SCOREBOARD_X - 0.35, 3.2, z], [SCOREBOARD_X - 3.4, 0, z], 0.2, STEEL);
  }
}

/**
 * The last vendor on the apron: a glass-fronted cart with a pressure lamp, a bench, plastic
 * stools, the vendor waiting for the groundsman to finish, and his motorbike.
 */
function buildCart(solids: Geo, glow: Geo, glows: GlowList): void {
  const c = Math.cos(CART.yaw);
  const s = Math.sin(CART.yaw);
  const at = (x: number, y: number, z: number): V3 => [CART.x + x * c + z * s, y, CART.z - x * s + z * c];
  const put = (g: Geo, x: number, y: number, z: number, sx: number, sy: number, sz: number, rgb: RGB, unlit = false) => {
    const p = at(x, y, z);
    g.box(p[0], p[1], p[2], sx, sy, sz, rgb, CART.yaw, unlit);
  };
  put(solids, 0, 0.78, 0, 1.5, 0.7, 0.75, [0.06, 0.26, 0.24]);
  put(glow, 0, 1.48, 0, 1.38, 0.68, 0.68, [0.5, 0.32, 0.12], true);
  put(solids, 0, 1.9, 0, 1.75, 0.07, 1.0, [0.26, 0.27, 0.28]);
  for (const x of [-0.72, 0.72]) for (const z of [-0.36, 0.36]) solids.beam(at(x, 1.1, z), at(x, 1.9, z), 0.05, [0.06, 0.26, 0.24]);
  for (const x of [-0.8, 0.8]) put(solids, x, 0.36, 0.1, 0.06, 0.72, 0.72, [0.03, 0.03, 0.03]);
  solids.beam(at(-0.75, 0.9, 0), at(-1.5, 1.0, 0), 0.05, [0.3, 0.2, 0.1]);
  put(glow, 0.55, 1.72, -0.5, 0.12, 0.16, 0.12, [5, 3, 1.1], true);
  glows.push({ pos: at(0.55, 1.72, -0.5), rgb: [1.1, 0.62, 0.22], size: 2.6, mode: 0, rate: 11, phase: 0, moths: [24, 0.9, 0.035] });
  // Bench, stools, vendor.
  put(solids, -0.2, 0.45, -1.35, 1.7, 0.06, 0.3, [0.32, 0.22, 0.12]);
  for (const x of [-0.95, 0.55]) put(solids, x, 0.22, -1.35, 0.06, 0.44, 0.26, [0.32, 0.22, 0.12]);
  put(solids, 1.5, 0.22, -0.9, 0.3, 0.44, 0.3, [0.5, 0.06, 0.05]);
  put(solids, -1.6, 0.22, -0.7, 0.3, 0.44, 0.3, [0.06, 0.2, 0.5]);
  put(solids, -0.4, 0.8, -1.35, 0.42, 0.62, 0.26, [0.4, 0.4, 0.34]);
  put(solids, -0.4, 1.24, -1.33, 0.2, 0.22, 0.2, [0.3, 0.18, 0.11]);
  put(solids, -0.4, 0.42, -1.1, 0.36, 0.14, 0.5, [0.08, 0.09, 0.14]);
  put(solids, -0.4, 0.2, -0.9, 0.34, 0.4, 0.14, [0.08, 0.09, 0.14]);
  // Motorbike on its side stand.
  put(solids, 2.7, 0.56, 0.3, 0.3, 0.34, 1.3, [0.05, 0.05, 0.06]);
  put(solids, 2.7, 0.8, 0.05, 0.28, 0.1, 0.75, [0.02, 0.02, 0.02]);
  for (const z of [-0.35, 0.95]) put(solids, 2.7, 0.28, z, 0.1, 0.56, 0.56, [0.02, 0.02, 0.02]);
  solids.beam(at(2.4, 1.0, 0.8), at(3.0, 1.0, 0.8), 0.05, STEEL);
  put(solids, 2.7, 0.66, 0.98, 0.34, 0.2, 0.1, [0.5, 0.06, 0.05]);
}

/** Sodium street lamps outside the ground, seen through the gaps at the corners. */
function streetLamps(glows: GlowList, rand: () => number): void {
  const p: RingPoint = { x: 0, z: 0, nx: 0, nz: 0 };
  for (let i = 0; i < 26; i++) {
    ringAt(BOWL, 44 + rand() * 60, rand(), p);
    const cool = rand() < 0.25;
    glows.push({ pos: [p.x, 6 + rand() * 4, p.z], rgb: cool ? [0.5, 0.7, 0.9] : [1.5, 0.75, 0.22], size: 1.8, mode: 0, rate: 1 + rand() * 3, phase: rand() * 6 });
  }
}

/** The groundsman and his line-marking cart; legs are separate so they can swing. */
function buildGroundsman(material: THREE.Material): { root: THREE.Group; legs: THREE.Mesh[] } {
  const body = new Geo();
  const raw = { glow: true };
  const shirt: RGB = [0.14, 0.24, 0.4];
  const skin: RGB = [0.3, 0.18, 0.11];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rgb: RGB) => body.box(x, y, z, sx, sy, sz, rgb, 0, true);
  box(0, 1.17, 0, 0.42, 0.6, 0.24, shirt);
  box(0, 1.6, 0.02, 0.2, 0.22, 0.21, skin);
  box(0, 1.72, 0.06, 0.23, 0.07, 0.3, [0.5, 0.45, 0.3]);
  for (const x of [-0.25, 0.25]) {
    body.quad([x - 0.05, 1.4, 0], [x + 0.05, 1.4, 0], [x * 0.8 + 0.05, 1.0, 0.5], [x * 0.8 - 0.05, 1.0, 0.5], null, skin, raw);
    body.beam([x * 0.8, 1.0, 0.5], [x * 0.8, 0.5, 0.95], 0.04, STEEL);
  }
  box(0, 0.42, 1.05, 0.36, 0.42, 0.5, [0.6, 0.6, 0.56]);
  for (const x of [-0.22, 0.22]) box(x, 0.16, 1.05, 0.05, 0.32, 0.32, [0.04, 0.04, 0.04]);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(body.build(), material));
  const legGeo = new Geo();
  legGeo.box(0, -0.42, 0, 0.15, 0.84, 0.17, [0.1, 0.1, 0.12], 0, true);
  const geometry = legGeo.build();
  const legs = [-0.11, 0.11].map((x) => {
    const leg = new THREE.Mesh(geometry, material);
    leg.position.set(x, 0.86, 0);
    root.add(leg);
    return leg;
  });
  return { root, legs };
}

// ------------------------------------------------------------------ stadium

const DRIFTERS = 80;
const WIND_X = 0.32;
const WIND_Z = -0.95;
const HAZE_LENGTH = 85;
// Walking line of the groundsman: just inside the touchlines and goal lines, all the way round.
const WALK_HX = 51.6;
const WALK_HZ = 33.2;
const LITTER_COLOURS: RGB[] = [
  [0.62, 0.62, 0.58],
  [0.45, 0.45, 0.42],
  [0.35, 0.5, 0.62],
  [0.6, 0.3, 0.36],
  [0.62, 0.52, 0.15],
];

/**
 * The stadium around the course, empty after the match. Add `group` to the scene with its origin
 * on the centre spot of the pitch, and call update() once a frame. Needs no lights.
 */
export class Stadium {
  readonly group = new THREE.Group();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly time = { value: 0 };
  private readonly viewH = { value: 1080 };
  private readonly textures: THREE.Texture[] = [];
  private readonly ticker: THREE.Texture;
  private readonly litter: THREE.InstancedMesh;
  /** Per piece of litter: x, y, z, vx, vz, spin angle, width, height, colour index, lightness. */
  private readonly bits: Float32Array;
  private readonly bitCount: number;
  private readonly walker: { root: THREE.Group; legs: THREE.Mesh[] };
  private readonly walkerMaterial: THREE.MeshBasicMaterial;
  /** Which way the groundsman faces; NaN until the first update puts him on his path. */
  private heading = Number.NaN;
  private readonly size = new THREE.Vector2();
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly lit: RGB = [0, 0, 0];

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const rand = mulberry(1987);
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const texture = (cv: HTMLCanvasElement, repeat = false) => {
      const t = toTexture(cv, anisotropy, repeat);
      this.textures.push(t);
      return t;
    };

    // Pools of local light have to be known before anything is baked.
    LOCALS.length = 0;
    const cartLamp: LocalLight = { x: CART.x, y: 1.8, z: CART.z - 0.6, radius: 10, rgb: [0.85, 0.46, 0.15] };
    const boardSpill: LocalLight = { x: SCOREBOARD_X + 5, y: 5, z: 0, radius: 26, rgb: [0.1, 0.075, 0.04] };
    LOCALS.push(cartLamp, boardSpill);

    const terraces = new Geo();
    const solids = new Geo();
    const glow = new Geo();
    const cloth = new Geo();
    const nets = new Geo();
    const fence = new Geo();
    const glows: GlowList = [];
    buildRoof(solids, glow, glows, rand);
    const seats = buildBowl(terraces, solids, glow, rand);
    buildTowers(solids, glow, glows, rand);
    buildGoals(solids, nets);
    buildFence(fence);
    buildBoards(cloth, solids);
    buildBanners(cloth);
    buildFlags(cloth, solids);
    buildDugouts(solids);
    buildScoreboardFrame(solids);
    buildCart(solids, glow, glows);
    streetLamps(glows, rand);
    for (const [x, z] of SPRINKLERS) solids.box(x, 0.06, z, 0.14, 0.12, 0.14, [0.05, 0.05, 0.05]);

    const basic = (params: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, ...params });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, order = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = order;
      this.group.add(mesh);
      return mesh;
    };

    // Sky first, behind everything.
    const skyline = texture(skylineTexture(rand), true);
    skyline.generateMipmaps = false;
    skyline.minFilter = THREE.LinearFilter;
    const sky = add(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: { uTime: this.time, uSkyline: { value: skyline } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
      -1000,
    );
    sky.frustumCulled = false;

    const lampUniforms = () => ({ uLampPos: { value: LAMPS.map((l) => l.pos.clone()) }, uLampAim: { value: LAMPS.map((l) => l.aim.clone()) } });
    add(
      new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
        uniforms: this.uniforms({
          ...lampUniforms(),
          uSprinkler: { value: SPRINKLERS.map(([x, z]) => new THREE.Vector3(x, 0, z)) },
          uLocalPos: { value: [cartLamp, boardSpill].map((l) => new THREE.Vector4(l.x, l.y, l.z, l.radius)) },
          uLocalCol: { value: [cartLamp, boardSpill].map((l) => new THREE.Vector3(...l.rgb)) },
        }),
        fog: true,
      }),
    );

    add(terraces.build(), basic({ map: texture(concreteTexture(rand), true), color: new THREE.Color(1.9, 1.9, 1.9) }));
    add(solids.build(), basic({}));
    add(glow.build(), basic({ toneMapped: false }));
    add(cloth.build(true), makeCloth(basic({ map: texture(clothAtlas(rand)) }), this.time));

    const seatMesh = new THREE.InstancedMesh(seatGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), seats.matrices.length);
    const colour = new THREE.Color();
    seats.matrices.forEach((m, i) => {
      seatMesh.setMatrixAt(i, m);
      seatMesh.setColorAt(i, colour.setRGB(seats.colors[i * 3], seats.colors[i * 3 + 1], seats.colors[i * 3 + 2]));
    });
    seatMesh.frustumCulled = false;
    this.group.add(seatMesh);

    // See-through things after the solid ones.
    const fenceMap = texture(fenceTexture(rand), true);
    add(fence.build(), basic({ map: fenceMap, transparent: true, depthWrite: false }), 1);
    add(nets.build(), basic({ map: texture(netTexture(), true), transparent: true, depthWrite: false }), 2);

    // Scoreboard screen and the crawling message under it. Slightly over 1 so the LEDs bloom a little.
    const led = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
    const screen = add(new THREE.PlaneGeometry(14, 6.1).rotateY(Math.PI / 2), led(texture(scoreboardTexture())));
    screen.position.set(SCOREBOARD_X, 7.5, 0);
    this.ticker = texture(tickerTexture(), true);
    this.ticker.repeat.set(0.62, 1);
    const strip = add(new THREE.PlaneGeometry(14, 0.7).rotateY(Math.PI / 2), led(this.ticker));
    strip.position.set(SCOREBOARD_X, 3.85, 0);

    // Haze in the beams of the two banks that are on.
    const hazeGeometry = new THREE.ConeGeometry(30, HAZE_LENGTH, 48, 1, true).translate(0, -HAZE_LENGTH / 2, 0);
    const hazeMaterial = new THREE.ShaderMaterial({
      vertexShader: HAZE_VERT,
      fragmentShader: HAZE_FRAG,
      uniforms: { uTime: this.time, uLength: { value: HAZE_LENGTH } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const lamp of LAMPS) {
      const cone = add(hazeGeometry, hazeMaterial, 3);
      cone.position.copy(lamp.pos);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lamp.aim);
    }

    // Point sprites: lamp glows, moths, sprinkler water.
    const points = (vertexShader: string, attributes: Record<string, [number[], number]>, extra: Record<string, THREE.IUniform> = {}) => {
      const g = new THREE.BufferGeometry();
      for (const [name, [data, width]] of Object.entries(attributes)) g.setAttribute(name, new THREE.Float32BufferAttribute(data, width));
      const p = new THREE.Points(
        g,
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader: POINT_FRAG,
          uniforms: this.uniforms(extra),
          fog: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      p.frustumCulled = false;
      p.renderOrder = 4;
      this.group.add(p);
    };
    points(GLOW_VERT, {
      position: [glows.flatMap((g) => g.pos), 3],
      aColor: [glows.flatMap((g) => g.rgb), 3],
      aSize: [glows.map((g) => g.size), 1],
      aBlink: [glows.flatMap((g) => [g.mode, g.rate, g.phase]), 3],
    });
    const moth = { position: [] as number[], aColor: [] as number[], aSeed: [] as number[] };
    for (const g of glows) {
      if (!g.moths) continue;
      const [count, radius, size] = g.moths;
      for (let i = 0; i < count; i++) {
        moth.position.push(...g.pos);
        moth.aColor.push(2.2 * (0.5 + rand()), 2.0 * (0.5 + rand()), 1.4);
        moth.aSeed.push(radius * (0.25 + 0.75 * rand()), rand() * 6.28, 0.35 + rand() * 0.8, size * (0.7 + rand() * 0.6));
      }
    }
    points(MOTH_VERT, { position: [moth.position, 3], aColor: [moth.aColor, 3], aSeed: [moth.aSeed, 4] });
    const drop = { position: [] as number[], aSeed: [] as number[] };
    SPRINKLERS.forEach(([x, z], head) => {
      for (let i = 0; i < 2200; i++) {
        drop.position.push(x, 0.15, z);
        drop.aSeed.push(rand(), rand(), rand(), head * 1.9);
      }
    });
    points(DROP_VERT, { position: [drop.position, 3], aSeed: [drop.aSeed, 4] }, lampUniforms());

    // Litter: the first DRIFTERS pieces blow about the pitch and track, the rest rustle where they
    // were dropped on the terraces.
    this.bitCount = DRIFTERS + Math.min(140, seats.litter.length);
    this.bits = new Float32Array(this.bitCount * 10);
    for (let i = 0; i < this.bitCount; i++) {
      const o = i * 10;
      const spot = i < DRIFTERS ? ([(rand() - 0.5) * 150, 0, (rand() - 0.5) * 112] as V3) : seats.litter[i - DRIFTERS];
      this.bits.set([spot[0], spot[1], spot[2], 0, 0, rand() * 6.28, 0.22 + rand() * 0.3, 0.16 + rand() * 0.22, Math.floor(rand() * LITTER_COLOURS.length), 0.5 + rand() * 0.8], o);
    }
    this.litter = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.bitCount);
    this.litter.frustumCulled = false;
    this.dummy.rotation.order = 'YXZ';
    for (let i = 0; i < this.bitCount; i++) this.placeBit(i, 0, 0);
    this.group.add(this.litter);

    this.walkerMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.walker = buildGroundsman(this.walkerMaterial);
    this.group.add(this.walker.root);
    this.update(0, 0);
  }

  /** Uniforms for a shader that is fogged by the scene and uses the shared clock. */
  private uniforms(extra: Record<string, THREE.IUniform>): Record<string, THREE.IUniform> {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extra]);
    u.uTime = this.time;
    u.uViewH = this.viewH;
    return u;
  }

  /** Writes one piece of litter's matrix and colour from its state. */
  private placeBit(i: number, tilt: number, hop: number): void {
    const b = this.bits;
    const o = i * 10;
    const d = this.dummy;
    d.position.set(b[o], b[o + 1] + 0.03 + hop, b[o + 2]);
    d.rotation.set(-Math.PI / 2 + tilt, b[o + 5], 0);
    d.scale.set(b[o + 6], b[o + 7], 1);
    d.updateMatrix();
    this.litter.setMatrixAt(i, d.matrix);
    const l = lightAt(b[o], b[o + 1] + 0.1, b[o + 2], 0, 1, 0, this.lit);
    const c = LITTER_COLOURS[b[o + 8]];
    this.litter.setColorAt(i, this.tint.setRGB(c[0] * l[0], c[1] * l[1], c[2] * l[2]));
  }

  /** Advance everything that moves. dt and time are in seconds. */
  update(dt: number, time: number): void {
    this.time.value = time;
    this.viewH.value = this.renderer.getDrawingBufferSize(this.size).y;
    this.ticker.offset.x = (time * 0.03) % 1;

    // Litter. Gusts come through in slow waves, so paper lies still, scuttles a few metres, stops.
    const b = this.bits;
    for (let i = 0; i < this.bitCount; i++) {
      const o = i * 10;
      const gust = Math.max(0, Math.sin(time * 0.23 + b[o] * 0.031 + i) + Math.sin(time * 0.11 + b[o + 2] * 0.047 + 2) - 0.7);
      if (i >= DRIFTERS) {
        this.placeBit(i, gust * Math.sin(time * 9 + i) * 0.5, 0);
        continue;
      }
      const push = gust * 4.5 * b[o + 9];
      b[o + 3] += (WIND_X * push - b[o + 3] * 1.5) * dt;
      b[o + 4] += (WIND_Z * push - b[o + 4] * 1.5) * dt;
      b[o] += b[o + 3] * dt;
      b[o + 2] += b[o + 4] * dt;
      const speed = Math.min(1, Math.hypot(b[o + 3], b[o + 4]) * 0.7);
      b[o + 5] += speed * dt * 3.4;
      // Blown out of one side, a different scrap comes in from the other.
      if (b[o + 2] < -57) {
        b[o + 2] = 57;
        b[o] = ((b[o] * 7.3 + 211) % 150) - 75;
      }
      if (b[o] > 76) b[o] = -76;
      this.placeBit(i, Math.sin(b[o + 5] * 1.7) * 0.9 * speed, Math.abs(Math.sin(b[o + 5] * 1.7)) * 0.16 * speed);
    }
    this.litter.instanceMatrix.needsUpdate = true;
    if (this.litter.instanceColor) this.litter.instanceColor.needsUpdate = true;

    // Groundsman: one slow lap of the lines, then another.
    const lap = 4 * (WALK_HX + WALK_HZ);
    let s = (time * 0.95 + 40) % lap;
    let x: number;
    let z: number;
    let want: number;
    if (s < 2 * WALK_HX) [x, z, want] = [-WALK_HX + s, WALK_HZ, Math.PI / 2];
    else if ((s -= 2 * WALK_HX) < 2 * WALK_HZ) [x, z, want] = [WALK_HX, WALK_HZ - s, Math.PI];
    else if ((s -= 2 * WALK_HZ) < 2 * WALK_HX) [x, z, want] = [WALK_HX - s, -WALK_HZ, -Math.PI / 2];
    else [x, z, want] = [-WALK_HX, -WALK_HZ + (s - 2 * WALK_HX), 0];
    if (Number.isNaN(this.heading)) this.heading = want;
    const turn = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += turn * Math.min(1, dt * 3);
    const root = this.walker.root;
    root.position.set(x, Math.abs(Math.sin(time * 5.2)) * 0.03, z);
    root.rotation.y = this.heading;
    this.walker.legs[0].rotation.x = Math.sin(time * 5.2) * 0.5;
    this.walker.legs[1].rotation.x = -Math.sin(time * 5.2) * 0.5;
    const l = lightAt(x, 1, z, 0, 0, 0, this.lit);
    this.walkerMaterial.color.setRGB(l[0] * 1.6, l[1] * 1.6, l[2] * 1.6);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Points)) return;
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    });
    for (const t of this.textures) t.dispose();
  }
}
