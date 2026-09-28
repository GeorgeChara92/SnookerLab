import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { PlayerAvatar } from "./PlayerAvatar";
import { usePlayerProgress } from "../../features/profile/playerProgress";
import { compactXp } from "../../features/profile/playerStats";
import { FONTS, DISPLAY_TEXT_SCALE } from "../../constants";

/**
 * The player's corner of every header: their avatar in the ring they have earned, their level
 * and how far through it they are, and their plan. Set like a line of the scoreboard, and
 * built from the same progress the Profile page shows, so the two never disagree.
 */

const AVATAR = 32;
/** Below this width the pill sits beside the screen title in less room, so it trims itself. */
const COMPACT_BELOW = 380;
const BAR = 46;

export const HeaderProfileButton = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const subscription = useSubscriptionAccess();
  const { xp, level } = usePlayerProgress();
  // Both paid plans wear brass; the name says which one.
  const paid = subscription.tier !== "free";
  const plan = subscription.tierLabel.toUpperCase();
  const compact = useWindowDimensions().width < COMPACT_BELOW;

  return (
    <Pressable
      onPress={() => navigation.navigate("ProfileModal")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Your profile. Level ${level.level}, ${xp} XP${
        level.nextTitle ? `, ${level.xpToNext} to level ${level.level + 1}` : ""
      }. ${subscription.tierLabel} plan.`}
      style={({ pressed }) => [styles.container, { opacity: pressed ? 0.8 : 1 }]}
    >
      {user?.profile_image_url ? (
        <Image
          source={{ uri: user.profile_image_url }}
          style={[styles.photo, { borderColor: colors.primary }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : (
        <PlayerAvatar preset={user?.avatar_preset} name={user?.username} level={level.level} size={AVATAR} />
      )}

      <View style={styles.meta}>
        <View style={styles.levelLine}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.levelLabel, { color: colors.textMuted }]}>LV</Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.levelNumber, { color: colors.text }]}>{level.level}</Text>
          {compact ? null : (
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.xp, { color: colors.textMuted }]} numberOfLines={1}>
              {compactXp(xp)} XP
            </Text>
          )}
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: colors.primary, width: `${Math.round(Math.min(1, level.progress) * 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* Brass is kept for what is earned or paid for, so the paid plans wear it and Free does not. */}
      <View
        style={[
          styles.plan,
          paid
            ? { backgroundColor: colors.accentWash, borderColor: colors.accent }
            : { backgroundColor: "transparent", borderColor: colors.border },
        ]}
      >
        {paid ? <MaterialCommunityIcons name="crown" size={11} color={colors.accent} /> : null}
        {/* On a narrow screen a paid plan is just the crown; the full name is in the label. */}
        {compact && paid ? null : (
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            numberOfLines={1}
            style={[styles.planText, { color: paid ? colors.accent : colors.textMuted }]}
          >
            {plan}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
  photo: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2 },

  meta: { minWidth: BAR, gap: 3 },
  levelLine: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  levelLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  levelNumber: { fontFamily: FONTS.boardHeavy, fontSize: 17, lineHeight: 18 },
  xp: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 0.6, marginLeft: 2 },
  track: { width: BAR, height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },

  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  planText: { fontFamily: FONTS.board, fontSize: 12, letterSpacing: 0.9 },
});
