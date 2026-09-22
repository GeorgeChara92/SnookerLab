import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore, useMatchesStore } from "../../store";
import type { MatchResult, MatchType, MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError, DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";
import { parseDateValue, todayKey } from "../../utils/date";
import { useDialog } from "../../components/ui/DialogProvider";
import { findOpponent, knownOpponents, searchOpponents } from "../../features/matches/opponents";
import { useCommunityStore } from "../../store/communityStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { nameOf, type PublicProfile } from "../../features/community/types";

type Mode = "live" | "result";

const FORMATS = [1, 3, 5, 7, 9, 11];
const TYPES: Array<{ value: MatchType; label: string }> = [
  { value: "casual", label: "Friendly" },
  { value: "league", label: "League" },
  { value: "tournament", label: "Tournament" },
  { value: "practice", label: "Practice" },
];

const shortDate = (value: string) =>
  parseDateValue(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * Setting up a match. The opponent comes first, and picking someone already played fills in
 * the rest from last time - the venue, the format, the kind of match - so a regular opponent
 * is two taps from the first frame. A rematch or an opponent's page arrives with it all set.
 * Picking a friend links the match to them: once they confirm it, it counts for both.
 */
export const NewMatchScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MatchesStackParamList>>();
  const route = useRoute<RouteProp<MatchesStackParamList, "NewMatch">>();
  const prefill = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const subscription = useSubscriptionAccess();
  const matches = useMatchesStore((state) => state.matches);
  const addMatch = useMatchesStore((state) => state.addMatch);

  const known = useMemo(() => knownOpponents(matches), [matches]);
  const [mode, setMode] = useState<Mode>("live");
  const [opponent, setOpponent] = useState(prefill?.opponentName ?? "");
  const [friend, setFriend] = useState<PublicProfile | null>(null);
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { friendships, profiles } = useCommunityStore();
  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.status === "accepted")
        .map((item) => profiles[item.requester === me ? item.addressee : item.requester])
        .filter((profile): profile is PublicProfile => Boolean(profile))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    [friendships, me, profiles]
  );
  // A rematch against a friend stays linked.
  useEffect(() => {
    if (!prefill?.opponentId || friend) return;
    const found = friends.find((item) => item.id === prefill.opponentId);
    if (found) setFriend(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, prefill?.opponentId]);
  const friendMatches = useMemo(() => {
    const needle = opponent.trim().toLowerCase().replace(/^@/, "");
    return friends
      .filter(
        (item) =>
          !needle || nameOf(item).toLowerCase().includes(needle) || Boolean(item.handle?.toLowerCase().includes(needle))
      )
      .slice(0, 4);
  }, [friends, opponent]);
  const [location, setLocation] = useState(prefill?.location ?? "");
  const [bestOf, setBestOf] = useState(prefill?.targetFrames ?? 5);
  const [matchType, setMatchType] = useState<MatchType>(prefill?.matchType ?? "casual");
  const [userFrames, setUserFrames] = useState("");
  const [opponentFrames, setOpponentFrames] = useState("");
  const [focused, setFocused] = useState(!prefill?.opponentName);
  const [saving, setSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  // Settings the player has chosen themselves are never overwritten by last time's.
  const touched = useRef({
    location: Boolean(prefill?.location),
    bestOf: Boolean(prefill?.targetFrames),
    type: Boolean(prefill?.matchType),
  });

  const match = findOpponent(opponent, known);
  const suggestions = useMemo(
    () => searchOpponents(opponent, known).filter((item) => item.name !== match?.name || !opponent.trim()),
    [opponent, known, match?.name]
  );

  // A known opponent brings last time's settings with them.
  useEffect(() => {
    if (!match) return;
    const last = match.last;
    if (!touched.current.location && last.location) setLocation(last.location);
    if (!touched.current.bestOf && last.target_frames && last.recording_mode !== "manual")
      setBestOf(last.target_frames);
    if (!touched.current.type && last.match_type) setMatchType(last.match_type);
  }, [match]);

  const pick = (name: string) => {
    setOpponent(name);
    setFriend(null);
    setFocused(false);
  };

  const pickFriend = (profile: PublicProfile) => {
    setOpponent(nameOf(profile));
    setFriend(profile);
    setFocused(false);
  };

  const alert = (title: string, message: string) =>
    dialog.alert({ title, message, icon: "information-outline", confirmLabel: "OK" });

  const name = (match?.name ?? opponent).trim();
  const uFrames = Math.max(0, parseInt(userFrames, 10) || 0);
  const oFrames = Math.max(0, parseInt(opponentFrames, 10) || 0);
  const result: MatchResult = uFrames > oFrames ? "win" : uFrames < oFrames ? "loss" : "draw";
  const ready = Boolean(name) && (mode === "live" || uFrames + oFrames > 0);

  const start = async () => {
    if (!subscription.canCreateMatch) {
      setShowPaywall(true);
      return;
    }
    if (!name) {
      alert("Add an opponent first", "A match needs a name for the other side of the scoreboard.");
      return;
    }
    if (mode === "result" && uFrames + oFrames === 0) {
      alert("Add the score first", "Enter the frames each of you won.");
      return;
    }
    setSaving(true);
    try {
      const created = await addMatch({
        user_id: "",
        opponent_name: name,
        opponent_id: friend?.id,
        date: todayKey(),
        location: location.trim() || undefined,
        match_type: matchType,
        format: "best_of",
        target_frames: mode === "live" ? bestOf : Math.max(1, Math.max(uFrames, oFrames) * 2 - 1),
        frames_played: mode === "live" ? 0 : uFrames + oFrames,
        user_score: mode === "live" ? 0 : uFrames,
        opponent_score: mode === "live" ? 0 : oFrames,
        result: mode === "live" ? "draw" : result,
        recording_mode: mode === "live" ? "live" : "manual",
        sync_status: "pending",
      });
      if (mode === "live") navigation.replace("LiveFrameScoring", { matchId: created.id });
      else navigation.replace("MatchDetail", { matchId: created.id });
    } catch (error) {
      if (isSubscriptionLimitError(error)) setShowPaywall(true);
      else alert("Could not create the match", "Something went wrong. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );

  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
  ];

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
        {/* Who */}
        <Text style={[styles.label, { color: colors.textMuted }]}>OPPONENT</Text>
        <View
          style={[
            styles.opponentBox,
            { backgroundColor: colors.surface, borderColor: focused ? colors.primary : colors.border },
          ]}
        >
          <MaterialCommunityIcons name="account-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={opponent}
            onChangeText={(text) => {
              setOpponent(text);
              setFriend(null);
              setFocused(true);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Who are you playing?"
            placeholderTextColor={colors.textMuted}
            style={[styles.opponentInput, { color: colors.text }]}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus={!prefill?.opponentName}
            returnKeyType="done"
          />
          {opponent ? (
            <Pressable onPress={() => pick("")} accessibilityLabel="Clear the name" hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {focused && friendMatches.length ? (
          <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>FRIENDS · COUNTS FOR BOTH OF YOU</Text>
            {friendMatches.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => pickFriend(item)}
                accessibilityRole="button"
                accessibilityLabel={`Play ${nameOf(item)}. The match counts for both of you.`}
                style={({ pressed }) => [
                  styles.suggestion,
                  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  { backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                ]}
              >
                <CommunityAvatar profile={item} size={32} />
                <View style={styles.flex}>
                  <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={1}>
                    {nameOf(item)}
                  </Text>
                  {item.handle ? (
                    <Text style={[styles.suggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      @{item.handle}
                    </Text>
                  ) : null}
                </View>
                <MaterialCommunityIcons name="link-variant" size={18} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {friend && !focused ? (
          <View style={[styles.linked, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <CommunityAvatar profile={friend} size={32} />
            <Text style={[styles.linkedText, { color: colors.text }]}>
              Linked to {friend.handle ? `@${friend.handle}` : nameOf(friend)}. Once they confirm the result, it counts
              for both of you.
            </Text>
            <Pressable
              onPress={() => setFriend(null)}
              accessibilityRole="button"
              accessibilityLabel="Unlink the friend"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="link-variant-off" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {focused && suggestions.length ? (
          <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {suggestions.map((item, index) => (
              <Pressable
                key={item.name}
                onPress={() => pick(item.name)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.suggestion,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                  { backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                ]}
              >
                <View style={[styles.initial, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.initialText, { color: colors.text }]}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.suggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.played
                      ? `${item.wins}–${item.losses} in ${item.played} ${item.played === 1 ? "match" : "matches"}`
                      : "No results yet"}
                    {` · last ${shortDate(item.lastPlayed)}`}
                  </Text>
                </View>
                <MaterialCommunityIcons name="arrow-top-left" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {match && !focused ? (
          <View style={[styles.h2h, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
            <View style={styles.flex}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.h2hKicker, { color: colors.boardRule }]}>
                HEAD TO HEAD
              </Text>
              <Text style={[styles.h2hMeta, { color: colors.boardMuted }]}>
                Last played {shortDate(match.lastPlayed)}. Set up as last time.
              </Text>
            </View>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.h2hScore, { color: colors.boardText }]}>
              {match.wins}–{match.losses}
            </Text>
          </View>
        ) : null}

        {/* How */}
        <Text style={[styles.label, { color: colors.textMuted }]}>RECORD</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
          {(
            [
              { value: "live", label: "Score it live", icon: "play-circle-outline" },
              { value: "result", label: "Enter the result", icon: "playlist-edit" },
            ] as const
          ).map((option) => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMode(option.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.segmentItem, selected ? { backgroundColor: colors.surface } : null]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={18}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "live" ? (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>FORMAT</Text>
            <View style={styles.chips}>
              {FORMATS.map((value) => (
                <Chip
                  key={value}
                  label={`Best of ${value}`}
                  selected={bestOf === value}
                  onPress={() => {
                    touched.current.bestOf = true;
                    setBestOf(value);
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>FRAMES WON</Text>
            <View style={styles.scoreRow}>
              <View style={styles.flex}>
                <Text style={[styles.scoreName, { color: colors.textMuted }]}>You</Text>
                <TextInput
                  value={userFrames}
                  onChangeText={setUserFrames}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[inputStyle, styles.scoreInput]}
                />
              </View>
              <Text style={[styles.vs, { color: colors.textMuted }]}>v</Text>
              <View style={styles.flex}>
                <Text style={[styles.scoreName, { color: colors.textMuted }]} numberOfLines={1}>
                  {name || "Opponent"}
                </Text>
                <TextInput
                  value={opponentFrames}
                  onChangeText={setOpponentFrames}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[inputStyle, styles.scoreInput]}
                />
              </View>
            </View>
          </>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>KIND OF MATCH</Text>
        <View style={styles.chips}>
          {TYPES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={matchType === option.value}
              onPress={() => {
                touched.current.type = true;
                setMatchType(option.value);
              }}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>VENUE</Text>
        <TextInput
          value={location}
          onChangeText={(text) => {
            touched.current.location = true;
            setLocation(text);
          }}
          placeholder="Club or venue (optional)"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />

        <Pressable
          onPress={start}
          disabled={!ready || saving}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: colors.primary, opacity: !ready || saving ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons
            name={mode === "live" ? "play" : "content-save-outline"}
            size={20}
            color={colors.onPrimary}
          />
          <Text style={[styles.startText, { color: colors.onPrimary }]}>
            {saving ? "Setting up…" : mode === "live" ? (name ? `Start v ${name}` : "Start match") : "Save result"}
          </Text>
        </Pressable>
      </ScrollView>

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="Monthly Match Limit"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  label: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2, marginTop: SPACING.md },
  opponentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  opponentInput: { flex: 1, fontSize: 18, fontWeight: "700", paddingVertical: SPACING.sm },
  suggestions: { borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  groupLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  linked: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  linkedText: { flex: 1, fontSize: 13, lineHeight: 18 },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    paddingHorizontal: SPACING.md,
  },
  initial: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  initialText: { fontSize: 14, fontWeight: "800" },
  suggestionName: { fontSize: 15, fontWeight: "700" },
  suggestionMeta: { fontSize: 12 },
  h2h: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  h2hKicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2 },
  h2hMeta: { fontSize: 12, marginTop: 2 },
  h2hScore: { fontFamily: FONTS.boardHeavy, fontSize: 32 },
  segment: { flexDirection: "row", borderRadius: RADIUS.md, padding: 4, gap: 4 },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.sm,
  },
  segmentText: { fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.md },
  scoreName: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  scoreInput: { fontSize: 28, fontWeight: "800", textAlign: "center", minHeight: 64 },
  vs: { fontSize: 16, fontWeight: "700", paddingBottom: 20 },
  start: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 10,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  startText: { fontSize: 17, fontWeight: "800" },
});
