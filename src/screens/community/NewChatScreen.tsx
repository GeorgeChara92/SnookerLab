import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useDialog } from "../../components/ui/DialogProvider";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { nameOf, type PublicProfile } from "../../features/community/types";
import { startDirect } from "../../features/community/chat";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Starting a conversation: friends first, or search for anyone. Someone who is not a friend
 * gets the first message as a request, if their settings allow messages at all.
 */
export const NewChatScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { friendships, profiles, search } = useCommunityStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.status === "accepted")
        .map((item) => profiles[item.requester === me ? item.addressee : item.requester])
        .filter((profile): profile is PublicProfile => Boolean(profile))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    [friendships, me, profiles]
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => setResults(await search(query)), 300);
  }, [query, search]);

  const filteredFriends = friends.filter((profile) => {
    const needle = query.trim().toLowerCase().replace(/^@/, "");
    return !needle || nameOf(profile).toLowerCase().includes(needle) || profile.handle?.includes(needle);
  });
  const others = results.filter((profile) => !friends.some((friend) => friend.id === profile.id));

  const open = async (profile: PublicProfile) => {
    setOpening(profile.id);
    const result = await startDirect(profile.id);
    setOpening(null);
    if (!result.ok) {
      dialog.alert({
        title: `You cannot message ${nameOf(profile)}`,
        message: result.message,
        icon: "message-lock-outline",
      });
      return;
    }
    navigation.replace("Chat", { conversationId: result.value });
  };

  const rows: Array<{ type: "title"; label: string } | { type: "person"; profile: PublicProfile; friend: boolean }> = [
    ...(filteredFriends.length ? [{ type: "title" as const, label: "FRIENDS" }] : []),
    ...filteredFriends.map((profile) => ({ type: "person" as const, profile, friend: true })),
    ...(others.length ? [{ type: "title" as const, label: "OTHER PLAYERS" }] : []),
    ...others.map((profile) => ({ type: "person" as const, profile, friend: false })),
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name or @handle"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row, index) => (row.type === "title" ? `${row.label}-${index}` : row.profile.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {query.trim().length < 2
              ? "Add friends to message them straight away, or search for any player."
              : "Nobody found."}
          </Text>
        }
        renderItem={({ item }) =>
          item.type === "title" ? (
            <Text style={[styles.title, { color: colors.textMuted }]}>{item.label}</Text>
          ) : (
            <Pressable
              onPress={() => open(item.profile)}
              disabled={opening !== null}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
            >
              <CommunityAvatar profile={item.profile} size={44} />
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {nameOf(item.profile)}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.profile.handle ? `@${item.profile.handle}` : ""}
                  {!item.friend
                    ? item.profile.messagePrivacy === "everyone"
                      ? " · sends as a request"
                      : " · not taking messages"
                    : ""}
                </Text>
              </View>
              {opening === item.profile.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              )}
            </Pressable>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: SPACING.lg, paddingBottom: SPACING.sm },
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
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  title: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginTop: SPACING.md, marginBottom: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 16,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xs,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13 },
  empty: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: SPACING.xl },
});
