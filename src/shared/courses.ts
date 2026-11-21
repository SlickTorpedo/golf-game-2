import kickoff from './holes/01-kickoff';
import cornerKick from './holes/02-corner-kick';
import tribune from './holes/03-tribune';
import touchline from './holes/04-touchline';
import turnstile from './holes/05-turnstile';
import relegation from './holes/06-relegation';
import offsideTrap from './holes/07-offside-trap';
import upperTier from './holes/08-upper-tier';
import extraTime from './holes/09-extra-time';
import type { HoleDef } from './level';

/** The round, in playing order. Each hole is its own file in ./holes. */
export const STADIUM: HoleDef[] = [kickoff, cornerKick, tribune, touchline, turnstile, relegation, offsideTrap, upperTier, extraTime];
