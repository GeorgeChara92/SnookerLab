import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { CalendarDay } from "../../features/stats/activity";
import { DISPLAY_TEXT_SCALE, FONTS } from "../../constants";

const HEIGHT = 84;

/**
 * Four weeks of practice, a slim bar a day, taller on busier days, with a dot for a day off.
 * Weeks are marked underneath; today's bar is the bright one.
 */
export const RhythmBars = ({ days, width }: { days: CalendarDay[]; width: number }) => {
  const { colors } = useAppTheme();
  const slot = width / days.length;
  const barWidth = Math.max(3, Math.min(10, slot * 0.58));
  const busiest = Math.max(1, ...days.map((day) => day.count));
  const active = days.filter((day) => day.count > 0).length;

  return (
    <View accessible accessibilityLabel={`${active} days practised in the last ${days.length} days.`}>
      <View style={[styles.chart, { width, height: HEIGHT, borderBottomColor: colors.border }]}>
        {days.map((day) => (
          <View key={day.key} style={[styles.slot, { width: slot }]}>
            {day.count ? (
              <View
                style={{
                  width: barWidth,
                  height: Math.max(8, (day.count / busiest) * (HEIGHT - 6)),
                  borderRadius: barWidth / 2,
                  backgroundColor: day.isToday ? colors.primary : `${colors.primary}99`,
                }}
              />
            ) : (
              <View style={[styles.dot, { backgroundColor: day.isToday ? colors.text : colors.border }]} />
            )}
          </View>
        ))}
      </View>
      <View style={[styles.weeks, { width }]}>
        {days.map((day, index) =>
          index % 7 === 0 ? (
            <Text
              key={day.key}
              maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
              numberOfLines={1}
              style={[styles.week, { left: index * slot, color: colors.textSubtle }]}
            >
              {new Date(`${day.key}T12:00:00`)
                .toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                .toUpperCase()}
            </Text>
          ) : null
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },
  slot: { alignItems: "center", justifyContent: "flex-end" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  weeks: { height: 16, marginTop: 6 },
  week: { position: "absolute", top: 0, fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.8 },
});
