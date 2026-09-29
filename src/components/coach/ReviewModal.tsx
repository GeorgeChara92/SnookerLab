import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../ui/DialogProvider";
import { upsertCoachReview } from "../../features/coach/reviews";
import type { CoachReview } from "../../features/coach/types";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

const BODY_LIMIT = 600;

/** Rate and review a coach - only ever shown once a finished session with them exists, and only
 * ever writes as the signed-in player themselves (see coach_reviews_insert). */
export const ReviewModal = ({
  visible,
  coachId,
  playerId,
  existing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  coachId: string;
  playerId: string | null;
  existing: CoachReview | null;
  onClose: () => void;
  onSaved: (review: CoachReview) => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [body, setBody] = useState(existing?.body ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRating(existing?.rating ?? 5);
    setBody(existing?.body ?? "");
  }, [visible, existing]);

  const save = async () => {
    if (!playerId) return;
    setSaving(true);
    const result = await upsertCoachReview(coachId, playerId, rating, body);
    setSaving(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not save that", message: result.message, tone: "danger" });
      return;
    }
    onSaved({
      id: existing?.id ?? "",
      coachId,
      playerId,
      rating,
      body: body.trim() || null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>{existing ? "Edit your review" : "Leave a review"}</Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} accessibilityRole="button" accessibilityLabel={`${star} stars`} hitSlop={6}>
              <MaterialCommunityIcons name={star <= rating ? "star" : "star-outline"} size={34} color={colors.primary} />
            </Pressable>
          ))}
        </View>

        <TextInput
          value={body}
          onChangeText={(text) => setBody(text.slice(0, BODY_LIMIT))}
          placeholder="What was the session like? (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />

        <Pressable onPress={save} disabled={saving} accessibilityRole="button" style={[styles.save, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save review</Text>}
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    marginTop: "auto",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.xs },
  title: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  stars: { flexDirection: "row", justifyContent: "center", gap: SPACING.sm },
  input: { minHeight: 90, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, fontSize: 15, lineHeight: 20 },
  save: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 16, fontWeight: "800" },
});
