jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { useOnboardingStore } from "../onboardingStore";

const store = () => useOnboardingStore.getState();

beforeEach(() => {
  useOnboardingStore.setState({
    toursDone: { player: [], coach: [] },
    seenVersion: { player: null, coach: null },
    open: null,
  });
});

describe("the welcome tour and what's new, kept separate per audience", () => {
  it("opens the tour or what's new for just the audience asked", () => {
    store().openTour("coach");
    expect(store().open).toEqual({ kind: "tour", audience: "coach" });
    store().openWhatsNew("player");
    expect(store().open).toEqual({ kind: "whatsNew", audience: "player" });
    store().close();
    expect(store().open).toBeNull();
  });

  it("finishing a tour marks only that audience done, and sets only its own seen version", () => {
    store().finishTour("u1", "coach", "1.2.0");
    expect(store().toursDone.coach).toEqual(["u1"]);
    expect(store().toursDone.player).toEqual([]);
    expect(store().seenVersion.coach).toBe("1.2.0");
    expect(store().seenVersion.player).toBeNull();
    expect(store().open).toBeNull();
  });

  it("finishing with no account id still records the version and closes, without adding to toursDone", () => {
    store().finishTour(null, "player", "1.2.0");
    expect(store().toursDone.player).toEqual([]);
    expect(store().seenVersion.player).toBe("1.2.0");
  });

  it("skipping a tour marks it done for that audience without opening anything", () => {
    store().skipTour("u1", "player");
    expect(store().toursDone.player).toEqual(["u1"]);
    expect(store().toursDone.coach).toEqual([]);
    expect(store().seenVersion.player).toBeNull();
    expect(store().open).toBeNull();
  });

  it("keeps at most the last 20 accounts per audience, moving a repeat to the end rather than growing", () => {
    for (let i = 0; i < 20; i += 1) store().skipTour(`u${i}`, "coach");
    expect(store().toursDone.coach).toHaveLength(20);

    store().skipTour("u0", "coach");
    expect(store().toursDone.coach).toHaveLength(20);
    expect(store().toursDone.coach[19]).toBe("u0");

    store().skipTour("u20", "coach");
    expect(store().toursDone.coach).toHaveLength(20);
    expect(store().toursDone.coach).not.toContain("u1");
  });

  it("markSeen updates only the given audience's version", () => {
    store().markSeen("coach", "1.3.0");
    expect(store().seenVersion.coach).toBe("1.3.0");
    expect(store().seenVersion.player).toBeNull();
  });
});

describe("migrating from before player and coach were kept apart", () => {
  const migrate = (useOnboardingStore as any).persist.getOptions().migrate as (persisted: any, version: number) => any;

  it("carries an old flat list over to the player audience, and starts coach fresh", () => {
    const next = migrate({ toursDone: ["u1", "u2"], seenVersion: "1.1.0" }, 3);
    expect(next.toursDone).toEqual({ player: ["u1", "u2"], coach: [] });
    expect(next.seenVersion).toEqual({ player: "1.1.0", coach: null });
  });

  it("copes with nothing persisted yet", () => {
    const next = migrate(undefined, 0);
    expect(next.toursDone).toEqual({ player: [], coach: [] });
    expect(next.seenVersion).toEqual({ player: null, coach: null });
  });

  it("copes with a non-array toursDone from an even older or corrupt version", () => {
    const next = migrate({ toursDone: "oops", seenVersion: null }, 1);
    expect(next.toursDone).toEqual({ player: [], coach: [] });
  });
});
