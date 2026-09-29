import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAuthStore } from "../../store";
import { submitAppFeedback } from "../../features/feedback/feedback";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const LIMIT = 2000;

/** A note about the app itself - not a coach review, not a support request needing a reply, just
 * something for us to read. */
export const FeedbackScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { user } = useAuthStore();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!user?.id || !message.trim()) return;
    setSending(true);
    const result = await submitAppFeedback(user.id, message);
    setSending(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not send that", message: result.message, tone: "danger" });
      return;
    }
    dialog.alert({
      title: "Thanks",
      message: "That's been sent through. We read every one.",
      icon: "check-circle-outline",
      confirmLabel: "Done",
      onConfirm: () => navigation.goBack(),
    });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        What's working, what isn't, or what you'd like to see - this goes straight to us, not into a support queue.
      </Text>
      <TextInput
        value={message}
        onChangeText={(text) => setMessage(text.slice(0, LIMIT))}
        placeholder="Tell us what's on your mind..."
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <Text style={[styles.charCount, { color: colors.textSubtle }]}>
        {message.length}/{LIMIT}
      </Text>
      <Pressable
        onPress={send}
        disabled={!message.trim() || sending}
        accessibilityRole="button"
        style={[styles.send, { backgroundColor: colors.primary, opacity: !message.trim() || sending ? 0.5 : 1 }]}
      >
        {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.sendText, { color: colors.onPrimary }]}>Send feedback</Text>}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.sm },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.sm },
  input: { minHeight: 160, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, fontSize: 15, lineHeight: 21 },
  charCount: { fontSize: 12, textAlign: "right" },
  send: { marginTop: SPACING.md, minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  sendText: { fontSize: 16, fontWeight: "800" },
});
