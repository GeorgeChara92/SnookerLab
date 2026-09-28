import React, { useCallback, useLayoutEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { HeaderIconButton } from "../../navigation/stackOptions";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useChatStore } from "../../store/chatStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { GroupBadge } from "../../components/community/GroupBadge";
import { nameOf } from "../../features/community/types";
import type { InboxRow } from "../../features/community/chat";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** "14:05" today, "Mon" this week, "12 Sep" before. */
export const chatTime = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * The player's chats - friends, other players and groups - newest first, and the message
 * requests from people they have not added, to accept or decline.
 */
export const ChatsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { inbox, profiles, groups, loaded, refresh } = useChatStore();
  const [view, setView] = useState<"chats" | "requests">("chats");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          icon="square-edit-outline"
          color={colors.primary}
          label="New message"
          onPress={() => navigation.navigate("NewChat")}
        />
      ),
    });
  }, [colors.primary, navigation]);

  // A group already has its own screen (with its own way into its chat), so this list stays
  // direct messages only rather than mixing the two kinds of conversation together.
  const direct = inbox.filter((row) => row.kind === "direct");
  const chats = direct.filter((row) => row.status === "active");
  const requests = direct.filter((row) => row.status === "request");
  const data = view === "chats" ? chats : requests;

  const Row = ({ row }: { row: InboxRow }) => {
    const group = row.groupId ? groups[row.groupId] : null;
    const person = row.otherUser ? profiles[row.otherUser] : null;
    const title = group ? group.name : nameOf(person);
    const mineLast = row.lastSender === me;
    const unread = row.unread > 0 && !row.muted;
    return (
      <Pressable
        onPress={() => navigation.navigate("Chat", { conversationId: row.conversationId })}
        accessibilityRole="button"
        accessibilityLabel={`${title}${row.unread ? `, ${row.unread} unread` : ""}`}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
      >
        {group ? <GroupBadge group={group} size={48} /> : <CommunityAvatar profile={person} size={48} />}
        <View style={styles.rowText}>
          <View style={styles.rowTop}>
            <Text
              style={[styles.rowName, { color: colors.text, fontWeight: unread ? "900" : "700" }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={[styles.rowTime, { color: unread ? colors.primary : colors.textMuted }]}>
              {chatTime(row.lastMessageAt)}
            </Text>
          </View>
          <View style={styles.rowTop}>
            <Text
              style={[
                styles.preview,
                { color: unread ? colors.text : colors.textMuted, fontWeight: unread ? "700" : "400" },
              ]}
              numberOfLines={1}
            >
              {row.lastMessagePreview
                ? `${mineLast ? "You: " : group && row.lastSender && profiles[row.lastSender] ? `${nameOf(profiles[row.lastSender])}: ` : ""}${row.lastMessagePreview}`
                : group
                  ? "No messages yet. Say hello."
                  : "Start the conversation"}
            </Text>
            {row.muted ? (
              <MaterialCommunityIcons name="bell-off-outline" size={16} color={colors.textMuted} />
            ) : unread ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                  {row.unread > 99 ? "99+" : row.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(row) => row.conversationId}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
          {(["chats", "requests"] as const).map((option) => {
            const selected = option === view;
            return (
              <Pressable
                key={option}
                onPress={() => setView(option)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
                  {option === "chats" ? "Chats" : "Requests"}
                </Text>
                {option === "requests" && requests.length ? (
                  <View style={[styles.segmentBadge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.segmentBadgeText}>{requests.length}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      }
      ListEmptyComponent={
        !loaded ? null : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons
              name={view === "chats" ? "chat-outline" : "email-lock-outline"}
              size={32}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {view === "chats" ? "No chats yet" : "No message requests"}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              {view === "chats"
                ? "Message a friend, or join a group to chat with more players."
                : "Messages from players you have not added arrive here first. You choose whether to reply."}
            </Text>
            {view === "chats" ? (
              <Pressable
                onPress={() => navigation.navigate("NewChat")}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="square-edit-outline" size={20} color={colors.onPrimary} />
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>New message</Text>
              </Pressable>
            ) : null}
          </View>
        )
      }
      renderItem={({ item }) => <Row row={item} />}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, flexGrow: 1 },
  segments: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3, marginBottom: SPACING.md },
  segment: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "700" },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  segmentBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 24,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xs,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rowName: { flex: 1, fontSize: 16 },
  rowTime: { fontSize: 12, fontWeight: "700" },
  preview: { flex: 1, fontSize: 14 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "900" },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  primaryText: { fontSize: 15, fontWeight: "800" },
});
