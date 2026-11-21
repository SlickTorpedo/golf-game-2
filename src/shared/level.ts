import { LEVEL_H, WALL_H } from './constants';

/**
 * A hole is drawn as two text grids of the same size.
 *
 * tiles:
 *   ' ' nothing (the ball falls)      '.' turf
 *   '#' advertising board (a wall)    'm' mud, slows the ball
 *   'T' tee                           'O' cup
 *   '*' a leftover to pick up         '~' water (ball is lost, one putt penalty)
 *   'c' traffic cone, kicks the ball  '+' turnstile, four arms that sweep round
 *   '>' '<' '^' 'v' running track that pushes the ball that way
 *   'N' 'E' 'S' 'W' ramp that rises one level toward that side
 *   'A' 'B' players' tunnel mouth; the ball comes out at the matching 'a' 'b'
 *
 * heights: one digit per cell, the terrace level the cell stands on.
 * A ramp's digit is its low end. Missing rows or blanks mean level 0.
 */
export interface HoleDef {
  id: string;
  name: string;
  par: number;
  tiles: string[];
  heights?: string[];
  /** Two colours for the boards of this hole. */
  boards: [number, number];
}

export type CellKind = 'void' | 'floor' | 'block' | 'ramp' | 'water';
export type Surface = 'turf' | 'mud' | 'track';

export interface Cell {
  kind: CellKind;
  /** World height of the floor (low end for a ramp, base for a board, surface for water). */
  h: number;
  surface: Surface;
  /** Direction index into DIRS for ramps (rises toward) and track (pushes toward). */
  dir: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Level {
  def: HoleDef;
  w: number;
  h: number;
  cells: Cell[];
  tee: Point;
  cup: Point;
  spawns: Point[];
  cones: Point[];
  /** Turnstiles. dir is +1 or -1, the way it turns. */
  spinners: (Point & { dir: number })[];
  /** Tunnel mouths with the point the ball comes out at. */
  tunnels: (Point & { tx: number; ty: number })[];
}

/** N, E, S, W as map steps. Map y grows to the south. */
export const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const RAMPS = 'NESW';
const TRACK = '^>v<';
const VOID: Cell = { kind: 'void', h: 0, surface: 'turf', dir: -1 };

export function parseLevel(def: HoleDef): Level {
  const h = def.tiles.length;
  const w = Math.max(...def.tiles.map((r) => r.length));
  const cells: Cell[] = [];
  const spawns: Point[] = [];
  const cones: Point[] = [];
  const spinners: Level['spinners'] = [];
  const mouths = new Map<string, Point>();
  let tee: Point | null = null;
  let cup: Point | null = null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = def.tiles[y][x] ?? ' ';
      const digit = def.heights?.[y]?.[x] ?? '0';
      const base = (digit === ' ' ? 0 : Number(digit)) * LEVEL_H;
      if (Number.isNaN(base)) throw new Error(`${def.id}: bad height '${digit}' at ${x},${y}`);
      const centre = { x: x + 0.5, y: y + 0.5 };
      let cell: Cell;
      if (ch === ' ') cell = VOID;
      else if (ch === '#') cell = { kind: 'block', h: base, surface: 'turf', dir: -1 };
      else if (ch === '~') cell = { kind: 'water', h: base, surface: 'turf', dir: -1 };
      else if (RAMPS.includes(ch)) cell = { kind: 'ramp', h: base, surface: 'turf', dir: RAMPS.indexOf(ch) };
      else if (TRACK.includes(ch)) cell = { kind: 'floor', h: base, surface: 'track', dir: TRACK.indexOf(ch) };
      else if (ch === 'm') cell = { kind: 'floor', h: base, surface: 'mud', dir: -1 };
      else if ('.TO*c+AaBb'.includes(ch)) {
        cell = { kind: 'floor', h: base, surface: 'turf', dir: -1 };
        if (ch === 'T') tee = centre;
        else if (ch === 'O') cup = centre;
        else if (ch === '*') spawns.push(centre);
        else if (ch === 'c') cones.push(centre);
        else if (ch === '+') spinners.push({ ...centre, dir: spinners.length % 2 ? -1 : 1 });
        else if ('AaBb'.includes(ch)) mouths.set(ch, centre);
      } else throw new Error(`${def.id}: unknown tile '${ch}' at ${x},${y}`);
      cells.push(cell);
    }
  }
  if (!tee || !cup) throw new Error(`${def.id}: needs one T and one O`);

  const tunnels: Level['tunnels'] = [];
  for (const letter of 'AB') {
    const from = mouths.get(letter);
    const to = mouths.get(letter.toLowerCase());
    if (!from !== !to) throw new Error(`${def.id}: tunnel ${letter} needs both ends`);
    if (from && to) tunnels.push({ ...from, tx: to.x, ty: to.y });
  }
  return { def, w, h, cells, tee, cup, spawns, cones, spinners, tunnels };
}

export function cellAt(L: Level, cx: number, cy: number): Cell {
  if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return VOID;
  return L.cells[cy * L.w + cx];
}

/** Height of whatever a ball would stand on at this point. -Infinity over nothing or water. */
export function topAt(L: Level, x: number, y: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const c = cellAt(L, cx, cy);
  switch (c.kind) {
    case 'void':
    case 'water':
      return -Infinity;
    case 'floor':
      return c.h;
    case 'block':
      return c.h + WALL_H;
    case 'ramp': {
      const fx = x - cx;
      const fy = y - cy;
      const t = c.dir === 0 ? 1 - fy : c.dir === 1 ? fx : c.dir === 2 ? fy : 1 - fx;
      return c.h + Math.min(1, Math.max(0, t)) * LEVEL_H;
    }
  }
}

/** Heights of a cell's four corners: nw, ne, se, sw. Boards report their base. */
export function cornerHeights(c: Cell): [number, number, number, number] {
  if (c.kind !== 'ramp') return [c.h, c.h, c.h, c.h];
  const lo = c.h;
  const hi = c.h + LEVEL_H;
  if (c.dir === 0) return [hi, hi, lo, lo];
  if (c.dir === 1) return [lo, hi, hi, lo];
  if (c.dir === 2) return [lo, lo, hi, hi];
  return [hi, lo, lo, hi];
}
