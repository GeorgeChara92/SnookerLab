import { LAP_SECTORS, LapTracker, classifyColour, combineAims, combineViews, meetOfRays, isSnookerCloth, sectorOf, toHsv, type LapColour, type LapFrame } from "../lap";
import { BALL_RADIUS, TABLE, tableToWorld, type BallColour, type Point, type TableFrame } from "../table";

const FRAME: TableFrame = { origin: { x: 0.4, z: -0.2 }, angle: 0.3, height: 0.85, scale: 1 };
const CLOTH: LapColour = { y: 110, cb: 105, cr: 92 };

/** Typical readings for each ball under table lights. */
const LOOK: Record<BallColour, LapColour> = {
  cue: { y: 220, cb: 122, cr: 132 },
  red: { y: 75, cb: 108, cr: 195 },
  yellow: { y: 190, cb: 55, cr: 150 },
  green: { y: 70, cb: 105, cr: 85 },
  brown: { y: 70, cb: 105, cr: 150 },
  blue: { y: 80, cb: 185, cr: 105 },
  pink: { y: 190, cb: 125, cr: 170 },
  black: { y: 30, cb: 126, cr: 130 },
};

/** A camera 1.4m up, standing just off the table at a point in table millimetres. */
const standing = (at: Point) => {
  const world = tableToWorld(FRAME, at, 0);
  return { ...world, y: FRAME.height + 0.55 };
};

/** What the camera reports looking at a ball from where it stands. */
const sighting = (ball: Point, at: Point, colour: BallColour, nudgeMm = 0) => {
  const origin = standing(at);
  const target = tableToWorld(FRAME, { x: ball.x + nudgeMm, y: ball.y - nudgeMm });
  const direction = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
  return {
    origin,
    direction,
    distance: Math.hypot(direction.x, direction.y, direction.z),
    fit: 1,
    ...LOOK[colour],
  };
};

/** Standing places all the way round the table. */
const LAP: Point[] = [
  { x: -300, y: 400 },
  { x: -300, y: 1800 },
  { x: -300, y: 3200 },
  { x: 900, y: 3850 },
  { x: TABLE.width + 300, y: 3200 },
  { x: TABLE.width + 300, y: 1800 },
  { x: TABLE.width + 300, y: 400 },
  { x: 900, y: -300 },
];

const walk = (balls: Array<{ at: Point; colour: BallColour }>, rounds = 2) => {
  const tracker = new LapTracker();
  for (let round = 0; round < rounds; round += 1) {
    LAP.forEach((at, index) => {
      const look: LapFrame = {
        camera: standing(at),
        cloth: CLOTH,
        ms: 12,
        // A few millimetres of scatter, as real measurements have.
        sightings: balls.map((ball) => sighting(ball.at, at, ball.colour, ((index + round) % 3) * 3 - 3)),
      };
      tracker.add(look, FRAME);
    });
  }
  return tracker;
};

describe("reading a ball's colour", () => {
  it.each(Object.keys(LOOK) as BallColour[])("knows the %s", (colour) => {
    expect(classifyColour(LOOK[colour], CLOTH)).toBe(colour);
  });

  it("goes by the cloth's brightness, so a dim room reads the same", () => {
    const dim = (colour: LapColour): LapColour => ({ ...colour, y: colour.y * 0.6 });
    expect(classifyColour(dim(LOOK.cue), dim(CLOTH))).toBe("cue");
    expect(classifyColour(dim(LOOK.black), dim(CLOTH))).toBe("black");
  });

  it("does not guess at a grey", () => {
    expect(classifyColour({ y: 110, cb: 128, cr: 128 }, CLOTH)).toBeNull();
  });

  it("turns the camera's colour into a hue", () => {
    expect(toHsv({ y: 128, cb: 128, cr: 128 }).s).toBeCloseTo(0, 5);
    expect(toHsv(LOOK.blue).h).toBeGreaterThan(190);
  });
});

