import { onTable, ballFromRay } from "./ar";
import { separate, type PlacedBall } from "./position";
import { BALL_LIMIT, POCKETS, TABLE, distance, worldToTable, type BallColour, type Point, type TableFrame, type WorldPoint } from "./table";

/**
 * Record a Snooker's lap: point the phone at the table and the balls are found for you. Walking
 * round finds the ones hidden from where you stand, and sharpens where each one is.
 *
 * The camera view reports everything ball-shaped it sees, from each place it stands. One view is
 * not to be trusted - a hand, a cue or a shadow can look like a ball - but a real ball stays put
 * and keeps the same colour, so what is kept is what many views agree on: held in view for a
 * moment from one place, or seen from more than one side. Seeing a ball from opposite sides also
 * cancels most of the error in where it is. The rules do the rest: there is one of each colour,
 * and at most 15 reds.
 *
 * A wrong ball on the table is worse than a missing one, which takes a tap to add, so everything
 * is held to a high bar: it has to be on snooker cloth, the size of a ball from where it was seen,
 * in the same place and the same colour every time.
 *
 * Everything here is plain maths, so it is tested without a phone or a table.
 */

export type LapColour = { y: number; cb: number; cr: number };

export type LapSighting = LapColour & {
  origin: WorldPoint;
  direction: WorldPoint;
  distance: number;
  fit: number;
};

export type LapFrame = {
  camera: WorldPoint;
  cloth?: LapColour;
  sightings: LapSighting[];
  ms: number;
  blurred?: number;
};

/** A ball the lap found. `unsure` means the views did not agree on its colour: check it. */
export type LapBall = PlacedBall & { unsure: boolean };

/** Sightings this close together are the same ball: under half a ball, so touching balls stay two. */
const SAME_BALL_MM = 32;
/**
 * How far out the cloth's height might be. A ray meets the ball's height a little short or long
 * when it is, by this times how shallow the ray is - so a ball far away, seen at a low angle,
 * lands further along the line of sight than one close by, and is matched with more room that way.
 */
const HEIGHT_ERROR_MM = 8;
const MAX_SLACK_MM = 80;
/** Two balls cannot be closer than one ball's width, so anything this close is one ball seen twice. */
const TOO_CLOSE_MM = 42;
/**
 * A real ball stays in view. From one place it has to be seen this often, over at least this many
 * looks (four a second, so about 1.5s): a hand or a cue moves on long before that.
 */
const MIN_SIGHTINGS_ONE_SIDE = 7;
const MIN_LOOKS_ONE_SIDE = 6;
/** Seen from two sides, a ball has already proved it's fixed to the table, so it needs fewer. */
const MIN_SIGHTINGS = 5;
/** Directions a ball can be seen from, for telling whether it really was seen from more than one. */
const SIDES = 8;
/** A pocket is a black circle on the table, so nothing black or unknown near one counts. */
const POCKET_MM = 75;
/** Beyond the cushions by more than this it is not on the table, whatever it is. */
const OFF_TABLE_MM = 15;
/** Its size against a ball's from that distance. The camera view lets more through than this. */
const MIN_FIT = 0.7;
const MAX_FIT = 1.3;
/** A ball is one colour, so at least this share of its sightings have to say the same one. */
const MIN_AGREEMENT = 0.5;
/** Below this share of a ball's sightings, a colour is not worth claiming the ball for. */
const CLAIM_SHARE = 0.35;
/** Below this share of a ball's sightings, the colour is flagged for the player to check. */
const SURE_SHARE = 0.6;

/** Stretches of the walk round the table. */
export const LAP_SECTORS = 12;
/** A lap this complete has seen every ball from close enough; the odd gap does not matter. */
export const LAP_COMPLETE = 10;

/** The camera's colour, as hue (0-360) and saturation and brightness (0-1). */
export const toHsv = ({ y, cb, cr }: LapColour) => {
  const clamp = (value: number) => Math.min(255, Math.max(0, value));
  const r = clamp(y + 1.402 * (cr - 128)) / 255;
  const g = clamp(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)) / 255;
  const b = clamp(y + 1.772 * (cb - 128)) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  let h = 0;
  if (spread > 0) {
    if (max === r) h = ((g - b) / spread + 6) % 6;
    else if (max === g) h = (b - r) / spread + 2;
    else h = (r - g) / spread + 4;
  }
  return { h: h * 60, s: max > 0 ? spread / max : 0, v: max };
};

/**
 * Which ball a colour looks like, or null if it could be anything. Brightness is measured against
 * the cloth, because a dim club and a bright one give very different numbers for the same ball.
 */
