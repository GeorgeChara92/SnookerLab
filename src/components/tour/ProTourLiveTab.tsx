import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import {
  dayLabel,
  dayKeyOf,
  formatDateRange,
  formatTime,
  kickoff,
  matchStatus,
  playerName,
  roundInfo,
  roundKey,
  roundTitle,
  sessionTimesKnown,
  tournamentKey,
  tournamentName,
  tournamentStatus,
  type ProTourEvent,
  type ProTourMatch,
} from "../../features/tour/liveScores";
import type { CommunityStackParamList } from "../../types";
import { LiveDot, LiveMatchCard, PlayerAvatar, SectionTitle, TournamentCard, playerPhotoUrl } from "./ProTourUI";
import { useProTourFollowStore } from "../../store/proTourFollowStore";
import { ProTourFreshness } from "./ProTourFreshness";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
const DAY = 86_400_000;
const SHOW = 5;

const isMain = (event: ProTourEvent) => !event.mainId || event.mainId === event.id;
const startOf = (event: ProTourEvent) => (event.startDate ? new Date(event.startDate).getTime() : 0);
const endOf = (event: ProTourEvent) => (event.endDate ? new Date(event.endDate).getTime() : startOf(event)) + DAY;
const placeOf = (event: ProTourEvent) => [event.venue, event.city].filter(Boolean).join(", ") || event.country;

/**
 * The tour by tournament: what's live, what's on, what's next and who won what this season. Every
 * tournament opens its own page with the draw, the fixtures by day and the prize money.
 */
