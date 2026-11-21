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
  KILL_Z,
  MAX_SPEED,
  MUD_DECEL,
  RESTITUTION,
  ROLL_DECEL,
  SLOPE_ACCEL,
  SPIN_RATE,
  STEP_UP,
  STOP_SPEED,
  SUBSTEPS,
  TICK_RATE,
  TUNNEL_R,
  WALL_GRIP,
} from './constants';
import { DIRS, Level, cellAt, topAt } from './level';

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export type HitMaterial = 'board' | 'concrete' | 'cone' | 'turnstile';

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
}

const DT = 1 / TICK_RATE / SUBSTEPS;
const GROUND_EPS = 0.02;
const EDGE = 1e-6;

export function isGrounded(L: Level, b: Ball): boolean {
  return b.vz <= 0 && b.z <= topAt(L, b.x, b.y) + GROUND_EPS;
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
    if (Math.hypot(b.x - s.x, b.y - s.y) < ARM_LEN + ARM_R + BALL_R + 0.05) return true;
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
  };
  const startedOnTrack = cellAt(L, Math.floor(b.x), Math.floor(b.y)).surface === 'track';

  for (let s = 0; s < SUBSTEPS; s++) {
    const floor = topAt(L, b.x, b.y);
    const c = cellAt(L, Math.floor(b.x), Math.floor(b.y));

    if (b.vz <= 0 && b.z <= floor + GROUND_EPS) {
      b.z = floor;
      b.vz = 0;
      let ax = 0;
      let ay = 0;
      if (c.kind === 'ramp') {
        ax -= DIRS[c.dir][0] * SLOPE_ACCEL;
        ay -= DIRS[c.dir][1] * SLOPE_ACCEL;
      } else if (c.surface === 'track') {
        ax += DIRS[c.dir][0] * BOOST_ACCEL;
        ay += DIRS[c.dir][1] * BOOST_ACCEL;
      }

      // The cup: slow balls drop, fast ones are tugged by the lip and carry on.
      const cx = L.cup.x - b.x;
      const cy = L.cup.y - b.y;
      const cd = Math.hypot(cx, cy);
      if (cd < CUP_R * 1.7 && Math.abs(floor - topAt(L, L.cup.x, L.cup.y)) < 0.01) {
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
      if (sp > 0) {
        const decel = (c.surface === 'mud' ? MUD_DECEL : ROLL_DECEL) + DRAG * sp;
        const k = Math.max(0, sp - decel * DT) / sp;
        b.vx *= k;
        b.vy *= k;
      }
      const pushed = Math.hypot(ax, ay);
      // Turf holds a still ball against the gentle slope round the cup.
      if (pushed > ROLL_DECEL || sp > 0) {
        b.vx += ax * DT;
        b.vy += ay * DT;
      }
      const after = Math.hypot(b.vx, b.vy);
      if (pushed <= ROLL_DECEL && after < STOP_SPEED) {
        b.vx = 0;
        b.vy = 0;
      }

      for (const t of L.tunnels) {
        if (Math.hypot(b.x - t.x, b.y - t.y) < TUNNEL_R && Math.abs(floor - topAt(L, t.x, t.y)) < 0.01) {
          b.x = t.tx;
          b.y = t.ty;
          b.z = topAt(L, t.tx, t.ty);
          res.tunnel = true;
          break;
        }
      }
    } else {
      b.vz -= GRAVITY * DT;
      b.z += b.vz * DT;
      if (b.z <= floor) {
        b.z = floor;
        if (b.vz < -2.5) {
          res.landed = Math.max(res.landed, -b.vz);
          b.vz = -b.vz * FLOOR_BOUNCE;
        } else {
          b.vz = 0;
        }
      }
      if (c.kind === 'water' && b.z < c.h - 0.22) {
        res.oob = true;
        res.splash = true;
        return res;
      }
    }

    b.x += b.vx * DT;
    b.y += b.vy * DT;
    hitProps(L, b, tick + s / SUBSTEPS, res);
    hitCells(L, b, res);

    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
      b.vx *= MAX_SPEED / speed;
      b.vy *= MAX_SPEED / speed;
    }
    if (b.z < KILL_Z) {
      res.oob = true;
      return res;
    }
  }

  res.boost = !startedOnTrack && cellAt(L, Math.floor(b.x), Math.floor(b.y)).surface === 'track';
  return res;
}

/** Cones and turnstile arms. */
function hitProps(L: Level, b: Ball, tick: number, res: StepResult): void {
  for (const c of L.cones) {
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d >= BALL_R + CONE_R || d < 1e-6) continue;
    if (Math.abs(b.z - topAt(L, c.x, c.y)) > 0.4) continue;
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
    if (Math.hypot(rx, ry) > ARM_LEN + ARM_R + BALL_R) continue;
    if (Math.abs(b.z - topAt(L, s.x, s.y)) > 0.35) continue;
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

/** Push the ball out of any cell that stands taller than it can roll over. */
function hitCells(L: Level, b: Ball, res: StepResult): void {
  const x0 = Math.floor(b.x - BALL_R);
  const x1 = Math.floor(b.x + BALL_R);
  const y0 = Math.floor(b.y - BALL_R);
  const y1 = Math.floor(b.y + BALL_R);

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const px = Math.min(cx + 1 - EDGE, Math.max(cx + EDGE, b.x));
      const py = Math.min(cy + 1 - EDGE, Math.max(cy + EDGE, b.y));
      if (topAt(L, px, py) <= b.z + STEP_UP) continue;

      let nx = b.x - px;
      let ny = b.y - py;
      const d2 = nx * nx + ny * ny;
      if (d2 >= BALL_R * BALL_R) continue;

      let push: number;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        nx /= d;
        ny /= d;
        push = BALL_R - d;
      } else {
        // Centre is inside the cell: leave by the nearest side.
        const l = b.x - cx;
        const r = cx + 1 - b.x;
        const t = b.y - cy;
        const bt = cy + 1 - b.y;
        const m = Math.min(l, r, t, bt);
        nx = m === l ? -1 : m === r ? 1 : 0;
        ny = nx !== 0 ? 0 : m === t ? -1 : 1;
        push = m + BALL_R;
      }
      b.x += nx * push;
      b.y += ny * push;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        // Split into the part going into the wall and the part sliding along it.
        const tx = b.vx - vn * nx;
        const ty = b.vy - vn * ny;
        b.vx = tx * WALL_GRIP - RESTITUTION * vn * nx;
        b.vy = ty * WALL_GRIP - RESTITUTION * vn * ny;
        note(res, -vn, cellAt(L, cx, cy).kind === 'block' ? 'board' : 'concrete');
      }
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
