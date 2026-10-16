/**
 * Live scores, results, fixtures, rankings and player profiles from the professional tour, cached
 * in Postgres by the poll-pro-tour edge function (the only thing that ever calls snooker.org - its
 * rate limit is shared by every user of the app). The app just reads the cache tables.
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
  /** UTC. Midnight UTC across a whole round means "the day is set, the session time isn't" - see sessionTimesKnown. */
  scheduledAt: string | null;
  /** snooker.org's flag for a time that is an estimate (a follow-on match, say), not a fixed start. */
  estimated: boolean;
  /** Any sessions after the first (a final played over an afternoon and an evening, say). */
  laterSessions: Date[];
  liveUrl: string | null;
  detailsUrl: string | null;
  /** A stream for this match, when snooker.org has one. */
  videoUrl: string | null;
  frameScores: string | null;
  note: string | null;
  walkover: boolean;
  tableNo: number | null;
};

/** The columns the app reads from public.pro_tour_matches - a few from `raw`, never all of it. */
export const MATCH_COLUMNS =
  "id, event_id, round, number, player1_id, player2_id, score1, score2, winner_id, unfinished, on_break, scheduled_at, live_url, details_url, table_no, note, " +
  "estimated:raw->>Estimated, sessions:raw->>Sessions, video_url:raw->>VideoURL, frame_scores:raw->>FrameScores, walkover1:raw->>Walkover1, walkover2:raw->>Walkover2";

export type ProTourEvent = {
  id: number;
  name: string | null;
  season: number | null;
  startDate: string | null;
  endDate: string | null;
  /** The parent tournament's id when this event is one stage of a larger one (a qualifying event, a
   *  group); 0 or equal to `id` otherwise. */
  mainId: number;
  type: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  sponsor: string | null;
  numCompetitors: number | null;
  defendingChampionId: number | null;
  wikipediaUrl: string | null;
  url: string | null;
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

/** A player's photo from Wikimedia Commons, with the credit its licence asks for. */
export type PlayerPhoto = { url: string; credit: string | null; license: string | null; sourceUrl: string | null };

export const fromPhotoRow = (row: Record<string, unknown>): PlayerPhoto | null =>
  row.url ? { url: String(row.url), credit: (row.credit as string) || null, license: (row.license as string) || null, sourceUrl: (row.source_url as string) || null } : null;

export type ProTourRankingRow = {
  playerId: number;
  position: number;
  sum: number | null;
  changePosition: number | null;
};

/** One round of one event, from snooker.org's round info: what the round is, how many players are
 *  in it, the frames needed to win and the prize money for going out in it. */
export type ProTourRound = {
  eventId: number;
  round: number;
  name: string | null;
  numLeft: number | null;
  numMatches: number | null;
  bestOf: number | null;
  money: number | null;
  currency: string | null;
};
export type ProTourRounds = Record<string, ProTourRound>;
export type ProTourMatchStatus = "live" | "upcoming" | "finished";

export const roundKey = (eventId: number, round: number) => `${eventId}:${round}`;

const num = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const truthy = (value: unknown) => value === true || value === "true";

// ------------------------------------------------------------------ row mappers

/** A row selected with MATCH_COLUMNS (or select("*") - the raw-backed fields are then just absent). */
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
  scheduledAt: (row.scheduled_at as string) || null,
  estimated: truthy(row.estimated),
  laterSessions: parseSessions((row.sessions as string) ?? null),
  liveUrl: (row.live_url as string) || null,
  detailsUrl: (row.details_url as string) || null,
  videoUrl: (row.video_url as string) || null,
  frameScores: (row.frame_scores as string) || null,
  note: (row.note as string) || null,
  walkover: truthy(row.walkover1) || truthy(row.walkover2),
  tableNo: num(row.table_no),
});

/** A row from public.pro_tour_events, selected with its `raw` column. */
export const fromEventRow = (row: Record<string, unknown>): ProTourEvent => {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  return {
    id: Number(row.id),
    name: (row.name as string) ?? null,
    season: num(row.season),
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    mainId: Number(raw.Main ?? 0),
    type: (raw.Type as string) || null,
    venue: (raw.Venue as string) || null,
    city: (raw.City as string) || null,
    country: (raw.Country as string) || null,
    sponsor: (raw.Sponsor as string) || null,
    numCompetitors: num(raw.NumCompetitors) || null,
    defendingChampionId: num(raw.DefendingChampion) || null,
    wikipediaUrl: (raw.WikipediaURL as string) || null,
    url: (raw.Url as string) || null,
  };
};

