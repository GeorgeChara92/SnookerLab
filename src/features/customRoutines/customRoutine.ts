import type { Routine } from "../../types";
import { summarise, type PlacedBall } from "../scanSnooker/position";

/**
 * A routine a player builds themselves: balls placed on the table diagram, a name, a
 * description and, if they want one, a score to aim for. Stored with their account.
 */
export type CustomRoutine = {
  id: string;
  name: string;
  description?: string | null;
  maxScore?: number | null;
  balls: PlacedBall[];
  createdAt: string;
  updatedAt: string;
  /** The community copy, once the player has shared it. */
  sharedId?: string | null;
  /** The shared routine this was saved from, when it came from someone else. */
  sourceSharedId?: string | null;
};

/** Where a custom routine's scores count on a leaderboard, if anywhere. */
export const leaderboardKeyFor = (routine: Pick<CustomRoutine, "sharedId" | "sourceSharedId">) => {
  const shared = routine.sharedId ?? routine.sourceSharedId;
  return shared ? `shared:${shared}` : null;
};

/** Where custom routines sit among the routine categories. */
export const CUSTOM_CATEGORY_ID = "cat-custom";

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 500;
export const MAX_SCORE_LIMIT = 999;

export type RoutineDraft = { name: string; description: string; maxScore: string; balls: PlacedBall[] };

/** What is wrong with a draft, field by field, in words to show beside the field. */
export const validateDraft = (draft: RoutineDraft) => {
  const problems: Partial<Record<"name" | "description" | "maxScore" | "balls", string>> = {};
  const name = draft.name.trim();
  if (!name) problems.name = "Give the routine a name.";
  else if (name.length > NAME_MAX) problems.name = `Keep the name to ${NAME_MAX} characters.`;
  if (draft.description.trim().length > DESCRIPTION_MAX)
    problems.description = `Keep the description to ${DESCRIPTION_MAX} characters.`;
  const score = draft.maxScore.trim();
  if (score) {
    const value = Number(score);
    if (!Number.isInteger(value) || value < 1 || value > MAX_SCORE_LIMIT) {
      problems.maxScore = `A whole number from 1 to ${MAX_SCORE_LIMIT}, or leave it empty.`;
    }
  }
  if (!draft.balls.length) problems.balls = "Place at least one ball on the table.";
  return problems;
};

/** The draft as it is saved: trimmed, with an empty description or score left out. */
export const cleanDraft = (draft: RoutineDraft) => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  maxScore: draft.maxScore.trim() ? Number(draft.maxScore.trim()) : null,
  balls: draft.balls,
});

/**
 * A custom routine as an ordinary routine, so everything that works with routines - recording
 * a score, sessions, history - works with it too.
 */
export const toRoutine = (custom: CustomRoutine): Routine => ({
  id: custom.id,
  category_id: CUSTOM_CATEGORY_ID,
  name: custom.name,
  summary: custom.description || summarise(custom.balls),
  description: custom.description ?? undefined,
  content_type: "routine",
  difficulty: "intermediate",
  setup_instructions: `Set the balls as shown on the table: ${summarise(custom.balls).toLowerCase()}.`,
  scoring_type: custom.maxScore ? "points" : "count",
  max_score: custom.maxScore ?? undefined,
  is_system_routine: false,
  created_at: custom.createdAt,
  updated_at: custom.updatedAt,
});

/** A random v4 UUID, so a routine made offline already has the id it will keep on the server. */
export const newRoutineId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
