import { AppState, type AppStateStatus } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import {
  MATCH_COLUMNS,
  fromEventRow,
  fromMatchRow,
  fromPhotoRow,
  fromPlayerRow,
  fromRankingRow,
  fromRoundRow,
  buildDrawLinks,
  matchStatus,
  roundKey,
  tournamentKey,
  type DrawLinks,
  type PlayerPhoto,
  type ProTourEvent,
  type ProTourMatch,
  type ProTourPlayerProfile,
  type ProTourRankingRow,
  type ProTourRounds,
} from "../features/tour/liveScores";

const FRESH_MS = 20_000;
/** How long events, players, rounds, rankings and photos are trusted before they're re-read. The
 *  live feed (matches) is re-read far more often - on every change poll-pro-tour writes. */
const FULL_MS = 15 * 60_000;
/** Supabase returns at most 1000 rows a request. */
const PAGE = 1000;
/** Tournaments whose final has been looked up this session, found or not, so it's asked once. */
const finalsAsked = new Set<number>();
const DAY = 86_400_000;
/** Draws kept on the phone between launches: the most recent few, from the last three days. */
const KEEP_DRAWS = 4;
const KEEP_DRAWS_MS = 3 * DAY;

export type TournamentDetail = {
  matches: ProTourMatch[];
  /** How the draw is wired (snooker.org's candidates), when poll-pro-tour has fetched it. */
  links: DrawLinks | null;
  loadedAt: number;
};

export type MatchDetail = {
  match: ProTourMatch | null;
  /** snooker.org's head-to-head rows for the pair, or null until poll-pro-tour has fetched them. */
  h2h: Array<Record<string, unknown>> | null;
  loadedAt: number;
};

type ProTourState = {
  /** Live matches plus everything from three days ago to three weeks ahead - the fixtures/results feed. */
  matches: ProTourMatch[];
  events: Record<number, ProTourEvent>;
  playerProfiles: Record<number, ProTourPlayerProfile>;
  players: Record<number, string>;
  rankingsBySeason: Record<number, ProTourRankingRow[]>;
  rankingsUpdatedAt: Record<number, string>;
  rounds: ProTourRounds;
  /** Wikimedia Commons photos by player id, preferred over snooker.org's own (often older) ones. */
  photos: Record<number, PlayerPhoto>;
  /** The final of each finished tournament this season, by tournament id - for its winner. */
  finals: Record<number, ProTourMatch>;
  tournaments: Record<number, TournamentDetail>;
  playerMatches: Record<number, ProTourMatch[]>;
  matchDetails: Record<number, MatchDetail>;
  loading: boolean;
  failed: boolean;
  /** When the live feed was last read. */
  fetchedAt: number;
  /** When everything else was last read (kept across launches with the cache). */
  fullFetchedAt: number;
  refresh: (force?: boolean) => Promise<void>;
  loadTournament: (tournamentId: number) => Promise<void>;
  loadPlayer: (playerId: number) => Promise<void>;
  loadFinals: (tournamentIds: number[]) => Promise<void>;
  loadMatch: (matchId: number) => Promise<void>;
};

const mergeMatches = (into: Record<number, ProTourMatch>, list: ProTourMatch[]) => {
  for (const m of list) into[m.id] = m;
};

/** Every row of a query, a page at a time - for tables that outgrow Supabase's 1000-row cap. */
const allRows = async <T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
};

/** The raw snooker.org fields each mapper reads. The full record is several times larger, so the
 *  refresh asks for just these and rebuilds a slim `raw` for the mapper - same result, a fraction of
 *  the download, and far less for the database to send. */
