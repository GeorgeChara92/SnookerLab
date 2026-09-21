import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { ACHIEVEMENTS, type Achievement, type AchievementCategory } from "../../constants/achievements";
import { usePlayerProgress } from "../../features/profile/playerProgress";
import { useUnlockQueue } from "../../components/achievements/UnlockQueueProvider";
import { achievementCurrent } from "../../features/profile/playerStats";
import { FONTS, RADIUS, SPACING } from "../../constants";

const CATEGORIES: Array<{ value: AchievementCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "matches", label: "Matches" },
  { value: "breaks", label: "Breaks" },
  { value: "practice", label: "Practice" },
  { value: "streaks", label: "Streaks" },
  { value: "special", label: "Special" },
];

/** Metal tiers, a touch muted so they sit on the dark cards rather than glowing on them. */
const TIER: Record<Achievement["tier"], { label: string; colour: string }> = {
  bronze: { label: "Bronze", colour: "#B8784A" },
  silver: { label: "Silver", colour: "#A9B4B8" },
  gold: { label: "Gold", colour: "#D4A93C" },
  platinum: { label: "Platinum", colour: "#9FD3E0" },
};

export const AchievementsScreen = () => {
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { stats, unlocked, xp, level, nextGoal, recentUnlocks } = usePlayerProgress();
  const [category, setCategory] = useState<AchievementCategory | "all">("all");

  const isUnlocked = (achievement: Achievement) => unlocked.includes(achievement);

  // Unlocked first, then the ones you are closest to.
  const list = ACHIEVEMENTS.filter((achievement) => category === "all" || achievement.category === category)
    .map((achievement) => {
      const current = achievementCurrent(achievement, stats);
      return { achievement, current, progress: Math.min(1, current / achievement.requirement.value) };
    })
    .sort((a, b) => {
      const aDone = isUnlocked(a.achievement);
      const bDone = isUnlocked(b.achievement);
      if (aDone !== bDone) return aDone ? -1 : 1;
      return b.progress - a.progress;
    });

  // Only offer categories that have something in them.
  const categories = CATEGORIES.filter(
    (item) => item.value === "all" || ACHIEVEMENTS.some((achievement) => achievement.category === item.value)
  );

  const { showAchievementUnlock, showLevelUp } = useUnlockQueue();

  const openDetail = (achievement: Achievement, current: number) => {
    const done = isUnlocked(achievement);
    // An earned achievement plays its moment again.
    if (done) {
      showAchievementUnlock(achievement.id);
      return;
    }
    dialog.alert({
      title: achievement.title,
      message: done
        ? `${achievement.description}. Unlocked, and worth ${achievement.xpReward} XP.`
        : `${achievement.description}. You are on ${Math.min(current, achievement.requirement.value)} of ${
            achievement.requirement.value
          }, and it is worth ${achievement.xpReward} XP.`,
      icon: achievement.icon,
      tone: done ? "success" : "default",
      confirmLabel: "Done",
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------------------------------------- level */}
      <Pressable
        onPress={() => showLevelUp(level.level, level.level - 1)}
        accessibilityRole="button"
        accessibilityHint="Plays your last level-up again"
      >
        <BoardPanel kicker="YOUR LEVEL" aside={`${xp} XP`}>
          <View style={styles.levelRow}>
            <Text style={[styles.levelValue, { color: colors.boardText }]}>{level.level}</Text>
            <View style={styles.levelText}>
              <Text style={[styles.levelTitle, { color: colors.boardText }]}>{level.title.toUpperCase()}</Text>
              <Text style={[styles.levelNext, { color: colors.boardMuted }]}>
                {level.nextTitle ? `${level.xpToNext} XP TO ${level.nextTitle.toUpperCase()}` : "TOP LEVEL REACHED"}
              </Text>
            </View>
            <View style={styles.unlockedBox}>
              <Text style={[styles.unlockedValue, { color: colors.boardText }]}>
                {unlocked.length}
                <Text style={{ color: colors.boardMuted }}>/{ACHIEVEMENTS.length}</Text>
              </Text>
              <Text style={[styles.unlockedLabel, { color: colors.boardMuted }]}>UNLOCKED</Text>
            </View>
          </View>
          <View style={[styles.track, { backgroundColor: colors.boardRaised }]}>
            <View
              style={[styles.fill, { width: `${Math.round(level.progress * 100)}%`, backgroundColor: colors.primary }]}
            />
          </View>
        </BoardPanel>
      </Pressable>

      {/* ---------------------------------------------------------------- next up */}
      {nextGoal ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.textMuted }]}>NEXT UP</Text>
          <View style={styles.nextRow}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name={nextGoal.achievement.icon} size={24} color={colors.primary} />
            </View>
            <View style={styles.nextText}>
              <Text style={[styles.title, { color: colors.text }]}>{nextGoal.achievement.title}</Text>
              <Text style={[styles.description, { color: colors.textMuted }]}>{nextGoal.achievement.description}</Text>
            </View>
            <Text style={[styles.count, { color: colors.text }]}>
              {Math.min(nextGoal.current, nextGoal.achievement.requirement.value)}/
              {nextGoal.achievement.requirement.value}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${nextGoal.progress * 100}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>
      ) : null}

      {/* ---------------------------------------------------------------- recent */}
      {recentUnlocks.length ? (
        <>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>RECENTLY UNLOCKED</Text>
          <View style={styles.recent}>
            {recentUnlocks.map((achievement) => (
              <View
                key={achievement.id}
                style={[styles.recentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons name={achievement.icon} size={22} color={TIER[achievement.tier].colour} />
                <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                  {achievement.title}
                </Text>
                <Text style={[styles.recentXp, { color: colors.primary }]}>+{achievement.xpReward} XP</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* ---------------------------------------------------------------- everything */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {categories.map((item) => {
          const selected = category === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setCategory(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.filter,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterText, { color: selected ? colors.onPrimary : colors.text }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {list.map(({ achievement, current, progress }) => {
        const done = isUnlocked(achievement);
        const tier = TIER[achievement.tier];

        return (
          <Pressable
            key={achievement.id}
            onPress={() => openDetail(achievement, current)}
            accessibilityRole="button"
            accessibilityLabel={`${achievement.title}, ${tier.label}, ${done ? "unlocked" : "locked"}`}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: done ? `${tier.colour}22` : colors.surfaceMuted }]}>
              <MaterialCommunityIcons
                name={done ? achievement.icon : "lock-outline"}
                size={22}
                color={done ? tier.colour : colors.textSubtle}
              />
            </View>

            <View style={styles.itemBody}>
              <View style={styles.itemHead}>
                <Text style={[styles.title, { color: done ? colors.text : colors.textMuted }]} numberOfLines={1}>
                  {achievement.title}
                </Text>
                <Text style={[styles.xp, { color: done ? colors.primary : colors.textSubtle }]}>
                  {achievement.xpReward} XP
                </Text>
              </View>
              <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={1}>
                {achievement.description}
              </Text>

              <View style={styles.itemFoot}>
                <Text style={[styles.tier, { color: tier.colour }]}>{tier.label.toUpperCase()}</Text>
                {done ? (
                  <Text style={[styles.status, { color: colors.primary }]}>UNLOCKED</Text>
                ) : (
                  <>
                    <View style={[styles.miniTrack, { backgroundColor: colors.surfaceMuted }]}>
                      <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.textMuted }]} />
                    </View>
                    <Text style={[styles.status, { color: colors.textMuted }]}>
                      {Math.min(current, achievement.requirement.value)}/{achievement.requirement.value}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },

  levelRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  levelValue: { fontFamily: FONTS.boardHeavy, fontSize: 64, lineHeight: 70, fontVariant: ["tabular-nums"] },
  levelText: { flex: 1, gap: 2 },
  levelTitle: { fontFamily: FONTS.board, fontSize: 24, letterSpacing: 0.8 },
  levelNext: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2 },
  unlockedBox: { alignItems: "flex-end" },
  unlockedValue: { fontFamily: FONTS.board, fontSize: 26, fontVariant: ["tabular-nums"] },
  unlockedLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1.4 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: SPACING.md },
  fill: { height: "100%", borderRadius: 3 },

  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.6, marginBottom: SPACING.sm },
  nextRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  nextText: { flex: 1 },
  count: { fontFamily: FONTS.board, fontSize: 22, fontVariant: ["tabular-nums"] },

  icon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  title: { flexShrink: 1, fontSize: 15, fontWeight: "700" },
  description: { fontSize: 13, marginTop: 1 },

  groupLabel: {
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 1.6,
    marginTop: SPACING.xs,
    marginBottom: -4,
  },
  recent: { flexDirection: "row", gap: SPACING.sm },
  recentItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  recentTitle: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  recentXp: { fontFamily: FONTS.board, fontSize: 14 },

  filters: { gap: SPACING.sm, paddingVertical: SPACING.xs },
  filter: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  filterText: { fontSize: 13, fontWeight: "700" },

  item: {
    flexDirection: "row",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  itemBody: { flex: 1 },
  itemHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACING.sm },
  xp: { fontFamily: FONTS.board, fontSize: 14 },
  itemFoot: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  tier: { fontFamily: FONTS.board, fontSize: 12, letterSpacing: 1.4 },
  miniTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  status: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
});
