import { BALL_LIMIT, COLOURS, SPOTS, TABLE, clampToBed, distance, type BallColour, type Point } from "./table";

/**
 * A recorded position: where each ball was on the table, before a snooker is played. Balls are
 * kept in table millimetres (see table.ts), so the same position can be shown on the diagram now
 * and in AR later.
 */

export type PlacedBall = Point & { id: string; colour: BallColour };

export type RecordedPosition = {
  matchId: string;
  frameNumber: number;
  recordedAt: string;
  balls: PlacedBall[];
};

let counter = 0;
const newId = (colour: BallColour) => `${colour}-${Date.now().toString(36)}-${(counter += 1)}`;

export const countOf = (balls: PlacedBall[], colour: BallColour) => balls.filter((ball) => ball.colour === colour).length;

/**
 * Moves a point the least distance needed so a ball there does not overlap any of the others:
 * two balls can touch, but never sit inside one another. A few passes settle it when pushing
 * clear of one ball nudges it into the next.
 */
export const separate = (point: Point, others: Point[]): Point => {
  let current = clampToBed(point);
  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false;
    for (const other of others) {
      const gap = distance(current, other);
      if (gap >= TABLE.ball - 0.01) continue;
      // Exactly on top of another ball: push towards baulk, the usual direction of play back.
      const ux = gap > 0.001 ? (current.x - other.x) / gap : 0;
      const uy = gap > 0.001 ? (current.y - other.y) / gap : 1;
      current = clampToBed({ x: other.x + ux * TABLE.ball, y: other.y + uy * TABLE.ball });
      moved = true;
    }
    if (!moved) break;
  }
  return current;
};

/**
 * Puts a ball on the table. A colour or the cue ball that is already there moves to the new
 * place instead of being doubled; a 16th red is refused.
 */
export const placeBall = (
  balls: PlacedBall[],
  colour: BallColour,
  point: Point
): { balls: PlacedBall[]; placed?: PlacedBall; refused?: string } => {
  const existing = BALL_LIMIT[colour] === 1 ? balls.find((ball) => ball.colour === colour) : undefined;
  if (existing) {
    const moved = moveBall(balls, existing.id, point);
    return { balls: moved, placed: moved.find((ball) => ball.id === existing.id) };
  }
  if (countOf(balls, colour) >= BALL_LIMIT[colour]) {
    return { balls, refused: `All ${BALL_LIMIT[colour]} ${colour}s are already on the table.` };
  }
  const placed: PlacedBall = { id: newId(colour), colour, ...separate(point, balls) };
  return { balls: [...balls, placed], placed };
};

export const moveBall = (balls: PlacedBall[], id: string, point: Point): PlacedBall[] =>
  balls.map((ball) =>
    ball.id === id
      ? { ...ball, ...separate(point, balls.filter((other) => other.id !== id)) }
      : ball
  );

export const removeBall = (balls: PlacedBall[], id: string) => balls.filter((ball) => ball.id !== id);

/**
 * Puts every colour that is not yet on the table on its own spot - the usual starting point, as
 * the colours are often still there - leaving the player to add the cue ball and the reds.
 */
export const coloursOnSpots = (balls: PlacedBall[]): PlacedBall[] =>
  COLOURS.reduce((current, colour) => {
    if (countOf(current, colour.id) > 0) return current;
    return placeBall(current, colour.id, SPOTS[colour.id]).balls;
  }, balls);

/** For the header: "Cue ball, 9 reds and 6 colours". */
export const summarise = (balls: PlacedBall[]) => {
  const reds = countOf(balls, "red");
  const colours = balls.filter((ball) => ball.colour !== "red" && ball.colour !== "cue").length;
  const parts = [
    countOf(balls, "cue") ? "cue ball" : null,
    reds ? `${reds} ${reds === 1 ? "red" : "reds"}` : null,
    colours ? `${colours} ${colours === 1 ? "colour" : "colours"}` : null,
  ].filter(Boolean) as string[];
  if (!parts.length) return "No balls placed";
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
};