export const classifyColour = (sample: LapColour, cloth: LapColour): BallColour | null => {
  const brightness = sample.y / Math.max(cloth.y, 1);
  const chroma = Math.hypot(sample.cb - 128, sample.cr - 128);

  // Hardly any colour in it: the cue ball, the black, or a grey that is neither.
  if (chroma < 18) {
    if (brightness >= 1.2) return "cue";
    if (brightness <= 0.7) return "black";
    return null;
  }
  if (brightness < 0.45 && chroma < 28) return "black";

  const { h, s } = toHsv(sample);
  if (h >= 325 || h < 14) return s < 0.55 ? "pink" : "red";
  if (h < 38) return "brown";
  if (h < 70) return "yellow";
  if (h < 190) return "green";
  if (h < 270) return "blue";
  return null;
};

/**
 * Whether the surface really is snooker cloth. Without this, a lap of a desk or a floor takes that
 * for the cloth and everything on it for balls.
 */
export const isSnookerCloth = (cloth: LapColour) => {
  const { h, s } = toHsv(cloth);
  return h >= 70 && h <= 180 && s >= 0.2;
};

/** Two aims at one spot further apart than this were not both at that spot. */
export const TWO_VIEW_LIMIT_MM = 50;

/**
 * One spot, aimed at from two sides of the table. An aim from one place lands a little beyond or
 * short of the spot along the line of sight, whenever the cloth's height is not quite right, which
 * is why a marker set from one side looks off from the other. Aimed at again from across the table
 * the error points the other way, and the middle of the two is where the spot really is.
 */
export const combineViews = (first: WorldPoint, second: WorldPoint) => {
  const gapMm = Math.hypot(second.x - first.x, second.z - first.z) * 1000;
  return {
    point: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, z: (first.z + second.z) / 2 },
    gapMm,
    agree: gapMm <= TWO_VIEW_LIMIT_MM,
  };
};

export type AimRay = { origin: WorldPoint; direction: WorldPoint };

/** Two lines of sight further apart than this where they pass were not aimed at the same spot. */
const RAYS_MEET_MM = 25;
/** The cloth's height is only corrected by up to this: more means the aims were at something else. */
const MAX_HEIGHT_SHIFT_MM = 40;

/**
 * Where two lines of sight pass closest to each other, and how close that is. Aimed at one spot
 * from two sides, that is the spot itself, at its true height. Null when they run side by side.
 */
export const meetOfRays = (first: AimRay, second: AimRay) => {
  const d1 = first.direction;
  const d2 = second.direction;
  const w = { x: first.origin.x - second.origin.x, y: first.origin.y - second.origin.y, z: first.origin.z - second.origin.z };
  const dot = (u: WorldPoint, v: WorldPoint) => u.x * v.x + u.y * v.y + u.z * v.z;
  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const d = dot(d1, w);
  const e = dot(d2, w);
  const den = a * c - b * b;
  if (den < 1e-9 * a * c) return null;
  const s = (b * e - c * d) / den;
  const t = (a * e - b * d) / den;
  if (s <= 0 || t <= 0) return null;
  const p1 = { x: first.origin.x + d1.x * s, y: first.origin.y + d1.y * s, z: first.origin.z + d1.z * s };
  const p2 = { x: second.origin.x + d2.x * t, y: second.origin.y + d2.y * t, z: second.origin.z + d2.z * t };
  return {
    point: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, z: (p1.z + p2.z) / 2 },
    gapMm: Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z) * 1000,
  };
};

/**
 * One spot, aimed at from two sides, with the cloth's height put right as well.
 *
 * Each aim lands where its line of sight meets the surface the camera found, and if that surface
 * sits even a centimetre above or below the real cloth, every ball found later lands short of or
 * beyond where it is - which on a real table showed as each ball's ring sitting in front of it.
 * The middle of the two aims (`combineViews`) fixes where the spot is across the table but not its
 * height. Where the two lines of sight cross fixes both, so that is used when they do cross.
 */
export const combineAims = (
  first: { world: WorldPoint; ray?: AimRay },
  second: { world: WorldPoint; ray?: AimRay }
) => {
  const views = combineViews(first.world, second.world);
  const meet = first.ray && second.ray ? meetOfRays(first.ray, second.ray) : null;
  const shiftMm = meet ? (meet.point.y - views.point.y) * 1000 : 0;
  const usable =
    !!meet &&
    meet.gapMm <= RAYS_MEET_MM &&
    Math.abs(shiftMm) <= MAX_HEIGHT_SHIFT_MM &&
    Math.hypot(meet.point.x - views.point.x, meet.point.z - views.point.z) * 1000 <= TWO_VIEW_LIMIT_MM;
  return {
    ...views,
    point: usable ? meet!.point : views.point,
    /** How far the cloth's height was moved, in millimetres; 0 when the aims couldn't be used. */
    heightShiftMm: usable ? Math.round(shiftMm) : 0,
  };
};

