import React, { useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
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

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const stats = getPlayerStats(matches, sessions, entries);
  const xp = stats.matchesWon * 10 + stats.sessionsLogged * 5;
  const levelInfo = getPlayerLevel(xp);

  const handlePress = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      friction: 4,
      tension: 200,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();
    }, 80);

    navigation.navigate("ProfileModal");
  };

  const xpProgress = levelInfo.xpToNext === Infinity ? 1 : Math.min(1, xp / (xp + levelInfo.xpToNext));

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: scaleAnim }] }]}>
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
            <SnookerPresetAvatar presetId={user?.avatar_preset} size={36} />
          )}
        </View>

        {/* Level Badge */}
        <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.levelText}>{levelInfo.level}</Text>
        </View>
      </Animated.View>

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
    gap: 8,
    paddingRight: 4,
  },
  avatarWrapper: {
    position: "relative",
    width: 44,
    height: 44,
  },
  ringContainer: {
    position: "absolute",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  progressRingFill: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
    top: 3,
    left: 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFF",
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});