const RAW_FIELDS = {
  rounds: ["RoundName", "NumLeft", "NumMatches", "Distance", "Money", "Currency"],
  events: ["Main", "Type", "Venue", "City", "Country", "Sponsor", "NumCompetitors", "DefendingChampion", "WikipediaURL", "Url"],
  players: ["Nationality", "Born", "Photo", "HighestRanking", "FirstSeasonAsPro", "NumRankingTitles", "NumMaximums", "WikipediaURL", "BioPage"],
};
const rawColumns = (fields: string[]) => fields.map((field) => `raw_${field}:raw->${field}`).join(", ");
// Typed as plain strings, as MATCH_COLUMNS is, so the client doesn't try to parse them.
const EVENT_COLUMNS: string = `id, name, season, start_date, end_date, ${rawColumns(RAW_FIELDS.events)}`;
const PLAYER_COLUMNS: string = `id, display_name, ${rawColumns(RAW_FIELDS.players)}`;
const ROUND_COLUMNS: string = `event_id, round, name, ${rawColumns(RAW_FIELDS.rounds)}`;
const withSlimRaw = (row: Record<string, unknown>, fields: string[]) => ({
  ...row,
  raw: Object.fromEntries(fields.map((field) => [field, row[`raw_${field}`]])),
});

/** Rows to matches, one per slot of the draw: if snooker.org has redrawn a round (new ids for the
 *  same event, round and match number) and the old rows haven't been cleared yet, the newest wins
 *  rather than every fixture showing twice. */
const readMatches = (rows: unknown[] | null) => {
  const bySlot = new Map<string, ProTourMatch>();
  for (const row of rows ?? []) {
    const match = fromMatchRow(row as Record<string, unknown>);
    const key = `${match.eventId}:${match.round}:${match.number}`;
    const existing = bySlot.get(key);
    if (!existing || match.id > existing.id) bySlot.set(key, match);
  }
  return [...bySlot.values()];
};

/** How long a read may take before it's given up on. A request in flight when iOS suspends the app
 *  can hang for minutes before the system kills it - and with one refresh at a time, every refresh
 *  after it waited too, so reopening the app showed this morning's scores for minutes. */
const FEED_TIMEOUT_MS = 10_000;
const FULL_TIMEOUT_MS = 20_000;
const DETAIL_TIMEOUT_MS = 15_000;

/** An abort signal that fires after `ms`. */
const timeoutSignal = (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, signal: controller.signal, clear: () => clearTimeout(timer) };
};

/** The live feed: anything unfinished, and everything from three days ago to three weeks ahead. */
const feedQuery = (signal: AbortSignal) => {
  const from = new Date(Date.now() - 3 * DAY).toISOString();
  const to = new Date(Date.now() + 21 * DAY).toISOString();
  return supabase
    .from("pro_tour_matches")
    .select(MATCH_COLUMNS)
    .or(`unfinished.eq.true,and(scheduled_at.gte.${from},scheduled_at.lte.${to})`)
    .order("scheduled_at", { ascending: true })
    .limit(PAGE)
    .abortSignal(signal);
};

/** The cache is saved on every change - each live update included - so writes are gathered up and the
 *  latest one saved at most every few seconds, rather than rewriting it all several times a minute. */
const SAVE_EVERY_MS = 5_000;
const unsaved = new Map<string, string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const batchedStorage = {
  getItem: (name: string) => safeStorage.getItem(name),
  removeItem: (name: string) => safeStorage.removeItem(name),
  setItem: async (name: string, value: string) => {
    unsaved.set(name, value);
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      for (const [key, latest] of unsaved) void safeStorage.setItem(key, latest);
      unsaved.clear();
    }, SAVE_EVERY_MS);
  },
};

/** One refresh at a time, shared by every screen that asks. */
let inFlight: Promise<void> | null = null;
let followUp: Promise<void> | null = null;
let inFlightAbort: AbortController | null = null;
/** Bumped to abandon the read under way, so its late answer (or failure) changes nothing. */
let readGeneration = 0;

/** Drops whatever read is under way - on coming back to the app, where it was started before the
 *  phone suspended it and may never answer - so the next refresh starts at once. */
export const abandonProTourRead = () => {
  readGeneration++;
  inFlightAbort?.abort();
  inFlightAbort = null;
  inFlight = null;
  followUp = null;
};

/** The pro tour, as cached by poll-pro-tour - and kept on the phone, so the screens open on the last
 *  known state at once and refresh underneath. */