export const fromPlayerRow = (row: Record<string, unknown>): ProTourPlayerProfile => {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  return {
    id: Number(row.id),
    // snooker.org's placeholder entries are shouted and padded ("WILDCARD  "): tidy those for display.
    name: (() => {
      const raw = ((row.display_name as string) ?? `Player ${row.id}`).trim();
      return /^[A-Z\s]+$/.test(raw) && raw.length > 3 ? raw.charAt(0) + raw.slice(1).toLowerCase() : raw;
    })(),
    nationality: (raw.Nationality as string) || null,
    born: (raw.Born as string) || null,
    photo: (raw.Photo as string) || null,
    highestRanking: num(raw.HighestRanking) || null,
    firstSeasonAsPro: num(raw.FirstSeasonAsPro) || null,
    numRankingTitles: num(raw.NumRankingTitles),
    numMaximums: num(raw.NumMaximums),
    wikipediaUrl: (raw.WikipediaURL as string) || null,
    bioPage: (raw.BioPage as string) || null,
  };
};

export const fromRankingRow = (raw: Record<string, unknown>): ProTourRankingRow => ({
  playerId: Number(raw.PlayerID),
  position: Number(raw.Position),
  sum: num(raw.Sum),
  changePosition: num(raw.ChangePosition),
});

/** A row from public.pro_tour_rounds, selected with its `raw` column. */
export const fromRoundRow = (row: Record<string, unknown>): ProTourRound => {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  const distance = num(raw.Distance);
  return {
    eventId: Number(row.event_id),
    round: Number(row.round),
    name: (row.name as string) || (raw.RoundName as string) || null,
    numLeft: num(raw.NumLeft) || null,
    numMatches: num(raw.NumMatches),
    bestOf: distance && distance > 0 ? distance * 2 - 1 : null,
    money: num(raw.Money) || null,
    currency: (raw.Currency as string) || null,
  };
};

// ------------------------------------------------------------------ rounds

const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

/**
 * What a round is called, the way the sport says it: Last 64, Last 32, Quarter-finals,
 * Semi-finals, Final. From snooker.org's round info when it's cached (its "Round 1" in a 64-player
 * venue draw is the Last 64); until then from how many matches the round has, when that is a
 * clean knockout count; "Round N" only when neither says anything.
 */
export const roundTitle = (info: ProTourRound | undefined, round: number, matchesInRound?: number): string => {
  const name = info?.name?.trim() ?? "";
  if (/wild\s*card/i.test(name)) return "Wildcard round";
  if (/qual/i.test(name)) return name.replace(/^qual(ifying)?\s*round/i, "Qualifying round");
  if (/robin|group/i.test(name)) return name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const left = info?.numLeft ?? (matchesInRound && isPowerOfTwo(matchesInRound) ? matchesInRound * 2 : null);
  if (left === 2 || /^final$/i.test(name)) return "Final";
  if (left === 4 || /semi/i.test(name)) return "Semi-finals";
  if (left === 8 || /quarter/i.test(name)) return "Quarter-finals";
  if (left && left > 8) return `Last ${left}`;
  return name || `Round ${round}`;
};

/** The pill-sized version of roundTitle. */
export const roundShortTitle = (title: string): string =>
  title === "Quarter-finals" ? "Quarters" : title === "Semi-finals" ? "Semis" : title === "Wildcard round" ? "Wildcards" : title.replace("Qualifying round ", "Qual R");

export const roundInfo = (rounds: ProTourRounds, eventId: number, round: number): ProTourRound | undefined =>
  rounds[roundKey(eventId, round)];

export type PrizeLine = { label: string; amount: number; currency: string };

/** Prize money for a tournament from its rounds (snooker.org gives the money for going out in each
 *  round; the winner is the round with one player left). Biggest first, with the total fund. */
