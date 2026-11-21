# Designing a hole

Each hole is one file in `src/shared/holes/`, written with the builder in
`src/shared/builder.ts`. Holes are free-form: curves, banked bends, ramps,
drops, gaps to jump, thin walls. This page is the reference and the checklist.
The reasons behind the checklist are in `docs/research.md`.

## The loop

1. Edit your hole file.
2. Check it builds and bots can finish it:
   `npx vitest run --disable-console-intercept -t "hole <id>:"`
   It prints how many bots holed out and their scores.
3. Look at it: `http://localhost:5173/dev/course.html?h=<id>&view=top&route=1`
   (`view=top`, `wide` or `low`; `route=1` shows the bots' route as a row of
   balls, pink where a point is flown to; `yaw=90` turns the camera). Drag to
   look around.
4. Play it: `http://localhost:5173/?debug`, press Kick off, then in the
   console `game.room.match.beginHole(n)` with n = hole number minus one.

## Units and directions

- x is east, y is south, z is up. One unit is about a pace; the ball is 0.32 across.
- Headings are degrees clockwise on the map: 0 east, 90 south, 180 west, 270 north.
- A positive `turn` is to the right.
- One terrace level is 0.5 high.

## The builder

A pen lays fairway behind it. Everything chains.

```ts
import { HoleBuilder } from '../builder';
import { LIME, PINK } from './palette';

const b = new HoleBuilder({ id: 'kickoff', name: 'Kickoff', par: 2, boards: [PINK, LIME] });

b.at(0, 0, 0)        // pen at x=0, y=0, heading east, height 0
  .width(2.6)        // fairway width from here on
  .walls('rail')     // both sides; or .walls('kerb', 'board') for left, right
  .cap()             // a wall across the pen: closes the back of the tee
  .tee(0.9)          // tee 0.9 ahead of the pen
  .straight(6.5)
  .turn(90, 3.2, { bank: 0.22, left: 'board' })   // right-hand bend, radius 3.2, banked, board on the outside
  .straight(2.5, { width: 3.4 })                  // widen to 3.4 over this piece
  .straight(3.2)
  .cup(-1.3)         // cup 1.3 behind the pen
  .cap('board');

b.mound(3.4, 0, 0.9, 0.1);   // a low hump at map x=3.4, y=0

export default b.build();
```

### Pen moves

| Call | What it does |
|---|---|
| `at(x, y, heading, z = 0)` | Put the pen down. |
| `width(w)` | Fairway width from here on. |
| `walls(left, right = left)` | `'kerb'`, `'rail'`, `'board'` or `'none'`, from here on. |
| `straight(length, opts)` | Lay fairway ahead. |
| `turn(angle, radius, opts)` | Lay fairway round a bend. Radius is to the centre line and must be more than half the width. |
| `gap(length, { drop, power })` | Move on without laying ground: a jump. `drop` lowers the far side. `power` (0..1) is what a bot putts with from the last route point to clear it. |
| `cap(kind = 'rail')` | A wall across the fairway at the pen. |
| `mark(name)` / `goto(name)` | Remember the pen; come back to it to start a branch. |
| `route(false)` / `route(true)` | Pieces laid while off are not part of the bots' route. Turn off for shortcuts and side branches. |

Options for `straight` and `turn`: `width` (taper to this), `rise` (height
gained; negative goes down), `mat` (`'turf'`, `'mud'`, `'ice'`, `'water'`),
`boost: true` (running track that pushes the ball forward; straights only),
`left` / `right` (wall for this piece only), `bridge: true` (air underneath:
balls on a lower level can pass under), `bank` (turns only: lifts the outside
edge by this much mid-bend, fading in and out), `tilt` (turns only: lifts the
outside edge for the whole bend, like a velodrome).

### Things placed at the pen

Each takes an offset: forward, then to the right. `tee()`, `cup()`, `item()`
(a pickup), `cone()` (kicks the ball away), `spinner(f, r, dir)` (turnstile;
arms reach 1.3, keep 1.8 clear of walls), `spring()` (throws the ball up),
`tunnelIn(name)` / `tunnelOut(name)`.