/** Which of the stretches round the table the camera is on, the same size whichever side it is. */
export const sectorOf = (camera: Point) => {
  const across = (camera.x - TABLE.width / 2) / (TABLE.width / 2);
  const along = (camera.y - TABLE.length / 2) / (TABLE.length / 2);
  const turn = (Math.atan2(along, across) + Math.PI) / (Math.PI * 2);
  return Math.min(LAP_SECTORS - 1, Math.floor(turn * LAP_SECTORS));
};

const sideOf = (ball: Point, camera: Point) => {
  const turn = (Math.atan2(camera.y - ball.y, camera.x - ball.x) + Math.PI) / (Math.PI * 2);
  return Math.min(SIDES - 1, Math.floor(turn * SIDES));
};

const nearPocket = (point: Point) => Object.values(POCKETS).some((pocket) => distance(point, pocket) <= POCKET_MM);

type Cluster = {
  id: string;
  x: number;
  y: number;
  weight: number;
  sightings: number;
  /** The looks it was first and last seen in, to tell something that stays from something passing. */
  firstLook: number;
  lastLook: number;
  /** How far along the line of sight its sightings could be out, on average. */
  slack: number;
  /** Each sighting's squared distance from where the ball was then thought to be, for the report. */
  scatter: number;
  sides: Set<number>;
  votes: Partial<Record<BallColour, number>>;
  unknown: number;
  colour: LapColour;
};

const mergeInto = (target: Cluster, other: Cluster) => {
  const weight = target.weight + other.weight;
  target.x = (target.x * target.weight + other.x * other.weight) / weight;
  target.y = (target.y * target.weight + other.y * other.weight) / weight;
  target.colour = {
    y: (target.colour.y * target.sightings + other.colour.y * other.sightings) / (target.sightings + other.sightings),
    cb: (target.colour.cb * target.sightings + other.colour.cb * other.sightings) / (target.sightings + other.sightings),
    cr: (target.colour.cr * target.sightings + other.colour.cr * other.sightings) / (target.sightings + other.sightings),
  };
  target.slack = (target.slack * target.sightings + other.slack * other.sightings) / (target.sightings + other.sightings);
  target.firstLook = Math.min(target.firstLook, other.firstLook);
  target.lastLook = Math.max(target.lastLook, other.lastLook);
  target.weight = weight;
  target.sightings += other.sightings;
  target.scatter += other.scatter;
  other.sides.forEach((side) => target.sides.add(side));
  (Object.keys(other.votes) as BallColour[]).forEach((colour) => {
    target.votes[colour] = (target.votes[colour] ?? 0) + (other.votes[colour] ?? 0);
  });
  target.unknown += other.unknown;
};

const shareOf = (cluster: Cluster, colour: BallColour) => (cluster.votes[colour] ?? 0) / Math.max(cluster.sightings, 1);

/** Why the views have not agreed on something being a ball, or null if they have. */
const doubtAbout = (cluster: Cluster) => {
  const enough =
    cluster.sides.size >= 2
      ? cluster.sightings >= MIN_SIGHTINGS
      : cluster.sightings >= MIN_SIGHTINGS_ONE_SIDE && cluster.lastLook - cluster.firstLook >= MIN_LOOKS_ONE_SIDE;
  if (!enough) return "notSeenEnough";
  const agreeing = Math.max(0, ...Object.values(cluster.votes).map((votes) => votes ?? 0));
  if (agreeing / cluster.sightings < MIN_AGREEMENT) return "mixedColours";
  return null;
};

const SINGLES = (Object.keys(BALL_LIMIT) as BallColour[]).filter((colour) => BALL_LIMIT[colour] === 1);

/**
 * The balls the views agree on, and what each one is. The colours and the cue ball go first, each
 * to the ball that most looks like it, so a ball can only be the yellow if nothing looks more like
 * it. Whatever is left is a red, and is flagged if it did not look much like one.
 */
