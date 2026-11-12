import { spreadForDisplay } from "../displaySpread";
import { TABLE } from "../table";

const closest = (balls: Array<{ x: number; y: number }>) => {
  let best = Infinity;
  balls.forEach((a, i) => balls.slice(i + 1).forEach((b) => (best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y)))));
  return best;
};

describe("drawing balls bigger without overlaps", () => {
  const big = TABLE.ball * 2.2;

  it("spreads a touching pack so its balls only touch at the bigger size", () => {
    const pack = [
      { id: "a", x: 889, y: 800 },
      { id: "b", x: 889 - 26.3, y: 754.5 },
      { id: "c", x: 889 + 26.3, y: 754.5 },
    ];
    const shown = spreadForDisplay(pack, big);
    expect(closest(shown)).toBeGreaterThanOrEqual(big - 0.1);
    expect(closest(shown)).toBeLessThan(big + 0.1);
  });

  it("keeps the pack centred where it was", () => {
    const pack = [
      { id: "a", x: 900, y: 800 },
      { id: "b", x: 952.6, y: 800 },
    ];
    const shown = spreadForDisplay(pack, big);
    expect((shown[0].x + shown[1].x) / 2).toBeCloseTo(926.3, 5);
  });

  it("doesn't move a ball that's nowhere near another", () => {
    const balls = [
      { id: "a", x: 300, y: 300 },
      { id: "b", x: 1200, y: 2500 },
    ];
    expect(spreadForDisplay(balls, big)).toEqual(balls);
  });

  it("never changes the balls it's given", () => {
    const balls = [
      { id: "a", x: 900, y: 800 },
      { id: "b", x: 952.6, y: 800 },
    ];
    spreadForDisplay(balls, big);
    expect(balls[0].x).toBe(900);
  });
});
