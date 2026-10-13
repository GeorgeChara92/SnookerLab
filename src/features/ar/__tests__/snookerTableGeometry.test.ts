import { SNOOKER_TABLE_GEOMETRY } from "../snookerTableGeometry";
import { SPOTS, TABLE } from "../../scanSnooker/table";

/**
 * This geometry must agree with `table.ts` - the one every routine's ball position, the diagram
 * and the AR calibration all trust - or a routine's layout quietly comes out a different size, or
 * with a spot on the wrong side, from everything else in the app. Both bugs have happened before
 * (see memory `routines-pending-work`): a separate 3.657 x 1.829m table size, and yellow and green
 * swapped.
 */
describe("the routine-layout geometry agrees with table.ts", () => {
  const toMm = (norm: { xNorm: number; yNorm: number }) => ({
    x: norm.xNorm * TABLE.width,
    y: norm.yNorm * TABLE.length,
  });
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, mm = 1) => {
    expect(Math.abs(a.x - b.x)).toBeLessThan(mm);
    expect(Math.abs(a.y - b.y)).toBeLessThan(mm);
  };

  it("sizes the table the same as table.ts", () => {
    expect(SNOOKER_TABLE_GEOMETRY.playingLengthM * 1000).toBeCloseTo(TABLE.length, 5);
    expect(SNOOKER_TABLE_GEOMETRY.playingWidthM * 1000).toBeCloseTo(TABLE.width, 5);
  });

  it("puts every spot where table.ts puts it", () => {
    near(toMm(SNOOKER_TABLE_GEOMETRY.blackSpot), SPOTS.black);
    near(toMm(SNOOKER_TABLE_GEOMETRY.pinkSpot), SPOTS.pink);
    near(toMm(SNOOKER_TABLE_GEOMETRY.blueSpot), SPOTS.blue);
    near(toMm(SNOOKER_TABLE_GEOMETRY.spots.brown), SPOTS.brown);
    near(toMm(SNOOKER_TABLE_GEOMETRY.spots.yellow), SPOTS.yellow);
    near(toMm(SNOOKER_TABLE_GEOMETRY.spots.green), SPOTS.green);
  });

  it("keeps yellow on the right of the D and green on the left, seen from baulk", () => {
    expect(SNOOKER_TABLE_GEOMETRY.spots.yellow.xNorm).toBeGreaterThan(SNOOKER_TABLE_GEOMETRY.spots.green.xNorm);
  });
});
