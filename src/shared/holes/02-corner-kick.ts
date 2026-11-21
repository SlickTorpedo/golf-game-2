import { HoleBuilder } from '../builder';
import { CYAN, ORANGE } from './palette';

// Hole 2 teaches the bank: down a ramp into a corner with a sharp inside and
// a big curved board on the outside that throws the ball round to the cup.
// Ace: putt firmly through the pickup into the board; one bounce sends the
//   ball north into the cup, which is hidden from the tee by the inside corner.
//   Two-thirds power or more, aimed straight down the lane or a few degrees
//   right of it.
// Safe: roll down to the middle of the corner, then a short putt to the cup.
// No shortcut and no open edges: the whole hole is walled.
const b = new HoleBuilder({ id: 'corner-kick', name: 'Corner Kick', par: 2, boards: [CYAN, ORANGE] });

// The round green's mouth is exactly as wide as the corner that feeds it.
const WIDE = 3;
const GREEN_R = WIDE / 2 / Math.sin(Math.PI / 4);
const TO_CENTRE = GREEN_R * Math.cos(Math.PI / 4);

// A raised tee, a flaring ramp down, and the corner: tight on the inside, a
// wide banked sweep of board on the outside. The ramp is steep enough that a
// ball left on it rolls on down instead of creeping.
b.at(0, 0, 0, 0.6)
  .width(2.6)
  .walls('rail')
  .cap()
  .tee(0.9)
  .straight(2.3)
  .straight(3.3, { rise: -0.6, width: WIDE })
  .item(0.3, 0.55)
  .turn(-90, 1.9, { bank: 0.15, right: 'board' })
  .cup(1.2, 1);

// The corner ends at x 7.5, y -1.9 heading north, straight into the green.
// The cup sits east of centre, where the bank shot comes through.
b.disc(7.5, -1.9 - TO_CENTRE, GREEN_R, 0, { wall: 'board', gaps: [[45, 135]] });

export default b.build();
