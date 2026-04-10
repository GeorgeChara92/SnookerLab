import React, { useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore, useMatchesStore, useSessionsStore, useRoutineScoresStore, useRoutinesStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { SNOOKER_PRESET_AVATARS, isAvatarUnlocked, type PresetAvatar } from "../../constants/profileAvatars";
import { SnookerPresetAvatar } from "../../components/profile/SnookerPresetAvatar";
import { ACHIEVEMENTS, getPlayerLevel, type Achievement } from "../../constants/achievements";
import { getSkillLabel, getCuePreferenceLabel, getCountryByCode } from "../../constants/profileOptions";
import type { Match, SessionLog, RoutineScoreEntry, Routine } from "../../types";

type AchievementStats = {
  matchesWon: number;
  matchesPlayed: number;
  sessionsLogged: number;
  bestBreak: number;
  longestWinStreak: number;
  playerLevel: number;
  winRate: number;
  mostTrainedCategory: string | null;
};

const getPlayerStats = (
  matches: Match[],
  sessions: SessionLog[],
  entries: RoutineScoreEntry[],
  routines: Routine[],
  userId: string
): AchievementStats => {
  const matchesWon = matches.filter((m: Match) => m.result === "win").length;
  const matchesPlayed = matches.length;
  const sessionsLogged = sessions.length + entries.length;
  const winRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;

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

  const categoryCounts = new Map<string, number>();
  entries.forEach((entry: RoutineScoreEntry) => {
    const routine = routines.find((r: Routine) => r.id === entry.routine_id);
    if (routine?.category_id) {
      categoryCounts.set(routine.category_id, (categoryCounts.get(routine.category_id) ?? 0) + 1);
    }
  });
  let mostTrainedCategory: string | null = null;
  let maxCount = 0;
  categoryCounts.forEach((count: number, catId: string) => {
    if (count > maxCount) {
      maxCount = count;
      mostTrainedCategory = catId;
    }
  });

  const xp = matchesWon * 10 + sessionsLogged * 5;
  const playerLevel = getPlayerLevel(xp).level;

  return {
    matchesWon,
    matchesPlayed,
    sessionsLogged,
    bestBreak: 0,
    longestWinStreak: longestStreak,
    playerLevel,
    winRate,
    mostTrainedCategory,
  };
};

const getCategoryLabel = (categoryId: string | null): string => {
  const labels: Record<string, string> = {
    "cat-basics": "Fundamentals",
    "cat-break-building": "Break Building",
    "cat-safety": "Safety Play",
    "cat-straight-cueing": "Straight Cueing",
    "cat-cue-ball-control": "Cue Ball Control",
    "cat-long-potting": "Long Potting",
  };
  return categoryId ? labels[categoryId] ?? categoryId : "None";
};

export const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut, updateAvatarPreset } = useAuthStore();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { width } = useWindowDimensions();

  const matches = useMatchesStore((state) => state.matches);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const routines = useRoutinesStore((state) => state.routines);
  const categories = useRoutinesStore((state) => state.categories);

  const [activeGalleryPage, setActiveGalleryPage] = useState(0);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [lockedAvatar, setLockedAvatar] = useState<PresetAvatar | null>(null);

  const playerStats = useMemo(
    () => getPlayerStats(matches, sessions, entries, routines, user?.id ?? ""),
    [matches, sessions, entries, routines, user?.id]
  );

  const xp = playerStats.matchesWon * 10 + playerStats.sessionsLogged * 5;
  const levelInfo = getPlayerLevel(xp);

  const playerPresets = SNOOKER_PRESET_AVATARS.filter((preset) => preset.group === "player");
  const snookerPresets = SNOOKER_PRESET_AVATARS.filter((preset) => preset.group !== "player");

  const galleryPages = useMemo(() => {
    const pages: typeof snookerPresets[] = [];
    for (let index = 0; index < snookerPresets.length; index += 9) {
      pages.push(snookerPresets.slice(index, index + 9));
    }
    return pages;
  }, [snookerPresets]);

  const galleryPageWidth = Math.max(270, width - 60);

  const handleSignOut = async () => {
    await signOut();
  };

  const handlePresetSelect = async (presetId: string) => {
    try {
      await updateAvatarPreset(presetId);
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message ?? "Could not save your preset avatar.");
    }
  };

  const handleAvatarPress = (preset: PresetAvatar) => {
    const unlocked = isAvatarUnlocked(preset, playerStats);
    if (unlocked) {
      handlePresetSelect(preset.id);
    } else {
      setLockedAvatar(preset);
    }
  };

  const getUnlockConditionText = (avatar: PresetAvatar): string => {
    if (!avatar.unlockCondition) return "Available from start";
    const { type, value } = avatar.unlockCondition;
    switch (type) {
      case "matches_won":
        return `Win ${value} match${value > 1 ? "es" : ""}`;
      case "matches_played":
        return `Play ${value} match${value > 1 ? "es" : ""}`;
      case "sessions_logged":
        return `Complete ${value} practice session${value > 1 ? "s" : ""}`;
      case "best_break":
        return `Record a break of ${value}+ points`;
      case "win_streak":
        return `Win ${value} matches in a row`;
      case "level":
        return `Reach Level ${value}`;
      default:
        return "Unlock condition unknown";
    }
  };

  const getUnlockProgressText = (avatar: PresetAvatar): string => {
    if (!avatar.unlockCondition) return "";
    const { type, value } = avatar.unlockCondition;
    const current: Record<string, number> = {
      matches_won: playerStats.matchesWon,
      matches_played: playerStats.matchesPlayed,
      sessions_logged: playerStats.sessionsLogged,
      best_break: playerStats.bestBreak,
      win_streak: playerStats.longestWinStreak,
      level: playerStats.playerLevel,
    };
    const progress = current[type] ?? 0;
    return `${Math.min(progress, value)} / ${value}`;
  };

  const unlockedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((a) => {
      switch (a.requirement.type) {
        case "matches_won":
          return playerStats.matchesWon >= a.requirement.value;
        case "matches_played":
          return playerStats.matchesPlayed >= a.requirement.value;
        case "sessions_logged":
          return playerStats.sessionsLogged >= a.requirement.value;
        case "win_streak":
          return playerStats.longestWinStreak >= a.requirement.value;
        default:
          return false;
      }
    });
  }, [playerStats]);

  const renderProgressBar = (current: number, max: number | null, label: string, color?: string) => {
    const percentage = max ? Math.min(100, (current / max) * 100) : 100;
    const displayMax = max ?? "∞";

    return (
      <View style={styles.progressRow}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.progressValue, { color: colors.textMuted }]}>
            {current} / {displayMax}
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${percentage}%`, backgroundColor: color ?? colors.primary },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <AppCard style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.primary }]}>
            {user?.profile_image_url ? (
              <Image source={{ uri: user.profile_image_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <SnookerPresetAvatar presetId={user?.avatar_preset} size={80} />
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate("SubscriptionPlans")}
            style={[styles.tierBadge, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="crown" size={12} color={colors.onPrimary} />
            <Text style={[styles.tierText, { color: colors.onPrimary }]}>{subscription.tierLabel}</Text>
          </Pressable>
        </View>

        <Text style={[styles.playerName, { color: colors.text }]}>{user?.username || "Snooker Player"}</Text>
        <View style={styles.levelRow}>
          <View style={[styles.levelBadge, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="star" size={14} color={colors.primary} />
            <Text style={[styles.levelText, { color: colors.text }]}>Lv. {levelInfo.level}</Text>
          </View>
          <Text style={[styles.levelTitle, { color: colors.primary }]}>{levelInfo.title}</Text>
        </View>

        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{playerStats.matchesWon}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Wins</Text>
          </View>
          <View style={[styles.quickStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{playerStats.winRate}%</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Win Rate</Text>
          </View>
          <View style={[styles.quickStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{playerStats.sessionsLogged}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Sessions</Text>
          </View>
        </View>
      </AppCard>

      {/* Performance Snapshot */}
      <AppCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="chart-bar" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance Snapshot</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="trophy" size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{playerStats.matchesWon}W - {playerStats.matchesPlayed - playerStats.matchesWon}L</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Match Record</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="fire" size={24} color="#F59E0B" />
            <Text style={[styles.statValue, { color: colors.text }]}>{playerStats.longestWinStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best Streak</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="target" size={24} color="#10B981" />
            <Text style={[styles.statValue, { color: colors.text }]}>{getCategoryLabel(playerStats.mostTrainedCategory)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Most Trained</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="medal" size={24} color="#8B5CF6" />
            <Text style={[styles.statValue, { color: colors.text }]}>{unlockedAchievements.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Achievements</Text>
          </View>
        </View>
      </AppCard>

      {/* Achievements */}
      <AppCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="medal-outline" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
            {unlockedAchievements.length}/{ACHIEVEMENTS.length}
          </Text>
        </View>

        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.slice(0, 8).map((achievement) => {
            const isUnlocked = unlockedAchievements.some((a) => a.id === achievement.id);
            return (
              <Pressable
                key={achievement.id}
                style={[
                  styles.achievementItem,
                  { backgroundColor: isUnlocked ? colors.surfaceMuted : colors.surface, borderColor: isUnlocked ? colors.primary : colors.border },
                ]}
                onPress={() => setSelectedAchievement(achievement)}
              >
                <View style={[styles.achievementIcon, { opacity: isUnlocked ? 1 : 0.3 }]}>
                  <MaterialCommunityIcons
                    name={achievement.icon as any}
                    size={24}
                    color={isUnlocked ? colors.primary : colors.textMuted}
                  />
                </View>
                {!isUnlocked && (
                  <View style={styles.lockedOverlay}>
                    <MaterialCommunityIcons name="lock" size={14} color={colors.textMuted} />
                  </View>
                )}
                <Text
                  style={[styles.achievementTitle, { color: isUnlocked ? colors.text : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {achievement.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.viewAllButton}>
          <AppButton label="View All Achievements" variant="secondary" onPress={() => navigation.navigate("Achievements")} />
        </View>
      </AppCard>

      {/* Avatars */}
      <AppCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="account-circle" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Player Avatars</Text>
        </View>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Unlock avatars by playing matches and practicing.</Text>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Progression Avatars</Text>
        <View style={styles.playerRow}>
          {playerPresets.map((preset) => {
            const selected = user?.avatar_preset === preset.id;
            const unlocked = isAvatarUnlocked(preset, playerStats);

            return (
              <Pressable
                key={preset.id}
                onPress={() => handleAvatarPress(preset)}
                style={[
                  styles.playerCard,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                    opacity: unlocked ? 1 : 0.5,
                  },
                ]}
              >
                <View style={!unlocked && styles.lockedAvatar}>
                  <SnookerPresetAvatar presetId={preset.id} size={52} />
                  {!unlocked && (
                    <View style={styles.avatarLock}>
                      <MaterialCommunityIcons name="lock" size={16} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                <Text style={[styles.presetLabel, { color: colors.text }]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Snooker Icons</Text>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.galleryScroll}
          contentContainerStyle={styles.galleryContent}
          onMomentumScrollEnd={(event) => {
            const page = Math.round(event.nativeEvent.contentOffset.x / galleryPageWidth);
            setActiveGalleryPage(page);
          }}
        >
          {galleryPages.map((page, pageIndex) => (
            <View key={`gallery-page-${pageIndex}`} style={[styles.galleryPage, { width: galleryPageWidth }]}>
              <View style={styles.galleryGrid}>
                {page.map((preset) => {
                  const selected = user?.avatar_preset === preset.id;
                  const unlocked = isAvatarUnlocked(preset, playerStats);

                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => handleAvatarPress(preset)}
                      style={[
                        styles.presetCard,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                          opacity: unlocked ? 1 : 0.5,
                        },
                      ]}
                    >
                      <View style={!unlocked && styles.lockedAvatar}>
                        <SnookerPresetAvatar presetId={preset.id} size={44} />
                        {!unlocked && (
                          <View style={styles.avatarLock}>
                            <MaterialCommunityIcons name="lock" size={14} color={colors.textMuted} />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.presetLabel, { color: colors.text }]}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
        {galleryPages.length > 1 && (
          <View style={styles.pageDotsRow}>
            {galleryPages.map((_, index) => {
              const active = index === activeGalleryPage;
              return (
                <View
                  key={`gallery-dot-${index}`}
                  style={[
                    styles.pageDot,
                    { backgroundColor: active ? colors.primary : colors.border, width: active ? 20 : 8 },
                  ]}
                />
              );
            })}
          </View>
        )}
      </AppCard>

      {/* Plan Usage */}
      <AppCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Plan Usage</Text>
        </View>
        {renderProgressBar(subscription.usage.matches, subscription.limits.matchesPerPeriod, "Matches", colors.primary)}
        {renderProgressBar(subscription.usage.tournaments, subscription.limits.tournamentsPerPeriod, "Tournaments", "#F59E0B")}
        {renderProgressBar(subscription.usage.aiAnalyses, subscription.limits.aiAnalysesPerPeriod, "AI Analyses", "#8B5CF6")}
      </AppCard>

      {/* Global Profile */}
      <AppCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="earth" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Player Profile</Text>
        </View>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Your profile for worldwide leaderboards and challenges.</Text>

        <Pressable style={[styles.profileField, { borderColor: colors.border }]} onPress={() => navigation.navigate("EditProfileField", { field: "skill_level" })}>
          <View style={styles.profileFieldLeft}>
            <MaterialCommunityIcons name="star-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.profileFieldLabel, { color: colors.textMuted }]}>Skill Level</Text>
          </View>
          <View style={styles.profileFieldRight}>
            <Text style={[styles.profileFieldValue, { color: colors.text }]}>{getSkillLabel(user?.skill_level)}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </View>
        </Pressable>

        <Pressable style={[styles.profileField, { borderColor: colors.border }]} onPress={() => navigation.navigate("EditProfileField", { field: "country_code" })}>
          <View style={styles.profileFieldLeft}>
            <MaterialCommunityIcons name="flag-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.profileFieldLabel, { color: colors.textMuted }]}>Country</Text>
          </View>
          <View style={styles.profileFieldRight}>
            {user?.country_code && (
              <Text style={styles.countryEmoji}>{getCountryByCode(user.country_code)?.emoji ?? ""}</Text>
            )}
            <Text style={[styles.profileFieldValue, { color: colors.text }]}>
              {user?.country_code ? (getCountryByCode(user.country_code)?.name ?? user.country_code) : "Not set"}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </View>
        </Pressable>

        <Pressable style={[styles.profileField, { borderColor: colors.border }]} onPress={() => navigation.navigate("EditProfileField", { field: "cue_preference" })}>
          <View style={styles.profileFieldLeft}>
            <MaterialCommunityIcons name="golf-tee" size={20} color={colors.textMuted} />
            <Text style={[styles.profileFieldLabel, { color: colors.textMuted }]}>Cue Setup</Text>
          </View>
          <View style={styles.profileFieldRight}>
            <Text style={[styles.profileFieldValue, { color: colors.text }]}>{getCuePreferenceLabel(user?.cue_preference)}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </View>
        </Pressable>
      </AppCard>

      {/* Settings */}
      <AppCard style={styles.sectionCard}>
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate("Settings")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Account Settings</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => navigation.navigate("SubscriptionPlans")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="credit-card-outline" size={22} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Manage Subscription</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => {}}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="help-circle-outline" size={22} color={colors.text} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Help & Support</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>
      </AppCard>

      {/* Sign Out */}
      <View style={styles.signOutContainer}>
        <Pressable onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={[styles.signOutText, { color: colors.textMuted }]}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Achievement Detail Modal */}
      <Modal visible={!!selectedAchievement} transparent animationType="fade" onRequestClose={() => setSelectedAchievement(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedAchievement(null)}>
          {selectedAchievement && (
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.modalIcon, { backgroundColor: colors.surfaceMuted }]}>
                <MaterialCommunityIcons
                  name={selectedAchievement.icon as any}
                  size={40}
                  color={unlockedAchievements.some((a) => a.id === selectedAchievement.id) ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedAchievement.title}</Text>
              <Text style={[styles.modalDescription, { color: colors.textMuted }]}>{selectedAchievement.description}</Text>
              <View style={[styles.modalTier, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.modalTierText, { color: colors.text }]}>{selectedAchievement.tier.toUpperCase()}</Text>
              </View>
              <Text style={[styles.modalXp, { color: colors.primary }]}>+{selectedAchievement.xpReward} XP</Text>
              <View style={styles.modalClose}>
              <AppButton label="Close" variant="secondary" onPress={() => setSelectedAchievement(null)} />
            </View>
            </View>
          )}
        </Pressable>
      </Modal>

      {/* Locked Avatar Modal */}
      <Modal visible={!!lockedAvatar} transparent animationType="fade" onRequestClose={() => setLockedAvatar(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLockedAvatar(null)}>
          {lockedAvatar && (
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.avatarModalIcon, { backgroundColor: colors.surfaceMuted }]}>
                <SnookerPresetAvatar presetId={lockedAvatar.id} size={56} />
                <View style={styles.avatarModalLock}>
                  <MaterialCommunityIcons name="lock" size={20} color={colors.textMuted} />
                </View>
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{lockedAvatar.label}</Text>
              {lockedAvatar.tag && (
                <View style={[styles.avatarTag, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.avatarTagText, { color: colors.primary }]}>{lockedAvatar.tag}</Text>
                </View>
              )}
              <Text style={[styles.avatarUnlockLabel, { color: colors.textMuted }]}>Unlock Requirement</Text>
              <Text style={[styles.avatarUnlockText, { color: colors.text }]}>{getUnlockConditionText(lockedAvatar)}</Text>
              {lockedAvatar.unlockCondition && (() => {
                const progressPercent = (() => {
                  const type = lockedAvatar.unlockCondition!.type;
                  const value = lockedAvatar.unlockCondition!.value;
                  const current: Record<string, number> = {
                    matches_won: playerStats.matchesWon,
                    matches_played: playerStats.matchesPlayed,
                    sessions_logged: playerStats.sessionsLogged,
                    best_break: playerStats.bestBreak,
                    win_streak: playerStats.longestWinStreak,
                    level: playerStats.playerLevel,
                  };
                  const progress = current[type] ?? 0;
                  return Math.min(100, (progress / value) * 100);
                })();
                return (
                  <View style={[styles.avatarProgressBar, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.avatarProgressFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]} />
                  </View>
                );
              })()}
              <Text style={[styles.avatarProgressText, { color: colors.textMuted }]}>
                {getUnlockProgressText(lockedAvatar)}
              </Text>
              <View style={styles.modalClose}>
                <AppButton label="Got it" variant="secondary" onPress={() => setLockedAvatar(null)} />
              </View>
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

  // Profile Header
  profileHeader: { alignItems: "center", paddingBottom: 20 },
  avatarContainer: { alignItems: "center", marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  tierText: { fontSize: 12, fontWeight: "800" },
  playerName: { fontSize: 24, fontWeight: "800", marginTop: 8 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: { fontSize: 13, fontWeight: "700" },
  levelTitle: { fontSize: 14, fontWeight: "600" },
  quickStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },
  quickStatItem: { alignItems: "center", flex: 1 },
  quickStatValue: { fontSize: 20, fontWeight: "800" },
  quickStatLabel: { fontSize: 11, marginTop: 2 },
  quickStatDivider: { width: 1, height: 30 },

  // Section Styles
  sectionCard: { marginTop: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  sectionCount: { fontSize: 13, fontWeight: "600" },
  sectionHint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  subSectionTitle: { marginTop: 12, marginBottom: 8, fontSize: 14, fontWeight: "700" },

  // Stats Grid
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    width: "48%",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  statLabel: { fontSize: 11, marginTop: 2 },

  // Achievements
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  achievementItem: {
    width: "23%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  achievementIcon: { alignItems: "center", justifyContent: "center" },
  lockedOverlay: { position: "absolute", top: 4, right: 4 },
  achievementTitle: { fontSize: 9, fontWeight: "700", marginTop: 4, textAlign: "center" },
  viewAllButton: { marginTop: 12 },

  // Avatars
  playerRow: { flexDirection: "row", gap: 8 },
  playerCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  lockedAvatar: { position: "relative" },
  avatarLock: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -8,
    marginLeft: -8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    padding: 2,
  },
  galleryScroll: { marginHorizontal: -2 },
  galleryContent: { paddingRight: 8 },
  galleryPage: { paddingRight: 10 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pageDotsRow: { marginTop: 10, flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 6 },
  pageDot: { height: 8, borderRadius: 5 },
  presetCard: {
    width: "31%",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  presetLabel: { marginTop: 4, fontSize: 10, fontWeight: "700", textAlign: "center" },

  // Progress Bars
  progressRow: { marginTop: 12 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  progressLabel: { fontSize: 13, fontWeight: "600" },
  progressValue: { fontSize: 13 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },

  // Profile Fields
  profileField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  profileFieldLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileFieldLabel: { fontSize: 14 },
  profileFieldRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  profileFieldValue: { fontSize: 14, fontWeight: "600" },
  countryEmoji: { fontSize: 18, marginRight: 6 },

  // Menu Items
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuItemText: { fontSize: 15, fontWeight: "500" },

  // Sign Out
  signOutContainer: { marginTop: 20, alignItems: "center" },
  signOutButton: { paddingVertical: 10, paddingHorizontal: 20 },
  signOutText: { fontSize: 14, fontWeight: "500" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 320, borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center" },
  modalIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  modalDescription: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 12 },
  modalTier: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  modalTierText: { fontSize: 11, fontWeight: "700" },
  modalXp: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  modalClose: { marginTop: 16, width: "100%" },

  // Avatar Modal
  avatarModalIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 12, position: "relative" },
  avatarModalLock: { position: "absolute", bottom: -4, right: -4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 },
  avatarTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  avatarTagText: { fontSize: 11, fontWeight: "700" },
  avatarUnlockLabel: { fontSize: 11, fontWeight: "600", marginTop: 16, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 },
  avatarUnlockText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  avatarProgressBar: { width: "100%", height: 8, borderRadius: 4, marginTop: 12, overflow: "hidden" },
  avatarProgressFill: { height: "100%", borderRadius: 4 },
  avatarProgressText: { fontSize: 12, marginTop: 6 },
});
