// The app's real table, in millimetres (src/features/scanSnooker/table.ts), drawn the way the app
// draws a routine: on its side, black end on the left, baulk and the D on the right, yellow at the
// top. Table x runs across (0 at the green-side cushion), table y runs along (0 at the black end).

export const TABLE = { length: 3569, width: 1778, ball: 52.5, baulkFromBottom: 737, dRadius: 292, blackFromTop: 324 } as const;
export const BALL_R = TABLE.ball / 2;
/** The wooden rail around the bed, as a share of the bed's width (TableDiagram's RAIL_SHARE). */
export const RAIL = TABLE.width * 0.055;
export const VIEW_W = TABLE.length + RAIL * 2;
export const VIEW_H = TABLE.width + RAIL * 2;
export const BAULK_Y = TABLE.length - TABLE.baulkFromBottom;

export type Colour = "white" | "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";
export type SpotColour = Exclude<Colour, "white" | "red">;
export type SpotId = `spot-${SpotColour}`;
export type Point = { x: number; y: number };
export type Ball = { id: string; color: Colour; x: number; y: number; label?: string };

export const COLOURS: Colour[] = ["white", "red", "yellow", "green", "brown", "blue", "pink", "black"];
export const SPOT_COLOURS: SpotColour[] = ["yellow", "green", "brown", "blue", "pink", "black"];

export const LOOK: Record<Colour, { fill: string; edge: string; label: string; key: string }> = {
  white: { fill: "#F7F4EA", edge: "#B9B4A4", label: "Cue ball", key: "1" },
  red: { fill: "#D0142F", edge: "#8E0B20", label: "Red", key: "2" },
  yellow: { fill: "#F2C230", edge: "#B08A10", label: "Yellow", key: "3" },
  green: { fill: "#1F8A4C", edge: "#0F5A2E", label: "Green", key: "4" },
  brown: { fill: "#7A4B2A", edge: "#4E2F18", label: "Brown", key: "5" },
  blue: { fill: "#1B6FD0", edge: "#0E4686", label: "Blue", key: "6" },
  pink: { fill: "#F29AC0", edge: "#C0648C", label: "Pink", key: "7" },
  black: { fill: "#1A1E20", edge: "#5A5F62", label: "Black", key: "8" },
};

const centreX = TABLE.width / 2;
export const SPOTS: Record<SpotColour, Point> = {
  yellow: { x: centreX + TABLE.dRadius, y: BAULK_Y },
  brown: { x: centreX, y: BAULK_Y },
  green: { x: centreX - TABLE.dRadius, y: BAULK_Y },
  blue: { x: centreX, y: TABLE.length / 2 },
  pink: { x: centreX, y: TABLE.length / 4 },
  black: { x: centreX, y: TABLE.blackFromTop },
};

export const POCKETS: Point[] = [
  { x: 0, y: 0 },
  { x: TABLE.width, y: 0 },
  { x: 0, y: TABLE.length / 2 },
  { x: TABLE.width, y: TABLE.length / 2 },
  { x: 0, y: TABLE.length },
  { x: TABLE.width, y: TABLE.length },
];

/** Table millimetres to the drawing's coordinates, and back. */
export const toView = (p: Point): Point => ({ x: RAIL + p.y, y: RAIL + (TABLE.width - p.x) });
export const fromView = (v: Point): Point => ({ x: TABLE.width - (v.y - RAIL), y: v.x - RAIL });

/** Keeps a ball's centre on the bed, never half into a cushion. */
export const clampToBed = (p: Point): Point => ({
  x: Math.min(TABLE.width - BALL_R, Math.max(BALL_R, p.x)),
  y: Math.min(TABLE.length - BALL_R, Math.max(BALL_R, p.y)),
});

export const isOnBed = (p: Point) => p.x >= BALL_R - 0.5 && p.x <= TABLE.width - BALL_R + 0.5 && p.y >= BALL_R - 0.5 && p.y <= TABLE.length - BALL_R + 0.5;