describe("walking a lap", () => {
  const position: Array<{ at: Point; colour: BallColour }> = [
    { at: { x: 300, y: 500 }, colour: "cue" },
    { at: { x: 889, y: 324 }, colour: "black" },
    { at: { x: 889, y: 900 }, colour: "pink" },
    { at: { x: 889, y: 1784 }, colour: "blue" },
    { at: { x: 889, y: 2832 }, colour: "brown" },
    { at: { x: 597, y: 2832 }, colour: "green" },
    { at: { x: 1181, y: 2832 }, colour: "yellow" },
    { at: { x: 1000, y: 1200 }, colour: "red" },
    { at: { x: 1400, y: 1500 }, colour: "red" },
  ];

  it("finds every ball where it is, and knows what each one is", () => {
    const found = walk(position).balls();
    expect(found).toHaveLength(position.length);
    position.forEach((ball) => {
      const match = found.find((item) => Math.hypot(item.x - ball.at.x, item.y - ball.at.y) < 10);
      expect(match?.colour).toBe(ball.colour);
      expect(match?.unsure).toBe(false);
    });
  });

  it("keeps touching balls apart", () => {
    const found = walk([
      { at: { x: 800, y: 1000 }, colour: "red" },
      { at: { x: 800 + TABLE.ball, y: 1000 }, colour: "red" },
    ]).balls();
    expect(found).toHaveLength(2);
    expect(Math.hypot(found[0].x - found[1].x, found[0].y - found[1].y)).toBeGreaterThanOrEqual(TABLE.ball - 0.01);
  });

  it("ignores what only shows up once, like a hand or a cue tip", () => {
    const tracker = new LapTracker();
    LAP.forEach((at, index) =>
      tracker.add(
        {
          camera: standing(at),
          cloth: CLOTH,
          ms: 10,
          sightings: [sighting({ x: 300 + index * 150, y: 900 + index * 200 }, at, "red")],
        },
        FRAME
      )
    );
    expect(tracker.balls()).toHaveLength(0);
  });

  /** Standing still at one place for a number of looks. */
  const standStill = (balls: Array<{ at: Point; colour: BallColour }>, looks: number, at: Point = LAP[0], tracker = new LapTracker()) => {
    for (let look = 0; look < looks; look += 1) {
      tracker.add(
        { camera: standing(at), cloth: CLOTH, ms: 10, sightings: balls.map((ball) => sighting(ball.at, at, ball.colour, (look % 3) * 2 - 2)) },
        FRAME
      );
    }
    return tracker;
  };

  it("finds the balls from where you stand, without walking", () => {
    // Long enough for the baulk colours, over 2.5m from here, as well as the near balls.
    const found = standStill(position, 12).balls();
    expect(found).toHaveLength(position.length);
    position.forEach((ball) => {
      expect(found.find((item) => Math.hypot(item.x - ball.at.x, item.y - ball.at.y) < 10)?.colour).toBe(ball.colour);
    });
  });

  it("waits for a ball to stay in view before trusting it from one place", () => {
    expect(standStill([{ at: { x: 900, y: 1500 }, colour: "red" }], 4).balls()).toHaveLength(0);
  });

  it("finds a ball at the far end of the table", () => {
    // From behind the baulk cushion, the black's spot is over 3.5m away.
    const far = [{ at: { x: 889, y: 324 }, colour: "black" as const }];
    const stand = { x: 900, y: 3850 };
    // Far off and from one place, it has to stay in view for longer than a close ball does.
    expect(standStill(far, 8, stand).balls()).toHaveLength(0);
    expect(standStill(far, 12, stand).balls()).toHaveLength(1);
  });

  it("shows one ring for a ball seen a little apart from two places, never both at once", () => {
    // The same red, read 45mm apart from two standing places: once two clusters, one ring.
    const tracker = new LapTracker();
    const red = { x: 700, y: 1200 };
    standStill([{ at: red, colour: "red" }], 8, LAP[0], tracker);
    standStill([{ at: { x: red.x + 45, y: red.y }, colour: "red" }], 8, LAP[4], tracker);
    expect(tracker.balls()).toHaveLength(1);
  });

  it("still shows two touching reds that are seen together", () => {
    const pair = [
      { at: { x: 700, y: 1200 }, colour: "red" as const },
      { at: { x: 700 + TABLE.ball, y: 1200 }, colour: "red" as const },
    ];
    expect(standStill(pair, 8, LAP[1]).balls()).toHaveLength(2);
  });

  it("won't call a red the black because its dark side sometimes reads black", () => {
    const tracker = new LapTracker();
    const at = LAP[0];
    for (let look = 0; look < 12; look += 1) {
      const colour: BallColour = look % 5 < 3 ? "red" : "black"; // 60% red, 40% black
      tracker.add({ camera: standing(at), cloth: CLOTH, ms: 10, sightings: [sighting({ x: 600, y: 900 }, at, colour)] }, FRAME);
    }
    const [ball] = tracker.balls();
    expect(ball.colour).toBe("red");
  });

  it("ignores something that's mostly no colour at all, like a mark on the cloth", () => {
    const tracker = new LapTracker();
    const at = LAP[0];
    const grey = { y: 110, cb: 128, cr: 128 };
    for (let look = 0; look < 12; look += 1) {
      const reading = look % 2 ? LOOK.red : grey;
      tracker.add(
        { camera: standing(at), cloth: CLOTH, ms: 10, sightings: [{ ...sighting({ x: 600, y: 900 }, at, "red"), ...reading }] },
        FRAME
      );
    }
    expect(tracker.balls()).toHaveLength(0);
  });

  it("keeps two touching balls apart when one is behind the other", () => {
    const line = [
      { at: { x: 889, y: 1200 }, colour: "red" as const },
      { at: { x: 889, y: 1200 - TABLE.ball }, colour: "red" as const },
    ];
    expect(standStill(line, 8, { x: 889, y: 3850 }).balls()).toHaveLength(2);
  });

  it("makes one ball of a far one seen a little out from each end", () => {
    // A cloth height a touch out puts a shallow ray's ball further along it, the opposite way
    // from each end of the table.
    const at = { x: 889, y: 1784 };
    const tracker = new LapTracker();
    [
      { stand: { x: 889, y: 3850 }, nudge: { x: 0, y: -45 } },
      { stand: { x: 889, y: -300 }, nudge: { x: 0, y: 45 } },
    ].forEach(({ stand, nudge }) => {
      for (let look = 0; look < 8; look += 1) {
        tracker.add(
          { camera: standing(stand), cloth: CLOTH, ms: 10, sightings: [sighting({ x: at.x + nudge.x, y: at.y + nudge.y }, stand, "blue")] },
          FRAME
        );
      }
    });
    const found = tracker.balls();
    expect(found).toHaveLength(1);
    expect(Math.abs(found[0].y - at.y)).toBeLessThan(15);
  });

  it("does not take a pocket for the black", () => {
    expect(walk([{ at: { x: 30, y: 30 }, colour: "black" }]).balls()).toHaveLength(0);
  });

  it("still finds a coloured ball near a pocket", () => {
    expect(walk([{ at: { x: 60, y: 60 }, colour: "red" }]).balls()).toHaveLength(1);
  });

  it("ignores anything off the table", () => {
    expect(walk([{ at: { x: -200, y: 900 }, colour: "red" }]).balls()).toHaveLength(0);
  });

  it("allows one of each colour, and flags the ball that had to be something else", () => {
    const found = walk([
      { at: { x: 500, y: 1000 }, colour: "blue" },
      { at: { x: 1200, y: 1000 }, colour: "blue" },
    ]).balls();
    expect(found.filter((ball) => ball.colour === "blue")).toHaveLength(1);
    const other = found.find((ball) => ball.colour !== "blue");
    expect(other?.colour).toBe("red");
    expect(other?.unsure).toBe(true);
  });

  it("never finds more than 15 reds", () => {
    const reds = Array.from({ length: 18 }, (_, index) => ({
      at: { x: 300 + (index % 6) * 200, y: 800 + Math.floor(index / 6) * 300 },
      colour: "red" as const,
    }));
    expect(walk(reds).balls().filter((ball) => ball.colour === "red")).toHaveLength(15);
  });

  it("keeps a ball's id as more views come in, so its marker does not flicker", () => {
    const tracker = walk(position);
    const before = tracker.balls().map((ball) => ball.id).sort();
    LAP.forEach((at) =>
      tracker.add({ camera: standing(at), cloth: CLOTH, ms: 10, sightings: position.map((ball) => sighting(ball.at, at, ball.colour)) }, FRAME)
    );
    expect(tracker.balls().map((ball) => ball.id).sort()).toEqual(before);
  });

  it("counts a look at the cloth towards the lap, even with nothing on it", () => {
    const tracker = new LapTracker();
    tracker.add({ camera: standing(LAP[0]), cloth: CLOTH, sightings: [], ms: 5 }, FRAME);
    expect(tracker.coverage()).toBe(1);
    expect(tracker.seeingCloth()).toBe(true);
    expect(tracker.balls()).toHaveLength(0);
  });

  it("does not count a look with too little table in view", () => {
    const tracker = new LapTracker();
    tracker.add({ camera: standing(LAP[0]), sightings: [], ms: 5 }, FRAME);
    expect(tracker.coverage()).toBe(0);
    expect(tracker.seeingCloth()).toBe(false);
  });

  it("works on a table that is not quite regulation size", () => {
    const big: TableFrame = { ...FRAME, scale: 1.04 };
    const at = { x: 900, y: 1500 };
    const tracker = new LapTracker();
    [...LAP, ...LAP].forEach((place) => {
      const origin = tableToWorld(big, place, 550 + BALL_RADIUS);
      const target = tableToWorld(big, at);
      const direction = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
      tracker.add(
        {
          camera: origin,
          cloth: CLOTH,
          ms: 10,
          sightings: [{ origin, direction, distance: 2, fit: 1, ...LOOK.red }],
        },
        big
      );
    });
    const [ball] = tracker.balls();
    expect(ball.x).toBeCloseTo(at.x, 0);
    expect(ball.y).toBeCloseTo(at.y, 0);
  });

  it("writes a report of what it saw", () => {
    const report = JSON.parse(walk(position).report(FRAME, true));
    expect(report.balls).toHaveLength(position.length);
    expect(report.lidar).toBe(true);
    expect(report.coverage).toBeGreaterThan(0);
    expect(report.balls[0].votes).toBeDefined();
  });
});

