import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Match } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";
import {
  bestOfLabel,
  describeScore,
  getRecordingMode,
  relativeDate,
  type FormLetter,
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

export const MatchRow = ({
  match,
  title,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}: {
  match: Match;
  /** Usually the opponent; on an opponent's own page, the date. */
  title: string;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
}) => {
  const { colors } = useAppTheme();
  const letter = letterOf(match);
  const { score, unit } = describeScore(match);
  const mode = getRecordingMode(match);
  const length = mode === "manual" && match.target_frames === 1 ? "One frame" : bestOfLabel(match);
  const scoreColour = letter === "W" ? colors.primary : letter === "L" ? colors.danger : colors.text;

  const meta = [title === match.opponent_name ? relativeDate(match.date) : null, length]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={selectionMode ? { selected } : undefined}
      accessibilityLabel={`${match.result} against ${match.opponent_name}, ${score} ${unit}, ${relativeDate(match.date)}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {selectionMode ? (
        <View
          style={[
            styles.check,
            {
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : "transparent",
            },
          ]}
        >
          {selected ? <MaterialCommunityIcons name="check" size={14} color={colors.onPrimary} /> : null}
        </View>
      ) : null}

      <ResultPill letter={letter} />

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons
            name={mode === "live" ? "lightning-bolt" : "pencil-outline"}
            size={12}
            color={colors.textMuted}
          />
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {mode === "live" ? "Live" : "Manual"}
            {meta ? ` · ${meta}` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.scoreWrap}>
        <Text style={[styles.score, { color: scoreColour }]}>{score.replace("-", "–")}</Text>
        <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>
      </View>
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
    fontWeight: "800",
  },
  formStrip: {
    flexDirection: "row",
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  scoreWrap: {
    alignItems: "flex-end",
    minWidth: 56,
  },
  score: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
