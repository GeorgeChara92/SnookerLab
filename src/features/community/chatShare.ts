/**
 * Routines and match results sent in a chat. The message keeps a short line of text (for the
 * inbox preview and older app versions) and the details in its payload, which the chat shows
 * as a card. Pure, so it can be tested without the database.
 */

export type RoutineShare = {
  kind: "routine";
  name: string;
  /** A line under the name: "Target 35", "Up to 147". */
  subtitle?: string | null;
  /** A library routine, opened in Practice. */
  libraryId?: string | null;
  /** A community routine, opened in Community. */
  sharedId?: string | null;
};

export type MatchShare = {
  kind: "match";
  opponent: string;
  userScore: number;
  opponentScore: number;
  result: "win" | "loss" | "draw";
  date: string;
  bestOf?: number | null;
  highBreak?: number | null;
  /** The share card's highlights, in capitals: "CENTURY · 112". */
  highlights?: string[];
};

export type ChatShare = RoutineShare | MatchShare;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The message's text: what the inbox shows, and all an app without cards would see. */
export const shareBody = (share: ChatShare): string => {
  if (share.kind === "routine") return clip(`Routine: ${share.name}`, 200);
  const score = `${share.userScore}–${share.opponentScore}`;
  const line =
    share.result === "win"
      ? `Beat ${share.opponent} ${score}`
      : share.result === "loss"
        ? `Lost to ${share.opponent} ${score}`
        : `Drew with ${share.opponent} ${score}`;
  return clip(`Match: ${line}`, 200);
};

/** The payload saved with the message. */
export const sharePayload = (share: ChatShare): Record<string, unknown> => {
  if (share.kind === "routine") {
    return {
      name: clip(share.name, 60),
      subtitle: share.subtitle ? clip(share.subtitle, 60) : null,
      libraryId: share.libraryId ?? null,
      sharedId: share.sharedId ?? null,
    };
  }
  return {
    opponent: clip(share.opponent, 60),
    userScore: share.userScore,
    opponentScore: share.opponentScore,
    result: share.result,
    date: share.date,
    bestOf: share.bestOf ?? null,
    highBreak: share.highBreak ?? null,
    highlights: (share.highlights ?? []).slice(0, 3).map((item) => clip(item, 40)),
  };
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

/**
 * A message's card, read back from what was saved. Anything malformed - the payload comes from
 * another player's phone - gives null, and the chat shows the text instead.
 */
export const shareFromMessage = (kind: string, payload: Record<string, unknown> | null): ChatShare | null => {
  if (!payload) return null;
  if (kind === "routine") {
    const name = text(payload.name);
    const libraryId = text(payload.libraryId);
    const sharedId = text(payload.sharedId);
    if (!name || (!libraryId && !sharedId)) return null;
    if (sharedId && !/^[0-9a-f-]{36}$/i.test(sharedId)) return null;
    return { kind: "routine", name, subtitle: text(payload.subtitle), libraryId, sharedId };
  }
  if (kind === "match") {
    const opponent = text(payload.opponent);
    const userScore = count(payload.userScore);
    const opponentScore = count(payload.opponentScore);
    const result = payload.result;
    if (!opponent || userScore === null || opponentScore === null) return null;
    if (result !== "win" && result !== "loss" && result !== "draw") return null;
    return {
      kind: "match",
      opponent,
      userScore,
      opponentScore,
      result,
      date: text(payload.date) ?? "",
      bestOf: count(payload.bestOf),
      highBreak: count(payload.highBreak),
      highlights: Array.isArray(payload.highlights)
        ? payload.highlights.filter((item): item is string => typeof item === "string").slice(0, 3)
        : [],
    };
  }
  return null;
};