/** The file stores 0-1 shares of the table; the builder works in millimetres. */
export const fromStored = (b: { id: string; color: Colour; x: number; y: number; label?: string }): Ball => ({
  ...b,
  x: b.x * TABLE.width,
  y: b.y * TABLE.length,
});
const r5 = (n: number) => Math.round(n * 100000) / 100000;
export const toStored = (b: Ball) => {
  const out: { id: string; color: Colour; x: number; y: number; label?: string } = {
    id: b.id,
    color: b.color,
    x: r5(b.x / TABLE.width),
    y: r5(b.y / TABLE.length),
  };
  if (b.label) out.label = b.label;
  return out;
};

/**
 * The colours the app drops on their spots for this routine: every colour in its spot list that
 * the routine doesn't place itself (the same rule as getRoutinePlacedBalls in routineLayouts.ts).
 */
export const autoSpotBalls = (balls: Ball[], spotMarkers: SpotId[]): Ball[] => {
  const placed = new Set(balls.map((b) => b.color));
  return SPOT_COLOURS.filter((c) => !placed.has(c) && spotMarkers.includes(`spot-${c}`)).map((c) => ({
    id: `spot-${c}`,
    color: c,
    ...SPOTS[c],
  }));
};

/** A guide drawn at an angle, as the stretch of it that lies on the bed. */
export type GuideLine = { from: Point; to: Point };

export type Snapped = Point & { guideX: number | null; guideY: number | null; guideLine?: GuideLine | null };

/** The part of the infinite line through `a` and `b` that crosses the bed (Liang-Barsky clipping). */
export const lineAcrossBed = (a: Point, b: Point): GuideLine | null => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-6) return null;
  let t0 = -Infinity;
  let t1 = Infinity;
  const edges: Array<[number, number, number, number]> = [
    [dx, a.x, 0, TABLE.width],
    [dy, a.y, 0, TABLE.length],
  ];
  for (const [d, start, min, max] of edges) {
    if (Math.abs(d) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    const ta = (min - start) / d;
    const tb = (max - start) / d;
    t0 = Math.max(t0, Math.min(ta, tb));
    t1 = Math.min(t1, Math.max(ta, tb));
  }
  if (t0 > t1) return null;
  return { from: { x: a.x + dx * t0, y: a.y + dy * t0 }, to: { x: a.x + dx * t1, y: a.y + dy * t1 } };
};

/** Lines closer than this to straight along or across are left to the along/across guides. */
const NEAR_AXIS = Math.sin((3 * Math.PI) / 180);

type Diagonal = { point: Point; distance: number; a: Point; b: Point };

/**
 * The nearest diagonal a point could sit on: the line through any two other balls (lining a ball
 * up for a plant, or on a pot line), or a true 45 degrees from any one ball. Lines that are nearly
 * straight along or across the table are skipped, since those guides already exist.
 */
const nearestDiagonal = (raw: Point, others: Point[], threshold: number): Diagonal | null => {
  let best: Diagonal | null = null;
  const consider = (a: Point, ux: number, uy: number) => {
    const length = Math.hypot(ux, uy);
    const nx = ux / length;
    const ny = uy / length;
    if (Math.abs(nx) < NEAR_AXIS || Math.abs(ny) < NEAR_AXIS) return;
    const t = (raw.x - a.x) * nx + (raw.y - a.y) * ny;
    const point = { x: a.x + nx * t, y: a.y + ny * t };
    const distance = Math.hypot(raw.x - point.x, raw.y - point.y);
    if (distance < threshold && (!best || distance < best.distance)) {
      best = { point, distance, a, b: { x: a.x + nx, y: a.y + ny } };
    }
  };
  for (let i = 0; i < others.length; i++) {
    const a = others[i];
    // Between two balls: only when they aren't touching, or the line is meaningless.
    for (let j = i + 1; j < others.length; j++) {
      const b = others[j];
      if (Math.hypot(b.x - a.x, b.y - a.y) > TABLE.ball * 1.5) consider(a, b.x - a.x, b.y - a.y);
    }
    consider(a, 1, 1);
    consider(a, 1, -1);
  }
  return best;
};

