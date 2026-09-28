import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useDialog } from "../../components/ui/DialogProvider";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { CommunityAvatar, flagOf } from "../../components/community/CommunityAvatar";
import { ReportSheet } from "../../components/community/ReportSheet";
import { SharedRoutineCard } from "../../components/community/SharedRoutineCard";
import { routinesBy, type SharedRoutine } from "../../features/community/sharedRoutines";
import { startDirect } from "../../features/community/chat";
import { nameOf, relationTo, type PublicProfile, type PublicStats } from "../../features/community/types";
import { LEVELS } from "../../constants/achievements";
import { getCountryByCode, getCuePreferenceLabel } from "../../constants/profileOptions";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const SKILL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
  professional: "Professional",
};

/** Another player (or the player themselves, as others see them): who they are, their record, and what to do. */
export const PlayerProfileScreen = () => {
  const route = useRoute<RouteProp<CommunityStackParamList, "PlayerProfile">>();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { userId: otherId } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { friendships, blocked, profiles, loadProfile, sendRequest, accept, removeFriendship, block, unblock } =
    useCommunityStore();
  const [profile, setProfile] = useState<PublicProfile | null>(profiles[otherId] ?? null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [routines, setRoutines] = useState<SharedRoutine[]>([]);

  const relation = relationTo(me, otherId, friendships, blocked);
  const link = friendships.find(
    (item) =>
      (item.requester === me && item.addressee === otherId) || (item.addressee === me && item.requester === otherId)
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [result, shared] = await Promise.all([loadProfile(otherId), routinesBy(otherId, otherId === me)]);
    if (result.profile) setProfile(result.profile);
    setStats(result.stats);
    setRoutines(shared);
    setLoading(false);
  }, [loadProfile, me, otherId]);

  // Again whenever the friendship changes: becoming friends can open up their stats.
  useEffect(() => {
    void load();
  }, [load, relation]);

  useEffect(() => {
    navigation.setOptions({
      title: relation === "self" ? "Your profile" : profile?.handle ? `@${profile.handle}` : "Player",
    });
  }, [navigation, profile?.handle, relation]);

  const run = async (task: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok)
      dialog.alert({ title: "That did not work", message: result.message ?? "Try again.", tone: "danger" });
  };

  if (!profile) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="account-off-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.body, { color: colors.textMuted }]}>This profile is not available.</Text>
          </>
        )}
      </View>
    );
  }

  const name = nameOf(profile);
  const levelTitle = LEVELS[Math.max(0, Math.min(LEVELS.length, profile.level) - 1)]?.title ?? "";

  const confirmUnfriend = () =>
    link &&
    dialog.confirm({
      title: `Remove ${name}?`,
      message: "You will stop being friends. They are not told, but will see you are no longer on their list.",
      tone: "danger",
      icon: "account-remove-outline",
      confirmLabel: "Remove friend",
      cancelLabel: "Keep",
      onConfirm: () => run(() => removeFriendship(link.id)),
    });

  const confirmBlock = () =>
    dialog.confirm({
      title: `Block ${name}?`,
      message:
        "They will not be able to find you, see your profile, add you or message you, and you will not see them. Any friendship ends. They are not told.",
      tone: "danger",
      icon: "cancel",
      confirmLabel: "Block",
      cancelLabel: "Cancel",
      onConfirm: () => run(() => block(otherId)),
    });

  const primary = (() => {
    switch (relation) {
      case "self":
        return {
          label: "Edit profile and privacy",
          icon: "pencil-outline" as const,
          onPress: () => navigation.navigate("CommunitySettings", {}),
        };
      case "none":
        return {
          label: "Add friend",
          icon: "account-plus-outline" as const,
          onPress: () => run(() => sendRequest(otherId)),
        };
      case "incoming":
        return link
          ? {
              label: "Accept friend request",
              icon: "account-check-outline" as const,
              onPress: () => run(() => accept(link.id)),
            }
          : null;
      case "outgoing":
        return link
          ? {
              label: "Cancel request",
              icon: "clock-outline" as const,
              onPress: () => run(() => removeFriendship(link.id)),
              quiet: true,
            }
          : null;
      case "friends":
        return { label: "Friends", icon: "account-check" as const, onPress: confirmUnfriend, quiet: true };
      case "blocked":
        return {
          label: "Unblock",
          icon: "lock-open-outline" as const,
          onPress: () => run(() => unblock(otherId)),
          quiet: true,
        };
      default:
        return null;
    }
  })();

  const statsNote =
    relation === "self"
      ? null
      : profile.statsPrivacy === "nobody"
        ? `${name} keeps their stats private.`
        : profile.statsPrivacy === "friends" && relation !== "friends"
          ? `${name} shares their stats with friends.`
          : null;

  // What the player has filled in on their profile.
  const country = getCountryByCode(profile.countryCode ?? undefined);
  const details: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }> = [
    ...(country ? [{ icon: "earth" as const, label: "Country", value: `${country.emoji} ${country.name}` }] : []),
    ...(profile.skillLevel && SKILL[profile.skillLevel]
      ? [{ icon: "chart-bell-curve-cumulative" as const, label: "Standard", value: SKILL[profile.skillLevel] }]
      : []),
    ...(profile.cuePreference
      ? [{ icon: "billiards-rack" as const, label: "Cue", value: getCuePreferenceLabel(profile.cuePreference) }]
      : []),
    ...(profile.joinedAt
      ? [
          {
            icon: "calendar-account-outline" as const,
            label: "Member since",
            value: new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
          },
        ]
      : []),
  ];

  const tiles: Array<{ label: string; value: string }> = stats
    ? [
        { label: "MATCHES", value: `${stats.matchesPlayed}` },
        { label: "WON", value: stats.matchesPlayed ? `${stats.winRate}%` : "–" },
        { label: "HIGH BREAK", value: `${stats.bestBreak}` },
        { label: "CENTURIES", value: `${stats.centuries}` },
        { label: "50+ BREAKS", value: `${stats.fifties}` },
        { label: "BEST STREAK", value: `${stats.longestPracticeStreak}d` },
      ]
    : [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      refreshControl={
        <RefreshControl refreshing={loading && Boolean(profile)} onRefresh={load} tintColor={colors.primary} />
      }
    >
      <View style={styles.hero}>
        <CommunityAvatar profile={profile} size={104} />
        <Text style={[styles.name, { color: colors.text }]}>
          {name} {flagOf(profile.countryCode)}
        </Text>
        {profile.handle ? (
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.handle, { color: colors.primary }]}>
            @{profile.handle}
          </Text>
        ) : null}
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: colors.board }]}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tagText, { color: colors.boardRule }]}>
              LEVEL {profile.level} · {levelTitle.toUpperCase()}
            </Text>
          </View>
        </View>
        {profile.bio ? <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text> : null}
        {profile.isCoach ? (
          <View style={styles.coachBlock}>
            {profile.coachLocation ? (
              <Text style={[styles.coachLocation, { color: colors.textMuted }]}>
                <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.textMuted} /> {profile.coachLocation}
              </Text>
            ) : null}
            <View style={styles.tags}>
              {profile.wpbsaAccredited ? (
                <View style={[styles.tag, styles.coachTagRow, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="whistle-outline" size={13} color={colors.onPrimary} />
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tagText, { color: colors.onPrimary }]}>
                    WPBSA ACCREDITED
                  </Text>
                </View>
              ) : null}
              {profile.coachQualifications.map((qualification) => (
                <View key={qualification} style={[styles.tag, { backgroundColor: colors.board }]}>
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tagText, { color: colors.boardRule }]}>
                    {qualification.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
            {profile.wpbsaAccredited || profile.coachQualifications.length ? (
              <Text style={[styles.coachDisclaimer, { color: colors.textSubtle }]}>Self-declared by the coach.</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {profile.isCoach && relation !== "self" && relation !== "blocked" ? (
        <Pressable
          onPress={() => navigation.navigate("BookCoach", { coachId: otherId, coachName: name })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="calendar-plus" size={20} color={colors.onPrimary} />
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Book a session</Text>
        </Pressable>
      ) : null}

      {relation !== "self" &&
      relation !== "blocked" &&
      profile.messagePrivacy !== "nobody" &&
      (relation === "friends" || profile.messagePrivacy === "everyone") ? (
        <Pressable
          onPress={async () => {
            setBusy(true);
            const result = await startDirect(otherId);
            setBusy(false);
            if (result.ok) navigation.navigate("Chat", { conversationId: result.value });
            else
              dialog.alert({
                title: `You cannot message ${name}`,
                message: result.message,
                icon: "message-lock-outline",
              });
          }}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name="chat-outline" size={20} color={colors.primary} />
          <Text style={[styles.primaryText, { color: colors.primary }]}>
            {relation === "friends" ? "Message" : "Send a message request"}
          </Text>
        </Pressable>
      ) : null}

      {primary ? (
        <Pressable
          onPress={primary.onPress}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            "quiet" in primary && primary.quiet
              ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
              : { backgroundColor: colors.primary },
            { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={"quiet" in primary && primary.quiet ? colors.text : colors.onPrimary} />
          ) : (
            <MaterialCommunityIcons
              name={primary.icon}
              size={20}
              color={"quiet" in primary && primary.quiet ? colors.text : colors.onPrimary}
            />
          )}
          <Text
            style={[
              styles.primaryText,
              { color: "quiet" in primary && primary.quiet ? colors.text : colors.onPrimary },
            ]}
          >
            {primary.label}
          </Text>
        </Pressable>
      ) : null}

      {details.length ? (
        <View style={[styles.about, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {details.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.aboutRow,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
              ]}
            >
              <MaterialCommunityIcons name={item.icon} size={20} color={colors.textMuted} />
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{item.label}</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]} numberOfLines={2}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {relation !== "blocked" ? (
        stats ? (
          <BoardPanel kicker="RECORD" aside={stats.achievements ? `${stats.achievements} ACHIEVEMENTS` : undefined}>
            <View style={styles.tiles}>
              {tiles.map((tile) => (
                <View key={tile.label} style={styles.tile}>
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.tileValue, { color: colors.boardText }]}
                  >
                    {tile.value}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.tileLabel, { color: colors.boardMuted }]}
                  >
                    {tile.label}
                  </Text>
                </View>
              ))}
            </View>
          </BoardPanel>
        ) : statsNote ? (
          <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.noteText, { color: colors.textMuted }]}>{statsNote}</Text>
          </View>
        ) : null
      ) : (
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="cancel" size={18} color={colors.textMuted} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>
            You have blocked {name}. They cannot find you, add you or message you.
          </Text>
        </View>
      )}

      {relation !== "blocked" && routines.length ? (
        <View style={styles.routines}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {relation === "self" ? "Your shared routines" : `Routines by ${name}`}
          </Text>
          {routines.map((routine) => (
            <SharedRoutineCard
              key={routine.id}
              routine={routine}
              onPress={() => navigation.navigate("SharedRoutine", { id: routine.id })}
            />
          ))}
        </View>
      ) : null}

      {relation !== "self" ? (
        <View style={styles.safety}>
          {relation !== "blocked" ? (
            <Pressable onPress={confirmBlock} accessibilityRole="button" style={styles.safetyButton} hitSlop={6}>
              <MaterialCommunityIcons name="cancel" size={18} color={colors.textMuted} />
              <Text style={[styles.safetyText, { color: colors.textMuted }]}>Block</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setReporting(true)}
            accessibilityRole="button"
            style={styles.safetyButton}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="flag-outline" size={18} color={colors.danger} />
            <Text style={[styles.safetyText, { color: colors.danger }]}>Report</Text>
          </Pressable>
        </View>
      ) : null}

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="profile"
        targetId={otherId}
        reportedUser={otherId}
        what={`${name}'s profile`}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.md },
  hero: { alignItems: "center", gap: SPACING.xs, paddingVertical: SPACING.md },
  name: { fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: SPACING.sm },
  handle: { fontFamily: FONTS.boardLabel, fontSize: 17, letterSpacing: 0.5 },
  tags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACING.xs, marginTop: SPACING.xs },
  tag: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 4 },
  tagText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  coachBlock: { alignItems: "center", gap: SPACING.xs, marginTop: SPACING.sm },
  coachLocation: { fontSize: 13 },
  coachTagRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  coachDisclaimer: { fontSize: 11 },
  bio: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: SPACING.sm, maxWidth: 340 },
  body: { fontSize: 15 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  tiles: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACING.md, marginTop: SPACING.xs },
  tile: { width: "33.33%", alignItems: "center" },
  tileValue: { fontFamily: FONTS.boardHeavy, fontSize: 26, lineHeight: 30 },
  tileLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  about: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: HIT_TARGET + 4 },
  aboutLabel: { width: 104, fontSize: 14, fontWeight: "600" },
  aboutValue: { flex: 1, fontSize: 15, fontWeight: "700", textAlign: "right" },
  routines: { gap: SPACING.sm, marginTop: SPACING.sm },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  safety: { flexDirection: "row", justifyContent: "center", gap: SPACING.xl, marginTop: SPACING.md },
  safetyButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: HIT_TARGET },
  safetyText: { fontSize: 15, fontWeight: "700" },
});
