import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Match } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FONTS, HIT_TARGET, SPACING } from "../../constants";
import { ScoreStrip } from "../scoreboard/Scoreboard";
import {
  bestOfLabel,
  describeScore,
  getRecordingMode,
  relativeDate,
  type FormLetter,
  countsAsResult,
} from "../../features/matches/matchSummary";

/**
 * The pieces every match list is built from, so the Matches page and an opponent's page show a
 * match the same way: result, who and when, and a score that says what it is counting.
 */

type Colours = ReturnType<typeof useAppTheme>["colors"];

const tone = (letter: FormLetter, colors: Colours) =>
  letter === "W"
    ? { fg: colors.primary, bg: `${colors.primary}22` }
    : letter === "L"
      ? { fg: colors.danger, bg: `${colors.danger}22` }
      : { fg: colors.textMuted, bg: colors.surfaceMuted };

export const ResultPill = ({ letter, size = 34 }: { letter: FormLetter; size?: number }) => {
  const { colors } = useAppTheme();
  const { fg, bg } = tone(letter, colors);

  return (
    <View style={[styles.pill, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg, fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
};

/** The last few results, newest on the left. */
export const FormStrip = ({ form, size = 24 }: { form: FormLetter[]; size?: number }) => (
  <View
    style={styles.formStrip}
    accessibilityLabel={`Recent form, newest first: ${form.join(", ")}`}
    accessible
  >
    {form.map((letter, index) => (
      <ResultPill key={`${letter}-${index}`} letter={letter} size={size} />
    ))}
  </View>
);

const letterOf = (match: Match): FormLetter =>
  match.result === "win" ? "W" : match.result === "loss" ? "L" : "D";

const resultWord = (letter: FormLetter) => (letter === "W" ? "WON" : letter === "L" ? "LOST" : "DRAWN");

/** The word on a match's row: its result, or UNFINISHED for a live match with no frame finished yet. */
const rowWord = (match: Match, letter: FormLetter) => (countsAsResult(match) ? resultWord(letter) : "UNFINISHED");

/**
 * One match, drawn as the scoreboard: you on the left, them on the right, the best-of in the
 * middle - or PTS when the numbers are the points in a single frame entered by hand. The line
 * above says when, how it was recorded, and how it went.
 */
export const MatchRow = ({
  match,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}: {
  match: Match;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
}) => {
  const { colors } = useAppTheme();
  const letter = letterOf(match);
  const { unit } = describeScore(match);
  const mode = getRecordingMode(match);
  const length = bestOfLabel(match);
  const middle = unit === "points" ? "PTS" : length ? `(${length.replace("Best of ", "")})` : "–";
  const resultColour = letter === "W" ? colors.primary : letter === "L" ? colors.danger : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={selectionMode ? { selected } : undefined}
      accessibilityLabel={`${rowWord(match, letter).toLowerCase()} against ${match.opponent_name}, ${match.user_score} to ${match.opponent_score} ${unit}, ${relativeDate(match.date)}`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.caption}>
        {selectionMode ? (
          <View
            style={[
              styles.check,
              {
                borderColor: selected ? colors.primary : colors.borderStrong,
                backgroundColor: selected ? colors.primary : "transparent",
              },
            ]}
          >
            {selected ? <MaterialCommunityIcons name="check" size={12} color={colors.onPrimary} /> : null}
          </View>
        ) : null}
        <MaterialCommunityIcons
          name={mode === "live" ? "lightning-bolt" : "pencil-outline"}
          size={12}
          color={colors.textMuted}
        />
        <Text style={[styles.captionText, { color: colors.textMuted }]} numberOfLines={1}>
          {relativeDate(match.date).toUpperCase()} · {mode === "live" ? "LIVE" : "MANUAL"}
          {unit === "points" ? " · ONE FRAME" : ""}
        </Text>
        <Text style={[styles.resultWord, { color: countsAsResult(match) ? resultColour : colors.textMuted }]}>{rowWord(match, letter)}</Text>
      </View>

      <ScoreStrip
        left={{ name: "You", score: match.user_score, leading: letter === "W" }}
        right={{ name: match.opponent_name, score: match.opponent_score, leading: letter === "L" }}
        middle={middle}
        style={selected ? { borderColor: colors.primary } : undefined}
      />
    </Pressable>
  );
};

/** A section title with an optional action on the right, e.g. "Show all 9". */
export const SectionHeader = ({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) => {
  const { colors } = useAppTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: FONTS.board,
  },
  formStrip: {
    flexDirection: "row",
    gap: 4,
  },
  row: {
    marginBottom: SPACING.md,
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  captionText: {
    flex: 1,
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 1.2,
  },
  resultWord: {
    fontFamily: FONTS.board,
    fontSize: 13,
    letterSpacing: 1.6,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: HIT_TARGET,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "700",
  },
});
