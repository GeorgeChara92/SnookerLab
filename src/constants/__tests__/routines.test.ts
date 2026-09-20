/**
 * The routine library is data, and data rots quietly: a typo in a category id hides a drill from
 * the app, a scoring maximum that disagrees with the drill's own description misleads whoever is
 * keeping score, and a half-filled video leaves a dead thumbnail on the page.
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

  it("keeps a video on most drills", () => {
    const drills = DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide");
    const withVideo = drills.filter((routine) => routine.youtube_video_id).length;

    // Pinned so it only goes up. Every id was checked against YouTube before being added.
    expect(withVideo).toBeGreaterThanOrEqual(40);
  });

  it("never half-fills a video", () => {
    const broken = DEFAULT_ROUTINES.filter(
      (routine) => routine.youtube_video_id && (!routine.youtube_url || !routine.youtube_title)
    );

    expect(broken.map((routine) => routine.id)).toEqual([]);
  });

});
