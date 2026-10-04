/**
 * A full-size snooker table, in millimetres, and the maths for placing balls on it.
 *
 * Everything in Scan Snooker - the diagram, and later the AR view - works in these table
 * coordinates rather than in screen pixels or camera space, so a position recorded once can be
 * shown anywhere: on the diagram, on any phone's screen size, or on the real table through the
 * camera after calibrating from any two landmarks.
 *
 * Coordinates are seen from the baulk end, the way a player breaks off:
 *   x runs from the left cushion (0) to the right cushion (TABLE.width),
 *   y runs from the top cushion at the black end (0) to the bottom cushion at baulk (TABLE.length).
 * Both are measured on the playing surface, to the nose of the cushions.
 */

/** A standard 12ft table, to the World Snooker Tour template. */
export const TABLE = {
  length: 3569,
  width: 1778,
  ball: 52.5,
  /** The baulk line, from the face of the bottom cushion. */
  baulkFromBottom: 737,
  dRadius: 292,
  /** The black spot, from the face of the top cushion. */
  blackFromTop: 324,
} as const;

export const BALL_RADIUS = TABLE.ball / 2;

export type Point = { x: number; y: number };

export type BallColour = "cue" | "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

/** The colours, in the order they are potted, and what each is worth. */
export const COLOURS: Array<{ id: Exclude<BallColour, "cue" | "red">; value: number }> = [
  { id: "yellow", value: 2 },
  { id: "green", value: 3 },
  { id: "brown", value: 4 },
  { id: "blue", value: 5 },
  { id: "pink", value: 6 },
  { id: "black", value: 7 },
];

/** How many of each ball can be on the table. */
export const BALL_LIMIT: Record<BallColour, number> = {
  cue: 1,
  red: 15,
  yellow: 1,
  green: 1,
  brown: 1,
  blue: 1,
  pink: 1,
  black: 1,
};

const baulkY = TABLE.length - TABLE.baulkFromBottom;
const centreX = TABLE.width / 2;

/** Each colour's spot. Seen from baulk, the yellow is on the right of the D, the green on the left. */
export const SPOTS: Record<Exclude<BallColour, "cue" | "red">, Point> = {
  yellow: { x: centreX + TABLE.dRadius, y: baulkY },
  brown: { x: centreX, y: baulkY },
  green: { x: centreX - TABLE.dRadius, y: baulkY },
  blue: { x: centreX, y: TABLE.length / 2 },
  pink: { x: centreX, y: TABLE.length / 4 },
  black: { x: centreX, y: TABLE.blackFromTop },
};

export const BAULK_LINE_Y = baulkY;

/** The six pockets, at the point where the two cushion lines would meet. */
export const POCKETS: Record<string, Point> = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: TABLE.width, y: 0 },
  middleLeft: { x: 0, y: TABLE.length / 2 },
  middleRight: { x: TABLE.width, y: TABLE.length / 2 },
  bottomLeft: { x: 0, y: TABLE.length },
  bottomRight: { x: TABLE.width, y: TABLE.length },
};

/**
 * Points a player can find on any table and tap to calibrate. Any two will do, so whichever are
 * in view - and not hidden under a ball - can be used.
 *
 * Spots only, not pockets: a spot is a small, precisely regulated mark in a fixed position
 * relative to the cushions on every table, but a pocket's "centre" is genuinely fuzzy - jaw shape,
 * liner wear and manufacturer all vary it by more than the spots ever vary, making it a much
 * noisier thing to tap accurately.
 */
export const LANDMARKS: Array<{ id: string; label: string; point: Point }> = [
  { id: "black-spot", label: "Black spot", point: SPOTS.black },
  { id: "pink-spot", label: "Pink spot", point: SPOTS.pink },
  { id: "blue-spot", label: "Blue spot", point: SPOTS.blue },
  { id: "brown-spot", label: "Brown spot", point: SPOTS.brown },
  { id: "yellow-spot", label: "Yellow spot", point: SPOTS.yellow },
  { id: "green-spot", label: "Green spot", point: SPOTS.green },
];

// ---------------------------------------------------------------------------- measuring

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Keeps a ball's centre on the bed: it cannot sit closer to a cushion than its own radius. */
export const clampToBed = (point: Point): Point => ({
  x: Math.min(TABLE.width - BALL_RADIUS, Math.max(BALL_RADIUS, point.x)),
  y: Math.min(TABLE.length - BALL_RADIUS, Math.max(BALL_RADIUS, point.y)),
});

