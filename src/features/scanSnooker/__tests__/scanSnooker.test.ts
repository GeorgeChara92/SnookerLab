import {
  BALL_RADIUS,
  LANDMARKS,
  SPOTS,
  TABLE,
  calibrationQuality,
  clampToBed,
  describeCorrection,
  describePosition,
  distance,
  frameFromLandmarks,
  tableToWorld,
  worldToTable,
  type Point,
} from "../table";
import { ballFromRay, clothFromAim, onTable, rayAtHeight, tableLines } from "../ar";
import { coloursOnSpots, countOf, moveBall, placeBall, separate, summarise, type PlacedBall } from "../position";

const near = (a: Point, b: Point, mm = 0.5) => expect(distance(a, b)).toBeLessThan(mm);

describe("the table", () => {
  it("has the colours where a referee would spot them", () => {
    expect(SPOTS.brown).toEqual({ x: 889, y: 2832 });
    expect(SPOTS.yellow.x).toBeGreaterThan(SPOTS.green.x); // yellow on the right, seen from baulk
    expect(SPOTS.blue.y).toBeCloseTo(TABLE.length / 2);
    expect(SPOTS.pink.y).toBeCloseTo(TABLE.length / 4);
    expect(SPOTS.black.y).toBe(324);
  });

  it("keeps a ball's centre at least its radius from every cushion", () => {
    expect(clampToBed({ x: -50, y: 5000 })).toEqual({ x: BALL_RADIUS, y: TABLE.length - BALL_RADIUS });
  });

  it("says where a ball is the way you would measure it", () => {
    const { side, end } = describePosition({ x: 300, y: 1000 });
    expect(side).toBe("27 cm from the left cushion");
    expect(end).toBe("97 cm from the top cushion");
  });

  it("says which way to move a ball back into place", () => {
    expect(describeCorrection({ x: 500, y: 1040 }, { x: 490, y: 1000 })).toBe("4 cm towards the black, 1 cm left");
    expect(describeCorrection({ x: 500, y: 1000 }, { x: 502, y: 1003 })).toBeNull();
  });
});

describe("calibrating from two landmarks", () => {
  // A table turned 30 degrees in the world, its black-end left corner at (2, 0.8, -3) metres.
  const angle = Math.PI / 6;
  const truth = (p: Point) => ({
    x: 2 + (p.x / 1000) * Math.cos(angle) - (p.y / 1000) * Math.sin(angle),
    y: 0.8,
    z: -3 + (p.x / 1000) * Math.sin(angle) + (p.y / 1000) * Math.cos(angle),
  });

  it("finds the table from any two landmarks and maps positions both ways", () => {
    const pairs = [
      ["black-spot", "brown-spot"],
      ["top-left-pocket", "top-right-pocket"],
      ["pink-spot", "middle-right-pocket"],
    ];
    for (const [a, b] of pairs) {
      const first = LANDMARKS.find((mark) => mark.id === a)!;
      const second = LANDMARKS.find((mark) => mark.id === b)!;
      const frame = frameFromLandmarks(
        { table: first.point, world: truth(first.point) },
        { table: second.point, world: truth(second.point) }
      );
      expect(frame.errorMm).toBeLessThan(0.01);
      const ball = { x: 1234, y: 2345 };
      const world = tableToWorld(frame, ball);
      expect(world.y).toBeCloseTo(0.8 + BALL_RADIUS / 1000);
      near(worldToTable(frame, world), ball);
      near(worldToTable(frame, truth(SPOTS.blue)), SPOTS.blue);
    }
  });

  it("reports how far off the taps were, so a poor calibration can be redone", () => {
    const tapped = truth(SPOTS.brown);
    const frame = frameFromLandmarks(
      { table: SPOTS.black, world: truth(SPOTS.black) },
      { table: SPOTS.brown, world: { ...tapped, z: tapped.z + 0.06 } }
    );
    expect(frame.errorMm).toBeGreaterThan(30);
    expect(calibrationQuality(frame.errorMm)).not.toBe("good");
    expect(calibrationQuality(8)).toBe("good");
  });
});