export const ProTourLiveTab = ({ onBrowseRankings }: { onBrowseRankings?: () => void }) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { matches, players, playerProfiles, photos, events, rounds, finals, loading, failed, fetchedAt, refresh, loadFinals } = useProTourStore(
    useShallow((state) => ({
      matches: state.matches,
      players: state.players,
      playerProfiles: state.playerProfiles,
      photos: state.photos,
      events: state.events,
      rounds: state.rounds,
      finals: state.finals,
      loading: state.loading,
      failed: state.failed,
      fetchedAt: state.fetchedAt,
      refresh: state.refresh,
      loadFinals: state.loadFinals,
    }))
  );
  useFocusEffect(useCallback(() => subscribeProTourLive(), []));
  const followed = useProTourFollowStore((state) => state.ids);
  const syncFollows = useProTourFollowStore((state) => state.sync);
  useEffect(() => {
    void syncFollows();
  }, [syncFollows]);

  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  // Pinned per data refresh, not per render, so the lists below stay stable between refreshes.
  const now = useMemo(() => Date.now(), [fetchedAt]);

  const timesKnown = useMemo(() => sessionTimesKnown(matches), [matches]);
  const live = useMemo(() => matches.filter((m) => matchStatus(m) === "live"), [matches]);
  const byTournament = useMemo(() => {
    const map = new Map<number, ProTourMatch[]>();
    for (const m of matches) {
      const id = tournamentKey(events[m.eventId], m.eventId);
      map.set(id, [...(map.get(id) ?? []), m]);
    }
    return map;
  }, [matches, events]);
  const countInRound = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of matches) counts[roundKey(m.eventId, m.round)] = (counts[roundKey(m.eventId, m.round)] ?? 0) + 1;
    return counts;
  }, [matches]);
  const titleFor = (m: ProTourMatch) => roundTitle(roundInfo(rounds, m.eventId, m.round), m.round, countInRound[roundKey(m.eventId, m.round)]);

  const { onNow, comingUp, results, season } = useMemo(() => {
    const main = Object.values(events).filter(isMain).filter((e) => e.startDate);
    const started = main.filter((e) => startOf(e) <= now);
    const currentSeason = started.length ? Math.max(...started.map((e) => e.season ?? 0)) : null;
    const liveIds = new Set(live.map((m) => tournamentKey(events[m.eventId], m.eventId)));
    return {
      season: currentSeason,
      onNow: main.filter((e) => (startOf(e) <= now && now < endOf(e)) || liveIds.has(e.id)).sort((a, b) => startOf(a) - startOf(b)),
      comingUp: main.filter((e) => startOf(e) > now).sort((a, b) => startOf(a) - startOf(b)),
      results: main
        .filter((e) => endOf(e) <= now && !liveIds.has(e.id) && (currentSeason == null || e.season === currentSeason))
        .sort((a, b) => endOf(b) - endOf(a)),
    };
  }, [events, live, now]);

  useEffect(() => {
    if (results.length) void loadFinals(results.map((e) => e.id));
  }, [results, rounds, loadFinals]);

  const match = (e: ProTourEvent) => !q || (e.name ?? "").toLowerCase().includes(q) || (placeOf(e) ?? "").toLowerCase().includes(q);
  const open = (id: number) => navigation.navigate("ProTourTournament", { tournamentId: id });
  const section = (key: string, list: ProTourEvent[]) => (showAll[key] || q ? list : list.slice(0, SHOW));

  const nextSession = (id: number) => {
    const upcoming = (byTournament.get(id) ?? [])
      .filter((m) => matchStatus(m) === "upcoming")
      .map((m) => kickoff(m, timesKnown))
      .filter((k): k is NonNullable<typeof k> => !!k && k.timeKnown && k.date.getTime() > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    return upcoming ? `${dayLabel(upcoming.dayKey)} ${formatTime(upcoming.date)}` : null;
  };
  const todayRounds = (id: number) => {
    const today = dayKeyOf(new Date());
    const ms = (byTournament.get(id) ?? []).filter((m) => matchStatus(m) === "live" || kickoff(m, timesKnown)?.dayKey === today);
    return [...new Set(ms.map(titleFor))];
  };

  // Each followed player's match that matters most right now: live, else next, else latest result.
  const yourPlayers = useMemo(
    () =>
      followed
        .map((id) => {
          const theirs = matches.filter((m) => (m.player1Id === id || m.player2Id === id) && m.player1Id !== m.player2Id);
          const byTime = (a: ProTourMatch, b: ProTourMatch) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
          const liveMatch = theirs.find((m) => matchStatus(m) === "live");
          const next = theirs.filter((m) => matchStatus(m) === "upcoming").sort(byTime)[0];
          const last = theirs.filter((m) => matchStatus(m) === "finished").sort(byTime).reverse()[0];
          return { id, match: liveMatch ?? next ?? last ?? null };
        })
        .sort((a, b) => {
          const rank = (m: ProTourMatch | null) => (!m ? 3 : matchStatus(m) === "live" ? 0 : matchStatus(m) === "upcoming" ? 1 : 2);
          return rank(a.match) - rank(b.match);
        }),
    [followed, matches]
  );
  const describe = (playerId: number, m: ProTourMatch | null) => {
    if (!m) return { line: "No matches in the next few weeks", tone: "muted" as const };
    const opponent = m.player1Id === playerId ? m.player2Id : m.player1Id;
    const mine = m.player1Id === playerId ? m.score1 : m.score2;
    const theirs = m.player1Id === playerId ? m.score2 : m.score1;
    const vs = playerName(players, opponent);
    const t = tournamentName(events, tournamentKey(events[m.eventId], m.eventId), m.eventId);
    const status = matchStatus(m);
    if (status === "live") return { line: `${mine}–${theirs} v ${vs}`, sub: `${t} · ${titleFor(m)}`, tone: "live" as const };
    if (status === "finished") {
      const won = m.winnerId === playerId;
      if (m.walkover) return { line: `${won ? "Walkover v" : "Withdrew v"} ${vs}`, sub: `${t} · ${titleFor(m)}`, tone: won ? ("won" as const) : ("muted" as const) };
      return { line: `${won ? "Beat" : "Lost to"} ${vs} ${mine}–${theirs}`, sub: `${t} · ${titleFor(m)}`, tone: won ? ("won" as const) : ("muted" as const) };
    }
    const k = kickoff(m, timesKnown);
    const when = k ? `${dayLabel(k.dayKey)}${k.timeKnown ? ` ${formatTime(k.date)}` : ""}` : "Date to be confirmed";
    return { line: `${when} v ${vs}`, sub: `${t} · ${titleFor(m)}`, tone: "next" as const };
  };

  const onNowList = onNow.filter(match);
  const comingList = comingUp.filter(match);
  const resultList = results.filter(match);
  const nothing = !onNowList.length && !comingList.length && !resultList.length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading && matches.length > 0} onRefresh={() => refresh(true)} tintColor={colors.primary} />}
    >
      <ProTourFreshness />
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tournaments"
          placeholderTextColor={colors.textSubtle}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {!q && yourPlayers.length ? (
        <View style={styles.block}>
          <SectionTitle title="Your players" />
          <View style={[styles.yours, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {yourPlayers.map(({ id, match: m }, i) => {
              const d = describe(id, m);
              const name = playerName(players, id);
              return (
                <Pressable
                  key={id}
                  onPress={() => (m ? navigation.navigate("ProTourMatch", { matchId: m.id }) : navigation.navigate("ProTourPlayer", { playerId: id }))}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.yourRow,
                    { borderTopColor: colors.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                  ]}
                >
                  <PlayerAvatar name={name} photo={playerPhotoUrl(photos, playerProfiles, id)} size={40} ring={d.tone === "live" ? colors.danger : undefined} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.yourName, { color: colors.text }]}>{name}</Text>
                    <View style={styles.yourLine}>
                      {d.tone === "live" ? <LiveDot size={6} /> : null}
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.yourStatus,
                          { color: d.tone === "live" ? colors.danger : d.tone === "won" || d.tone === "next" ? colors.primary : colors.textMuted },
                        ]}
                      >
                        {d.line}
                      </Text>
                    </View>
                    {d.sub ? <Text numberOfLines={1} style={[styles.yourSub, { color: colors.textSubtle }]}>{d.sub}</Text> : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : !q && onBrowseRankings ? (
        <Pressable
          onPress={onBrowseRankings}
          accessibilityRole="button"
          style={({ pressed }) => [styles.followHint, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="bell-plus-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.yourName, { color: colors.text }]}>Follow your favourite players</Text>
            <Text style={[styles.yourSub, { color: colors.textMuted }]}>Their matches pin here, with a notification when they start and finish.</Text>
          </View>
          <Text style={[styles.hintAction, { color: colors.primary }]}>Rankings</Text>
        </Pressable>
      ) : null}

      {live.length && !q ? (
        <View style={styles.block}>
          <SectionTitle title="Live now" />
          {live.map((m) => {
            const info = roundInfo(rounds, m.eventId, m.round);
            return (
              <LiveMatchCard
                key={m.id}
                match={m}
                players={players}
                photoFor={(id) => playerPhotoUrl(photos, playerProfiles, id)}
                tournament={tournamentName(events, tournamentKey(events[m.eventId], m.eventId), m.eventId)}
                round={titleFor(m)}
                bestOf={info?.bestOf ?? null}
              />
            );
          })}
        </View>
      ) : null}

      {onNowList.length ? (
        <View style={styles.block}>
          <SectionTitle title="On now" />
          {onNowList.map((e) => {
            const status = tournamentStatus(e, live.some((m) => tournamentKey(events[m.eventId], m.eventId) === e.id));
            const liveCount = live.filter((m) => tournamentKey(events[m.eventId], m.eventId) === e.id).length;
            const rounds = todayRounds(e.id);
            const next = nextSession(e.id);
            return (
              <Pressable
                key={e.id}
                onPress={() => open(e.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.featured, { backgroundColor: colors.board, borderColor: colors.boardRule, opacity: pressed ? 0.92 : 1 }]}
              >
                <View style={styles.featuredTop}>
                  <View style={[styles.featuredMark, { backgroundColor: colors.boardRaised }]}>
                    <MaterialCommunityIcons name="trophy-variant" size={22} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.featuredName, { color: colors.boardText }]}>
                      {e.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.featuredMeta, { color: colors.boardMuted }]}>
                      {[formatDateRange(e.startDate, e.endDate), placeOf(e)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.boardMuted} />
                </View>
                <View style={[styles.featuredFacts, { borderTopColor: colors.boardRaised }]}>
                  <Fact label="Stage" value={status.label || "On now"} live={status.tone === "live"} />
                  {rounds.length ? <Fact label="Today" value={rounds.join(" · ")} /> : null}
                  {liveCount ? <Fact label="Live" value={`${liveCount} ${liveCount === 1 ? "match" : "matches"}`} live /> : next ? <Fact label="Next" value={next} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {comingList.length ? (
        <View style={styles.block}>
          <SectionTitle
            title="Coming up"
            action={!q && comingList.length > SHOW ? (showAll.coming ? "Show less" : `All ${comingList.length}`) : undefined}
            onAction={() => setShowAll((s) => ({ ...s, coming: !s.coming }))}
          />
          {section("coming", comingList).map((e) => (
            <TournamentCard
              key={e.id}
              name={e.name ?? "Tournament"}
              dates={formatDateRange(e.startDate, e.endDate)}
              place={placeOf(e)}
              status={tournamentStatus(e, false)}
              onPress={() => open(e.id)}
            />
          ))}
        </View>
      ) : null}

      {resultList.length ? (
        <View style={styles.block}>
          <SectionTitle
            title={season ? `Results ${season}/${String((season + 1) % 100).padStart(2, "0")}` : "Results"}
            action={!q && resultList.length > SHOW ? (showAll.results ? "Show less" : `All ${resultList.length}`) : undefined}
            onAction={() => setShowAll((s) => ({ ...s, results: !s.results }))}
          />
          {section("results", resultList).map((e) => {
            const final = finals[e.id];
            const winner = final?.winnerId;
            const score = final ? (final.winnerId === final.player1Id ? `${final.score1}–${final.score2}` : `${final.score2}–${final.score1}`) : null;
            return (
              <TournamentCard
                key={e.id}
                name={e.name ?? "Tournament"}
                dates={formatDateRange(e.startDate, e.endDate)}
                place={placeOf(e)}
                status={winner ? { label: `Won by ${playerName(players, winner)} ${score}`, tone: "done" } : { label: "Finished", tone: "done" }}
                photo={winner ? playerPhotoUrl(photos, playerProfiles, winner) : null}
                onPress={() => open(e.id)}
              />
            );
          })}
        </View>
      ) : null}

      {nothing ? (
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.xl }} />
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={failed ? "wifi-off" : q ? "magnify" : "billiards-rack"} size={28} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {failed ? "Could not load the tour" : q ? `No tournaments match "${query}"` : "Nothing on the tour yet"}
            </Text>
            {failed ? <Text style={[styles.note, { color: colors.textMuted }]}>Check your connection and pull to refresh.</Text> : null}
          </View>
        )
      ) : null}

      <Text style={[styles.note, { color: colors.textSubtle }]}>
        Times are in your own time zone. Scores and fixtures from snooker.org.
      </Text>
    </ScrollView>
  );
};

const Fact = ({ label, value, live }: { label: string; value: string; live?: boolean }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: colors.boardMuted }]}>{label}</Text>
      <View style={styles.factValueRow}>
        {live ? <LiveDot size={6} /> : null}
        <Text numberOfLines={2} maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.factValue, { color: live ? colors.boardText : colors.boardText }]}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  yours: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  yourRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  yourName: { fontSize: 15, fontWeight: "800" },
  yourLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  yourStatus: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
  yourSub: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  followHint: { flexDirection: "row", alignItems: "center", gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  hintAction: { fontSize: 13, fontWeight: "800" },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2, gap: SPACING.xl },
  search: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: SPACING.sm },
  block: { gap: SPACING.md },
  featured: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.md },
  featuredTop: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  featuredMark: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featuredName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  featuredMeta: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  featuredFacts: { flexDirection: "row", gap: SPACING.md, borderTopWidth: 1, paddingTop: SPACING.md },
  fact: { flex: 1, gap: 3 },
  factLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  factValueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  factValue: { fontFamily: FONTS.board, fontSize: 16, flexShrink: 1 },
  empty: { alignItems: "center", gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  note: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
