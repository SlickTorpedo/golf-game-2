import {
  ARM_LEN,
  ARM_R,
  BALL_R,
  BOOST_ACCEL,
  CONE_KICK,
  CONE_R,
  CUP_MAX_SPEED,
  CUP_PULL,
  CUP_R,
  CUP_SLOPE,
  DRAG,
  FLOOR_BOUNCE,
  GRAVITY,
  ICE_DECEL,
  KILL_DROP,
  MAX_SPEED,
  MUD_DECEL,
  RESTITUTION,
  ROLL_DECEL,
  SLOPE_ACCEL,
  SPIN_RATE,
  SPRING_R,
  SPRING_UP,
  STEP_UP,
  STOP_SPEED,
  SUBSTEPS,
  TICK_RATE,
  TUNNEL_R,
  WALL_GRIP,
} from './constants';
import { Level, WALL_HALF, WALL_HEIGHT, WALL_HOP, floorAt, hitTri } from './level';

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export type HitMaterial = 'board' | 'concrete' | 'cone' | 'turnstile';
export type Surface = 'turf' | 'mud' | 'track' | 'ice' | 'air';

export interface StepResult {
  /** The ball is lost: off the edge or into water. */
  oob: boolean;
  /** It was lost in water. */
  splash: boolean;
  /** It dropped into the cup. */
  holed: boolean;
  /** Hardest hit this tick, as speed into the thing, and what it was. 0 if none. */
  impact: number;
  material: HitMaterial;
  /** Hardest landing this tick, as downward speed. 0 if none. */
  landed: number;
  /** It went through a tunnel this tick. */
  tunnel: boolean;
  /** It rolled onto running track this tick. */
  boost: boolean;
  /** It hopped a kerb or rail this tick. */
  hop: boolean;
  /** A spring pad threw it this tick. */
  spring: boolean;
  /** What it is rolling on after this tick. */
  surface: Surface;
}

const DT = 1 / TICK_RATE / SUBSTEPS;
const GROUND_EPS = 0.02;
/** How much faster than the ground the ball must be rising to leave it. */
const LIFT_OFF = 0.9;

export function isGrounded(L: Level, b: Ball): boolean {
  const floor = floorAt(L, b.x, b.y, b.z);
  if (b.z > floor + GROUND_EPS) return false;
  const t = hitTri;
  return !t || b.vz <= t.gx * b.vx + t.gy * b.vy + LIFT_OFF;
}

export function isMoving(L: Level, b: Ball): boolean {
  return b.vx !== 0 || b.vy !== 0 || !isGrounded(L, b);
}

/** Angle of a turnstile's first arm at this tick. */
export function spinnerAngle(dir: number, tick: number): number {
  return (dir * SPIN_RATE * tick) / TICK_RATE;
}

/** True if a turnstile arm could reach a ball here, so it must be simulated even at rest. */
export function nearSpinner(L: Level, b: Ball): boolean {
  for (const s of L.spinners) {
    if (Math.abs(b.z - s.z) < 0.4 && Math.hypot(b.x - s.x, b.y - s.y) < ARM_LEN + ARM_R + BALL_R + 0.05) return true;
  }
  return false;
}