export const useProTourStore = create<ProTourState>()(
  persist(
    (set, get) => ({
      matches: [],
      events: {},
      playerProfiles: {},
      players: {},
      rankingsBySeason: {},
      rankingsUpdatedAt: {},
      rounds: {},
      photos: {},
      finals: {},
      tournaments: {},
      playerMatches: {},
      matchDetails: {},
      loading: false,
      failed: false,
      fetchedAt: 0,
      fullFetchedAt: 0,

      refresh: async (force = false) => {
        if (inFlight) {
          // A change landed while a read was already going: read once more after it, or the read
          // under way (begun before the change) would be the last word.
          if (!force) return inFlight;
          followUp ??= inFlight.then(() => {
            followUp = null;
            return get().refresh(true);
          });
          return followUp;
        }
        const { fetchedAt, fullFetchedAt } = get();
        if (!force && Date.now() - fetchedAt < FRESH_MS) return;
        const full = Date.now() - fullFetchedAt > FULL_MS;
        const generation = ++readGeneration;
        const limit = timeoutSignal(full ? FULL_TIMEOUT_MS : FEED_TIMEOUT_MS);
        const signal = limit.signal;
        inFlightAbort = limit.controller;
        inFlight = (async () => {
          set({ loading: true });
          try {
            if (!full) {
              // Just the live feed: scores, sessions, results. Everything else changes rarely.
              const { data, error } = await feedQuery(signal);
              if (error) throw error;
              set({
                matches: readMatches(data),
                loading: false,
                failed: false,
                fetchedAt: Date.now(),
              });
              return;
            }
            const minSeason = new Date().getFullYear() - 2;
            // The scores show the moment they arrive, not after the events, rounds and photos too.
            const feed = Promise.resolve(feedQuery(signal)).then((result) => {
              if (!result.error) set({ matches: readMatches(result.data), fetchedAt: Date.now() });
              return result;
            });
            const [matchResult, eventResult, playerResult, rankingResult, roundRows, photoResult] = await Promise.all([
              feed,
              supabase
                .from("pro_tour_events")
                .select(EVENT_COLUMNS)
                .gte("season", minSeason)
                .limit(PAGE)
                .abortSignal(signal),
              supabase.from("pro_tour_players").select(PLAYER_COLUMNS).limit(PAGE).abortSignal(signal),
              supabase.from("pro_tour_rankings").select("season, rows, updated_at").eq("ranking_type", "MoneyRankings").abortSignal(signal),
              allRows<unknown>((from, to) =>
                supabase
                  .from("pro_tour_rounds")
                  .select(ROUND_COLUMNS)
                  .order("event_id")
                  .order("round")
                  .range(from, to)
                  .abortSignal(signal)
              ),
              supabase
                .from("pro_tour_player_photos")
                .select("player_id, url, credit, license, source_url")
                .not("url", "is", null)
                .limit(PAGE)
                .abortSignal(signal),
            ]);
            if (matchResult.error) throw matchResult.error;

            const events: Record<number, ProTourEvent> = { ...get().events };
            for (const row of (eventResult.data ?? []) as unknown as Record<string, unknown>[]) {
              const event = fromEventRow(withSlimRaw(row, RAW_FIELDS.events));
              events[event.id] = event;
            }

            const playerProfiles: Record<number, ProTourPlayerProfile> = {};
            const players: Record<number, string> = {};
            for (const row of (playerResult.data ?? []) as unknown as Record<string, unknown>[]) {
              const profile = fromPlayerRow(withSlimRaw(row, RAW_FIELDS.players));
              if (profile.name === "TBD") continue;
              playerProfiles[profile.id] = profile;
              players[profile.id] = profile.name;
            }

            const rankingsBySeason: Record<number, ProTourRankingRow[]> = {};
            const rankingsUpdatedAt: Record<number, string> = {};
            for (const row of rankingResult.data ?? []) {
              rankingsBySeason[row.season] = ((row.rows as Record<string, unknown>[]) ?? [])
                .map(fromRankingRow)
                .sort((a, b) => a.position - b.position);
              rankingsUpdatedAt[row.season] = row.updated_at as string;
            }

            const rounds: ProTourRounds = {};
            for (const row of roundRows) {
              const info = fromRoundRow(withSlimRaw(row as Record<string, unknown>, RAW_FIELDS.rounds));
              rounds[roundKey(info.eventId, info.round)] = info;
            }

            const photos: Record<number, PlayerPhoto> = {};
            for (const row of photoResult.data ?? []) {
              const photo = fromPhotoRow(row);
              if (photo) photos[Number(row.player_id)] = photo;
            }

            set({
              matches: readMatches(matchResult.data),
              events,
              playerProfiles,
              players,
              rankingsBySeason,
              rankingsUpdatedAt,
              rounds,
              photos,
              loading: false,
              failed: false,
              fetchedAt: Date.now(),
              fullFetchedAt: Date.now(),
            });
          } catch (error) {
            // An abandoned read (see abandonProTourRead) says nothing about the one that replaced it.
            if (generation !== readGeneration) return;
            console.warn("pro tour refresh failed", error);
            set({ loading: false, failed: true });
          }
        })().finally(() => {
          limit.clear();
          if (generation !== readGeneration) return;
          inFlight = null;
          inFlightAbort = null;
        });
        return inFlight;
      },

      /** Every fixture and result of one tournament, all its stages. */
      loadTournament: async (tournamentId) => {
        const { events } = get();
        const eventIds = Object.values(events)
          .filter((event) => tournamentKey(event, event.id) === tournamentId)
          .map((event) => event.id);
        if (!eventIds.includes(tournamentId)) eventIds.push(tournamentId);
        let rows: unknown[];
        let linkResult;
        try {
          [rows, linkResult] = await Promise.all([
            allRows<unknown>((from, to) =>
              supabase
                .from("pro_tour_matches")
                .select(MATCH_COLUMNS)
                .in("event_id", eventIds)
                .order("scheduled_at", { ascending: true })
                .order("id")
                .range(from, to)
                .abortSignal(timeoutSignal(DETAIL_TIMEOUT_MS).signal)
            ),
            supabase
              .from("pro_tour_event_extras")
              .select("data")
              .eq("event_id", tournamentId)
              .eq("kind", "candidates")
              .abortSignal(timeoutSignal(DETAIL_TIMEOUT_MS).signal)
              .maybeSingle(),
          ]);
        } catch (error) {
          console.warn("pro tour tournament load failed", error);
          return;
        }
        const linkRows = (linkResult.data?.data as Array<Record<string, unknown>>) ?? [];

        set((state) => ({
          tournaments: {
            ...state.tournaments,
            [tournamentId]: {
              matches: readMatches(rows),
              links: linkRows.length ? buildDrawLinks(linkRows) : null,
              loadedAt: Date.now(),
            },
          },
        }));
      },

      /** The final of each of these tournaments (the round where two players are left), for its winner. */
      loadFinals: async (tournamentIds) => {
        const { rounds, finals } = get();
        const pairs: Array<[number, number]> = [];
        for (const id of tournamentIds) {
          if (finals[id] || finalsAsked.has(id)) continue;
          const finalRound = Object.values(rounds).find((r) => r.eventId === id && r.numLeft === 2 && (r.numMatches ?? 1) > 0);
          if (finalRound) pairs.push([id, finalRound.round]);
        }
        if (!pairs.length) return;
        for (const [id] of pairs) finalsAsked.add(id);
        const { data, error } = await supabase
          .from("pro_tour_matches")
          .select(MATCH_COLUMNS)
          .or(pairs.map(([event, round]) => `and(event_id.eq.${event},round.eq.${round})`).join(","))
          .limit(200);
        if (error) return;
        const found: Record<number, ProTourMatch> = {};
        for (const row of data ?? []) {
          const match = fromMatchRow(row as unknown as Record<string, unknown>);
          if (match.winnerId) found[match.eventId] = match;
        }
        if (Object.keys(found).length) set((state) => ({ finals: { ...state.finals, ...found } }));
      },

      /** One match and the two players' head-to-head, for the match screen. */
      loadMatch: async (matchId) => {
        const { data, error } = await supabase
          .from("pro_tour_matches")
          .select(MATCH_COLUMNS)
          .eq("id", matchId)
          .abortSignal(timeoutSignal(DETAIL_TIMEOUT_MS).signal)
          .maybeSingle();
        if (error) return;
        const match = data ? fromMatchRow(data as unknown as Record<string, unknown>) : null;
        let h2h: Array<Record<string, unknown>> | null = null;
        if (match?.player1Id && match.player2Id && match.player1Id !== match.player2Id) {
          const [a, b] = [match.player1Id, match.player2Id].sort((x, y) => x - y);
          const { data: row } = await supabase.from("pro_tour_h2h").select("matches").eq("player_a", a).eq("player_b", b).maybeSingle();
          h2h = (row?.matches as Array<Record<string, unknown>>) ?? null;
        }
        set((state) => ({
          matchDetails: {
            ...state.matchDetails,
            [matchId]: { match, h2h, loadedAt: Date.now() },
          },
        }));
      },

      /** A player's recent and upcoming matches, beyond the three-week window the feed holds. */
      loadPlayer: async (playerId) => {
        const { data, error } = await supabase
          .from("pro_tour_matches")
          .select(MATCH_COLUMNS)
          .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
          .order("scheduled_at", { ascending: false })
          .limit(80)
          .abortSignal(timeoutSignal(DETAIL_TIMEOUT_MS).signal);
        if (error) return;
        const byId: Record<number, ProTourMatch> = {};
        mergeMatches(
          byId,
          readMatches(data)
        );
        set((state) => ({
          playerMatches: {
            ...state.playerMatches,
            [playerId]: Object.values(byId),
          },
        }));
      },
    }),
    {
      name: "pro-tour-cache",
      version: 1,
      storage: createJSONStorage(() => batchedStorage),
      partialize: (state) => ({
        matches: state.matches,
        events: state.events,
        playerProfiles: state.playerProfiles,
        players: state.players,
        rankingsBySeason: state.rankingsBySeason,
        rankingsUpdatedAt: state.rankingsUpdatedAt,
        rounds: state.rounds,
        photos: state.photos,
        finals: state.finals,
        fullFetchedAt: state.fullFetchedAt,
        fetchedAt: state.fetchedAt,
        // The draws opened lately, so a tournament opens on its draw straight after a relaunch rather
        // than a spinner - only recent ones, to keep what's saved small.
        tournaments: Object.fromEntries(
          Object.entries(state.tournaments)
            .filter(([, detail]) => Date.now() - detail.loadedAt < KEEP_DRAWS_MS)
            .sort(([, a], [, b]) => b.loadedAt - a.loadedAt)
            .slice(0, KEEP_DRAWS)
        ),
      }),
      // JSON turns each match's later sessions into strings; turn them back into dates.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProTourState>;
        const revive = (m: ProTourMatch): ProTourMatch => ({
          ...m,
          laterSessions: (m.laterSessions ?? []).map((d) => new Date(d)),
        });
        const finals: Record<number, ProTourMatch> = {};
        for (const [id, m] of Object.entries(saved.finals ?? {})) finals[Number(id)] = revive(m);
        const tournaments: Record<number, TournamentDetail> = {};
        for (const [id, detail] of Object.entries(saved.tournaments ?? {})) {
          tournaments[Number(id)] = { ...detail, matches: (detail.matches ?? []).map(revive) };
        }
        return {
          ...current,
          ...saved,
          matches: (saved.matches ?? current.matches).map(revive),
          finals: { ...current.finals, ...finals },
          tournaments: { ...current.tournaments, ...tournaments },
        };
      },
    }
  )
);

