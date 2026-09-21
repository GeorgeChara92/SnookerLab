import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, SCRIM, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";

export type DialogTone = "default" | "danger" | "success";

export type DialogRequest = {
  title: string;
  message?: string;
  tone?: DialogTone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  confirmLabel: string;
  /** A second choice, for the rare prompt that genuinely has three answers. */
  secondaryLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onSecondary?: () => void;
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
  secondaryLabel,
  cancelLabel,
  onConfirm,
  onSecondary,
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

          {/* Scrolls only if it has to: a long message at a large text size on a small phone. */}
          <ScrollView contentContainerStyle={styles.body} bounces={false} showsVerticalScrollIndicator={false}>
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

            {secondaryLabel ? (
              <Pressable
                onPress={() => {
                  onSecondary?.();
                  onDismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel}
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.secondaryText, { color: colors.text }]}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}

            {cancelLabel ? (
              <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel={cancelLabel} style={styles.cancel}>
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
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
    // Phone-width on a phone; never a stretched banner on anything wider.
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
    alignSelf: "center",
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
  secondary: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
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
