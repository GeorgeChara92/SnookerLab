import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Routine } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useRoutineScoresStore, useSessionsStore } from "../../store";
import { BoardPanel } from "../scoreboard/Scoreboard";
import { formatScore, nextTarget, routineProgress, type ScorePoint } from "../../features/routines/progress";
import { DISPLAY_TEXT_SCALE, FONTS, SPACING } from "../../constants";

const CHART_HEIGHT = 150;
const PAD = { top: 14, right: 12, bottom: 18, left: 12 };
/** Enough points to see a shape without the line turning into a scribble. */
const SHOWN = 30;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * How the player is getting on with a routine: their best, their recent form against before, and
 * every score on a line. For timed routines the axis is flipped, so up the chart is always better.
 */
export const RoutineProgressCard = ({
  routine,
  style,
}: {
  routine: Pick<Routine, "id" | "scoring_type" | "max_score">;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useAppTheme();
  const entries = useRoutineScoresStore((state) => state.entries);
  const logs = useSessionsStore((state) => state.logs);
  const [width, setWidth] = useState(0);

  const progress = useMemo(() => routineProgress(routine, entries, logs), [routine, entries, logs]);
  const { points, best, kind, higherIsBetter, ceiling, recentAverage, change } = progress;
  const shown = points.slice(-SHOWN);

  if (!best) {
    return (
      <BoardPanel kicker="YOUR PROGRESS" style={style}>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="chart-line-variant" size={28} color={colors.boardMuted} />
          <Text style={[styles.emptyText, { color: colors.boardMuted }]}>
            Record a score to start your chart. Your best and your recent form will show here.
          </Text>
        </View>
      </BoardPanel>
    );
  }

  // The chart's range: from nothing (or the best time) to the ceiling, with room above.
  const values = shown.map((point) => point.value);
  const low = higherIsBetter ? 0 : Math.min(...values) * 0.9;
  const high = Math.max(ceiling ?? 0, ...values) * (ceiling ? 1 : 1.1) || 1;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (shown.length === 1 ? plotW / 2 : (index / (shown.length - 1)) * plotW);
  const y = (value: number) => {
    const t = (value - low) / (high - low || 1);
    return PAD.top + (higherIsBetter ? 1 - t : t) * plotH;
  };
  const line = shown
    .map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");
  const isBest = (point: ScorePoint) => point === best;

  const target = nextTarget(progress);
  const changeText =
    change === null
      ? "Five more for a trend"
      : Math.abs(change) < 0.05
        ? "Level with before"
        : `${change > 0 ? "Up" : "Down"} ${formatScore(Math.abs(change), kind)} on before`;

  return (
    <BoardPanel
      kicker="YOUR PROGRESS"
      style={style}
      aside={`${points.length} ${points.length === 1 ? "SCORE" : "SCORES"}`}
    >
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statLabel, { color: colors.boardMuted }]}>
            BEST
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statValue, { color: colors.boardRule }]}>
            {formatScore(best.value, kind)}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statNote, { color: colors.boardMuted }]}>
            {shortDate(best.at)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.boardRaised }]} />
        <View style={styles.stat}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statLabel, { color: colors.boardMuted }]}>
            LAST 5 AVG
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statValue, { color: colors.boardText }]}>
            {recentAverage === null ? "–" : formatScore(recentAverage, kind)}
          </Text>
          <View style={styles.changeRow}>
            {change !== null && Math.abs(change) >= 0.05 ? (
              <MaterialCommunityIcons
                name={change > 0 ? "arrow-up" : "arrow-down"}
                size={12}
                color={change > 0 ? colors.boardRule : colors.boardMuted}
              />
            ) : null}
            <Text
              maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
              numberOfLines={1}
              style={[styles.statNote, { color: change !== null && change > 0 ? colors.boardText : colors.boardMuted }]}
            >
              {changeText}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chart} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {/* The floor, and the most the routine allows */}
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={PAD.top + plotH}
              y2={PAD.top + plotH}
              stroke={colors.boardRaised}
              strokeWidth={1}
            />
            {ceiling !== null ? (
              <>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(ceiling)}
                  y2={y(ceiling)}
                  stroke={colors.boardMuted}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <SvgText
                  x={width - PAD.right}
                  y={y(ceiling) - 4}
                  fill={colors.boardMuted}
                  fontSize={10}
                  fontWeight="700"
                  textAnchor="end"
                >
                  {kind === "percent" ? "100%" : `MAX ${formatScore(ceiling, kind)}`}
                </SvgText>
              </>
            ) : null}
            {/* The best, as a line to beat */}
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(best.value)}
              y2={y(best.value)}
              stroke={colors.boardRule}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            {shown.length > 1 ? (
              <Path
                d={line}
                stroke={colors.boardText}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {shown.map((point, index) =>
              isBest(point) ? (
                <Circle
                  key={`${point.at}-${index}`}
                  cx={x(index)}
                  cy={y(point.value)}
                  r={6}
                  fill={colors.boardRule}
                  stroke={colors.board}
                  strokeWidth={2}
                />
              ) : (
                <Circle key={`${point.at}-${index}`} cx={x(index)} cy={y(point.value)} r={3} fill={colors.boardText} />
              )
            )}
            <SvgText x={PAD.left} y={CHART_HEIGHT - 3} fill={colors.boardMuted} fontSize={10}>
              {shortDate(shown[0].at)}
            </SvgText>
            {shown.length > 1 ? (
              <SvgText
                x={width - PAD.right}
                y={CHART_HEIGHT - 3}
                fill={colors.boardMuted}
                fontSize={10}
                textAnchor="end"
              >
                {shortDate(shown[shown.length - 1].at)}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>

      {target ? (
        <View style={[styles.target, { borderTopColor: colors.boardRaised }]}>
          <MaterialCommunityIcons name="flag-checkered" size={16} color={colors.boardRule} />
          <Text style={[styles.targetText, { color: colors.boardText }]}>{target}</Text>
        </View>
      ) : null}
    </BoardPanel>
  );
};

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.md },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  stats: { flexDirection: "row", alignItems: "stretch", marginTop: SPACING.xs },
  stat: { flex: 1, minWidth: 0 },
  divider: { width: 1, marginHorizontal: SPACING.md },
  statLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  statValue: { fontFamily: FONTS.boardHeavy, fontSize: 38, lineHeight: 42 },
  statNote: { fontSize: 12, fontWeight: "600" },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  chart: { marginTop: SPACING.md, height: CHART_HEIGHT },
  target: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  targetText: { flex: 1, fontSize: 14, fontWeight: "700" },
});
