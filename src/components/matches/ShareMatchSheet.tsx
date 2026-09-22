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
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** The size of the shared picture: 1080 wide, the width Instagram and WhatsApp keep. */
const OUTPUT = { width: 1080, height: Math.round(1080 * CARD_RATIO) };
const SWATCH = { width: 56, height: 70 };
/** Room the sheet needs around the card: header, swatches, options and the share button. */
const CHROME_HEIGHT = 330;

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

  const Toggle = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [
        styles.toggle,
        {
          borderColor: on ? colors.primary : colors.border,
          backgroundColor: on ? colors.primary + "22" : colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={on ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
        size={18}
        color={on ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.toggleText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Share result</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.cardWrap}>
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

        <View style={styles.controls}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatches}
            accessibilityRole="radiogroup"
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
                  style={styles.swatchItem}
                >
                  <View style={[styles.swatch, { borderColor: selected ? colors.primary : "transparent" }]}>
                    <ThemeBackground
                      theme={option}
                      width={SWATCH.width}
                      height={SWATCH.height}
                      id={`swatch-${option.id}`}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.swatchName, { color: selected ? colors.text : colors.textMuted }]}
                  >
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {hasFrames || hasHighs || highlights.length ? (
            <View style={styles.toggles}>
              {highlights.length ? (
                <Toggle
                  label="Highlights"
                  on={showHighlights}
                  onPress={() => prefs.set({ highlights: !showHighlights })}
                />
              ) : null}
              {hasFrames ? (
                <Toggle label="Frame scores" on={prefs.frames} onPress={() => prefs.set({ frames: !prefs.frames })} />
              ) : null}
              {hasHighs ? (
                <Toggle
                  label="High breaks"
                  on={prefs.highBreaks}
                  onPress={() => prefs.set({ highBreaks: !prefs.highBreaks })}
                />
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={share}
            disabled={sharing}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.share,
              { backgroundColor: colors.primary, opacity: pressed || sharing ? 0.85 : 1 },
            ]}
          >
            {sharing ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <MaterialCommunityIcons name="export-variant" size={20} color={colors.onPrimary} />
            )}
            <Text style={[styles.shareText, { color: colors.onPrimary }]}>
              {images ? "Share picture" : "Share as text"}
            </Text>
          </Pressable>
          {!images ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>
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
    minHeight: 52,
  },
  title: { fontSize: 20, fontWeight: "800" },
  close: { minWidth: HIT_TARGET, minHeight: HIT_TARGET, alignItems: "flex-end", justifyContent: "center" },
  cardWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  controls: { gap: SPACING.md, paddingHorizontal: SPACING.lg },
  swatches: { gap: SPACING.md, paddingVertical: 2 },
  swatchItem: { alignItems: "center", gap: 4, width: SWATCH.width + 12 },
  swatch: {
    width: SWATCH.width + 6,
    height: SWATCH.height + 6,
    borderRadius: RADIUS.md,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchName: { fontSize: 12, fontWeight: "700" },
  toggles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  toggleText: { fontSize: 14, fontWeight: "700" },
  share: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
  },
  shareText: { fontSize: 16, fontWeight: "800" },
  note: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
