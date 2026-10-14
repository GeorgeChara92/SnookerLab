/**
 * Live scores, results, fixtures, rankings and player profiles from the professional tour, cached
 * in Postgres by the poll-pro-tour edge function (which is the only thing that ever calls
 * snooker.org directly - see that function's header comment for why). The app just reads the
 * cache tables below.
 */

export type ProTourMatch = {
  id: number;
  eventId: number;
  round: number;
  number: number;
  player1Id: number | null;
  player2Id: number | null;
  score1: number;
  score2: number;
  winnerId: number | null;
  unfinished: boolean;
  onBreak: boolean;
  scheduledAt: string | null;
  liveUrl: string | null;
  detailsUrl: string | null;
  tableNo: number | null;
  note: string | null;
};

export type ProTourEvent = {
  id: number;
  name: string | null;
  season: number | null;
  startDate: string | null;
  endDate: string | null;
  /** The parent tournament's event id, when this event is one group/stage of a larger one (e.g.
   *  a qualifying group); 0 or equal to `id` when this event has no separate parent. */
  mainId: number;
  venue: string | null;
  city: string | null;
  country: string | null;
  sponsor: string | null;
  numCompetitors: number | null;
  defendingChampionId: number | null;
  wikipediaUrl: string | null;
};

export type ProTourPlayerProfile = {
  id: number;
  name: string;
  nationality: string | null;
  born: string | null;
  photo: string | null;
  highestRanking: number | null;
  firstSeasonAsPro: number | null;
  numRankingTitles: number | null;
  numMaximums: number | null;
  wikipediaUrl: string | null;
  bioPage: string | null;
};

export type ProTourRankingRow = {
  playerId: number;
  position: number;
  sum: number | null;
  changePosition: number | null;
};

/** The round names map: `${eventId}:${round}` -> snooker.org's own name for that round of that
 *  event ("Quarter-Final", "Last 32"...). What a round number means isn't fixed across events, so
 *  this is looked up per event rather than guessed from the number alone. */
export type ProTourRoundNames = Record<string, string>;

export const roundKey = (eventId: number, round: number) => `${eventId}:${round}`;

/** A row from public.pro_tour_rounds. */
export const fromRoundRow = (row: Record<string, unknown>): { eventId: number; round: number; name: string | null } => ({
  eventId: Number(row.event_id),
  round: Number(row.round),
  name: (row.name as string) || null,
});

/** snooker.org's own name for this fixture's round, falling back to "Round N" until it's cached. */
export const roundLabel = (rounds: ProTourRoundNames, eventId: number, round: number): string =>
  rounds[roundKey(eventId, round)] ?? `Round ${round}`;

export type ProTourMatchStatus = "live" | "upcoming" | "finished";

/** A row from public.pro_tour_matches, shaped exactly as select("*") returns it. */
export const fromMatchRow = (row: Record<string, unknown>): ProTourMatch => ({
  id: Number(row.id),
  eventId: Number(row.event_id),
  round: Number(row.round),
  number: Number(row.number),
  player1Id: row.player1_id == null ? null : Number(row.player1_id),
  player2Id: row.player2_id == null ? null : Number(row.player2_id),
  score1: Number(row.score1 ?? 0),
  score2: Number(row.score2 ?? 0),
  winnerId: row.winner_id == null ? null : Number(row.winner_id),
  unfinished: Boolean(row.unfinished),
  onBreak: Boolean(row.on_break),
  scheduledAt: (row.scheduled_at as string) ?? null,
  liveUrl: (row.live_url as string) ?? null,
  detailsUrl: (row.details_url as string) ?? null,
  tableNo: row.table_no == null ? null : Number(row.table_no),
  note: (row.note as string) ?? null,
});

/** A row from public.pro_tour_events, selected with its `raw` column for the fields below. */
export const fromEventRow = (row: Record<string, unknown>): ProTourEvent => {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  return {
    id: Number(row.id),
    name: (row.name as string) ?? null,
    season: row.season == null ? null : Number(row.season),
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    mainId: Number(raw.Main ?? 0),
    venue: (raw.Venue as string) || null,
    city: (raw.City as string) || null,
    country: (raw.Country as string) || null,
    sponsor: (raw.Sponsor as string) || null,
    numCompetitors: raw.NumCompetitors ? Number(raw.NumCompetitors) : null,
    defendingChampionId: raw.DefendingChampion ? Number(raw.DefendingChampion) : null,
    wikipediaUrl: (raw.WikipediaURL as string) || null,
  };
};

/** A row from public.pro_tour_players, selected with its `raw` column for the bio fields below. */
export const fromPlayerRow = (row: Record<string, unknown>): ProTourPlayerProfile => {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  return {
    id: Number(row.id),
    name: (row.display_name as string) ?? `Player ${row.id}`,
    nationality: (raw.Nationality as string) || null,
    born: (raw.Born as string) || null,
    photo: (raw.Photo as string) || null,
    highestRanking: raw.HighestRanking ? Number(raw.HighestRanking) : null,
    firstSeasonAsPro: raw.FirstSeasonAsPro ? Number(raw.FirstSeasonAsPro) : null,
    numRankingTitles: raw.NumRankingTitles != null ? Number(raw.NumRankingTitles) : null,
    numMaximums: raw.NumMaximums != null ? Number(raw.NumMaximums) : null,
    wikipediaUrl: (raw.WikipediaURL as string) || null,
    bioPage: (raw.BioPage as string) || null,
  };
};

