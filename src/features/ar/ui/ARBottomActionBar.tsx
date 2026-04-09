import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type BarAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type ARBottomActionBarProps = {
  left?: BarAction;
  right?: BarAction;
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryDisabled?: boolean;
};

export const ARBottomActionBar: React.FC<ARBottomActionBarProps> = ({
  left,
  right,
  primaryLabel,
  onPrimaryPress,
  primaryDisabled,
}) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.sideSlot}>
        {left ? (
          <Pressable style={[styles.sideButton, left.disabled && styles.disabled]} onPress={left.onPress} disabled={left.disabled}>
            <Text style={styles.sideText}>{left.label}</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable style={[styles.primaryOuter, primaryDisabled && styles.disabled]} onPress={onPrimaryPress} disabled={primaryDisabled}>
        <View style={styles.primaryInner}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </View>
      </Pressable>

      <View style={[styles.sideSlot, styles.sideSlotRight]}>
        {right ? (
          <Pressable style={[styles.sideButton, right.disabled && styles.disabled]} onPress={right.onPress} disabled={right.disabled}>
            <Text style={styles.sideText}>{right.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  sideSlot: { width: 90, alignItems: "flex-start" },
  sideSlotRight: { alignItems: "flex-end" },
  sideButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 74,
    alignItems: "center",
  },
  sideText: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  primaryOuter: {
    width: 84,
    height: 84,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#F8FAFC",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryInner: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#0F172A", fontSize: 10, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
});
