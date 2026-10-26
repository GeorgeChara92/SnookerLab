jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../../api/supabase", () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

import { useProTourStore } from "../proTourStore";
import { buildDrawLinks, slotLabel } from "../../features/tour/liveScores";

/** The store's state through what the phone saves and reads back: partialize, JSON, merge. */
const saveAndReload = (state: ReturnType<typeof useProTourStore.getState>) => {
  const { partialize, merge } = useProTourStore.persist.getOptions();
  const saved = JSON.parse(JSON.stringify(partialize!(state)));
  return merge!(saved, useProTourStore.getInitialState()) as ReturnType<typeof useProTourStore.getState>;
};

describe("pro tour cache: saved draws", () => {
  it("brings a draw's links back as a Map after a restart", () => {
    const links = buildDrawLinks([{ ToEvent: 2548, ToRound: 14, ToNumber: 1, ToIndex: 1, FromEvent: 2548, FromRound: 13, FromNumber: 2 }]);
    const state = {
      ...useProTourStore.getState(),
      tournaments: { 2548: { matches: [], links, loadedAt: Date.now() } },
    };
    const reloaded = saveAndReload(state).tournaments[2548];
    expect(reloaded.links).toBeInstanceOf(Map);
    expect(reloaded.links?.get("2548:14:1:1")).toEqual({ event: 2548, round: 13, number: 2 });
  });

  it("drops the {} an older version saved, so the tournament reloads rather than crashing", () => {
    const { merge } = useProTourStore.persist.getOptions();
    const reloaded = merge!(
      { tournaments: { 2548: { matches: [], links: {}, loadedAt: Date.now() } } },
      useProTourStore.getInitialState()
    ) as ReturnType<typeof useProTourStore.getState>;
    expect(reloaded.tournaments[2548].links).toBeNull();
  });

  it("labels a slot without throwing when the links aren't a Map", () => {
    const match = { eventId: 2548, round: 14, number: 1 } as Parameters<typeof slotLabel>[0];
    expect(() => slotLabel(match, 1, {} as never, new Map(), {})).not.toThrow();
    expect(slotLabel(match, 1, {} as never, new Map(), {})).toBeNull();
  });
});
