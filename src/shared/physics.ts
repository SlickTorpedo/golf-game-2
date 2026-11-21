import {
  BALL_R,
  BOOST_ACCEL,
  DRAG,
  GRAVITY,
  KILL_Z,
  MAX_SPEED,
  MUD_DECEL,
  RESTITUTION,
  ROLL_DECEL,
  SLOPE_ACCEL,
  STEP_UP,
  STOP_SPEED,
  SUBSTEPS,
  TICK_RATE,
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

export interface StepResult {
  /** The ball fell out of the world. */
  oob: boolean;
  /** Hardest wall hit this tick, as speed into the wall. 0 if none. */
  impact: number;
  /** Hardest landing this tick, as downward speed. 0 if none. */
  landed: number;
}

const DT = 1 / TICK_RATE / SUBSTEPS;
const GROUND_EPS = 0.02;
const EDGE = 1e-6;

export function isGrounded(L: Level, b: Ball): boolean {
  return b.z <= topAt(L, b.x, b.y) + GROUND_EPS;
}

export function isMoving(L: Level, b: Ball): boolean {
  return b.vx !== 0 || b.vy !== 0 || !isGrounded(L, b);
}

/** Advance one ball by one tick. Mutates the ball. */
export function stepBall(L: Level, b: Ball): StepResult {
  const res: StepResult = { oob: false, impact: 0, landed: 0 };

  for (let s = 0; s < SUBSTEPS; s++) {
    const floor = topAt(L, b.x, b.y);

    if (b.z <= floor + GROUND_EPS) {
      b.z = floor;
      b.vz = 0;
      const c = cellAt(L, Math.floor(b.x), Math.floor(b.y));
      let ax = 0;
      let ay = 0;
      if (c.kind === 'ramp') {
        ax -= DIRS[c.dir][0] * SLOPE_ACCEL;
        ay -= DIRS[c.dir][1] * SLOPE_ACCEL;
      } else if (c.surface === 'track') {
        ax += DIRS[c.dir][0] * BOOST_ACCEL;
        ay += DIRS[c.dir][1] * BOOST_ACCEL;
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        const decel = (c.surface === 'mud' ? MUD_DECEL : ROLL_DECEL) + DRAG * sp;
        const k = Math.max(0, sp - decel * DT) / sp;
        b.vx *= k;
        b.vy *= k;
      }
      b.vx += ax * DT;
      b.vy += ay * DT;
      const after = Math.hypot(b.vx, b.vy);
      if (ax === 0 && ay === 0 && after < STOP_SPEED) {
        b.vx = 0;
        b.vy = 0;
      } else if (after > MAX_SPEED) {
        b.vx *= MAX_SPEED / after;
        b.vy *= MAX_SPEED / after;
      }
    } else {
      b.vz -= GRAVITY * DT;
      b.z += b.vz * DT;
      if (b.z <= floor) {
        res.landed = Math.max(res.landed, -b.vz);
        b.z = floor;
        b.vz = 0;
      }
    }

    b.x += b.vx * DT;
    b.y += b.vy * DT;
    collide(L, b, res);

    if (b.z < KILL_Z) {
      res.oob = true;
      return res;
    }
  }
  return res;
}

/** Push the ball out of anything that stands taller than it can roll over. */
function collide(L: Level, b: Ball, res: StepResult): void {
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
        b.vx -= (1 + RESTITUTION) * vn * nx;
        b.vy -= (1 + RESTITUTION) * vn * ny;
        res.impact = Math.max(res.impact, -vn);
      }
    }
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
