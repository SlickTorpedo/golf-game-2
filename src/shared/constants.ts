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

export const GRAVITY = 30;
export const SLOPE_ACCEL = 8;
export const BOOST_ACCEL = 26;
// A heavy ball: little air drag, so it carries its speed and then dies on the turf.
export const ROLL_DECEL = 3.4;
export const MUD_DECEL = 15;
export const DRAG = 0.35;
export const STOP_SPEED = 0.07;
export const RESTITUTION = 0.6; // off boards and ledges
export const WALL_GRIP = 0.94; // share of sideways speed kept in a wall hit
export const FLOOR_BOUNCE = 0.38; // hop when landing from a drop
export const MAX_SPEED = 17;

export const MIN_PUTT = 0.8;
export const MAX_PUTT = 12.5;

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
/** The pitch is this far below level 0; a falling ball is lost when it gets there. */
export const PITCH_DROP = 3.5;
export const KILL_Z = -PITCH_DROP + BALL_R;

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
