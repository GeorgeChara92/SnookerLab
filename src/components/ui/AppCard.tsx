import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";

export const AppCard = ({ style, ...props }: ViewProps) => {
  const { colors } = useAppTheme();

  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} {...props} />;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
});
