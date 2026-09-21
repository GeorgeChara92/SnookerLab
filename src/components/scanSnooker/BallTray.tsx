import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { BALL_LOOK } from "./TableDiagram";
import { BALL_LIMIT, type BallColour } from "../../features/scanSnooker/table";
import { countOf, type PlacedBall } from "../../features/scanSnooker/position";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS } from "../../constants";

/** The balls to place, in potting order, sharing the width so all eight fit on any phone. */
const TRAY: BallColour[] = ["cue", "red", "yellow", "green", "brown", "blue", "pink", "black"];

type Props = {
  balls: PlacedBall[];
  selected: BallColour;
  onSelect: (colour: BallColour) => void;
};

export const BallTray = ({ balls, selected, onSelect }: Props) => {
  const { colors } = useAppTheme();

  return (
    <View style={styles.tray}>
      {TRAY.map((item) => {
        const active = selected === item;
        const count = countOf(balls, item);
        const full = count >= BALL_LIMIT[item];
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${BALL_LOOK[item].label}${item === "red" ? `, ${count} of 15 placed` : count ? ", placed" : ""}`}
            style={[
              styles.item,
              { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.surface },
            ]}
          >
            <View
              style={[
                styles.ball,
                {
                  backgroundColor: BALL_LOOK[item].fill,
                  borderColor: BALL_LOOK[item].edge,
                  opacity: full && item !== "red" && !active ? 0.45 : 1,
                },
              ]}
            />
            <Text
              maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
              style={[styles.count, { color: active ? colors.text : colors.textMuted }]}
            >
              {item === "red" ? `${count}/15` : count ? "✓" : " "}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tray: { flexDirection: "row", gap: 6 },
  item: {
    flex: 1,
    maxWidth: 56,
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
  },
  ball: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  count: { fontFamily: FONTS.boardLabel, fontSize: 12 },
});
