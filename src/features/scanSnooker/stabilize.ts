import type { WorldPoint } from "./table";

/**
 * Turns a stream of noisy aim readings into a "hold still to confirm" gesture, the way Apple's
 * Measure app fills a dot as you hold the camera on a corner.
 *
 * A hand's natural tremor moves the raycast hit a few millimetres between readings even when
 * genuinely aimed at the same spot. Averaging over a short hold cancels that out, which matters
 * most while calibrating: a few millimetres of error in a landmark is stretched across the whole
 * table once the frame is built from it.
 */

/** How far a reading can drift from the hold's average and still count as "held still", in mm. */
const STILL_RADIUS_MM = 4;
/** How long the aim has to stay within that radius before it counts as locked on. */
const HOLD_MS = 550;
/**
 * How much weight a fresh reading gets against the running average used only to decide "is this
 * still the same hold" - not the average the hold eventually locks to, which stays built from the
 * raw readings so this does not bias the result. A single noisy raycast - seen far more often the
 * closer the phone is held to the table, where ARKit has a smaller patch of cloth and fewer
 * features to fit a plane to (confirmed from a user's recording, 2026-10-09: steady standing back,
 * still jumpy close up) - would otherwise throw the whole hold away on its own even though the
 * next reading lands right back where it was. A real change of aim keeps moving for several
 * readings in a row, so it still clears the still radius and resets within a reading or two.
 */
const SMOOTHING = 0.4;

const lerp = (a: WorldPoint, b: WorldPoint, t: number): WorldPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

export type Stability = {
  /** 0 to 1: how far through the hold. Reaching 1 means `locked` is ready to use. */
  progress: number;
  /** The steadied point once locked - the average of every reading in the hold - or null. */
  locked: WorldPoint | null;
};

const STILL: Stability = { progress: 0, locked: null };

const distanceMm = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1000;

const average = (points: WorldPoint[]): WorldPoint => {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
};

export class AimStabiliser {
  private streak: Array<{ point: WorldPoint; t: number }> = [];
  private smoothed: WorldPoint | null = null;

  /** Feed the latest reading, or null when the camera has nothing to aim at. Returns the new state. */
  update(point: WorldPoint | null, now: number): Stability {
    if (!point) {
      this.streak = [];
      this.smoothed = null;
      return STILL;
    }

    this.smoothed = this.smoothed ? lerp(this.smoothed, point, SMOOTHING) : point;

    if (this.streak.length) {
      const centre = average(this.streak.map((sample) => sample.point));
      if (distanceMm(centre, this.smoothed) > STILL_RADIUS_MM) {
        this.streak = [];
        this.smoothed = point;
      }
    }
    this.streak.push({ point, t: now });

    const heldMs = now - this.streak[0].t;
    const progress = Math.min(1, heldMs / HOLD_MS);
    if (progress < 1) return { progress, locked: null };
    return { progress: 1, locked: average(this.streak.map((sample) => sample.point)) };
  }

  reset() {
    this.streak = [];
    this.smoothed = null;
  }
}
