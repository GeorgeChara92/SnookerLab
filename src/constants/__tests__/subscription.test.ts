import { SHARE_THEMES, SUBSCRIPTION_LIMITS, planLine } from "../subscription";
import { CARD_THEMES } from "../../components/matches/cardThemes";

describe("what each plan gets", () => {
  it("describes each plan from its own limits", () => {
    expect(planLine("customRoutines", "free")).toBe("Build up to 3 routines");
    expect(planLine("customRoutines", "half_century")).toBe("Build as many routines as you like");
    expect(planLine("recordSnooker", "free")).toBe("3 recorded snookers a month");
    expect(planLine("savedSessions", "free")).toBe("Save 1 practice session");
    expect(planLine("statsHistory", "free")).toBe("Stats from the last 30 days");
    expect(planLine("statsHistory", "century")).toBe("Your full stats history");
  });

  it("gives every paid plan at least what Free has", () => {
    const keys = Object.keys(SUBSCRIPTION_LIMITS.free) as Array<keyof typeof SUBSCRIPTION_LIMITS.free>;
    for (const key of keys) {
      const free = SUBSCRIPTION_LIMITS.free[key];
      for (const tier of ["half_century", "century"] as const) {
        const paid = SUBSCRIPTION_LIMITS[tier][key];
        if (paid !== null && free !== null) expect(paid).toBeGreaterThanOrEqual(free);
        if (free === null) expect(paid).toBeNull();
      }
    }
  });

  it("only names result card backgrounds that exist, and keeps Free's on every plan", () => {
    const ids = CARD_THEMES.map((theme) => theme.id);
    [SHARE_THEMES.free, SHARE_THEMES.half_century].forEach((list) => list!.forEach((id) => expect(ids).toContain(id)));
    SHARE_THEMES.free!.forEach((id) => expect(SHARE_THEMES.half_century).toContain(id));
  });
});
