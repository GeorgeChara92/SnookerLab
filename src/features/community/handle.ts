import { containsBlockedWord } from "./wordFilter";

/**
 * A player's @handle: how others find and mention them. Lower case letters, numbers, dots and
 * underscores, 3 to 20 long - the same rule the database enforces.
 */

export const HANDLE_PATTERN = /^[a-z0-9_.]{3,20}$/;

/** What a typed handle becomes: no @, lower case, spaces as underscores, nothing else allowed. */
export const cleanHandle = (typed: string) =>
  typed
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 20);

/** A starting suggestion from the player's name. */
export const suggestHandle = (name: string | null | undefined) => {
  const base = cleanHandle(name ?? "");
  return base.length >= 3 ? base : `${base}player`.slice(0, 20);
};

/** Why a handle cannot be used, or null if it can. */
export const handleProblem = (handle: string): string | null => {
  if (handle.length < 3) return "At least 3 characters.";
  if (!HANDLE_PATTERN.test(handle)) return "Letters, numbers, dots and underscores only.";
  if (/^[._]|[._]$/.test(handle)) return "Start and end with a letter or number.";
  if (containsBlockedWord(handle.replace(/[._]/g, " "))) return "That handle is not allowed.";
  return null;
};
