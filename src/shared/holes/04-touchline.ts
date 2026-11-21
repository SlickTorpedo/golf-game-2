import { HoleBuilder } from '../builder';
import { ORANGE, PINK } from './palette';

// Hole 4 is the first real choice: a big walled S, or the thin straight line
// drawn through the middle of it.
// Ace: along the line. A medium putt onto the running track is thrown across
//   the S, down the kerbed second half and dies at the cup.
// Safe: round the S, both loops walled and banked. Three or four putts.
// Shortcut: the line. Its first half is bare running track with no edge at
//   all, its second half has only kerbs, and the green behind the cup has a
//   kerb where the line points: off line or too hard and the ball is gone.
const b = new HoleBuilder({ id: 'touchline', name: 'Touchline', par: 3, boards: [PINK, ORANGE] });

const rad = (deg: number) => (deg * Math.PI) / 180;

// Tee and green are round pads of the same size. Each has two mouths cut to
// whole rim segments (4 degrees each): a wide one for the S and a thin one
// for the line.
const PAD_R = 2.6;
const LANE = 2 * PAD_R * Math.sin(rad(32));
const LANE_MOUTH = PAD_R * Math.cos(rad(32));
const LINE = 2 * PAD_R * Math.sin(rad(12));
const LINE_MOUTH = PAD_R * Math.cos(rad(12));

// The S: out of the tee heading east, a right-hand loop, a short straight
// where the line crosses, a left-hand loop, and into the green heading east.
// The lead-in length is chosen so the line from tee to green crosses that
// short straight square on.
const LOOP = 142;
const LOOP_R = 3.6;
const LINE_HEADING = LOOP - 90;
const LEAD = (2 * LOOP_R * Math.sin(rad(LOOP)) + LINE) / (-2 * Math.cos(rad(LOOP))) - LANE_MOUTH;

b.disc(0, 0, PAD_R, 0, { wall: 'rail', segments: 90, gaps: [[-32, 32], [LINE_HEADING - 12, LINE_HEADING + 12]] });
b.at(0, 0, 0).tee();

b.at(LANE_MOUTH, 0, 0)
  .width(LANE)
  .walls('rail')
  .straight(LEAD)
  .turn(LOOP, LOOP_R, { bank: 0.25, left: 'board' })
  .straight(LINE, { left: 'none', right: 'none' })
  .turn(-LOOP, LOOP_R, { bank: 0.25, right: 'board' })
  .straight(LEAD);

const GREEN_X = 2 * (LANE_MOUTH + LEAD) + 2 * LOOP_R * Math.sin(rad(LOOP)) + LINE * Math.cos(rad(LOOP));
const GREEN_Y = 2 * LOOP_R * (1 - Math.cos(rad(LOOP))) + LINE * Math.sin(rad(LOOP));
// The rim is board except behind the cup as seen from the line: a kerb there.
b.disc(GREEN_X, GREEN_Y, PAD_R, 0, {
  wall: 'board',
  segments: 90,
  gaps: [[148, 212], [LINE_HEADING + 168, LINE_HEADING + 192], [LINE_HEADING - 28, LINE_HEADING + 28]],
});
const kerb: [number, number][] = [];
for (let a = LINE_HEADING - 28; a <= LINE_HEADING + 28; a += 4) kerb.push([GREEN_X + PAD_R * Math.cos(rad(a)), GREEN_Y + PAD_R * Math.sin(rad(a))]);
b.wall(kerb, 'kerb');
b.at(GREEN_X, GREEN_Y, 0).cup();

// The line. First half: a little turf, the running track, a little turf, no
// edges. Second half: turf between kerbs.
const HALF = (Math.hypot(GREEN_X, GREEN_Y) - LANE) / 2 - LINE_MOUTH;
const TRACK = 2.55;
b.at(Math.cos(rad(LINE_HEADING)) * LINE_MOUTH, Math.sin(rad(LINE_HEADING)) * LINE_MOUTH, LINE_HEADING)
  .width(LINE)
  .walls('none')
  .route(false)
  .straight(0.8)
  .straight(TRACK, { boost: true })
  .straight(HALF - 0.8 - TRACK)
  .walls('none')
  .straight(LANE)
  .walls('kerb')
  .straight(HALF)
  .item(-HALF / 2);

// One pickup at the far point of each loop for those going round.
b.at(LANE_MOUTH + LEAD + LOOP_R, LOOP_R, 90).item();
b.at(GREEN_X - LANE_MOUTH - LEAD - LOOP_R, GREEN_Y - LOOP_R, 90).item();

export default b.build();
