import React, { useState } from "react";
import { ActivityIndicator, Image, LayoutAnimation, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore, useRoutinesStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useDialog } from "../../components/ui/DialogProvider";
import { PlayerAvatar } from "../../components/profile/PlayerAvatar";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { ACHIEVEMENTS } from "../../constants/achievements";
import { getSkillLabel, getCuePreferenceLabel, getCountryByCode } from "../../constants/profileOptions";
import { usePlayerProgress } from "../../features/profile/playerProgress";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "support@snookerlab.app";

/** A win rate over fewer matches than this says nothing. */
const MIN_FOR_WIN_RATE = 3;

export const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuthStore();
  const categories = useRoutinesStore((state) => state.categories);
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const subscription = useSubscriptionAccess();
  const { stats, unlocked, level, nextGoal } = usePlayerProgress();

  const country = user?.country_code ? getCountryByCode(user.country_code) : null;
  const mostPractised = categories.find((category) => category.id === stats.mostTrainedCategory)?.name ?? null;

  const openSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=SnookerLab%20help`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fall through to the address in words.
    }
    dialog.alert({
      title: "Get in touch",
      message: `Write to us at ${SUPPORT_EMAIL} and we will get back to you.`,
      icon: "email-outline",
      confirmLabel: "Done",
    });
  };

  // The confirm sits in the page rather than in a pop-up. Profile is itself a sheet, and a pop-up
  // over a sheet on iOS could leave the switch to the login screen stuck halfway.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const askToSignOut = (value: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setConfirmingSignOut(value);
  };

  // Signing out swaps the whole app to the login screen, which closes this sheet with it.
  const doSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const usage = [
    { label: "Matches", used: subscription.usage.matches, limit: subscription.limits.matchesPerPeriod },
    { label: "Tournaments", used: subscription.usage.tournaments, limit: subscription.limits.tournamentsPerPeriod },
    { label: "AI analyses", used: subscription.usage.aiAnalyses, limit: subscription.limits.aiAnalysesPerPeriod },
  ];

  const Row = ({
    icon,
    label,
    value,
    onPress,
    accessory,
  }: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    accessory?: React.ReactNode;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed && onPress ? colors.surfaceMuted : "transparent" }]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {accessory}
      {value ? (
        <Text style={[styles.rowValue, { color: colors.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} /> : null}
    </Pressable>
  );

  const Divider = () => <View style={[styles.divider, { backgroundColor: colors.border }]} />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------------------------------------- the player */}
      <BoardPanel kicker="PLAYER" aside={`${subscription.tierLabel.toUpperCase()} PLAN`}>
        <View style={styles.identity}>
          <Pressable
            onPress={() => navigation.navigate("AvatarPicker")}
            accessibilityRole="button"
            accessibilityLabel="Change your avatar"
            style={styles.avatarWrap}
          >
            {user?.profile_image_url ? (
              <View style={[styles.avatar, { borderColor: colors.boardRule, backgroundColor: colors.boardRaised }]}>
                <Image source={{ uri: user.profile_image_url }} style={styles.avatarImage} resizeMode="cover" />
              </View>
            ) : (
              <PlayerAvatar preset={user?.avatar_preset} name={user?.username} level={level.level} size={80} />
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.primary, borderColor: colors.board }]}>
              <MaterialCommunityIcons name="pencil" size={12} color={colors.onPrimary} />
            </View>
          </Pressable>

          <View style={styles.identityText}>
            <Text style={[styles.name, { color: colors.boardText }]} numberOfLines={1} adjustsFontSizeToFit>
              {(user?.username || "Snooker player").toUpperCase()}
            </Text>
            <Text style={[styles.levelLine, { color: colors.boardRule }]}>
              LEVEL {level.level} · {level.title.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.xp}>
          <View style={[styles.xpTrack, { backgroundColor: colors.boardRaised }]}>
            <View style={[styles.xpFill, { width: `${Math.round(level.progress * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.xpText, { color: colors.boardMuted }]}>
            {level.nextTitle ? `${level.xpToNext} XP to ${level.nextTitle}` : "Top level reached"}
          </Text>
        </View>

        <View style={[styles.cells, { borderTopColor: colors.boardRaised }]}>
          {[
            { label: "WON", value: `${stats.matchesWon}` },
            {
              label: "WIN RATE",
              value: stats.matchesPlayed >= MIN_FOR_WIN_RATE ? `${stats.winRate}%` : "–",
            },
            { label: "SESSIONS", value: `${stats.sessionsLogged}` },
            { label: "BEST RUN", value: `${stats.longestWinStreak}` },
          ].map((cell) => (
            <View key={cell.label} style={styles.cell}>
              <Text style={[styles.cellValue, { color: colors.boardText }]}>{cell.value}</Text>
              <Text style={[styles.cellLabel, { color: colors.boardMuted }]}>{cell.label}</Text>
            </View>
          ))}
        </View>
      </BoardPanel>

      {/* ---------------------------------------------------------------- achievements */}
      <Pressable
        onPress={() => navigation.navigate("Achievements")}
        accessibilityRole="button"
        accessibilityLabel={`Achievements, ${unlocked.length} of ${ACHIEVEMENTS.length} unlocked`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Achievements</Text>
          <Text style={[styles.cardCount, { color: colors.textMuted }]}>
            {unlocked.length}/{ACHIEVEMENTS.length}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} />
        </View>
        <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.barFill,
              { width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>

        {nextGoal ? (
          <View style={styles.goal}>
            <View style={[styles.goalIcon, { backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name={nextGoal.achievement.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.goalText}>
              <Text style={[styles.goalKicker, { color: colors.textMuted }]}>NEXT UP</Text>
              <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={1}>
                {nextGoal.achievement.title}
              </Text>
              <Text style={[styles.goalMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {nextGoal.achievement.description} · {Math.min(nextGoal.current, nextGoal.achievement.requirement.value)} of{" "}
                {nextGoal.achievement.requirement.value}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* ---------------------------------------------------------------- your game */}
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>YOUR GAME</Text>
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row
          icon="star-outline"
          label="Skill level"
          value={getSkillLabel(user?.skill_level)}
          onPress={() => navigation.navigate("EditProfileField", { field: "skill_level" })}
        />
        <Divider />
        <Row
          icon="flag-outline"
          label="Country"
          value={country ? `${country.emoji ?? ""} ${country.name}`.trim() : "Not set"}
          onPress={() => navigation.navigate("EditProfileField", { field: "country_code" })}
        />
        <Divider />
        <Row
          icon="billiards"
          label="Cue"
          value={getCuePreferenceLabel(user?.cue_preference)}
          onPress={() => navigation.navigate("EditProfileField", { field: "cue_preference" })}
        />
        {mostPractised ? (
          <>
            <Divider />
            <Row icon="target" label="Most practised" value={mostPractised} />
          </>
        ) : null}
      </View>

      {/* ---------------------------------------------------------------- plan */}
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>PLAN</Text>
      <Pressable
        onPress={() => navigation.navigate("SubscriptionPlans")}
        accessibilityRole="button"
        accessibilityLabel={`${subscription.tierLabel} plan. Manage your plan`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHead}>
          <MaterialCommunityIcons name="crown-outline" size={20} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{subscription.tierLabel}</Text>
          <Text style={[styles.cardLink, { color: colors.primary }]}>Manage</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} />
        </View>

        {usage.map((item) => (
          <View key={item.label} style={styles.usage}>
            <View style={styles.usageLine}>
              <Text style={[styles.usageLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.usageValue, { color: colors.textMuted }]}>
                {item.limit === null ? "Unlimited" : `${item.used} of ${item.limit} this month`}
              </Text>
            </View>
            {item.limit !== null ? (
              <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, (item.used / Math.max(1, item.limit)) * 100)}%`,
                      backgroundColor: item.used >= item.limit ? colors.danger : colors.primary,
                    },
                  ]}
                />
              </View>
            ) : null}
          </View>
        ))}
      </Pressable>

      {/* ---------------------------------------------------------------- account */}
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>ACCOUNT</Text>
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row icon="cog-outline" label="Account settings" onPress={() => navigation.navigate("Settings")} />
        <Divider />
        <Row icon="help-circle-outline" label="Help and support" onPress={() => void openSupport()} />
      </View>

      {confirmingSignOut ? (
        <View style={[styles.signOutConfirm, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
          <Text style={[styles.signOutTitle, { color: colors.text }]}>Sign out of this phone?</Text>
          <Text style={[styles.signOutBody, { color: colors.textMuted }]}>
            Your matches, practice and reports are saved to your account and come back when you sign in.
          </Text>
          <View style={styles.signOutActions}>
            <Pressable
              onPress={() => askToSignOut(false)}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Stay signed in"
              style={({ pressed }) => [
                styles.signOutAction,
                { backgroundColor: pressed ? colors.border : colors.surfaceMuted },
              ]}
            >
              <Text style={[styles.signOutActionText, { color: colors.text }]}>Stay signed in</Text>
            </Pressable>
            <Pressable
              onPress={() => void doSignOut()}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out now"
              accessibilityState={{ busy: signingOut }}
              style={({ pressed }) => [
                styles.signOutAction,
                { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {signingOut ? (
                <ActivityIndicator color={colors.onDanger} />
              ) : (
                <Text style={[styles.signOutActionText, { color: colors.onDanger }]}>Sign out</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => askToSignOut(true)}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.signOut,
            { borderColor: colors.danger, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
          ]}
        >
          <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },

  identity: { flexDirection: "row", alignItems: "center", gap: SPACING.lg },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  editBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 2 },
  name: { fontFamily: FONTS.boardHeavy, fontSize: 32, letterSpacing: 0.6 },
  levelLine: { fontFamily: FONTS.board, fontSize: 14, letterSpacing: 1.6 },

  xp: { marginTop: SPACING.lg, gap: 6 },
  xpTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 3 },
  xpText: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 0.8 },

  cells: { flexDirection: "row", borderTopWidth: 1, marginTop: SPACING.lg, paddingTop: SPACING.md },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  cellValue: { fontFamily: FONTS.board, fontSize: 24, fontVariant: ["tabular-nums"] },
  cellLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1.4 },

  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
  cardCount: { fontFamily: FONTS.board, fontSize: 18 },
  cardLink: { fontSize: 14, fontWeight: "700" },
  bar: { height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },

  goal: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  goalIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  goalText: { flex: 1 },
  goalKicker: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.4 },
  goalTitle: { fontSize: 15, fontWeight: "700" },
  goalMeta: { fontSize: 12, fontWeight: "600", marginTop: 1 },

  groupLabel: {
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 1.6,
    marginTop: SPACING.sm,
    marginBottom: -4,
    marginLeft: 2,
  },
  list: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowValue: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "600" },
  divider: { height: 1, marginLeft: SPACING.lg + 20 + SPACING.md },

  usage: { gap: 6 },
  usageLine: { flexDirection: "row", justifyContent: "space-between" },
  usageLabel: { fontSize: 14, fontWeight: "600" },
  usageValue: { fontSize: 13, fontWeight: "600" },

  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  signOutText: { fontSize: 16, fontWeight: "800" },
  signOutConfirm: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.lg, gap: SPACING.xs },
  signOutTitle: { fontSize: 16, fontWeight: "800" },
  signOutBody: { fontSize: 13, lineHeight: 18 },
  signOutActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  signOutAction: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutActionText: { fontSize: 15, fontWeight: "800" },
});
