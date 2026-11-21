import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import './styles.css';

import { createLocalPair } from '../net/channel';
import { Room } from '../server/room';
import { PENALTY_SCORE, STROKE_CAP, TICK_RATE } from '../shared/constants';
import { STADIUM } from '../shared/courses';
import { parseLevel, topAt } from '../shared/level';
import { total } from '../shared/match';
import type { ClientMsg, GameEvent, ItemKind, MatchState, PlayerState, ServerMsg } from '../shared/protocol';
import { Sound } from './audio';
import { GameClient } from './client';
import { ITEM_COLORS, PLAYER_COLORS, World } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const ITEM_TEXT: Record<ItemKind, [string, string]> = {
  drum: ['Bass drum', 'throws nearby balls outward'],
  sandal: ['Flip-flop', 'stops your rolling ball dead'],
  swap: ['Swap', 'trade places with the ball nearest the cup'],
  peanuts: ['Peanuts', 'take your last putt back'],
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

const room = new Room(STADIUM, (Math.random() * 2 ** 32) >>> 0);
const [clientEnd, serverEnd] = createLocalPair<ClientMsg, ServerMsg>(lag / 2);
room.connect(serverEnd);
const client = new GameClient(clientEnd, store.get('name') ?? '');

const levels = STADIUM.map(parseLevel);
const world = new World($<HTMLCanvasElement>('view'));
const sound = new Sound();
sound.muted = store.get('muted') === '1';

let shownHole = -1;
let faced = -1;
let userZoom = 1;
let drag: { sx: number; sy: number; dx: number; dy: number; power: number } | null = null;
let lockUntil = 0;
let hasPutted = false;
let toastUntil = 0;

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
    drawBots();
  };
  botsEl.append(b);
});
function drawBots(): void {
  [...botsEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === botCount || (i > 0 && i < botCount))));
}
drawBots();

const nameEl = $<HTMLInputElement>('name');
nameEl.value = store.get('name') ?? '';
nameEl.placeholder = 'Player';

function kickOff(): void {
  sound.unlock();
  store.set('name', nameEl.value);
  store.set('bots', String(botCount));
  client.send({ t: 'start', name: nameEl.value, bots: botCount });
}
$('start').addEventListener('submit', (e) => {
  e.preventDefault();
  kickOff();
});

// ------------------------------------------------------------------ input

const canvas = world.renderer.domElement;

function canPutt(): boolean {
  const s = client.state;
  const me = client.me;
  return !!s && !!me && s.phase === 'playing' && !me.done && !me.moving && me.strokes < STROKE_CAP && performance.now() > lockUntil;
}

canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (e.button !== 0 || !canPutt()) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* the pointer is already gone */
  }
  drag = { sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, power: 0 };
});

canvas.addEventListener('pointermove', (e) => {
  const me = client.me;
  if (!drag || !me) return;
  const a = world.groundPoint(drag.sx, drag.sy, me.ball.z);
  const b = world.groundPoint(e.clientX, e.clientY, me.ball.z);
  if (!a || !b) return;
  // Pull back like a slingshot: the ball goes the opposite way.
  const px = a.x - b.x;
  const py = a.y - b.y;
  const len = Math.hypot(px, py);
  drag.power = Math.min(1, len / 3.2);
  drag.dx = len ? px / len : 0;
  drag.dy = len ? py / len : 0;
});

function release(fire: boolean): void {
  if (!drag) return;
  if (fire && drag.power > 0.05 && canPutt()) {
    client.send({ t: 'putt', dx: drag.dx * drag.power, dy: drag.dy * drag.power });
    lockUntil = performance.now() + 300 + lag;
    hasPutted = true;
  }
  drag = null;
}
canvas.addEventListener('pointerup', () => release(true));
canvas.addEventListener('pointercancel', () => release(false));
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  release(false);
});
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    userZoom = Math.min(2.6, Math.max(0.6, userZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
  },
  { passive: false },
);

window.addEventListener('keydown', (e) => {
  if (e.target === nameEl) return;
  const k = e.key.toLowerCase();
  if (k === 'q') world.rotate(-1);
  else if (k === 'e') world.rotate(1);
  else if (k === '1' || k === '2') client.send({ t: 'item', slot: Number(k) - 1 });
  else if (k === 'escape') release(false);
  else if (k === 'enter' || k === ' ') cardAction();
});

$('rotL').onclick = () => world.rotate(-1);
$('rotR').onclick = () => world.rotate(1);
const muteEl = $('mute');
function drawMute(): void {
  muteEl.textContent = sound.muted ? 'Sound off' : 'Sound on';
}
muteEl.onclick = () => {
  sound.muted = !sound.muted;
  store.set('muted', sound.muted ? '1' : '0');
  drawMute();
};
drawMute();

function cardAction(): void {
  const s = client.state;
  if (s?.phase === 'holeEnd') client.send({ t: 'ready' });
  else if (s?.phase === 'final') kickOff();
}
$('cardBtn').onclick = cardAction;

// ----------------------------------------------------------------- events

function toast(text: string, bad = false): void {
  const el = $('toast');
  el.textContent = text;
  el.className = bad ? 'on bad' : 'on';
  toastUntil = performance.now() + 1700;
}

function verdict(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one';
  const d = strokes - par;
  return d <= -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : `In for ${strokes}`;
}

