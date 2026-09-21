/**
 * Live sync.
 *
 * The app already reads everything back from Supabase when you sign in, so a second phone shows
 * the same data. What it did not do was notice a change while it was open: score a frame on the
 * tablet at the table and the phone in your pocket stayed on yesterday's numbers.
 *
 * This listens to the database for the signed-in player's rows and refreshes the affected store.
 * Refreshing rather than patching row by row keeps one source of truth: whatever Supabase holds
 * is what the screen shows.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../api/supabase";
import {
  useAIAnalysesStore,
  useCustomRoutinesStore,
  useMatchesStore,
  useRoutineScoresStore,
  useSessionsStore,
  useTournamentsStore,
} from "../store";
import { hasPendingWrites, type SyncScope } from "./outbox";

/**
 * Which store a table belongs to. Child tables have no user_id of their own, so they are not
 * filtered here; row level security already limits what this connection is sent.
 */
const TABLE_SCOPES: Record<string, SyncScope> = {
  matches: "matches",
  match_frames: "matches",
  tournaments: "tournaments",
  tournament_fixtures: "tournaments",
  tournament_fixture_frames: "tournaments",
  session_templates: "sessions",
  session_logs: "sessions",
  session_log_results: "sessions",
  routine_score_entries: "routines",
  ai_analyses: "ai",
  custom_routines: "customRoutines",
};

const refreshers: Record<SyncScope, (userId: string) => Promise<void>> = {
  matches: (userId) => useMatchesStore.getState().hydrateMatchesForUser(userId),
  tournaments: (userId) => useTournamentsStore.getState().hydrateTournamentsForUser(userId),
  sessions: (userId) => useSessionsStore.getState().hydrateSessionsForUser(userId),
  routines: (userId) => useRoutineScoresStore.getState().hydrateEntriesForUser(userId),
  ai: (userId) => useAIAnalysesStore.getState().hydrateAnalysesForUser(userId),
  customRoutines: (userId) => useCustomRoutinesStore.getState().hydrate(userId),
};

/** A burst of changes (a fixture, its frames, the tournament row) should cause one refresh. */
const SETTLE_MS = 400;

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let pendingScopes = new Set<SyncScope>();
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let hasConnectedOnce = false;

const runRefresh = async () => {
  settleTimer = null;
  const userId = currentUserId;
  const scopes = Array.from(pendingScopes);
  pendingScopes = new Set();

  if (!userId || !scopes.length) return;

  await Promise.all(
    scopes.map(async (scope) => {
      // Anything still waiting in the outbox is ahead of the server, and refreshing would
      // wipe it off the screen. Leave it alone until the queue drains.
      if (hasPendingWrites(scope)) return;

      try {
        await refreshers[scope](userId);
      } catch (error) {
        console.warn(`Live refresh failed for ${scope}:`, error);
      }
    })
  );
};

const scheduleRefresh = (scope: SyncScope) => {
  pendingScopes.add(scope);
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    void runRefresh();
  }, SETTLE_MS);
};

/** Pull everything again, for when the app comes back to the foreground. */
export const refreshEverything = async () => {
  const userId = currentUserId;
  if (!userId) return;

  await Promise.all(
    (Object.keys(refreshers) as SyncScope[]).map(async (scope) => {
      if (hasPendingWrites(scope)) return;
      try {
        await refreshers[scope](userId);
      } catch (error) {
        console.warn(`Refresh failed for ${scope}:`, error);
      }
    })
  );
};

export const startRealtime = (userId: string) => {
  if (currentUserId === userId && channel) return;

  stopRealtime();
  currentUserId = userId;

  const next = supabase.channel(`player-${userId}`);

  Object.entries(TABLE_SCOPES).forEach(([table, scope]) => {
    next.on("postgres_changes", { event: "*", schema: "public", table }, () => scheduleRefresh(scope));
  });

  next.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      // The first connection follows the sign-in fetch, so there is nothing to catch up on.
      // A later one means the connection dropped, and this device may have missed something.
      if (hasConnectedOnce) void refreshEverything();
      hasConnectedOnce = true;
    } else if (status === "CHANNEL_ERROR") {
      console.warn("Live sync could not connect; the app will still refresh when it is opened.");
    }
  });

  channel = next;
};

export const stopRealtime = () => {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  pendingScopes = new Set();
  currentUserId = null;
  hasConnectedOnce = false;

  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
};