### Free shapes (map coordinates)

| Call | What it does |
|---|---|
| `poly(points, z, { mat, walls, bridge })` | A polygon of ground. `z` is one height or one per point. `walls` is one kind, or one per edge. |
| `disc(x, y, r, z, { mat, wall, gaps, mouths })` | A round patch. `gaps` are rim stretches with no wall, as `[fromDeg, toDeg]` pairs using heading angles. `mouths` are openings for lanes, as `[headingFromCentre, laneWidth]` pairs. |
| `mound(x, y, r, height)` | A smooth hump on ground already laid. 0.05–0.15 bends a putt; 0.3+ is a hill. |
| `wall(points, kind, z?)` | A free-standing wall through these points, on the highest ground under each. Give `z` to stand it at one height (for a wall under an overhang). |
| `way(x, y, z?, power?)` | An extra route point for the bots. |

Pieces may overlap or butt against each other freely. Where two pieces meet at
the same height the ball rolls across; you only need to leave the wall off on
that stretch (`left: 'none'`).

## What the ball does

Use these when sizing things. They come from `src/shared/constants.ts`.

- **Reach.** A struck ball skids for the first sixth of its trip, then rolls out slowly.
  On flat turf: quarter power 1.7 units, half 5, three-quarter 10.5, full 17.5.
  A full-power putt takes about four seconds to stop.
- **Walls.** `kerb` (0.11 high): a ball arriving faster than 3.6 units/s
  straight into it hops over. `rail` (0.3): only above 9.5, a near full-power
  direct hit. `board` (0.62): never. Glancing hits count only the speed *into*
  the wall, so a ball can run along a kerb at any speed.
- **No wall** means the ball rolls off and is lost: one putt penalty, back to
  where it was hit from.
- **Higher ground is a wall** from below. From above, the ball simply drops,
  and bounces a little when it lands.
- **Slopes.** A resting ball stays put only on ground gentler than about 1 in 6
  (rise 0.16 per unit). Steeper and it rolls back down, and keeps rolling: a
  ball runs a long way on the flat now, so every slope needs somewhere for the
  ball to end up. Climbing 0.5 costs a ball about 3.5 units/s of speed.
- **Ramps throw.** A ball leaving the top of a rising ramp keeps its upward
  speed and flies. Leaving a ramp of rise 0.6 over 2 units at 9 units/s
  carries about 1.8 units before coming back to launch height, further if the
  landing is lower. Slow balls barely leave the ground. Top putt speed is
  10.5 units/s, so big jumps need running track or a downhill run-up.
  Measure a jump with `stepBall` before trusting it.
- **Running track** (`boost`) adds a lot: three units of it takes a ball from
  rest to about 10 units/s. Put a wall, an up-slope or a long run-out after it.
- **Spring** throws the ball up for about 0.6 s; it travels its ground speed
  times that (2–5 units).
- **Cup.** Drops if the ball is slower than 5.5 units/s over it; faster lips
  out. Put it on flat ground.
- **Mud** stops a ball within a unit or so. **Ice** barely slows it and a ball
  will slide off even a gentle slope. **Water** loses the ball like the void.
- **Cones** kick the ball back harder than it arrived. **Turnstiles** turn at
  about one quarter-turn a second and bat the ball.
- **Tunnel** moves the ball to its exit keeping its speed and direction; leave
  2+ units of run-out past the exit in the direction balls will arrive.

Things designers have tripped over:

- Offsets for `item()`, `cone()` and the rest are measured straight back along
  the pen's heading, not round the bend it has just drawn. After a `turn`, a
  large negative offset lands off the fairway. The test catches it.
- A ball keeps its ground speed when it lands from a drop, a jump or a spring.
  Give every landing a backstop or a long run-out.
- A ball that drops from a terrace clears a `rail` standing on the level below.
  Use `board` where a drop must be contained.
