import type { Routine } from "../../types";

/**
 * The routines the session builder suggests, from the whole library as it is now - so a routine
 * added in the admin dashboard is in the running the moment it's in the app.
 *
 * Each section the chosen focus covers has a weight; a detail the player ticked lifts any routine
 * that mentions it; and a shuffle mixes routines of the same section, different for each `seed`
 * (the shuffle button). The shuffle used to go by the first letter of a routine's id - "r" for
 * every one - so every routine tied and the first few in the file always won, and routines added
 * later were never picked (2026-11-15).
 */

/** A steady number from 0 to 1 for a piece of text. */
export const mixOf = (text: string) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Stirred once more, so texts that differ only at the end (the shuffle number) land far apart.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
};

/** Enough to reorder routines in the same section, not enough to beat a better section or a tick. */
const MIX = 0.15;

export const pickSessionRoutines = ({
  routines,
  sections,
  keywords,
  count,
  seed,
}: {
  routines: Routine[];
  sections: Array<{ categoryId: string; weight: number }>;
  /** Words from the details the player ticked. */
  keywords: string[];
  count: number;
  seed: number;
}): Routine[] => {
  const scored = sections
    .flatMap(({ categoryId, weight }) =>
      routines
        .filter((routine) => routine.category_id === categoryId && routine.content_type !== "guide")
        .map((routine) => {
          const haystack = [routine.name, routine.summary, routine.success_criteria, ...(routine.improves ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          // A chosen detail lifts anything that mentions it, so the details step changes the answer.
          const matches = keywords.filter((keyword) => haystack.includes(keyword)).length;
          return { routine, score: weight + matches * 0.5 + mixOf(`${routine.id}:${seed}`) * MIX };
        })
    )
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const picked: Routine[] = [];
  for (const entry of scored) {
    if (seen.has(entry.routine.id)) continue;
    seen.add(entry.routine.id);
    picked.push(entry.routine);
    if (picked.length === count) break;
  }
  return picked;
};
