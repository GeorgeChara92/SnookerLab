import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { LeaderboardRow } from "../../components/community/LeaderboardRow";
import { BoardRow } from "../../components/community/BoardRow";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { DEFAULT_ROUTINES } from "../../constants/routines";
import {
  GLOBAL_METRICS,
  boardSummaries,
  globalLeaderboard,
  type BoardEntry,
  type BoardSummary,
  type GlobalMetric,
} from "../../features/community/sharedRoutines";
import { nameOf } from "../../features/community/types";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Scope = "everyone" | "friends";

const PODIUM = ["#E3C15A", "#C7CFD6", "#C98A4B"];

/**
 * The all-player leaderboards - level, high break, centuries and wins - for everyone or just
 * friends, with the top three on a podium. Below, every library routine's own board.
 */
export const LeaderboardsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const friendships = useCommunityStore((state) => state.friendships);
  const onBoards = useCommunityStore((state) => state.me?.leaderboards ?? true);
  const friends = useMemo(
    () => [
      ...(me ? [me] : []),
      ...friendships
        .filter((item) => item.status === "accepted")
        .map((item) => (item.requester === me ? item.addressee : item.requester)),
    ],
    [friendships, me]
  );
  const [metric, setMetric] = useState<GlobalMetric>("xp");
  const [scope, setScope] = useState<Scope>("everyone");
  const [entries, setEntries] = useState<BoardEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, BoardSummary> | null>(null);

  useEffect(() => {
    void boardSummaries(me).then(setSummaries);
  }, [me]);

  const load = useCallback(async () => {
    setEntries(await globalLeaderboard(metric, { friends: scope === "friends" ? friends : undefined, limit: 100 }));
  }, [friends, metric, scope]);

  useEffect(() => {
    setEntries(null);
    void load();
  }, [load]);

  const unit = GLOBAL_METRICS.find((item) => item.value === metric)?.unit ?? "";
  const shown = (entry: BoardEntry) => ({
    ...entry,
    raw: metric === "xp" ? `L${entry.profile.level} · ${entry.value.toLocaleString()} ${unit}` : `${entry.value}`,
  });
  const podium = (entries ?? []).slice(0, 3);
  const rest = (entries ?? []).slice(3);
  const mine = entries?.find((entry) => entry.profile.id === me);
  const routines = DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide");

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}
    >
      <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {GLOBAL_METRICS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={metric === option.value}
            onPress={() => setMetric(option.value)}
          />
        ))}
      </View>
      <View
        style={[styles.segments, styles.scope, { backgroundColor: colors.surfaceMuted }]}
        accessibilityRole="tablist"
      >
        <Chip label="Everyone" selected={scope === "everyone"} onPress={() => setScope("everyone")} />
        <Chip label="Friends" selected={scope === "friends"} onPress={() => setScope("friends")} />
      </View>

      {!onBoards ? (
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="eye-off-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>
            You are not on the leaderboards. Turn it on in Community settings to take your place.
          </Text>
        </View>
      ) : null}

      {entries === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.xl }} />
      ) : podium.length ? (
        <BoardPanel
          kicker={GLOBAL_METRICS.find((item) => item.value === metric)?.label.toUpperCase()}
          aside={mine ? `YOU: #${mine.rank}` : undefined}
        >
          <View style={styles.podium}>
            {[1, 0, 2].map((place) => {
              const entry = podium[place];
              if (!entry) return <View key={place} style={styles.step} />;
              const first = place === 0;
              return (
                <Pressable
                  key={entry.profile.id}
                  onPress={() => navigation.navigate("PlayerProfile", { userId: entry.profile.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.rank}. ${nameOf(entry.profile)}, ${shown(entry).raw}`}
                  style={[styles.step, first ? styles.stepFirst : null]}
                >
                  {first ? <MaterialCommunityIcons name="crown" size={22} color={PODIUM[0]} /> : null}
                  <View style={[styles.podiumRing, { borderColor: PODIUM[place] }]}>
                    <CommunityAvatar profile={entry.profile} size={first ? 64 : 50} />
                  </View>
                  <Text style={[styles.podiumName, { color: colors.boardText }]} numberOfLines={1}>
                    {entry.profile.id === me ? "You" : nameOf(entry.profile)}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.podiumValue, { color: PODIUM[place] }]}
                  >
                    {metric === "xp" ? `L${entry.profile.level}` : entry.value}
                  </Text>
                  <View
                    style={[
                      styles.plinth,
                      { height: first ? 34 : place === 1 ? 24 : 16, backgroundColor: PODIUM[place] },
                    ]}
                  >
                    <Text style={styles.plinthText}>{entry.rank}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </BoardPanel>
      ) : (
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="podium" size={18} color={colors.textMuted} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>
            {scope === "friends" ? "No friends on this board yet." : "Nobody on this board yet."}
          </Text>
        </View>
      )}
    </View>
  );

  // The busiest few routine boards; every board is one tap away, searchable.
  const busiest = routines
    .filter((routine) => (summaries?.[routine.id]?.players ?? 0) > 0)
    .sort((x, y) => (summaries?.[y.id]?.players ?? 0) - (summaries?.[x.id]?.players ?? 0))
    .slice(0, 4);
  const placesHeld = routines.filter((routine) => summaries?.[routine.id]?.myRank).length;

  const footer = (
    <View style={styles.footer}>
      <View style={styles.footerHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Routine leaderboards</Text>
        <Pressable onPress={() => navigation.navigate("RoutineBoards")} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>
      {busiest.length ? (
        <View style={[styles.boardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.boardCardTitle, { color: colors.textMuted }]}>MOST PLAYED</Text>
          {busiest.map((routine, index) => (
            <BoardRow
              key={routine.id}
              first={index === 0}
              icon={routine.icon ?? "🎱"}
              name={routine.name}
              summary={summaries?.[routine.id]}
              onPress={() => navigation.navigate("RoutineLeaderboard", { routineKey: routine.id, name: routine.name })}
            />
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={() => navigation.navigate("RoutineBoards")}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.browse,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <MaterialCommunityIcons name="format-list-numbered" size={22} color={colors.primary} />
        <View style={styles.browseText}>
          <Text style={[styles.routineName, { color: colors.text }]}>All {routines.length} routine boards</Text>
          <Text style={[styles.noteText, { color: colors.textMuted }]}>
            {placesHeld ? `You are on ${placesHeld}. ` : ""}Search, or filter by category.
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={rest}
      keyExtractor={(entry) => entry.profile.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={() => <View style={{ height: SPACING.xs }} />}
      renderItem={({ item }) => (
        <LeaderboardRow
          entry={shown(item)}
          isMe={item.profile.id === me}
          onPress={() => navigation.navigate("PlayerProfile", { userId: item.profile.id })}
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { gap: SPACING.md, marginBottom: SPACING.md },
  segments: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  scope: { alignSelf: "center", width: 220 },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  segmentText: { fontSize: 13, fontWeight: "700" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  step: { flex: 1, alignItems: "center", gap: 4 },
  stepFirst: { marginBottom: 0 },
  podiumRing: { borderWidth: 3, borderRadius: 999, padding: 2 },
  podiumName: { fontSize: 13, fontWeight: "800", maxWidth: "100%" },
  podiumValue: { fontFamily: FONTS.boardHeavy, fontSize: 20 },
  plinth: {
    alignSelf: "stretch",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  plinthText: { fontFamily: FONTS.boardHeavy, fontSize: 14, color: "#1A1405" },
  footer: { gap: SPACING.sm, marginTop: SPACING.xl },
  footerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll: { fontSize: 15, fontWeight: "800" },
  boardCard: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden", paddingTop: SPACING.sm },
  boardCardTitle: {
    fontFamily: FONTS.boardLabel,
    fontSize: 12,
    letterSpacing: 1.2,
    paddingHorizontal: SPACING.md,
    marginBottom: 2,
  },
  browse: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 12,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  browseText: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 6,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  routineIcon: { fontSize: 20 },
  routineName: { flex: 1, fontSize: 15, fontWeight: "700" },
});
