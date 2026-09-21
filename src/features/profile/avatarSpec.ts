/**
 * The player avatar: a DiceBear "Notionists" face (CC0, no credit needed), dressed in something
 * you would wear to the table, inside a ring in the colour of a snooker ball.
 *
 * Both the outfit and the ring are earned by level. The ring works up the colours in the order
 * they come off the table - cue ball, red, yellow, green, brown, blue, pink, black - so any
 * snooker player can read how far along someone is. The waistcoat, the look of a televised
 * match, is the outfit you work towards.
 *
 * The choice is stored in the user's `avatar_preset` as a short string, "nt:<seed>|<outfit>|<ball>".
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

export type AvatarSpec = { seed: string; outfit: OutfitId; ball: BallId };

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
    ball: BALLS.some((item) => item.id === ball) ? (ball as BallId) : fallback.ball,
  };
};

export const outfitUnlocked = (outfit: OutfitId, level: number) =>
  level >= (OUTFITS.find((item) => item.id === outfit)?.level ?? Infinity);

export const ballUnlocked = (ball: BallId, level: number) =>
  level >= (BALLS.find((item) => item.id === ball)?.level ?? Infinity);

/** The highest ball a level has earned: the one a new player's ring starts on. */
export const topBallFor = (level: number): BallId =>
  [...BALLS].reverse().find((ball) => level >= ball.level)?.id ?? "cue";

export const outfitBody = (outfit: OutfitId) => OUTFITS.find((item) => item.id === outfit)?.body ?? "variant02";
export const ballColour = (ball: BallId) => BALLS.find((item) => item.id === ball)?.colour ?? BALLS[0].colour;

/**
 * A set of faces to choose from. Seeds are built from the player's name so the first page is
 * theirs, and a round number moves to a fresh set when they ask for more.
 */
export const faceSeeds = (base: string, round: number, count = 12) =>
  Array.from({ length: count }, (_, index) => `${base || "player"}-${round}-${index}`);
