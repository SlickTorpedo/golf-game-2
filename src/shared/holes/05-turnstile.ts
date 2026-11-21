import { HoleBuilder } from '../builder';
import { PINK, VIOLET } from './palette';

// The gate: two turnstiles side by side, their arms swinging out toward the
// tee through the gap between them. Time a putt through the gap, or jump the
// lot from the pier.
//
// Safe line: lay up short of the gate, wait for the arms to swing clear and
//   putt between the hubs; then round the banked bend down to the round green.
// Ace line: the pier by the tee. Cross the spring pad at about two-thirds
//   power and the ball flies the gap and runs out to the flag.
// Shortcut: the same pier. It has no walls, the pad is small, and a soft jump
//   falls short. The gate has its own price: its pads are open round the
//   outside, and an arm that catches the ball bats it back hard, sometimes
//   off the side.
const b = new HoleBuilder({ id: 'turnstile', name: 'Turnstile', par: 3, boards: [PINK, VIOLET] });

const TOP = 1;
const LANE = 2.6;
const GATE_X = 5.6;
const HUB = 1.5;
const PAD = 1.85;
// Where the lane's edges meet the round pads.
const MOUTH = Math.sqrt(PAD ** 2 - (HUB - LANE / 2) ** 2);
const BEND_X = 9;
const BEND_R = 4.8;
const GREEN = { x: 2.6, y: BEND_R * 2, r: 2.8 };

// The two round pads of the gate, barely wider than the arms. A short kerb
// where each meets the lane; the rest of the outside is open.
b.disc(GATE_X, -HUB, PAD, TOP, { wall: 'kerb', segments: 48, gaps: [[6, 174], [215, 325]] });
b.disc(GATE_X, HUB, PAD, TOP, { wall: 'kerb', segments: 48, gaps: [[186, 354], [35, 145]] });

// The tee lane, with a gap in its right-hand rail where the pier leaves, then
// straight on through the gate with no walls of its own. Bots lay up short of
// the gate and then putt through it.
b.at(-1.2, 0, 0, TOP)
  .width(LANE)
  .walls('rail')
  .cap()
  .tee(1.2)
  .route(false)
  .straight(0.85)
  .straight(1.35, { right: 'none' })
  .straight(GATE_X - MOUTH - 1)
  .item(-1)
  .way(GATE_X - 2.8, 0)
  .straight(MOUTH * 2, { left: 'none', right: 'none' })
  // The two hubs turn opposite ways, so both sweep back toward the tee through the middle.
  .spinner(-MOUTH, -HUB, 1)
  .spinner(-MOUTH, HUB, -1)
  .way(GATE_X + 2.6, 0, TOP, 0.85)
  // The reward for getting through: a strip of track that slings the ball into the bend.
  .straight(BEND_X - GATE_X - MOUTH, { boost: true })
  // The bend home: a banked half-circle that drops one level, then the run in.
  .route(true)
  .turn(180, BEND_R, { rise: -TOP, bank: 0.3, left: 'board' })
  .straight(BEND_X - GREEN.x - Math.sqrt(GREEN.r ** 2 - (LANE / 2) ** 2))
  .item(-2);

// The round green. A board round the back to stop balls arriving from the bend
// or the pier; only a kerb on the side that faces the pier.
b.disc(GREEN.x, GREEN.y, GREEN.r, 0, { wall: 'board', segments: 48, gaps: [[-28, 28], [214, 332]] });
const lowSide: [number, number][] = [];
for (let deg = 210; deg <= 330; deg += 7.5) {
  const a = (deg * Math.PI) / 180;
  lowSide.push([GREEN.x + Math.cos(a) * GREEN.r, GREEN.y + Math.sin(a) * GREEN.r]);
}
b.wall(lowSide, 'kerb');

// The pier: a bare plank pointing at the flag, with a spring pad at its end.
b.at(0.3, 1.1, 76, TOP).width(1.2).walls('none').route(false).straight(2.9).spring(-0.45).item(-1.6);

b.at(GREEN.x + 0.13, GREEN.y + 0.48, 0, 0).cup();

export default b.build();
