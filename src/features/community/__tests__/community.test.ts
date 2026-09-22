import { containsBlockedWord, setBlockedWords } from "../wordFilter";
import { cleanHandle, handleProblem, suggestHandle } from "../handle";

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
