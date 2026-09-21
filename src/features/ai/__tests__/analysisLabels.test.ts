import { analysisDate, daysSince, humanise, statusInfo, tagLabel, typeInfo } from "../analysisLabels";

describe("AI Coach labels", () => {
  it("names every type the upload screen saves", () => {
    expect(typeInfo("technique").label).toBe("Technique");
    expect(typeInfo("full_session").label).toBe("Full session");
  });

  it("tidies a type it has never seen instead of showing it raw", () => {
    expect(typeInfo("technique_review").label).toBe("Technique review");
    expect(typeInfo("").label).toBe("Analysis");
  });

  it("writes tags in sentence case", () => {
    expect(tagLabel("cue-action")).toBe("Cue action");
    expect(tagLabel("break-building")).toBe("Break building");
    expect(tagLabel("some_new-tag")).toBe("Some new tag");
  });

  it("says what a status means to the player", () => {
    expect(statusInfo("completed")).toEqual({ label: "Ready", tone: "ready" });
    expect(statusInfo("processing").label).toBe("Analysing");
    expect(statusInfo("failed").tone).toBe("failed");
  });

  it("humanises separators and case", () => {
    expect(humanise("CUE_ACTION")).toBe("Cue action");
    expect(humanise("---")).toBe("");
  });

  it("counts calendar days and formats the date without a slashy locale string", () => {
    const now = new Date(2026, 8, 21, 9);
    expect(daysSince(new Date(2026, 3, 18, 23).toISOString(), now)).toBe(156);
    expect(analysisDate(new Date(2026, 3, 18, 12).toISOString(), now)).toBe("Sat 18 Apr");
    expect(analysisDate(new Date(2025, 3, 18, 12).toISOString(), now)).toBe("Fri 18 Apr 2025");
  });
});
