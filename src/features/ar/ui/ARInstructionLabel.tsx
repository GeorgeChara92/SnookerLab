import React from "react";
import { StyleSheet, Text, View } from "react-native";

type ARInstructionLabelProps = {
  text: string;
  secondary?: string;
};

export const ARInstructionLabel: React.FC<ARInstructionLabelProps> = ({ text, secondary }) => {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{text}</Text>
      {secondary ? <Text style={styles.secondary}>{secondary}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    maxWidth: "92%",
    borderRadius: 12,
    backgroundColor: "rgba(4,9,18,0.74)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  text: { color: "#F8FAFC", fontSize: 12, fontWeight: "700", textAlign: "center" },
  secondary: { color: "#B6C2D4", fontSize: 10, textAlign: "center" },
});
