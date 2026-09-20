/**
 * League scheduling.
 *
 * Fixtures used to be generated as a flat list of every pair, then chopped into blocks of
 * equal size for display. That is not a schedule: a player could appear twice in the same
 * "matchday" while their other ties sat further down the list, which read as missing.
 *
 * This builds a real round-robin with the circle method, so in every round each player has
 * at most one tie, and a league can be played more than once through (meetings).
 */

export type ScheduledTie = {
  /** 1-based round, continuing across meetings. */
  round: number;
  home: string;
  away: string;
};

const BYE = "__bye__";

/**
 * One full round-robin: every player meets every other once.
 * With an odd number of players a ghost entry sits out one player per round.
 */
const singleRoundRobin = (players: string[]): ScheduledTie[][] => {
  const field = [...players];
  if (field.length % 2 === 1) field.push(BYE);

  const half = field.length / 2;
  const rotating = field.slice(1);
  const rounds: ScheduledTie[][] = [];

  for (let round = 0; round < field.length - 1; round += 1) {
    const order = [field[0], ...rotating];
    const ties: ScheduledTie[] = [];

    for (let i = 0; i < half; i += 1) {
      const home = order[i];
      const away = order[order.length - 1 - i];
      if (home === BYE || away === BYE) continue;

      // Alternate which side is listed first, so one player is not always first.
      ties.push(round % 2 === 0 ? { round: round + 1, home, away } : { round: round + 1, home: away, away: home });
    }

    rounds.push(ties);
    rotating.unshift(rotating.pop() as string);
  }

  return rounds;
};

/**
 * @param meetings how many times each pair plays each other, 1 for a single round-robin.
 * Later meetings swap who is listed first, the way home and away alternate.
 */
export const buildLeagueSchedule = (players: string[], meetings = 1): ScheduledTie[] => {
  const field = players.filter((name) => name.trim().length > 0);
  if (field.length < 2) return [];

  const base = singleRoundRobin(field);
  const roundsPerMeeting = base.length;
  const schedule: ScheduledTie[] = [];

  for (let meeting = 0; meeting < Math.max(1, meetings); meeting += 1) {
    base.forEach((ties, index) => {
      const round = meeting * roundsPerMeeting + index + 1;
      ties.forEach((tie) => {
        const swap = meeting % 2 === 1;
        schedule.push({
          round,
          home: swap ? tie.away : tie.home,
          away: swap ? tie.home : tie.away,
        });
      });
    });
  }

  return schedule;
};

/** How many rounds a league of this size and this many meetings will run to. */
export const leagueRoundCount = (playerCount: number, meetings = 1) => {
  if (playerCount < 2) return 0;
  const perMeeting = playerCount % 2 === 0 ? playerCount - 1 : playerCount;
  return perMeeting * Math.max(1, meetings);
};

/** Total ties in the league, which is what the progress bar counts against. */
export const leagueTieCount = (playerCount: number, meetings = 1) => {
  if (playerCount < 2) return 0;
  return ((playerCount * (playerCount - 1)) / 2) * Math.max(1, meetings);
};
