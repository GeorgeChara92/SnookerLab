// @ts-nocheck
// Polls api.snooker.org for live scores, results, players, events and rankings, caching them in
// the pro_tour_* tables (20261020_0001_pro_tour_live.sql). No client ever calls snooker.org
// directly - the app only reads the cache - because its rate limit (2 requests/minute) is shared
// across every user of this app, not per-device, and the approved header value below would be
// trivially extractable from the app bundle if it were ever shipped client-side.
//
// Each invocation makes AT MOST ONE snooker.org call: whichever kind of data is most overdue
// against its own refresh interval (REFRESH_MS below). Invoked every 30s by Supabase Cron, so the
// absolute ceiling is 2 calls/minute - at the limit, never over it, regardless of what's due.
//
// Deploy with JWT verification OFF: this is called by Supabase Cron, not a signed-in user. Set the
// cron job's HTTP target to call it with Authorization: Bearer <service role key> (Supabase's own
// Cron UI offers this as a preset), which this function checks for itself below - no separate
// secret to create or store, since the service role key already exists for every project.
//
// Event and Player field names below are a best-effort guess - api.snooker.org's own docs site
// blocks unauthenticated browsing of a live example, so only the Match shape (from a published
// [static] example) is confirmed. The full response is always kept in `raw` regardless, so a wrong
// guess here only means a typed column stays null until it's corrected - nothing is lost.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REQUESTED_BY = Deno.env.get("SNOOKER_ORG_REQUESTED_BY") ?? "";
const TOUR = Deno.env.get("SNOOKER_ORG_TOUR") ?? "main";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * How often each kind is worth a fresh call. "ongoing" is due again every single tick (its
 * interval equals the cron cadence), so whichever kind is furthest PAST its own deadline wins -
 * not just the first one found due - or results/upcoming/events/etc would only ever be fetched
 * once, before "ongoing" permanently crowded every later tick out from under them. See dueKind.
 */
const REFRESH_MS = {
  ongoing: 30_000,
  results: 5 * 60_000,
  upcoming: 5 * 60_000,
  // Backfills a player missing a name/bio (an amateur or qualifier, usually) referenced by a
  // cached match. Short interval, but a no-op call-free tick whenever nothing is missing.
  player_fill: 45_000,
  // Backfills fixtures/results for a cached event (from the last two seasons) that has none yet -
  // how "past season" history and results gradually become available without a dedicated endpoint
  // for them. Same no-op-when-caught-up shape as player_fill.
  event_fill: 45_000,
  // Backfills what each round number actually means for a cached event (a quarter-final in one
  // event's draw is a different round number than in another's) - same no-op shape again.
  round_fill: 45_000,
  season: 24 * 60 * 60_000,
  players: 24 * 60 * 60_000,
  events: 24 * 60 * 60_000,
  rankings: 24 * 60 * 60_000,
};

