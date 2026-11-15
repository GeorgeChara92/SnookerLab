import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Match } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useMatchesStore } from "../../store";
import { useSharePrefsStore } from "../../store/sharePrefsStore";
import { bestOfFor } from "../../features/matches/bestOf";
import { matchCard } from "../../features/matches/breaks";
import { matchHighlights, type Highlight } from "../../features/matches/highlights";
import { canShareImages, shareText, shareViewAsImage } from "../../features/share/shareImage";
import { CARD_RATIO, MatchResultCard } from "./MatchResultCard";
import { CARD_THEMES, ThemeBackground, themeById } from "./cardThemes";
import { matchShareFor } from "../../features/community/matchShare";
import { openSendToChat } from "../../navigation/navigationRef";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** The size of the shared picture: 1080 wide, the width Instagram and WhatsApp keep. */
const OUTPUT = { width: 1080, height: Math.round(1080 * CARD_RATIO) };
const SWATCH = 46;
/** Room the sheet needs around the card: header, backgrounds, options and the two buttons. */
const CHROME_HEIGHT = 390;

/** Highlights that already say what the high break was. */
const BREAK_KINDS: Highlight["kind"][] = ["maximum", "century", "personal-best", "fifties"];

export { bestOfFor };

/** The words sent with the picture, or on their own where pictures cannot be shared yet. */
export const resultMessage = (match: Match, highBreak: number, highlights: Highlight[] = []) => {
  const verb =
    match.user_score > match.opponent_score ? "Won" : match.user_score < match.opponent_score ? "Lost" : "Drew";
  const bestOf = bestOfFor(match);
  return [
    `${verb} ${match.user_score}–${match.opponent_score} against ${match.opponent_name}${bestOf ? ` (best of ${bestOf})` : ""}.`,
    ...highlights.slice(0, 3).map((item) => item.sentence),
    highBreak && !highlights.some((item) => BREAK_KINDS.includes(item.kind)) ? `High break ${highBreak}.` : null,
    "Scored with Snookered.",
  ]
    .filter(Boolean)
    .join(" ");
};

