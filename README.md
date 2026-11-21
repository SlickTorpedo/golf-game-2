# Bubaran

Mini golf in a football stadium after the match. The crowd has gone, one bank
of floodlights is already off, and the people who stay behind putt across the
terraces. *Bubaran* is Javanese for the moment a crowd lets out.

Everyone putts at the same time and the fewest putts wins. There are two
courses: **Cup Run**, six big holes with several routes each, and **Matchday**,
nine short ones. Play alone against bots or with friends. It runs entirely in
the browser; there is no game server.

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
- The aim sways slowly from side to side while you hold it, so you time the
  release.
- Right mouse button: drag to look around. Scroll to zoom.
- `C` or the buttons bottom right change the view: **Follow** sits low behind
  your ball, closes in while it rolls and eases back when it stops; **Wide**
  shows the whole hole; **Top** looks straight down.
- `R` puts your ball back where you last hit it from, for one putt.
- On a touch screen: one finger putts, two fingers look around and pinch to zoom.
- Roll over something the crowd left behind to pick it up, then press `1` or `2`:
  - **Bass drum** throws nearby balls outward.
  - **Flip-flop** stops your rolling ball dead.
  - **Swap** trades places with the ball nearest the cup.
  - **Peanuts** takes your last putt back.
  - **Iced tea** stills the sway for your next two putts.
  - **Lucky scarf** makes the cup pull your ball in until it next stops.
  - **Air horn** makes everyone else's next aim sway wildly.
- Off the edge or into the water costs a putt. The clock and the putt limit
  grow with the hole (a par 7 gets 220 seconds and 16 putts); not holing out
  scores par + 4.
- Anything standing between the camera and your ball thins to a see-through
  window, so a wall never hides it.
- Walls come in three heights. A kerb stops a gentle ball and a firm one hops
  over it. A rail takes a full-blooded hit to clear. Nothing gets over an
  advertising board. Where there is no wall, the ball goes over the edge.
- A ramp that ends throws the ball. Running track pushes it, mud stops it,
  ice barely slows it, springs throw it up, traffic cones kick it away,
  turnstiles bat it, and the players' tunnel carries it to the other end. A
  ball that reaches the cup too fast lips out.

## Playing with friends

On the title screen press **Host a room**. You get a five-letter code and a
link to copy. Friends open the link (or type the code) and press **Join**;
you press **Kick off** when everyone is in. Up to eight players, and bots can
fill the rest.

There is no game server. The host's tab runs the game and the other tabs
connect straight to it (WebRTC, through the `peerjs` library). The public
PeerJS broker is used only to introduce the tabs to each other; it sees the
room code, not the game. Two consequences: the room lasts as long as the
host's tab stays open, and on a few strict networks (some offices and
schools) a direct connection cannot be made.

## How it is put together

Single player already runs through the multiplayer path. Nothing in the game
reads or changes the match directly; it all goes through messages.

```
src/shared/   rules, physics, bots, message types. No DOM. Runs anywhere.
              level.ts what a hole is · builder.ts the kit holes are made with
              holes/ one file per hole · courses.ts the playing order
src/server/   Room: owns one match, takes commands, sends snapshots.
src/net/      Channel: a two-way message pipe. channel.ts is the in-page pair,
              peer.ts the same thing between two browsers.
src/client/   connection, 3D view (three.js), HUD, input, sound.
              world.ts camera, lights, balls, effects · course.ts one hole as a scene
              stadium.ts the scenery · textures.ts painted at start-up · audio* synthesised
```

- `Match` (`src/shared/match.ts`) is the only place state changes. It takes
  commands (`putt`, `item`, `reset`, `ready`), ignores ones that are not allowed, and
  moves forward at 60 ticks a second.
- `Room` (`src/server/room.ts`) wraps a match, gives each connection a player
  and broadcasts a JSON snapshot 30 times a second. It uses nothing from the
  browser.
- `GameClient` (`src/client/client.ts`) keeps the last two snapshots and draws
  between them, so it does not care how far away the room is.
- The local channel sends every message through JSON, so anything that would
  not survive a real network fails now, not later.

### If you want a server instead

`Room` uses nothing from the browser. To host games on a server, write a
`Channel` over WebSocket in `src/net/`, run `Room` under Node with a timer
calling `room.advance(ms)`, and hand each socket to `room.connect()`.

Not built yet: predicting your own putt locally (today it waits for the
host, which is fine on a good link and noticeable on a slow one) and smaller
snapshots. `?lag=150` fakes a 150 ms round trip in solo play.
`?debug` puts the room and client on `window.game`. `dev/` holds preview
pages used while building (`/dev/course.html?h=kickoff&view=top` shows one hole).

## Making holes

A hole is free-form geometry: the ground is a triangle mesh with a height at
every corner, walls are thin segments standing on it, and where the mesh ends
the ball falls. Holes are written with a small builder that works like a pen
laying fairway: go straight, turn, climb, leave a gap.

```ts
b.at(0, 0, 0).width(2.6).walls('rail').cap().tee(0.9)
  .straight(6.5)
  .turn(90, 3.2, { bank: 0.22, left: 'board' })
  .straight(5.7)
  .cup(-1.3).cap('board');
```

`docs/hole-design.md` is the full reference: the builder, how far and how high
the ball goes, and the checklist every hole is held to. Each hole is its own
file in `src/shared/holes/`, so several people (or agents) can build holes at
once without touching the same file. `npm test` builds every hole, checks
everything stands on the ground and has bots play it.

`docs/research.md` is the research the design leans on: what Putt Party
actually does, and what sources say makes this kind of game fun (game feel,
hole design, cameras, party play), with a prioritised list of recommendations.

Nothing is loaded from image or audio files: textures are painted on canvases
and every sound and the music are synthesised when the page starts.
