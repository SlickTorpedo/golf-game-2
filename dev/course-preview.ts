// A page for looking at one hole without the game around it.
//
//   /dev/course.html?h=kickoff            by id (or by number: ?h=0)
//   /dev/course.html?h=kickoff&view=top   straight down (also: wide, low)
//   /dev/course.html?h=kickoff&route=1    show the bots' route as a row of balls
//   /dev/course.html?h=kickoff&yaw=90     turn the camera (degrees)
//
// Drag to look around, wheel to zoom.
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/800-italic.css';
import { ALL_HOLES } from '../src/shared/courses';
import { compileLevel } from '../src/shared/level';
import { PLAYER_COLORS, World } from '../src/client/world';

await Promise.all([
  document.fonts.load('italic 800 84px "Barlow Condensed"'),
  document.fonts.load('600 25px "Barlow Condensed"'),
]);
const q = new URLSearchParams(location.search);
const want = q.get('h') ?? '0';
const def = ALL_HOLES.find((d) => d.id === want) ?? ALL_HOLES[Number(want) || 0];
const L = compileLevel(def);
document.title = `${def.id} (par ${def.par})`;

const canvas = document.getElementById('view') as HTMLCanvasElement;
const world = new World(canvas);
world.setLevel(L);
world.mode = 'overview';
world.frameHole();
const view = q.get('view') ?? 'wide';
world.orbitBy(-(Number(q.get('yaw')) || 0) / 0.006 / 57.2958, 0);
// Pitch is set through the same drag the player uses: positive raises the camera.
world.orbitBy(0, view === 'top' ? 400 : view === 'low' ? -60 : 40);
Object.assign(window, { world, L });

let down = false;
canvas.onpointerdown = () => (down = true);
window.onpointerup = () => (down = false);
canvas.onpointermove = (e) => down && world.orbitBy(e.movementX, e.movementY);
canvas.onwheel = (e) => world.zoomBy(e.deltaY > 0 ? 1.1 : 0.9);

const balls = q.has('route')
  ? L.line.map((w, i) => ({ id: `w${i}`, color: PLAYER_COLORS[w.power === undefined ? 2 : 1], x: w.x, y: w.y, z: w.z, holed: false }))
  : [{ id: 'tee', color: PLAYER_COLORS[0], x: L.tee.x, y: L.tee.y, z: L.tee.z, holed: false }];

let last = performance.now();
let t = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  t += dt;
  world.syncBalls(balls, dt);
  world.syncPickups(L.spawns.map((s, i) => ({ id: i, x: s.x, y: s.y, z: s.z, kind: 'drum' as const, cooldown: 0 })));
  world.render(dt, t * 60, false);
}
requestAnimationFrame(frame);