export const prizeMoney = (rounds: ProTourRound[]): { lines: PrizeLine[]; total: number; currency: string } | null => {
  const paid = rounds.filter((r) => r.money && r.money > 0);
  if (!paid.length) return null;
  const currency = paid.find((r) => r.currency)?.currency ?? "GBP";
  const label = (r: ProTourRound) => {
    if (r.numLeft === 1) return "Winner";
    if (r.numLeft === 2) return "Runner-up";
    if (r.numLeft === 4) return "Semi-finalists";
    if (r.numLeft === 8) return "Quarter-finalists";
    if (/qual/i.test(r.name ?? "")) return roundTitle(r, r.round);
    return r.numLeft ? `Last ${r.numLeft}` : roundTitle(r, r.round);
  };
  const lines = paid.map((r) => ({ label: label(r), amount: r.money as number, currency })).sort((a, b) => b.amount - a.amount);
  const total = paid.reduce((sum, r) => sum + (r.money as number) * Math.max(1, r.numMatches ?? 0), 0);
  return { lines, total, currency };
};

export const formatMoney = (amount: number, currency = "GBP") => {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : "";
  return `${symbol}${Math.round(amount).toLocaleString("en-GB")}${symbol ? "" : ` ${currency}`}`;
};

// ------------------------------------------------------------------ status, names, streams

export const matchStatus = (match: ProTourMatch): ProTourMatchStatus => {
  if (match.winnerId) return "finished";
  if (match.unfinished) return "live";
  return "upcoming";
};

export const formatScore = (match: ProTourMatch): string => `${match.score1}-${match.score2}`;

/** "TBD" for a slot not decided yet AND for a player not backfilled yet - never a bare id. */
export const playerName = (players: Record<number, string>, id: number | null): string => {
  if (id == null) return "TBD";
  return players[id] ?? "TBD";
};

/** Both sides the same placeholder id: snooker.org's undecided bracket slot. */
export const isUndecided = (match: ProTourMatch) => !match.player1Id || !match.player2Id || match.player1Id === match.player2Id;

const STREAMS: Array<[RegExp, string]> = [
  [/youtu\.?be/i, "YouTube"],
  [/matchroom/i, "Matchroom.live"],
  [/discoveryplus|discovery\+/i, "discovery+"],
  [/eurosport/i, "Eurosport"],
  [/bbc\./i, "BBC iPlayer"],
  [/wst\.tv|worldsnooker/i, "WST"],
  [/facebook|fb\.watch/i, "Facebook"],
  [/twitch/i, "Twitch"],
];
/** Where a match's stream is, from its link. */
export const streamName = (url: string): string => {
  for (const [pattern, name] of STREAMS) if (pattern.test(url)) return name;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Stream";
  }
};

// ------------------------------------------------------------------ times (always the device's own time zone)
const lastSundayUtc = (year: number, month: number) => {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
};
/** Central European time's offset from UTC at an instant: summer time from the last Sunday of
 *  March to the last Sunday of October, changing at 01:00 UTC. */
const cetOffsetHours = (utcMs: number) => {
  const year = new Date(utcMs).getUTCFullYear();
  const start = lastSundayUtc(year, 2) + 3_600_000;
  const end = lastSundayUtc(year, 9) + 3_600_000;
  return utcMs >= start && utcMs < end ? 2 : 1;
};

/**
 * A match's later sessions. snooker.org keeps the first session in ScheduledDate (UTC) and any
 * others in a "Sessions" field as "dd.mm.yyyy HH:MM" in its own local time, which is Norway's
 * (Central European) - the Northern Ireland Open final reads "25.10.2026 20:00" for a 19:00 UK
 * evening session.
 */
export const parseSessions = (text: string | null): Date[] => {
  if (!text) return [];
  const out: Date[] = [];
  for (const m of text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/g)) {
    const asUtc = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
    out.push(new Date(asUtc - cetOffsetHours(asUtc - 3_600_000) * 3_600_000));
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
};