- Cones return a fast ball faster still, enough to clear a kerb and sometimes a
  rail. Do not put kerbs or open edges near a cone field unless losing the ball
  there is the point.
- Glancing contact with a wall costs almost no speed, so a ball can ride the
  outside wall of a bend. A square hit loses about 40% of its speed.
- `wall()` stands on the highest ground under each point. Under an overhang it
  will climb onto the overhang.
- `disc()` takes one wall kind. For a rim that is part board and part kerb,
  leave a gap and lay the other part with `wall()`.
- Bots putt at the route points in turn and take no account of turnstiles,
  cones or timing. On a long bend they stop at each point, so they score a
  putt or two worse than a person would.

## Checklist

Route
- [ ] The hole has **one idea** you can say in a sentence.
- [ ] There is an **ace line**: one shot from the tee that can hole out. It may need a bank or a jump.
- [ ] There is a **safe line** that reaches the cup in par with no risk of losing the ball.
- [ ] There is a **shortcut** that saves a stroke and has a visible cost: an open edge, a kerb you can fly over, a timed obstacle, a jump.
- [ ] Hazards look like hazards before you reach them.
- [ ] From behind the tee you can see the flag, or the route clearly leads the eye to it.

Shape
- [ ] Not a box. Use at least two of: a curve, a banked bend, a ramp, a drop to a lower level, a narrowing, a jump.
- [ ] Fairway 2.4–4 wide normally; thin sections 1–1.4 wide and no longer than 6.
- [ ] Open edges are deliberate. Beside the safe line use a kerb or rail; beside the shortcut, nothing or a kerb.
- [ ] Drops land somewhere that keeps the ball in play: a wide flat with a backstop.
- [ ] The cup is on flat ground at least 1.2 across, 0.8 or more from any edge.
- [ ] Safe-line length: 10–18 units for par 2, 18–30 for par 3, 30–45 for par 4, and about 14–16 units per stroke of par on big holes.
- [ ] Use `board` walls where a long stretch faces the player: they carry the adverts and nothing gets over them.

Recovery
- [ ] After a bad shot from anywhere, there is still a shot that makes progress.
- [ ] Nowhere a ball can stop and be unable to putt out: no pockets, no dead ends without a way back.
- [ ] Tunnels, track and springs send the ball somewhere with room to stop.

Everyone at once
- [ ] The tee area is at least 2.4 wide and nothing narrows within 4 units of it.
- [ ] One to three pickups (`item()`): one on the safe line, one on or near the shortcut.
- [ ] Bots: at least half hole out (the test checks this), and their average is within about 2 of par.

Sign-off: describe the hole's idea in one line at the top of the file, in the
file's first comment.

## Big holes

The Cup Run course is made of big holes: par 5 to 7, built from three or four
sections, each with its own idea. `docs/cup-run.md` has the plan for each.
What changes at this size:

- **Sections.** Each section is a small hole in itself with one idea. Join
  them with a landing: flat ground at least 3 x 3 where a ball can stop and the
  player can read what comes next.
- **Routes.** At least two ways through the hole as a whole, and one big
  shortcut that skips a whole section at real risk. Strategy comes from
  choosing, so make the choice visible from where it is made.
- **Failing soft.** On a long hole, losing the ball to the void near the end
  is cheap (back to where you hit from), but a hole with void everywhere is
  tiring. Prefer drops that land the ball on an earlier part of the hole: the
  cost is distance, and it is funnier.
- **Landmarks.** Give each section something to recognise it by (a spiral, a
  bridge, a row of cones, a colour of board), and put the green where it can
  be seen from the tee if you can: high up, or at the end of a long view.
- **Pickups.** Three to five, spread over the sections, at least one on the
  shortcut.
- **Limits.** The clock is 45 s plus 25 s per stroke of par, and the stroke
  cap is twice par plus two. Bots should average within about 3 of par.
- **Size.** Up to about 55 x 55 units and heights 0 to 5. Keep the file
  readable: name each section with a comment, and use `mark`/`goto` and small
  local helper functions rather than one endless chain.
