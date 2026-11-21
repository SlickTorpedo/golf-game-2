import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import './styles.css';

import { createLocalPair } from '../net/channel';
import { cleanCode, hostRoom, joinRoom, newCode } from '../net/peer';
import { Room } from '../server/room';
import { JITTER_SCALE, MAX_PUTT, MIN_PUTT, SWAY_ANGLE, SWAY_SECONDS, TICK_RATE, penaltyScore, strokeCap } from '../shared/constants';
import { COURSES } from '../shared/courses';
import { compileLevel, floorAt, hitTri } from '../shared/level';
import type { Level } from '../shared/level';
import { total } from '../shared/match';
import { stepBall } from '../shared/physics';
import type { ClientMsg, GameEvent, ItemKind, MatchState, PlayerState, ServerMsg } from '../shared/protocol';
import { Sound } from './audio';
import type { Scene, Surface } from './audio';
import { GameClient } from './client';
import { Stadium } from './stadium';
import { ITEM_COLORS, PLAYER_COLORS, World } from './world';
import type { View } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const ITEM_TEXT: Record<ItemKind, [string, string]> = {
  drum: ['Bass drum', 'throws nearby balls outward'],
  sandal: ['Flip-flop', 'stops your rolling ball dead'],
  swap: ['Swap', 'trade places with the ball nearest the cup'],
  peanuts: ['Peanuts', 'take your last putt back'],
  steady: ['Iced tea', 'no sway on your next two putts'],
  magnet: ['Lucky scarf', 'the cup pulls this putt in'],
  horn: ['Air horn', "everyone else's next aim goes wild"],
};

// ------------------------------------------------------------------ setup
//
// Single player still goes through the whole multiplayer path: a Room owns
// the match, and this tab talks to it over a Channel. Today both ends are in
// this page. ?lag=150 adds a fake round trip to feel what a real link does.

const params = new URLSearchParams(location.search);
const lag = Number(params.get('lag')) || 0;
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

// The boards are painted with this face, so it has to be there before the first texture.
await Promise.all([
  document.fonts.load('italic 800 84px "Barlow Condensed"'),
  document.fonts.load('800 40px "Barlow Condensed"'),
]).catch(() => undefined);

const room = new Room(COURSES, (Math.random() * 2 ** 32) >>> 0);
const [clientEnd, serverEnd] = createLocalPair<ClientMsg, ServerMsg>(lag / 2);
room.connect(serverEnd);
let client = new GameClient(clientEnd, store.get('name') ?? '');
/** solo: the room is in this tab and nobody else is in it. host: friends connect to this tab. guest: the room is in a friend's tab. */
let online: 'solo' | 'host' | 'guest' = 'solo';

// Courses are compiled the first time they are played.
const compiled = new Map<string, Level[]>();
let levels: Level[] = [];
function useCourse(id: string): void {
  const course = COURSES.find((c) => c.id === id) ?? COURSES[0];
  if (!compiled.has(course.id)) compiled.set(course.id, course.holes.map(compileLevel));
  levels = compiled.get(course.id)!;
}
useCourse(COURSES[0].id);
const world = new World($<HTMLCanvasElement>('view'));
world.setBackdrop(new Stadium(world.renderer));
const sound = new Sound();
sound.setMusic(store.get('music') !== '0');
sound.setSfx(store.get('sfx') !== '0');

let shownHole = -1;
let shownCourse = '';
let framedHole = -1;
let framedPlay = -1;
let wasLobby = true;
let hasPutted = false;
let toastUntil = 0;
let lockUntil = 0;
let lastTickSecond = -1;
let scene: Scene | null = null;

// ---------------------------------------------------------- title screen

let botCount = Number(store.get('bots') ?? 3);
const botLabels = ['Nobody', 'Slamet', '+ Rini', '+ Dimas'];
const botsEl = $('bots');
botLabels.forEach((label, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.onclick = () => {
    botCount = i;
    sound.ui('toggle');
    drawBots();
  };
  botsEl.append(b);
});
function drawBots(): void {
  [...botsEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === botCount || (i > 0 && i < botCount))));
}
drawBots();