/** One row of a cached rankings list (public.pro_tour_rankings.rows, a jsonb array). */
export const fromRankingRow = (raw: Record<string, unknown>): ProTourRankingRow => ({
  playerId: Number(raw.PlayerID),
  position: Number(raw.Position),
  sum: raw.Sum != null ? Number(raw.Sum) : null,
  changePosition: raw.ChangePosition != null ? Number(raw.ChangePosition) : null,
});

/** Finished: has a winner. Live: in progress, including between frames/sessions. Else upcoming. */
export const matchStatus = (match: ProTourMatch): ProTourMatchStatus => {
  if (match.winnerId) return "finished";
  if (match.unfinished) return "live";
  return "upcoming";
};

export const formatScore = (match: ProTourMatch): string => `${match.score1}-${match.score2}`;

/** "TBD" for a bracket slot not yet decided AND for a player not backfilled yet (one tick behind
 *  the rest, usually) - never a bare id, which reads as a bug rather than as "still loading". */
export const playerName = (players: Record<number, string>, id: number | null): string => {
  if (id == null) return "TBD";
  return players[id] ?? "TBD";
};

export const eventName = (events: Record<number, ProTourEvent>, id: number): string =>
  events[id]?.name ?? `Event ${id}`;

/** The tournament an event belongs to: its own id, unless it's a group/stage of a larger one. */
export const tournamentKey = (event: ProTourEvent | undefined, eventId: number): number =>
  event?.mainId && event.mainId !== event.id ? event.mainId : eventId;

export const tournamentName = (events: Record<number, ProTourEvent>, tournamentId: number): string =>
  events[tournamentId]?.name ?? `Event ${tournamentId}`;

/** "Australian Women's Open - Group A" -> "Australian Women's Open": a group/stage's own name,
 *  for when its parent tournament has no event record of its own to carry the plain name. */
const stripGroupSuffix = (name: string): string =>
  name.replace(/\s*[-–]\s*(Group|Qualifying|Round|Stage)\b.*$/i, "").trim();

/** Live matches first (most recently updated tournaments first), then upcoming, then recent results.
 *  A bracket slot nobody has reached yet (the same placeholder id on both sides - snooker.org's way
 *  of saying "winner of an earlier round, not decided") still shows, as TBD v TBD with its real
 *  kick-off time: hiding it instead leaves a round that's entirely undecided so far looking empty
 *  and broken, when the fixture - just not the names - is real. */
export const groupMatches = (
  matches: ProTourMatch[]
): { live: ProTourMatch[]; upcoming: ProTourMatch[]; finished: ProTourMatch[] } => {
  const live: ProTourMatch[] = [];
  const upcoming: ProTourMatch[] = [];
  const finished: ProTourMatch[] = [];
  for (const match of matches) {
    const status = matchStatus(match);
    if (status === "live") live.push(match);
    else if (status === "upcoming") upcoming.push(match);
    else finished.push(match);
  }
  upcoming.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  finished.sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  return { live, upcoming, finished };
};

export type TournamentGroup = {
  tournamentId: number;
  name: string;
  venue: string | null;
  country: string | null;
  startDate: string | null;
  hasLive: boolean;
  soonest: string | null;
  live: ProTourMatch[];
  upcoming: ProTourMatch[];
  finished: ProTourMatch[];
};

/**
 * Matches grouped by tournament (merging an event's qualifying groups/stages under one parent),
 * each with its own live/upcoming/finished split. Tournaments with a live match first, then by
 * soonest upcoming match, then by most recent finished match.
 */
export const groupMatchesByTournament = (
  matches: ProTourMatch[],
  events: Record<number, ProTourEvent>
): TournamentGroup[] => {
  const byTournament = new Map<number, ProTourMatch[]>();
  for (const match of matches) {
    const id = tournamentKey(events[match.eventId], match.eventId);
    const list = byTournament.get(id);
    if (list) list.push(match);
    else byTournament.set(id, [match]);
  }

  const groups: TournamentGroup[] = [...byTournament.entries()].map(([tournamentId, groupMatchesList]) => {
    const { live, upcoming, finished } = groupMatches(groupMatchesList);
    // The tournament's own event record, if snooker.org has one; otherwise fall back to whichever
    // of its groups/stages we do have, for a name (suffix stripped), venue, country and start date.
    const event = events[tournamentId] ?? events[groupMatchesList[0]?.eventId];
    const name = events[tournamentId]?.name ?? (event?.name ? stripGroupSuffix(event.name) : `Event ${tournamentId}`);
    return {
      tournamentId,
      name,
      venue: event?.venue ?? null,
      country: event?.country ?? null,
      startDate: event?.startDate ?? null,
      hasLive: live.length > 0,
      soonest: upcoming[0]?.scheduledAt ?? null,
      live,
      upcoming,
      finished,
    };
  });

  groups.sort((a, b) => {
    if (a.hasLive !== b.hasLive) return a.hasLive ? -1 : 1;
    if (a.soonest && b.soonest) return a.soonest.localeCompare(b.soonest);
    if (a.soonest) return -1;
    if (b.soonest) return 1;
    return (b.startDate ?? "").localeCompare(a.startDate ?? "");
  });
  return groups;
};