describe("placing balls", () => {
  it("never lets two balls overlap, though they can touch", () => {
    const others = [{ x: 800, y: 1000 }];
    const point = separate({ x: 810, y: 1000 }, others);
    expect(distance(point, others[0])).toBeCloseTo(TABLE.ball, 1);
  });

  it("moves a colour rather than doubling it, and stops at fifteen reds", () => {
    let balls: PlacedBall[] = [];
    balls = placeBall(balls, "blue", { x: 800, y: 1700 }).balls;
    balls = placeBall(balls, "blue", { x: 300, y: 300 }).balls;
    expect(countOf(balls, "blue")).toBe(1);
    expect(balls[0]).toMatchObject({ x: 300, y: 300 });

    for (let i = 0; i < 15; i += 1) balls = placeBall(balls, "red", { x: 200 + i * 80, y: 600 }).balls;
    const sixteenth = placeBall(balls, "red", { x: 900, y: 900 });
    expect(countOf(sixteenth.balls, "red")).toBe(15);
    expect(sixteenth.refused).toMatch(/15/);
  });

  it("puts the colours on their spots in one go, leaving any already placed", () => {
    const moved = placeBall([], "black", { x: 500, y: 500 }).balls;
    const balls = coloursOnSpots(moved);
    expect(balls).toHaveLength(6);
    expect(balls.find((ball) => ball.colour === "black")).toMatchObject({ x: 500, y: 500 });
    expect(balls.find((ball) => ball.colour === "pink")).toMatchObject(SPOTS.pink);
  });

  it("drags a ball without letting it land on another", () => {
    const start = placeBall(placeBall([], "cue", { x: 900, y: 3000 }).balls, "pink", SPOTS.pink).balls;
    const cue = start.find((ball) => ball.colour === "cue")!;
    const after = moveBall(start, cue.id, SPOTS.pink);
    expect(distance(after.find((ball) => ball.colour === "cue")!, SPOTS.pink)).toBeCloseTo(TABLE.ball, 1);
  });

  it("sums up what is on the table", () => {
    let balls: PlacedBall[] = coloursOnSpots([]);
    balls = placeBall(balls, "cue", { x: 900, y: 3100 }).balls;
    balls = placeBall(balls, "red", { x: 300, y: 600 }).balls;
    expect(summarise(balls)).toBe("Cue ball, 1 red and 6 colours");
    expect(summarise([])).toBe("No balls placed");
  });
});


