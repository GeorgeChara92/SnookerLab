import type { Match } from "../../types";
import { countsAsResult } from "./matchSummary";

/**
 * The people a player has played, for picking one again: most recent first, with the record
 * against them and how the last match was set up, so a rematch starts where the last one did.
 */

export type KnownOpponent = {
  name: string;
  played: number;
  wins: number;
  losses: number;
  lastPlayed: string;
  /** The most recent match against them, for its venue, format and type. */
  last: Match;
};

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export const knownOpponents = (matches: Match[]): KnownOpponent[] => {
  const byKey = new Map<string, KnownOpponent>();
  [...matches]
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .forEach((match) => {
      const k = key(match.opponent_name);
      if (!k) return;
      const counted = countsAsResult(match);
      const existing = byKey.get(k);
      if (existing) {
        if (counted) {
          existing.played += 1;
          if (match.result === "win") existing.wins += 1;
          if (match.result === "loss") existing.losses += 1;
        }
        return;
      }
      byKey.set(k, {
        name: match.opponent_name.trim(),
        played: counted ? 1 : 0,
        wins: counted && match.result === "win" ? 1 : 0,
        losses: counted && match.result === "loss" ? 1 : 0,
        lastPlayed: match.date,
        last: match,
      });
    });
  return [...byKey.values()];
};

/** The known opponent a typed name means, whatever its capitals or spacing. */
export const findOpponent = (typed: string, known: KnownOpponent[]) => {
  const k = key(typed);
  return k ? known.find((opponent) => key(opponent.name) === k) : undefined;
};

/** Known opponents matching what has been typed: names starting with it first, then containing it. */
export const searchOpponents = (typed: string, known: KnownOpponent[], limit = 5) => {
  const k = key(typed);
  if (!k) return known.slice(0, limit);
  const starts = known.filter((opponent) => key(opponent.name).startsWith(k));
  const contains = known.filter((opponent) => !key(opponent.name).startsWith(k) && key(opponent.name).includes(k));
  return [...starts, ...contains].slice(0, limit);
};
