import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";

type Variant = "primary" | "secondary" | "danger";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

export const AppButton = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: AppButtonProps) => {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : colors.surfaceMuted;

  const textColor =
    variant === "primary"
      ? colors.onPrimary
      : variant === "danger"
        ? colors.onDanger
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        { backgroundColor, opacity: isDisabled ? 0.65 : 1, borderColor: colors.border },
        variant === "secondary" && styles.secondary,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  secondary: {
    borderWidth: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
});
