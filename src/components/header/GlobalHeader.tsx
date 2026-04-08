import React from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useMatchesStore, useSessionsStore, useRoutineScoresStore } from "../../store";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { SnookerPresetAvatar } from "../profile/SnookerPresetAvatar";
import { getPlayerLevel } from "../../constants/achievements";
import type { Match, SessionLog, RoutineScoreEntry } from "../../types";

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

type Stats = { matchesWon: number; sessionsLogged: number };

const getStats = (matches: Match[], sessions: SessionLog[], entries: RoutineScoreEntry[]): Stats => ({
  matchesWon: matches.filter((m) => m.result === "win").length,
  sessionsLogged: sessions.length + entries.length,
});

const PlayerIdentity: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const matches = useMatchesStore((state) => state.matches);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const subscription = useSubscriptionAccess();

  const stats = getStats(matches, sessions, entries);
  const xp = stats.matchesWon * 10 + stats.sessionsLogged * 5;
  const levelInfo = getPlayerLevel(xp);
  const xpProgress = levelInfo.xpToNext === Infinity ? 1 : Math.min(1, xp / (xp + levelInfo.xpToNext));

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
              <SnookerPresetAvatar presetId={user?.avatar_preset} size={28} />
            )}
          </View>
          <View style={[styles.levelBadgeSmall, { backgroundColor: colors.primary }]}>
            <Text style={styles.levelTextSmall}>{levelInfo.level}</Text>
          </View>
        </View>
        <View style={styles.playerInfoCompact}>
          <Text style={[styles.playerNameCompact, { color: colors.text }]} numberOfLines={1}>
            {user?.username || "Player"}
          </Text>
          <View style={styles.xpRowCompact}>
            <MaterialCommunityIcons name="star" size={10} color={colors.primary} />
            <Text style={[styles.xpTextCompact, { color: colors.textMuted }]}>{xp} XP</Text>
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
          <SnookerPresetAvatar presetId={user?.avatar_preset} size={36} />
        )}
      </View>
      <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.levelText}>{levelInfo.level}</Text>
      </View>
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
    width: 44,
    height: 44,
    position: "relative",
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
  avatarImage: {
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
  playerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarSmallWrapper: {
    width: 32,
    height: 32,
    position: "relative",
  },
  ringSmallContainer: {
    position: "absolute",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingSmall: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  progressRingFillSmall: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  avatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
    top: 3,
    left: 3,
  },
  levelBadgeSmall: {
    position: "absolute",
    bottom: -1,
    right: -1,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  levelTextSmall: {
    fontSize: 7,
    fontWeight: "800",
    color: "#FFF",
  },
  playerInfoCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerNameCompact: {
    fontSize: 12,
    fontWeight: "600",
  },
  xpRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  xpTextCompact: {
    fontSize: 10,
    fontWeight: "500",
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