// Tuning and rules. Everything in src/shared is plain TypeScript with no DOM
// access, so the same code can run in the browser or under Node on a server.

export const PROTOCOL_VERSION = 1;

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

export const GRAVITY = 20;
export const SLOPE_ACCEL = 9;
export const BOOST_ACCEL = 30;
export const ROLL_DECEL = 3;
export const MUD_DECEL = 14;
export const DRAG = 0.9;
export const STOP_SPEED = 0.06;
export const RESTITUTION = 0.72;
export const MAX_SPEED = 19;

export const MIN_PUTT = 1.2;
export const MAX_PUTT = 16;

export const CUP_R = 0.27;
export const CUP_MAX_SPEED = 7.5;
export const KILL_Z = -5;

export const STROKE_CAP = 8;
export const PENALTY_SCORE = 10;
export const HOLE_SECONDS = 90;
export const INTRO_SECONDS = 2.5;
export const HOLE_END_SECONDS = 9;

export const MAX_ITEMS = 2;
export const MAX_PLAYERS = 8;
export const PICKUP_R = 0.45;
export const PICKUP_RESPAWN_SECONDS = 8;
export const DRUM_RADIUS = 3.5;
export const DRUM_PUSH = 8;