client.onEvents = (events: GameEvent[], s: MatchState) => {
  const L = levels[s.hole];
  for (const e of events) {
    const mine = 'p' in e && e.p === client.you;
    const who = 'p' in e ? s.players.find((p) => p.id === e.p) : undefined;
    if (e.t === 'phase') {
      if (e.phase === 'playing') sound.whistle();
      if (e.phase === 'final') sound.whistle(true);
    } else if (e.t === 'putt') {
      sound.putt(e.power);
    } else if (e.t === 'bounce') {
      if (mine) sound.bounce(e.v);
    } else if (e.t === 'land') {
      if (mine) sound.land();
    } else if (e.t === 'holed') {
      sound.holed();
      world.pulse(L.cup.x, L.cup.y, topAt(L, L.cup.x, L.cup.y), who ? PLAYER_COLORS[who.color] : 0xffffff);
      if (mine) toast(verdict(e.strokes, L.def.par));
    } else if (e.t === 'out') {
      if (mine) {
        sound.out();
        toast('Off the edge +1', true);
      }
    } else if (e.t === 'pickup') {
      if (mine) sound.pickup();
    } else if (e.t === 'item') {
      sound.item();
      world.pulse(e.x, e.y, topAt(L, e.x, e.y), ITEM_COLORS[e.kind], e.kind === 'drum' ? 2.2 : 1);
      if (!mine && who) toast(`${who.name}: ${ITEM_TEXT[e.kind][0]}`, true);
    }
  }
};

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

  $('hint').hidden = hasPutted || s.phase !== 'playing';
  if (performance.now() > toastUntil) $('toast').classList.remove('on');
}

function drawCard(s: MatchState): void {
  const final = s.phase === 'final';
  const L = levels[s.hole];
  const rows = ranked(s);
  const secs = Math.ceil(s.timer / TICK_RATE);
  const me = client.me;

  once('cardBtn', `${s.phase}${secs}${me?.ready}`, () => {
    $('cardBtn').textContent = final ? 'Play again' : me?.ready ? `Waiting ${secs}` : `Next hole ${secs}`;
  });

  once('card', `${s.phase}${s.hole}${rows.map((p) => p.id + p.scores.join()).join('|')}`, () => {
    $('cardTitle').textContent = final ? 'Full time' : L.def.name;
    const mine = me?.scores[s.hole];
    $('cardNote').textContent = final
      ? `${rows[0].name} wins with ${total(rows[0])}`
      : mine == null
        ? ''
        : mine >= PENALTY_SCORE
          ? `Not holed: ${PENALTY_SCORE} on the card`
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
        const cls = sc == null ? '' : sc >= PENALTY_SCORE ? 'fail' : sc < lv.def.par ? 'under' : '';
        tr.append(el('td', sc == null ? '' : String(sc), cls));
      });
      tr.append(el('td', String(total(p))));
      return tr;
    });
    $('cardTable').replaceChildren(head, ...body);
  });
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
      const scr = world.project(at.x, at.y, at.z + 0.55);
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

// ------------------------------------------------------------------- loop

let last = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);

// ?debug puts the room and client on window for poking at from the console.
if (params.has('debug')) Object.assign(window, { game: { room, client, world } });
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // This tab is also the host, so it drives the room's clock.
  room.advance(dt * 1000);

  const s = client.state;
  if (!s) return world.render(dt);

  if (s.hole !== shownHole) {
    shownHole = s.hole;
    world.setLevel(levels[s.hole]);
    userZoom = 1;
  }
  const L = levels[s.hole];
  const me = client.me;
  const lobby = s.phase === 'lobby';
  const wide = window.innerWidth > 760;

  $('title').hidden = !lobby;
  $('hud').hidden = lobby;
  $('card').hidden = s.phase !== 'holeEnd' && s.phase !== 'final';
  if (!lobby) drawHud(s, me);
  if (!$('card').hidden) drawCard(s);

  // Camera: show the whole hole when it fits, otherwise stay with the ball.
  if (!lobby && (world.orbit || faced !== s.hole)) {
    faced = s.hole;
    world.orbit = false;
    world.faceTee();
  }
  world.orbit = lobby;
  world.shift = lobby && wide ? 0.23 : 0;
  world.lift = lobby && !wide ? 0.34 : 0;
  const fit = world.fitZoom();
  const mine = me ? client.ballAt(me.id, now) : null;
  const playing = s.phase === 'playing' && mine && !me?.done;
  const zoom = playing ? Math.max(fit, wide ? 0.85 : 0.6) * userZoom : fit * (lobby ? 0.9 : 1);
  const follow = playing ? Math.min(1, Math.max(0, (zoom / fit - 1) * 1.6)) : 0;
  world.zoom = zoom;
  const cx = L.w / 2;
  const cy = L.h / 2;
  world.focus.set(
    cx + ((mine?.x ?? cx) - cx) * follow,
    (mine?.z ?? 0) * follow,
    cy + ((mine?.y ?? cy) - cy) * follow,
  );

  world.syncBalls(
    lobby
      ? []
      : s.players.map((p) => {
          const at = client.ballAt(p.id, now) ?? p.ball;
          return { id: p.id, color: PLAYER_COLORS[p.color], x: at.x, y: at.y, z: at.z, hidden: p.holed };
        }),
  );
  world.syncPickups(lobby ? [] : s.pickups);

  const ready = canPutt() && !!mine;
  if (!ready) drag = null;
  world.setMarker(ready && !drag ? mine : null);
  world.setAim(drag && mine ? { ...mine, dx: drag.dx, dy: drag.dy, power: drag.power } : null);

  world.render(dt);
  drawTags(s, now, s.phase === 'playing' || s.phase === 'intro');
}

requestAnimationFrame(frame);
