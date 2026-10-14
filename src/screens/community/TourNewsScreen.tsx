import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { CommunityStackParamList } from "../../types";
import { useTourNewsStore } from "../../store/tourNewsStore";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import { LeadStory, NewsRow } from "../../components/tour/NewsRow";
import { ProTourMatchRow } from "../../components/tour/ProTourMatchRow";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { groupMatchesByTournament, playerName, type ProTourRankingRow } from "../../features/tour/liveScores";
import type { NewsSource } from "../../features/tour/news";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

const FILTERS: Array<{ value: NewsSource | "all"; label: string }> = [
  { value: "all", label: "ALL" },
  { value: "wst", label: "WST" },
  { value: "bbc", label: "BBC SPORT" },
];

const SEGMENTS: Array<{ value: "news" | "live" | "rankings"; label: string }> = [
  { value: "news", label: "NEWS" },
  { value: "live", label: "LIVE & RESULTS" },
  { value: "rankings", label: "RANKINGS" },
];

/**
 * The pro tour: news from the World Snooker Tour and BBC Sport on one segment, live scores,
 * upcoming fixtures and recent results from snooker.org on the second, the money rankings on
 * the third.
 */
export const TourNewsScreen = () => {
  const { colors } = useAppTheme();
  const route = useRoute<RouteProp<CommunityStackParamList, "TourNews">>();
  const [segment, setSegment] = useState<"news" | "live" | "rankings">(route.params?.segment ?? "news");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.segments, { backgroundColor: colors.board, borderColor: colors.boardRule }]} accessibilityRole="tablist">
        {SEGMENTS.map((option) => {
          const selected = option.value === segment;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSegment(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.segment, { backgroundColor: selected ? colors.boardRaised : "transparent" }]}
            >
              <Text
                maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                style={[styles.segmentText, { color: selected ? colors.boardRule : colors.boardMuted }]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {segment === "news" ? <TourNewsList /> : segment === "live" ? <TourLiveList /> : <TourRankingsList />}
    </View>
  );
};

/** Live scores, upcoming fixtures and recent results, from snooker.org via poll-pro-tour, one
 *  tournament at a time (an event's qualifying groups/stages are merged under their parent). */
const TourLiveList = () => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { matches, players, events, roundNames, loading, failed } = useProTourStore();
  const tournaments = useMemo(() => groupMatchesByTournament(matches, events), [matches, events]);

  useEffect(() => subscribeProTourLive(), []);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={tournaments}
      keyExtractor={(tournament) => String(tournament.tournamentId)}
      renderItem={({ item: tournament }) => {
        const total = tournament.live.length + tournament.upcoming.length + tournament.finished.length;
        const rows = [...tournament.live, ...tournament.upcoming.slice(0, 5), ...tournament.finished.slice(0, 5)];
        const more = total - rows.length;
        const aside = [tournament.venue, tournament.country].filter(Boolean).join(", ") || undefined;
        return (
          <View style={styles.section}>
            {tournament.hasLive ? (
              <View style={styles.liveTag}>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.liveText, { color: colors.danger }]}>LIVE NOW</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => navigation.navigate("ProTourTournament", { tournamentId: tournament.tournamentId })}
              accessibilityRole="button"
              accessibilityLabel={`${tournament.name}. Open the full tournament.`}
            >
              <BoardPanel kicker={tournament.name} aside={aside}>
                <View style={styles.matchList}>
                  {rows.map((match) => (
                    <ProTourMatchRow key={match.id} match={match} players={players} roundNames={roundNames} />
                  ))}
                </View>
                {more > 0 ? (
                  <Text style={[styles.seeAll, { color: colors.boardRule }]}>
                    See all {total} fixtures →
                  </Text>
                ) : null}
              </BoardPanel>
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons
              name={failed ? "wifi-off" : "billiards-rack"}
              size={28}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {failed ? "Could not load live scores" : "Nothing from the tour right now"}
            </Text>
            <Text style={[styles.note, { color: colors.textMuted }]}>
              {failed ? "Check your connection and try again shortly." : "Check back when a tournament is on."}
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        tournaments.length ? (
          <Text style={[styles.note, styles.footer, { color: colors.textSubtle }]}>
            Scores and fixtures from snooker.org. Tap a match for the World Snooker Tour match centre, or a player's
            name for their profile.
          </Text>
        ) : null
      }
    />
  );
};

