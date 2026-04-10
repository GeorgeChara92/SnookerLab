import React from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore, useMatchesStore, useSessionsStore, useRoutineScoresStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { SnookerPresetAvatar } from "./SnookerPresetAvatar";
import { getPlayerLevel } from "../../constants/achievements";
import type { Match, SessionLog, RoutineScoreEntry } from "../../types";

type AchievementStats = {
  matchesWon: number;
  sessionsLogged: number;
};

const getPlayerStats = (
  matches: Match[],
  sessions: SessionLog[],
  entries: RoutineScoreEntry[]
): AchievementStats => {
  const matchesWon = matches.filter((m: Match) => m.result === "win").length;
  const sessionsLogged = sessions.length + entries.length;
  return { matchesWon, sessionsLogged };
};

export const HeaderProfileButton = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const matches = useMatchesStore((state) => state.matches);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const subscription = useSubscriptionAccess();
  const { width } = useWindowDimensions();

  const stats = getPlayerStats(matches, sessions, entries);
  const xp = stats.matchesWon * 10 + stats.sessionsLogged * 5;
  const levelInfo = getPlayerLevel(xp);

  const handlePress = () => {
    navigation.navigate("ProfileModal");
  };

  const xpProgress = levelInfo.xpToNext === Infinity ? 1 : Math.min(1, xp / (xp + levelInfo.xpToNext));
  const showMeta = width >= 360;
  const showName = width >= 420;
  const xpLabel = `${xp} XP`;

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.container, pressed && styles.containerPressed]} hitSlop={8}>
      <View style={styles.avatarWrapper}> 
        {/* XP Progress Ring */}
        <View style={styles.ringContainer}>
          <View
            style={[
              styles.progressRing,
              { borderColor: colors.primary, opacity: 0.3 },
            ]}
          />
          <View
            style={[
              styles.progressRingFill,
              {
                borderColor: colors.primary,
                transform: [{ rotate: `${xpProgress * 360}deg` }],
              },
            ]}
          />
        </View>

        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
          {user?.profile_image_url ? (
            <Image source={{ uri: user.profile_image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <SnookerPresetAvatar presetId={user?.avatar_preset} size={22} />
          )}
        </View>

        <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}> 
          <Text style={styles.levelText}>{levelInfo.level}</Text>
        </View>
      </View>

      {showMeta ? (
        <View style={styles.metaBlock}>
          {showName ? (
            <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {user?.username || "Player"}
            </Text>
          ) : null}
          <Text style={[styles.xpText, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
            {xpLabel}
          </Text>
        </View>
      ) : null}

      {/* Plan Badge */}
      {subscription.tier !== "free" && (
        <View style={[styles.planBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
          <MaterialCommunityIcons name="crown" size={10} color={colors.primary} />
          <Text style={[styles.planBadgeText, { color: colors.primary }]}>PRO</Text>
        </View>
      )}
      {subscription.tier === "free" && (
        <View style={[styles.planBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Text style={[styles.planBadgeText, { color: colors.textMuted }]}>FREE</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
    maxWidth: 220,
    paddingRight: 2,
    overflow: "visible",
  },
  containerPressed: {
    opacity: 0.92,
  },
  avatarWrapper: {
    position: "relative",
    width: 34,
    height: 34,
    overflow: "visible",
  },
  ringContainer: {
    position: "absolute",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.25,
  },
  progressRingFill: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.25,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
    top: 5,
    left: 5,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  levelBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    paddingHorizontal: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: {
    fontSize: 6,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 6,
  },
  metaBlock: {
    minWidth: 0,
    flexShrink: 1,
    gap: 1,
  },
  nameText: {
    fontSize: 12,
    fontWeight: "700",
  },
  xpText: {
    fontSize: 10,
    fontWeight: "600",
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.35,
  },
});
