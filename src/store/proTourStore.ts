import { create } from "zustand";
import { supabase } from "../api/supabase";
import {
  fromEventRow,
  fromMatchRow,
  fromPlayerRow,
  fromRankingRow,
  fromRoundRow,
  roundKey,
  type ProTourEvent,
  type ProTourMatch,
  type ProTourPlayerProfile,
  type ProTourRankingRow,
  type ProTourRoundNames,
} from "../features/tour/liveScores";

const FRESH_MS = 20_000;

type ProTourState = {
  matches: ProTourMatch[];
  events: Record<number, ProTourEvent>;
  playerProfiles: Record<number, ProTourPlayerProfile>;
  players: Record<number, string>;
  /** Money rankings, by season. Only seasons poll-pro-tour has actually cached will have an entry. */
  rankingsBySeason: Record<number, ProTourRankingRow[]>;
  roundNames: ProTourRoundNames;
  loading: boolean;
  failed: boolean;
  fetchedAt: number;
  refresh: (force?: boolean) => Promise<void>;
};

/** The latest pro tour matches, events, players and rankings, cached by poll-pro-tour. */
export const useProTourStore = create<ProTourState>((set, get) => ({
  matches: [],
  events: {},
  playerProfiles: {},
  players: {},
  rankingsBySeason: {},
  roundNames: {},
  loading: false,
  failed: false,
  fetchedAt: 0,
  refresh: async (force = false) => {
    const { loading, fetchedAt } = get();
    if (loading || (!force && Date.now() - fetchedAt < FRESH_MS)) return;
    set({ loading: true });
    try {
      const [matchResult, eventResult, playerResult, rankingResult, roundResult] = await Promise.all([
        supabase.from("pro_tour_matches").select("*").order("scheduled_at", { ascending: true }).limit(300),
        supabase.from("pro_tour_events").select("id, name, season, start_date, end_date, raw"),
        supabase.from("pro_tour_players").select("id, display_name, raw"),
        supabase.from("pro_tour_rankings").select("season, rows").eq("ranking_type", "MoneyRankings"),
        supabase.from("pro_tour_rounds").select("event_id, round, name"),
      ]);
      if (matchResult.error) throw matchResult.error;

      const events: Record<number, ProTourEvent> = {};
      for (const row of eventResult.data ?? []) events[row.id] = fromEventRow(row);

      const playerProfiles: Record<number, ProTourPlayerProfile> = {};
      const players: Record<number, string> = {};
      for (const row of playerResult.data ?? []) {
        const profile = fromPlayerRow(row);
        playerProfiles[profile.id] = profile;
        players[profile.id] = profile.name;
      }

      const rankingsBySeason: Record<number, ProTourRankingRow[]> = {};
      for (const row of rankingResult.data ?? []) {
        const rows = (row.rows as Record<string, unknown>[]) ?? [];
        rankingsBySeason[row.season] = rows.map(fromRankingRow).sort((a, b) => a.position - b.position);
      }

      const roundNames: ProTourRoundNames = {};
      for (const row of roundResult.data ?? []) {
        const { eventId, round, name } = fromRoundRow(row);
        if (name) roundNames[roundKey(eventId, round)] = name;
      }

      set({
        matches: (matchResult.data ?? []).map(fromMatchRow),
        events,
        playerProfiles,
        players,
        rankingsBySeason,
        roundNames,
        loading: false,
        failed: false,
        fetchedAt: Date.now(),
      });
    } catch (error) {
      console.warn("pro tour refresh failed", error);
      set({ loading: false, failed: true });
    }
  },
}));

/**
 * Keeps the cache fresh while a screen using it is mounted: an immediate refresh, then a refetch
 * whenever poll-pro-tour writes a change (debounced, since a poll can touch several rows at once).
 * Call from useEffect and run the returned cleanup on unmount - see LiveNow for the same pattern
 * applied to a player's own live matches.
 */
export const subscribeProTourLive = (): (() => void) => {
  void useProTourStore.getState().refresh();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const channel = supabase
    .channel(`pro-tour-live-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "pro_tour_matches" }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void useProTourStore.getState().refresh(true), 500);
    })
    .subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
};
