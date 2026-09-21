import { rewardsBetween, rewardsForLevel } from "../levelRewards";

describe("level rewards", () => {
  it("names what each level earns", () => {
    expect(rewardsForLevel(1)).toEqual([]);
    expect(rewardsForLevel(2).map((reward) => reward.label)).toEqual(["Red ring", "Shirt and tie"]);
    expect(rewardsForLevel(3).map((reward) => reward.label)).toEqual(["Yellow ring"]);
    expect(rewardsForLevel(9)).toEqual([{ kind: "custom-ring", label: "A ring in any colour you like" }]);
    expect(rewardsForLevel(10)).toEqual([]);
  });

  it("gathers everything across a jump of several levels", () => {
    expect(rewardsBetween(3, 5).map((reward) => reward.label)).toEqual(["Green ring", "Blazer", "Brown ring"]);
    expect(rewardsBetween(5, 5)).toEqual([]);
  });
});