const assignColours = (clusters: Cluster[]): Array<{ cluster: Cluster; colour: BallColour; unsure: boolean }> => {
  const claims = clusters
    .flatMap((cluster) => SINGLES.map((colour) => ({ cluster, colour, share: shareOf(cluster, colour) })))
    .filter((claim) => claim.share >= CLAIM_SHARE)
    .sort((a, b) => b.share - a.share);

  const taken = new Set<BallColour>();
  const placed = new Map<Cluster, { cluster: Cluster; colour: BallColour; unsure: boolean }>();
  claims.forEach(({ cluster, colour, share }) => {
    if (taken.has(colour) || placed.has(cluster)) return;
    taken.add(colour);
    placed.set(cluster, { cluster, colour, unsure: share < SURE_SHARE });
  });

  const reds = clusters
    .filter((cluster) => !placed.has(cluster))
    .sort((a, b) => shareOf(b, "red") - shareOf(a, "red") || b.sightings - a.sightings)
    .slice(0, BALL_LIMIT.red)
    .map((cluster) => ({ cluster, colour: "red" as const, unsure: shareOf(cluster, "red") < SURE_SHARE }));

  return [...placed.values(), ...reds];
};

export class LapTracker {
  private clusters: Cluster[] = [];
  private sectors = new Set<number>();
  private cloth: LapColour | null = null;
  private onCloth = false;
  private frames = 0;
  private notCloth = 0;
  private blurred = 0;
  private lookingMs = 0;
  private offTable = 0;
  private pockets = 0;
  private wrongSize = 0;
  private nextId = 0;

  /** One look at the table, through the calibrated table frame. */
  add(look: LapFrame, frame: TableFrame) {
    this.frames += 1;
    this.blurred += look.blurred ?? 0;
    this.lookingMs += look.ms;

    const cloth = look.cloth;
    this.onCloth = Boolean(cloth && isSnookerCloth(cloth));
    if (cloth) this.cloth = cloth;
    if (!cloth || !this.onCloth) {
      this.notCloth += 1;
      return;
    }

    const camera = worldToTable(frame, look.camera);
    this.sectors.add(sectorOf(camera));

    const seen: Array<{ point: Point; sighting: LapSighting; colour: BallColour | null; slack: number }> = [];
    look.sightings.forEach((sighting) => {
      if (sighting.fit < MIN_FIT || sighting.fit > MAX_FIT) {
        this.wrongSize += 1;
        return;
      }
      const point = ballFromRay(frame, sighting);
      if (!point || !onTable(point, OFF_TABLE_MM)) {
        this.offTable += 1;
        return;
      }
      const colour = classifyColour(sighting, cloth);
      if ((colour === "black" || colour === null) && nearPocket(point)) {
        this.pockets += 1;
        return;
      }
      const { direction } = sighting;
      const shallow = Math.hypot(direction.x, direction.z) / Math.max(-direction.y, 1e-3);
      seen.push({ point, sighting, colour, slack: Math.min(MAX_SLACK_MM, HEIGHT_ERROR_MM * shallow) });
    });

    // Every pairing of what this look saw with a ball already known, best first. Two things in
    // one picture are two balls, so each known ball takes at most one of them: that is what keeps
    // two touching balls apart even when one is behind the other along the line of sight.
    const pairs: Array<{ index: number; cluster: Cluster; cost: number; gap: number }> = [];
    seen.forEach(({ point, slack }, index) => {
      const along = { x: point.x - camera.x, y: point.y - camera.y };
      const length = Math.hypot(along.x, along.y) || 1;
      const unit = { x: along.x / length, y: along.y / length };
      this.clusters.forEach((cluster) => {
        const dx = cluster.x - point.x;
        const dy = cluster.y - point.y;
        const alongGap = Math.abs(dx * unit.x + dy * unit.y);
        const acrossGap = Math.abs(dx * unit.y - dy * unit.x);
        const alongLimit = SAME_BALL_MM + slack + cluster.slack;
        const acrossLimit = SAME_BALL_MM + cluster.slack / 2;
        if (alongGap > alongLimit || acrossGap > acrossLimit) return;
        const cost = (alongGap / alongLimit) ** 2 + (acrossGap / acrossLimit) ** 2;
        pairs.push({ index, cluster, cost, gap: Math.hypot(dx, dy) });
      });
    });
    pairs.sort((a, b) => a.cost - b.cost);

    const matched = new Map<number, { cluster: Cluster; gap: number }>();
    const taken = new Set<Cluster>();
    pairs.forEach(({ index, cluster, gap }) => {
      if (matched.has(index) || taken.has(cluster)) return;
      matched.set(index, { cluster, gap });
      taken.add(cluster);
    });

    seen.forEach((item, index) => this.place(item, camera, matched.get(index)));
    this.tidy(taken);
  }

