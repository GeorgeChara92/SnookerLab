import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { useAppTheme } from "../../hooks/useAppTheme";
import { COLOUR_ORDER, type CalendarDay } from "../../features/stats/activity";
import { BALL_TONES, BallDefs, SvgBall } from "./SnookerBall";
import { DISPLAY_TEXT_SCALE, FONTS } from "../../constants";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const HEIGHT = 40;

/**
 * The week as the colours along a cushion rail: Monday is the red, then yellow, green, brown,
 * blue, pink and Sunday the black. A day practised puts its ball on the rail, and days in a row
 * light the rail between them gold. A day missed shows only the rail's diamond sight; today,
 * until something is logged, is the ball's outline waiting to be filled.
 */
export const WeekRail = ({ days, width }: { days: CalendarDay[]; width: number }) => {
  const { colors } = useAppTheme();
  const slot = width / 7;
  const r = Math.min(13, slot * 0.3);
  const y = HEIGHT / 2;
  const xs = days.map((_, index) => slot * (index + 0.5));
  const played = days.map((day) => day.count > 0);

  const label = days
    .map((day, index) => `${LETTERS[index]}: ${day.count ? "practised" : day.isFuture ? "to come" : "no practice"}`)
    .join(", ");

  return (
    <View accessible accessibilityLabel={`This week. ${label}`}>
      <Svg width={width} height={HEIGHT}>
        <BallDefs id="rail" />
        <Line x1={xs[0]} y1={y} x2={xs[6]} y2={y} stroke={colors.boardRaised} strokeWidth={3} strokeLinecap="round" />
        {xs
          .slice(1)
          .map((x, index) =>
            played[index] && played[index + 1] ? (
              <Line
                key={`run-${index}`}
                x1={xs[index]}
                y1={y}
                x2={x}
                y2={y}
                stroke={colors.boardRule}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ) : null
          )}
        {days.map((day, index) => {
          const x = xs[index];
          const name = COLOUR_ORDER[index];
          if (day.count > 0) {
            return (
              <SvgBall
                key={day.key}
                id="rail"
                name={name}
                x={x}
                y={y}
                r={r}
                rim={name === "black" ? colors.boardMuted : undefined}
              />
            );
          }
          if (day.isToday) {
            return (
              <Circle
                key={day.key}
                cx={x}
                cy={y}
                r={r - 1}
                fill={colors.board}
                stroke={name === "black" ? colors.boardText : BALL_TONES[name][0]}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            );
          }
          if (day.isFuture) {
            return <Circle key={day.key} cx={x} cy={y} r={2} fill={colors.boardMuted} opacity={0.5} />;
          }
          // The diamond sight set into the rail.
          return (
            <Rect
              key={day.key}
              x={x - 3.5}
              y={y - 3.5}
              width={7}
              height={7}
              fill={colors.boardMuted}
              opacity={0.8}
              transform={`rotate(45 ${x} ${y})`}
            />
          );
        })}
      </Svg>
      <View style={styles.letters}>
        {days.map((day, index) => (
          <Text
            key={day.key}
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.letter, { width: slot, color: day.isToday ? colors.boardText : colors.boardMuted }]}
          >
            {LETTERS[index]}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  letters: { flexDirection: "row", marginTop: 4 },
  letter: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1, textAlign: "center" },
});
