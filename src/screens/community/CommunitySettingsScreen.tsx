import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { cleanHandle, handleAlternatives, handleProblem, suggestHandle } from "../../features/community/handle";
import { containsBlockedWord } from "../../features/community/wordFilter";
import { nameOf, type Privacy } from "../../features/community/types";
import type { CommunityStackParamList } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const PRIVACY: Array<{ value: Privacy; label: string }> = [
  { value: "everyone", label: "Everyone" },
  { value: "friends", label: "Friends" },
  { value: "nobody", label: "Nobody" },
];

type HandleState = "idle" | "checking" | "free" | "taken";

/**
 * The player's community profile and privacy: their @handle and bio, whether they can be
 * found, who sees their stats, who can message them, and who they have blocked. The first
 * time, it is the step that sets them up.
 */
export const CommunitySettingsScreen = () => {
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const route = useRoute<RouteProp<CommunityStackParamList, "CommunitySettings">>();
  const setup = Boolean(route.params?.setup);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const { me, blocked, profiles, isAdmin, saveMe, handleIsFree, freeHandles, unblock } = useCommunityStore();

  const [handle, setHandle] = useState(me?.handle ?? suggestHandle(user?.username));
  const [bio, setBio] = useState(me?.bio ?? "");
  const [discoverable, setDiscoverable] = useState(me?.discoverable ?? true);
  const [statsPrivacy, setStatsPrivacy] = useState<Privacy>(me?.statsPrivacy ?? "friends");
  const [messagePrivacy, setMessagePrivacy] = useState<Privacy>(me?.messagePrivacy ?? "everyone");
  const [leaderboards, setLeaderboards] = useState(me?.leaderboards ?? true);
  const shareActivity = useCommunityStore((state) => state.shareActivity);
  const setShareActivity = useCommunityStore((state) => state.setShareActivity);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [handleState, setHandleState] = useState<HandleState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: setup ? "Create your profile" : "Community settings" });
  }, [navigation, setup]);

  const problem = handleProblem(handle);
  const bioProblem = containsBlockedWord(bio) ? "Your bio contains a word that is not allowed." : null;

  // Is the handle free? Checked a moment after typing stops.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (problem || handle === me?.handle) {
      setHandleState("idle");
      return;
    }
    setHandleState("checking");
    timer.current = setTimeout(async () => setHandleState((await handleIsFree(handle)) ? "free" : "taken"), 400);
  }, [handle, handleIsFree, me?.handle, problem]);

  // When it is taken, three free ones close to it.
  useEffect(() => {
    if (handleState !== "taken") {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void freeHandles(handleAlternatives(handle, user?.username)).then((free) => {
      if (!cancelled) setSuggestions(free.slice(0, 3));
    });
    return () => {
      cancelled = true;
    };
  }, [freeHandles, handle, handleState, user?.username]);

  const canSave = !problem && !bioProblem && handleState !== "taken" && handleState !== "checking" && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await saveMe({ handle, bio, discoverable, statsPrivacy, messagePrivacy, leaderboards });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      if (result.message.includes("taken")) setHandleState("taken");
      return;
    }
    navigation.goBack();
  };

  const Choice = ({ value, onChange }: { value: Privacy; onChange: (next: Privacy) => void }) => (
    <View style={[styles.choice, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="radiogroup">
      {PRIVACY.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.choiceItem, selected ? { backgroundColor: colors.surface } : null]}
          >
            <Text style={[styles.choiceText, { color: selected ? colors.text : colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const handleNote =
    problem && handle.length > 0
      ? { text: problem, colour: colors.danger }
      : handleState === "taken"
        ? { text: "Someone already has that handle.", colour: colors.danger }
        : handleState === "free"
          ? { text: "That handle is yours if you want it.", colour: colors.primary }
          : handleState === "checking"
            ? { text: "Checking…", colour: colors.textMuted }
            : { text: "How people find you. Letters, numbers, dots and underscores.", colour: colors.textMuted };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.identity}>
          <CommunityAvatar
            profile={{
              avatarUrl: user?.profile_image_url ?? null,
              avatarPreset: user?.avatar_preset ?? null,
              displayName: user?.username ?? null,
              handle,
              level: me?.level ?? 1,
              subscriptionTier: me?.subscriptionTier ?? "free",
            }}
            size={64}
          />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]}>
              {nameOf({ displayName: user?.username ?? null, handle })}
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Your name and picture come from your profile.
            </Text>
          </View>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>HANDLE</Text>
        <View
          style={[
            styles.handleBox,
            {
              backgroundColor: colors.surface,
              borderColor: handleNote.colour === colors.danger ? colors.danger : colors.border,
            },
          ]}
        >
          <Text style={[styles.at, { color: colors.textMuted }]}>@</Text>
          <TextInput
            value={handle}
            onChangeText={(text) => setHandle(cleanHandle(text))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            style={[styles.handleInput, { color: colors.text }]}
          />
          {handleState === "checking" ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
          {handleState === "free" ? (
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
          ) : null}
        </View>
        <Text style={[styles.note, { color: handleNote.colour }]}>{handleNote.text}</Text>
        {suggestions.length ? (
          <View style={styles.suggestions}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Try one of these:</Text>
            <View style={styles.suggestionRow}>
              {suggestions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setHandle(option)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use @${option}`}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { borderColor: colors.primary, backgroundColor: pressed ? colors.primary + "22" : colors.surface },
                  ]}
                >
                  <Text style={[styles.suggestionText, { color: colors.primary }]}>@{option}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.textMuted }]}>BIO</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          placeholder="Your club, your high break, what you are working on"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.bio,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: bioProblem ? colors.danger : colors.border,
            },
          ]}
        />
        <Text style={[styles.note, { color: bioProblem ? colors.danger : colors.textMuted }]}>
          {bioProblem ?? `${160 - bio.length} left`}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Show me in search</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>Off, and only people you add can find you.</Text>
            </View>
            <Switch value={discoverable} onValueChange={setDiscoverable} trackColor={{ true: colors.primary }} />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Appear on leaderboards</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Your level, high break and routine bests, ranked against other players.
              </Text>
            </View>
            <Switch value={leaderboards} onValueChange={setLeaderboards} trackColor={{ true: colors.primary }} />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Share my results</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Wins, centuries, new bests and level-ups, in your friends&apos; and groups&apos; feeds. A plain loss is
                never posted.
              </Text>
            </View>
            <Switch
              value={shareActivity}
              onValueChange={(value) => void setShareActivity(value)}
              trackColor={{ true: colors.primary }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.rowTitle, { color: colors.text }]}>Who can see my stats</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Your record, high break and centuries.</Text>
          <Choice value={statsPrivacy} onChange={setStatsPrivacy} />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.rowTitle, { color: colors.text }]}>Who can message me</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Friends message you directly. With Everyone, anyone else sends a request you can accept or ignore.
          </Text>
          <Choice value={messagePrivacy} onChange={setMessagePrivacy} />
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: colors.primary, opacity: !canSave ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : null}
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>{setup ? "Join the community" : "Save"}</Text>
        </Pressable>

        {!setup && blocked.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Blocked</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {blocked.map((id, index) => (
                <View
                  key={id}
                  style={[
                    styles.blockedRow,
                    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                  ]}
                >
                  <CommunityAvatar profile={profiles[id]} size={36} />
                  <Text style={[styles.flex, styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {nameOf(profiles[id])}
                  </Text>
                  <Pressable onPress={() => void unblock(id)} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.unblock, { color: colors.primary }]}>Unblock</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!setup && isAdmin ? (
          <Pressable
            onPress={() => navigation.navigate("AdminReports")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.admin,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
            ]}
          >
            <MaterialCommunityIcons name="shield-account-outline" size={22} color={colors.text} />
            <Text style={[styles.flex, styles.rowTitle, { color: colors.text }]}>Review reports</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {!setup && isAdmin ? (
          <Pressable
            onPress={() => navigation.navigate("AdminCoachApplications")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.admin,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
            ]}
          >
            <MaterialCommunityIcons name="whistle-outline" size={22} color={colors.text} />
            <Text style={[styles.flex, styles.rowTitle, { color: colors.text }]}>Coach applications</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  identity: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.sm },
  name: { fontSize: 20, fontWeight: "800" },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2, marginTop: SPACING.md },
  handleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: HIT_TARGET + 6,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  at: { fontSize: 20, fontWeight: "800" },
  handleInput: { flex: 1, fontSize: 18, fontWeight: "700", paddingVertical: SPACING.sm },
  note: { fontSize: 12, fontWeight: "600" },
  bio: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    textAlignVertical: "top",
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: SPACING.lg },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.xs },
  choice: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  choiceItem: { flex: 1, minHeight: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: 14, fontWeight: "700" },
  error: { fontSize: 14, fontWeight: "600", marginTop: SPACING.sm },
  suggestions: { gap: 6 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  suggestion: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionText: { fontSize: 14, fontWeight: "800" },
  save: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  saveText: { fontSize: 16, fontWeight: "800" },
  blockedRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: HIT_TARGET },
  unblock: { fontSize: 14, fontWeight: "800" },
  admin: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 8,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
});
