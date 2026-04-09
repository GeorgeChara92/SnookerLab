import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { SnookerBallColor } from "../../../store/snookerScanStore";

type ARBallSelectorProps = {
  colors: SnookerBallColor[];
  colorHex: Record<SnookerBallColor, string>;
  selected: SnookerBallColor;
  onSelect: (color: SnookerBallColor) => void;
};

export const ARBallSelector: React.FC<ARBallSelectorProps> = ({ colors, colorHex, selected, onSelect }) => {
  return (
    <View style={styles.wrap}>
      {colors.map((color) => (
        <Pressable
          key={color}
          style={[styles.chip, selected === color && styles.chipActive]}
          onPress={() => onSelect(color)}
        >
          <View style={[styles.dot, { backgroundColor: colorHex[color] }]} />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "rgba(4,9,18,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignSelf: "center",
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: "rgba(16,185,129,0.74)",
    backgroundColor: "rgba(16,185,129,0.16)",
  },
  dot: { width: 18, height: 18, borderRadius: 999 },
});
