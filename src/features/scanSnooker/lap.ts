import { onTable, ballFromRay } from "./ar";
import { separate, type PlacedBall } from "./position";
import { BALL_LIMIT, POCKETS, TABLE, distance, worldToTable, type BallColour, type Point, type TableFrame, type WorldPoint } from "./table";

/**
 * Record a Snooker's lap: walk once round the table and the balls are found for you.
 *
 * The camera view reports everything ball-shaped it sees, from each place it stands. One view is
 * not to be trusted - a hand, a cue or a shadow can look like a ball - but a real ball stays in
 * the same place on the table however it is looked at, so what is kept is what many views agree
 * on. Seeing a ball from opposite sides also cancels most of the error in where it is, and the
 * balls hidden from one side are found from another. The rules do the rest: there is one of each
 * colour, and at most 15 reds.
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
/** Two balls cannot be closer than one ball's width, so anything this close is one ball seen twice. */
const TOO_CLOSE_MM = 42;
/** A real ball is seen again and again, from well apart. Four looks a second makes this 2.5s. */
const MIN_SIGHTINGS = 10;
const MIN_SIDES = 3;
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
  if (cluster.sightings < MIN_SIGHTINGS || cluster.sides.size < MIN_SIDES) return "notSeenEnough";
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
      this.place(point, camera, sighting, colour);
    });
  }

  private place(point: Point, camera: Point, sighting: LapSighting, colour: BallColour | null) {
    const nearest = this.clusters.reduce<{ cluster: Cluster; gap: number } | null>((best, cluster) => {
      const gap = distance(point, cluster);
      return gap <= SAME_BALL_MM && (!best || gap < best.gap) ? { cluster, gap } : best;
    }, null);

    this.nextId += nearest ? 0 : 1;
    const seen: Cluster = {
      id: `lap-${this.nextId}`,
      x: point.x,
      y: point.y,
      // The closer the view the better it knows where the ball is.
      weight: 1 / Math.max(sighting.distance * sighting.distance, 0.25),
      sightings: 1,
      scatter: nearest ? nearest.gap * nearest.gap : 0,
      sides: new Set([sideOf(point, camera)]),
      votes: colour ? { [colour]: 1 } : {},
      unknown: colour ? 0 : 1,
      colour: { y: sighting.y, cb: sighting.cb, cr: sighting.cr },
    };
    if (nearest) mergeInto(nearest.cluster, seen);
    else this.clusters.push(seen);
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
  report(frame: TableFrame | null, lidar: boolean) {
    const round = (value: number) => Math.round(value);
    const assigned = assignColours(this.confirmed());
    const doubts = this.clusters.map(doubtAbout);
    const doubted = (reason: string) => doubts.filter((doubt) => doubt === reason).length;
    return JSON.stringify({
      version: 2,
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
