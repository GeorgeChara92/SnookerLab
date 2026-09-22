import { cleanDraft, newRoutineId, toRoutine, validateDraft, type CustomRoutine } from "../customRoutine";
import { coloursOnSpots } from "../../scanSnooker/position";

const draft = (overrides: Partial<Parameters<typeof validateDraft>[0]> = {}) => ({
  name: "Line-up",
  description: "",
  maxScore: "",
  balls: coloursOnSpots([]),
  ...overrides,
});

describe("custom routines", () => {
  it("needs a name and at least one ball", () => {
    expect(validateDraft(draft())).toEqual({});
    expect(validateDraft(draft({ name: "   " })).name).toMatch(/name/);
    expect(validateDraft(draft({ balls: [] })).balls).toMatch(/ball/);
  });

  it("takes a whole-number target score, or none", () => {
    expect(validateDraft(draft({ maxScore: "147" }))).toEqual({});
    expect(validateDraft(draft({ maxScore: "0" })).maxScore).toBeDefined();
    expect(validateDraft(draft({ maxScore: "12.5" })).maxScore).toBeDefined();
    expect(validateDraft(draft({ maxScore: "1000" })).maxScore).toBeDefined();
  });

  it("saves trimmed text and leaves empty fields out", () => {
    expect(cleanDraft(draft({ name: "  Line-up ", description: "  ", maxScore: " 20 " }))).toMatchObject({
      name: "Line-up",
      description: null,
      maxScore: 20,
    });
  });

  it("works as an ordinary routine for recording scores", () => {
    const custom: CustomRoutine = {
      id: newRoutineId(),
      name: "Colours clearance",
      maxScore: 27,
      balls: coloursOnSpots([]),
      createdAt: "2026-09-21T18:00:00Z",
      updatedAt: "2026-09-21T18:00:00Z",
    };
    const routine = toRoutine(custom);
    expect(routine).toMatchObject({
      id: custom.id,
      category_id: "cat-custom",
      scoring_type: "points",
      max_score: 27,
      is_system_routine: false,
    });
    expect(routine.summary).toBe("6 colours");
    expect(toRoutine({ ...custom, maxScore: null }).scoring_type).toBe("count");
  });

  it("makes ids the server accepts as UUIDs", () => {
    expect(newRoutineId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
