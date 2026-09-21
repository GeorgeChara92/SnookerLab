/**
 * The player avatar: a DiceBear "Notionists" face (CC0, no credit needed), dressed in something
 * you would wear to the table, inside a ring in the colour of a snooker ball.
 *
 * Both the outfit and the ring are earned by level. The ring works up the colours in the order
 * they come off the table - cue ball, red, yellow, green, brown, blue, pink, black - so any
 * snooker player can read how far along someone is. The waistcoat, the look of a televised
 * match, is the outfit you work towards. Past the black, the ring can be any colour you like.
 *
 * The choice is stored in the user's `avatar_preset` as a short string, "nt:<seed>|<outfit>|<ring>",
 * where the ring is a ball's name or, for a colour of your own, its hex code ("#3A7BD5").
 * Anything else in that field is one of the older icon presets and is still drawn as before.
 */

export type OutfitId = "casual" | "shirtAndTie" | "blazer" | "waistcoat";
export type BallId = "cue" | "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

export const OUTFITS: Array<{ id: OutfitId; label: string; body: string; level: number }> = [
  { id: "casual", label: "Club casual", body: "variant02", level: 1 },
  { id: "shirtAndTie", label: "Shirt and tie", body: "variant20", level: 2 },
  { id: "blazer", label: "Blazer", body: "variant05", level: 4 },
  { id: "waistcoat", label: "Waistcoat", body: "variant06", level: 6 },
];

/** In the order they come off the table, with the level that earns each one. */
export const BALLS: Array<{ id: BallId; label: string; colour: string; level: number }> = [
  { id: "cue", label: "Cue ball", colour: "#F5F2E7", level: 1 },
  { id: "red", label: "Red", colour: "#C8102E", level: 2 },
  { id: "yellow", label: "Yellow", colour: "#E8B10B", level: 3 },
  { id: "green", label: "Green", colour: "#1E7A46", level: 4 },
  { id: "brown", label: "Brown", colour: "#7A4B2A", level: 5 },
  { id: "blue", label: "Blue", colour: "#1763B6", level: 6 },
  { id: "pink", label: "Pink", colour: "#E191B4", level: 7 },
  { id: "black", label: "Black", colour: "#14181A", level: 8 },
];

/** A colour of your own, as "#RRGGBB". */
export type HexColour = `#${string}`;

/** A ball's colour, or a colour of your own once the black is earned. */
export type RingId = BallId | HexColour;

/** The level after the black: the ring is yours to colour from here. */
export const CUSTOM_RING_LEVEL = 9;

export type AvatarSpec = { seed: string; outfit: OutfitId; ball: RingId };

export const isHexColour = (value: string | null | undefined): value is HexColour =>
  /^#[0-9a-f]{6}$/i.test(value ?? "");

/**
 * Reads what someone typed as a colour: with or without the #, three or six digits, any case.
 * Returns null for anything that is not a colour.
 */
export const parseHex = (input: string): HexColour | null => {
  const digits = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(digits)) {
    return `#${digits
      .split("")
      .map((digit) => digit + digit)
      .join("")
      .toUpperCase()}`;
  }
  return /^[0-9a-f]{6}$/i.test(digits) ? `#${digits.toUpperCase()}` : null;
};

/** Hue 0-360, saturation and lightness 0-100, to "#RRGGBB". */
export const hslToHex = (h: number, s: number, l: number): HexColour => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase() as HexColour;
};

/** "#RRGGBB" to hue 0-360 and saturation and lightness 0-100. */
export const hexToHsl = (hex: HexColour) => {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  // One decimal place, so a typed colour survives the trip to the sliders and back.
  const round = (value: number) => Math.round(value * 10) / 10;
  if (d === 0) return { h: 0, s: 0, l: round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: round((h * 60 + 360) % 360), s: round(s * 100), l: round(l * 100) };
};

/** Dark enough to vanish against a dark screen, so the ring needs a hairline round it. */
export const ringNeedsOutline = (hex: string) => {
  const colour = parseHex(hex);
  if (!colour) return false;
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 40;
};

const PREFIX = "nt:";

export const isGeneratedAvatar = (preset?: string | null) => Boolean(preset?.startsWith(PREFIX));

export const encodeAvatar = (spec: AvatarSpec) =>
  `${PREFIX}${spec.seed.replace(/\|/g, " ")}|${spec.outfit}|${spec.ball}`;

/** Reads a stored avatar, falling back sensibly for anything missing or unrecognised. */
export const parseAvatar = (preset: string | null | undefined, fallbackSeed: string): AvatarSpec => {
  const fallback: AvatarSpec = { seed: fallbackSeed || "player", outfit: "casual", ball: "cue" };
  if (!preset || !isGeneratedAvatar(preset)) return fallback;

  const [seed, outfit, ball] = preset.slice(PREFIX.length).split("|");
  return {
    seed: seed || fallback.seed,
    outfit: OUTFITS.some((item) => item.id === outfit) ? (outfit as OutfitId) : fallback.outfit,
    ball: BALLS.some((item) => item.id === ball)
      ? (ball as BallId)
      : isHexColour(ball)
        ? (ball.toUpperCase() as HexColour)
        : fallback.ball,
  };
};

export const outfitUnlocked = (outfit: OutfitId, level: number) =>
  level >= (OUTFITS.find((item) => item.id === outfit)?.level ?? Infinity);

export const ballUnlocked = (ball: RingId, level: number) =>
  isHexColour(ball) ? level >= CUSTOM_RING_LEVEL : level >= (BALLS.find((item) => item.id === ball)?.level ?? Infinity);

/** The highest ball a level has earned: the one a new player's ring starts on. */
export const topBallFor = (level: number): BallId =>
  [...BALLS].reverse().find((ball) => level >= ball.level)?.id ?? "cue";

export const outfitBody = (outfit: OutfitId) => OUTFITS.find((item) => item.id === outfit)?.body ?? "variant02";
export const ballColour = (ball: RingId) =>
  isHexColour(ball) ? ball : (BALLS.find((item) => item.id === ball)?.colour ?? BALLS[0].colour);

/** What the ring is called, e.g. "Yellow" or "Custom". */
export const ringLabel = (ball: RingId) =>
  isHexColour(ball) ? "Custom" : (BALLS.find((item) => item.id === ball)?.label ?? BALLS[0].label);

/**
 * A set of faces to choose from. Seeds are built from the player's name so the first page is
 * theirs, and a round number moves to a fresh set when they ask for more.
 */
export const faceSeeds = (base: string, round: number, count = 12) =>
  Array.from({ length: count }, (_, index) => `${base || "player"}-${round}-${index}`);
