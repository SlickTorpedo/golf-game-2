// Throwaway viewer for src/client/stadium.ts, set up like the game: neutral tone mapping, night
// fog, bloom. Drag to orbit. From the console: view(compassDeg, elevationDeg, distance).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Stadium } from '../src/client/stadium';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b1c);
scene.fog = new THREE.FogExp2(0x070b1c, 0.0045);

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 1500);
const TARGET = new THREE.Vector3(0, 4, 0);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);

const stadium = new Stadium(renderer);
scene.add(stadium.group);

// Stand-in for the course: a bright 20 x 12 deck on legs, 3.5 above the centre circle.
const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0x18c964 }));
deck.position.y = 3.25;
scene.add(deck);
for (const x of [-9.5, 0, 9.5]) {
  for (const z of [-5.5, 5.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 0.15), new THREE.MeshBasicMaterial({ color: 0x30343c }));
    leg.position.set(x, 1.5, z);
    scene.add(leg);
  }
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function view(compass: number, elevation: number, distance: number): void {
  const a = THREE.MathUtils.degToRad(compass);
  const e = THREE.MathUtils.degToRad(elevation);
  camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(distance).add(TARGET);
  controls.target.copy(TARGET);
  controls.update();
}
view(35, 18, 50);

/** Free camera for inspecting things the game camera never frames: eye and target points. */
function look(ex: number, ey: number, ez: number, tx: number, ty: number, tz: number): void {
  camera.position.set(ex, ey, ez);
  controls.target.set(tx, ty, tz);
  controls.update();
}

const info = document.getElementById('info')!;
const stats = { calls: 0, triangles: 0 };
const clock = new THREE.Clock();
let shown = 0;
function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  controls.update();
  stadium.update(dt, clock.elapsedTime);

  // Twice a second, count the scene on its own, without the bloom passes.
  if (clock.elapsedTime - shown > 0.5) {
    shown = clock.elapsedTime;
    renderer.info.reset();
    renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    info.textContent = `scene only: ${stats.calls} calls, ${stats.triangles} triangles (includes 7 stand-in boxes)`;
  }
  composer.render();
  requestAnimationFrame(frame);
}
frame();

Object.assign(window, { view, look, stats, camera, stadium, renderer, bloom, scene });
