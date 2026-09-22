import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { LeaderboardRow } from "../../components/community/LeaderboardRow";
import { routineLeaderboard, type BoardEntry } from "../../features/community/sharedRoutines";
import { RADIUS, SPACING } from "../../constants";

/**
 * One routine's leaderboard in full: every player's best, for everyone, friends, or a group's
 * members when opened from the group. Lives
 * in both the Practice and Community tabs, so players open on whichever tab the player is in.
 */
export const RoutineLeaderboardScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { routineKey, name, group } = route.params as {
    routineKey: string;
    name: string;
    group?: { name: string; memberIds: string[] };
  };
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const friendships = useCommunityStore((state) => state.friendships);
  const friends = useMemo(
    () => [
      ...(me ? [me] : []),
      ...friendships
        .filter((item) => item.status === "accepted")
        .map((item) => (item.requester === me ? item.addressee : item.requester)),
    ],
    [friendships, me]
  );
  const [scope, setScope] = useState<"everyone" | "friends" | "group">(group ? "group" : "everyone");
  const scopes = group ? (["group", "friends", "everyone"] as const) : (["everyone", "friends"] as const);
  const [entries, setEntries] = useState<BoardEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [name, navigation]);

  const load = useCallback(async () => {
    const result = await routineLeaderboard(routineKey, {
      friends: scope === "friends" ? friends : scope === "group" ? group?.memberIds : undefined,
      limit: 200,
    });
    setEntries(result.entries);
  }, [friends, group?.memberIds, routineKey, scope]);

  useEffect(() => {
    setEntries(null);
    void load();
  }, [load]);

  // The player's profile opens on the Community tab from anywhere.
  const openPlayer = (userId: string) => {
    const routes: string[] = navigation.getState?.()?.routeNames ?? [];
    if (routes.includes("PlayerProfile")) navigation.navigate("PlayerProfile", { userId });
    else navigation.navigate("Community", { screen: "PlayerProfile", params: { userId } });
  };

  const mine = entries?.find((entry) => entry.profile.id === me);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={entries ?? []}
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
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
            {scopes.map((option) => {
              const selected = scope === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setScope(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}
                >
                  <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
                    {option === "everyone" ? "Everyone" : option === "friends" ? "Friends" : "Group"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {mine ? (
            <Text style={[styles.summary, { color: colors.textMuted }]}>
              You are {mine.rank === 1 ? "top of the board" : `#${mine.rank} of ${entries?.length}`} with {mine.raw}.
            </Text>
          ) : entries?.length ? (
            <Text style={[styles.summary, { color: colors.textMuted }]}>
              Record a score on this routine to join the board.
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        entries === null ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.xl }} />
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="podium" size={30} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {scope === "friends" ? "None of your friends have a score on this yet." : "No scores yet. Be the first."}
            </Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: SPACING.xs }} />}
      renderItem={({ item }) => (
        <LeaderboardRow entry={item} isMe={item.profile.id === me} onPress={() => openPlayer(item.profile.id)} />
      )}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, flexGrow: 1 },
  header: { gap: SPACING.md, marginBottom: SPACING.md },
  segments: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3, alignSelf: "center", width: 240 },
  segment: { flex: 1, minHeight: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 14, fontWeight: "700" },
  summary: { fontSize: 14, textAlign: "center" },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl },
  emptyText: { fontSize: 14, textAlign: "center" },
});