/** Advance one ball by one tick. Mutates the ball. */
export function stepBall(L: Level, b: Ball, tick: number): StepResult {
  const res: StepResult = {
    oob: false,
    splash: false,
    holed: false,
    impact: 0,
    material: 'board',
    landed: 0,
    tunnel: false,
    boost: false,
    hop: false,
    spring: false,
    surface: 'air',
  };
  let wasTrack = false;
  let first = true;

  for (let s = 0; s < SUBSTEPS; s++) {
    const floor = floorAt(L, b.x, b.y, b.z);
    const tri = hitTri;
    // How fast the ground itself rises under a ball moving this way.
    const climb = tri ? tri.gx * b.vx + tri.gy * b.vy : 0;
    const grounded = tri !== null && b.z <= floor + GROUND_EPS && b.vz <= climb + LIFT_OFF;

    if (grounded && tri) {
      if (tri.mat === 'water') {
        res.oob = true;
        res.splash = true;
        return res;
      }
      if (first) wasTrack = tri.mat === 'track';
      b.z = floor;
      // Gravity along the slope.
      let ax = -tri.gx * SLOPE_ACCEL;
      let ay = -tri.gy * SLOPE_ACCEL;
      if (tri.mat === 'track') {
        ax += tri.px * BOOST_ACCEL;
        ay += tri.py * BOOST_ACCEL;
      }

      // The cup: slow balls drop, fast ones are tugged by the lip and carry on.
      const cx = L.cup.x - b.x;
      const cy = L.cup.y - b.y;
      const cd = Math.hypot(cx, cy);
      if (cd < CUP_R * 1.7 && Math.abs(floor - L.cup.z) < 0.08) {
        const sp = Math.hypot(b.vx, b.vy);
        if (cd < CUP_R && sp < CUP_MAX_SPEED) {
          res.holed = true;
          return res;
        }
        if (cd > 1e-4) {
          const pull = cd < CUP_R ? CUP_PULL : CUP_SLOPE;
          ax += (cx / cd) * pull;
          ay += (cy / cd) * pull;
        }
      }

      const sp = Math.hypot(b.vx, b.vy);
      const grip = tri.mat === 'mud' ? MUD_DECEL : tri.mat === 'ice' ? ICE_DECEL : ROLL_DECEL;
      if (sp > 0) {
        const k = Math.max(0, sp - (grip + DRAG * sp) * DT) / sp;
        b.vx *= k;
        b.vy *= k;
      }
      const pushed = Math.hypot(ax, ay);
      // The surface holds a still ball against a gentle slope.
      if (pushed > grip || sp > 0) {
        b.vx += ax * DT;
        b.vy += ay * DT;
      }
      if (pushed <= grip && Math.hypot(b.vx, b.vy) < STOP_SPEED) {
        b.vx = 0;
        b.vy = 0;
      }
      // Carry the ground's rise as upward speed, so a ramp that ends throws the ball.
      b.vz = tri.gx * b.vx + tri.gy * b.vy;
      res.surface = tri.mat;

      for (const t of L.tunnels) {
        if (Math.abs(floor - t.from.z) < 0.1 && Math.hypot(b.x - t.from.x, b.y - t.from.y) < TUNNEL_R) {
          b.x = t.to.x;
          b.y = t.to.y;
          b.z = t.to.z;
          b.vz = 0;
          res.tunnel = true;
          break;
        }
      }
      for (const p of L.springs) {
        if (Math.abs(floor - p.z) < 0.1 && Math.hypot(b.x - p.x, b.y - p.y) < SPRING_R) {
          b.vz = SPRING_UP;
          b.z += 0.03;
          res.spring = true;
          break;
        }
      }
    } else {
      b.vz -= GRAVITY * DT;
      b.z += b.vz * DT;
      res.surface = 'air';
      if (tri && b.z <= floor) {
        b.z = floor;
        const hit = climb - b.vz;
        if (hit > 2.5) {
          res.landed = Math.max(res.landed, hit);
          b.vz = climb + hit * FLOOR_BOUNCE;
        } else {
          b.vz = climb;
        }
      }
    }
    first = false;

    b.x += b.vx * DT;
    b.y += b.vy * DT;
    hitProps(L, b, tick + s / SUBSTEPS, res);
    hitWalls(L, b, res);

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
      b.vx *= MAX_SPEED / speed;
      b.vy *= MAX_SPEED / speed;
    }
    if (b.z < L.minZ - KILL_DROP) {
      res.oob = true;
      return res;
    }
  }

  res.boost = !wasTrack && res.surface === 'track';
  return res;
}

