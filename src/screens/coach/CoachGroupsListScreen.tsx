import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { groupMembers, latestGroupPosts } from "../../features/coach/groups";
import type { CoachGroupPost } from "../../features/coach/types";
import { ClientAvatar, agoLabel } from "../../components/coach/CoachUI";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";

const STACK = 4;

const postKind = (post: CoachGroupPost) => (post.mediaType === "video" ? "a video" : post.mediaType === "pdf" ? "a PDF" : "an image");

/** A coach's own broadcast groups: who's in each and what was posted last. The groups themselves
 * load with the rest of coach mode (see coachStore.hydrate), so the list paints from cache at once;
 * members and the latest post fill in on top. */
export const CoachGroupsListScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const {
    myCoachGroups: groups,
    loaded,
    refreshMyCoachGroups,
  } = useCoachStore(
    useShallow((state) => ({
      myCoachGroups: state.myCoachGroups,
      loaded: state.loaded,
      refreshMyCoachGroups: state.refreshMyCoachGroups,
    })),
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [latest, setLatest] = useState<Record<string, CoachGroupPost>>({});

  useFocusEffect(
    useCallback(() => {
      void refreshMyCoachGroups();
    }, [refreshMyCoachGroups]),
  );

  // Who's in each group and its newest post, whenever the list of groups changes.
  const groupIds = groups.map((group) => group.id).join(",");
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const ids = groupIds ? groupIds.split(",") : [];
      void Promise.all([Promise.all(ids.map((id) => groupMembers(id))), latestGroupPosts(ids)]).then(([memberLists, posts]) => {
        if (cancelled) return;
        setMembers(Object.fromEntries(ids.map((id, index) => [id, memberLists[index].map((member) => member.playerId)])));
        const newest: Record<string, CoachGroupPost> = {};
        for (const post of posts) if (!newest[post.groupId]) newest[post.groupId] = post;
        setLatest(newest);
      });
      return () => {
        cancelled = true;
      };
    }, [groupIds]),
  );

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={groups}
      keyExtractor={(group) => group.id}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
      ListEmptyComponent={
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.board }]}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={28} color={colors.boardRule} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Coach a squad at once</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Put clients in a group to post a drill video, image or PDF to all of them in one go.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const ids = members[item.id];
        const post = latest[item.id];
        const count = ids?.length ?? null;
        return (
          <Pressable
            onPress={() =>
              navigation.navigate("CoachGroup", {
                groupId: item.id,
                groupName: item.name,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`${item.name}${count != null ? `, ${count} member${count === 1 ? "" : "s"}` : ""}`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.board,
                  borderColor: colors.boardRule,
                },
              ]}
            >
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.badgeText, { color: colors.boardText }]}>
                {item.name.trim().charAt(0).toUpperCase() || "G"}
              </Text>
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {count == null ? " " : `${count} member${count === 1 ? "" : "s"}`}
                {count != null ? (post ? ` · posted ${postKind(post)} ${agoLabel(post.createdAt)}` : " · nothing posted yet") : ""}
              </Text>
              {ids?.length ? (
                <View style={styles.stack}>
                  {ids.slice(0, STACK).map((id, index) => (
                    <View
                      key={id}
                      style={[
                        styles.stackItem,
                        {
                          marginLeft: index ? -8 : 0,
                          borderColor: colors.surface,
                        },
                      ]}
                    >
                      <ClientAvatar profile={profiles[id]} size={24} />
                    </View>
                  ))}
                  {ids.length > STACK ? <Text style={[styles.more, { color: colors.textMuted }]}>+{ids.length - STACK}</Text> : null}
                </View>
              ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        );
      }}
      ListFooterComponent={
        <Pressable
          onPress={() => navigation.navigate("CoachGroupForm")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.newGroup, { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
          <Text style={[styles.newGroupText, { color: colors.primary }]}>New group</Text>
        </Pressable>
      }
    />
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: SPACING.lg, gap: SPACING.sm, flexGrow: 1 },
  empty: {
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: HIT_TARGET + 24,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: FONTS.boardHeavy, fontSize: 26, lineHeight: 28 },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowName: { fontSize: 16, fontWeight: "800" },
  rowMeta: { fontSize: 13 },
  stack: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  stackItem: { borderWidth: 2, borderRadius: 14 },
  more: { fontSize: 12, fontWeight: "700", marginLeft: 6 },
  newGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  newGroupText: { fontSize: 15, fontWeight: "700" },
});
