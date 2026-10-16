// @ts-nocheck
// Polls api.snooker.org for live scores, fixtures, results, players, events, round info and
// rankings, caching them in the pro_tour_* tables. No client ever calls snooker.org directly -
// the app only reads the cache - because its rate limit (2 requests/minute) is shared across every
// user of this app, not per-device, and the approved header value would be extractable from the
// app bundle if it were ever shipped client-side.
//
// Each invocation makes AT MOST ONE snooker.org call. Invoked every 30s by Supabase Cron, so the
// ceiling is 2 calls/minute. Kinds are tried by tier (live scores, then fixtures/rounds/players,
// then history), most overdue first within a tier; a kind with nothing to do makes no call and the
// next one gets the slot.
//
// Backfills remember what they've already asked for (pro_tour_fetch_log), rather than inferring
// "still missing" from the cache: an event with no draw or no round info yet used to look missing
// forever, so it was re-requested every tick and everything queued behind it never arrived.
//
// Deploy with JWT verification OFF and call with Authorization: Bearer <service role key>.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REQUESTED_BY = Deno.env.get("SNOOKER_ORG_REQUESTED_BY") ?? "";
const TOUR = Deno.env.get("SNOOKER_ORG_TOUR") ?? "main";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const snookerGet = async (query) => {
  const response = await fetch(`https://api.snooker.org/${query}`, {
    headers: { "X-Requested-By": REQUESTED_BY, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`snooker_org_${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const nowIso = () => new Date().toISOString();

// ------------------------------------------------------------------ row mappers
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
  updated_at: nowIso(),
});

const toEventRow = (row) => ({
  id: row.ID,
  name: row.Name ?? null,
  season: row.Season ?? null,
  tour: row.Tour ?? null,
  start_date: row.StartDate || null,
  end_date: row.EndDate || null,
  raw: row,
  updated_at: nowIso(),
});

// Round info for an event includes its qualifying event's rounds too, each under that event's own
// id (EventID) - store each row against the event it belongs to, not the one that was requested.
const toRoundRow = (requestedEventId, row) => ({
  event_id: row.EventID || requestedEventId,
  round: row.Round,
  name: row.RoundName ?? null,
  raw: row,
  updated_at: nowIso(),
});

// SurnameFirst players (most Chinese and Thai players) are written family name first: "Zhao Xintong".
const toPlayerRow = (row) => {
  const parts = row.SurnameFirst ? [row.LastName, row.FirstName, row.MiddleName] : [row.FirstName, row.MiddleName, row.LastName];
  const name = row.Name || parts.filter(Boolean).join(" ") || `Player ${row.ID}`;
  return { id: row.ID, display_name: name, raw: row, updated_at: nowIso() };
};

const upsert = async (admin, table, rows, onConflict = "id") => {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw error;
  }
};

// ------------------------------------------------------------------ followers: push when a match starts or ends
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

/** Upserts matches and returns the ones that just went live or just finished, compared with what
 *  was cached before - the only moments a follower is told about. */
// What the app shows of a match. A row is only written when one of these has changed: rewriting
// every row each poll churned the database (and fired a realtime event per row) for nothing.
const MATCH_SIGNATURE_COLUMNS =
  "id, player1_id, player2_id, score1, score2, winner_id, unfinished, on_break, scheduled_at, live_url, details_url, table_no, note, " +
  "sessions:raw->>Sessions, frames:raw->>FrameScores, video:raw->>VideoURL, estimated:raw->>Estimated, walkover1:raw->>Walkover1, walkover2:raw->>Walkover2";
const text = (value) => (value == null ? "" : String(value));
const time = (value) => (value ? new Date(value).getTime() : 0);
const signature = (row) =>
  [
    row.player1_id, row.player2_id, row.score1, row.score2, row.winner_id, !!row.unfinished, !!row.on_break, time(row.scheduled_at),
    row.live_url, row.details_url, row.table_no, row.note, row.sessions, row.frames, row.video, row.estimated, row.walkover1, row.walkover2,
  ].map(text).join("|");
const signatureOfNew = (row) =>
  signature({
    ...row,
    sessions: row.raw?.Sessions,
    frames: row.raw?.FrameScores,
    video: row.raw?.VideoURL,
    estimated: row.raw?.Estimated,
    walkover1: row.raw?.Walkover1,
    walkover2: row.raw?.Walkover2,
  });

const upsertMatches = async (admin, rows) => {
  if (!rows.length) return [];
  const before = new Map();
  for (let i = 0; i < rows.length; i += 400) {
    const ids = rows.slice(i, i + 400).map((row) => row.id);
    const { data } = await admin.from("pro_tour_matches").select(MATCH_SIGNATURE_COLUMNS).in("id", ids);
    for (const row of data ?? []) before.set(Number(row.id), row);
  }
  const changed = rows.filter((row) => {
    const old = before.get(Number(row.id));
    return !old || signature(old) !== signatureOfNew(row);
  });
  await upsert(admin, "pro_tour_matches", changed);
  const cutoff = Date.now() - 2 * DAY;
  const changes = [];
  for (const row of rows) {
    const old = before.get(Number(row.id));
    if (!old) continue; // first sight of a match (a backfill): nothing "just" happened
    if (row.scheduled_at && new Date(row.scheduled_at).getTime() < cutoff) continue;
    if (row.winner_id && !old.winner_id) changes.push({ match: row, kind: "finished" });
    else if (row.unfinished && !old.unfinished && !row.winner_id) changes.push({ match: row, kind: "started" });
  }
  return changes;
};

const notifyFollowers = async (admin, changes) => {
  if (!changes.length) return 0;
  const playerIds = [...new Set(changes.flatMap(({ match }) => [match.player1_id, match.player2_id]).filter(Boolean))];
  const { data: follows } = await admin.from("pro_tour_follows").select("user_id, player_id").in("player_id", playerIds);
  if (!follows?.length) return 0;
  // Once per match and kind, however many polls see the change.
  const { data: fresh } = await admin
    .from("pro_tour_notifications")
    .upsert(changes.map(({ match, kind }) => ({ match_id: match.id, kind })), { onConflict: "match_id,kind", ignoreDuplicates: true })
    .select("match_id, kind");
  const isFresh = new Set((fresh ?? []).map((row) => `${row.match_id}:${row.kind}`));
  const todo = changes.filter(({ match, kind }) => isFresh.has(`${match.id}:${kind}`));
  if (!todo.length) return 0;

  const userIds = [...new Set(follows.map((row) => row.user_id))];
  const eventIds = [...new Set(todo.map(({ match }) => match.event_id))];
  const [{ data: tokens }, { data: names }, { data: events }, { data: rounds }] = await Promise.all([
    admin.from("push_tokens").select("token, user_id").in("user_id", userIds),
    admin.from("pro_tour_players").select("id, display_name").in("id", playerIds),
    admin.from("pro_tour_events").select("id, name").in("id", eventIds),
    admin.from("pro_tour_rounds").select("event_id, round, name, left:raw->>NumLeft").in("event_id", eventIds),
  ]);
  const nameOf = (id) => (names ?? []).find((row) => Number(row.id) === Number(id))?.display_name ?? "TBD";
  const eventOf = (id) => (events ?? []).find((row) => Number(row.id) === Number(id))?.name ?? "Pro tour";
  const roundOf = (eventId, round) => {
    const info = (rounds ?? []).find((row) => Number(row.event_id) === Number(eventId) && Number(row.round) === Number(round));
    const left = Number(info?.left ?? 0);
    return left === 2 ? "Final" : left === 4 ? "Semi-finals" : left === 8 ? "Quarter-finals" : left > 8 ? `Last ${left}` : info?.name ?? "";
  };
  const tokensOf = (userId) => (tokens ?? []).filter((row) => row.user_id === userId).map((row) => row.token);

  const messages = [];
  for (const { match, kind } of todo) {
    const followers = new Set(follows.filter((f) => [match.player1_id, match.player2_id].includes(Number(f.player_id))).map((f) => f.user_id));
    const p1 = nameOf(match.player1_id);
    const p2 = nameOf(match.player2_id);
    const where = [eventOf(match.event_id), roundOf(match.event_id, match.round)].filter(Boolean).join(" · ");
    const secondWon = match.winner_id === match.player2_id;
    const title =
      kind === "started"
        ? `Live now: ${p1} v ${p2}`
        : secondWon
          ? `${p2} beat ${p1} ${match.score2}-${match.score1}`
          : `${p1} beat ${p2} ${match.score1}-${match.score2}`;
    const body = kind === "started" ? `${where} is under way.` : where;
    for (const userId of followers) {
      for (const to of tokensOf(userId)) messages.push({ to, title, body, sound: "default", data: { proTourMatchId: match.id } });
    }
  }
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const response = await fetch(EXPO_PUSH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const result = await response.json().catch(() => null);
      // A token Expo says is gone (app deleted, permission revoked) is removed, not retried forever.
      const dead = (result?.data ?? []).map((ticket, j) => (ticket?.details?.error === "DeviceNotRegistered" ? batch[j].to : null)).filter(Boolean);
      if (dead.length) await admin.from("push_tokens").delete().in("token", dead);
    } catch (error) {
      console.warn("poll-pro-tour: push send failed", { message: error?.message });
    }
  }
  return messages.length;
};

// ------------------------------------------------------------------ bookkeeping
const loadState = async (admin) => {
  const { data, error } = await admin.from("pro_tour_poll_state").select("*");
  if (error) throw error;
  const byKind = {};
  for (const row of data ?? []) byKind[row.kind] = row;
  return byKind;
};
const markFetched = async (admin, kind, { error = null, value = undefined } = {}) => {
  const patch = { kind, last_fetched_at: nowIso(), last_error: error };
  if (value !== undefined) patch.last_value = value;
  const { error: writeError } = await admin.from("pro_tour_poll_state").upsert(patch, { onConflict: "kind" });
  if (writeError) console.warn("poll-pro-tour: could not record poll state", { message: writeError.message });
};
const fetchLog = async (admin, kind) => {
  const { data } = await admin.from("pro_tour_fetch_log").select("target, fetched_at").eq("kind", kind).limit(20000);
  return new Map((data ?? []).map((row) => [Number(row.target), new Date(row.fetched_at).getTime()]));
};
const logFetch = async (admin, kind, target, rows) => {
  await admin.from("pro_tour_fetch_log").upsert({ kind, target, rows, fetched_at: nowIso() }, { onConflict: "kind,target" });
};

const currentSeason = (state) => state.season?.last_value?.season ?? new Date().getUTCFullYear();

/** Every cached event with where it sits relative to now: running, soon (within 30 days), recent (ended in the last 3). */
const loadEvents = async (admin, now) => {
  const { data } = await admin.from("pro_tour_events").select("id, season, start_date, end_date, main:raw->>Main").limit(20000);
  return (data ?? []).map((row) => {
    const start = row.start_date ? new Date(row.start_date).getTime() : null;
    const end = row.end_date ? new Date(row.end_date).getTime() + DAY : null; // end date is a whole day
    const running = start != null && end != null && start <= now && now < end;
    const soon = start != null && start > now && start - now <= 30 * DAY;
    const recent = end != null && end <= now && now - end <= 3 * DAY;
    return { id: Number(row.id), season: row.season, start, end, main: Number(row.main || 0), running, soon, recent };
  });
};
const priority = (event) => (event.running ? 0 : event.soon ? 1 : event.recent ? 2 : 3);

// ------------------------------------------------------------------ player photos (Wikipedia / Wikimedia Commons)
// Not snooker.org, so not part of its 2-calls-a-minute budget: a side job on its own interval that
// looks up each player's Wikipedia lead image on Commons, with the credit its licence requires.
const WIKI_UA = "SnookeredApp/1.0 (https://snookeredapp.com; support@snookeredapp.com)";
const PHOTO_INTERVAL = 3 * MIN;
const wikiGet = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": WIKI_UA, "Api-User-Agent": WIKI_UA, Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`wiki_${response.status}`);
  return response.json();
};
const stripHtml = (value) => (value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const photoFor = async (wikipediaUrl) => {
  const path = new URL(wikipediaUrl).pathname;
  const title = decodeURIComponent(path.split("/wiki/")[1] ?? "");
  if (!title) return null;
  const summary = await wikiGet(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  const original = summary?.originalimage?.source;
  if (!original) return null;
  const file = decodeURIComponent(original.split("?")[0].split("/").pop());
  const query = await wikiGet(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${file}`)}`
  );
  const info = Object.values(query?.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info?.thumburl) return null; // not on Commons (a non-free local image): not ours to use
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl.split("?")[0],
    credit: stripHtml(meta.Artist?.value) || null,
    license: meta.LicenseShortName?.value ?? null,
    source_url: info.descriptionurl ?? null,
  };
};

/** Up to 15 players a run: ranked players first, then anyone else with a Wikipedia page; a player
 *  is looked up again after 30 days, so a newer lead image is picked up eventually. */
const fillPhotos = async (admin, now) => {
  const [{ data: withWiki }, { data: checked }, { data: rankings }] = await Promise.all([
    admin.from("pro_tour_players").select("id, wiki:raw->>WikipediaURL").not("raw->>WikipediaURL", "is", null).limit(5000),
    admin.from("pro_tour_player_photos").select("player_id, checked_at").limit(20000),
    admin.from("pro_tour_rankings").select("season, rows").eq("ranking_type", "MoneyRankings").order("season", { ascending: false }).limit(1),
  ]);
  const fresh = new Set(
    (checked ?? []).filter((row) => now - new Date(row.checked_at).getTime() < 30 * DAY).map((row) => Number(row.player_id))
  );
  const rank = new Map(asArray(rankings?.[0]?.rows).map((row) => [Number(row.PlayerID), Number(row.Position)]));
  const todo = (withWiki ?? [])
    .filter((row) => row.wiki && !fresh.has(Number(row.id)))
    .sort((a, b) => (rank.get(Number(a.id)) ?? 9999) - (rank.get(Number(b.id)) ?? 9999))
    .slice(0, 15);
  let found = 0;
  for (let i = 0; i < todo.length; i += 5) {
    const batch = todo.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map((row) => photoFor(row.wiki)));
    const rows = [];
    results.forEach((result, j) => {
      if (result.status === "rejected") return; // a network blip: try this player again next run
      if (result.value) found++;
      rows.push({ player_id: Number(batch[j].id), ...(result.value ?? { url: null, credit: null, license: null, source_url: null }), checked_at: nowIso() });
    });
    await upsert(admin, "pro_tour_player_photos", rows, "player_id");
  }
  return { checked: todo.length, found };
};

// ------------------------------------------------------------------ kinds
// interval: how often the kind is worth looking at. run: returns { called } - whether it spent the
// one snooker.org call this invocation is allowed.
const KINDS = {
  live: {
    // Ongoing matches plus anything starting or finishing within 147 minutes. First call on the
    // budget while a tournament is on (every other tick, so the other half is left for fixtures and
    // backfills); every 10 minutes otherwise, in case something starts unannounced.
    tier: 0,
    interval: (ctx) => (ctx.events.some((event) => event.running) ? 45_000 : 10 * MIN),
    run: async (admin) => {
      const rows = asArray(await snookerGet(`?t=17&tr=${TOUR}`));
      const notified = await notifyFollowers(admin, await upsertMatches(admin, rows.map(toMatchRow)));
      return { called: true, fetched: rows.length, notified };
    },
  },
  upcoming: {
    tier: 1,
    interval: () => 10 * MIN,
    run: async (admin) => {
      const rows = asArray(await snookerGet(`?t=14&tr=${TOUR}`));
      const notified = await notifyFollowers(admin, await upsertMatches(admin, rows.map(toMatchRow)));
      return { called: true, fetched: rows.length, notified };
    },
  },
  results: {
    tier: 1,
    interval: () => 10 * MIN,
    run: async (admin) => {
      const rows = asArray(await snookerGet(`?t=15&ds=2&tr=${TOUR}`));
      const notified = await notifyFollowers(admin, await upsertMatches(admin, rows.map(toMatchRow)));
      return { called: true, fetched: rows.length, notified };
    },
  },
  // A stage's main event that the season list leaves out - the Australian Women's Open's knockout
  // event (Last 16 to the final) isn't in the main tour's list though its groups are. Fetched by
  // id, so its draw then syncs like any other event's. Each id at most once a week.
  event_fill: {
    tier: 1,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const known = new Set(ctx.events.map((event) => event.id));
      const log = await fetchLog(admin, "event_fill");
      const id = [...new Set(ctx.events.map((event) => event.main).filter((main) => main && !known.has(main)))].find(
        (main) => ctx.now - (log.get(main) ?? 0) > 7 * DAY
      );
      if (!id) return { called: false };
      const rows = asArray(await snookerGet(`?e=${id}`)).filter((row) => row?.ID);
      await upsert(admin, "pro_tour_events", rows.map(toEventRow));
      await logFetch(admin, "event_fill", id, rows.length);
      return { called: true, eventId: id, fetched: rows.length };
    },
  },
  // The whole draw of a tournament that's on, about to start or just finished - every fixture
  // including undecided slots, with the latest session times. Running events every 8 minutes.
  event_sync: {
    tier: 1,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const log = await fetchLog(admin, "sync");
      const staleAfter = (event) => (event.running ? 8 * MIN : event.soon ? 4 * HOUR : 2 * HOUR);
      const target = ctx.events
        .filter((event) => event.running || event.soon || event.recent)
        .filter((event) => ctx.now - (log.get(event.id) ?? 0) > staleAfter(event))
        .sort((a, b) => priority(a) - priority(b) || (log.get(a.id) ?? 0) - (log.get(b.id) ?? 0))[0];
      if (!target) return { called: false };
      const rows = asArray(await snookerGet(`?t=6&e=${target.id}`));
      await notifyFollowers(admin, await upsertMatches(admin, rows.map(toMatchRow)));
      // t=6 is the event's whole draw. When snooker.org redraws a round it gives the matches new
      // ids, so anything of this event's it no longer lists is stale - left in, every fixture of
      // that round would show twice.
      if (rows.length) {
        const ids = rows.map((row) => Number(row.ID)).filter(Boolean);
        const { error } = await admin.from("pro_tour_matches").delete().eq("event_id", target.id).not("id", "in", `(${ids.join(",")})`);
        if (error) console.warn("stale match cleanup failed", target.id, error.message);
      }
      await logFetch(admin, "sync", target.id, rows.length);
      return { called: true, eventId: target.id, fetched: rows.length };
    },
  },
  // What every round of every event is (name, players left, best of, prize money) - the whole
  // season in one call (t=12&s=), so no tournament waits in a queue for its round names. The
  // current season every 6 hours, last season once.
  round_info: {
    tier: 1,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const log = await fetchLog(admin, "rounds_season");
      const season = currentSeason(ctx.state);
      const target = ctx.now - (log.get(season) ?? 0) > 6 * HOUR ? season : !log.has(season - 1) ? season - 1 : null;
      if (target == null) return { called: false };
      const rows = asArray(await snookerGet(`?t=12&s=${target}`)).filter((row) => row?.Round != null && row?.EventID);
      await upsert(admin, "pro_tour_rounds", rows.map((row) => toRoundRow(row.EventID, row)), "event_id,round");
      await logFetch(admin, "rounds_season", target, rows.length);
      return { called: true, season: target, fetched: rows.length };
    },
  },
  // The draw's wiring (snooker.org t=18): which match feeds which slot of the next round, with the
  // players who could fill it - the bracket view and "winner of X v Y" come from this.
  bracket_fill: {
    tier: 1,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const log = await fetchLog(admin, "candidates");
      const staleAfter = (event) => (event.running ? HOUR : 6 * HOUR);
      const target = ctx.events
        .filter((event) => (event.running || event.soon) && (!event.main || event.main === event.id))
        .filter((event) => ctx.now - (log.get(event.id) ?? 0) > staleAfter(event))
        .sort((a, b) => priority(a) - priority(b) || (a.start ?? 0) - (b.start ?? 0))[0];
      if (!target) return { called: false };
      const rows = asArray(await snookerGet(`?t=18&e=${target.id}`));
      await upsert(admin, "pro_tour_event_extras", [{ event_id: target.id, kind: "candidates", data: rows, updated_at: nowIso() }], "event_id,kind");
      await logFetch(admin, "candidates", target.id, rows.length);
      return { called: true, eventId: target.id, fetched: rows.length };
    },
  },
  // Every past meeting of the two players in a live or upcoming match, for the match screen.
  // Live matches first, then the soonest; a pair is refreshed weekly.
  h2h_fill: {
    tier: 2,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const ids = ctx.events.filter((event) => event.running || event.soon).map((event) => event.id);
      if (!ids.length) return { called: false };
      const [{ data: upcoming }, { data: cached }, { data: tbd }] = await Promise.all([
        admin
          .from("pro_tour_matches")
          .select("player1_id, player2_id, unfinished, scheduled_at")
          .in("event_id", ids)
          .is("winner_id", null)
          .order("unfinished", { ascending: false })
          .order("scheduled_at", { ascending: true })
          .limit(500),
        admin.from("pro_tour_h2h").select("player_a, player_b, updated_at").limit(20000),
        // snooker.org's stand-ins ("TBD  ", "WILDCARD  ") come with trailing spaces.
        admin.from("pro_tour_players").select("id").or("display_name.ilike.TBD%,display_name.ilike.WILDCARD%").limit(5000),
      ]);
      const placeholder = new Set([376, 2286, ...(tbd ?? []).map((row) => Number(row.id))]);
      const fresh = new Set(
        (cached ?? []).filter((row) => ctx.now - new Date(row.updated_at).getTime() < 7 * DAY).map((row) => `${row.player_a}:${row.player_b}`)
      );
      const pair = (upcoming ?? [])
        .map((row) => [Number(row.player1_id), Number(row.player2_id)].sort((a, b) => a - b))
        .find(([a, b]) => a && b && a !== b && !placeholder.has(a) && !placeholder.has(b) && !fresh.has(`${a}:${b}`));
      if (!pair) return { called: false };
      const [a, b] = pair;
      const rows = asArray(await snookerGet(`?p1=${a}&p2=${b}&s=-1&tr=${TOUR}`));
      await upsert(admin, "pro_tour_h2h", [{ player_a: a, player_b: b, matches: rows, updated_at: nowIso() }], "player_a,player_b");
      return { called: true, pair, fetched: rows.length };
    },
  },
  // Every fixture and result of finished events from this season and last, newest first - how past
  // tournaments' results become browsable.
  history_fill: {
    tier: 2,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const log = await fetchLog(admin, "matches");
      const season = currentSeason(ctx.state);
      const target = ctx.events
        .filter((event) => (event.season ?? 0) >= season - 1 && event.end != null && event.end <= ctx.now && !log.has(event.id))
        .sort((a, b) => b.end - a.end)[0];
      if (!target) return { called: false };
      const rows = asArray(await snookerGet(`?t=6&e=${target.id}`));
      await upsert(admin, "pro_tour_matches", rows.map(toMatchRow));
      await logFetch(admin, "matches", target.id, rows.length);
      return { called: true, eventId: target.id, fetched: rows.length };
    },
  },
  // Everyone in a tournament that's on or coming up, in one call - amateurs and qualifiers included,
  // so a whole draw has its names at once instead of one player lookup a minute.
  event_players: {
    tier: 1,
    interval: () => MIN,
    run: async (admin, ctx) => {
      const log = await fetchLog(admin, "roster");
      const target = ctx.events
        .filter((event) => event.running || event.soon)
        .filter((event) => ctx.now - (log.get(event.id) ?? 0) > DAY)
        .sort((a, b) => priority(a) - priority(b) || (a.start ?? 0) - (b.start ?? 0))[0];
      if (!target) return { called: false };
      const rows = asArray(await snookerGet(`?t=9&e=${target.id}`)).filter((row) => row?.ID);
      await upsert(admin, "pro_tour_players", rows.map(toPlayerRow));
      await logFetch(admin, "roster", target.id, rows.length);
      return { called: true, eventId: target.id, fetched: rows.length };
    },
  },
  // A name and bio for any player a cached match refers to.
  player_fill: {
    tier: 1,
    interval: () => 40_000,
    run: async (admin) => {
      const [{ data: known }, { data: matchRows }, log] = await Promise.all([
        admin.from("pro_tour_players").select("id, display_name").limit(20000),
        admin.from("pro_tour_matches").select("player1_id, player2_id").order("scheduled_at", { ascending: false }).limit(5000),
        fetchLog(admin, "player"),
      ]);
      // A "TBD" row is a placeholder from a lookup that failed, not a known player: ask again, once
      // a week at most (the fetch log remembers the last try).
      const skip = new Set((known ?? []).filter((row) => row.display_name !== "TBD").map((row) => Number(row.id)));
      for (const [id, at] of log) if (Date.now() - at < 7 * DAY) skip.add(id);
      const ids = [];
      for (const row of matchRows ?? []) ids.push(row.player1_id, row.player2_id);
      const missing = ids.map(Number).find((id) => id > 0 && !skip.has(id));
      if (!missing) return { called: false };
      let player = null;
      try {
        // One player still comes back as a one-item list.
        player = asArray(await snookerGet(`?p=${missing}`))[0] ?? null;
      } catch (error) {
        console.warn("poll-pro-tour: player lookup failed", { playerId: missing, message: error?.message });
      }
      // No usable record: a bracket placeholder ("winner of an earlier round"), shown as TBD.
      const row = player?.ID ? toPlayerRow(player) : { id: missing, display_name: "TBD", raw: {}, updated_at: nowIso() };
      await upsert(admin, "pro_tour_players", [row]);
      await logFetch(admin, "player", missing, player?.ID ? 1 : 0);
      return { called: true, playerId: missing };
    },
  },
  season: {
    tier: 1,
    interval: () => DAY,
    run: async (admin) => {
      const result = await snookerGet("?t=20");
      const season = result?.CurrentSeason ?? result?.Season ?? result?.season ?? null;
      await markFetched(admin, "season", { value: season ? { season } : null });
      return { called: true, season, skipMark: true };
    },
  },
  events: {
    // A season and tour at a time - every season in one call is more than snooker.org will serve
    // (503). The main tour and the women's tour (whose events - the Women's Snooker Open, the UK
    // and Irish Women's - aren't in the main list): this season twice a day, last season daily.
    tier: 1,
    interval: () => 5 * MIN,
    run: async (admin, ctx) => {
      const log = await fetchLog(admin, "events_season");
      const season = currentSeason(ctx.state);
      // fetch_log targets are numbers: the main tour logs as the season, the women's as season*10+1.
      const lists = [
        { season, tour: TOUR, key: season, every: 12 * HOUR },
        { season, tour: "women", key: season * 10 + 1, every: 12 * HOUR },
        { season: season - 1, tour: TOUR, key: season - 1, every: DAY },
        { season: season - 1, tour: "women", key: (season - 1) * 10 + 1, every: DAY },
      ];
      const target = lists.find((list) => ctx.now - (log.get(list.key) ?? 0) > list.every);
      if (!target) return { called: false };
      const rows = asArray(await snookerGet(`?t=5&s=${target.season}&tr=${target.tour}`));
      await upsert(admin, "pro_tour_events", rows.map(toEventRow));
      await logFetch(admin, "events_season", target.key, rows.length);
      return { called: true, season: target.season, tour: target.tour, fetched: rows.length };
    },
  },
  players: {
    tier: 1,
    interval: () => DAY,
    run: async (admin, ctx) => {
      const season = currentSeason(ctx.state);
      const rows = asArray(await snookerGet(`?t=10&st=p&s=${season}`));
      await upsert(admin, "pro_tour_players", rows.map(toPlayerRow));
      return { called: true, fetched: rows.length, season };
    },
  },
  rankings: {
    tier: 1,
    interval: () => 12 * HOUR,
    run: async (admin, ctx) => {
      const season = currentSeason(ctx.state);
      const rows = asArray(await snookerGet(`?rt=MoneyRankings&s=${season}`));
      await upsert(
        admin,
        "pro_tour_rankings",
        [{ ranking_type: "MoneyRankings", season, rows, updated_at: nowIso() }],
        "ranking_type,season"
      );
      return { called: true, fetched: rows.length, season };
    },
  },
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
  const now = Date.now();
  let kind = null;
  try {
    const state = await loadState(admin);
    const ctx = { now, state, events: await loadEvents(admin, now) };

    let photos = null;
    const photosLast = state.photo_fill?.last_fetched_at ? new Date(state.photo_fill.last_fetched_at).getTime() : 0;
    if (now - photosLast > PHOTO_INTERVAL) {
      try {
        photos = await fillPhotos(admin, now);
        await markFetched(admin, "photo_fill", {});
      } catch (error) {
        console.warn("poll-pro-tour: photo job failed", { message: error?.message });
        await markFetched(admin, "photo_fill", { error: String(error?.message ?? error) });
      }
    }
    const due = Object.entries(KINDS)
      .map(([name, def]) => {
        const last = state[name]?.last_fetched_at ? new Date(state[name].last_fetched_at).getTime() : 0;
        return { name, def, overdueBy: now - last - def.interval(ctx) };
      })
      .filter((entry) => entry.overdueBy >= 0)
      .sort((a, b) => a.def.tier - b.def.tier || b.overdueBy - a.overdueBy);

    const looked = [];
    for (const entry of due) {
      kind = entry.name;
      const result = await entry.def.run(admin, ctx);
      if (!result.skipMark) await markFetched(admin, kind, {});
      if (result.called) return json({ ok: true, kind, ...result, looked, photos });
      looked.push(kind);
    }
    return json({ ok: true, idle: true, looked, photos });
  } catch (error) {
    console.error("poll-pro-tour failed", { kind, message: error?.message });
    // Recorded against the kind so it isn't retried - starving everything else - on every tick,
    // but back-dated so it's tried again in about ten minutes rather than a whole interval (half a
    // day, for events and rankings) after one bad response.
    if (kind) {
      const def = KINDS[kind];
      const retryAt = def ? now - Math.max(0, def.interval({ now, state: {}, events: [] }) - 10 * MIN) : now;
      const { error: writeError } = await admin
        .from("pro_tour_poll_state")
        .upsert({ kind, last_fetched_at: new Date(retryAt).toISOString(), last_error: String(error?.message ?? error) }, { onConflict: "kind" });
      if (writeError) console.warn("poll-pro-tour: could not record failure", { message: writeError.message });
    }
    return json({ ok: false, error: "poll_failed", kind, message: error?.message }, 502);
  }
});
