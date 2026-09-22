import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { runsOf, type CalendarDay } from "../../features/stats/activity";
import { DISPLAY_TEXT_SCALE, FONTS } from "../../constants";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const TRACK = 10;
const GAP = 6;

/**
 * The week as one track of seven. Days practised light up, and days in a row join into a
 * single bar, so a streak reads as one line; the number above says how much was logged. Today
 * is outlined until something is. Drawn for the dark scoreboard panels.
 */
export const WeekTrack = ({ days, width }: { days: CalendarDay[]; width: number }) => {
  const { colors } = useAppTheme();
  const slot = width / 7;
  const runs = runsOf(days);

  const label = days
    .map((day, index) => `${LETTERS[index]}: ${day.count ? `${day.count} logged` : day.isFuture ? "to come" : "none"}`)
    .join(", ");

  return (
    <View accessible accessibilityLabel={`This week. ${label}`} style={{ width }}>
      <View style={styles.row}>
        {days.map((day) => (
          <Text
            key={day.key}
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.count, { width: slot, color: day.count ? colors.boardText : "transparent" }]}
          >
            {day.count || "0"}
          </Text>
        ))}
      </View>

      <View style={[styles.track, { width }]}>
        {days.map((day, index) => (
          <View
            key={day.key}
            style={[
              styles.pill,
              {
                left: slot * index + GAP / 2,
                width: slot - GAP,
                backgroundColor: day.isFuture ? "transparent" : colors.boardRaised,
                borderColor: day.isToday ? colors.boardText : day.isFuture ? colors.boardRaised : "transparent",
              },
            ]}
          />
        ))}
        {runs.map(([start, end]) => (
          <View
            key={`${start}-${end}`}
            style={[
              styles.pill,
              styles.run,
              {
                left: slot * start + GAP / 2,
                width: slot * (end - start + 1) - GAP,
                backgroundColor: colors.boardRule,
                borderColor: colors.boardRule,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.row}>
        {days.map((day, index) => (
          <Text
            key={day.key}
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[
              styles.letter,
              { width: slot, color: day.isToday ? colors.boardText : colors.boardMuted },
              day.isToday ? styles.today : null,
            ]}
          >
            {LETTERS[index]}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  count: { fontFamily: FONTS.board, fontSize: 14, textAlign: "center", marginBottom: 4 },
  track: { height: TRACK },
  pill: { position: "absolute", top: 0, height: TRACK, borderRadius: TRACK / 2, borderWidth: 1.5 },
  run: { borderWidth: 0 },
  letter: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1, textAlign: "center", marginTop: 6 },
  today: { fontFamily: FONTS.board },
});