/** "1.24 m" or "38 cm", to the nearest centimetre. */
export const formatLength = (mm: number) => {
  const cm = Math.round(Math.abs(mm) / 10);
  return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm} cm`;
};

/**
 * Where a ball sits, as a referee would measure it: from the nearer side cushion and from the
 * nearer end cushion. For putting a ball back by hand with the diagram.
 */
export const describePosition = (point: Point) => {
  const fromLeft = point.x - BALL_RADIUS;
  const fromRight = TABLE.width - point.x - BALL_RADIUS;
  const fromTop = point.y - BALL_RADIUS;
  const fromBottom = TABLE.length - point.y - BALL_RADIUS;
  const side = fromLeft <= fromRight ? `${formatLength(fromLeft)} from the left cushion` : `${formatLength(fromRight)} from the right cushion`;
  const end = fromTop <= fromBottom ? `${formatLength(fromTop)} from the top cushion` : `${formatLength(fromBottom)} from the baulk cushion`;
  return { side, end };
};

/**
 * Which way to move a ball from where it is to where it was, for the replace guidance:
 * "4 cm towards the black, 1 cm left". Anything within 5 mm counts as in place.
 */
export const describeCorrection = (from: Point, to: Point) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) <= 5) return null;
  const parts: string[] = [];
  if (Math.abs(dy) > 5) parts.push(`${formatLength(dy)} ${dy < 0 ? "towards the black" : "towards baulk"}`);
  if (Math.abs(dx) > 5) parts.push(`${formatLength(dx)} ${dx < 0 ? "left" : "right"}`);
  return parts.join(", ");
};

// ---------------------------------------------------------------------------- calibration

/** A point on the real table as the camera sees it, in metres. ARKit's y is up. */
export type WorldPoint = { x: number; y: number; z: number };

/**
 * How the real table sits in the camera's world, worked out from two spots.
 *
 * The bed is flat, so once the camera has found its plane, two known points fix everything else:
 * where the table is, which way it faces, and - see `scale` - how big it really is. Seen from
 * above, table x runs along world x and table y along world z (towards the camera when standing at
 * baulk), turned by `angle`.
 */
export type TableFrame = {
  origin: { x: number; z: number };
  angle: number;
  /** Height of the bed in the world, in metres. */
  height: number;
  /** How much bigger (or smaller) this real table is than a regulation one - 1 means exactly
   * regulation size. See `frameFromLandmarks`. */
  scale: number;
};

const MM_PER_METRE = 1000;

export const frameFromLandmarks = (
  first: { table: Point; world: WorldPoint },
  second: { table: Point; world: WorldPoint }
): TableFrame => {
  const tableAngle = Math.atan2(second.table.y - first.table.y, second.table.x - first.table.x);
  const worldAngle = Math.atan2(second.world.z - first.world.z, second.world.x - first.world.x);
  const angle = worldAngle - tableAngle;

  const measured = Math.hypot(second.world.x - first.world.x, second.world.z - first.world.z) * MM_PER_METRE;
  const expected = distance(first.table, second.table);
  // The two tapped spots are trusted over the regulation distance between them - a real table's
  // cloth can be a little bigger or smaller than spec (stretch, wear, a non-standard table), and
  // forcing every other position to regulation spacing regardless just because the taps disagree
  // with it compounds into a table drawn a few cm short (or long) of the real cushions the further
  // a point is from the spot that was tapped.
  const scale = measured / expected;

  // Place the table so the first spot lands where it was tapped.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = (first.table.x / MM_PER_METRE) * scale;
  const ty = (first.table.y / MM_PER_METRE) * scale;
  const origin = {
    x: first.world.x - (tx * cos - ty * sin),
    z: first.world.z - (tx * sin + ty * cos),
  };

  return { origin, angle, height: (first.world.y + second.world.y) / 2, scale };
};

/**
 * A table position to the world. Raised to the centre of a ball by default; pass 0 for a point
 * on the cloth itself, such as the table lines.
 */
export const tableToWorld = (frame: TableFrame, point: Point, raiseMm: number = BALL_RADIUS): WorldPoint => {
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);
  const tx = (point.x / MM_PER_METRE) * frame.scale;
  const ty = (point.y / MM_PER_METRE) * frame.scale;
  return {
    x: frame.origin.x + tx * cos - ty * sin,
    y: frame.height + raiseMm / MM_PER_METRE,
    z: frame.origin.z + tx * sin + ty * cos,
  };
};

/** A point the camera found on the bed, as a table position. */
export const worldToTable = (frame: TableFrame, point: WorldPoint): Point => {
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);
  const dx = point.x - frame.origin.x;
  const dz = point.z - frame.origin.z;
  return {
    x: ((dx * cos + dz * sin) / frame.scale) * MM_PER_METRE,
    y: ((-dx * sin + dz * cos) / frame.scale) * MM_PER_METRE,
  };
};

/** "Matches a regulation table", "6% bigger than standard", or "6% smaller than standard" - for
 * the calibration check screen. */
export const describeScale = (scale: number) => {
  const percent = Math.round(Math.abs(scale - 1) * 100);
  return percent === 0 ? "Matches a regulation table" : `${percent}% ${scale > 1 ? "bigger" : "smaller"} than standard`;
};

/** How far to trust a calibration, from how much bigger or smaller the tapped spots came out than
 * a regulation table - a little either way is just that table's own cloth; a lot suggests a
 * mis-tap (the wrong spot, or tracking that had not settled yet). */
export const calibrationQuality = (scale: number): "good" | "fair" | "poor" => {
  const off = Math.abs(scale - 1);
  if (off <= 0.05) return "good";
  if (off <= 0.15) return "fair";
  return "poor";
};
