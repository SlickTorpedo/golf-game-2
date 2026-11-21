import { HoleBuilder } from '../builder';
import { LIME, VIOLET } from './palette';

// Hole 3 teaches height: the green is four terrace levels below the tee, and
// dropping is free.
// Ace: straight down the steps. The ball skips from tread to tread and has to
//   die at the cup, so it is a touch shot, not a hard one.
// Safe: the walled ramp that loops out to the east and back, then one small
//   step down onto the green. Three easy putts.
// Shortcut: the steps. They narrow on the way down and their west side has
//   no wall at all, so a putt pulled right is gone.
const b = new HoleBuilder({ id: 'tribune', name: 'Tribune Steps', par: 3, boards: [VIOLET, LIME] });

const LANE = 2.8;
const TOP = 2;
const TREAD = 1.6;

// The green is round. Its two mouths are cut to whole rim segments so the
// lanes meet it without a gap: the ramp's is three segments either side of
// its centre line, the steps' is two.
const SEGMENT = Math.PI / 16;
const GREEN_R = LANE / 2 / Math.sin(3 * SEGMENT);
const RAMP_MOUTH_TO_CENTRE = GREEN_R * Math.cos(3 * SEGMENT);
const STEPS_MOUTH = 2 * GREEN_R * Math.sin(2 * SEGMENT);
const STEPS_MOUTH_TO_CENTRE = GREEN_R * Math.cos(2 * SEGMENT);

const STEPS_TOP = 4;
const GREEN_Y = STEPS_TOP + 3 * TREAD + STEPS_MOUTH_TO_CENTRE;

// The top terrace: tee at the north end, looking south down the steps at the
// flag. Its east side opens onto the ramp.
b.at(0, 0, 90, TOP)
  .width(LANE)
  .walls('rail')
  .cap()
  .tee(0.9)
  .straight(1.2)
  .straight(1.4, { left: 'none' })
  .route(false)
  .straight(1.4, { left: 'none' });

// The steps: three treads, each half a unit lower and a little narrower, a
// board on the east side and nothing on the west.
const treadWidth = (n: number) => LANE + ((STEPS_MOUTH - LANE) * n) / 3;
for (let n = 0; n < 3; n++) {
  b.at(0, STEPS_TOP + n * TREAD, 90, TOP - 0.5 * (n + 1))
    .width(treadWidth(n))
    .walls('board', 'none')
    .straight(TREAD, { width: treadWidth(n + 1) });
  if (n === 1) b.item(-TREAD / 2);
}

// The ramp: out east along the top, then two banked right-hand bends that
// bring it back west one step above the green.
const RAMP_R = (GREEN_Y - 2.6 - 0.9) / 2;
const RAMP_BEND = { rise: -0.75, bank: 0.2, left: 'board' } as const;
b.at(LANE / 2, 2.6, 0, TOP)
  .width(LANE)
  .walls('rail')
  .route(true)
  .straight(1.6)
  .turn(90, RAMP_R, RAMP_BEND)
  .straight(0.9)
  .item(-0.45)
  .turn(90, RAMP_R, RAMP_BEND)
  .straight(LANE / 2 + 1.6 - RAMP_MOUTH_TO_CENTRE);

b.disc(0, GREEN_Y, GREEN_R, 0, { wall: 'board', gaps: [[-33.75, 33.75], [247.5, 292.5]] });
b.at(0, GREEN_Y, 90).cup();

export default b.build();