describe("not seeing balls that are not there", () => {
  /** Everything on the surface, however solid, from every look of two laps. */
  const lapOf = (surface: LapColour, things: Array<{ at: Point; colour: BallColour }>, fit = 1) => {
    const tracker = new LapTracker();
    [...LAP, ...LAP].forEach((at) =>
      tracker.add(
        {
          camera: standing(at),
          cloth: surface,
          ms: 10,
          sightings: things.map((thing) => ({ ...sighting(thing.at, at, thing.colour), fit })),
        },
        FRAME
      )
    );
    return tracker;
  };
  const things = [
    { at: { x: 600, y: 1000 }, colour: "red" as const },
    { at: { x: 1100, y: 1800 }, colour: "cue" as const },
  ];

  it.each([
    ["a wooden desk", { y: 140, cb: 110, cr: 150 }],
    ["a white desk", { y: 200, cb: 128, cr: 128 }],
    ["a grey floor", { y: 100, cb: 126, cr: 130 }],
    ["blue carpet", { y: 90, cb: 170, cr: 110 }],
  ])("finds nothing on %s, and does not count it towards the lap", (_, surface) => {
    const tracker = lapOf(surface, things);
    expect(tracker.balls()).toHaveLength(0);
    expect(tracker.coverage()).toBe(0);
    expect(tracker.seeingCloth()).toBe(false);
  });

  it("knows snooker cloth, under warm light too", () => {
    expect(isSnookerCloth(CLOTH)).toBe(true);
    expect(isSnookerCloth({ y: 120, cb: 95, cr: 105 })).toBe(true);
  });

  it.each([[0.5], [1.5]])("ignores something the wrong size for a ball from there (%s times)", (fit) => {
    expect(lapOf(CLOTH, things, fit).balls()).toHaveLength(0);
  });

  it("ignores something that keeps changing colour", () => {
    const colours: BallColour[] = ["red", "blue", "yellow", "black"];
    const tracker = new LapTracker();
    [...LAP, ...LAP, ...LAP].forEach((at, index) =>
      tracker.add(
        { camera: standing(at), cloth: CLOTH, ms: 10, sightings: [sighting({ x: 900, y: 1500 }, at, colours[index % 4])] },
        FRAME
      )
    );
    expect(tracker.balls()).toHaveLength(0);
    expect(JSON.parse(tracker.report(FRAME, true)).mixedColours).toBe(1);
  });
});

