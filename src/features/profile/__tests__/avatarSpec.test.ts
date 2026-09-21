import {
  ballUnlocked,
  encodeAvatar,
  faceSeeds,
  isGeneratedAvatar,
  outfitUnlocked,
  parseAvatar,
  topBallFor,
} from "../avatarSpec";

describe("player avatar", () => {
  it("round-trips through the stored string", () => {
    const stored = encodeAvatar({ seed: "George-0-3", outfit: "waistcoat", ball: "blue" });
    expect(stored).toBe("nt:George-0-3|waistcoat|blue");
    expect(parseAvatar(stored, "x")).toEqual({ seed: "George-0-3", outfit: "waistcoat", ball: "blue" });
  });

  it("leaves the older icon presets alone", () => {
    expect(isGeneratedAvatar("black-ball")).toBe(false);
    expect(parseAvatar("black-ball", "George")).toEqual({ seed: "George", outfit: "casual", ball: "cue" });
  });

  it("falls back for anything it does not recognise", () => {
    expect(parseAvatar("nt:Sam|tuxedo|purple", "x")).toEqual({ seed: "Sam", outfit: "casual", ball: "cue" });
    expect(parseAvatar(undefined, "")).toEqual({ seed: "player", outfit: "casual", ball: "cue" });
  });

  it("keeps a name with a separator in it from breaking the format", () => {
    expect(parseAvatar(encodeAvatar({ seed: "A|B", outfit: "blazer", ball: "red" }), "x").seed).toBe("A B");
  });

  it("earns the colours in the order they come off the table", () => {
    expect(topBallFor(1)).toBe("cue");
    expect(topBallFor(2)).toBe("red");
    expect(topBallFor(3)).toBe("yellow");
    expect(topBallFor(7)).toBe("pink");
    expect(topBallFor(10)).toBe("black");
    expect(ballUnlocked("black", 7)).toBe(false);
  });

  it("makes the waistcoat something to work towards", () => {
    expect(outfitUnlocked("casual", 1)).toBe(true);
    expect(outfitUnlocked("shirtAndTie", 2)).toBe(true);
    expect(outfitUnlocked("waistcoat", 5)).toBe(false);
    expect(outfitUnlocked("waistcoat", 6)).toBe(true);
  });

  it("gives a stable, fresh set of faces each round", () => {
    expect(faceSeeds("George", 0, 3)).toEqual(["George-0-0", "George-0-1", "George-0-2"]);
    expect(faceSeeds("George", 1, 1)).toEqual(["George-1-0"]);
  });
});