let courseId = COURSES.some((c) => c.id === store.get('course')) ? store.get('course')! : COURSES[0].id;
const coursesEl = $('courses');
for (const c of COURSES) {
  const b = document.createElement('button');
  b.type = 'button';
  const par = c.holes.reduce((n, h) => n + h.par, 0);
  b.append(el('b', c.name), el('small', `${c.holes.length} holes · par ${par} · ${c.blurb}`));
  b.onclick = () => {
    courseId = c.id;
    sound.ui('toggle');
    drawCourses();
  };
  coursesEl.append(b);
}
function drawCourses(): void {
  [...coursesEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(COURSES[i].id === courseId)));
}
drawCourses();

const nameEl = $<HTMLInputElement>('name');
nameEl.value = store.get('name') ?? '';
nameEl.placeholder = 'Player';

function kickOff(): void {
  if (!client.host) return;
  sound.unlock();
  sound.ui('click');
  store.set('name', nameEl.value);
  store.set('bots', String(botCount));
  store.set('course', courseId);
  client.send({ t: 'start', name: nameEl.value, bots: botCount, course: courseId });
}
$('start').addEventListener('submit', (e) => {
  e.preventDefault();
  kickOff();
});

// ------------------------------------------------------------ with friends
//
// Host: this tab keeps running the room and friends' tabs connect to it.
// Guest: this tab drops its own room and talks to the host's instead.

const netNote = $('netNote');
function say(text: string, code = ''): void {
  netNote.hidden = false;
  netNote.replaceChildren(text, ...(code ? [el('b', ` ${code}`)] : []));
}

async function host(): Promise<void> {
  if (online !== 'solo') return;
  sound.ui('click');
  say('Opening a room…');
  const code = newCode();
  try {
    await hostRoom(code, (ch) => room.connect(ch));
  } catch (err) {
    return say((err as Error).message);
  }
  online = 'host';
  // A worker's timer keeps time even when this tab is in the background.
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })));
  let before = performance.now();
  ticker.onmessage = () => {
    const t = performance.now();
    room.advance(t - before);
    before = t;
  };
  const link = `${location.origin}${location.pathname}?join=${code}`;
  say('Room open. Friends join with code', code);
  const copy = el('button', 'Copy link');
  copy.type = 'button';
  copy.onclick = () => navigator.clipboard?.writeText(link).then(() => (copy.textContent = 'Copied'));
  $('netBox').replaceChildren(copy);
}

async function join(raw: string): Promise<void> {
  const code = cleanCode(raw);
  if (online !== 'solo' || code.length < 5) return;
  sound.unlock();
  sound.ui('click');
  store.set('name', nameEl.value);
  say('Joining…');
  let ch;
  try {
    ch = await joinRoom(code);
  } catch (err) {
    return say((err as Error).message);
  }
  online = 'guest';
  client = new GameClient(ch, nameEl.value);
  client.onEvents = onEvents;
  client.onClosed = () => {
    say('The host has left. Reload to play on your own.');
    toast('Host has left', true);
  };
  shownHole = -1;
  say('You are in room', code);
  $('netBox').replaceChildren();
  for (const id of ['fsCourse', 'fsBots']) $(id).hidden = true;
  nameEl.disabled = true;
}

$('hostBtn').onclick = () => void host();
$('joinBtn').onclick = () => void join($<HTMLInputElement>('joinCode').value);
// A link from the host carries the code: fill it in so one press joins.
if (params.get('join')) $<HTMLInputElement>('joinCode').value = cleanCode(params.get('join')!);

/** Who is in the room, and what the big button does for you. */
function drawLobby(s: MatchState): void {
  once('roster', `${online}${s.players.map((p) => p.id + p.name).join('|')}`, () => {
    const people = s.players.filter((p) => !p.bot);
    $('roster').replaceChildren(
      ...(online === 'solo'
        ? []
        : people.map((p) => {
            const li = el('li', p.id === client.you ? `${p.name} (you)` : p.name);
            li.style.setProperty('--c', css(PLAYER_COLORS[p.color]));
            return li;
          })),
    );
  });
  once('kick', `${online}${client.host}`, () => {
    const b = $<HTMLButtonElement>('kickBtn');
    b.disabled = !client.host;
    b.textContent = client.host ? 'Kick off' : 'Waiting for the host';
  });
}
// Browsers only let sound start after a click or a key press.
window.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
window.addEventListener('keydown', () => sound.unlock(), { capture: true });

