import React, { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { RADIUS, SPACING } from "../../constants";

type Props = Omit<TextInputProps, "style"> & {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** Shows a button to reveal what was typed, for passwords. */
  revealable?: boolean;
  /** A line under the field: guidance, or the problem when `invalid`. */
  hint?: string;
  invalid?: boolean;
};

/** A labelled field with an icon, which lights up while you type in it. */
export const AuthField = forwardRef<TextInput, Props>(
  ({ label, icon, revealable, hint, invalid, onFocus, onBlur, ...input }, ref) => {
    const { colors } = useAppTheme();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const edge = invalid ? colors.danger : focused ? colors.primary : colors.border;

    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <View style={[styles.box, { borderColor: edge, backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} />
          <TextInput
            ref={ref}
            {...input}
            secureTextEntry={revealable ? !revealed : input.secureTextEntry}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={label}
            accessibilityHint={hint}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[styles.input, { color: colors.text }]}
          />
          {revealable ? (
            <Pressable
              onPress={() => setRevealed((value) => !value)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
            >
              <MaterialCommunityIcons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {hint ? <Text style={[styles.hint, { color: invalid ? colors.danger : colors.textMuted }]}>{hint}</Text> : null}
      </View>
    );
  }
);

AuthField.displayName = "AuthField";

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  hint: { fontSize: 12, marginTop: 5 },
});
