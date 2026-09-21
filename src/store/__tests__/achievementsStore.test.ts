jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockUpsert = jest.fn(async () => ({ error: null }));
let mockServerRows: Array<{ achievement_id: string; unlocked_at: string }> = [];
jest.mock("../../api/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: async () => ({ data: mockServerRows, error: null }) }),
      upsert: (...args: unknown[]) => (mockUpsert as any)(...args),
    }),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAchievementsStore } from "../achievementsStore";

const store = () => useAchievementsStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUpsert.mockClear();
  mockServerRows = [];
  useAchievementsStore.setState({ ownerId: null, unlocked: {}, hydrated: false, hydratedAt: 0 });
});

describe("achievements kept with the account", () => {
  it("loads what the account has, so signing back in keeps the level", async () => {
    mockServerRows = [{ achievement_id: "first-win", unlocked_at: "2026-09-01T10:00:00Z" }];
    store().setOwner("u1");
    await store().hydrate("u1");
    expect(store().hydrated).toBe(true);
    expect(Object.keys(store().unlocked)).toEqual(["first-win"]);
  });

  it("brings across the old phone-only list once, and saves it to the account", async () => {
    await AsyncStorage.setItem("seen_achievements", JSON.stringify(["first-win", "ten-matches"]));
    mockServerRows = [{ achievement_id: "first-win", unlocked_at: "2026-09-01T10:00:00Z" }];
    store().setOwner("u1");
    await store().hydrate("u1");
    expect(Object.keys(store().unlocked).sort()).toEqual(["first-win", "ten-matches"]);
    const rows = (mockUpsert.mock.calls[0] as any)[0];
    expect(rows.map((row: any) => row.achievement_id)).toEqual(["ten-matches"]);
    expect(await AsyncStorage.getItem("seen_achievements")).toBeNull();
  });

  it("reports only what is new, and nothing before it has loaded", async () => {
    store().setOwner("u1");
    expect(store().unlock(["first-win"])).toEqual([]);
    await store().hydrate("u1");
    expect(store().unlock(["first-win"])).toEqual(["first-win"]);
    expect(store().unlock(["first-win", "ten-matches"])).toEqual(["ten-matches"]);
  });

  it("forgets one player's achievements when another signs in", async () => {
    mockServerRows = [{ achievement_id: "first-win", unlocked_at: "2026-09-01T10:00:00Z" }];
    store().setOwner("u1");
    await store().hydrate("u1");
    store().setOwner("u2");
    expect(store().unlocked).toEqual({});
    expect(store().hydrated).toBe(false);
  });
});
