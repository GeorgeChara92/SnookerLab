import { containsBlockedWord, setBlockedWords } from "../wordFilter";
import { cleanHandle, handleAlternatives, handleProblem, suggestHandle } from "../handle";

describe("word filter", () => {
  it("catches whole words, whatever the case or letter swaps", () => {
    expect(containsBlockedWord("What the F*CK")).toBe(false);
    expect(containsBlockedWord("oh sh1t")).toBe(true);
    expect(containsBlockedWord("You $LUT")).toBe(true);
    expect(containsBlockedWord("fuck_this")).toBe(true);
  });

  it("leaves innocent words alone", () => {
    expect(containsBlockedWord("Scunthorpe snooker club")).toBe(false);
    expect(containsBlockedWord("Hitchcock")).toBe(false);
    expect(containsBlockedWord("grapes")).toBe(false);
    expect(containsBlockedWord("")).toBe(false);
  });

  it("adds words loaded from the database", () => {
    setBlockedWords(["plonker"]);
    expect(containsBlockedWord("what a Plonker")).toBe(true);
    setBlockedWords([]);
  });
});

describe("handles", () => {
  it("tidies what is typed", () => {
    expect(cleanHandle("@George Chara!")).toBe("george_chara");
    expect(cleanHandle("A".repeat(30))).toHaveLength(20);
  });

  it("suggests one from a name", () => {
    expect(suggestHandle("Georgechara")).toBe("georgechara");
    expect(suggestHandle("Jo")).toBe("joplayer");
  });

  it("explains what is wrong", () => {
    expect(handleProblem("ab")).toMatch(/3 characters/);
    expect(handleProblem("_george")).toMatch(/Start and end/);
    expect(handleProblem("big_shit")).toMatch(/not allowed/);
    expect(handleProblem("george.c_147")).toBeNull();
  });
});

describe("handle alternatives", () => {
  it("offers valid handles built from the one wanted", () => {
    const options = handleAlternatives("george", "George Chara");
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(options).toContain("george147");
    expect(options).toContain("george_snooker");
    options.forEach((option) => expect(handleProblem(option)).toBeNull());
  });
});

describe("leaderboard ranks", () => {
  it("shares a place on a tie and counts on after it", () => {
    const { rankEntries } = require("../links");
    const ranked = rankEntries([{ value: 10 }, { value: 30 }, { value: 30 }, { value: 5 }]);
    expect(ranked.map((row: { value: number; rank: number }) => [row.value, row.rank])).toEqual([
      [30, 1],
      [30, 1],
      [10, 3],
      [5, 4],
    ]);
  });

  it("puts the quickest first for timed routines", () => {
    const { rankEntries } = require("../links");
    const ranked = rankEntries([{ value: 420 }, { value: 390 }], false);
    expect(ranked[0]).toMatchObject({ value: 390, rank: 1 });
  });

  it("reads a routine link", () => {
    const { routineIdFromLink, routineLink } = require("../links");
    const id = "3f0c2a1e-9b7d-4c1a-8e2f-1234567890ab";
    expect(routineIdFromLink(routineLink(id))).toBe(id);
    expect(routineIdFromLink("snookerlab://auth/callback")).toBeNull();
  });
});
