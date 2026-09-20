import { RoutineDiagram } from "../types";

/**
 * Diagrams for the routines that were written before the library had any.
 *
 * They live apart from the routines themselves only because those entries are already long;
 * routines.ts folds them in by id, so a drill with no entry here simply has no picture.
 *
 * Coordinates are fractions of the playing surface: x from the left cushion, y from the baulk
 * cushion, so the blue sits at (0.5, 0.5), the pink at (0.5, 0.75) and the black at (0.5, 0.91).
 */

const SPOT = {
  yellow: [0.663, 0.206] as const,
  green: [0.337, 0.206] as const,
  brown: [0.5, 0.206] as const,
  blue: [0.5, 0.5] as const,
  pink: [0.5, 0.75] as const,
  black: [0.5, 0.909] as const,
};

const colours = (): RoutineDiagram["balls"] => [
  { colour: "yellow", x: SPOT.yellow[0], y: SPOT.yellow[1] },
  { colour: "green", x: SPOT.green[0], y: SPOT.green[1] },
  { colour: "brown", x: SPOT.brown[0], y: SPOT.brown[1] },
  { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
  { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
  { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
];

const BALL_W = 0.048;
const BALL_L = BALL_W / 2;

/** The full triangle, apex behind the pink, widening towards the black. */
const pack = (apexY = 0.78): RoutineDiagram["balls"] =>
  Array.from({ length: 5 }).flatMap((_, row) =>
    Array.from({ length: row + 1 }, (_, index) => ({
      colour: "red" as const,
      x: 0.5 + (index - row / 2) * BALL_W,
      y: apexY + row * BALL_L * 0.866,
    }))
  );

/**
 * The line-up as it is actually set: two reds above the black, four between black and pink,
 * seven between pink and blue, two between blue and brown. The gaps are the colour spots.
 */
export const LINE_UP_REDS: RoutineDiagram["balls"] = [
  0.96, 0.935,
  0.875, 0.85, 0.815, 0.785,
  0.72, 0.69, 0.66, 0.63, 0.6, 0.57, 0.54,
  0.44, 0.37,
].map((y) => ({ colour: "red" as const, x: 0.5, y }));

export const FIRST_WAVE_DIAGRAMS: Record<string, RoutineDiagram> = {
  "routine-line-up": {
    balls: [...LINE_UP_REDS, ...colours()],
    caption: "Two reds above the black, four to the pink, seven to the blue, two below it.",
  },

  "routine-t-routine": {
    balls: [
      ...[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((x) => ({ colour: "red" as const, x, y: 0.71 })),
      ...[0.67, 0.63, 0.59, 0.55, 0.47, 0.43, 0.39, 0.35].map((y) => ({ colour: "red" as const, x: 0.5, y })),
      ...colours(),
    ],
    caption: "A bar of reds under the pink and a stem running down towards the blue.",
  },

  "routine-around-colours": {
    balls: [...colours(), { colour: "cue", x: 0.6, y: 0.28 }],
    caption: "Six colours on their spots, cleared yellow through black.",
  },

  "routine-3-reds-colours": {
    balls: [
      { colour: "red", x: 0.4, y: 0.82 },
      { colour: "red", x: 0.58, y: 0.86 },
      { colour: "red", x: 0.46, y: 0.68 },
      ...colours(),
      { colour: "cue", x: 0.36, y: 0.6 },
    ],
    caption: "Three reds in the scoring area with every colour on its spot.",
  },

  "routine-break-building-foundations": {
    balls: [
      { colour: "red", x: 0.42, y: 0.84 },
      { colour: "red", x: 0.58, y: 0.8 },
      ...colours(),
      { colour: "cue", x: 0.46, y: 0.66 },
    ],
    caption: "Two reds near the black, so every shot is a pot and a position.",
  },

  "routine-pink-ball-routine": {
    balls: [
      { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
      { colour: "red", x: 0.32, y: 0.8 },
      { colour: "red", x: 0.68, y: 0.8 },
      { colour: "red", x: 0.42, y: 0.66 },
      { colour: "red", x: 0.6, y: 0.66 },
      { colour: "cue", x: 0.5, y: 0.6 },
    ],
    caption: "Reds around the pink, each one a different angle back onto it.",
  },

  "routine-baulk-safety": {
    balls: [
      { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
      { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
      ...pack(),
      { colour: "cue", x: 0.42, y: 0.16 },
    ],
    caption: "From behind baulk, clip the pack and bring the white back behind the line.",
    lines: [
      { from: [0.42, 0.16], to: [0.404, 0.863], kind: "shot" },
      { from: [0.404, 0.863], to: [0.5, 0.06], kind: "travel" },
    ],
  },

  "routine-escape-science": {
    balls: [
      { colour: "black", x: 0.5, y: 0.5 },
      { colour: "cue", x: 0.5, y: 0.38 },
      { colour: "red", x: 0.8, y: 0.84 },
    ],
    lines: [
      { from: [0.5, 0.38], to: [0.04, 0.6], kind: "shot" },
      { from: [0.04, 0.6], to: [0.8, 0.84], kind: "travel" },
    ],
    caption: "Snookered behind the black: work out the cushion angle rather than guessing.",
  },

  "routine-two-cushion-escape": {
    balls: [
      { colour: "brown", x: SPOT.brown[0], y: SPOT.brown[1] },
      { colour: "cue", x: 0.5, y: 0.12 },
      { colour: "red", x: 0.74, y: 0.88 },
    ],
    lines: [
      { from: [0.5, 0.12], to: [0.04, 0.44], kind: "shot" },
      { from: [0.04, 0.44], to: [0.6, 0.98], kind: "travel" },
      { from: [0.6, 0.98], to: [0.74, 0.88], kind: "travel" },
    ],
    caption: "Side cushion, top cushion, then the red. Two cushions is usually the safest route.",
  },

  "routine-three-cushion-escape": {
    balls: [
      { colour: "brown", x: SPOT.brown[0], y: SPOT.brown[1] },
      { colour: "cue", x: 0.44, y: 0.1 },
      { colour: "red", x: 0.28, y: 0.9 },
    ],
    lines: [
      { from: [0.44, 0.1], to: [0.96, 0.36], kind: "shot" },
      { from: [0.96, 0.36], to: [0.04, 0.72], kind: "travel" },
      { from: [0.04, 0.72], to: [0.5, 0.98], kind: "travel" },
      { from: [0.5, 0.98], to: [0.28, 0.9], kind: "travel" },
    ],
    caption: "Three cushions, for when a shorter route is covered.",
  },

  "routine-straight-cueing-line": {
    balls: [
      ...[0.82, 0.74, 0.66, 0.58].map((y) => ({ colour: "red" as const, x: 0.5, y })),
      { colour: "cue", x: 0.5, y: 0.3 },
    ],
    lines: [{ from: [0.5, 0.3], to: [0.5, 0.98], kind: "shot" }],
    caption: "Reds dead in line with the pocket, so only a straight cue will do.",
  },

  "routine-long-blue-straight-cue": {
    balls: [
      { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
      { colour: "cue", x: 0.5, y: 0.14 },
    ],
    lines: [{ from: [0.5, 0.14], to: [0.5, 0.5], kind: "shot" }],
    caption: "Blue on its spot, white on the centre line: the longest straight pot on the table.",
  },

  "routine-cueing-secret-session": {
    balls: [{ colour: "cue", x: 0.5, y: 0.206 }],
    lines: [
      { from: [0.5, 0.206], to: [0.5, 0.98], kind: "shot" },
      { from: [0.5, 0.98], to: [0.5, 0.206], kind: "travel" },
    ],
    caption: "No object ball at all. Just the white, the length of the table, and your delivery.",
  },

  "routine-cue-ball-control": {
    balls: [
      { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
      { colour: "cue", x: 0.36, y: 0.38 },
    ],
    lines: [
      { from: [0.5, 0.5], to: [0.5, 0.78], kind: "travel" },
      { from: [0.5, 0.5], to: [0.5, 0.24], kind: "travel" },
    ],
    caption: "One pot, three different finishing positions: stop, follow, and screw back.",
  },

  "routine-stun-run-through": {
    balls: [
      { colour: "red", x: 0.5, y: 0.7 },
      { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
      { colour: "cue", x: 0.42, y: 0.5 },
    ],
    lines: [
      { from: [0.42, 0.5], to: [0.5, 0.7], kind: "shot" },
      { from: [0.5, 0.7], to: [0.62, 0.8], kind: "travel" },
    ],
    caption: "Stun into the red and let the white run on the smallest distance you can manage.",
  },

  "routine-top-spin-control": {
    balls: [
      { colour: "red", x: 0.5, y: 0.62 },
      { colour: "cue", x: 0.5, y: 0.3 },
    ],
    lines: [
      { from: [0.5, 0.3], to: [0.5, 0.62], kind: "shot" },
      { from: [0.5, 0.62], to: [0.5, 0.96], kind: "travel" },
    ],
    caption: "Straight pot, then see how far top spin carries the white up the table.",
  },

  "routine-side-spin-control": {
    balls: [{ colour: "cue", x: 0.5, y: 0.3 }],
    lines: [
      { from: [0.5, 0.3], to: [0.5, 0.96], kind: "shot" },
      { from: [0.5, 0.96], to: [0.16, 0.6], kind: "travel" },
    ],
    caption: "Side spin changes the angle off the cushion. Learn how much, at each pace.",
  },

  "routine-stun-line": {
    balls: [
      ...[0.34, 0.42, 0.5, 0.58, 0.66].map((x) => ({ colour: "red" as const, x, y: 0.66 })),
      { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
      { colour: "cue", x: 0.5, y: 0.44 },
    ],
    caption: "A line of reds taken with stun, so the white barely moves between shots.",
  },

  "routine-screw-back": {
    balls: [
      { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
      { colour: "cue", x: 0.5, y: 0.34 },
    ],
    lines: [
      { from: [0.5, 0.34], to: [0.5, 0.5], kind: "shot" },
      { from: [0.5, 0.5], to: [0.5, 0.18], kind: "travel" },
    ],
    caption: "Straight blue, and the white screwed back down the same line.",
  },

  "routine-deep-screw": {
    balls: [
      { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
      { colour: "cue", x: 0.5, y: 0.42 },
    ],
    lines: [
      { from: [0.5, 0.42], to: [0.5, 0.5], kind: "shot" },
      { from: [0.5, 0.5], to: [0.5, 0.04], kind: "travel" },
    ],
    caption: "Close to the object ball, screwing the white the length of the table back to baulk.",
  },

  "routine-long-potting-classic": {
    balls: [
      { colour: "red", x: 0.2, y: 0.8 },
      { colour: "red", x: 0.5, y: 0.8 },
      { colour: "red", x: 0.8, y: 0.8 },
      { colour: "cue", x: 0.44, y: 0.18 },
    ],
    lines: [{ from: [0.44, 0.18], to: [0.2, 0.8], kind: "shot" }],
    caption: "Reds near the top of the table, potted from behind the baulk line.",
  },

  "routine-black-off-spot": {
    balls: [
      { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
      { colour: "cue", x: 0.6, y: 0.82 },
    ],
    lines: [{ from: [0.6, 0.82], to: [0.5, 0.909], kind: "shot" }],
    caption: "Black on its spot, played again from wherever the white finishes.",
  },

  "routine-blue-ball-control": {
    balls: [
      { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
      { colour: "red", x: 0.28, y: 0.58 },
      { colour: "red", x: 0.72, y: 0.58 },
      { colour: "red", x: 0.4, y: 0.38 },
      { colour: "red", x: 0.6, y: 0.38 },
      { colour: "cue", x: 0.5, y: 0.62 },
    ],
    caption: "Reds set around the blue so every pot leaves a different angle back onto it.",
  },
};
