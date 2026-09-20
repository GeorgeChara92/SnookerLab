import React, { useState, useEffect } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, SCRIM, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";

type CodeConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  code: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onCodeChange: (code: string) => void;
  loading?: boolean;
  danger?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * A sibling of AppDialog for the gravest prompts: the player types the code back
 * before the action can run, and the dialog stays put while it does.
 */
export const CodeConfirmModal = ({
  visible,
  title,
  message,
  code,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  onCodeChange,
  loading = false,
  danger = false,
  icon,
}: CodeConfirmModalProps) => {
  const { colors } = useAppTheme();
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!visible) {
      setInputValue("");
    }
  }, [visible]);

  const handleChange = (text: string) => {
    const upper = text.toUpperCase();
    setInputValue(upper);
    onCodeChange(upper);
  };

  const isValid = inputValue.trim().toUpperCase() === code;
  const confirmDisabled = !isValid || loading;

  const accent = danger ? colors.danger : colors.primary;
  const onAccent = danger ? colors.onDanger : colors.onPrimary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close">
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => null}
          accessibilityViewIsModal
        >
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          <View style={styles.body}>
            {icon ? (
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={icon} size={26} color={accent} />
              </View>
            ) : null}

            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Type this code to confirm</Text>
            <View style={[styles.codeChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.codeDisplay, { color: accent }]} accessibilityLabel={`Confirmation code ${code.split("").join(" ")}`}>
                {code}
              </Text>
            </View>

            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              value={inputValue}
              onChangeText={handleChange}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              accessibilityLabel="Confirmation code"
            />

            <Pressable
              onPress={onConfirm}
              disabled={confirmDisabled}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: confirmDisabled, busy: loading }}
              style={({ pressed }) => [
                styles.confirm,
                { backgroundColor: accent, opacity: confirmDisabled ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={onAccent} />
              ) : (
                <Text style={[styles.confirmText, { color: onAccent }]}>{confirmLabel}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              accessibilityState={{ disabled: loading }}
              style={[styles.cancel, { opacity: loading ? 0.5 : 1 }]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentBar: {
    height: 4,
  },
  body: {
    padding: SPACING.xl,
    alignItems: "center",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: SPACING.lg,
  },
  codeChip: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  codeDisplay: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },
  codeInput: {
    alignSelf: "stretch",
    minHeight: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 2,
    marginTop: SPACING.md,
  },
  confirm: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xl,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "800",
  },
  cancel: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
