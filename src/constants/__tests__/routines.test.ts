/**
 * The routine library is data, and data rots quietly: a typo in a category id hides a drill from
 * the app, a diagram coordinate off the table puts a ball in the woodwork, and a scoring maximum
 * that disagrees with the drill's own description misleads whoever is keeping score.
 */

import { DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "../routines";
import { DIAGRAM_BALL_WIDTH } from "../theme";

/**
 * Distance between two balls, measured in table widths. y is a fraction of the length and the
 * table is twice as long as it is wide, so the vertical gap counts double.
 */
const gapBetween = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, (a.y - b.y) * 2);

const categoryIds = new Set(DEFAULT_CATEGORIES.map((category) => category.id));

describe("routine library", () => {
  it("has a decent spread across the levels", () => {
    const drills = DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide");
    const byLevel = (level: string) => drills.filter((routine) => routine.difficulty === level).length;

    expect(drills.length).toBeGreaterThanOrEqual(45);
    expect(byLevel("beginner")).toBeGreaterThanOrEqual(5);
    expect(byLevel("intermediate")).toBeGreaterThanOrEqual(15);
    expect(byLevel("advanced")).toBeGreaterThanOrEqual(15);
  });

  it("gives every routine a unique id", () => {
    const ids = DEFAULT_ROUTINES.map((routine) => routine.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every category a unique id and order", () => {
    const ids = DEFAULT_CATEGORIES.map((category) => category.id);
    const orders = DEFAULT_CATEGORIES.map((category) => category.order_index);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("files every routine under a category that exists", () => {
    const orphans = DEFAULT_ROUTINES.filter((routine) => !categoryIds.has(routine.category_id));
    expect(orphans.map((routine) => routine.id)).toEqual([]);
  });

  it("tells the player what to do and how it is scored", () => {
    DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide").forEach((routine) => {
      expect(routine.name.length).toBeGreaterThan(2);
      expect(routine.summary?.length ?? 0).toBeGreaterThan(20);
      expect(routine.setup_instructions?.length ?? 0).toBeGreaterThan(20);
      expect(routine.steps?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(routine.success_criteria?.length ?? 0).toBeGreaterThan(10);
      expect(routine.improves?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(routine.estimated_duration_minutes).toBeGreaterThan(0);
    });
  });

  it("only sets a maximum score where one can be counted", () => {
    DEFAULT_ROUTINES.forEach((routine) => {
      if (routine.max_score === undefined) return;
      expect(routine.max_score).toBeGreaterThan(0);
      // A time is a duration, not a tally, so a maximum would mean nothing.
      expect(routine.scoring_type).not.toBe("time");
    });
  });

  it("keeps every ball on the table", () => {
    DEFAULT_ROUTINES.forEach((routine) => {
      routine.diagram?.balls.forEach((ball) => {
        expect(ball.x).toBeGreaterThanOrEqual(0);
        expect(ball.x).toBeLessThanOrEqual(1);
        expect(ball.y).toBeGreaterThanOrEqual(0);
        expect(ball.y).toBeLessThanOrEqual(1);
      });

      routine.diagram?.lines?.forEach((line) => {
        [...line.from, ...line.to].forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  it("never overlaps two balls", () => {
    // Touching is fine - a pack is built that way - but anything closer is a drawing error.
    const tolerance = 0.999;
    const overlaps: string[] = [];

    DEFAULT_ROUTINES.forEach((routine) => {
      const balls = routine.diagram?.balls ?? [];

      balls.forEach((ball, index) => {
        balls.slice(index + 1).forEach((other) => {
          const gap = gapBetween(ball, other);
          if (gap < DIAGRAM_BALL_WIDTH * tolerance) {
            overlaps.push(
              `${routine.id}: ${ball.colour}(${ball.x}, ${ball.y}) and ${other.colour}(${other.x}, ${other.y}) are ${gap.toFixed(4)} apart`
            );
          }
        });
      });
    });

    expect(overlaps).toEqual([]);
  });

  it("keeps every ball clear of the cushions", () => {
    const radiusX = DIAGRAM_BALL_WIDTH / 2;
    const radiusY = DIAGRAM_BALL_WIDTH / 4;
    const tight: string[] = [];

    DEFAULT_ROUTINES.forEach((routine) => {
      routine.diagram?.balls.forEach((ball) => {
        if (ball.x < radiusX || ball.x > 1 - radiusX || ball.y < radiusY || ball.y > 1 - radiusY) {
          tight.push(`${routine.id}: ${ball.colour} at (${ball.x}, ${ball.y})`);
        }
      });
    });

    expect(tight).toEqual([]);
  });

  it("spaces a line of balls evenly", () => {
    // A line of three or more balls of one colour should be a line, not a stagger.
    const uneven: string[] = [];

    DEFAULT_ROUTINES.forEach((routine) => {
      const reds = (routine.diagram?.balls ?? []).filter((ball) => ball.colour === "red");
      const column = reds.filter((ball) => Math.abs(ball.x - reds[0]?.x) < 0.001);
      if (column.length < 3) return;

      const sorted = [...column].sort((a, b) => a.y - b.y);
      const gaps = sorted.slice(1).map((ball, index) => Number((ball.y - sorted[index].y).toFixed(4)));
      const smallest = Math.min(...gaps);

      // Gaps may be a multiple of the smallest one, because a colour spot interrupts the line.
      gaps.forEach((gap) => {
        const multiple = gap / smallest;
        if (Math.abs(multiple - Math.round(multiple)) > 0.06) {
          uneven.push(`${routine.id}: gaps ${gaps.join(", ")}`);
        }
      });
    });

    expect([...new Set(uneven)]).toEqual([]);
  });

  it("starts the shot line at the cue ball", () => {
    // A line showing the shot has to come off the white, or it is pointing at nothing.
    const adrift: string[] = [];

    DEFAULT_ROUTINES.forEach((routine) => {
      const cue = routine.diagram?.balls.find((ball) => ball.colour === "cue");
      if (!cue) return;

      routine.diagram?.lines
        ?.filter((line) => line.kind === "shot")
        .forEach((line) => {
          const start = { x: line.from[0], y: line.from[1] };
          if (gapBetween(start, cue) > DIAGRAM_BALL_WIDTH / 2) {
            adrift.push(`${routine.id}: shot starts at (${line.from[0]}, ${line.from[1]}), white is at (${cue.x}, ${cue.y})`);
          }
        });
    });

    expect(adrift).toEqual([]);
  });

  it("draws a table for every drill", () => {
    const drillsWithoutDiagrams = DEFAULT_ROUTINES.filter(
      (routine) => routine.content_type !== "guide" && !routine.diagram
    );

    // Every drill has one. Pinned at zero so a new routine cannot arrive without a picture.
    expect(drillsWithoutDiagrams.map((routine) => routine.id)).toEqual([]);
  });
});