// ------------------------------------------------------------------ input
//
// Left button (or one finger): pull back and let go to putt. The pull is read
// on the screen, not on the ground, so it feels the same from any camera.
// Right button (or two fingers): look around. Wheel or pinch: zoom.

const canvas = world.renderer.domElement;
const pointers = new Map<number, { x: number; y: number }>();
let aim: { id: number; sx: number; sy: number; dx: number; dy: number; power: number; t0: number } | null = null;

/**
 * Where the putt would go if released this instant. The aim swings slowly from side to
 * side, so lining up is a matter of timing; iced tea stills it and an air horn widens it.
 */
function swayed(now: number): { dx: number; dy: number } {
  if (!aim) return { dx: 0, dy: 0 };
  const me = client.me;
  const reach = me && me.steady > 0 ? 0 : SWAY_ANGLE * (me && me.jitters > 0 ? JITTER_SCALE : 1);
  const a = reach * Math.sin(((now - aim.t0) / 1000 / SWAY_SECONDS) * Math.PI * 2);
  return { dx: aim.dx * Math.cos(a) - aim.dy * Math.sin(a), dy: aim.dx * Math.sin(a) + aim.dy * Math.cos(a) };
}
let orbitId = -1;
let pinch = 0;
let lastOrbit = -1e9;
let wasMoving = false;

function canPutt(): boolean {
  const s = client.state;
  const me = client.me;
  if (!s || !me || s.phase !== 'playing' || me.done || me.moving || performance.now() < lockUntil) return false;
  return me.strokes < strokeCap(levels[s.hole].def.par);
}

canvas.addEventListener('pointerdown', (e) => {
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* the pointer is already gone */
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    // Second finger down: this is a look-around gesture, not a putt.
    aim = null;
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a.x - b.x, a.y - b.y);
  } else if (e.button === 2 || e.button === 1) {
    orbitId = e.pointerId;
  } else if (e.button === 0 && canPutt()) {
    aim = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, power: 0, t0: performance.now() };
  }
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const mx = e.clientX - prev.x;
  const my = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const span = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch > 0 && span > 0) world.zoomBy(pinch / span);
    pinch = span;
    world.orbitBy(mx / 2, my / 2);
    return;
  }
  if (e.pointerId === orbitId) {
    world.orbitBy(mx, my);
    lastOrbit = performance.now();
    return;
  }
  if (!aim || aim.id !== e.pointerId) return;
  // Pull back like a slingshot: the ball goes the opposite way.
  const px = e.clientX - aim.sx;
  const py = e.clientY - aim.sy;
  const len = Math.hypot(px, py);
  const full = Math.min(window.innerWidth, window.innerHeight) * 0.32;
  aim.power = Math.min(1, len / full);
  const box = $('power');
  box.style.left = `${Math.min(window.innerWidth - 170, e.clientX)}px`;
  box.style.top = `${Math.min(window.innerHeight - 90, e.clientY)}px`;
  if (len > 3) {
    const d = world.aimDir(px, py);
    aim.dx = d.x;
    aim.dy = d.y;
  }
});

function release(e: PointerEvent, fire: boolean): void {
  pointers.delete(e.pointerId);
  if (e.pointerId === orbitId) orbitId = -1;
  if (!aim || aim.id !== e.pointerId) return;
  if (fire && aim.power > 0.04 && canPutt()) {
    const d = swayed(performance.now());
    client.send({ t: 'putt', dx: d.dx * aim.power, dy: d.dy * aim.power });
    lockUntil = performance.now() + 300 + lag;
    hasPutted = true;
  }
  aim = null;
}
canvas.addEventListener('pointerup', (e) => release(e, true));
canvas.addEventListener('pointercancel', (e) => release(e, false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    world.zoomBy(e.deltaY > 0 ? 1.1 : 0.9);
  },
  { passive: false },
);