/** The money rankings for the latest season poll-pro-tour has cached. */
const TourRankingsList = () => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { players, rankingsBySeason, loading, failed } = useProTourStore();

  useEffect(() => subscribeProTourLive(), []);

  const seasons = useMemo(() => Object.keys(rankingsBySeason).map(Number).sort((a, b) => b - a), [rankingsBySeason]);
  const [season, setSeason] = useState<number | null>(null);
  const activeSeason = season ?? seasons[0] ?? null;
  const rows = activeSeason != null ? rankingsBySeason[activeSeason] ?? [] : [];

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => String(row.playerId)}
      ListHeaderComponent={
        <View style={styles.rankHead}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.rankHeadKicker, { color: colors.boardRule }]}>
            MONEY RANKINGS
          </Text>
          {seasons.length > 1 ? (
            <View style={styles.rankSeasons} accessibilityRole="tablist">
              {seasons.map((value) => {
                const selected = value === activeSeason;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setSeason(value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                      style={[styles.rankHeadSeason, { color: selected ? colors.boardRule : colors.textMuted }]}
                    >
                      {value}/{(value + 1) % 100}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : activeSeason != null ? (
            <Text style={[styles.rankHeadSeason, { color: colors.textMuted }]}>
              {activeSeason}/{(activeSeason + 1) % 100}
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item, index }: { item: ProTourRankingRow; index: number }) => (
        <Pressable
          onPress={() => navigation.navigate("ProTourPlayer", { playerId: item.playerId })}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.rankRow,
            { backgroundColor: index % 2 === 0 ? colors.board : colors.boardRaised, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.rankPosition, { color: colors.boardRule }]}>
            {item.position}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.rankName, { color: colors.boardText }]} numberOfLines={1}>
            {playerName(players, item.playerId).toUpperCase()}
          </Text>
          {item.sum != null ? (
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.rankSum, { color: colors.boardMuted }]}>
              £{item.sum.toLocaleString()}
            </Text>
          ) : null}
        </Pressable>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={failed ? "wifi-off" : "trophy-outline"} size={28} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {failed ? "Could not load rankings" : "Rankings aren't in yet"}
            </Text>
            <Text style={[styles.note, { color: colors.textMuted }]}>Check back shortly.</Text>
          </View>
        )
      }
    />
  );
};

const TourNewsList = () => {
  const { colors } = useAppTheme();
  const { items, loading, failed, refresh } = useTourNewsStore();
  const [filter, setFilter] = useState<NewsSource | "all">("all");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.source === filter)),
    [filter, items]
  );
  const [lead, ...rest] = shown;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={rest}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={loading && items.length > 0}
          onRefresh={() => refresh(true)}
          tintColor={colors.primary}
        />
      }
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((option) => {
              const selected = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[
                    styles.filter,
                    {
                      backgroundColor: selected ? colors.board : colors.surface,
                      borderColor: selected ? colors.boardRule : colors.border,
                    },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.filterText, { color: selected ? colors.boardText : colors.text }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {lead ? <LeadStory item={lead} /> : null}
          {!items.length && loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
          {!items.length && !loading && failed ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="wifi-off" size={28} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>Could not load the news</Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                Check your connection and pull to try again.
              </Text>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <NewsRow item={item} />}
      ListFooterComponent={
        items.length ? (
          <Text style={[styles.note, styles.footer, { color: colors.textSubtle }]}>
            Stories from World Snooker Tour and BBC Sport. Tap one to read it on their website.
          </Text>
        ) : null
      }
    />
  );
};

const styles = StyleSheet.create({
  segments: { flexDirection: "row", gap: SPACING.sm, padding: SPACING.lg, paddingBottom: 0 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1 },
  section: { gap: SPACING.sm, marginBottom: SPACING.lg },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: SPACING.xs, marginLeft: SPACING.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  matchList: { gap: 1 },
  seeAll: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.6, marginTop: SPACING.sm, textAlign: "center" },
  rankHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  rankHeadKicker: { fontFamily: FONTS.board, fontSize: 16, letterSpacing: 2 },
  rankSeasons: { flexDirection: "row", gap: SPACING.md },
  rankHeadSeason: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 0.8 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  rankPosition: { width: 26, fontFamily: FONTS.board, fontSize: 16, textAlign: "right" },
  rankName: { flex: 1, fontFamily: FONTS.boardLabel, fontSize: 15, letterSpacing: 0.4 },
  rankSum: { fontFamily: FONTS.board, fontSize: 15, fontVariant: ["tabular-nums"] },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  header: { gap: SPACING.md, marginBottom: SPACING.lg },
  filters: { flexDirection: "row", gap: SPACING.sm },
  filter: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    minHeight: 36,
    justifyContent: "center",
  },
  filterText: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1 },
  loading: { marginTop: SPACING.xl },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.md },
  empty: { alignItems: "center", gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyText: { fontSize: 16, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  footer: { marginTop: SPACING.xl },
});