/** Cones and turnstile arms. */
function hitProps(L: Level, b: Ball, tick: number, res: StepResult): void {
  for (const c of L.cones) {
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d >= BALL_R + CONE_R || d < 1e-6 || Math.abs(b.z - c.z) > 0.4) continue;
    const nx = dx / d;
    const ny = dy / d;
    b.x = c.x + nx * (BALL_R + CONE_R);
    b.y = c.y + ny * (BALL_R + CONE_R);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      // Rubber: it gives back what it took and a little more.
      const out = -vn * 0.9 + CONE_KICK;
      b.vx += (out - vn) * nx;
      b.vy += (out - vn) * ny;
      note(res, -vn, 'cone');
    }
  }

  for (const s of L.spinners) {
    const rx = b.x - s.x;
    const ry = b.y - s.y;
    if (Math.hypot(rx, ry) > ARM_LEN + ARM_R + BALL_R || Math.abs(b.z - s.z) > 0.35) continue;
    const w = s.dir * SPIN_RATE;
    const angle = spinnerAngle(s.dir, tick);
    for (let k = 0; k < 2; k++) {
      // Each bar is two opposite arms: a segment through the hub.
      const ux = Math.cos(angle + (k * Math.PI) / 2);
      const uy = Math.sin(angle + (k * Math.PI) / 2);
      const along = Math.max(-ARM_LEN, Math.min(ARM_LEN, rx * ux + ry * uy));
      const px = ux * along;
      const py = uy * along;
      let nx = rx - px;
      let ny = ry - py;
      const d = Math.hypot(nx, ny);
      if (d >= BALL_R + ARM_R) continue;
      if (d < 1e-6) {
        nx = -uy;
        ny = ux;
      } else {
        nx /= d;
        ny /= d;
      }
      b.x = s.x + px + nx * (BALL_R + ARM_R);
      b.y = s.y + py + ny * (BALL_R + ARM_R);
      // The arm is moving: bounce in its frame, so a sweeping arm bats the ball away.
      const ax = -w * py;
      const ay = w * px;
      const vn = (b.vx - ax) * nx + (b.vy - ay) * ny;
      if (vn < 0) {
        b.vx -= (1 + RESTITUTION) * vn * nx;
        b.vy -= (1 + RESTITUTION) * vn * ny;
        note(res, -vn, 'turnstile');
      }
    }
  }
}

/** Walls, and the faces of higher ground. */
function hitWalls(L: Level, b: Ball, res: StepResult): void {
  const col = Math.floor(b.x - L.minX);
  const row = Math.floor(b.y - L.minY);
  if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return;

  for (const i of L.colGrid[row * L.cols + col]) {
    const c = L.colliders[i];
    const ex = c.bx - c.ax;
    const ey = c.by - c.ay;
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-12) continue;
    const t = Math.max(0, Math.min(1, ((b.x - c.ax) * ex + (b.y - c.ay) * ey) / len2));
    const px = c.ax + ex * t;
    const py = c.ay + ey * t;
    const top = c.ta + (c.tb - c.ta) * t;
    const cliff = c.kind === 'cliff';
    const rad = BALL_R + (cliff ? 0 : WALL_HALF);

    let nx = b.x - px;
    let ny = b.y - py;
    const d2 = nx * nx + ny * ny;
    if (d2 >= rad * rad) continue;

    if (cliff) {
      // Ground the ball can roll onto, or is already above, is no obstacle.
      if (b.z + STEP_UP >= top) continue;
    } else {
      // Over the top, or far below on another level.
      if (b.z >= top - 0.02 || b.z < top - WALL_HEIGHT[c.kind as keyof typeof WALL_HEIGHT] - 0.45) continue;
    }

    const d = Math.sqrt(d2);
    if (d > 1e-6) {
      nx /= d;
      ny /= d;
    } else {
      const len = Math.sqrt(len2);
      nx = -ey / len;
      ny = ex / len;
    }
    const vn = b.vx * nx + b.vy * ny;

    if (!cliff && -vn > WALL_HOP[c.kind as keyof typeof WALL_HOP]) {
      // Hit hard enough, a low wall trips the ball over itself.
      b.z = top + 0.02;
      b.vz = Math.max(b.vz, 2.6);
      b.vx *= 0.8;
      b.vy *= 0.8;
      res.hop = true;
      continue;
    }

    b.x = px + nx * rad;
    b.y = py + ny * rad;
    if (vn < 0) {
      // Split into the part going into the wall and the part sliding along it.
      const tx = b.vx - vn * nx;
      const ty = b.vy - vn * ny;
      // A glancing touch costs almost nothing, so a ball can ride a curved wall round a bend;
      // a square hit loses the full share.
      const keep = 1 - (1 - WALL_GRIP) * Math.min(1, -vn / 2);
      b.vx = tx * keep - RESTITUTION * vn * nx;
      b.vy = ty * keep - RESTITUTION * vn * ny;
      note(res, -vn, c.kind === 'board' || c.kind === 'rail' ? 'board' : 'concrete');
    }
  }
}

function note(res: StepResult, speed: number, material: HitMaterial): void {
  if (speed > res.impact) {
    res.impact = speed;
    res.material = material;
  }
}

/** How far a putt of this speed rolls on flat turf. Used by the bots. */
export function rollDistance(speed: number): number {
  let v = speed;
  let d = 0;
  while (v > STOP_SPEED) {
    v = Math.max(0, v - (ROLL_DECEL + DRAG * v) * DT);
    d += v * DT;
  }
  return d;
}
