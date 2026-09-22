import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useMatchesStore } from "../../store";
import { ScoreStrip } from "../scoreboard/Scoreboard";
import { bestOfFor } from "../../features/matches/bestOf";
import { relativeDate } from "../../features/matches/matchSummary";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Matches friends scored against the player, waiting for them to say the result is right. Each
 * is shown from the player's side; confirming adds it to their record, and "Not right" tells
 * the friend, who can correct it.
 */
export const LinkRequests = () => {
  const { colors } = useAppTheme();
  const requests = useMatchesStore((state) => state.linkRequests);
  const respond = useMatchesStore((state) => state.respondToMatch);
  const [busy, setBusy] = useState<string | null>(null);

  if (!requests.length) return null;

  const answer = async (id: string, value: "confirmed" | "disputed") => {
    setBusy(id);
    await respond(id, value);
    setBusy(null);
  };

  return (
    <View style={styles.wrap}>
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
        CONFIRM {requests.length === 1 ? "A RESULT" : `${requests.length} RESULTS`}
      </Text>
      {requests.map(({ match, scorerName }) => {
        const bestOf = bestOfFor(match);
        return (
          <View key={match.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.line, { color: colors.text }]}>
              {scorerName} recorded your match · {relativeDate(match.date)}
            </Text>
            <ScoreStrip
              left={{ name: "You", score: match.user_score, leading: match.user_score > match.opponent_score }}
              right={{
                name: scorerName,
                score: match.opponent_score,
                leading: match.opponent_score > match.user_score,
              }}
              middle={bestOf ? `(${bestOf})` : "V"}
            />
            {busy === match.id ? (
              <ActivityIndicator color={colors.primary} style={styles.busy} />
            ) : (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => answer(match.id, "disputed")}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.action, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.text} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Not right</Text>
                </Pressable>
                <Pressable
                  onPress={() => answer(match.id, "confirmed")}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <MaterialCommunityIcons name="check" size={18} color={colors.onPrimary} />
                  <Text style={[styles.actionText, { color: colors.onPrimary }]}>Confirm</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm, marginBottom: SPACING.lg },
  kicker: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  line: { fontSize: 14, fontWeight: "600" },
  busy: { marginVertical: SPACING.sm },
  actions: { flexDirection: "row", gap: SPACING.sm },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  actionText: { fontSize: 15, fontWeight: "800" },
});