/** When the cache was last warmed, so coming back to the app twice in a minute doesn't read twice. */
let warmedAt = 0;
const WARM_EVERY_MS = 60_000;

/**
 * Reads the tour ahead of the screens - on launch and on coming back to the app - so opening Live &
 * results, a tournament or a match shows today's scores straight away, the way the phone's own copy
 * of the feed already does. The live feed first, then the draw of every tournament being played now.
 */
export const warmProTour = async () => {
  if (Date.now() - warmedAt < WARM_EVERY_MS) return;
  warmedAt = Date.now();
  await useProTourStore.getState().refresh();
  const { events, tournaments, loadTournament } = useProTourStore.getState();
  const now = Date.now();
  const playing = Object.values(events).filter((event) => {
    if (event.mainId && event.mainId !== event.id) return false;
    const start = event.startDate ? new Date(event.startDate).getTime() : null;
    const end = event.endDate ? new Date(event.endDate).getTime() + DAY : start;
    return start != null && end != null && start - DAY <= now && now <= end + DAY;
  });
  for (const event of playing.slice(0, 4)) {
    if (now - (tournaments[event.id]?.loadedAt ?? 0) > FRESH_MS) void loadTournament(event.id);
  }
};

type Listener = { tournamentId?: number; playerId?: number; matchId?: number };
const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
/** Closing the channel waits a moment, so moving from one tour screen to the next keeps it open. */
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let appActive = AppState.currentState === "active";
/** How often an open tour screen re-reads the feed while a match is live - a safety net for a
 *  realtime message that never arrives (a dropped socket, a flaky connection). */
