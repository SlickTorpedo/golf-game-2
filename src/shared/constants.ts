// Tuning and rules. Everything in src/shared is plain TypeScript with no DOM
// access, so the same code can run in the browser or under Node on a server.

export const PROTOCOL_VERSION = 2;

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const SUBSTEPS = 4;
/** The room sends one snapshot every N ticks. */
export const SNAPSHOT_EVERY = 2;

// World units: one map cell is 1 x 1.
export const BALL_R = 0.16;
export const LEVEL_H = 0.5; // height of one terrace level
export const WALL_H = 0.5; // height of a board above the floor it stands on
export const STEP_UP = 0.12; // ledges lower than this are rolled over

export const GRAVITY = 30;
/** Pull down a slope, per unit of gradient (a 1-in-2 ramp gives half of this). */
export const SLOPE_ACCEL = 16;
export const BOOST_ACCEL = 26;
// Friction works the way it does on a real putt (docs/research.md, "Ball physics"):
// a struck ball first slides, which slows it sharply and spins it up; once it is
// rolling it loses speed slowly and runs out a long way.
/** Slowing while the ball slides over the turf. */
export const SLIDE_DECEL = 10;
/** Slowing once it is rolling. */
export const ROLL_DECEL = 1.9;
export const MUD_DECEL = 15;
export const ICE_SLIDE = 1.2;
export const ICE_DECEL = 0.35;
export const STOP_SPEED = 0.05;
/** Share of its roll a ball keeps through a wall bounce; the rest it has to win back by skidding. */
export const BOUNCE_SPIN = 0.6;
export const RESTITUTION = 0.6; // off boards and ledges
export const WALL_GRIP = 0.94; // share of sideways speed kept in a wall hit
export const FLOOR_BOUNCE = 0.38; // hop when landing from a drop
export const MAX_SPEED = 17;

export const MIN_PUTT = 0.8;
export const MAX_PUTT = 10.5;

export const CUP_R = 0.27;
export const CUP_MAX_SPEED = 5.5; // faster than this and it lips out
export const CUP_PULL = 16; // the lip tugs a fast ball sideways
export const CUP_SLOPE = 2.2; // a slow ball close by trickles in

export const CONE_R = 0.22;
export const CONE_KICK = 3.5;
export const ARM_LEN = 1.3; // turnstile arm, centre to tip
export const ARM_R = 0.07;
export const SPIN_RATE = 1.5; // radians per second
export const TUNNEL_R = 0.3;
export const SPRING_R = 0.34;
export const SPRING_UP = 9;
/** The pitch is this far below level 0; a falling ball is lost when it gets there. */
export const PITCH_DROP = 3.5;
/** A ball this far below the lowest ground of the hole is lost. */
export const KILL_DROP = PITCH_DROP - BALL_R;

// Limits grow with the hole: a par 6 gets more putts and more time than a par 2.
/** Putts allowed on a hole before you are stopped. */
export const strokeCap = (par: number): number => Math.max(8, par * 2 + 2);
/** Seconds on the clock for a hole. */
export const holeSeconds = (par: number): number => 45 + par * 25;
/** What not holing out puts on the card. */
export const penaltyScore = (par: number): number => Math.min(strokeCap(par) + 1, par + 4);
/** Once only one player is still putting, the clock drops to this many seconds. */
export const LAST_PLAYER_SECONDS = 20;
export const INTRO_SECONDS = 2.5;
export const HOLE_END_SECONDS = 6;

export const MAX_ITEMS = 2;

// The aim sways from side to side while you hold a putt, so the release has to be timed.
/** How far it swings either way, in radians (about 7 degrees). */
export const SWAY_ANGLE = 0.12;
/** Seconds for one full swing there and back. */
export const SWAY_SECONDS = 2.2;
/** How much wider it swings after someone sounds the air horn at you. */
export const JITTER_SCALE = 2.6;
/** Putts a steadying drink lasts for. */
export const STEADY_PUTTS = 2;
export const MAX_PLAYERS = 8;
export const PICKUP_R = 0.45;
export const PICKUP_RESPAWN_SECONDS = 8;
export const DRUM_RADIUS = 3.5;
export const DRUM_PUSH = 8;
