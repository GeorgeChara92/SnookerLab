import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";

export type DialogTone = "default" | "danger" | "success";

export type DialogRequest = {
  title: string;
  message?: string;
  tone?: DialogTone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

type Props = DialogRequest & {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * The app's own dialog, in place of Alert.alert. A system alert drops the player out of
 * the room the app has built; this keeps the baize, the type and the accent colour.
 */
export const AppDialog = ({
  visible,
  title,
  message,
  tone = "default",
  icon,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onDismiss,
}: Props) => {
  const { colors } = useAppTheme();

  const accent = tone === "danger" ? colors.danger : tone === "success" ? colors.accent : colors.primary;
  const onAccent = tone === "danger" ? colors.onDanger : tone === "success" ? colors.onAccent : colors.onPrimary;

  const dismiss = () => {
    onCancel?.();
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Close">
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
            {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}

            <Pressable
              onPress={() => {
                onConfirm?.();
                onDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={({ pressed }) => [styles.confirm, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.confirmText, { color: onAccent }]}>{confirmLabel}</Text>
            </Pressable>

            {cancelLabel ? (
              <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel={cancelLabel} style={styles.cancel}>
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 10, 8, 0.72)",
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