const LIVE_POLL_MS = 30_000;

const loadDetail = (l: Listener) => {
  const s = useProTourStore.getState();
  if (l.tournamentId != null) void s.loadTournament(l.tournamentId);
  if (l.playerId != null) void s.loadPlayer(l.playerId);
  if (l.matchId != null) void s.loadMatch(l.matchId);
};

/** poll-pro-tour touches many rows a poll: wait for it to settle, then re-read the live feed once
 *  and whatever detail the open screens show. */
const onMatchesChanged = () => {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    void useProTourStore.getState().refresh(true);
    for (const l of listeners) loadDetail(l);
  }, 1500);
};

/**
 * poll-pro-tour broadcasts on this channel after a poll that changed any match. It used to be
 * Realtime's postgres_changes on pro_tour_matches, which made the database decode every write of its
 * busiest table - load that helped stall the free-tier database for hours (23 Oct 2026). A broadcast
 * never touches the database.
 */
const openChannel = () => {
  if (channel) return;
  channel = supabase.channel("pro-tour").on("broadcast", { event: "changed" }, onMatchesChanged).subscribe();
};

const closeChannel = () => {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = null;
  if (channel) void supabase.removeChannel(channel);
  channel = null;
};

/** Re-reads everything the open screens show, now. */
const refreshOpenScreens = () => {
  void useProTourStore.getState().refresh(true);
  for (const l of listeners) loadDetail(l);
};

