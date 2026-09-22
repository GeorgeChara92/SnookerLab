import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCommunityStore } from "../../store/communityStore";
import { REPORT_REASONS, type ReportReason } from "../../features/community/types";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

/**
 * Reporting something to the moderators: pick what is wrong, add a line if it helps. Reports
 * go to an admin to review; three from different players hide a profile until they have.
 */
export const ReportSheet = ({
  visible,
  onClose,
  targetType,
  targetId,
  reportedUser,
  what,
  onReported,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: "profile" | "message" | "routine" | "group";
  targetId: string;
  reportedUser?: string;
  /** What is being reported, for the title: "Georgechara's profile". */
  what: string;
  onReported?: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const report = useCommunityStore((state) => state.report);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails("");
    setError(null);
    setSent(false);
  }, [visible]);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    const result = await report({ targetType, targetId, reportedUser, reason, details });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent(true);
    onReported?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {sent ? (
            <View style={styles.done}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={40}
                color={colors.primary}
                style={{ alignSelf: "center" }}
              />
              <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>Thanks for telling us</Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>
                A moderator will look at it. They will not know it was you. If you do not want to see them again, block
                them too.
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Report {what}</Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>What is wrong?</Text>
              <ScrollView
                style={styles.list}
                contentContainerStyle={{ gap: SPACING.sm }}
                keyboardShouldPersistTaps="handled"
              >
                {REPORT_REASONS.map((option) => {
                  const selected = option.value === reason;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setReason(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.option,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + "14" : colors.surface,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={selected ? "radiobox-marked" : "radiobox-blank"}
                        size={20}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                      <View style={styles.flex}>
                        <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                        <Text style={[styles.optionHint, { color: colors.textMuted }]}>{option.hint}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Anything else a moderator should know (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={500}
                  style={[
                    styles.details,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                  ]}
                />
              </ScrollView>
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <Pressable
                onPress={send}
                disabled={!reason || sending}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.danger, opacity: !reason || sending ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryText, { color: "#FFFFFF" }]}>{sending ? "Sending…" : "Send report"}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    marginTop: "auto",
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  title: { fontSize: 20, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 20 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  optionLabel: { fontSize: 15, fontWeight: "700" },
  optionHint: { fontSize: 12 },
  details: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    textAlignVertical: "top",
  },
  error: { fontSize: 13, fontWeight: "600" },
  primary: {
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  done: { alignItems: "stretch", gap: SPACING.sm, paddingVertical: SPACING.lg },
});
