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
 */
export const LANDMARKS: Array<{ id: string; label: string; point: Point }> = [
  { id: "black-spot", label: "Black spot", point: SPOTS.black },
  { id: "pink-spot", label: "Pink spot", point: SPOTS.pink },
  { id: "blue-spot", label: "Blue spot", point: SPOTS.blue },
  { id: "brown-spot", label: "Brown spot", point: SPOTS.brown },
  { id: "yellow-spot", label: "Yellow spot", point: SPOTS.yellow },
  { id: "green-spot", label: "Green spot", point: SPOTS.green },
  { id: "top-left-pocket", label: "Top left pocket", point: POCKETS.topLeft },
  { id: "top-right-pocket", label: "Top right pocket", point: POCKETS.topRight },
  { id: "middle-left-pocket", label: "Left middle pocket", point: POCKETS.middleLeft },
  { id: "middle-right-pocket", label: "Right middle pocket", point: POCKETS.middleRight },
  { id: "bottom-left-pocket", label: "Bottom left pocket", point: POCKETS.bottomLeft },
  { id: "bottom-right-pocket", label: "Bottom right pocket", point: POCKETS.bottomRight },
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
 * How the real table sits in the camera's world, worked out from two landmarks.
 *
 * The bed is flat, so once the camera has found its plane, two known points fix everything else:
 * where the table is, and which way it faces. Seen from above, table x runs along world x and
 * table y along world z (towards the camera when standing at baulk), turned by `angle`.
 */
export type TableFrame = {
  origin: { x: number; z: number };
  angle: number;
  /** Height of the bed in the world, in metres. */
  height: number;
  /** How far the two tapped points were from where the table says they should be, in mm. */
  errorMm: number;
};

const MM_PER_METRE = 1000;

export const frameFromLandmarks = (
  first: { table: Point; world: WorldPoint },
  second: { table: Point; world: WorldPoint }
): TableFrame => {
  const tableAngle = Math.atan2(second.table.y - first.table.y, second.table.x - first.table.x);
  const worldAngle = Math.atan2(second.world.z - first.world.z, second.world.x - first.world.x);
  const angle = worldAngle - tableAngle;

  // Place the table so the first landmark lands where it was tapped.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = first.table.x / MM_PER_METRE;
  const ty = first.table.y / MM_PER_METRE;
  const origin = {
    x: first.world.x - (tx * cos - ty * sin),
    z: first.world.z - (tx * sin + ty * cos),
  };

  const measured = Math.hypot(second.world.x - first.world.x, second.world.z - first.world.z) * MM_PER_METRE;
  const expected = distance(first.table, second.table);

  return { origin, angle, height: (first.world.y + second.world.y) / 2, errorMm: Math.abs(measured - expected) };
};

/** A table position to the world, with the point raised to the centre of a ball. */
export const tableToWorld = (frame: TableFrame, point: Point): WorldPoint => {
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);
  const tx = point.x / MM_PER_METRE;
  const ty = point.y / MM_PER_METRE;
  return {
    x: frame.origin.x + tx * cos - ty * sin,
    y: frame.height + BALL_RADIUS / MM_PER_METRE,
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
    x: (dx * cos + dz * sin) * MM_PER_METRE,
    y: (-dx * sin + dz * cos) * MM_PER_METRE,
  };
};

/** How far to trust a calibration, from how well the two landmarks matched the table. */
export const calibrationQuality = (errorMm: number): "good" | "fair" | "poor" => {
  if (errorMm <= 20) return "good";
  if (errorMm <= 50) return "fair";
  return "poor";
};
