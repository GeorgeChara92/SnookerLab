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

/**
 * Other handles to offer when the one wanted is taken: the same name with a snooker flavour or
 * a number, each a valid handle. The caller checks which of them are free.
 */
export const handleAlternatives = (wanted: string, name?: string | null) => {
  const base =
    cleanHandle(wanted)
      .replace(/[._]+$/, "")
      .slice(0, 14) || suggestHandle(name).slice(0, 14);
  const fromName = cleanHandle(name ?? "")
    .replace(/[._]+$/, "")
    .slice(0, 14);
  const year = String(new Date().getFullYear()).slice(2);
  const candidates = [
    `${base}147`,
    `${base}_snooker`,
    `${base}.cues`,
    `the.${base}`,
    `${base}${year}`,
    fromName && fromName !== base ? `${fromName}_${base.slice(0, 5)}` : "",
    `${base}_${Math.floor(10 + Math.random() * 89)}`,
    `${base}${Math.floor(100 + Math.random() * 899)}`,
  ];
  return [...new Set(candidates.map((item) => item.slice(0, 20)))].filter((item) => item && !handleProblem(item));
};

/** Why a handle cannot be used, or null if it can. */
export const handleProblem = (handle: string): string | null => {
  if (handle.length < 3) return "At least 3 characters.";
  if (!HANDLE_PATTERN.test(handle)) return "Letters, numbers, dots and underscores only.";
  if (/^[._]|[._]$/.test(handle)) return "Start and end with a letter or number.";
  if (containsBlockedWord(handle.replace(/[._]/g, " "))) return "That handle is not allowed.";
  return null;
};
