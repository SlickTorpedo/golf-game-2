// Throwaway page for looking at one hole without the game around it: /dev/course.html?h=3
import '@fontsource/barlow-condensed/800-italic.css';
import { STADIUM } from '../src/shared/courses';
import { parseLevel } from '../src/shared/level';
import { PLAYER_COLORS, World } from '../src/client/world';

await document.fonts.load('italic 800 84px "Barlow Condensed"');
const q = new URLSearchParams(location.search);
const L = parseLevel(STADIUM[Number(q.get('h')) || 0]);
const canvas = document.getElementById('view') as HTMLCanvasElement;
const world = new World(canvas);
world.setLevel(L);
world.mode = 'overview';
world.frameHole();
Object.assign(window, { world, L });
let down = false;
canvas.onpointerdown = () => (down = true);
window.onpointerup = () => (down = false);
canvas.onpointermove = (e) => down && world.orbitBy(e.movementX, e.movementY);
let last = performance.now();
let t = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  t += dt;
  world.syncBalls(
    [
      { id: 'a', color: PLAYER_COLORS[0], x: L.tee.x, y: L.tee.y, z: 0, holed: false },
      { id: 'b', color: PLAYER_COLORS[1], x: L.tee.x + Math.sin(t) * 0.8, y: L.tee.y - 1, z: 0, holed: false },
    ].map((b) => ({ ...b, z: (window as any).topZ?.(b) ?? L.cells[Math.floor(b.y) * L.w + Math.floor(b.x)].h })),
    dt,
  );
  world.render(dt, t * 60, false);
}
requestAnimationFrame(frame);
