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

/**
 * How forgiving a hold is. The defaults are Scan Snooker's: any drift past the still radius starts
 * the hold again.
 */
export type HoldOptions = {
  /** Within this of the hold, in mm, the hold carries on filling. */
  stillRadiusMm?: number;
  /**
   * Past the still radius but within this, the hold pauses instead of starting again: the fill
   * stops where it is rather than dropping to empty, which on a real table looked like the circle
   * filling, emptying and filling again with nothing but a hand's tremor (2026-11-07). Past this
   * the aim has really moved, and the hold starts again. Defaults to the still radius.
   */
  resetRadiusMm?: number;
  /**
   * Only the readings from this long ago count towards where the hold is, so an aim that creeps
   * slowly is followed instead of left behind and paused for good. Unset, the whole hold counts.
   */
  windowMs?: number;
};

export class AimStabiliser {
  private streak: Array<{ point: WorldPoint; t: number }> = [];
  private smoothed: WorldPoint | null = null;
  private heldMs = 0;
  private lastT = 0;
  private readonly stillRadius: number;
  private readonly resetRadius: number;
  private readonly windowMs: number;

  constructor(options: HoldOptions = {}) {
    this.stillRadius = options.stillRadiusMm ?? STILL_RADIUS_MM;
    this.resetRadius = Math.max(this.stillRadius, options.resetRadiusMm ?? this.stillRadius);
    this.windowMs = options.windowMs ?? Infinity;
  }

  /** Feed the latest reading, or null when the camera has nothing to aim at. Returns the new state. */
  update(point: WorldPoint | null, now: number): Stability {
    if (!point) {
      this.reset();
      return STILL;
    }

    this.smoothed = this.smoothed ? lerp(this.smoothed, point, SMOOTHING) : point;

    let held = true;
    if (this.streak.length) {
      const centre = average(this.streak.map((sample) => sample.point));
      const drift = distanceMm(centre, this.smoothed);
      if (drift > this.resetRadius) {
        this.streak = [];
        this.heldMs = 0;
        this.smoothed = point;
      } else if (drift > this.stillRadius) {
        held = false;
      }
    }

    if (held) {
      if (this.streak.length) this.heldMs += now - this.lastT;
      this.streak.push({ point, t: now });
      this.streak = this.streak.filter((sample) => now - sample.t <= this.windowMs);
    }
    this.lastT = now;

    const progress = Math.min(1, this.heldMs / HOLD_MS);
    if (progress < 1) return { progress, locked: null };
    return { progress: 1, locked: average(this.streak.map((sample) => sample.point)) };
  }

  reset() {
    this.streak = [];
    this.smoothed = null;
    this.heldMs = 0;
  }
}
