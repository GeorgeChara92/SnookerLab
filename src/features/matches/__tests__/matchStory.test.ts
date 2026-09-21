import { matchStory, nextFrameStakes } from "../matchStory";
import type { LiveFrameRecord } from "../../../types";

const frames = (winners: string): LiveFrameRecord[] =>
  winners.split("").map((w, index) => ({
    id: `f${index}`,
    match_id: "m",
    frame_number: index + 1,
    user_score: w === "u" ? 60 : 20,
    opponent_score: w === "u" ? 20 : 60,
    winner: w === "u" ? "user" : "opponent",
    highest_break_user: 0,
    highest_break_opponent: 0,
    breaks: [],
    events: [],
    created_at: "",
  }));

describe("the story of a match", () => {
  it("spots a decider", () => {
    expect(matchStory(frames("uouou"), 3)).toMatchObject({ decider: true, whitewash: false, winner: "user" });
    expect(matchStory(frames("uuou"), 3).decider).toBe(false);
  });

  it("spots a whitewash, but not in a one-frame match", () => {
    expect(matchStory(frames("uuu"), 3).whitewash).toBe(true);
    expect(matchStory(frames("u"), 1).whitewash).toBe(false);
  });

  it("measures a comeback", () => {
    expect(matchStory(frames("oouuu"), 3)).toMatchObject({ cameFromBehind: 2, winner: "user" });
    expect(matchStory(frames("uuooo"), 3)).toMatchObject({ cameFromBehind: 2, winner: "opponent" });
  });

  it("names what the next frame is worth", () => {
    expect(nextFrameStakes({ user: 2, opponent: 2 }, 3)).toBe("DECIDER");
    expect(nextFrameStakes({ user: 2, opponent: 0 }, 3)).toBe("MATCH FRAME");
    expect(nextFrameStakes({ user: 1, opponent: 0 }, 3)).toBeNull();
    expect(nextFrameStakes({ user: 0, opponent: 0 }, 1)).toBeNull();
  });
});