  private place(
    { point, sighting, colour, slack }: { point: Point; sighting: LapSighting; colour: BallColour | null; slack: number },
    camera: Point,
    nearest: { cluster: Cluster; gap: number } | undefined
  ) {
    this.nextId += nearest ? 0 : 1;
    const seen: Cluster = {
      id: `lap-${this.nextId}`,
      x: point.x,
      y: point.y,
      // A steep, close view knows where the ball is better than a shallow one from far away.
      weight: 1 / (slack * slack + 15 * 15),
      sightings: 1,
      firstLook: this.frames,
      lastLook: this.frames,
      slack,
      scatter: nearest ? nearest.gap * nearest.gap : 0,
      sides: new Set([sideOf(point, camera)]),
      votes: colour ? { [colour]: 1 } : {},
      unknown: colour ? 0 : 1,
      colour: { y: sighting.y, cb: sighting.cb, cr: sighting.cr },
    };
    if (nearest) mergeInto(nearest.cluster, seen);
    else this.clusters.push(seen);
  }

  /**
   * A ball first seen from far away can start out as two, until closer looks pull them together.
   * Once two have drifted within half a ball of each other they are one, and the older keeps its
   * id. Never two that were both seen in this look: those are two balls.
   */
  private tidy(updated: Set<Cluster>) {
    updated.forEach((cluster) => {
      if (!this.clusters.includes(cluster)) return;
      const twin = this.clusters.find(
        (other) => other !== cluster && !updated.has(other) && distance(cluster, other) < SAME_BALL_MM
      );
      if (!twin) return;
      const [keep, drop] = twin.firstLook <= cluster.firstLook ? [twin, cluster] : [cluster, twin];
      mergeInto(keep, drop);
      this.clusters = this.clusters.filter((other) => other !== drop);
    });
  }

  /** What the views agree on so far, one per ball. */
  private confirmed() {
    const kept = this.clusters
      .filter((cluster) => doubtAbout(cluster) === null)
      .map((cluster) => ({ ...cluster, sides: new Set(cluster.sides), votes: { ...cluster.votes } }))
      .sort((a, b) => b.sightings - a.sightings);

    const merged: Cluster[] = [];
    kept.forEach((cluster) => {
      const same = merged.find((other) => distance(cluster, other) < TOO_CLOSE_MM);
      if (same) mergeInto(same, cluster);
      else merged.push(cluster);
    });
    return merged;
  }

  balls(): LapBall[] {
    return assignColours(this.confirmed()).reduce<LapBall[]>((balls, { cluster, colour, unsure }) => {
      balls.push({ id: cluster.id, colour, unsure, ...separate(cluster, balls) });
      return balls;
    }, []);
  }

  /** Whether the last look was at snooker cloth, so the player can be told when it is not. */
  seeingCloth() {
    return this.onCloth;
  }

  /** How much of the way round the table the player has walked, out of `LAP_SECTORS`. */
  coverage() {
    return this.sectors.size;
  }

  /** What happened on this lap, to send back when a table reads wrongly: the colours are the point. */
  report(frame: TableFrame | null, lidar: boolean, extra: Record<string, unknown> = {}) {
    const round = (value: number) => Math.round(value);
    const assigned = assignColours(this.confirmed());
    const doubts = this.clusters.map(doubtAbout);
    const doubted = (reason: string) => doubts.filter((doubt) => doubt === reason).length;
    return JSON.stringify({
      version: 2,
      ...extra,
      lidar,
      scale: frame ? Number(frame.scale.toFixed(3)) : null,
      looks: this.frames,
      notCloth: this.notCloth,
      blurred: this.blurred,
      averageMs: this.frames ? round(this.lookingMs / this.frames) : 0,
      coverage: this.sectors.size,
      cloth: this.cloth ? { y: round(this.cloth.y), cb: round(this.cloth.cb), cr: round(this.cloth.cr) } : null,
      offTable: this.offTable,
      pockets: this.pockets,
      wrongSize: this.wrongSize,
      notSeenEnough: doubted("notSeenEnough"),
      mixedColours: doubted("mixedColours"),
      balls: assigned.map(({ cluster, colour, unsure }) => ({
        colour,
        unsure,
        x: round(cluster.x),
        y: round(cluster.y),
        seen: cluster.sightings,
        sides: cluster.sides.size,
        scatter: round(Math.sqrt(cluster.scatter / cluster.sightings)),
        votes: cluster.votes,
        unknown: cluster.unknown,
        brightness: round(cluster.colour.y),
        cb: round(cluster.colour.cb),
        cr: round(cluster.colour.cr),
      })),
    });
  }
}
