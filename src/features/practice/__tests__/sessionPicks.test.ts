import { DEFAULT_ROUTINES } from "../../../constants";
import { pickSessionRoutines } from "../sessionPicks";
import { suggestRoutines } from "../../ai/suggestRoutines";

const BREAK_BUILDING = [
  { categoryId: "cat-break-building", weight: 1 },
  { categoryId: "cat-cue-ball-control", weight: 0.5 },
];

describe("the session builder's picks", () => {
  it("gives every break-building routine a chance, the newest included", () => {
    const everPicked = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) {
      pickSessionRoutines({ routines: DEFAULT_ROUTINES, sections: BREAK_BUILDING, keywords: [], count: 4, seed }).forEach((routine) =>
        everPicked.add(routine.id)
      );
    }
    const breakBuilding = DEFAULT_ROUTINES.filter((routine) => routine.category_id === "cat-break-building" && routine.content_type !== "guide");
    breakBuilding.forEach((routine) => expect(everPicked).toContain(routine.id));
    expect(everPicked).toContain("routine-black-spot-builder-level-3");
  });

  it("changes the mix when shuffled", () => {
    const ids = (seed: number) =>
      pickSessionRoutines({ routines: DEFAULT_ROUTINES, sections: BREAK_BUILDING, keywords: [], count: 4, seed })
        .map((routine) => routine.id)
        .join();
    const mixes = new Set(Array.from({ length: 10 }, (_, seed) => ids(seed)));
    expect(mixes.size).toBeGreaterThan(3);
  });

  it("still fills a session from the main section before the extra one", () => {
    const picked = pickSessionRoutines({ routines: DEFAULT_ROUTINES, sections: BREAK_BUILDING, keywords: [], count: 4, seed: 7 });
    picked.forEach((routine) => expect(routine.category_id).toBe("cat-break-building"));
  });

  it("puts a routine that matches a ticked detail first", () => {
    const [first] = pickSessionRoutines({ routines: DEFAULT_ROUTINES, sections: BREAK_BUILDING, keywords: ["mercedes"], count: 4, seed: 3 });
    expect(first.id).toBe("routine-mercedes");
  });

  it("never suggests a guide as a drill", () => {
    const picked = pickSessionRoutines({
      routines: DEFAULT_ROUTINES,
      sections: [{ categoryId: "cat-basics", weight: 1 }],
      keywords: [],
      count: 6,
      seed: 1,
    });
    picked.forEach((routine) => expect(routine.content_type).not.toBe("guide"));
  });
});

describe("routines suggested after a coaching report", () => {
  it("can suggest a routine nobody listed for that topic", () => {
    const report = {
      summary: "",
      strengths: [],
      improvements: ["Work on your colours clearance, especially starting from the blue."],
      possible_causes: [],
      coaching_tip: "",
    } as unknown as Parameters<typeof suggestRoutines>[0];
    const ids = suggestRoutines(report, "full_session", DEFAULT_ROUTINES, 6).map((suggestion) => suggestion.routine.id);
    expect(ids).toContain("routine-colours-clearance-starting-from-blue");
  });
});
