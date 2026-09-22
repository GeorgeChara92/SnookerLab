import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useAppTheme } from "../../hooks/useAppTheme";
import { ballForCount, COLOUR_ORDER, type CalendarDay } from "../../features/stats/activity";
import { BallDefs, SvgBall } from "./SnookerBall";
import { DISPLAY_TEXT_SCALE, FONTS } from "../../constants";

const HEIGHT = 104;
const BASE = HEIGHT - 8;

/**
 * Four weeks of practice as balls on cues. Each day practised stands a ball above the rail:
 * the more logged, the taller it stands and the more the ball is worth - a red for one thing,
 * up to the black for seven or more. A quiet day is a dot on the rail.
 */
export const PracticeRhythm = ({ days, width }: { days: CalendarDay[]; width: number }) => {
  const { colors } = useAppTheme();
  const slot = width / days.length;
  const r = Math.max(3, Math.min(7, slot * 0.42));
  const busiest = Math.max(1, ...days.map((day) => day.count));
  const top = r + 4;
  const lowest = BASE - 22;
  const heightFor = (count: number) =>
    busiest === 1 ? lowest : lowest - ((count - 1) / (busiest - 1)) * (lowest - top);

  // A label under the first day of each week.
  const weeks = days
    .map((day, index) => ({ day, index }))
    .filter(({ index }) => index % 7 === 0)
    .map(({ day, index }) => ({
      index,
      text: new Date(`${day.key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    }));

  const active = days.filter((day) => day.count > 0).length;

  return (
    <View accessible accessibilityLabel={`${active} days practised in the last ${days.length} days.`}>
      <Svg width={width} height={HEIGHT}>
        <BallDefs id="rhythm" />
        <Line x1={0} y1={BASE} x2={width} y2={BASE} stroke={colors.border} strokeWidth={2} strokeLinecap="round" />
        {days.map((day, index) => {
          const x = slot * (index + 0.5);
          if (!day.count) {
            return (
              <Circle
                key={day.key}
                cx={x}
                cy={BASE}
                r={day.isToday ? 2.5 : 1.6}
                fill={day.isToday ? colors.text : colors.textSubtle}
              />
            );
          }
          const y = heightFor(day.count);
          return (
            <React.Fragment key={day.key}>
              <Line x1={x} y1={BASE} x2={x} y2={y + r} stroke={colors.borderStrong} strokeWidth={1.5} />
              <SvgBall
                id="rhythm"
                name={ballForCount(day.count)}
                x={x}
                y={y}
                r={r}
                rim={day.count >= 7 ? colors.textMuted : undefined}
              />
            </React.Fragment>
          );
        })}
        {/* Today, marked under the rail. */}
        {(() => {
          const x = slot * (days.length - 0.5);
          return <Path d={`M ${x - 4} ${HEIGHT} L ${x} ${BASE + 3} L ${x + 4} ${HEIGHT} Z`} fill={colors.text} />;
        })()}
      </Svg>
      <View style={[styles.weeks, { width }]}>
        {weeks.map((week) => (
          <Text
            key={week.index}
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.week, { left: week.index * slot, color: colors.textSubtle }]}
            numberOfLines={1}
          >
            {week.text.toUpperCase()}
          </Text>
        ))}
      </View>
    </View>
  );
};

/** What the ball colours mean, red to black. */
export const RhythmKey = () => {
  const { colors } = useAppTheme();
  const size = 12;
  return (
    <View style={styles.key}>
      <Text style={[styles.keyText, { color: colors.textSubtle }]}>1</Text>
      <Svg width={COLOUR_ORDER.length * (size + 3)} height={size}>
        <BallDefs id="key" />
        {COLOUR_ORDER.map((name, index) => (
          <SvgBall
            key={name}
            id="key"
            name={name}
            x={index * (size + 3) + size / 2}
            y={size / 2}
            r={size / 2 - 0.5}
            rim={name === "black" ? colors.textMuted : undefined}
          />
        ))}
      </Svg>
      <Text style={[styles.keyText, { color: colors.textSubtle }]}>7+ logged in a day</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  weeks: { height: 16, marginTop: 4 },
  week: { position: "absolute", top: 0, fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.8 },
  key: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  keyText: { fontSize: 12 },
});
