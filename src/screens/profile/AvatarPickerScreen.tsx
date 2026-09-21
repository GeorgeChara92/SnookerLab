import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { SNOOKER_PRESET_AVATARS, isAvatarUnlocked, type PresetAvatar } from "../../constants/profileAvatars";
import { SnookerPresetAvatar } from "../../components/profile/SnookerPresetAvatar";
import { usePlayerProgress, type PlayerStats } from "../../features/profile/playerProgress";
import { FONTS, RADIUS, SPACING } from "../../constants";

/**
 * Choosing an avatar. It used to be a large block in the middle of the profile page; picking one
 * is an occasional thing, so it has a page of its own reached by tapping your avatar.
 */

const unlockText = (avatar: PresetAvatar): string => {
  if (!avatar.unlockCondition) return "Available from the start";
  const { type, value } = avatar.unlockCondition;
  switch (type) {
    case "matches_won":
      return `Win ${value} ${value === 1 ? "match" : "matches"}`;
    case "matches_played":
      return `Play ${value} ${value === 1 ? "match" : "matches"}`;
    case "sessions_logged":
      return `Log ${value} practice ${value === 1 ? "session" : "sessions"}`;
    case "best_break":
      return `Make a break of ${value} or more`;
    case "win_streak":
      return `Win ${value} matches in a row`;
    case "level":
      return `Reach level ${value}`;
    default:
      return "Not available yet";
  }
};

const unlockProgress = (avatar: PresetAvatar, stats: PlayerStats): string | null => {
  if (!avatar.unlockCondition) return null;
  const { type, value } = avatar.unlockCondition;
  const current: Partial<Record<string, number>> = {
    matches_won: stats.matchesWon,
    matches_played: stats.matchesPlayed,
    sessions_logged: stats.sessionsLogged,
    best_break: stats.bestBreak,
    win_streak: stats.longestWinStreak,
    level: stats.playerLevel,
  };
  const now = current[type];
  return now === undefined ? null : `You are on ${Math.min(now, value)} of ${value}.`;
};

export const AvatarPickerScreen = () => {
  const { user, updateAvatarPreset } = useAuthStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { stats } = usePlayerProgress();

  const groups: Array<{ title: string; hint: string; avatars: PresetAvatar[] }> = [
    {
      title: "Progression",
      hint: "Earned as you play and practise.",
      avatars: SNOOKER_PRESET_AVATARS.filter((avatar) => avatar.group === "player"),
    },
    {
      title: "Snooker icons",
      hint: "Unlocked by milestones along the way.",
      avatars: SNOOKER_PRESET_AVATARS.filter((avatar) => avatar.group !== "player"),
    },
  ];

  const unlockedCount = SNOOKER_PRESET_AVATARS.filter((avatar) => isAvatarUnlocked(avatar, stats)).length;

  const choose = async (avatar: PresetAvatar) => {
    if (!isAvatarUnlocked(avatar, stats)) {
      const progress = unlockProgress(avatar, stats);
      dialog.alert({
        title: `${avatar.label} is locked`,
        message: `${unlockText(avatar)} to unlock it.${progress ? ` ${progress}` : ""}`,
        icon: "lock-outline",
        confirmLabel: "Got it",
      });
      return;
    }

    try {
      await updateAvatarPreset(avatar.id);
    } catch {
      dialog.alert({
        title: "Could not change your avatar",
        message: "Your avatar has been left as it was. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
      });
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.current}>
        <View style={[styles.currentRing, { borderColor: colors.primary }]}>
          <SnookerPresetAvatar presetId={user?.avatar_preset} size={96} />
        </View>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {unlockedCount} OF {SNOOKER_PRESET_AVATARS.length} UNLOCKED
        </Text>
      </View>

      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>{group.title}</Text>
          <Text style={[styles.groupHint, { color: colors.textMuted }]}>{group.hint}</Text>

          <View style={styles.grid}>
            {group.avatars.map((avatar) => {
              const unlocked = isAvatarUnlocked(avatar, stats);
              const selected = user?.avatar_preset === avatar.id;

              return (
                <Pressable
                  key={avatar.id}
                  onPress={() => void choose(avatar)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !unlocked }}
                  accessibilityLabel={unlocked ? `Use ${avatar.label}` : `${avatar.label}, locked. ${unlockText(avatar)}`}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={{ opacity: unlocked ? 1 : 0.35 }}>
                    <SnookerPresetAvatar presetId={avatar.id} size={52} />
                  </View>
                  {!unlocked ? (
                    <View style={[styles.lock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <MaterialCommunityIcons name="lock" size={12} color={colors.textMuted} />
                    </View>
                  ) : null}
                  {selected ? (
                    <View style={[styles.lock, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      <MaterialCommunityIcons name="check" size={12} color={colors.onPrimary} />
                    </View>
                  ) : null}
                  <Text
                    style={[styles.tileLabel, { color: unlocked ? colors.text : colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {avatar.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },

  current: { alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg },
  currentRing: { borderWidth: 3, borderRadius: 60, padding: 4 },
  count: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1.6 },

  group: { marginTop: SPACING.lg },
  groupTitle: { fontSize: 18, fontWeight: "800" },
  groupHint: { fontSize: 13, marginTop: 2, marginBottom: SPACING.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tile: {
    width: "31.5%",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  lock: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 12, fontWeight: "700", textAlign: "center", minHeight: 30 },
});
