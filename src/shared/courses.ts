import kickoff from './holes/01-kickoff';
import cornerKick from './holes/02-corner-kick';
import tribune from './holes/03-tribune';
import touchline from './holes/04-touchline';
import turnstile from './holes/05-turnstile';
import relegation from './holes/06-relegation';
import offsideTrap from './holes/07-offside-trap';
import upperTier from './holes/08-upper-tier';
import extraTime from './holes/09-extra-time';
import concourse from './holes/cuprun/01-concourse';
import carPark from './holes/cuprun/02-car-park';
import floodlightTower from './holes/cuprun/03-floodlight-tower';
import terraces from './holes/cuprun/04-terraces';
import groundsmansYard from './holes/cuprun/05-groundsmans-yard';
import lapOfHonour from './holes/cuprun/06-lap-of-honour';
import type { HoleDef } from './level';

export interface Course {
  id: string;
  name: string;
  /** A few words for the course picker. */
  blurb: string;
  holes: HoleDef[];
}

/** Every course, in the order the picker shows them. Each hole is its own file under ./holes. */
export const COURSES: Course[] = [
  {
    id: 'cup-run',
    name: 'Cup Run',
    blurb: 'big holes, many routes',
    holes: [concourse, carPark, floodlightTower, terraces, groundsmansYard, lapOfHonour],
  },
  {
    id: 'matchday',
    name: 'Matchday',
    blurb: 'short holes, a quick round',
    holes: [kickoff, cornerKick, tribune, touchline, turnstile, relegation, offsideTrap, upperTier, extraTime],
  },
];

export const ALL_HOLES: HoleDef[] = COURSES.flatMap((c) => c.holes);
