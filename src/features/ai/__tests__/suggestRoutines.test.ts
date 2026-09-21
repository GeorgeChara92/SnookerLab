import { DEFAULT_ROUTINES } from "../../../constants/routines";
import { suggestRoutines, TOPICS } from "../suggestRoutines";

const report = (parts: Partial<Parameters<typeof suggestRoutines>[0] & object>) => ({
  summary: "",
  positives: [],
  improvements: [],
  possible_causes: [],
  not_assessable: [],
  coaching_tip: "",
  ...parts,
});

const ids = (suggestions: ReturnType<typeof suggestRoutines>) => suggestions.map((s) => s.routine.id);

describe("suggesting routines from a coaching report", () => {
  it("only points at routines that are in the library", () => {
    const library = new Set(DEFAULT_ROUTINES.map((routine) => routine.id));
    TOPICS.forEach((topic) => topic.routines.forEach((id) => expect(library.has(id)).toBe(true)));
  });

  it("answers what the coach said to work on, one part of the game each, quoting the finding", () => {
    const suggestions = suggestRoutines(
      report({
        summary: "A solid pot on a straight red.",
        improvements: [
          "Your head lifts slightly as the cue goes through the ball.",
          "The bridge hand moves on the final backswing.",
        ],
        possible_causes: ["Tension in the grip hand pulls the cue across the line."],
        coaching_tip: "Stay down until the object ball drops.",
      }),
      "technique",
      DEFAULT_ROUTINES
    );
    expect(suggestions).toHaveLength(3);
    expect(new Set(suggestions.map((s) => s.topic)).size).toBe(3);
    expect(ids(suggestions)).toEqual(
      expect.arrayContaining(["routine-head-position-fundamentals", "routine-bridge-fundamentals"])
    );
    const head = suggestions.find((s) => s.routine.id === "routine-head-position-fundamentals");
    expect(head?.because).toBe("Your head lifts slightly as the cue goes through the ball.");
  });

  it("ignores what the clip could not show", () => {
    const suggestions = suggestRoutines(
      report({
        improvements: ["Screw the cue ball back further for position on the next red."],
        not_assessable: ["Stance and feet were out of shot."],
      }),
      "shot",
      DEFAULT_ROUTINES
    );
    expect(ids(suggestions)).toContain("routine-screw-back");
    expect(ids(suggestions)).not.toContain("routine-bridge-grip-stance");
  });

  it("does not read a camera 'side-on' as side spin", () => {
    const suggestions = suggestRoutines(
      report({ improvements: ["Film side-on so the cue arm can be seen."] }),
      "stance",
      DEFAULT_ROUTINES
    );
    expect(ids(suggestions)).not.toContain("routine-side-spin-control");
  });

  it("falls back to a routine for the chosen focus when nothing matches", () => {
    const suggestions = suggestRoutines(report({ improvements: ["Keep going."] }), "tactical", DEFAULT_ROUTINES);
    expect(ids(suggestions)).toEqual(["routine-baulk-safety"]);
    expect(suggestions[0].because).toBeUndefined();
  });

  it("suggests nothing without a report", () => {
    expect(suggestRoutines(undefined, "technique", DEFAULT_ROUTINES)).toEqual([]);
  });
});
