import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useCustomRoutinesStore } from "../../store";
import { useChatStore } from "../../store/chatStore";
import { useCommunityStore } from "../../store/communityStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { GroupBadge } from "../../components/community/GroupBadge";
import { ChatShareCard } from "../../components/community/ChatShareCard";
import { nameOf, type PublicProfile } from "../../features/community/types";
import { sendMessage, startDirect, type Group } from "../../features/community/chat";
import { publishRoutine } from "../../features/community/sharedRoutines";
import { shareBody, sharePayload, type MatchShare, type RoutineShare } from "../../features/community/chatShare";

type ChatShare = RoutineShare | MatchShare;
import type { RootStackParamList } from "../../types";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Target =
  | { key: string; type: "chat"; conversationId: string; group: Group | null; person: PublicProfile | null }
  | { key: string; type: "friend"; person: PublicProfile };

/**
 * Sending a routine or a match result to a chat: recent chats and groups first, then friends
 * not messaged yet. Each send is one tap, and a row says when it has gone. A custom routine the
 * player has not shared is shared by link first, so whoever gets it can open it.
 */
export const SendToChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { share: initial, customRoutineId } = route.params as RootStackParamList["SendToChat"];
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const myName = useCommunityStore((state) => nameOf(state.me));
  const joined = useCommunityStore((state) => Boolean(state.me?.handle));
  const { friendships, profiles } = useCommunityStore();
  const { inbox, profiles: inboxProfiles, groups, refresh } = useChatStore();
  const customRoutine = useCustomRoutinesStore((state) =>
    customRoutineId ? state.routines.find((item) => item.id === customRoutineId) : undefined
  );
  const setShared = useCustomRoutinesStore((state) => state.setShared);
  const [share, setShare] = useState<ChatShare>(initial);
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const targets = useMemo(() => {
    const chats: Target[] = inbox
      .filter((row) => row.status === "active")
      .map((row) => ({
        key: row.conversationId,
        type: "chat" as const,
        conversationId: row.conversationId,
        group: row.groupId ? (groups[row.groupId] ?? null) : null,
        person: row.otherUser ? (inboxProfiles[row.otherUser] ?? profiles[row.otherUser] ?? null) : null,
      }))
      .filter((row) => row.group || row.person);
    const talkingTo = new Set(chats.map((row) => (row.type === "chat" ? row.person?.id : null)).filter(Boolean));
    const friends: Target[] = friendships
      .filter((item) => item.status === "accepted")
      .map((item) => profiles[item.requester === me ? item.addressee : item.requester])
      .filter((person): person is PublicProfile => Boolean(person) && !talkingTo.has(person.id))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      .map((person) => ({ key: `friend-${person.id}`, type: "friend" as const, person }));
    const needle = query.trim().toLowerCase().replace(/^@/, "");
    const label = (target: Target) =>
      target.type === "chat" && target.group ? target.group.name : nameOf(target.person);
    return [...chats, ...friends].filter(
      (target) =>
        !needle ||
        label(target).toLowerCase().includes(needle) ||
        Boolean(target.person?.handle?.toLowerCase().includes(needle))
    );
  }, [friendships, groups, inbox, inboxProfiles, me, profiles, query]);

  /** A custom routine goes out as a link-only community copy, made the first time it is sent. */
  const ready = async (): Promise<ChatShare | null> => {
    if (share.kind !== "routine" || share.sharedId || share.libraryId || !customRoutine) return share;
    const existing = customRoutine.sharedId ?? customRoutine.sourceSharedId;
    if (existing) {
      const next = { ...share, sharedId: existing };
      setShare(next);
      return next;
    }
    const published = await publishRoutine(customRoutine, "link");
    if (!published.ok) {
      setError(published.message);
      return null;
    }
    setShared(customRoutine.id, published.value);
    const next = { ...share, sharedId: published.value };
    setShare(next);
    return next;
  };

  const send = async (target: Target) => {
    if (busy || sent.has(target.key)) return;
    setBusy(target.key);
    setError(null);
    const item = await ready();
    if (!item) {
      setBusy(null);
      return;
    }
    let conversationId = target.type === "chat" ? target.conversationId : null;
    if (!conversationId && target.type === "friend") {
      const opened = await startDirect(target.person.id);
      if (!opened.ok) {
        setBusy(null);
        setError(opened.message);
        return;
      }
      conversationId = opened.value;
    }
    const result = await sendMessage(conversationId!, shareBody(item), item.kind, sharePayload(item));
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent((prev) => new Set([...prev, target.key]));
    void refresh();
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={styles.headerSide} />
      <Text style={[styles.title, { color: colors.text }]}>Send to</Text>
      <View style={[styles.headerSide, styles.headerRight]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.close, { backgroundColor: colors.surfaceMuted }]}
        >
          <MaterialCommunityIcons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );

  if (!joined) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.centre}>
          <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Join the community first</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Pick a handle in the Community tab, add friends, and you can send them routines and results.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      <FlatList
        data={targets}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.preview}>
              <ChatShareCard share={share} senderName={myName} width={Math.min(300, width - SPACING.lg * 2)} />
            </View>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search chats and friends"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyBody, { color: colors.textMuted, marginTop: SPACING.lg }]}>
            {query ? "No chats or friends match that." : "Add friends or join a group, and they will be here."}
          </Text>
        }
        renderItem={({ item }) => {
          const done = sent.has(item.key);
          const title = item.type === "chat" && item.group ? item.group.name : nameOf(item.person);
          const subtitle =
            item.type === "chat" && item.group
              ? `Group · ${item.group.memberCount} ${item.group.memberCount === 1 ? "member" : "members"}`
              : item.person?.handle
                ? `@${item.person.handle}`
                : "";
          return (
            <View style={styles.row}>
              {item.type === "chat" && item.group ? (
                <GroupBadge group={item.group} size={42} />
              ) : (
                <CommunityAvatar profile={item.person} size={42} />
              )}
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => send(item)}
                disabled={done || Boolean(busy)}
                accessibilityRole="button"
                accessibilityLabel={done ? `Sent to ${title}` : `Send to ${title}`}
                style={[
                  styles.send,
                  done
                    ? { backgroundColor: "transparent", borderColor: colors.border }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {busy === item.key ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : done ? (
                  <>
                    <MaterialCommunityIcons name="check" size={16} color={colors.textMuted} />
                    <Text style={[styles.sendText, { color: colors.textMuted }]}>Sent</Text>
                  </>
                ) : (
                  <Text style={[styles.sendText, { color: colors.onPrimary }]}>Send</Text>
                )}
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { width: 44 },
  headerRight: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800" },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: SPACING.lg },
  top: { gap: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  preview: { alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: SPACING.sm },
  error: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: HIT_TARGET + 16 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 13, marginTop: 1 },
  send: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 76,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
  },
  sendText: { fontSize: 14, fontWeight: "800" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
