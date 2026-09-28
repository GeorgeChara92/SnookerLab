import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { SwipeToDelete } from "../../components/ui/SwipeToDelete";
import { useCommunityStore } from "../../store/communityStore";
import { useCoachStore } from "../../store/coachStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { startDirect } from "../../features/community/chat";
import { nameOf } from "../../features/community/types";
import { clientsOf, type Client } from "../../features/coach/types";
import type { CoachClientsStackParamList } from "../../types";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** Everyone who has ever booked a session with this coach, most recently active first. */
export const CoachClientsScreen = () => {
  const navigation = useNavigation<NavigationProp<CoachClientsStackParamList>>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsCoach, loaded, deleteClientHistory, deleteGuestHistory } = useCoachStore();
  const { profiles } = useCommunityStore();
  const [messaging, setMessaging] = useState<string | null>(null);

  const clients = useMemo(() => clientsOf(bookingsAsCoach), [bookingsAsCoach]);

  const message = async (playerId: string, name: string) => {
    setMessaging(playerId);
    const result = await startDirect(playerId);
    setMessaging(null);
    if (result.ok) navigation.navigate("Chat", { conversationId: result.value });
    else dialog.alert({ title: `You cannot message ${name}`, message: result.message, icon: "message-lock-outline" });
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

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={clients}
      keyExtractor={(client) => client.key}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialCommunityIcons name="account-group-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Players you've had a session with will show up here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const profile = item.playerId ? profiles[item.playerId] : undefined;
        const name = item.playerId ? nameOf(profile) : item.guestName ?? "Guest";
        return (
          <SwipeToDelete
            onDelete={() => removeClient(item, name)}
            deleteLabel={`Delete every past session with ${name}`}
            gapBelow={SPACING.sm}
          >
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() => navigation.navigate("ClientDetail", { clientId: item.key, clientName: name })}
                accessibilityRole="button"
                style={styles.rowMain}
              >
                {item.playerId ? (
                  <CommunityAvatar profile={profile} size={44} />
                ) : (
                  <View style={[styles.guestAvatar, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialCommunityIcons name="account-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {item.sessions} session{item.sessions === 1 ? "" : "s"}
                    {item.playerId ? "" : " · no Snookered account"}
                  </Text>
                </View>
              </Pressable>
              {item.playerId ? (
                <Pressable
                  onPress={() => message(item.playerId as string, name)}
                  disabled={messaging === item.playerId}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${name}`}
                  hitSlop={8}
                  style={[styles.messageButton, { backgroundColor: colors.surfaceMuted }]}
                >
                  {messaging === item.playerId ? (
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
  list: { padding: SPACING.lg, gap: SPACING.sm, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
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
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.md },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: "700" },
  rowMeta: { fontSize: 13 },
  messageButton: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  guestAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
