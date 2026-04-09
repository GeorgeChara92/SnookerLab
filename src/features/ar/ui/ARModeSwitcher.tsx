import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Option = {
  key: string;
  label: string;
};

type ARModeSwitcherProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

export const ARModeSwitcher: React.FC<ARModeSwitcherProps> = ({ value, options, onChange }) => {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(4,9,18,0.72)",
    padding: 4,
    alignSelf: "center",
    gap: 4,
  },
  option: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  optionActive: {
    backgroundColor: "rgba(16,185,129,0.22)",
  },
  optionText: { color: "#C6D3E6", fontSize: 12, fontWeight: "700" },
  optionTextActive: { color: "#A7F3D0" },
});
