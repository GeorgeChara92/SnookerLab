import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FONTS, RADIUS, SPACING } from "../../constants";

/**
 * The broadcast scoreboard.
 *
 * Anyone who has watched snooker knows the graphic at the bottom of the screen: a dark strip, a
 * thin gold rule, the players' names at either end, their frames beside them and the best-of in
 * brackets in the middle. Scores in the app are drawn that way, so a result reads like a result
 * rather than like a row in a list.
 */

type Side = {
  name: string;
  score: number | string;
  /** Marks the winner, the way a broadcast marks the player at the table. */
  leading?: boolean;
};

export const ScoreStrip = ({
  left,
  right,
  middle,
  size = "compact",
  style,
}: {
  left: Side;
  right: Side;
  /** "(5)" for a best of five, "PTS" when the numbers are points, a count for a record. */
  middle: string;
  size?: "compact" | "hero";
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useAppTheme();
  const hero = size === "hero";

  const name = (side: Side, align: "left" | "right") => (
    <Text
      numberOfLines={1}
      style={[
        hero ? styles.heroName : styles.name,
        { color: side.leading ? colors.boardText : colors.boardMuted, textAlign: align },
      ]}
    >
      {side.name.toUpperCase()}
    </Text>
  );

  const score = (side: Side) => (
    <Text
      style={[
        hero ? styles.heroScore : styles.score,
        { color: side.leading ? colors.boardText : colors.boardMuted },
      ]}
    >
      {side.score}
    </Text>
  );

  return (
    <View
      style={[
        styles.strip,
        hero ? styles.stripHero : null,
        { backgroundColor: colors.board, borderColor: colors.boardRule },
        style,
      ]}
    >
      <View style={[styles.marker, { backgroundColor: left.leading ? colors.boardRule : "transparent" }]} />
      <View style={styles.nameCell}>{name(left, "left")}</View>
      <View style={[styles.scoreCell, hero ? styles.scoreCellHero : null]}>{score(left)}</View>

      <View style={[styles.middle, hero ? styles.middleHero : null, { backgroundColor: colors.boardRaised }]}>
        <Text style={[hero ? styles.middleTextHero : styles.middleText, { color: colors.boardMuted }]} numberOfLines={1}>
          {middle}
        </Text>
      </View>

      <View style={[styles.scoreCell, hero ? styles.scoreCellHero : null]}>{score(right)}</View>
      <View style={styles.nameCell}>{name(right, "right")}</View>
      <View style={[styles.marker, { backgroundColor: right.leading ? colors.boardRule : "transparent" }]} />
    </View>
  );
};

/** A dark panel in the scoreboard's colours, for the hero of a page. */
export const BoardPanel = ({
  kicker,
  aside,
  children,
  style,
}: {
  kicker?: string;
  /** A short note opposite the kicker, e.g. "since May". */
  aside?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.panel, { backgroundColor: colors.board, borderColor: colors.boardRule }, style]}>
      {kicker || aside ? (
        <View style={styles.panelHead}>
          {kicker ? <Text style={[styles.kicker, { color: colors.boardRule }]}>{kicker}</Text> : <View />}
          {aside ? <Text style={[styles.aside, { color: colors.boardMuted }]}>{aside}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
};

/**
 * Two players side by side, one statistic per row, with bars growing out from the middle -
 * the "match statistics" graphic a broadcast shows between frames.
 */
export const TaleOfTheTape = ({
  leftName,
  rightName,
  rows,
}: {
  leftName: string;
  rightName: string;
  rows: Array<{ label: string; left: number; right: number; format?: (value: number) => string }>;
}) => {
  const { colors } = useAppTheme();

  return (
    <View>
      <View style={styles.tapeHead}>
        <Text style={[styles.tapeName, { color: colors.boardText }]} numberOfLines={1}>
          {leftName.toUpperCase()}
        </Text>
        <Text style={[styles.tapeName, styles.tapeNameRight, { color: colors.boardMuted }]} numberOfLines={1}>
          {rightName.toUpperCase()}
        </Text>
      </View>

      {rows.map((row) => {
        const total = row.left + row.right;
        const leftShare = total ? row.left / total : 0;
        const rightShare = total ? row.right / total : 0;
        const show = row.format ?? ((value: number) => String(value));
        const leftAhead = row.left > row.right;
        const rightAhead = row.right > row.left;

        return (
          <View key={row.label} style={styles.tapeRow}>
            <View style={styles.tapeLine}>
              <Text style={[styles.tapeValue, { color: leftAhead ? colors.boardText : colors.boardMuted }]}>
                {show(row.left)}
              </Text>
              <Text style={[styles.tapeLabel, { color: colors.boardMuted }]}>{row.label.toUpperCase()}</Text>
              <Text
                style={[
                  styles.tapeValue,
                  styles.tapeValueRight,
                  { color: rightAhead ? colors.boardText : colors.boardMuted },
                ]}
              >
                {show(row.right)}
              </Text>
            </View>

            <View style={styles.tapeBars}>
              <View style={[styles.tapeHalf, styles.tapeHalfLeft, { backgroundColor: colors.boardRaised }]}>
                <View
                  style={[
                    styles.tapeFill,
                    { width: `${Math.round(leftShare * 100)}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <View style={[styles.tapeHalf, { backgroundColor: colors.boardRaised }]}>
                <View
                  style={[
                    styles.tapeFill,
                    { width: `${Math.round(rightShare * 100)}%`, backgroundColor: colors.boardMuted },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 46,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
  },
  stripHero: {
    minHeight: 84,
  },
  marker: {
    width: 3,
  },
  nameCell: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  name: {
    fontFamily: FONTS.boardLabel,
    fontSize: 16,
    letterSpacing: 1,
  },
  heroName: {
    fontFamily: FONTS.board,
    fontSize: 20,
    letterSpacing: 1.4,
  },
  scoreCell: {
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  scoreCellHero: {
    minWidth: 64,
  },
  score: {
    fontFamily: FONTS.board,
    fontSize: 26,
    fontVariant: ["tabular-nums"],
  },
  heroScore: {
    fontFamily: FONTS.boardHeavy,
    fontSize: 56,
    lineHeight: 64,
    fontVariant: ["tabular-nums"],
  },
  middle: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xs,
  },
  middleHero: {
    minWidth: 58,
  },
  middleText: {
    fontFamily: FONTS.boardLabel,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  middleTextHero: {
    fontFamily: FONTS.board,
    fontSize: 18,
    letterSpacing: 0.6,
  },

  panel: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    overflow: "hidden",
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  kicker: {
    fontFamily: FONTS.board,
    fontSize: 13,
    letterSpacing: 2,
  },
  aside: {
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  tapeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  tapeName: {
    flex: 1,
    fontFamily: FONTS.board,
    fontSize: 14,
    letterSpacing: 1.4,
  },
  tapeNameRight: {
    textAlign: "right",
  },
  tapeRow: {
    marginBottom: SPACING.md,
  },
  tapeLine: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  tapeValue: {
    width: 64,
    fontFamily: FONTS.board,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  tapeValueRight: {
    textAlign: "right",
  },
  tapeLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: FONTS.boardLabel,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  tapeBars: {
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
  },
  tapeHalf: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  tapeHalfLeft: {
    // The left player's bar grows from the middle outwards, so it fills from the right.
    alignItems: "flex-end",
  },
  tapeFill: {
    height: "100%",
    borderRadius: 3,
  },
});