describe("reading the table through the camera", () => {
  // The same turned table as above.
  const angle = Math.PI / 6;
  const at = (p: { x: number; y: number }, height = 0.8) => ({
    x: 2 + (p.x / 1000) * Math.cos(angle) - (p.y / 1000) * Math.sin(angle),
    y: height,
    z: -3 + (p.x / 1000) * Math.sin(angle) + (p.y / 1000) * Math.cos(angle),
  });
  const frame = frameFromLandmarks(
    { table: SPOTS.black, world: at(SPOTS.black) },
    { table: SPOTS.brown, world: at(SPOTS.brown) }
  );

  it("follows a ray to a height, and not backwards", () => {
    const ray = { origin: { x: 0, y: 1.5, z: 0 }, direction: { x: 0, y: -1, z: 1 } };
    expect(rayAtHeight(ray, 0.5)).toEqual({ x: 0, y: 0.5, z: 1 });
    expect(rayAtHeight({ ...ray, direction: { x: 0, y: 1, z: 0 } }, 0.5)).toBeNull();
  });

  it("finds a ball's centre from aiming at it, not the spot behind it on the cloth", () => {
    const ball = { x: 1100, y: 1500 };
    const centre = at(ball, 0.8 + BALL_RADIUS / 1000);
    // Standing at the baulk end, phone at head height, aimed at the ball's centre.
    const eye = { x: centre.x + 0.3, y: 1.6, z: centre.z + 1.4 };
    const length = Math.hypot(centre.x - eye.x, centre.y - eye.y, centre.z - eye.z);
    const ray = {
      origin: eye,
      direction: { x: (centre.x - eye.x) / length, y: (centre.y - eye.y) / length, z: (centre.z - eye.z) / length },
    };
    near(ballFromRay(frame, ray)!, ball, 0.5);
    // Following the same ray down to the cloth would be well out.
    const cloth = worldToTable(frame, rayAtHeight(ray, 0.8)!);
    expect(distance(cloth, ball)).toBeGreaterThan(40);
  });

  it("uses the surface the camera found, or the cloth's level when it found none", () => {
    expect(clothFromAim({ hit: { x: 1, y: 0.8, z: 2 } })).toEqual({ x: 1, y: 0.8, z: 2 });
    const fromRay = clothFromAim({ origin: { x: 0, y: 1.8, z: 0 }, direction: { x: 0, y: -1, z: 0 } }, 0.8);
    expect(fromRay!.y).toBeCloseTo(0.8);
    expect(clothFromAim({})).toBeNull();
  });

  it("draws the table's outline where the real one is", () => {
    const [cushions, baulk, d] = tableLines(frame);
    expect(cushions.points).toHaveLength(5);
    near(worldToTable(frame, cushions.points[2]), { x: TABLE.width, y: TABLE.length });
    near(worldToTable(frame, baulk.points[0]), { x: 0, y: 2832 });
    near(worldToTable(frame, d.points[12]), { x: SPOTS.brown.x, y: 2832 + TABLE.dRadius });
    expect(onTable({ x: -30, y: 100 })).toBe(true);
    expect(onTable({ x: -300, y: 100 })).toBe(false);
  });
});

import { fullRack, placeLine, pointsAlongLine } from "../position";

describe("laying balls in bulk", () => {
  it("spaces a line evenly and never closer than touching", () => {
    const points = pointsAlongLine({ x: 300, y: 1000 }, { x: 300, y: 1400 }, 5);
    expect(points).toHaveLength(5);
    expect(distance(points[0], points[1])).toBeCloseTo(100);
    // 100 mm only has room for two balls touching.
    expect(pointsAlongLine({ x: 300, y: 1000 }, { x: 300, y: 1100 }, 5)).toHaveLength(2);
  });

  it("lays reds up to fifteen and says why any were left off", () => {
    let result = placeLine([], { x: 200, y: 600 }, { x: 1500, y: 600 }, 10);
    expect(result.placed).toBe(10);
    expect(result.notice).toBeNull();
    result = placeLine(result.balls, { x: 200, y: 900 }, { x: 1500, y: 900 }, 10);
    expect(result.placed).toBe(5);
    expect(result.notice).toMatch(/15 reds/);
    expect(placeLine([], { x: 300, y: 1000 }, { x: 300, y: 1060 }, 4).notice).toMatch(/fit/);
  });

  it("racks fifteen reds behind the pink, none touching each other or the pink", () => {
    const balls = fullRack(placeBall([], "red", { x: 200, y: 200 }).balls);
    const reds = balls.filter((ball) => ball.colour === "red");
    expect(reds).toHaveLength(15);
    expect(balls.filter((ball) => ball.colour !== "red")).toHaveLength(6);
    for (let i = 0; i < balls.length; i += 1) {
      for (let j = i + 1; j < balls.length; j += 1) {
        expect(distance(balls[i], balls[j])).toBeGreaterThanOrEqual(TABLE.ball);
      }
    }
    // Every red is on the black side of the pink.
    expect(reds.every((ball) => ball.y < SPOTS.pink.y)).toBe(true);
  });
});
