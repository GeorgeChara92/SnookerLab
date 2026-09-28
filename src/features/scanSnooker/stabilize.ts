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

  /** Feed the latest reading, or null when the camera has nothing to aim at. Returns the new state. */
  update(point: WorldPoint | null, now: number): Stability {
    if (!point) {
      this.streak = [];
      return STILL;
    }

    if (this.streak.length) {
      const centre = average(this.streak.map((sample) => sample.point));
      if (distanceMm(centre, point) > STILL_RADIUS_MM) this.streak = [];
    }
    this.streak.push({ point, t: now });

    const heldMs = now - this.streak[0].t;
    const progress = Math.min(1, heldMs / HOLD_MS);
    if (progress < 1) return { progress, locked: null };
    return { progress: 1, locked: average(this.streak.map((sample) => sample.point)) };
  }

  reset() {
    this.streak = [];
  }
}
