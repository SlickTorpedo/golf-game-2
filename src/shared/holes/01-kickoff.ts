import { HoleBuilder } from '../builder';
import { LIME, PINK } from './palette';

// Hole 1 teaches the putt and the bend. A straight run, one banked right-hand
// curve, and a green. The quick line is to bank it off the outside board.
const b = new HoleBuilder({ id: 'kickoff', name: 'Kickoff', par: 2, boards: [PINK, LIME] });

b.at(0, 0, 0)
  .width(2.6)
  .walls('rail')
  .cap()
  .tee(0.9)
  .straight(6.5)
  .turn(90, 3.2, { bank: 0.22, left: 'board' })
  .straight(2.5, { width: 3.4 })
  .straight(3.2)
  .cup(-1.3)
  .cap('board');

// A low hump on the straight: putt dead centre and it runs true, off centre and it drifts.
b.mound(3.4, 0, 0.9, 0.1);

export default b.build();