/**
 * Back from the background: the phone will have closed the realtime socket while the app slept, and
 * whatever changed meanwhile was never sent. So reopen the channel and re-read straight away -
 * rather than showing this morning's scores until someone pulls to refresh.
 */
const onAppStateChange = (status: AppStateStatus) => {
  const wasActive = appActive;
  appActive = status === "active";
  if (!listeners.size || appActive === wasActive) return;
  if (appActive) {
    abandonProTourRead();
    closeChannel();
    openChannel();
    refreshOpenScreens();
  } else {
    closeChannel();
  }
};

/** While a tour screen is open and a match is on, re-read every 30s whatever realtime says. */
const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!appActive || !listeners.size) return;
    const anyLive = useProTourStore.getState().matches.some((m) => matchStatus(m) === "live");
    if (anyLive) refreshOpenScreens();
  }, LIVE_POLL_MS);
};

/**
 * Keeps the cache fresh while a screen using it is open: a refresh if it's stale, the screen's own
 * detail (a tournament's draw, a player's matches, a match) straight away alongside it, then a
 * re-read whenever poll-pro-tour writes a change - over one realtime channel shared by every screen -
 * on coming back to the app, and every 30s while a match is live. Call it from useFocusEffect, so
 * going back to a tour screen re-reads it too.
 */
export const subscribeProTourLive = (tournamentId?: number, playerId?: number, matchId?: number): (() => void) => {
  const listener: Listener = { tournamentId, playerId, matchId };
  const refreshing = useProTourStore.getState().refresh();
  // A tournament's stages come from the events list, so on a first-ever launch wait for it.
  if (tournamentId != null && !Object.keys(useProTourStore.getState().events).length) void refreshing.then(() => loadDetail(listener));
  else loadDetail(listener);

  listeners.add(listener);
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  appActive = AppState.currentState === "active";
  if (appActive) openChannel();
  appStateSubscription ??= AppState.addEventListener("change", onAppStateChange);
  startPolling();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (listeners.size) return;
      closeChannel();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      appStateSubscription?.remove();
      appStateSubscription = null;
    }, 3000);
  };
};