/** The result card, a choice of backgrounds and what to show, and a button to share it. */
export const ShareMatchSheet = ({
  match,
  visible,
  onClose,
}: {
  match: Match;
  visible: boolean;
  onClose: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const username = useAuthStore((state) => state.user?.username);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const matches = useMatchesStore((state) => state.matches);
  const frames = liveFramesByMatch[match.id];
  const prefs = useSharePrefsStore();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const images = useMemo(() => canShareImages(), []);

  const card = useMemo(() => matchCard(frames ?? []), [frames]);
  const highlights = useMemo(() => {
    const bestOf = bestOfFor(match);
    return matchHighlights(match, matches, liveFramesByMatch, bestOf ? Math.floor(bestOf / 2) + 1 : undefined);
  }, [match, matches, liveFramesByMatch]);
  // A century or a maximum opens on the gold card, whatever was picked last time: it is the
  // moment. Picking another here still wins.
  const special = highlights.some((item) => item.kind === "maximum" || item.kind === "century");
  const [pickedHere, setPickedHere] = useState<string | null>(null);
  const theme = themeById(pickedHere ?? (special ? "century" : (prefs.themeId ?? undefined)));
  const showHighlights = prefs.highlights !== false;
  const cardWidth = Math.max(
    200,
    Math.min(width - SPACING.lg * 2, 400, (height - insets.top - insets.bottom - CHROME_HEIGHT) / CARD_RATIO)
  );
  const message = resultMessage(match, card.highUser, showHighlights ? highlights : []);
  const hasFrames = card.frames.length > 0;
  const hasHighs = card.highUser > 0 || card.highOpponent > 0;

  const share = async () => {
    setSharing(true);
    try {
      const sent = images && (await shareViewAsImage(cardRef, message, OUTPUT));
      if (!sent) await shareText(message);
    } finally {
      setSharing(false);
    }
  };

  const sendInChat = () => {
    onClose();
    openSendToChat(matchShareFor(match, matches, liveFramesByMatch));
  };

  const Toggle = ({ label, icon, on, onPress }: { label: string; icon: string; on: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.toggle,
        {
          borderColor: on ? colors.boardRule : "rgba(255,255,255,0.14)",
          backgroundColor: on ? "rgba(255,255,255,0.08)" : "transparent",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={16} color={on ? colors.boardRule : colors.boardMuted} />
      <Text style={[styles.toggleText, { color: on ? colors.boardText : colors.boardMuted }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          { backgroundColor: colors.board, paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
              SHARE
            </Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.boardText }]}>
              Your result
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={6}
            style={({ pressed }) => [styles.close, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialCommunityIcons name="close" size={22} color={colors.boardText} />
          </Pressable>
        </View>

        <View style={styles.stage}>
          <View style={styles.cardShadow}>
            <MatchResultCard
              ref={cardRef}
              id="share-card"
              match={match}
              playerName={username || "You"}
              bestOf={bestOfFor(match)}
              frames={card.frames}
              highUser={card.highUser}
              highOpponent={card.highOpponent}
              width={cardWidth}
              theme={theme}
              options={{ frames: prefs.frames, highBreaks: prefs.highBreaks, highlights: showHighlights }}
              highlights={highlights}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.backgroundRow}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.boardMuted }]}>
              {theme.name.toUpperCase()}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatches}
              accessibilityRole="radiogroup"
              accessibilityLabel="Background"
            >
              {CARD_THEMES.map((option) => {
                const selected = option.id === theme.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setPickedHere(option.id);
                      prefs.set({ themeId: option.id });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.name} background`}
                    hitSlop={4}
                    style={[styles.swatchRing, { borderColor: selected ? colors.boardRule : "transparent" }]}
                  >
                    <View style={styles.swatch}>
                      <ThemeBackground theme={option} width={SWATCH} height={SWATCH} id={`swatch-${option.id}`} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {hasFrames || hasHighs || highlights.length ? (
            <View style={styles.toggles}>
              {highlights.length ? (
                <Toggle
                  label="Highlights"
                  icon="star-four-points-outline"
                  on={showHighlights}
                  onPress={() => prefs.set({ highlights: !showHighlights })}
                />
              ) : null}
              {hasFrames ? (
                <Toggle
                  label="Frame scores"
                  icon="view-grid-outline"
                  on={prefs.frames}
                  onPress={() => prefs.set({ frames: !prefs.frames })}
                />
              ) : null}
              {hasHighs ? (
                <Toggle
                  label="High breaks"
                  icon="fire"
                  on={prefs.highBreaks}
                  onPress={() => prefs.set({ highBreaks: !prefs.highBreaks })}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={share}
              disabled={sharing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.share,
                { backgroundColor: colors.boardText, opacity: pressed || sharing ? 0.85 : 1 },
              ]}
            >
              {sharing ? (
                <ActivityIndicator color={colors.board} />
              ) : (
                <MaterialCommunityIcons name="export-variant" size={20} color={colors.board} />
              )}
              <Text style={[styles.shareText, { color: colors.board }]}>{images ? "Share picture" : "Share as text"}</Text>
            </Pressable>
            <Pressable
              onPress={sendInChat}
              accessibilityRole="button"
              accessibilityHint="Sends this result to a friend or a group in Snookered"
              style={({ pressed }) => [styles.chat, { borderColor: colors.boardRule, opacity: pressed ? 0.8 : 1 }]}
            >
              <MaterialCommunityIcons name="chat-outline" size={20} color={colors.boardText} />
              <Text style={[styles.chatText, { color: colors.boardText }]} numberOfLines={1} adjustsFontSizeToFit>
                Send in a chat
              </Text>
            </Pressable>
          </View>
          {!images ? (
            <Text style={[styles.note, { color: colors.boardMuted }]}>
              Sharing the picture comes with the next app build. Until then it shares the result as text.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    minHeight: 60,
  },
  headerText: { gap: 2 },
  kicker: { fontFamily: FONTS.board, fontSize: 13, letterSpacing: 2.4 },
  title: { fontSize: 22, fontWeight: "800" },
  close: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: HIT_TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md },
  // The card sits on the table like a printed card: lifted, with a soft shadow under it.
  cardShadow: {
    borderRadius: RADIUS.lg,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  controls: { gap: SPACING.md, paddingHorizontal: SPACING.lg },
  backgroundRow: { gap: SPACING.sm },
  label: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.6 },
  swatches: { gap: SPACING.sm, paddingVertical: 2 },
  swatchRing: {
    width: SWATCH + 8,
    height: SWATCH + 8,
    borderRadius: (SWATCH + 8) / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, overflow: "hidden" },
  toggles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  toggleText: { fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", gap: SPACING.sm },
  share: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  shareText: { fontSize: 16, fontWeight: "800" },
  chat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
  },
  chatText: { fontSize: 15, fontWeight: "700" },
  note: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