/**
 * Where a pointer lands: lined up with another ball's along or across position, or on a diagonal
 * (through two other balls, or 45 degrees from one), when it's within `threshold` mm of one - a
 * guide line shows which - otherwise on the grid if one is set. The nearest line wins, so the
 * along/across guides behave exactly as before unless a diagonal is closer.
 */
export const snapPoint = (raw: Point, others: Point[], threshold: number, grid: number | null): Snapped => {
  let x = raw.x;
  let y = raw.y;
  let guideX: number | null = null;
  let guideY: number | null = null;
  let bestX = threshold;
  let bestY = threshold;
  for (const o of others) {
    const dx = Math.abs(o.x - raw.x);
    const dy = Math.abs(o.y - raw.y);
    if (dx < bestX) {
      bestX = dx;
      x = o.x;
      guideX = o.x;
    }
    if (dy < bestY) {
      bestY = dy;
      y = o.y;
      guideY = o.y;
    }
  }

  const diagonal = nearestDiagonal(raw, others, threshold);
  const nearestStraight = Math.min(guideX !== null ? bestX : Infinity, guideY !== null ? bestY : Infinity);
  if (diagonal && diagonal.distance < nearestStraight) {
    const onBed = clampToBed(diagonal.point);
    // A clamp would pull the ball off the line, so only show the guide when it really sits on it.
    const exact = onBed.x === diagonal.point.x && onBed.y === diagonal.point.y;
    return { ...onBed, guideX: null, guideY: null, guideLine: exact ? lineAcrossBed(diagonal.a, diagonal.b) : null };
  }

  if (grid) {
    if (guideX === null) x = Math.round(raw.x / grid) * grid;
    if (guideY === null) y = Math.round(raw.y / grid) * grid;
  }
  const clamped = clampToBed({ x, y });
  return { ...clamped, guideX: clamped.x === x ? guideX : null, guideY: clamped.y === y ? guideY : null, guideLine: null };
};

/**
 * The balls a line drag would place, start to end. With no fixed count they fill the dragged
 * distance at `spacing` apart; with a count the drag only aims the line. The preview and the
 * placement both come from here, so the preview never shows something release won't do.
 */
export const linePositions = (start: Point, end: Point, spacing: number, count: number | null): Point[] => {
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  if (dist < 1) return count ? [start] : [];
  const ux = (end.x - start.x) / dist;
  const uy = (end.y - start.y) / dist;
  const n = count ?? Math.max(2, Math.round(dist / spacing) + 1);
  return Array.from({ length: n }, (_, i) => ({ x: start.x + ux * spacing * i, y: start.y + uy * spacing * i }));
};

/**
 * An arrow on the table: a shot's path, say, solid for the cue ball and dashed for the object
 * ball. In table millimetres here; stored as shares of the table like the balls.
 */
export type Arrow = { id: string; from: Point; to: Point; dashed?: boolean };
export type StoredArrow = { id: string; x1: number; y1: number; x2: number; y2: number; dashed?: boolean };

export const arrowFromStored = (a: StoredArrow): Arrow => ({
  id: a.id,
  from: { x: a.x1 * TABLE.width, y: a.y1 * TABLE.length },
  to: { x: a.x2 * TABLE.width, y: a.y2 * TABLE.length },
  ...(a.dashed ? { dashed: true } : {}),
});
export const arrowToStored = (a: Arrow): StoredArrow => {
  const share = (value: number, of: number) => Math.round(Math.min(1, Math.max(0, value / of)) * 100000) / 100000;
  const out: StoredArrow = { id: a.id, x1: share(a.from.x, TABLE.width), y1: share(a.from.y, TABLE.length), x2: share(a.to.x, TABLE.width), y2: share(a.to.y, TABLE.length) };
  if (a.dashed) out.dashed = true;
  return out;
};

