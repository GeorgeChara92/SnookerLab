import {
  ballColour,
  ballUnlocked,
  hexToHsl,
  hslToHex,
  parseHex,
  ringNeedsOutline,
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

  it("keeps a colour of your own, and saves it for after the black", () => {
    const stored = encodeAvatar({ seed: "Sam", outfit: "waistcoat", ball: "#3a7bd5" });
    expect(parseAvatar(stored, "x").ball).toBe("#3A7BD5");
    expect(ballColour("#3A7BD5")).toBe("#3A7BD5");
    expect(ballUnlocked("#3A7BD5", 8)).toBe(false);
    expect(ballUnlocked("#3A7BD5", 9)).toBe(true);
    expect(parseAvatar("nt:Sam|casual|#12345", "x").ball).toBe("cue");
  });

  it("reads a hex code however it is typed", () => {
    expect(parseHex("3a7bd5")).toBe("#3A7BD5");
    expect(parseHex(" #fff ")).toBe("#FFFFFF");
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("purple")).toBeNull();
  });

  it("converts between the sliders and hex without drifting", () => {
    expect(hslToHex(0, 100, 50)).toBe("#FF0000");
    expect(hslToHex(120, 100, 25)).toBe("#008000");
    expect(hexToHsl("#FF0000")).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHsl("#808080")).toMatchObject({ h: 0, s: 0 });
    for (const hex of ["#3A7BD5", "#C9A44C", "#1BA39C", "#14181A"] as const) {
      const { h, s, l } = hexToHsl(hex);
      expect(hslToHex(h, s, l)).toBe(hex);
    }
    const { h, s, l } = hexToHsl("#3A7BD5");
    expect(hslToHex(h, s, l)).toBe("#3A7BD5");
  });

  it("outlines a ring that would vanish on a dark screen", () => {
    expect(ringNeedsOutline("#14181A")).toBe(true);
    expect(ringNeedsOutline("#E8B10B")).toBe(false);
  });

  it("gives a stable, fresh set of faces each round", () => {
    expect(faceSeeds("George", 0, 3)).toEqual(["George-0-0", "George-0-1", "George-0-2"]);
    expect(faceSeeds("George", 1, 1)).toEqual(["George-1-0"]);
  });
});