describe("setting a spot from two sides", () => {
  it("takes the middle, which cancels an aim that landed beyond the spot from each side", () => {
    // The spot is at x = 1; each aim overshot by 2cm along its own line of sight.
    const result = combineViews({ x: 1.02, y: 0.84, z: 0 }, { x: 0.98, y: 0.86, z: 0 });
    expect(result.point.x).toBeCloseTo(1, 6);
    expect(result.point.y).toBeCloseTo(0.85, 6);
    expect(result.gapMm).toBeCloseTo(40, 6);
    expect(result.agree).toBe(true);
  });

  it("does not agree when the two aims were at different things", () => {
    expect(combineViews({ x: 1, y: 0.85, z: 0 }, { x: 1, y: 0.85, z: 0.08 }).agree).toBe(false);
  });
});

describe("finding the cloth's true height from two aims", () => {
  // The spot is on the cloth at 0.85m; the surface the camera found is 1cm higher than that.
  const spot = { x: 1, y: 0.85, z: 0 };
  const found = 0.86;
  const aimFrom = (origin: { x: number; y: number; z: number }) => {
    const direction = { x: spot.x - origin.x, y: spot.y - origin.y, z: spot.z - origin.z };
    const t = (found - origin.y) / direction.y;
    return {
      world: { x: origin.x + direction.x * t, y: found, z: origin.z + direction.z * t },
      ray: { origin, direction },
    };
  };
  const near = aimFrom({ x: -0.3, y: 1.4, z: 0.1 });
  const far = aimFrom({ x: 2.4, y: 1.4, z: -0.1 });

  it("finds where two lines of sight cross", () => {
    const meet = meetOfRays(near.ray, far.ray)!;
    expect(meet.gapMm).toBeLessThan(0.01);
    expect(meet.point.x).toBeCloseTo(spot.x, 6);
    expect(meet.point.y).toBeCloseTo(spot.y, 6);
  });

  it("puts the spot, and the cloth, back at their real height", () => {
    const result = combineAims(near, far);
    expect(result.agree).toBe(true);
    expect(result.point.y).toBeCloseTo(0.85, 4);
    expect(result.point.x).toBeCloseTo(1, 4);
    expect(result.heightShiftMm).toBe(-10);
  });

  it("falls back to the middle of the two aims without both lines of sight", () => {
    const result = combineAims({ world: near.world }, far);
    expect(result.heightShiftMm).toBe(0);
    expect(result.point.y).toBeCloseTo(found, 6);
  });

  it("ignores lines of sight that never pass near each other", () => {
    const wide = { ...far, ray: { ...far.ray, origin: { ...far.ray.origin, z: far.ray.origin.z + 0.3 } } };
    expect(combineAims(near, wide).heightShiftMm).toBe(0);
  });
});

describe("the lap's progress", () => {
  it("goes all the way round the table", () => {
    const sectors = new Set<number>();
    for (let step = 0; step < 48; step += 1) {
      const turn = (step / 48) * Math.PI * 2;
      sectors.add(
        sectorOf({
          x: TABLE.width / 2 + Math.cos(turn) * (TABLE.width / 2 + 300),
          y: TABLE.length / 2 + Math.sin(turn) * (TABLE.length / 2 + 300),
        })
      );
    }
    expect(sectors.size).toBe(LAP_SECTORS);
  });
});