/** Shorter than this, an arrow drag was a click. */
export const MIN_ARROW_MM = 40;

/** A fresh arrow id (arrow-1, arrow-2...). */
export const nextArrowId = (arrows: Arrow[]) => {
  let n = arrows.reduce((max, a) => Math.max(max, Number(/-(\d+)$/.exec(a.id)?.[1] ?? 0)), 0);
  let id: string;
  do {
    n += 1;
    id = `arrow-${n}`;
  } while (arrows.some((a) => a.id === id));
  return id;
};

/**
 * The shaft and head of an arrow in the drawing's coordinates: the shaft stops where the head
 * begins, so a thick line doesn't poke through the point.
 */
export const arrowShape = (from: Point, to: Point, head = 64) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const size = Math.min(head, length * 0.6);
  const base = { x: to.x - ux * size, y: to.y - uy * size };
  const half = size * 0.45;
  return {
    shaft: { x1: from.x, y1: from.y, x2: base.x, y2: base.y },
    head: `${to.x},${to.y} ${base.x - uy * half},${base.y + ux * half} ${base.x + uy * half},${base.y - ux * half}`,
  };
};

/** The pack sizes the builder offers: full triangles of 2, 3, 4 and 5 rows. */
export const PACK_SIZES = [3, 6, 10, 15] as const;

/** Which way a pack's front ball faces: towards baulk (as racked for a frame) or towards the black. */
export type PackFacing = "baulk" | "black";

/**
 * A triangle of touching balls, front ball first, the way a pack is racked. Each row is one ball
 * wider and sits further from where the pack points. Neighbours are a fifth of a millimetre apart,
 * so storing the positions as shares of the table never rounds two of them into an overlap.
 */
export const packPositions = (front: Point, size: number, facing: PackFacing = "baulk"): Point[] => {
  let rows = 1;
  while ((rows * (rows + 1)) / 2 < size) rows += 1;
  const gap = TABLE.ball + 0.2;
  const rowStep = (gap * Math.sqrt(3)) / 2;
  // Facing baulk, the rows run back towards the black end, where along is smaller.
  const back = facing === "baulk" ? -1 : 1;
  const out: Point[] = [];
  for (let row = 0; row < rows && out.length < size; row += 1) {
    for (let i = 0; i <= row && out.length < size; i += 1) {
      out.push({ x: front.x + (i - row / 2) * gap, y: front.y + back * row * rowStep });
    }
  }
  return out;
};

/** Where the front ball of a full pack goes for a frame: just behind the pink, nearly touching it. */
export const PACK_FRONT_BEHIND_PINK: Point = { x: TABLE.width / 2, y: TABLE.length / 4 - TABLE.ball - 1 };

/** Pairs of balls closer than one ball-width: they'd be overlapping on a real table. */
export const overlapping = (balls: Ball[]): Set<string> => {
  const hits = new Set<string>();
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      if (Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y) < TABLE.ball - 0.5) {
        hits.add(balls[i].id);
        hits.add(balls[j].id);
      }
    }
  }
  return hits;
};

/** A fresh id for a new ball, like the ones already in the file (red-12, white-3). */
export const nextId = (balls: Ball[], color: Colour, taken: Set<string> = new Set()) => {
  let n = balls.reduce((max, b) => {
    const m = /-(\d+)$/.exec(b.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  let id: string;
  do {
    n += 1;
    id = `${color}-${n}`;
  } while (balls.some((b) => b.id === id) || taken.has(id));
  return id;
};

export const fmt = (mm: number) => (Math.round(mm * 10) / 10).toFixed(1);
