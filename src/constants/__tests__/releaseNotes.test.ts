import { isNewer, unseenNotes, type ReleaseNote } from "../releaseNotes";

const note = (version: string): ReleaseNote => ({ version, date: "", headline: version, added: [] });
const NOTES = [note("1.2.0"), note("1.1.0"), note("1.0.0")];

describe("release notes", () => {
  it("compares versions number by number", () => {
    expect(isNewer("1.10.0", "1.9.0")).toBe(true);
    expect(isNewer("1.2.0", "1.10.0")).toBe(false);
    expect(isNewer("2.0", "1.9.9")).toBe(true);
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
  });

  it("shows what came out since the player last looked, up to this version", () => {
    expect(unseenNotes("1.2.0", "1.0.0", NOTES).map((n) => n.version)).toEqual(["1.2.0", "1.1.0"]);
    expect(unseenNotes("1.1.0", "1.0.0", NOTES).map((n) => n.version)).toEqual(["1.1.0"]);
    expect(unseenNotes("1.2.0", "1.2.0", NOTES)).toEqual([]);
  });

  it("shows everything so far to someone who has never seen any", () => {
    expect(unseenNotes("1.1.0", null, NOTES).map((n) => n.version)).toEqual(["1.1.0", "1.0.0"]);
  });
});