const snookerGet = async (query) => {
  const response = await fetch(`https://api.snooker.org/${query}`, {
    headers: { "X-Requested-By": REQUESTED_BY, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`snooker_org_${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const toMatchRow = (row) => ({
  id: row.ID,
  event_id: row.EventID,
  round: row.Round,
  number: row.Number,
  player1_id: row.Player1ID || null,
  player2_id: row.Player2ID || null,
  score1: row.Score1 ?? 0,
  score2: row.Score2 ?? 0,
  winner_id: row.WinnerID || null,
  unfinished: !!row.Unfinished,
  on_break: !!row.OnBreak,
  scheduled_at: row.ScheduledDate || null,
  live_url: row.LiveUrl || null,
  details_url: row.DetailsUrl || null,
  table_no: row.TableNo ?? null,
  note: row.Note || null,
  raw: row,
  updated_at: new Date().toISOString(),
});

const toEventRow = (row) => ({
  id: row.ID,
  name: row.Name ?? row.LongName ?? null,
  season: row.Season ?? null,
  tour: row.Tour ?? null,
  start_date: row.StartDate || null,
  end_date: row.EndDate || null,
  raw: row,
  updated_at: new Date().toISOString(),
});

// Field names here are a best-effort guess, same caveat as toEventRow above - this endpoint's
// shape isn't confirmed, so `raw` is kept in full and a wrong guess just means `name` stays null.
const toRoundRow = (eventId, row) => ({
  event_id: eventId,
  round: row.Round,
  name: row.Name ?? row.RoundName ?? row.Description ?? row.ShortName ?? null,
  raw: row,
  updated_at: new Date().toISOString(),
});

const toPlayerRow = (row) => {
  const name =
    row.Name ??
    [row.FirstName, row.MiddleName, row.LastName].filter(Boolean).join(" ") ??
    `Player ${row.ID}`;
  return { id: row.ID, display_name: name || `Player ${row.ID}`, raw: row, updated_at: new Date().toISOString() };
};

const upsert = async (admin, table, rows, conflictKey = "id") => {
  if (!rows.length) return;
  const { error } = await admin.from(table).upsert(rows, { onConflict: conflictKey });
  if (error) throw error;
};

/** Reads cached per-kind state, defaulting anything missing to "never fetched" (always due). */
const loadState = async (admin) => {
  const { data, error } = await admin.from("pro_tour_poll_state").select("*");
  if (error) throw error;
  const byKind = {};
  for (const row of data ?? []) byKind[row.kind] = row;
  return byKind;
};

/** Whichever due kind is furthest past its own deadline, not just the first one found due. */
const dueKind = (state, now) => {
  let best = null;
  let bestOverdueBy = -Infinity;
  for (const kind of Object.keys(REFRESH_MS)) {
    const last = state[kind]?.last_fetched_at ? new Date(state[kind].last_fetched_at).getTime() : 0;
    const overdueBy = now - last - REFRESH_MS[kind];
    if (overdueBy >= 0 && overdueBy > bestOverdueBy) {
      bestOverdueBy = overdueBy;
      best = kind;
    }
  }
  return best;
};

const markFetched = async (admin, kind, { error = null, value = undefined } = {}) => {
  const patch = { kind, last_fetched_at: new Date().toISOString(), last_error: error };
  if (value !== undefined) patch.last_value = value;
  const { error: writeError } = await admin.from("pro_tour_poll_state").upsert(patch, { onConflict: "kind" });
  if (writeError) console.warn("poll-pro-tour: could not record poll state", { message: writeError.message });
};

const currentSeason = (state) => state.season?.last_value?.season ?? new Date().getFullYear();

const fetchKind = async (admin, kind, state) => {
  switch (kind) {
    case "ongoing": {
      const rows = asArray(await snookerGet(`?t=7&tr=${TOUR}`));
      await upsert(admin, "pro_tour_matches", rows.map(toMatchRow));
      return { fetched: rows.length };
    }
    case "upcoming": {
      const rows = asArray(await snookerGet(`?t=14&tr=${TOUR}`));
      await upsert(admin, "pro_tour_matches", rows.map(toMatchRow));
      return { fetched: rows.length };
    }
    case "results": {
      const rows = asArray(await snookerGet(`?t=15&ds=2&tr=${TOUR}`));
      await upsert(admin, "pro_tour_matches", rows.map(toMatchRow));
      return { fetched: rows.length };
    }
    case "player_fill": {
      const [{ data: known }, { data: matchRows }] = await Promise.all([
        admin.from("pro_tour_players").select("id"),
        admin.from("pro_tour_matches").select("player1_id, player2_id").limit(500),
      ]);
      const knownIds = new Set((known ?? []).map((row) => Number(row.id)));
      let missingId = null;
      for (const row of matchRows ?? []) {
        if (row.player1_id && !knownIds.has(Number(row.player1_id))) {
          missingId = row.player1_id;
          break;
        }
        if (row.player2_id && !knownIds.has(Number(row.player2_id))) {
          missingId = row.player2_id;
          break;
        }
      }
      if (!missingId) return { filled: 0 };
      // Some ids (amateurs, qualifiers) have no usable record at ?p=<id>. Still mark the id as
      // known with a placeholder row, or player_fill would crash on - and loop forever retrying
      // - this exact id every tick instead of making progress on the rest of the backlog.
      let player = null;
      try {
        player = await snookerGet(`?p=${missingId}`);
      } catch (error) {
        console.warn("poll-pro-tour: player lookup failed", { playerId: missingId, message: error?.message });
      }
      // A falsy ID back from snooker.org means this isn't a real player - a bracket slot not yet
      // decided (a bye, or "winner of an earlier qualifying round"), which the app shows as TBD.
      const row = player?.ID
        ? toPlayerRow(player)
        : { id: missingId, display_name: "TBD", raw: {}, updated_at: new Date().toISOString() };
      await upsert(admin, "pro_tour_players", [row]);
      return { filled: player?.ID ? 1 : 0, playerId: missingId };
    }
    case "event_fill": {
      const season = currentSeason(state);
      const [{ data: candidateEvents }, { data: haveMatches }] = await Promise.all([
        admin.from("pro_tour_events").select("id").gte("season", season - 1).order("id", { ascending: false }).limit(500),
        admin.from("pro_tour_matches").select("event_id").limit(2000),
      ]);
      const known = new Set((haveMatches ?? []).map((row) => Number(row.event_id)));
      const target = (candidateEvents ?? []).find((event) => !known.has(Number(event.id)));
      if (!target) return { filled: 0 };
      const rows = asArray(await snookerGet(`?t=6&e=${target.id}`));
      await upsert(admin, "pro_tour_matches", rows.map(toMatchRow));
      return { filled: rows.length, eventId: target.id };
    }
    case "round_fill": {
      const season = currentSeason(state);
      const [{ data: candidateEvents }, { data: haveRounds }] = await Promise.all([
        admin.from("pro_tour_events").select("id").gte("season", season - 1).order("id", { ascending: false }).limit(500),
        admin.from("pro_tour_rounds").select("event_id").limit(2000),
      ]);
      const known = new Set((haveRounds ?? []).map((row) => Number(row.event_id)));
      const target = (candidateEvents ?? []).find((event) => !known.has(Number(event.id)));
      if (!target) return { filled: 0 };
      const rows = asArray(await snookerGet(`?t=12&e=${target.id}`));
      await upsert(admin, "pro_tour_rounds", rows.map((row) => toRoundRow(target.id, row)), "event_id,round");
      return { filled: rows.length, eventId: target.id };
    }
    case "season": {
      const result = await snookerGet("?t=20");
      const season = result?.Season ?? result?.season ?? null;
      await markFetched(admin, "season", { value: season ? { season } : null });
      return { season };
    }
    case "events": {
      // All seasons in one call (s=-1), not just the current one - cheap (one event list), and it
      // means a tournament's name/venue/dates are already cached however far back its matches go,
      // without a per-season backfill of this kind.
      const rows = asArray(await snookerGet(`?t=5&s=-1&tr=${TOUR}`));
      await upsert(admin, "pro_tour_events", rows.map(toEventRow));
      return { fetched: rows.length };
    }
    case "players": {
      const season = currentSeason(state);
      const rows = asArray(await snookerGet(`?t=10&st=p&s=${season}`));
      await upsert(admin, "pro_tour_players", rows.map(toPlayerRow));
      return { fetched: rows.length, season };
    }
    case "rankings": {
      const season = currentSeason(state);
      const rows = asArray(await snookerGet(`?rt=MoneyRankings&s=${season}`));
      await upsert(
        admin,
        "pro_tour_rankings",
        [{ ranking_type: "MoneyRankings", season, rows, updated_at: new Date().toISOString() }],
        "ranking_type,season"
      );
      return { fetched: rows.length, season };
    }
    default:
      return {};
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 503);
  if (!REQUESTED_BY) return json({ error: "snooker_org_not_configured" }, 503);

  const token = (request.headers.get("Authorization") ?? "").trim().replace(/^Bearer\s+/i, "");
  if (token !== SERVICE_ROLE_KEY) {
    // Lengths only, never the token itself, so this is safe to leave in the logs.
    console.error("poll-pro-tour unauthorized", { tokenLength: token.length, expectedLength: SERVICE_ROLE_KEY.length });
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const state = await loadState(admin);
    const kind = dueKind(state, Date.now());
    if (!kind) return json({ ok: true, skipped: true });

    const result = await fetchKind(admin, kind, state);
    if (kind !== "season") await markFetched(admin, kind, {});
    return json({ ok: true, kind, ...result });
  } catch (error) {
    console.error("poll-pro-tour failed", { message: error?.message });
    return json({ ok: false, error: "poll_failed", message: error?.message }, 502);
  }
});