/** "13:00 & 19:00", or with the day when a session falls on another day ("Sat 10:00 & Sun 13:00"). */
export const sessionsLabel = (first: Date, later: Date[]): string => {
  const all = [first, ...later];
  const sameDay = all.every((d) => d.toDateString() === first.toDateString());
  const fmt = (d: Date) => (sameDay ? formatTime(d) : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${formatTime(d)}`);
  return all.map(fmt).join(" & ");
};


const isMidnightUtc = (iso: string) => /T00:00(:00(\.0+)?)?(Z|\+00(:00)?)$/.test(iso);

/** The (event, round) pairs whose session times are actually set. snooker.org fills in a round's
 *  day before its session times, with 00:00 UTC as the placeholder - shown as 00:00 or 01:00 local
 *  before. A genuine 00:00 UTC start (an Australian afternoon session) sits in a round with other
 *  times, so only a round where EVERY match says midnight is read as "time to be confirmed". */
export const sessionTimesKnown = (matches: ProTourMatch[]): Set<string> => {
  const known = new Set<string>();
  for (const m of matches) if (m.scheduledAt && !isMidnightUtc(m.scheduledAt)) known.add(roundKey(m.eventId, m.round));
  return known;
};

export type Kickoff = { dayKey: string; date: Date; timeKnown: boolean; estimated: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** When a match is on, in the device's local time - or just its day when the time isn't set yet
 *  (that day taken as written, not shifted across midnight by the time zone). */
export const kickoff = (match: ProTourMatch, timesKnown: Set<string>): Kickoff | null => {
  if (!match.scheduledAt) return null;
  const date = new Date(match.scheduledAt);
  if (Number.isNaN(date.getTime())) return null;
  const timeKnown = !isMidnightUtc(match.scheduledAt) || timesKnown.has(roundKey(match.eventId, match.round));
  if (timeKnown) return { dayKey: localDayKey(date), date, timeKnown, estimated: match.estimated };
  const day = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return { dayKey: localDayKey(day), date: day, timeKnown, estimated: false };
};

export const dayKeyOf = (date: Date) => localDayKey(date);

export const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** "Today", "Tomorrow", "Yesterday", else "Sat 18 Oct". */
export const dayLabel = (dayKey: string, now = new Date()): string => {
  const [y, m, d] = dayKey.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

export const longDayLabel = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
};

// ------------------------------------------------------------------ grouping

export const eventName = (events: Record<number, ProTourEvent>, id: number): string => events[id]?.name ?? `Event ${id}`;

/** The tournament an event belongs to: its own id, unless it's a stage of a larger one. */
export const tournamentKey = (event: ProTourEvent | undefined, eventId: number): number =>
  event?.mainId && event.mainId !== event.id ? event.mainId : eventId;

/** "Australian Women's Open - Group A" -> "Australian Women's Open". */
export const stripGroupSuffix = (name: string): string =>
  name
    .replace(/\s*[-–]\s*(Group|Qualifying|Qualifiers|Round|Stage)\b.*$/i, "")
    .replace(/\s+(Qualifiers|Qualifying)$/i, "")
    .trim();

export const tournamentName = (events: Record<number, ProTourEvent>, tournamentId: number, fallbackEventId?: number): string => {
  const own = events[tournamentId]?.name;
  if (own) return own;
  const stage = fallbackEventId != null ? events[fallbackEventId]?.name : null;
  return stage ? stripGroupSuffix(stage) : `Event ${tournamentId}`;
};

/** Live first, then upcoming soonest first, then results most recent first. */
export const groupMatches = (matches: ProTourMatch[]) => {
  const live: ProTourMatch[] = [];
  const upcoming: ProTourMatch[] = [];
  const finished: ProTourMatch[] = [];
  for (const match of matches) {
    const status = matchStatus(match);
    if (status === "live") live.push(match);
    else if (status === "upcoming") upcoming.push(match);
    else finished.push(match);
  }
  const by = (a: ProTourMatch, b: ProTourMatch) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || a.number - b.number;
  upcoming.sort(by);
  finished.sort((a, b) => by(b, a));
  live.sort(by);
  return { live, upcoming, finished };
};

export type DaySession = { key: string; label: string; time: Date | null; estimated: boolean; matches: ProTourMatch[] };
export type DayTournament = { tournamentId: number; name: string; rounds: number[]; sessions: DaySession[]; hasLive: boolean };
export type TourDay = { dayKey: string; tournaments: DayTournament[]; liveCount: number; matchCount: number };

/**
 * Every match on the tour by local day, then by tournament, then by session (start time), the
 * way a fixtures page reads: "Today · Northern Ireland Open · 10:00". Live matches count on today.
 */
export const groupByDay = (matches: ProTourMatch[], events: Record<number, ProTourEvent>, now = new Date()): TourDay[] => {
  const timesKnown = sessionTimesKnown(matches);
  const todayKey = localDayKey(now);
  const days = new Map<string, Map<number, { name: string; matches: ProTourMatch[] }>>();
  for (const match of matches) {
    const live = matchStatus(match) === "live";
    const k = kickoff(match, timesKnown);
    const dayKey = live ? todayKey : k?.dayKey;
    if (!dayKey) continue;
    const tid = tournamentKey(events[match.eventId], match.eventId);
    const day = days.get(dayKey) ?? new Map();
    const entry = day.get(tid) ?? { name: tournamentName(events, tid, match.eventId), matches: [] };
    entry.matches.push(match);
    day.set(tid, entry);
    days.set(dayKey, day);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, tournaments]) => {
      let liveCount = 0;
      let matchCount = 0;
      const list: DayTournament[] = [...tournaments.entries()].map(([tournamentId, { name, matches: ms }]) => {
        const sessions = new Map<string, DaySession>();
        for (const m of ms) {
          const live = matchStatus(m) === "live";
          if (live) liveCount++;
          matchCount++;
          const k = kickoff(m, timesKnown);
          const key = live ? "live" : k?.timeKnown ? k.date.toISOString() : "tbc";
          const s = sessions.get(key) ?? {
            key,
            label: live ? "Live now" : k?.timeKnown ? formatTime(k.date) : "Time to be confirmed",
            time: live ? null : k?.timeKnown ? k.date : null,
            estimated: !!k?.estimated,
            matches: [],
          };
          s.estimated = s.estimated && !!k?.estimated;
          s.matches.push(m);
          sessions.set(key, s);
        }
        const ordered = [...sessions.values()].sort((a, b) => {
          if (a.key === "live") return -1;
          if (b.key === "live") return 1;
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time.getTime() - b.time.getTime();
        });
        ordered.forEach((s) => s.matches.sort((a, b) => a.number - b.number));
        return {
          tournamentId,
          name,
          rounds: [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b),
          sessions: ordered,
          hasLive: ms.some((m) => matchStatus(m) === "live"),
        };
      });
      list.sort((a, b) => Number(b.hasLive) - Number(a.hasLive) || a.name.localeCompare(b.name));
      return { dayKey, tournaments: list, liveCount, matchCount };
    });
};

export type TournamentStatus = { label: string; tone: "live" | "soon" | "done" | "neutral" };

/** "Live · Day 1 of 8", "Starts Sat 18 Oct", "Finished" - for a tournament card. */
export const tournamentStatus = (event: ProTourEvent | undefined, hasLive: boolean, now = new Date()): TournamentStatus => {
  if (hasLive) return { label: "Live now", tone: "live" };
  if (!event?.startDate) return { label: "", tone: "neutral" };
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : start;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (today < startDay) {
    const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
    return { label: days === 1 ? "Starts tomorrow" : days < 7 ? `Starts in ${days} days` : `Starts ${startDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`, tone: "soon" };
  }
  if (today > endDay) return { label: "Finished", tone: "done" };
  const dayN = Math.round((today.getTime() - startDay.getTime()) / 86_400_000) + 1;
  const total = Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1;
  return { label: `Day ${dayN} of ${total}`, tone: "live" };
};

/** "18 – 25 October 2026" / "29 Oct – 2 Nov 2026" from an event's dates (whole days, as written). */
export const formatDateRange = (start: string | null, end: string | null): string | null => {
  if (!start) return null;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const sd = new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const e0 = end ? new Date(end) : null;
  const ed = e0 && !Number.isNaN(e0.getTime()) ? new Date(e0.getUTCFullYear(), e0.getUTCMonth(), e0.getUTCDate()) : null;
  const full = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  if (!ed || ed.getTime() === sd.getTime()) return full(sd);
  if (sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear()) return `${sd.getDate()} – ${full(ed)}`;
  return `${sd.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${ed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
};

// ------------------------------------------------------------------ frame scores

export type Frame = { p1: number; p2: number; breaks: string | null };
export type FrameSession = { label: string | null; frames: Frame[] };

/** snooker.org's FrameScores - "Session 1:<br/>0-136 (136), 83-47 (54), ..." - as sessions of frames. */
export const parseFrameScores = (text: string | null): FrameSession[] => {
  if (!text) return [];
  const clean = text.replace(/<br\s*\/?>/gi, "\n");
  const parts = clean.split(/Session\s*(\d+)\s*:/i);
  const sessions: FrameSession[] = [];
  const frames = (chunk: string): Frame[] =>
    [...chunk.matchAll(/(\d+)\s*-\s*(\d+)(?:\s*\(([^)]*)\))?/g)].map((m) => ({ p1: Number(m[1]), p2: Number(m[2]), breaks: m[3]?.trim() || null }));
  if (parts.length === 1) {
    const list = frames(parts[0]);
    return list.length ? [{ label: null, frames: list }] : [];
  }
  for (let i = 1; i < parts.length; i += 2) {
    const list = frames(parts[i + 1] ?? "");
    if (list.length) sessions.push({ label: `Session ${parts[i]}`, frames: list });
  }
  return sessions;
};

// ------------------------------------------------------------------ bracket (snooker.org's candidates, t=18)

export type DrawLink = { fromEvent: number; fromRound: number; fromNumber: number; toEvent: number; toRound: number; toNumber: number; toIndex: number };
export type DrawLinks = Map<string, { event: number; round: number; number: number }>;

export const slotKey = (event: number, round: number, number: number, side: number) => `${event}:${round}:${number}:${side}`;
export const matchKey = (event: number, round: number, number: number) => `${event}:${round}:${number}`;

/** Which earlier match feeds each slot of the draw: "the winner of match 3 of the last 32 is player 1 of match 2 of the last 16". */
export const buildDrawLinks = (rows: Array<Record<string, unknown>>): DrawLinks => {
  const links: DrawLinks = new Map();
  for (const row of rows) {
    const to = slotKey(Number(row.ToEvent), Number(row.ToRound), Number(row.ToNumber), Number(row.ToIndex));
    if (!links.has(to)) links.set(to, { event: Number(row.FromEvent), round: Number(row.FromRound), number: Number(row.FromNumber) });
  }
  return links;
};

/** Is this side of the match not decided yet (no player, or snooker.org's shared placeholder)? */
export const sideUndecided = (match: ProTourMatch, side: 1 | 2, players: Record<number, string>): boolean => {
  const id = side === 1 ? match.player1Id : match.player2Id;
  const other = side === 1 ? match.player2Id : match.player1Id;
  return !id || id === other || !players[id];
};

/**
 * What to call an undecided slot: "Winner of Xiao v Craigie" when the match feeding it is known and
 * its players are, "Winner of the last-32 match" style otherwise - never a bare "TBD" when the draw
 * says more.
 */
export const slotLabel = (
  match: ProTourMatch,
  side: 1 | 2,
  links: DrawLinks | undefined,
  byKey: Map<string, ProTourMatch>,
  players: Record<number, string>
): string | null => {
  if (!links) return null;
  const from = links.get(slotKey(match.eventId, match.round, match.number, side));
  if (!from) return null;
  const feeder = byKey.get(matchKey(from.event, from.round, from.number));
  if (feeder && !sideUndecided(feeder, 1, players) && !sideUndecided(feeder, 2, players)) {
    const short = (id: number | null) => {
      const name = playerName(players, id);
      const parts = name.split(" ");
      return parts.length > 1 ? parts[parts.length - 1] : name;
    };
    return `Winner of ${short(feeder.player1Id)} v ${short(feeder.player2Id)}`;
  }
  return null;
};

/** The order a round's matches sit in the draw, worked back from the final through the links -
 *  match numbers alone aren't in draw order. Rounds the links don't reach keep number order. */
export const drawOrder = (rounds: Array<{ eventId: number; round: number; numbers: number[] }>, links: DrawLinks): Map<string, number[]> => {
  const order = new Map<string, number[]>();
  if (!rounds.length) return order;
  const last = rounds[rounds.length - 1];
  let current: Array<{ event: number; number: number }> = [...last.numbers].sort((a, b) => a - b).map((n) => ({ event: last.eventId, number: n }));
  order.set(`${last.eventId}:${last.round}`, current.map((c) => c.number));
  for (let i = rounds.length - 2; i >= 0; i--) {
    const r = rounds[i];
    const next = rounds[i + 1];
    const fed: number[] = [];
    for (const c of current) {
      for (const side of [1, 2]) {
        const from = links.get(slotKey(c.event, next.round, c.number, side));
        if (from && from.round === r.round && from.event === r.eventId) fed.push(from.number);
      }
    }
    const rest = r.numbers.filter((n) => !fed.includes(n)).sort((a, b) => a - b);
    const numbers = fed.length ? [...fed, ...rest] : [...r.numbers].sort((a, b) => a - b);
    order.set(`${r.eventId}:${r.round}`, numbers);
    current = numbers.map((n) => ({ event: r.eventId, number: n }));
  }
  return order;
};

// ------------------------------------------------------------------ records

export type SeasonRecord = {
  won: number;
  lost: number;
  framesWon: number;
  framesLost: number;
  /** Most recent first. */
  form: Array<"W" | "L">;
};

/** A player's finished matches (walkovers aside) in the given events: won-lost, frames and recent form. */
export const seasonRecord = (matches: ProTourMatch[], playerId: number, eventIds?: Set<number>): SeasonRecord => {
  const played = matches
    .filter((m) => m.winnerId && !m.walkover && (m.player1Id === playerId || m.player2Id === playerId))
    .filter((m) => !eventIds || eventIds.has(m.eventId))
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  const rec: SeasonRecord = { won: 0, lost: 0, framesWon: 0, framesLost: 0, form: [] };
  for (const m of played) {
    const mine = m.player1Id === playerId ? m.score1 : m.score2;
    const theirs = m.player1Id === playerId ? m.score2 : m.score1;
    const won = m.winnerId === playerId;
    if (won) rec.won++;
    else rec.lost++;
    rec.framesWon += mine;
    rec.framesLost += theirs;
    if (rec.form.length < 5) rec.form.push(won ? "W" : "L");
  }
  return rec;
};

export type Meeting = { eventId: number; date: string | null; scoreA: number; scoreB: number; winnerId: number };

/** Head-to-head from snooker.org's p1/p2 rows, from player A's side: wins each and the meetings, newest first. */
export const headToHead = (rows: Array<Record<string, unknown>>, playerA: number) => {
  const meetings: Meeting[] = [];
  for (const row of rows) {
    const winner = Number(row.WinnerID);
    if (!winner) continue;
    const p1 = Number(row.Player1ID);
    const s1 = Number(row.Score1 ?? 0);
    const s2 = Number(row.Score2 ?? 0);
    const date = (row.EndDate as string) || (row.StartDate as string) || (row.ScheduledDate as string) || null;
    meetings.push({ eventId: Number(row.EventID), date, scoreA: p1 === playerA ? s1 : s2, scoreB: p1 === playerA ? s2 : s1, winnerId: winner });
  }
  meetings.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const winsA = meetings.filter((m) => m.winnerId === playerA).length;
  return { winsA, winsB: meetings.length - winsA, meetings };
};

// ------------------------------------------------------------------ the draw, round by round

export type DrawRound = {
  key: string;
  eventId: number;
  round: number;
  title: string;
  info: ProTourRound | undefined;
  /** Players left at the start of the round, when it's a knockout round. */
  numLeft: number | null;
  matches: ProTourMatch[];
  /** No fixtures yet: one stand-in per match the round will have ("To be decided", or "Winner of ..."). */
  placeholders: ProTourMatch[];
  /** A round snooker.org hasn't published anything for, filled in from the rounds either side of it. */
  inferred: boolean;
};

const isKnockout = (info: ProTourRound | undefined) => !/wild\s*card|qual|robin|group/i.test(info?.name ?? "");
const levelOf = (info: ProTourRound | undefined, matchCount: number): number | null => {
  if (!isKnockout(info)) return null;
  const left = info?.numLeft ?? (isPowerOfTwo(matchCount) ? matchCount * 2 : null);
  return left && isPowerOfTwo(left) && left >= 2 ? left : null;
};

/**
 * A tournament's whole draw in playing order, with no gaps: every round with fixtures, every round
 * snooker.org says is still to come, and - where it hasn't published a round at all (an old season,
 * round info not cached) - the knockout rounds between, worked out from players left, down to the
 * final. A round without fixtures gets stand-in matches so it reads like any other round. An empty
 * round ahead of a stage's first fixtures (a held-over round, qualifiers not fetched) is left out.
 */
/** "Australian Women's Open - Group A" / "Australian Women's - A" -> "Group A": a group stage's own name. */
export const groupStageName = (eventName: string | null | undefined): string | null => {
  const match = eventName?.match(/(?:\bgroup\s+|\s[-–]\s*)([A-Z0-9]{1,2})\s*$/i);
  return match ? `Group ${match[1].toUpperCase()}` : null;
};

const isGroupStage = (info: ProTourRound | undefined) => /robin|group/i.test(info?.name ?? "");
const isQualifying = (info: ProTourRound | undefined) => /qual/i.test(info?.name ?? "");
/** Qualifying, then group stages, then the rest (wildcards, the knockout) - each in round order. */
const stageOrder = (r: DrawRound) => (isQualifying(r.info) ? 0 : isGroupStage(r.info) ? 1 : 2);

export const drawRounds = (
  matches: ProTourMatch[],
  infos: ProTourRound[],
  mainEventId: number,
  /** A stage's own name, for group stages ("Group A"), when the events are known. */
  stageName?: (eventId: number) => string | null
): DrawRound[] => {
  const byKey = new Map<string, DrawRound>();
  const add = (eventId: number, round: number, info: ProTourRound | undefined) => {
    const key = roundKey(eventId, round);
    const existing = byKey.get(key);
    if (existing) return existing;
    const entry: DrawRound = { key, eventId, round, info, title: "", numLeft: null, matches: [], placeholders: [], inferred: false };
    byKey.set(key, entry);
    return entry;
  };
  const infoFor = new Map(infos.map((i) => [roundKey(i.eventId, i.round), i]));
  for (const m of matches) add(m.eventId, m.round, infoFor.get(roundKey(m.eventId, m.round))).matches.push(m);
  for (const info of infos) {
    if (info.numLeft === 1) continue; // the "winner" row snooker.org keeps for prize money
    if ((info.numMatches ?? 0) > 0 || (info.numLeft ?? 0) >= 2) add(info.eventId, info.round, info);
  }
  const all = [...byKey.values()].sort((a, b) => a.round - b.round || a.eventId - b.eventId);
  const firstWithMatches = new Map<number, number>();
  for (const r of all) if (r.matches.length && !firstWithMatches.has(r.eventId)) firstWithMatches.set(r.eventId, r.round);
  const anyMatches = firstWithMatches.size > 0;
  const shown = all.filter((r) => {
    const first = firstWithMatches.get(r.eventId);
    if (first != null) return r.matches.length > 0 || r.round > first;
    return !anyMatches || r.eventId === mainEventId;
  });
  for (const r of shown) r.numLeft = levelOf(r.info, r.matches.length);

  // Fill the knockout rounds missing between two known ones, and after the last one down to the final.
  const inferred: DrawRound[] = [];
  for (const eventId of new Set(shown.map((r) => r.eventId))) {
    const ko = shown.filter((r) => r.eventId === eventId && r.numLeft != null);
    if (!ko.length) continue;
    const between = (from: DrawRound, toLeft: number, toRound: number) => {
      const levels: number[] = [];
      for (let left = (from.numLeft as number) / 2; left > toLeft; left /= 2) levels.push(left);
      levels.forEach((left, i) => {
        const round = from.round + ((i + 1) * (toRound - from.round)) / (levels.length + 1);
        const info: ProTourRound = { eventId, round, name: null, numLeft: left, numMatches: left / 2, bestOf: null, money: null, currency: null };
        inferred.push({ key: `${eventId}:~${left}`, eventId, round, info, title: "", numLeft: left, matches: [], placeholders: [], inferred: true });
      });
    };
    for (let i = 0; i + 1 < ko.length; i++) if ((ko[i].numLeft as number) > (ko[i + 1].numLeft as number) * 2) between(ko[i], ko[i + 1].numLeft as number, ko[i + 1].round);
    const last = ko[ko.length - 1];
    if (eventId === mainEventId && (last.numLeft as number) > 2) between(last, 1, last.round + 1);
  }
  const list = [...shown, ...inferred].sort((a, b) => stageOrder(a) - stageOrder(b) || a.round - b.round || a.eventId - b.eventId);

  let nextId = -1;
  for (const r of list) {
    r.title = (isGroupStage(r.info) && stageName?.(r.eventId)) || roundTitle(r.info, r.round, r.matches.length || undefined);
    const count = r.matches.length ? 0 : r.info?.numMatches || (r.numLeft ? r.numLeft / 2 : 0);
    for (let n = 1; n <= count; n++) {
      r.placeholders.push({
        id: nextId--,
        eventId: r.eventId,
        round: r.round,
        number: n,
        player1Id: null,
        player2Id: null,
        score1: 0,
        score2: 0,
        winnerId: null,
        unfinished: false,
        onBreak: false,
        scheduledAt: null,
        estimated: false,
        laterSessions: [],
        liveUrl: null,
        detailsUrl: null,
        videoUrl: null,
        frameScores: null,
        note: null,
        walkover: false,
        tableNo: null,
      });
    }
  }
  // Two rounds the same size would read the same ("Last 64" twice): give those snooker.org's own names.
  const counts = new Map<string, number>();
  for (const r of list) counts.set(r.title, (counts.get(r.title) ?? 0) + 1);
  for (const r of list) if ((counts.get(r.title) ?? 0) > 1 && r.info?.name) r.title = r.info.name;
  return list;
};
