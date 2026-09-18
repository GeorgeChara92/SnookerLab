import React, { useMemo, useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, Easing } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMatchesStore, useSessionsStore, useRoutineScoresStore, useRoutinesStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSeenAchievements } from "../../hooks/useSeenAchievements";
import { AppCard } from "../../components/ui/AppCard";
import { ACHIEVEMENTS, getPlayerLevel, type Achievement, type AchievementCategory } from "../../constants/achievements";
import type { Match, SessionLog, RoutineScoreEntry, Routine } from "../../types";

type AchievementStats = {
  matchesWon: number;
  matchesPlayed: number;
  sessionsLogged: number;
  bestBreak: number;
  centuries: number;
  longestWinStreak: number;
  playerLevel: number;
};

const getPlayerStats = (
  matches: Match[],
  sessions: SessionLog[],
  entries: RoutineScoreEntry[],
  routines: Routine[],
  liveFramesByMatch: Record<string, { highest_break_user: number }[]>
): AchievementStats => {
  const matchesWon = matches.filter((m: Match) => m.result === "win").length;
  const matchesPlayed = matches.length;
  const sessionsLogged = sessions.length + entries.length;

  let longestStreak = 0;
  let currentStreak = 0;
  const sortedMatches = [...matches].sort((a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const match of sortedMatches) {
    if (match.result === "win") {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const allFrames = Object.values(liveFramesByMatch).flat();
  const bestBreak = allFrames.reduce((max, frame) => Math.max(max, frame.highest_break_user ?? 0), 0);
  const centuries = allFrames.filter((frame) => (frame.highest_break_user ?? 0) >= 100).length;

  const xp = matchesWon * 10 + sessionsLogged * 5;
  const playerLevel = getPlayerLevel(xp).level;

  return {
    matchesWon,
    matchesPlayed,
    sessionsLogged,
    bestBreak,
    centuries,
    longestWinStreak: longestStreak,
    playerLevel,
  };
};

const CATEGORY_INFO: Record<AchievementCategory, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }> = {
  matches: { label: "Matches", icon: "trophy", color: "#F59E0B" },
  breaks: { label: "Breaks", icon: "chart-line", color: "#10B981" },
  practice: { label: "Practice", icon: "clipboard-check", color: "#3B82F6" },
  streaks: { label: "Streaks", icon: "fire", color: "#EF4444" },
  special: { label: "Special", icon: "star", color: "#8B5CF6" },
};

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#A8A8A8",
  gold: "#FFD700",
  platinum: "#B4E4FF",
};

const TIER_GRADIENTS: Record<string, string[]> = {
  bronze: ["#CD7F32", "#8B4513"],
  silver: ["#C0C0C0", "#808080"],
  gold: ["#FFD700", "#FFA500"],
  platinum: ["#E5E4E2", "#A0D2DB"],
};

export const AchievementsScreen = () => {
  const { colors } = useAppTheme();
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const routines = useRoutinesStore((state) => state.routines);
  const totalFrames = useMemo(
    () => Object.values(liveFramesByMatch).reduce((sum, frames) => sum + frames.length, 0),
    [liveFramesByMatch]
  );
  const { seenAchievementIds, seenAchievementIdsOrdered } = useSeenAchievements(
    `${matches.length}-${sessions.length}-${entries.length}-${totalFrames}`
  );

  const [selectedCategory, setSelectedCategory] = React.useState<AchievementCategory | "all">("all");
  const [selectedAchievement, setSelectedAchievement] = React.useState<Achievement | null>(null);

  const xpAnim = useRef(new Animated.Value(0)).current;
  const levelScaleAnim = useRef(new Animated.Value(1)).current;
  const categoryAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.sequence([
      Animated.spring(levelScaleAnim, {
        toValue: 1.1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.spring(levelScaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const playerStats = useMemo(
    () => getPlayerStats(matches, sessions, entries, routines, liveFramesByMatch),
    [matches, sessions, entries, routines, liveFramesByMatch]
  );

  const unlockedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((a) => {
      if (seenAchievementIds.has(a.id)) return true;

      switch (a.requirement.type) {
        case "matches_won":
          return playerStats.matchesWon >= a.requirement.value;
        case "matches_played":
          return playerStats.matchesPlayed >= a.requirement.value;
        case "sessions_logged":
          return playerStats.sessionsLogged >= a.requirement.value;
        case "win_streak":
          return playerStats.longestWinStreak >= a.requirement.value;
        case "best_break":
          return playerStats.bestBreak >= a.requirement.value;
        case "centuries":
          return playerStats.centuries >= a.requirement.value;
        default:
          return false;
      }
    });
  }, [playerStats, seenAchievementIds]);

  const lockedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((a) => !unlockedAchievements.some((u) => u.id === a.id));
  }, [unlockedAchievements]);

  const xp = useMemo(
    () => unlockedAchievements.reduce((sum, achievement) => sum + achievement.xpReward, 0),
    [unlockedAchievements]
  );
  const levelInfo = getPlayerLevel(xp);

  const nextAchievement = useMemo(() => {
    const withProgress = lockedAchievements.map((a) => {
      const req = a.requirement;
      let current = 0;
      switch (req.type) {
        case "matches_won":
          current = playerStats.matchesWon;
          break;
        case "matches_played":
          current = playerStats.matchesPlayed;
          break;
        case "sessions_logged":
          current = playerStats.sessionsLogged;
          break;
        case "win_streak":
          current = playerStats.longestWinStreak;
          break;
        case "best_break":
          current = playerStats.bestBreak;
          break;
        case "centuries":
          current = playerStats.centuries;
          break;
      }
      const progress = Math.min(1, current / req.value);
      const remaining = req.value - current;
      return { achievement: a, progress, remaining, current };
    });

    return withProgress.sort((a, b) => {
      if (a.progress >= 1 && b.progress < 1) return -1;
      if (a.progress < 1 && b.progress >= 1) return 1;
      return b.progress - a.progress;
    })[0];
  }, [lockedAchievements, playerStats]);

  const recentUnlocks = useMemo(() => {
    return seenAchievementIdsOrdered
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((achievement): achievement is Achievement => !!achievement)
      .slice(-3)
      .reverse();
  }, [seenAchievementIdsOrdered]);

  const filteredAchievements = selectedCategory === "all"
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => a.category === selectedCategory);

  const categories: (AchievementCategory | "all")[] = ["all", "matches", "breaks", "practice", "streaks", "special"];

  const getProgress = (achievement: Achievement): number => {
    const req = achievement.requirement;
    switch (req.type) {
      case "matches_won":
        return Math.min(100, (playerStats.matchesWon / req.value) * 100);
      case "matches_played":
        return Math.min(100, (playerStats.matchesPlayed / req.value) * 100);
      case "sessions_logged":
        return Math.min(100, (playerStats.sessionsLogged / req.value) * 100);
      case "win_streak":
        return Math.min(100, (playerStats.longestWinStreak / req.value) * 100);
      case "best_break":
        return Math.min(100, (playerStats.bestBreak / req.value) * 100);
      case "centuries":
        return Math.min(100, (playerStats.centuries / req.value) * 100);
      default:
        return 0;
    }
  };

  const getCurrentValue = (achievement: Achievement): string => {
    const req = achievement.requirement;
    switch (req.type) {
      case "matches_won":
        return `${playerStats.matchesWon}/${req.value}`;
      case "matches_played":
        return `${playerStats.matchesPlayed}/${req.value}`;
      case "sessions_logged":
        return `${playerStats.sessionsLogged}/${req.value}`;
      case "win_streak":
        return `${playerStats.longestWinStreak}/${req.value}`;
      case "best_break":
        return `${playerStats.bestBreak}/${req.value}`;
      case "centuries":
        return `${playerStats.centuries}/${req.value}`;
      default:
        return "0";
    }
  };

  const animatedXpWidth = xpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${levelInfo.xpToNext === Infinity ? 100 : Math.min(100, (xp / (xp + levelInfo.xpToNext)) * 100)}%`],
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Level Header */}
      <AppCard style={styles.levelCard}>
        <Animated.View style={[styles.levelHeader, { transform: [{ scale: levelScaleAnim }] }]}>
          <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="star" size={20} color={colors.onPrimary} />
            <Text style={[styles.levelText, { color: colors.onPrimary }]}>Level {levelInfo.level}</Text>
          </View>
          <Text style={[styles.levelTitle, { color: colors.text }]}>{levelInfo.title}</Text>
        </Animated.View>
        <View style={styles.xpRow}>
          <Text style={[styles.xpLabel, { color: colors.textMuted }]}>Total XP</Text>
          <Text style={[styles.xpValue, { color: colors.text }]}>{xp}</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceMuted }]}>
            <Animated.View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: animatedXpWidth }]} />
          </View>
        </View>
        {levelInfo.xpToNext !== Infinity && (
          <Text style={[styles.xpToNext, { color: colors.textMuted }]}>{levelInfo.xpToNext} XP to next level</Text>
        )}
      </AppCard>

      {/* Recently Unlocked */}
      {recentUnlocks.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RECENTLY UNLOCKED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
            {recentUnlocks.map((achievement) => {
              const tierColor = TIER_COLORS[achievement.tier];
              return (
                <View key={achievement.id} style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: tierColor + "60" }]}>
                  <View style={[styles.recentIcon, { backgroundColor: tierColor + "20" }]}>
                    <MaterialCommunityIcons name={achievement.icon as any} size={24} color={tierColor} />
                  </View>
                  <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>{achievement.title}</Text>
                  <Text style={[styles.recentXp, { color: colors.primary }]}>+{achievement.xpReward}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Next Achievement */}
      {nextAchievement && (
        <AppCard style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
            <Text style={[styles.nextLabel, { color: colors.text }]}>Next Goal</Text>
          </View>
          <View style={styles.nextContent}>
            <View style={[styles.nextIcon, { backgroundColor: TIER_COLORS[nextAchievement.achievement.tier] + "20" }]}>
              <MaterialCommunityIcons name={nextAchievement.achievement.icon as any} size={28} color={TIER_COLORS[nextAchievement.achievement.tier]} />
            </View>
            <View style={styles.nextInfo}>
              <Text style={[styles.nextTitle, { color: colors.text }]}>{nextAchievement.achievement.title}</Text>
              <Text style={[styles.nextDesc, { color: colors.textMuted }]}>{nextAchievement.achievement.description}</Text>
              <View style={styles.nextProgress}>
                <View style={[styles.nextProgressBar, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.nextProgressFill, { backgroundColor: TIER_COLORS[nextAchievement.achievement.tier], width: `${nextAchievement.progress * 100}%` }]} />
                </View>
                <Text style={[styles.nextProgressText, { color: colors.text }]}>
                  {nextAchievement.current}/{nextAchievement.achievement.requirement.value}
                </Text>
              </View>
            </View>
          </View>
        </AppCard>
      )}

      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{unlockedAchievements.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Unlocked</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{ACHIEVEMENTS.length - unlockedAchievements.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Locked</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{unlockedAchievements.reduce((sum, a) => sum + a.xpReward, 0)}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>XP Earned</Text>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const info = cat === "all" ? { label: "All", icon: "check-all" as const, color: colors.textMuted } : CATEGORY_INFO[cat];
          return (
            <Pressable
              key={cat}
              style={[styles.categoryTab, { backgroundColor: isActive ? colors.primary : colors.surfaceMuted }]}
              onPress={() => setSelectedCategory(cat)}
            >
              <MaterialCommunityIcons
                name={info.icon}
                size={16}
                color={isActive ? colors.onPrimary : colors.textMuted}
              />
              <Text style={[styles.categoryTabText, { color: isActive ? colors.onPrimary : colors.textMuted }]}>
                {info.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Achievements List */}
      <View style={styles.achievementsList}>
        {filteredAchievements.map((achievement) => {
          const isUnlocked = unlockedAchievements.some((a) => a.id === achievement.id);
          const progress = getProgress(achievement);
          const tierColor = TIER_COLORS[achievement.tier];
          const tierGradient = TIER_GRADIENTS[achievement.tier];

          return (
            <Pressable
              key={achievement.id}
              style={[
                styles.achievementCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isUnlocked ? tierColor : colors.border,
                  opacity: isUnlocked ? 1 : 0.7,
                },
              ]}
              onPress={() => setSelectedAchievement(achievement)}
            >
              {isUnlocked && <View style={[styles.unlockedGlow, { backgroundColor: tierColor + "10" }]} />}
              <View style={styles.achievementHeader}>
                <View style={[styles.achievementIcon, { backgroundColor: isUnlocked ? tierColor + "20" : colors.surfaceMuted }]}>
                  <MaterialCommunityIcons
                    name={achievement.icon as any}
                    size={24}
                    color={isUnlocked ? tierColor : colors.textMuted}
                  />
                  {isUnlocked && (
                    <View style={[styles.checkBadge, { backgroundColor: tierColor }]}>
                      <MaterialCommunityIcons name="check" size={10} color="#FFF" />
                    </View>
                  )}
                  {!isUnlocked && (
                    <View style={styles.lockBadge}>
                      <MaterialCommunityIcons name="lock" size={10} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                <View style={styles.achievementInfo}>
                  <Text style={[styles.achievementTitle, { color: isUnlocked ? colors.text : colors.textMuted }]}>
                    {achievement.title}
                  </Text>
                  <Text style={[styles.achievementDescription, { color: colors.textMuted }]} numberOfLines={1}>
                    {achievement.description}
                  </Text>
                </View>
              </View>
              {!isUnlocked && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: tierColor }]} />
                  </View>
                  <Text style={[styles.progressText, { color: colors.textMuted }]}>{getCurrentValue(achievement)} ({Math.round(progress)}%)</Text>
                </View>
              )}
              <View style={styles.achievementFooter}>
                <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
                  <Text style={[styles.tierText, { color: tierColor }]}>{achievement.tier.toUpperCase()}</Text>
                </View>
                <Text style={[styles.xpText, { color: isUnlocked ? colors.textMuted : colors.primary }]}>+{achievement.xpReward} XP</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Achievement Detail Modal */}
      <Modal visible={!!selectedAchievement} transparent animationType="fade" onRequestClose={() => setSelectedAchievement(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedAchievement(null)}>
          {selectedAchievement && (
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View
                style={[
                  styles.modalIcon,
                  {
                    backgroundColor: unlockedAchievements.some((a) => a.id === selectedAchievement.id)
                      ? TIER_COLORS[selectedAchievement.tier] + "20"
                      : colors.surfaceMuted,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={selectedAchievement.icon as any}
                  size={48}
                  color={unlockedAchievements.some((a) => a.id === selectedAchievement.id) ? TIER_COLORS[selectedAchievement.tier] : colors.textMuted}
                />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedAchievement.title}</Text>
              <Text style={[styles.modalDescription, { color: colors.textMuted }]}>{selectedAchievement.description}</Text>
              <View style={[styles.modalTier, { backgroundColor: TIER_COLORS[selectedAchievement.tier] + "20" }]}>
                <Text style={[styles.modalTierText, { color: TIER_COLORS[selectedAchievement.tier] }]}>
                  {selectedAchievement.tier.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.modalXp, { color: colors.primary }]}>+{selectedAchievement.xpReward} XP</Text>
              <Pressable style={[styles.modalClose, { backgroundColor: colors.surfaceMuted }]} onPress={() => setSelectedAchievement(null)}>
                <Text style={[styles.modalCloseText, { color: colors.text }]}>Close</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  // Level Card
  levelCard: { alignItems: "center", marginBottom: 16 },
  levelHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  levelText: { fontSize: 14, fontWeight: "800" },
  levelTitle: { fontSize: 20, fontWeight: "700" },
  xpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  xpLabel: { fontSize: 13 },
  xpValue: { fontSize: 18, fontWeight: "700" },
  progressRow: { width: "100%", marginBottom: 8 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  xpToNext: { fontSize: 12 },

  // Recent Unlocks
  recentSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  recentScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  recentCard: { width: 110, borderRadius: 12, borderWidth: 1.5, padding: 12, alignItems: "center", marginRight: 10 },
  recentIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  recentTitle: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  recentXp: { fontSize: 11, fontWeight: "600" },

  // Next Achievement
  nextCard: { marginBottom: 16 },
  nextHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  nextLabel: { fontSize: 14, fontWeight: "700" },
  nextContent: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  nextIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  nextInfo: { flex: 1 },
  nextTitle: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  nextDesc: { fontSize: 13, marginBottom: 10 },
  nextProgress: { flexDirection: "row", alignItems: "center", gap: 10 },
  nextProgressBar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  nextProgressFill: { height: "100%", borderRadius: 4 },
  nextProgressText: { fontSize: 13, fontWeight: "600", minWidth: 50 },

  // Stats Row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },

  // Category Tabs
  categoryTabs: { marginBottom: 16 },
  categoryTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginRight: 8 },
  categoryTabText: { fontSize: 13, fontWeight: "600" },

  // Achievements List
  achievementsList: { gap: 10 },
  achievementCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, overflow: "hidden" },
  unlockedGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  achievementHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  achievementIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", position: "relative" },
  checkBadge: { position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  lockBadge: { position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  achievementInfo: { flex: 1 },
  achievementTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  achievementDescription: { fontSize: 12 },
  progressContainer: { marginTop: 12 },
  progressText: { fontSize: 11, marginTop: 4, textAlign: "right" },
  achievementFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tierText: { fontSize: 10, fontWeight: "700" },
  xpText: { fontSize: 13, fontWeight: "600" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 320, borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center" },
  modalIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  modalDescription: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 12 },
  modalTier: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  modalTierText: { fontSize: 12, fontWeight: "700" },
  modalXp: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  modalClose: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  modalCloseText: { fontSize: 14, fontWeight: "600" },
});
