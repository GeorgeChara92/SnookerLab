/** Pieces of sharing and leaderboards with nothing to load, kept apart so they can be tested alone. */

/** The link that opens a shared routine in the app, for sharing and the QR code. */
export const routineLink = (id: string) => `snookerlab://routine/${id}`;

/** The id in a routine link, if it is one. */
export const routineIdFromLink = (url: string) => url.match(/routine\/([0-9a-f-]{36})/i)?.[1] ?? null;

/** Ranks with ties sharing a place: 1, 2, 2, 4. */
export const rankEntries = <T extends { value: number }>(
  rows: T[],
  higherIsBetter = true
): Array<T & { rank: number }> => {
  const sorted = [...rows].sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  return sorted.map((row, index) => {
    let rank = index + 1;
    for (let back = index - 1; back >= 0 && sorted[back].value === row.value; back -= 1) rank = back + 1;
    return { ...row, rank };
  });
};
