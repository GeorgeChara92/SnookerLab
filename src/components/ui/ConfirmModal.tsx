import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, SCRIM, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * A sibling of AppDialog for the prompts that cannot be raised through useDialog:
 * these ones stay on screen while an async job runs, so they carry their own loading state.
 */
export const ConfirmModal = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
  icon,
}: ConfirmModalProps) => {
  const { colors } = useAppTheme();

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

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: loading, busy: loading }}
              style={({ pressed }) => [
                styles.confirm,
                { backgroundColor: accent, opacity: loading ? 0.65 : pressed ? 0.85 : 1 },
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
