import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useChatStore } from "../../store/chatStore";
import { useCommunityStore } from "../../store/communityStore";
import { useDialog } from "../../components/ui/DialogProvider";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { GroupBadge } from "../../components/community/GroupBadge";
import { ReportSheet } from "../../components/community/ReportSheet";
import { FeedItemRow } from "../../components/community/FeedItemRow";
import { GroupBoards } from "../../components/community/GroupBoards";
import { loadFeed, type FeedItem } from "../../features/community/groupFeed";
import { nameOf, type PublicProfile } from "../../features/community/types";
import {
  getGroup,
  inviteToGroup,
  joinGroup,
  leaveGroup,
  setGroupRole,
  type Group,
  type GroupMember,
} from "../../features/community/chat";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

type Tab = "feed" | "boards" | "members";

/**
 * A group: who it is, its chat, and three tabs - the feed of what members have done, the
 * group's leaderboards and pinned routines, and the members and their roles. Members invite
 * friends (if the group lets them); the owner and admins run it; anyone can report it or leave.
 */
export const GroupScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { groupId } = route.params as { groupId: string };
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const refreshInbox = useChatStore((state) => state.refresh);
  const { friendships, profiles } = useCommunityStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [moreFeed, setMoreFeed] = useState(false);

  const load = useCallback(async () => {
    const info = await getGroup(groupId);
    setGroup(info?.group ?? null);
    setMembers(info?.members ?? []);
    setConversationId(info?.conversationId ?? null);
    setLoading(false);
    const ids = (info?.members ?? []).map((member) => member.profile.id);
    const items = await loadFeed(ids);
    setFeed(items);
    setMoreFeed(items.length >= 30);
    if (info) navigation.setOptions({ title: info.group.name });
  }, [groupId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const myRole = members.find((member) => member.profile.id === me)?.role ?? null;
  const runs = myRole === "owner" || myRole === "admin";
  const canInvite = myRole !== null && (group?.whoCanInvite === "everyone" || runs);
  const memberIds = useMemo(() => members.map((member) => member.profile.id), [members]);
  const byId = useMemo(
    () => Object.fromEntries(members.map((member) => [member.profile.id, member.profile])),
    [members]
  );

  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.status === "accepted")
        .map((item) => profiles[item.requester === me ? item.addressee : item.requester])
        .filter((profile): profile is PublicProfile => Boolean(profile))
        .filter((profile) => !members.some((member) => member.profile.id === profile.id))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    [friendships, me, members, profiles]
  );

  if (!group) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.textMuted }}>This group is not available.</Text>
        )}
      </View>
    );
  }

  const run = async (task: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok)
      dialog.alert({ title: "That did not work", message: result.message ?? "Try again.", tone: "danger" });
    await Promise.all([load(), refreshInbox()]);
    return result.ok;
  };

  const join = () => run(() => joinGroup(groupId));

  const leave = () =>
    dialog.confirm({
      title: `Leave ${group.name}?`,
      message:
        myRole === "owner"
          ? "Hand the group to another member first: owners cannot leave. Or delete it in settings."
          : "You leave its chat too. You can join again if it is public, or be invited back.",
      tone: "danger",
      icon: "logout",
      confirmLabel: myRole === "owner" ? "OK" : "Leave",
      cancelLabel: "Stay",
      onConfirm: async () => {
        if (myRole === "owner" || !me) return;
        const ok = await run(() => leaveGroup(groupId, me));
        if (ok) navigation.goBack();
      },
    });

  const manage = (member: GroupMember) => {
    if (!runs || member.profile.id === me || member.role === "owner") {
      navigation.navigate("PlayerProfile", { userId: member.profile.id });
      return;
    }
    const name = nameOf(member.profile);
    if (myRole === "owner") {
      dialog.choose({
        title: name,
        message:
          member.role === "admin"
            ? "An admin can change settings, invite and remove members."
            : "What would you like to do?",
        icon: "account-cog-outline",
        confirmLabel: member.role === "admin" ? "Make a member" : "Make an admin",
        secondaryLabel: "Remove from group",
        cancelLabel: "Cancel",
        onConfirm: () =>
          run(() => setGroupRole(groupId, member.profile.id, member.role === "admin" ? "member" : "admin")),
        onSecondary: () => run(() => leaveGroup(groupId, member.profile.id)),
      });
    } else if (member.role === "member") {
      dialog.confirm({
        title: `Remove ${name}?`,
        message: "They leave the group and its chat.",
        tone: "danger",
        icon: "account-remove-outline",
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        onConfirm: () => run(() => leaveGroup(groupId, member.profile.id)),
      });
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={styles.hero}>
        <GroupBadge group={group} size={92} />
        <Text style={[styles.name, { color: colors.text }]}>{group.name}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"} ·{" "}
          {group.visibility === "public" ? "Public" : "Invite only"}
          {group.whoCanPost === "admins" ? " · admins post" : ""}
        </Text>
        {group.description ? (
          <Text style={[styles.description, { color: colors.text }]}>{group.description}</Text>
        ) : null}
      </View>

      {myRole ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => conversationId && navigation.navigate("Chat", { conversationId })}
            disabled={!conversationId}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name="chat-outline" size={20} color={colors.onPrimary} />
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Open chat</Text>
          </Pressable>
          <View style={styles.row}>
            {canInvite ? (
              <Pressable
                onPress={() => setInviting(true)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryText, { color: colors.text }]}>Invite</Text>
              </Pressable>
            ) : null}
            {runs ? (
              <Pressable
                onPress={() => navigation.navigate("GroupForm", { groupId })}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="cog-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryText, { color: colors.text }]}>Settings</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable
          onPress={join}
          disabled={busy || group.visibility === "invite"}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: colors.primary,
              opacity: busy || group.visibility === "invite" ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : null}
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>
            {group.visibility === "invite" ? "Invite only" : "Join group"}
          </Text>
        </Pressable>
      )}

      <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {(["feed", "boards", "members"] as const).map((option) => {
          const selected = tab === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTab(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected ? { backgroundColor: colors.surface } : null]}
            >
              <Text style={[styles.tabText, { color: selected ? colors.text : colors.textMuted }]} numberOfLines={1}>
                {option === "feed" ? "Feed" : option === "boards" ? "Boards" : `Members · ${members.length}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "feed" ? (
        !myRole ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Join the group to see what its members have been up to.
          </Text>
        ) : feed === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : feed.length === 0 ? (
          <View style={[styles.emptyFeed, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="newspaper-variant-outline" size={28} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing yet</Text>
            <Text style={[styles.note, styles.centreText, { color: colors.textMuted }]}>
              Wins, centuries, new personal bests and level-ups by members show up here as they happen.
            </Text>
          </View>
        ) : (
          <View style={styles.feed}>
            {feed.map((item) => (
              <FeedItemRow
                key={item.id}
                item={item}
                profile={byId[item.userId]}
                isMe={item.userId === me}
                onOpenPlayer={() => navigation.navigate("PlayerProfile", { userId: item.userId })}
              />
            ))}
            {moreFeed ? (
              <Pressable
                onPress={async () => {
                  const older = await loadFeed(memberIds, feed[feed.length - 1].createdAt);
                  setMoreFeed(older.length >= 30);
                  setFeed((prev) => [...(prev ?? []), ...older]);
                }}
                accessibilityRole="button"
                style={styles.more}
              >
                <Text style={[styles.moreText, { color: colors.primary }]}>Show older</Text>
              </Pressable>
            ) : null}
          </View>
        )
      ) : null}

      {tab === "boards" ? (
        <GroupBoards
          groupId={groupId}
          groupName={group.name}
          memberIds={memberIds}
          me={me}
          canPin={runs}
          onOpenPlayer={(userId) => navigation.navigate("PlayerProfile", { userId })}
          onOpenBoard={(routineKey, name) =>
            navigation.navigate("RoutineLeaderboard", { routineKey, name, group: { name: group.name, memberIds } })
          }
        />
      ) : null}

      {tab === "members" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {members.map((member, index) => (
            <Pressable
              key={member.profile.id}
              onPress={() => manage(member)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.member,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                { backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
              ]}
            >
              <CommunityAvatar profile={member.profile} size={38} />
              <View style={styles.memberText}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {member.profile.id === me ? "You" : nameOf(member.profile)}
                </Text>
                {member.profile.handle ? (
                  <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                    @{member.profile.handle}
                  </Text>
                ) : null}
              </View>
              {member.role !== "member" ? (
                <View
                  style={[
                    styles.role,
                    { backgroundColor: member.role === "owner" ? colors.board : colors.surfaceMuted },
                  ]}
                >
                  <Text style={[styles.roleText, { color: member.role === "owner" ? colors.boardRule : colors.text }]}>
                    {member.role === "owner" ? "Owner" : "Admin"}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        {myRole ? (
          <Pressable onPress={leave} accessibilityRole="button" style={styles.footerButton} hitSlop={6}>
            <MaterialCommunityIcons name="logout" size={18} color={colors.textMuted} />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>Leave group</Text>
          </Pressable>
        ) : null}
        {myRole !== "owner" ? (
          <Pressable
            onPress={() => setReporting(true)}
            accessibilityRole="button"
            style={styles.footerButton}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="flag-outline" size={18} color={colors.danger} />
            <Text style={[styles.footerText, { color: colors.danger }]}>Report group</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={inviting} transparent animationType="slide" onRequestClose={() => setInviting(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={() => setInviting(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Invite friends</Text>
          <ScrollView style={styles.sheetList}>
            {friends.length === 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted, textAlign: "center", marginTop: SPACING.lg }]}>
                All your friends are already in, or you have not added any yet.
              </Text>
            ) : (
              friends.map((friend) => (
                <View key={friend.id} style={styles.member}>
                  <CommunityAvatar profile={friend} size={38} />
                  <Text style={[styles.memberText, styles.memberName, { color: colors.text }]} numberOfLines={1}>
                    {nameOf(friend)}
                  </Text>
                  {invited.has(friend.id) ? (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>Invited</Text>
                  ) : (
                    <Pressable
                      onPress={async () => {
                        const result = await inviteToGroup(groupId, friend.id);
                        if (result.ok) setInvited((prev) => new Set([...prev, friend.id]));
                      }}
                      accessibilityRole="button"
                      style={[styles.invite, { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.inviteText, { color: colors.onPrimary }]}>Invite</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="group"
        targetId={groupId}
        reportedUser={group.owner}
        what={group.name}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, gap: SPACING.md },
  hero: { alignItems: "center", gap: 6, paddingVertical: SPACING.md },
  name: { fontSize: 24, fontWeight: "800", textAlign: "center", marginTop: SPACING.sm },
  meta: { fontSize: 13 },
  description: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: SPACING.xs, maxWidth: 340 },
  actions: { gap: SPACING.sm },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", gap: SPACING.sm },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  tabs: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, marginTop: SPACING.sm },
  tab: { flex: 1, minHeight: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14, fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  centreText: { textAlign: "center" },
  feed: { gap: SPACING.sm },
  emptyFeed: { alignItems: "center", gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  more: { alignItems: "center", justifyContent: "center", minHeight: HIT_TARGET },
  moreText: { fontSize: 15, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 12,
    paddingHorizontal: SPACING.md,
  },
  memberText: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontWeight: "700" },
  role: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  roleText: { fontSize: 12, fontWeight: "800" },
  footer: { flexDirection: "row", justifyContent: "center", gap: SPACING.xl, marginTop: SPACING.md },
  footerButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: HIT_TARGET },
  footerText: { fontSize: 15, fontWeight: "700" },
  sheet: {
    marginTop: "auto",
    maxHeight: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: SPACING.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  sheetTitle: { fontSize: 20, fontWeight: "800", paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  sheetList: { paddingHorizontal: SPACING.xs },
  invite: { minHeight: 32, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, justifyContent: "center" },
  inviteText: { fontSize: 13, fontWeight: "800" },
});
