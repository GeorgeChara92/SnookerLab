import React from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useMatchesStore, useSessionsStore, useRoutineScoresStore } from "../../store";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { SnookerPresetAvatar } from "../profile/SnookerPresetAvatar";
import { ACHIEVEMENTS, getPlayerLevel } from "../../constants/achievements";
import { useSeenAchievements } from "../../hooks/useSeenAchievements";

type HeaderVariant = "primary" | "secondary" | "minimal";

type HeaderAction = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  badge?: number;
};

type GlobalHeaderProps = {
  variant?: HeaderVariant;
  title?: string;
  subtitle?: string;
  caption?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  actions?: HeaderAction[];
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
};

const PlayerIdentity: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const { seenAchievementIds } = useSeenAchievements(`${matches.length}-${sessions.length}-${entries.length}`);
  const subscription = useSubscriptionAccess();
  const { width } = useWindowDimensions();

  const matchesWon = matches.filter((m) => m.result === "win").length;
  const matchesPlayed = matches.length;
  const sessionsLogged = sessions.length + entries.length;
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let longestWinStreak = 0;
  let currentStreak = 0;
  for (const match of sortedMatches) {
    if (match.result === "win") {
      currentStreak += 1;
      longestWinStreak = Math.max(longestWinStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  const allFrames = Object.values(liveFramesByMatch).flat();
  const bestBreak = allFrames.reduce((max, frame) => Math.max(max, frame.highest_break_user ?? 0), 0);
  const centuries = allFrames.filter((frame) => (frame.highest_break_user ?? 0) >= 100).length;

  const xp = ACHIEVEMENTS.filter((a) => {
    if (seenAchievementIds.has(a.id)) return true;
    switch (a.requirement.type) {
      case "matches_won":
        return matchesWon >= a.requirement.value;
      case "matches_played":
        return matchesPlayed >= a.requirement.value;
      case "sessions_logged":
        return sessionsLogged >= a.requirement.value;
      case "win_streak":
        return longestWinStreak >= a.requirement.value;
      case "best_break":
        return bestBreak >= a.requirement.value;
      case "centuries":
        return centuries >= a.requirement.value;
      default:
        return false;
    }
  }).reduce((sum, a) => sum + a.xpReward, 0);
  const levelInfo = getPlayerLevel(xp);
  const xpProgress = levelInfo.xpToNext === Infinity ? 1 : Math.min(1, xp / (xp + levelInfo.xpToNext));
  const showName = compact ? width >= 390 : true;
  const levelAndXp = `Level ${levelInfo.level} • ${xp} XP`;

  const handlePress = () => {
    navigation.navigate("ProfileModal");
  };

  if (compact) {
    return (
      <Pressable onPress={handlePress} style={styles.playerRow}>
        <View style={styles.avatarSmallWrapper}>
          <View style={styles.ringSmallContainer}>
            <View style={[styles.progressRingSmall, { borderColor: colors.primary, opacity: 0.3 }]} />
            <View
              style={[
                styles.progressRingFillSmall,
                { borderColor: colors.primary, transform: [{ rotate: `${xpProgress * 360}deg` }] },
              ]}
            />
          </View>
          <View style={[styles.avatarSmall, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
            {user?.profile_image_url ? (
              <Image source={{ uri: user.profile_image_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <SnookerPresetAvatar presetId={user?.avatar_preset} size={30} />
            )}
          </View>
        </View>
        <View style={styles.playerInfoCompact}>
          {showName ? (
            <Text style={[styles.playerNameCompact, { color: colors.text }]} numberOfLines={1}>
              {user?.username || "Player"}
            </Text>
          ) : null}
          <View style={styles.xpRowCompact}>
            <MaterialCommunityIcons name="star" size={10} color={colors.primary} />
            <Text style={[styles.xpTextCompact, { color: colors.textMuted }]} numberOfLines={1}>{levelAndXp}</Text>
          </View>
        </View>
        {subscription.tier !== "free" && (
          <View style={[styles.planBadgeCompact, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
            <MaterialCommunityIcons name="crown" size={9} color={colors.primary} />
            <Text style={[styles.planBadgeTextCompact, { color: colors.primary }]}>PRO</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.avatarContainer}>
      <View style={styles.ringContainer}>
        <View style={[styles.progressRing, { borderColor: colors.primary, opacity: 0.3 }]} />
        <View
          style={[
            styles.progressRingFill,
            { borderColor: colors.primary, transform: [{ rotate: `${xpProgress * 360}deg` }] },
          ]}
        />
      </View>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
        {user?.profile_image_url ? (
          <Image source={{ uri: user.profile_image_url }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <SnookerPresetAvatar presetId={user?.avatar_preset} size={34} />
        )}
      </View>
      <View style={styles.playerInfoCompact}>
        <Text style={[styles.playerNameCompact, { color: colors.text }]} numberOfLines={1}>
          {user?.username || "Player"}
        </Text>
        <View style={styles.xpRowCompact}>
          <MaterialCommunityIcons name="star" size={10} color={colors.primary} />
          <Text style={[styles.xpTextCompact, { color: colors.textMuted }]} numberOfLines={1}>{levelAndXp}</Text>
        </View>
      </View>
      <PlanBadge />
    </Pressable>
  );
};

const PlanBadge: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();

  if (subscription.tier !== "free") {
    return (
      <View style={[compact ? styles.planBadgeCompact : styles.planBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
        <MaterialCommunityIcons name="crown" size={compact ? 9 : 10} color={colors.primary} />
        <Text style={[compact ? styles.planBadgeTextCompact : styles.planBadgeText, { color: colors.primary }]}>PRO</Text>
      </View>
    );
  }

  return (
    <View style={[compact ? styles.planBadgeCompact : styles.planBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[compact ? styles.planBadgeTextCompact : styles.planBadgeText, { color: colors.textMuted }]}>FREE</Text>
    </View>
  );
};

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  variant = "secondary",
  title,
  subtitle,
  caption,
  showBack,
  onBackPress,
  actions = [],
  rightContent,
  children,
  style,
}) => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const canGoBack = navigation.canGoBack();
  const shouldShowBack = showBack ?? (variant !== "primary" && canGoBack);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (canGoBack) {
      navigation.goBack();
    }
  };

  if (variant === "minimal") {
    return (
      <View style={[styles.minimalContainer, { backgroundColor: colors.background }, style]}>
        {shouldShowBack && (
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
        )}
        {title && <Text style={[styles.minimalTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>}
        <View style={styles.minimalRight}>
          {rightContent}
          {actions.map((action, index) => (
            <Pressable key={index} onPress={action.onPress} style={styles.actionButton}>
              <MaterialCommunityIcons name={action.icon} size={24} color={colors.text} />
            </Pressable>
          ))}
        </View>
        {children}
      </View>
    );
  }

  if (variant === "primary") {
    return (
      <View style={[styles.primaryContainer, { backgroundColor: colors.background }, style]}>
        <View style={styles.primaryRow}>
          <PlayerIdentity />
          {title && (
            <Text style={[styles.primaryTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          <View style={styles.primaryRight}>
            {rightContent ?? <PlanBadge />}
          </View>
        </View>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.secondaryContainer, { backgroundColor: colors.background }, style]}>
      <View style={styles.secondaryTitleRow}>
        {shouldShowBack && (
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
        )}
        {title && (
          <Text style={[styles.secondaryTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        )}
        <View style={styles.secondaryActions}>
          {actions.map((action, index) => (
            <Pressable key={index} onPress={action.onPress} style={styles.actionButton}>
              <MaterialCommunityIcons name={action.icon} size={22} color={colors.text} />
              {action.badge !== undefined && action.badge > 0 && (
                <View style={[styles.actionBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.actionBadgeText}>{action.badge > 99 ? "99+" : action.badge}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.secondaryProfileRow}>
        <PlayerIdentity compact />
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  minimalContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  minimalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  minimalRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  primaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: "900",
  },
  primaryRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  secondaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  secondaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  secondaryProfileRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  avatarContainer: {
    maxWidth: 260,
    minHeight: 44,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 52,
  },
  ringContainer: {
    position: "absolute",
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    top: 0,
  },
  progressRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  progressRingFill: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
    top: 5,
    left: 5,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
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
  playerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarSmallWrapper: {
    width: 44,
    height: 44,
    position: "relative",
  },
  ringSmallContainer: {
    position: "absolute",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingSmall: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
  },
  progressRingFillSmall: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
    top: 5,
    left: 5,
  },
  playerInfoCompact: {
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  playerNameCompact: {
    fontSize: 12,
    fontWeight: "700",
  },
  xpRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  xpTextCompact: {
    fontSize: 10,
    fontWeight: "600",
  },
  planBadgeCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeTextCompact: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default GlobalHeader;
