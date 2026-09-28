import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { useAppTheme } from "../hooks/useAppTheme";
import { useUiModeStore } from "../store/uiModeStore";
import { useCommunityStore } from "../store/communityStore";
import { useCoachStore } from "../store/coachStore";
import { HeaderProfileButton } from "../components/profile/HeaderProfileButton";

/**
 * The header for a player tab's root screen: a title, and - for a coach - the exact same
 * always-visible "Coach view" pill coach mode uses for its own "Player view" switch (see
 * MaterialTopHeader), rather than a bare icon tucked in a corner. Only used on each tab's own
 * landing screen; a pushed screen (RoutineDetail, MatchDetail, ...) keeps the normal back-arrow
 * header from useAppStackScreenOptions.
 */
export const PlayerRootHeader = ({ options }: NativeStackHeaderProps) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isCoach = useCommunityStore((state) => state.me?.isCoach ?? false);
  const pendingRequests = useCoachStore(
    (state) => state.bookingsAsCoach.filter((booking) => booking.status === "pending").length
  );
  const setViewMode = useUiModeStore((state) => state.setViewMode);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top },
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.text }]}>{options.title}</Text>
        {isCoach ? (
          <Pressable
            onPress={() => setViewMode("coach")}
            accessibilityRole="button"
            accessibilityLabel={pendingRequests > 0 ? "Switch to coach view, booking request waiting" : "Switch to coach view"}
            style={({ pressed }) => [styles.switchPill, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={14} color={colors.primary} />
            <Text style={[styles.switchText, { color: colors.primary }]}>Coach view</Text>
            {pendingRequests > 0 ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
          </Pressable>
        ) : null}
      </View>
      <HeaderProfileButton />
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
});
