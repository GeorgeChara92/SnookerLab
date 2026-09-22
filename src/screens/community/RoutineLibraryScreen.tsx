import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { SharedRoutineCard } from "../../components/community/SharedRoutineCard";
import {
  listSharedRoutines,
  myReactions,
  type LibraryView,
  type SharedRoutine,
} from "../../features/community/sharedRoutines";
import type { CommunityStackParamList } from "../../types";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const VIEWS: Array<{ value: LibraryView; label: string }> = [
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "friends", label: "Friends" },
  { value: "mine", label: "Mine" },
];

/**
 * Routines players have shared: the most liked, the newest, friends', and the player's own.
 * Search by name. Sharing starts from one of the player's own routines, on the Practice tab.
 */
export const RoutineLibraryScreen = () => {
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const friendships = useCommunityStore((state) => state.friendships);
  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.status === "accepted")
        .map((item) => (item.requester === me ? item.addressee : item.requester)),
    [friendships, me]
  );
  const [view, setView] = useState<LibraryView>("top");
  const [query, setQuery] = useState("");
  const [routines, setRoutines] = useState<SharedRoutine[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listSharedRoutines(view, { me, friends, query });
    setRoutines(list);
    setLiked((await myReactions(list.map((item) => item.id))).liked);
    setLoading(false);
  }, [friends, me, query, view]);

  // A moment after the search changes; straight away for the tabs.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), query ? 300 : 0);
  }, [load, query]);

  // Coming back from a routine, its likes may have changed.
  const latestLoad = useRef(load);
  latestLoad.current = load;
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // The first focus is the first load, already under way.
      if (focused.current) void latestLoad.current();
      focused.current = true;
    }, [])
  );

  const empty = {
    top: {
      title: "No shared routines yet",
      body: "Be the first: share one of your own routines from the Practice tab.",
    },
    new: { title: "Nothing new", body: "Routines appear here as players share them." },
    friends: {
      title: friends.length ? "Your friends have not shared any" : "Add friends to see theirs",
      body: friends.length ? "Their shared routines will show here." : "Routines your friends share show here.",
    },
    mine: {
      title: "You have not shared any routines",
      body: "Open one of your own routines in Practice and choose Share to community.",
    },
  }[view];

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={routines}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={loading && routines.length > 0} onRefresh={load} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search routines"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
            {VIEWS.map((option) => {
              const selected = option.value === view;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setView(option.value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}
                >
                  <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.xl }} />
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="table-furniture" size={30} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{empty.title}</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{empty.body}</Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      renderItem={({ item, index }) => (
        <SharedRoutineCard
          routine={item}
          rank={view === "top" && !query && item.likes > 0 ? index + 1 : undefined}
          liked={liked.has(item.id)}
          onPress={() => navigation.navigate("SharedRoutine", { id: item.id })}
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, flexGrow: 1 },
  header: { gap: SPACING.md, marginBottom: SPACING.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: SPACING.sm },
  segments: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
