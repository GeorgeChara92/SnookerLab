import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { useAppTheme } from "../hooks/useAppTheme";
import { useUiModeStore } from "../store/uiModeStore";
import { useAuthStore, useMatchesStore } from "../store";
import { useCommunityStore } from "../store/communityStore";

/**
 * The header for coach-mode tabs: a title, a labelled one-tap way back to the player view, and a
 * way into coach settings. No XP, level or subscription badge - those are the player's own
 * identity, and showing them on a professional coaching dashboard is exactly the "cramped, mixed
 * up" feeling coach mode exists to fix. See useAppStackScreenOptions for the player-side equivalent.
 *
 * The switch itself is a named, always-visible pill rather than tucked inside settings, because a
 * plain gear icon here was not enough for anyone to actually find their way back to player view.
 */
export const MaterialTopHeader = ({ options, navigation }: BottomTabHeaderProps) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const setViewMode = useUiModeStore((state) => state.setViewMode);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  // Friend requests and match link requests: player-side activity with no visibility from coach
  // mode at all, unlike chats, which have their own badge on the Chats tab.
  const friendRequests = useCommunityStore(
    (state) => state.friendships.filter((item) => item.status === "pending" && item.addressee === userId).length
  );
  const matchRequests = useMatchesStore((state) => state.linkRequests.length);
  const playerSideWaiting = friendRequests > 0 || matchRequests > 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top },
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.text }]}>{options.title}</Text>
        <Pressable
          onPress={() => setViewMode("player")}
          accessibilityRole="button"
          accessibilityLabel={playerSideWaiting ? "Switch to player view, new activity waiting" : "Switch to player view"}
          style={({ pressed }) => [styles.switchPill, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="swap-horizontal" size={14} color={colors.primary} />
          <Text style={[styles.switchText, { color: colors.primary }]}>Player view</Text>
          {playerSideWaiting ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
        </Pressable>
      </View>
      <Pressable
        onPress={() => navigation.getParent()?.navigate("ProfileModal", { screen: "CoachSettings" } as never)}
        accessibilityRole="button"
        accessibilityLabel="Coach settings"
        hitSlop={8}
        style={styles.button}
      >
        <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { gap: 4 },
  title: { fontSize: 22, fontWeight: "800" },
  switchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  switchText: { fontSize: 12, fontWeight: "700" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  button: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
