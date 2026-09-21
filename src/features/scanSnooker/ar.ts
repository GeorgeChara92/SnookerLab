import {
  BALL_RADIUS,
  BAULK_LINE_Y,
  SPOTS,
  TABLE,
  tableToWorld,
  worldToTable,
  type Point,
  type TableFrame,
  type WorldPoint,
} from "./table";

/**
 * Turning what the camera sees into table positions, and table positions into things to draw.
 * The camera view reports rays; everything here is plain maths, so it is tested without a phone.
 */

export type Ray = { origin: WorldPoint; direction: WorldPoint };

/** Where a ray from the camera reaches a given height, or null if it never does (aimed upwards). */
export const rayAtHeight = (ray: Ray, height: number): WorldPoint | null => {
  const { origin, direction } = ray;
  if (Math.abs(direction.y) < 1e-6) return null;
  const t = (height - origin.y) / direction.y;
  if (t <= 0) return null;
  return { x: origin.x + direction.x * t, y: height, z: origin.z + direction.z * t };
};

/**
 * Where a ball is, from aiming at it.
 *
 * Aimed at the middle of a ball, the camera's line of sight passes through its centre - which is
 * a ball's radius above the cloth. Following the ray down to the cloth would land behind the
 * ball, by a couple of centimetres at a typical angle, so it is followed to the height of a
 * ball's centre instead.
 */
export const ballFromRay = (frame: TableFrame, ray: Ray): Point | null => {
  const centre = rayAtHeight(ray, frame.height + BALL_RADIUS / 1000);
  return centre ? worldToTable(frame, centre) : null;
};

/** A point on the cloth: where the camera found the surface, or where the ray meets its level. */
export const clothFromAim = (aim: { hit?: WorldPoint; origin?: WorldPoint; direction?: WorldPoint }, clothHeight?: number) => {
  if (aim.hit) return aim.hit;
  if (aim.origin && aim.direction && clothHeight !== undefined) {
    return rayAtHeight({ origin: aim.origin, direction: aim.direction }, clothHeight);
  }
  return null;
};

/** Whether a table position is on the bed, allowing a little either side for aiming. */
export const onTable = (point: Point, marginMm = 60) =>
  point.x >= -marginMm && point.x <= TABLE.width + marginMm && point.y >= -marginMm && point.y <= TABLE.length + marginMm;

/**
 * The table drawn over the real one once calibrated: the cushion line, the baulk line and the
 * D. If these sit on the real markings, the calibration is right; if not, it can be redone
 * before any balls are recorded.
 */
export const tableLines = (frame: TableFrame): Array<{ points: WorldPoint[]; colour: string }> => {
  // A millimetre above the cloth, so the lines are not hidden in it.
  const on = (point: Point) => tableToWorld(frame, point, 1);
  const cushions = [
    { x: 0, y: 0 },
    { x: TABLE.width, y: 0 },
    { x: TABLE.width, y: TABLE.length },
    { x: 0, y: TABLE.length },
    { x: 0, y: 0 },
  ].map(on);
  const baulk = [{ x: 0, y: BAULK_LINE_Y }, { x: TABLE.width, y: BAULK_LINE_Y }].map(on);
  const d: WorldPoint[] = [];
  for (let step = 0; step <= 24; step += 1) {
    // The half circle towards the baulk cushion, from the green's spot round to the yellow's.
    const angle = Math.PI - (Math.PI * step) / 24;
    d.push(on({ x: SPOTS.brown.x + Math.cos(angle) * TABLE.dRadius, y: BAULK_LINE_Y + Math.sin(angle) * TABLE.dRadius }));
  }
  return [
    { points: cushions, colour: "#FFFFFFCC" },
    { points: baulk, colour: "#FFFFFF99" },
    { points: d, colour: "#FFFFFF99" },
  ];
};
