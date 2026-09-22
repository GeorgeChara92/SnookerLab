import type { Match } from "../../types";

/** How many frames the match is the best of, where it says. */
export const bestOfFor = (match: Pick<Match, "format" | "target_frames">) => {
  if (match.target_frames) return match.target_frames;
  const parsed = parseInt(String(match.format).replace("best_of_", ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