window.addEventListener('keydown', (e) => {
  if (e.target === nameEl) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === '2') client.send({ t: 'item', slot: Number(k) - 1 });
  else if (k === 'escape') aim = null;
  else if (k === 'r') client.send({ t: 'reset' });
  else if (k === 'c') setView(VIEWS[(VIEWS.indexOf(world.view) + 1) % VIEWS.length]);
  else if (k === 'enter' || k === ' ') cardAction();
});

const VIEWS: View[] = ['follow', 'wide', 'top'];
function setView(v: View): void {
  world.setView(v);
  store.set('view', v);
  sound.ui('toggle');
  document.querySelectorAll<HTMLElement>('#views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
}
document.querySelectorAll<HTMLElement>('#views button').forEach((b) => (b.onclick = () => setView(b.dataset.view as View)));
const savedView = store.get('view') as View | null;
world.setView(savedView && VIEWS.includes(savedView) ? savedView : 'follow');
document.querySelectorAll<HTMLElement>('#views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === world.view)));

$('reset').onclick = () => client.send({ t: 'reset' });

const musicEl = $('music');
const sfxEl = $('sfx');
function drawSound(): void {
  musicEl.textContent = sound.musicOn ? 'Music on' : 'Music off';
  sfxEl.textContent = sound.sfxOn ? 'Sound on' : 'Sound off';
}
musicEl.onclick = () => {
  sound.setMusic(!sound.musicOn);
  store.set('music', sound.musicOn ? '1' : '0');
  sound.ui('toggle');
  drawSound();
};
sfxEl.onclick = () => {
  sound.setSfx(!sound.sfxOn);
  store.set('sfx', sound.sfxOn ? '1' : '0');
  sound.ui('toggle');
  drawSound();
};
drawSound();

function cardAction(): void {
  const s = client.state;
  if (s?.phase === 'holeEnd') {
    sound.ui('click');
    client.send({ t: 'ready' });
  } else if (s?.phase === 'final') kickOff();
}
$('cardBtn').onclick = cardAction;
document.querySelectorAll('button').forEach((b) => b.addEventListener('pointerenter', () => sound.ui('hover')));

// ----------------------------------------------------------------- events

function toast(text: string, bad = false): void {
  const el = $('toast');
  el.textContent = text;
  el.className = bad ? 'on bad' : 'on';
  toastUntil = performance.now() + 1700;
}

/** What not holing out costs on a hole of this par. */
const penalty = penaltyScore;

function verdict(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one';
  const d = strokes - par;
  return d <= -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : `In for ${strokes}`;
}

const onEvents = (events: GameEvent[], s: MatchState): void => {
  const L = levels[s.hole];
  const now = performance.now();
  for (const e of events) {
    if (e.t === 'phase') {
      if (e.phase === 'playing') sound.whistle('start');
      else if (e.phase === 'holeEnd') sound.whistle('end');
      else if (e.phase === 'final') sound.whistle('full');
      continue;
    }
    const mine = e.p === client.you;
    const who = s.players.find((p) => p.id === e.p);
    const color = who ? PLAYER_COLORS[who.color] : 0xffffff;
    const at = client.ballAt(e.p, now) ?? who?.ball ?? { x: 0, y: 0, z: 0 };
    // Other people's balls are quieter than your own.
    const gain = mine ? 1 : 0.35;

    if (e.t === 'putt') {
      sound.putt(e.power, gain);
      const b = who?.ball;
      const sp = b ? Math.hypot(b.vx, b.vy) || 1 : 1;
      world.puttFx(at.x, at.y, at.z, b ? b.vx / sp : 0, b ? b.vy / sp : 0, e.power);
      if (mine) world.shake(0.03 + e.power * 0.1);
    } else if (e.t === 'bounce') {
      sound.bounce(e.v, e.m, gain);
      world.bounceFx(e.x, e.y, at.z, e.v, e.m, L.def.boards[0]);
      world.squash(e.p, Math.min(1, e.v / 8));
      if (mine && e.v > 5) world.shake(Math.min(0.14, e.v * 0.012));
    } else if (e.t === 'land') {
      sound.land(e.v, gain);
      world.landFx(at.x, at.y, at.z, e.v);
      world.squash(e.p, Math.min(1, e.v / 7));
    } else if (e.t === 'holed') {
      sound.cupDrop(gain);
      world.holedFx(color);
      if (mine) {
        sound.holed(e.strokes - L.def.par, e.strokes === 1);
        if (e.strokes <= L.def.par) sound.cheer(e.strokes === 1 ? 1 : e.strokes < L.def.par ? 0.7 : 0.35);
        toast(verdict(e.strokes, L.def.par));
      }
    } else if (e.t === 'out') {
      if (e.water) {
        sound.splash(gain);
        world.splashFx(e.x, e.y, e.z + 0.2);
      } else {
        sound.out(gain);
        world.landFx(e.x, e.y, e.z, 8);
      }
      if (mine) toast(e.water ? 'In the water +1' : 'Off the edge +1', true);
    } else if (e.t === 'tunnel') {
      sound.tunnel(gain);
      world.sparkleFx(e.x, e.y, at.z, 0x2ee6ff);
      world.sparkleFx(at.x, at.y, at.z, 0xff7a1a);
    } else if (e.t === 'boost') {
      sound.boost(gain);
    } else if (e.t === 'hop') {
      sound.land(4, gain);
      world.squash(e.p, 0.6);
    } else if (e.t === 'spring') {
      sound.boost(gain);
      sound.land(7, gain);
      world.springFx(e.x, e.y, at.z);
    } else if (e.t === 'pickup') {
      if (mine) sound.pickup();
      world.sparkleFx(at.x, at.y, at.z, ITEM_COLORS[e.kind]);
    } else if (e.t === 'item') {
      // The newer leftovers borrow the nearest existing sound until they get their own.
      if (e.kind === 'horn') sound.whistle('end');
      sound.item(e.kind === 'horn' ? 'sandal' : e.kind === 'steady' ? 'peanuts' : e.kind === 'magnet' ? 'swap' : e.kind, mine ? 1 : 0.7);
      const floor = at.z;
      world.pulse(e.x, e.y, floor, ITEM_COLORS[e.kind], e.kind === 'drum' ? 3.4 : 1.2);
      world.sparkleFx(e.x, e.y, floor, ITEM_COLORS[e.kind], e.kind === 'drum' ? 60 : 24);
      if (e.kind === 'drum') world.shake(0.3);
      if (!mine && who) toast(`${who.name}: ${ITEM_TEXT[e.kind][0]}`, true);
    }
  }
};
client.onEvents = onEvents;

// -------------------------------------------------------------------- HUD

/** Only touch the DOM when what it shows has changed. */
const drawn = new Map<string, string>();
function once(key: string, signature: string, draw: () => void): void {
  if (drawn.get(key) === signature) return;
  drawn.set(key, signature);
  draw();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function ranked(s: MatchState): PlayerState[] {
  return [...s.players].sort((a, b) => total(a) - total(b) || a.strokes - b.strokes);
}

function drawHud(s: MatchState, me: PlayerState | undefined): void {
  const L = levels[s.hole];
  once('tag', `${s.hole}`, () => {
    $('holeNo').textContent = String(s.hole + 1).padStart(2, '0');
    $('holeName').textContent = L.def.name;
    $('holePar').textContent = `par ${L.def.par} · hole ${s.hole + 1} of ${s.holeCount}`;
  });

  once('strokes', `${me?.strokes}`, () => {
    const n = $('strokeNum');
    n.textContent = String(me?.strokes ?? 0);
    n.classList.toggle('over', (me?.strokes ?? 0) > L.def.par);
  });

  const secs = s.phase === 'playing' ? Math.ceil(s.timer / TICK_RATE) : -1;
  once('clock', `${secs}`, () => {
    const c = $('clock');
    c.textContent = secs < 0 ? '' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    c.classList.toggle('late', secs >= 0 && secs <= 10);
  });
  if (secs >= 0 && secs <= 10 && secs !== lastTickSecond && me && !me.done) sound.tick(secs);
  lastTickSecond = secs;

  const rows = ranked(s);
  once('board', rows.map((p) => `${p.id}${p.name}${p.strokes}${p.done}${p.holed}${total(p)}`).join('|'), () => {
    const head = el('li', '', 'head');
    head.append(el('i'), el('span', 'after the match'), el('b', 'hole'), el('em', 'total'));
    const items = rows.map((p) => {
      const li = el('li', '', p.id === client.you ? 'me' : '');
      li.style.setProperty('--c', css(PLAYER_COLORS[p.color]));
      const now = p.done ? (p.holed ? `${p.strokes}` : 'out') : `${p.strokes}`;
      li.append(el('i'), el('span', p.name), el('b', now), el('em', String(total(p))));
      return li;
    });
    $('board').replaceChildren(head, ...items);
  });

  once('items', `${me?.items.join()}|${s.phase}`, () => {
    const box = $('items');
    box.replaceChildren();
    if (!me || s.phase !== 'playing' || !levels[s.hole].spawns.length) return;
    if (!me.items.length) box.append(el('div', 'Roll over something the crowd left to pick it up.', 'empty'));
    for (let i = 0; i < me.items.length; i++) {
      const kind = me.items[i];
      const b = el('button');
      b.style.setProperty('--c', css(ITEM_COLORS[kind]));
      b.append(el('b', `${i + 1} · ${ITEM_TEXT[kind][0]}`), el('small', ITEM_TEXT[kind][1]));
      b.onclick = () => client.send({ t: 'item', slot: i });
      box.append(b);
    }
  });

  const pct = aim ? Math.round(aim.power * 100) : -1;
  once('power', `${pct}`, () => {
    const box = $('power');
    box.hidden = pct < 0;
    box.style.setProperty('--p', `${Math.max(0, pct)}%`);
    box.classList.toggle('full', pct >= 85);
    $('powerNum').textContent = `${Math.max(0, pct)}`;
  });

  $('hint').hidden = hasPutted || s.phase !== 'playing';
  // Offered once there is somewhere to go back to.
  $('reset').hidden = !me || me.done || me.strokes < 1 || s.phase !== 'playing';
  if (performance.now() > toastUntil) $('toast').classList.remove('on');
}

function drawCard(s: MatchState): void {
  const final = s.phase === 'final';
  const L = levels[s.hole];
  const rows = ranked(s);
  const secs = Math.ceil(s.timer / TICK_RATE);
  const me = client.me;

  once('cardBtn', `${s.phase}${secs}${me?.ready}`, () => {
    $('cardBtn').textContent = final ? (client.host ? 'Play again' : 'Waiting for the host') : me?.ready ? `Waiting ${secs}` : `Next hole ${secs}`;
  });

  once('card', `${s.phase}${s.hole}${rows.map((p) => p.id + p.scores.join()).join('|')}`, () => {
    $('cardTitle').textContent = final ? 'Full time' : L.def.name;
    const mine = me?.scores[s.hole];
    $('cardNote').textContent = final
      ? `${rows[0].name} wins with ${total(rows[0])}`
      : mine == null
        ? ''
        : mine >= penalty(L.def.par)
          ? `Not holed: ${mine} on the card`
          : `${verdict(mine, L.def.par)} · ${mine} on a par ${L.def.par}`;

    const head = el('tr');
    head.append(el('th', 'hole · par'));
    levels.forEach((lv, i) => head.append(el('th', `${i + 1}·${lv.def.par}`)));
    head.append(el('th', 'Total'));
    const body = rows.map((p) => {
      const tr = el('tr', '', p.id === client.you ? 'me' : '');
      const name = el('td', p.name);
      name.style.setProperty('--c', css(PLAYER_COLORS[p.color]));
      tr.append(name);
      levels.forEach((lv, i) => {
        const sc = p.scores[i];
        const cls = sc == null ? '' : sc >= penalty(lv.def.par) ? 'fail' : sc < lv.def.par ? 'under' : '';
        tr.append(el('td', sc == null ? '' : String(sc), cls));
      });
      tr.append(el('td', String(total(p))));
      return tr;
    });
    $('cardTable').replaceChildren(head, ...body);
    $('cardAwards').replaceChildren(...(final ? awards(s) : []));
    sound.scoreCount();
  });
}

/** Titles handed out at full time. They are for fun and do not change the score. */
function awards(s: MatchState): HTMLLIElement[] {
  const kinds: [keyof PlayerState['stats'], string, string][] = [
    ['aces', 'One and done', 'holes in one'],
    ['hits', 'Pinball wizard', 'things hit'],
    ['air', 'Frequent flyer', 'time in the air'],
    ['falls', "Gravity's friend", 'balls lost'],
    ['items', 'Menace', 'leftovers used'],
  ];
  const out: HTMLLIElement[] = [];
  for (const [key, title, what] of kinds) {
    const best = [...s.players].sort((a, b) => b.stats[key] - a.stats[key])[0];
    if (!best || best.stats[key] <= 0 || out.length >= 3) continue;
    const li = el('li');
    li.style.setProperty('--c', css(PLAYER_COLORS[best.color]));
    li.append(el('b', title), el('span', `${best.name} · most ${what}`));
    out.push(li);
  }
  return out;
}

const tags = new Map<string, HTMLSpanElement>();
function drawTags(s: MatchState, now: number, show: boolean): void {
  const live = new Set<string>();
  if (show) {
    // Balls stacked on one spot (everyone on the tee) get one tag, not a pile.
    const taken = s.players.filter((p) => p.id === client.you).map((p) => p.ball);
    for (const p of s.players) {
      if (p.id === client.you || p.done) continue;
      const at = client.ballAt(p.id, now);
      if (!at || taken.some((t) => Math.hypot(t.x - at.x, t.y - at.y) < 0.35)) continue;
      taken.push(p.ball);
      live.add(p.id);
      let tag = tags.get(p.id);
      if (!tag) {
        tag = el('span', p.name);
        tag.style.color = css(PLAYER_COLORS[p.color]);
        $('labels').append(tag);
        tags.set(p.id, tag);
      }
      const scr = world.project(at.x, at.y, at.z + 0.6);
      tag.style.left = `${scr.x}px`;
      tag.style.top = `${scr.y}px`;
    }
  }
  for (const [id, tag] of tags) {
    if (live.has(id)) continue;
    tag.remove();
    tags.delete(id);
  }
}

/**
 * The first half second of the putt as the game would play it, using the same
 * physics as the room, so the line bends off boards and up ramps truthfully.
 */
function previewPath(s: MatchState, me: PlayerState, dx: number, dy: number, power: number) {
  const L = levels[s.hole];
  const speed = MIN_PUTT + (MAX_PUTT - MIN_PUTT) * power;
  const b = { ...me.ball, vx: dx * speed, vy: dy * speed, vz: 0, wx: 0, wy: 0 };
  const path = [{ x: b.x, y: b.y, z: b.z }];
  const ticks = Math.round(8 + power * 26);
  for (let i = 0; i < ticks; i++) {
    const r = stepBall(L, b, s.tick + i);
    if (r.oob || r.holed || r.tunnel) break;
    path.push({ x: b.x, y: b.y, z: b.z });
    if (b.vx === 0 && b.vy === 0) break;
  }
  return path;
}

// ------------------------------------------------------------------- loop

let last = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // This tab is also the host, so it drives the room's clock.
  // (When friends are connected a background timer does it instead, so the game does not
  // stall for everyone when the host looks at another tab.)
  if (online === 'solo') room.advance(dt * 1000);

  const s = client.state;
  if (!s) return world.render(dt, 0, false);

  if (s.hole !== shownHole || s.course !== shownCourse) {
    shownHole = s.hole;
    shownCourse = s.course;
    useCourse(s.course);
    framedHole = -1;
    world.setLevel(levels[s.hole]);
  }
  const L = levels[s.hole];
  const me = client.me;
  const lobby = s.phase === 'lobby';
  const wide = window.innerWidth > 760;
  if (!lobby && (wasLobby || framedHole !== s.hole)) {
    framedHole = s.hole;
    world.frameHole();
  }
  wasLobby = lobby;

  $('title').hidden = !lobby;
  $('hud').hidden = lobby;
  $('card').hidden = s.phase !== 'holeEnd' && s.phase !== 'final';
  if (lobby) drawLobby(s);
  else drawHud(s, me);
  if (!$('card').hidden) drawCard(s);

  const next: Scene =
    s.phase === 'lobby' ? 'title' : s.phase === 'intro' ? 'intro' : s.phase === 'playing' ? 'play' : s.phase === 'holeEnd' ? 'card' : 'final';
  if (next !== scene) {
    scene = next;
    sound.setScene(next);
  }

  // ---- camera
  const mine = me ? client.ballAt(me.id, now) : null;
  const playing = s.phase === 'playing' && !!mine && !me?.done;
  world.mode = lobby ? 'title' : playing ? 'play' : 'overview';
  world.follow = playing ? mine : null;
  world.followVel = me && me.moving ? { x: me.ball.vx, y: me.ball.vy } : { x: 0, y: 0 };
  // When your ball comes to rest (and at the start of a hole), swing round to look down the
  // route, unless you have just been looking around yourself.
  if (playing && me && mine && !me.moving && (wasMoving || framedPlay !== s.hole) && now - lastOrbit > 2500) {
    framedPlay = s.hole;
    let near = 0;
    L.line.forEach((w, k) => {
      const d = (q: typeof w) => Math.hypot(q.x - mine.x, q.y - mine.y) + Math.abs(q.z - mine.z) * 4;
      if (d(w) < d(L.line[near])) near = k;
    });
    const to = L.line[Math.min(L.line.length - 1, near + 1)];
    world.faceAlong(to.x - mine.x, to.y - mine.y);
  }
  wasMoving = !!me?.moving;
  world.shift = lobby && wide ? 0.23 : 0;
  world.lift = lobby && !wide ? 0.34 : 0;

  // ---- balls and pickups
  const views = lobby
    ? []
    : s.players.map((p) => {
        const at = client.ballAt(p.id, now) ?? p.ball;
        return { id: p.id, color: PLAYER_COLORS[p.color], x: at.x, y: at.y, z: at.z, holed: p.holed };
      });
  world.syncBalls(views, dt);
  world.syncPickups(lobby ? [] : s.pickups);
  const nearCup = views.some((v) => !v.holed && Math.hypot(v.x - L.cup.x, v.y - L.cup.y) < 1.4);

  // ---- aiming
  const ready = canPutt() && !!mine;
  if (!ready) aim = null;
  world.setMarker(ready && !aim && mine ? mine : null);
  if (aim && me && aim.power > 0.04) {
    const d = swayed(now);
    world.setAim(previewPath(s, me, d.dx, d.dy, aim.power), aim.power);
  }
  else world.setAim(null);
  $('powerNote').textContent = me && me.steady > 0 ? 'power · steady' : me && me.jitters > 0 ? 'power · rattled' : 'power';
  sound.aim(aim ? aim.power : null);

  // ---- the sound of your own ball rolling
  let surface: Surface = 'turf';
  let speed = 0;
  if (me && mine && playing && me.moving) {
    speed = world.ballSpeed(me.id);
    const floor = floorAt(L, mine.x, mine.y, mine.z + 0.1);
    const mat = hitTri?.mat;
    surface = !Number.isFinite(floor) || mine.z > floor + 0.06 ? 'air' : mat === 'mud' ? 'mud' : mat === 'track' ? 'track' : 'turf';
  }
  sound.roll(speed, surface);

  world.render(dt, client.tickAt(now), nearCup);
  drawTags(s, now, s.phase === 'playing' || s.phase === 'intro');
}

requestAnimationFrame(frame);

// ?debug puts the room and client on window for poking at from the console.
if (params.has('debug')) {
  Object.assign(window, {
    game: {
      room,
      world,
      sound,
      // The client changes when you join someone else's room.
      get client() {
        return client;
      },
    },
  });
}
