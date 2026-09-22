import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { HeaderIconButton } from "../../navigation/stackOptions";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useChatStore } from "../../store/chatStore";
import { GroupBadge } from "../../components/community/GroupBadge";
import { nameOf, type PublicProfile } from "../../features/community/types";
import {
  declineGroupInvite,
  discoverGroups,
  joinGroup,
  myGroupInvites,
  myGroups,
  type Group,
  type GroupRole,
} from "../../features/community/chat";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Groups: the ones the player is in, invites waiting for them, and public groups to find and
 * join. Creating one is a button away.
 */
export const GroupsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const refreshInbox = useChatStore((state) => state.refresh);
  const [mine, setMine] = useState<Array<Group & { role: GroupRole }> | null>(null);
  const [invites, setInvites] = useState<Array<{ group: Group; invitedBy: PublicProfile | null }>>([]);
  const [found, setFound] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMine = useCallback(async () => {
    if (!me) return;
    const [groups, waiting] = await Promise.all([myGroups(me), myGroupInvites(me)]);
    setMine(groups);
    setInvites(waiting);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      void loadMine();
    }, [loadMine])
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => setFound(await discoverGroups(query)), query ? 300 : 0);
  }, [query]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          icon="plus-circle-outline"
          size={24}
          color={colors.primary}
          label="Create a group"
          onPress={() => navigation.navigate("GroupForm", {})}
        />
      ),
    });
  }, [colors.primary, navigation]);

  const join = async (group: Group) => {
    setBusy(group.id);
    const result = await joinGroup(group.id);
    setBusy(null);
    if (result.ok) {
      await Promise.all([loadMine(), refreshInbox()]);
      navigation.navigate("Group", { groupId: group.id });
    }
  };

  const memberIds = new Set((mine ?? []).map((group) => group.id));
  const discover = found.filter((group) => !memberIds.has(group.id));

  const GroupRow = ({ group, right, sub }: { group: Group; right?: React.ReactNode; sub?: string }) => (
    <Pressable
      onPress={() => navigation.navigate("Group", { groupId: group.id })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
    >
      <GroupBadge group={group} size={46} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {sub ??
            `${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}${group.visibility === "invite" ? " · invite only" : ""}`}
        </Text>
      </View>
      {right ?? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />}
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([loadMine(), discoverGroups(query).then(setFound)]);
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
    >
      {invites.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Text style={[styles.title, { color: colors.primary }]}>INVITES</Text>
          {invites.map(({ group, invitedBy }) => (
            <GroupRow
              key={group.id}
              group={group}
              sub={invitedBy ? `From ${nameOf(invitedBy)}` : undefined}
              right={
                busy === group.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <View style={styles.pair}>
                    <Pressable
                      onPress={async () => {
                        if (!me) return;
                        await declineGroupInvite(group.id, me);
                        void loadMine();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${group.name}`}
                      style={[styles.round, { backgroundColor: colors.surfaceMuted }]}
                    >
                      <MaterialCommunityIcons name="close" size={18} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => join(group)}
                      accessibilityRole="button"
                      accessibilityLabel={`Join ${group.name}`}
                      style={[styles.round, { backgroundColor: colors.primary }]}
                    >
                      <MaterialCommunityIcons name="check" size={18} color={colors.onPrimary} />
                    </Pressable>
                  </View>
                )
              }
            />
          ))}
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your groups</Text>
      {mine === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : mine.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {mine.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              sub={`${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}${group.role !== "member" ? ` · ${group.role}` : ""}`}
            />
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => navigation.navigate("GroupForm", {})}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.create,
            { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons name="account-multiple-plus-outline" size={26} color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: colors.text }]}>Start a group</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Your club, your league team, your practice partners.
            </Text>
          </View>
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Find groups</Text>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search public groups"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>
      {discover.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {discover.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              right={
                busy === group.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Pressable
                    onPress={() => join(group)}
                    accessibilityRole="button"
                    accessibilityLabel={`Join ${group.name}`}
                    style={[styles.join, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.joinText, { color: colors.onPrimary }]}>Join</Text>
                  </Pressable>
                )
              }
            />
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {query.trim().length >= 2 ? "No public groups match." : "No public groups yet. Start the first."}
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.xs },
  title: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: SPACING.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 16,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 13 },
  pair: { flexDirection: "row", gap: SPACING.sm },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  create: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 2,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: SPACING.sm },
  join: { minHeight: 32, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, justifyContent: "center" },
  joinText: { fontSize: 13, fontWeight: "800" },
  empty: { fontSize: 14, textAlign: "center", marginTop: SPACING.md },
});
