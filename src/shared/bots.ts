import { BALL_R, LEVEL_H, MAX_PUTT, MIN_PUTT, SLOPE_ACCEL, STEP_UP } from './constants';
import { DIRS, Level, cellAt, topAt } from './level';
import { Ball, rollDistance } from './physics';

/** For every cell, the next cell on the shortest walk to the cup (-1 if none). */
export interface Nav {
  next: Int32Array;
}

export function buildNav(L: Level): Nav {
  const n = L.w * L.h;
  const reverse: number[][] = Array.from({ length: n }, () => []);
  const walkable = (cx: number, cy: number) => {
    const k = cellAt(L, cx, cy).kind;
    return k === 'floor' || k === 'ramp';
  };

  for (let cy = 0; cy < L.h; cy++) {
    for (let cx = 0; cx < L.w; cx++) {
      if (!walkable(cx, cy)) continue;
      const a = cy * L.w + cx;
      const cell = cellAt(L, cx, cy);
      for (const [dx, dy] of DIRS) {
        const bx = cx + dx;
        const by = cy + dy;
        if (walkable(bx, by)) {
          // Compare heights on both sides of the shared edge.
          const ex = cx + 0.5 + dx * 0.5;
          const ey = cy + 0.5 + dy * 0.5;
          const ha = topAt(L, ex - dx * 0.01, ey - dy * 0.01);
          const hb = topAt(L, ex + dx * 0.01, ey + dy * 0.01);
          if (hb <= ha + STEP_UP) reverse[by * L.w + bx].push(a);
        } else if (cell.surface === 'track' && DIRS[cell.dir][0] === dx && DIRS[cell.dir][1] === dy) {
          // Track that ends over nothing throws the ball across a short gap.
          for (let i = 2; i <= 4; i++) {
            const jx = cx + dx * i;
            const jy = cy + dy * i;
            if (walkable(jx, jy)) {
              if (cellAt(L, jx, jy).h <= cell.h) reverse[jy * L.w + jx].push(a);
              break;
            }
          }
        }
      }
    }
  }

  const next = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const start = Math.floor(L.cup.y) * L.w + Math.floor(L.cup.x);
  const queue = [start];
  seen[start] = 1;
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i];
    for (const a of reverse[b]) {
      if (seen[a]) continue;
      seen[a] = 1;
      next[a] = b;
      queue.push(a);
    }
  }
  return { next };
}

function clearLine(L: Level, x0: number, y0: number, x1: number, y1: number): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1e-6) return true;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  for (const side of [-BALL_R, 0, BALL_R]) {
    const ox = -uy * side;
    const oy = ux * side;
    let prev = topAt(L, x0 + ox, y0 + oy);
    if (prev === -Infinity) prev = topAt(L, x0, y0);
    for (let d = 0.08; d <= len; d += 0.08) {
      const top = topAt(L, x0 + ox + ux * d, y0 + oy + uy * d);
      if (top === -Infinity || top > prev + STEP_UP) return false;
      prev = top;
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
export function planPutt(L: Level, nav: Nav, ball: Ball, rand: () => number): { dx: number; dy: number } {
  const cupCell = Math.floor(L.cup.y) * L.w + Math.floor(L.cup.x);
  let cell = Math.floor(ball.y) * L.w + Math.floor(ball.x);
  let tx = L.cup.x;
  let ty = L.cup.y;
  let atCup = true;

  if (cell !== cupCell && cell >= 0 && cell < nav.next.length && nav.next[cell] !== -1) {
    let found = false;
    for (let i = 0; i < 16 && cell !== -1; i++) {
      cell = nav.next[cell];
      if (cell === -1) break;
      const isCup = cell === cupCell;
      const cx = isCup ? L.cup.x : (cell % L.w) + 0.5;
      const cy = isCup ? L.cup.y : Math.floor(cell / L.w) + 0.5;
      if (clearLine(L, ball.x, ball.y, cx, cy) || !found) {
        tx = cx;
        ty = cy;
        atCup = isCup;
        found = true;
      }
      if (isCup) break;
    }
  }

  const dist = Math.hypot(tx - ball.x, ty - ball.y);
  const climb = Math.max(0, topAt(L, tx, ty) - ball.z) / LEVEL_H;
  const flat = speedFor(atCup ? dist + 0.25 : dist * 1.15 + 0.3);
  let speed = Math.sqrt(flat * flat + 2 * SLOPE_ACCEL * climb);
  speed *= 1 + (rand() - 0.5) * 0.2;
  const angle = Math.atan2(ty - ball.y, tx - ball.x) + (rand() - 0.5) * 0.14;
  const power = Math.min(1, Math.max(0.03, (speed - MIN_PUTT) / (MAX_PUTT - MIN_PUTT)));
  return { dx: Math.cos(angle) * power, dy: Math.sin(angle) * power };
}
