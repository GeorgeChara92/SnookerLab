import { BALLS, CUSTOM_RING_LEVEL, OUTFITS } from "./avatarSpec";

/** Something a level earns, to show when the player reaches it. */
export type LevelReward = {
  kind: "ring" | "outfit" | "custom-ring";
  label: string;
  /** The ring's colour, for drawing it. */
  colour?: string;
};

/** What reaching this level unlocks: a ring colour, an outfit, or a ring of their own colour. */
export const rewardsForLevel = (level: number): LevelReward[] => [
  ...BALLS.filter((ball) => ball.level === level && level > 1).map<LevelReward>((ball) => ({
    kind: "ring",
    label: `${ball.label} ring`,
    colour: ball.colour,
  })),
  ...OUTFITS.filter((outfit) => outfit.level === level && level > 1).map<LevelReward>((outfit) => ({
    kind: "outfit",
    label: outfit.label,
  })),
  ...(level === CUSTOM_RING_LEVEL ? [{ kind: "custom-ring" as const, label: "A ring in any colour you like" }] : []),
];

/** Everything earned going from one level to another, for a jump of more than one. */
export const rewardsBetween = (from: number, to: number): LevelReward[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, index) => rewardsForLevel(from + index + 1)).flat();
