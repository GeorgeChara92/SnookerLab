import { getRoutinePlacedBalls } from "../routineLayouts";
import { TABLE } from "../../scanSnooker/table";
import type { Routine } from "../../../types";

const fake = (id: string): Routine => ({ id }) as Routine;

/**
 * These 12 routines' ballPlacements come straight from the user's own exports out of the routine
 * builder tool (hand-placed, not generated) - so these tests check structural sanity (every ball
 * on the table, the right ball count, and only the colours the routine actually calls for) rather
 * than exact spacing, which is now a deliberate creative choice per routine rather than something
 * a formula can verify.
 *
 * `colours: null` means "every colour" (the routine places all 6, or has none in its own
 * `spotMarkers` restriction) - a specific list means the routine is deliberately missing some
 * (confirmed by the user: a reds-only drill like Straight Potting Reds should show no colours at
 * all, not all 6 auto-filled onto their spots just because the formula used to assume every
 * routine wants a full table).
 */
const EXPECTED: Record<string, { count: number; colours: readonly string[] | null }> = {
  "routine-line-up": { count: 22, colours: null },
  "routine-t-routine": { count: 22, colours: null },
  "routine-around-colours": { count: 7, colours: null },
  "routine-3-reds-colours": { count: 9, colours: null },
  "routine-break-building-foundations": { count: 16, colours: null },
  "routine-pink-ball-routine": { count: 9, colours: null },
  "routine-baulk-safety": { count: 12, colours: null },
  "routine-straight-cueing-line": { count: 15, colours: [] },
  "routine-long-blue-straight-cue": { count: 2, colours: ["blue"] },
  "routine-cueing-secret-session": { count: 15, colours: [] },
  "routine-cue-ball-control": { count: 8, colours: null },
  "routine-blue-ball-control": { count: 12, colours: null },
};

const ALL_COLOURS = ["black", "pink", "blue", "brown", "green", "yellow"] as const;

describe("imported routine layouts (user's own hand-built data)", () => {
  it.each(Object.entries(EXPECTED))("%s has the expected ball count and colours on the table", (routineId, expected) => {
    const balls = getRoutinePlacedBalls(fake(routineId));
    expect(balls).not.toBeNull();
    expect(balls!.length).toBe(expected.count);

    const colours = new Set(balls!.map((ball) => ball.colour));
    const expectedColours = expected.colours ?? ALL_COLOURS;
    for (const colour of ALL_COLOURS) {
      expect(colours.has(colour)).toBe(expectedColours.includes(colour));
    }

    for (const ball of balls!) {
      expect(ball.x).toBeGreaterThanOrEqual(0);
      expect(ball.x).toBeLessThanOrEqual(TABLE.width);
      expect(ball.y).toBeGreaterThanOrEqual(0);
      expect(ball.y).toBeLessThanOrEqual(TABLE.length);
    }
  });
});
