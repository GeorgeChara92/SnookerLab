import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { SwipeToDelete } from "../../components/ui/SwipeToDelete";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useCoachStore } from "../../store/coachStore";
import { startDirect } from "../../features/community/chat";
import { nameOf } from "../../features/community/types";
import { clientsOf, type Client } from "../../features/coach/types";
import { ClientAvatar, FocusChips, Tag, agoLabel, lastRecapOf, nextSessionOf, relativeDay, timeOf } from "../../components/coach/CoachUI";
import type { CoachClientsStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "booked", label: "Booked in" },
  { key: "guests", label: "Guests" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/** Search shows once the list is long enough to need it. */
const SEARCH_FROM = 6;

/** Everyone who has ever booked a session with this coach: who's booked in next, what they last
 *  worked on, and their homework - most recently active first. */
export const CoachClientsScreen = () => {
  const navigation = useNavigation<NavigationProp<CoachClientsStackParamList>>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsCoach, sessionRecaps, homework, loaded, deleteClientHistory, deleteGuestHistory } = useCoachStore(
    useShallow((state) => ({
      bookingsAsCoach: state.bookingsAsCoach,
      sessionRecaps: state.sessionRecaps,
      homework: state.homework,
      loaded: state.loaded,
      deleteClientHistory: state.deleteClientHistory,
      deleteGuestHistory: state.deleteGuestHistory,
    })),
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const me = useAuthStore((state) => state.user?.id ?? null);
  const [messaging, setMessaging] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const clientName = (client: Client) => (client.playerId ? nameOf(profiles[client.playerId]) : (client.guestName ?? "Guest"));

  const rows = useMemo(() => {
    const now = new Date();
    return clientsOf(bookingsAsCoach).map((client) => ({
      client,
      next: nextSessionOf(client.key, bookingsAsCoach, now),
      recap: lastRecapOf(client.key, bookingsAsCoach, sessionRecaps),
      homework: client.playerId ? homework.filter((item) => item.coachId === me && item.playerId === client.playerId).length : 0,
    }));
  }, [bookingsAsCoach, homework, me, sessionRecaps]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      rows
        .filter((row) => (filter === "booked" ? Boolean(row.next) : filter === "guests" ? !row.client.playerId : true))
        .filter((row) => {
          if (!q) return true;
          const name = row.client.playerId ? nameOf(profiles[row.client.playerId]) : (row.client.guestName ?? "");
          return name.toLowerCase().includes(q);
        })
        // Booked-in clients first, soonest session at the top; then everyone else by last seen.
        .sort((a, b) => {
          if (a.next && b.next) return a.next.startsAt.localeCompare(b.next.startsAt);
          if (a.next || b.next) return a.next ? -1 : 1;
          return b.client.lastAt.localeCompare(a.client.lastAt);
        })
    );
  }, [filter, profiles, query, rows]);

  const message = async (playerId: string, name: string) => {
    setMessaging(playerId);
    const result = await startDirect(playerId);
    setMessaging(null);
    if (result.ok) navigation.navigate("Chat", { conversationId: result.value });
    else
      dialog.alert({
        title: `You cannot message ${name}`,
        message: result.message,
        icon: "message-lock-outline",
      });
  };

  const removeClient = (client: Client, name: string) =>
    dialog.confirm({
      title: `Delete ${name}'s history?`,
      message: "This removes every past session for good, including notes. A session still to come with them is left untouched.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete all",
      cancelLabel: "Keep it",
      onConfirm: () => (client.playerId ? deleteClientHistory(client.playerId) : deleteGuestHistory(client.guestName ?? "")),
    });

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const bookedIn = rows.filter((row) => row.next).length;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={shown}
      keyExtractor={(row) => row.client.key}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
      ListHeaderComponent={
        rows.length ? (
          <View style={styles.header}>
            <View
              style={[
                styles.summary,
                {
                  backgroundColor: colors.board,
                  borderColor: colors.boardRaised,
                },
              ]}
            >
              {[
                { label: "CLIENTS", value: rows.length },
                { label: "BOOKED IN", value: bookedIn },
                {
                  label: "SESSIONS",
                  value: rows.reduce((sum, row) => sum + row.client.sessions, 0),
                },
              ].map((cell, index) => (
                <React.Fragment key={cell.label}>
                  {index ? <View style={[styles.summaryRule, { backgroundColor: colors.boardRaised }]} /> : null}
                  <View style={styles.summaryCell}>
                    <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.summaryValue, { color: colors.boardText }]}>
                      {cell.value}
                    </Text>
                    <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.summaryLabel, { color: colors.boardMuted }]}>
                      {cell.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {rows.length >= SEARCH_FROM ? (
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search clients"
                  placeholderTextColor={colors.textSubtle}
                  style={[styles.searchInput, { color: colors.text }]}
                  returnKeyType="search"
                  accessibilityLabel="Search clients"
                />
              </View>
            ) : null}
            <View style={styles.filters} accessibilityRole="tablist">
              {FILTERS.map((item) => {
                const selected = item.key === filter;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFilter(item.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[
                      styles.filter,
                      selected
                        ? { backgroundColor: colors.primary }
                        : {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderWidth: 1,
                          },
                    ]}
                  >
                    <Text style={[styles.filterText, { color: selected ? colors.onPrimary : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialCommunityIcons name="account-group-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {rows.length ? "No clients match that." : "Players you've had a session with will show up here."}
          </Text>
        </View>
      }
      renderItem={({ item: { client, next, recap, homework: homeworkCount } }) => {
        const name = clientName(client);
        return (
          <SwipeToDelete
            onDelete={() => removeClient(client, name)}
            deleteLabel={`Delete every past session with ${name}`}
            gapBelow={SPACING.sm}
          >
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() =>
                  navigation.navigate("ClientDetail", {
                    clientId: client.key,
                    clientName: name,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${client.sessions} sessions${next ? `, next ${relativeDay(next.startsAt)} ${timeOf(next.startsAt)}` : ""}`}
                style={styles.rowMain}
              >
                <ClientAvatar profile={profiles[client.playerId ?? ""]} guest={!client.playerId} size={48} />
                <View style={styles.rowText}>
                  <View style={styles.nameLine}>
                    <Text style={[styles.rowName, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {client.playerId ? null : <Tag label="GUEST" />}
                  </View>
                  {next ? (
                    <View style={styles.metaLine}>
                      <MaterialCommunityIcons name="calendar-clock" size={13} color={colors.primary} />
                      <Text style={[styles.rowMeta, { color: colors.primary }]} numberOfLines={1}>
                        Next {relativeDay(next.startsAt)} · {timeOf(next.startsAt)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      Last session {agoLabel(client.lastAt)}
                    </Text>
                  )}
                  {recap?.focus.length ? <FocusChips focus={recap.focus} max={2} /> : null}
                  {homeworkCount ? (
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {homeworkCount} homework routine
                      {homeworkCount === 1 ? "" : "s"}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.count}>
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.countValue, { color: colors.text }]}>
                    {client.sessions}
                  </Text>
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.countLabel, { color: colors.textMuted }]}>
                    {client.sessions === 1 ? "SESSION" : "SESSIONS"}
                  </Text>
                </View>
              </Pressable>
              {client.playerId ? (
                <Pressable
                  onPress={() => message(client.playerId as string, name)}
                  disabled={messaging === client.playerId}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${name}`}
                  hitSlop={8}
                  style={[styles.messageButton, { backgroundColor: colors.surfaceMuted }]}
                >
                  {messaging === client.playerId ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialCommunityIcons name="chat-outline" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </SwipeToDelete>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: SPACING.lg, flexGrow: 1 },
  header: { gap: SPACING.sm, marginBottom: SPACING.md },
  summary: { flexDirection: "row", borderWidth: 1, borderRadius: RADIUS.lg },
  summaryCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  summaryRule: { width: StyleSheet.hairlineWidth, marginVertical: SPACING.sm },
  summaryValue: { fontFamily: FONTS.boardHeavy, fontSize: 24, lineHeight: 26 },
  summaryLabel: {
    fontFamily: FONTS.boardLabel,
    fontSize: 10,
    letterSpacing: 0.9,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: HIT_TARGET,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: SPACING.sm },
  filters: { flexDirection: "row", gap: SPACING.sm },
  filter: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    minHeight: 34,
    justifyContent: "center",
  },
  filterText: { fontSize: 14, fontWeight: "700" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingTop: SPACING.xl * 2,
  },
  emptyText: { fontSize: 15, textAlign: "center", maxWidth: 260 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: HIT_TARGET + 16,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowName: { fontSize: 16, fontWeight: "800" },
  rowMeta: { fontSize: 13 },
  count: { alignItems: "center", minWidth: 48 },
  countValue: { fontFamily: FONTS.boardHeavy, fontSize: 24, lineHeight: 26 },
  countLabel: { fontFamily: FONTS.boardLabel, fontSize: 9, letterSpacing: 0.7 },
  messageButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
