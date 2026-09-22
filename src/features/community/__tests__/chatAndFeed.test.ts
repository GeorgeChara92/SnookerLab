import { shareBody, shareFromMessage, sharePayload, type ChatShare } from "../chatShare";
import {
  achievementActivity,
  beats,
  levelActivity,
  matchActivity,
  matchFinished,
  personalBestActivity,
} from "../activityItems";
import type { Highlight } from "../../matches/highlights";
import type { Match } from "../../../types";

const match = (us: number, them: number, extra: Partial<Match> = {}): Match =>
  ({
    id: "m1",
    user_id: "u",
    opponent_name: "Judd",
    date: "2026-09-20",
    match_type: "league",
    format: "best_of",
    target_frames: 5,
    frames_played: us + them,
    user_score: us,
    opponent_score: them,
    result: us > them ? "win" : us < them ? "loss" : "draw",
    recording_mode: "live",
    sync_status: "synced",
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T11:00:00Z",
    ...extra,
  }) as Match;

const highlight = (kind: Highlight["kind"], sentence = ""): Highlight => ({
  kind,
  label: kind.toUpperCase(),
  sentence,
});

describe("sending in a chat", () => {
  const routine: ChatShare = { kind: "routine", name: "Line-up", subtitle: "Up to 147", libraryId: "routine-line-up" };
  const result: ChatShare = {
    kind: "match",
    opponent: "Judd",
    userScore: 3,
    opponentScore: 1,
    result: "win",
    date: "2026-09-20",
    bestOf: 5,
    highBreak: 112,
    highlights: ["CENTURY · 112"],
  };

  it("says what was sent in words", () => {
    expect(shareBody(routine)).toBe("Routine: Line-up");
    expect(shareBody(result)).toBe("Match: Beat Judd 3–1");
    expect(shareBody({ ...result, userScore: 1, opponentScore: 3, result: "loss" })).toBe("Match: Lost to Judd 1–3");
  });

  it("reads back what it saved", () => {
    expect(shareFromMessage("routine", sharePayload(routine))).toEqual({ ...routine, sharedId: null });
    expect(shareFromMessage("match", sharePayload(result))).toEqual(result);
  });

  it("shows text for anything malformed", () => {
    expect(shareFromMessage("routine", null)).toBeNull();
    expect(shareFromMessage("routine", { name: "No link" })).toBeNull();
    expect(shareFromMessage("routine", { name: "Bad id", sharedId: "../../etc" })).toBeNull();
    expect(shareFromMessage("match", { opponent: "Judd", userScore: -1, opponentScore: 2, result: "win" })).toBeNull();
    expect(shareFromMessage("match", { opponent: "Judd", userScore: 1, opponentScore: 2, result: "maybe" })).toBeNull();
    expect(shareFromMessage("text", { name: "x" })).toBeNull();
  });
});

describe("the feed", () => {
  it("knows when a match is over", () => {
    expect(matchFinished(match(3, 1))).toBe(true);
    expect(matchFinished(match(2, 1))).toBe(false);
    expect(matchFinished(match(0, 0, { recording_mode: "manual", frames_played: 0 }))).toBe(true);
    expect(matchFinished(match(4, 2, { target_frames: undefined, format: "open" as Match["format"] }))).toBe(false);
  });

  it("posts a win", () => {
    const item = matchActivity(match(3, 1), [], 45);
    expect(item?.kind).toBe("match");
    expect(item?.title).toBe("Beat Judd 3–1");
    expect(item?.dedupeKey).toBe("match:m1");
  });

  it("leads with the best moment, even in a loss", () => {
    const item = matchActivity(match(1, 3), [highlight("century")], 112);
    expect(item?.kind).toBe("century");
    expect(item?.title).toBe("Made a 112 break against Judd");
    expect(item?.detail).toBe("Lost to Judd 1–3");
    expect(
      matchActivity(match(3, 0), [highlight("maximum"), highlight("whitewash", "A whitewash.")], 147)
    ).toMatchObject({
      kind: "maximum",
      detail: "Beat Judd 3–0 A whitewash.",
    });
  });

  it("keeps a plain loss to itself", () => {
    expect(matchActivity(match(1, 3), [], 30)).toBeNull();
    expect(matchActivity(match(1, 3), [highlight("fifties", "A break of 55.")], 55)).toBeNull();
  });

  it("writes bests, levels and the hardest achievements", () => {
    expect(personalBestActivity("routine-line-up", "Line-up", "72")).toMatchObject({
      title: "New best on Line-up",
      detail: "72",
      dedupeKey: "pb:routine-line-up:72",
    });
    expect(levelActivity(12).dedupeKey).toBe("level:12");
    expect(
      achievementActivity({ id: "a", title: "Century Maker", description: "Make a century", tier: "gold" })
    ).not.toBeNull();
    expect(achievementActivity({ id: "b", title: "First Win", description: "Win", tier: "bronze" })).toBeNull();
  });

  it("counts less as better for timed routines", () => {
    expect(beats(40, 50, "time")).toBe(true);
    expect(beats(60, 50, "time")).toBe(false);
    expect(beats(60, 50, "number")).toBe(true);
    expect(beats(60, undefined, "number")).toBe(false);
  });
});
