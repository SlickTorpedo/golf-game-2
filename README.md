# Bubaran

Mini golf in a football stadium after the match. The crowd has gone, one bank
of floodlights is already off, and the people who stay behind putt across the
terraces. *Bubaran* is Javanese for the moment a crowd lets out.

Everyone putts at the same time. Fewest putts over nine holes wins. It runs
entirely in the browser; there is no backend.

## Run it

```
npm install
npm run dev
```

`npm run build` writes a static site to `dist/` that any file host can serve.
`npm test` plays whole rounds with bots, without a browser.

## How to play

- Left mouse button: drag back anywhere and let go to putt. The dotted line is
  the first stretch of the putt as the game will really play it, bounces included.
- Right mouse button: drag to look around. Scroll to zoom.
- On a touch screen: one finger putts, two fingers look around and pinch to zoom.
- Roll over something the crowd left behind to pick it up, then press `1` or `2`:
  - **Bass drum** throws nearby balls outward.
  - **Flip-flop** stops your rolling ball dead.
  - **Swap** trades places with the ball nearest the cup.
  - **Peanuts** takes your last putt back.
- Off the edge or into the water costs a putt. Eight putts or 90 seconds
  without holing out scores 10.
- On the course: running track pushes the ball, mud stops it, traffic cones
  kick it away, turnstiles bat it, and the players' tunnel carries it to the
  other end. A ball that reaches the cup too fast lips out.

## How it is put together

Single player already runs through the multiplayer path. Nothing in the game
reads or changes the match directly; it all goes through messages.

```
src/shared/   rules, physics, bots, holes, message types. No DOM. Runs anywhere.
src/server/   Room: owns one match, takes commands, sends snapshots.
src/net/      Channel: a two-way message pipe. Today a local in-page pair.
src/client/   connection, 3D view (three.js), HUD, input, sound.
              world.ts camera, lights, balls, effects · course.ts one hole as a scene
              stadium.ts the scenery · textures.ts painted at start-up · audio* synthesised
```

- `Match` (`src/shared/match.ts`) is the only place state changes. It takes
  commands (`putt`, `item`, `ready`), ignores ones that are not allowed, and
  moves forward at 60 ticks a second.
- `Room` (`src/server/room.ts`) wraps a match, gives each connection a player
  and broadcasts a JSON snapshot 30 times a second. It uses nothing from the
  browser.
- `GameClient` (`src/client/client.ts`) keeps the last two snapshots and draws
  between them, so it does not care how far away the room is.
- The local channel sends every message through JSON, so anything that would
  not survive a real network fails now, not later.

### Adding real multiplayer

1. Write a `Channel` over WebSocket (or a WebRTC data channel) in `src/net/`.
2. Run `Room` under Node with a `setInterval` calling `room.advance(ms)`, and
   hand each socket to `room.connect()`. Or keep the room in the host's tab
   and connect friends peer to peer.
3. In `src/client/main.ts`, build the client on that channel instead of
   `createLocalPair()`.
4. Add a lobby screen. The room already tracks a host, takes up to 8 players,
   fills empty seats with bots and handles people leaving.

What is still missing for play over the internet: predicting your own putt
locally so it does not wait a round trip, and sending smaller snapshots.
Open the game with `?lag=150` to feel a 150 ms round trip today.
`?debug` puts the room and client on `window.game`. `dev/` holds preview
pages used while building (`/dev/course.html?h=3` shows one hole).

## Making holes

Nothing is loaded from image or audio files: textures are painted on canvases
and every sound and the music are synthesised when the page starts.

Holes are text grids in `src/shared/courses.ts`. The legend is at the top of
`src/shared/level.ts`. The test suite checks that every hole can be finished.
