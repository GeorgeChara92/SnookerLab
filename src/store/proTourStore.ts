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

const readMatches = (rows: unknown[] | null) => (rows ?? []).map((row) => fromMatchRow(row as Record<string, unknown>));

/** The live feed: anything unfinished, and everything from three days ago to three weeks ahead. */
const feedQuery = () => {
  const from = new Date(Date.now() - 3 * DAY).toISOString();
  const to = new Date(Date.now() + 21 * DAY).toISOString();
  return supabase
    .from("pro_tour_matches")
    .select(MATCH_COLUMNS)
    .or(`unfinished.eq.true,and(scheduled_at.gte.${from},scheduled_at.lte.${to})`)
    .order("scheduled_at", { ascending: true })
    .limit(PAGE);
};

/** One refresh at a time, shared by every screen that asks. */
let inFlight: Promise<void> | null = null;

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
        if (inFlight) return inFlight;
        const { fetchedAt, fullFetchedAt } = get();
        if (!force && Date.now() - fetchedAt < FRESH_MS) return;
        const full = Date.now() - fullFetchedAt > FULL_MS;
        inFlight = (async () => {
          set({ loading: true });
          try {
            if (!full) {
              // Just the live feed: scores, sessions, results. Everything else changes rarely.
              const { data, error } = await feedQuery();
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
            const [matchResult, eventResult, playerResult, rankingResult, roundRows, photoResult] = await Promise.all([
              feedQuery(),
              supabase.from("pro_tour_events").select("id, name, season, start_date, end_date, raw").gte("season", minSeason).limit(PAGE),
              supabase.from("pro_tour_players").select("id, display_name, raw").limit(PAGE),
              supabase.from("pro_tour_rankings").select("season, rows, updated_at").eq("ranking_type", "MoneyRankings"),
              allRows<Record<string, unknown>>((from, to) =>
                supabase.from("pro_tour_rounds").select("event_id, round, name, raw").order("event_id").order("round").range(from, to)
              ),
              supabase.from("pro_tour_player_photos").select("player_id, url, credit, license, source_url").not("url", "is", null).limit(PAGE),
            ]);
            if (matchResult.error) throw matchResult.error;

            const events: Record<number, ProTourEvent> = { ...get().events };
            for (const row of eventResult.data ?? []) events[row.id] = fromEventRow(row);

            const playerProfiles: Record<number, ProTourPlayerProfile> = {};
            const players: Record<number, string> = {};
            for (const row of playerResult.data ?? []) {
              const profile = fromPlayerRow(row);
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
              const info = fromRoundRow(row);
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
            console.warn("pro tour refresh failed", error);
            set({ loading: false, failed: true });
          }
        })().finally(() => {
          inFlight = null;
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
            ),
            supabase.from("pro_tour_event_extras").select("data").eq("event_id", tournamentId).eq("kind", "candidates").maybeSingle(),
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
        const { data, error } = await supabase.from("pro_tour_matches").select(MATCH_COLUMNS).eq("id", matchId).maybeSingle();
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
          .limit(80);
        if (error) return;
        const byId: Record<number, ProTourMatch> = {};
        mergeMatches(
          byId,
          (data ?? []).map((row) => fromMatchRow(row as unknown as Record<string, unknown>))
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
      storage: createJSONStorage(() => safeStorage),
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
        return {
          ...current,
          ...saved,
          matches: (saved.matches ?? current.matches).map(revive),
          finals: { ...current.finals, ...finals },
        };
      },
    }
  )
);

type Listener = { tournamentId?: number; playerId?: number; matchId?: number };
const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;

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
 * Keeps the cache fresh while a screen using it is mounted: a refresh if it's stale, the screen's
 * own detail (a tournament's draw, a player's matches, a match) straight away alongside it, then a
 * re-read whenever poll-pro-tour writes a change - over one realtime channel shared by every screen.
 */
export const subscribeProTourLive = (tournamentId?: number, playerId?: number, matchId?: number): (() => void) => {
  const listener: Listener = { tournamentId, playerId, matchId };
  const refreshing = useProTourStore.getState().refresh();
  // A tournament's stages come from the events list, so on a first-ever launch wait for it.
  if (tournamentId != null && !Object.keys(useProTourStore.getState().events).length) void refreshing.then(() => loadDetail(listener));
  else loadDetail(listener);

  listeners.add(listener);
  if (!channel) {
    channel = supabase
      .channel("pro-tour-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pro_tour_matches" }, onMatchesChanged)
      .subscribe();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && channel) {
      if (changeTimer) clearTimeout(changeTimer);
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
};
