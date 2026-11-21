import { BALL_R, MAX_PUTT, MIN_PUTT, SLOPE_ACCEL, STEP_UP } from './constants';
import { Level, WALL_HALF, floorAt, hitTri } from './level';
import { Ball, rollDistance } from './physics';

// Bots follow the hole's route: the list of points its builder laid down from
// tee to cup. From wherever the ball is, a bot putts at the furthest route
// point it can reach in a straight roll.

/** Can a ball roll straight from one point to the other? */
function clearLine(L: Level, x0: number, y0: number, z0: number, x1: number, y1: number): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1e-6) return true;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  for (const side of [-BALL_R, 0, BALL_R]) {
    const ox = -uy * side;
    const oy = ux * side;
    let prev = z0;
    for (let d = 0.1; d <= len; d += 0.1) {
      const x = x0 + ox + ux * d;
      const y = y0 + oy + uy * d;
      const h = floorAt(L, x, y, prev + 0.2);
      // Water is ground as far as height goes, but nobody putts through a pond on purpose.
      if (!Number.isFinite(h) || Math.abs(h - prev) > 0.3 || hitTri?.mat === 'water') return false;
      prev = h;
      const col = Math.floor(x - L.minX);
      const row = Math.floor(y - L.minY);
      for (const i of L.colGrid[row * L.cols + col] ?? []) {
        const c = L.colliders[i];
        const ex = c.bx - c.ax;
        const ey = c.by - c.ay;
        const t = Math.max(0, Math.min(1, ((x - c.ax) * ex + (y - c.ay) * ey) / (ex * ex + ey * ey || 1)));
        const top = c.ta + (c.tb - c.ta) * t;
        const reach = WALL_HALF;
        if (Math.hypot(x - c.ax - ex * t, y - c.ay - ey * t) > reach) continue;
        if (c.kind === 'cliff' ? h + STEP_UP < top : h < top && h > top - 1) return false;
      }
    }
  }
  return true;
}

function speedFor(distance: number): number {
  let lo = MIN_PUTT;
  let hi = MAX_PUTT;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (rollDistance(mid) < distance) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Returns a putt vector whose length is the power, 0..1. */
export function planPutt(L: Level, ball: Ball, rand: () => number): { dx: number; dy: number } {
  const line = L.line;
  const last = line.length - 1;
  const dist = (k: number) => Math.hypot(line[k].x - ball.x, line[k].y - ball.y);

  // Where on the route is the ball? Prefer points on its own level.
  let near = 0;
  let best = Infinity;
  for (let k = 0; k <= last; k++) {
    const d = dist(k) + (Math.abs(line[k].z - ball.z) > 0.8 ? 100 : 0);
    if (d < best) {
      best = d;
      near = k;
    }
  }

  let target = Math.min(last, dist(near) < 0.7 ? near + 1 : near);
  let fixedPower: number | undefined;
  const leap = line[near + 1]?.power;
  if (leap !== undefined && dist(near) < 1.5) {
    // The next stretch is flown, not rolled: putt it as the designer said.
    target = near + 1;
    fixedPower = leap;
  } else {
    for (let k = target; k <= Math.min(last, near + 7); k++) {
      if (line[k].power !== undefined) break;
      if (clearLine(L, ball.x, ball.y, ball.z, line[k].x, line[k].y)) target = k;
    }
  }

  const t = line[target];
  const atCup = target === last;
  const d = Math.hypot(t.x - ball.x, t.y - ball.y);
  let power: number;
  if (fixedPower !== undefined) {
    power = fixedPower * (1 + (rand() - 0.5) * 0.08);
  } else {
    const flat = speedFor(atCup ? d + 0.25 : d * 1.12 + 0.3);
    // A climb needs more speed. A drop gives none back: most are steps, not slopes.
    const climb = Math.max(0, t.z - ball.z);
    const need = flat * flat + 2 * SLOPE_ACCEL * climb;
    const speed = Math.sqrt(need) * (1 + (rand() - 0.5) * 0.2);
    power = (speed - MIN_PUTT) / (MAX_PUTT - MIN_PUTT);
  }
  power = Math.min(1, Math.max(0.03, power));
  const angle = Math.atan2(t.y - ball.y, t.x - ball.x) + (rand() - 0.5) * 0.12;
  return { dx: Math.cos(angle) * power, dy: Math.sin(angle) * power };
}
