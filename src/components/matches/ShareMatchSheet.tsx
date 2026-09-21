import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Match } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useMatchesStore } from "../../store";
import { matchCard } from "../../features/matches/breaks";
import { canShareImages, shareText, shareViewAsImage } from "../../features/share/shareImage";
import { CARD_RATIO, MatchResultCard } from "./MatchResultCard";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

/** The size of the shared picture: 1080 wide, the width Instagram and WhatsApp keep. */
const OUTPUT = { width: 1080, height: 1080 * CARD_RATIO };

export const bestOfFor = (match: Pick<Match, "format" | "target_frames">) => {
  if (match.target_frames) return match.target_frames;
  const parsed = parseInt(String(match.format).replace("best_of_", ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/** The words sent with the picture, or on their own where pictures cannot be shared yet. */
export const resultMessage = (match: Match, highBreak: number) => {
  const verb =
    match.user_score > match.opponent_score ? "Won" : match.user_score < match.opponent_score ? "Lost" : "Drew";
  const bestOf = bestOfFor(match);
  return [
    `${verb} ${match.user_score}–${match.opponent_score} against ${match.opponent_name}${bestOf ? ` (best of ${bestOf})` : ""}.`,
    highBreak ? `High break ${highBreak}.` : null,
    "Scored with Snooker Lab.",
  ]
    .filter(Boolean)
    .join(" ");
};

/** A preview of the result card and a button to share it. */
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
  const frames = useMatchesStore((state) => state.liveFramesByMatch[match.id]);
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const images = useMemo(() => canShareImages(), []);

  const card = useMemo(() => matchCard(frames ?? []), [frames]);
  // As wide as the screen allows, and short enough to leave room for the buttons.
  const cardWidth = Math.min(width - SPACING.lg * 2, 380, (height - insets.top - insets.bottom - 200) / CARD_RATIO);
  const message = resultMessage(match, card.highUser);

  const share = async () => {
    setSharing(true);
    try {
      const sent = images && (await shareViewAsImage(cardRef, message, OUTPUT));
      if (!sent) await shareText(message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.scrim,
          { backgroundColor: SCRIM, paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <MatchResultCard
          ref={cardRef}
          match={match}
          playerName={username || "You"}
          bestOf={bestOfFor(match)}
          frames={card.frames}
          highUser={card.highUser}
          highOpponent={card.highOpponent}
          width={cardWidth}
        />

        <View style={[styles.actions, { width: cardWidth }]}>
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
              {images ? "Share picture" : "Share result"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.close,
              { borderColor: "rgba(255,255,255,0.35)", opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          {!images ? (
            <Text style={styles.note}>
              Sharing as a picture comes with the next app update. For now it shares as text.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.lg, paddingHorizontal: SPACING.lg },
  actions: { gap: SPACING.sm },
  share: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  shareText: { fontSize: 16, fontWeight: "800" },
  close: {
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  note: { color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 17, textAlign: "center" },
});
