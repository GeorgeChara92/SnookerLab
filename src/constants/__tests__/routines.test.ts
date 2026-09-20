/**
 * The routine library is data, and data rots quietly: a typo in a category id hides a drill from
 * the app, a diagram coordinate off the table puts a ball in the woodwork, and a scoring maximum
 * that disagrees with the drill's own description misleads whoever is keeping score.
 */

import { DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "../routines";

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

  it("never puts two balls in the same place", () => {
    DEFAULT_ROUTINES.forEach((routine) => {
      if (!routine.diagram) return;

      const places = routine.diagram.balls.map((ball) => `${ball.x.toFixed(3)},${ball.y.toFixed(3)}`);
      expect(new Set(places).size).toBe(places.length);
    });
  });

  it("draws a table for every drill", () => {
    const drillsWithoutDiagrams = DEFAULT_ROUTINES.filter(
      (routine) => routine.content_type !== "guide" && !routine.diagram
    );

    // Every drill has one. Pinned at zero so a new routine cannot arrive without a picture.
    expect(drillsWithoutDiagrams.map((routine) => routine.id)).toEqual([]);
  });
});
