import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FOCUS_AREAS } from "../../features/coach/types";
import { RADIUS, SPACING } from "../../constants";

import { BOOKING_NOTE_LIMIT, composeBookingNote, type BookingNoteDraft } from "../../features/coach/bookingNote";

export { BOOKING_NOTE_LIMIT, composeBookingNote, emptyBookingNote, type BookingNoteDraft } from "../../features/coach/bookingNote";

/**
 * What the player wants from the session, for the coach to read before they accept: focus areas to
 * tap, what they'd like to get out of it, and anything the coach should know (an injury, their first
 * session, bringing their own cue).
 */
export const BookingNoteFields = ({
  coachName,
  draft,
  onChange,
}: {
  coachName: string;
  draft: BookingNoteDraft;
  onChange: (next: BookingNoteDraft) => void;
}) => {
  const { colors } = useAppTheme();
  const toggle = (area: string) =>
    onChange({ ...draft, focus: draft.focus.includes(area) ? draft.focus.filter((item) => item !== area) : [...draft.focus, area] });
  const used = composeBookingNote(draft).length;

  return (
    <View style={styles.fields}>
      <Text style={[styles.label, { color: colors.textMuted }]}>What do you want to work on?</Text>
      <View style={styles.chips}>
        {FOCUS_AREAS.map((area) => {
          const selected = draft.focus.includes(area);
          return (
            <Pressable
              key={area}
              onPress={() => toggle(area)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[
                styles.chip,
                selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>{area}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={draft.goals}
        onChangeText={(goals) => onChange({ ...draft, goals: goals.slice(0, 160) })}
        placeholder={`What would you like to get out of it? e.g. "my long potting keeps letting me down"`}
        placeholderTextColor={colors.textSubtle}
        multiline
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        accessibilityLabel="What you'd like to get out of the session"
      />

      <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.sm }]}>Anything {coachName} should know first?</Text>
      <TextInput
        value={draft.info}
        onChangeText={(info) => onChange({ ...draft, info: info.slice(0, 160) })}
        placeholder="e.g. a shoulder injury, first time with a coach, bringing my own cue"
        placeholderTextColor={colors.textSubtle}
        multiline
        style={[styles.input, styles.inputShort, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        accessibilityLabel={`Anything ${coachName} should know first`}
      />
      <Text style={[styles.count, { color: used > BOOKING_NOTE_LIMIT - 20 ? colors.warning : colors.textSubtle }]}>
        {Math.min(used, BOOKING_NOTE_LIMIT)}/{BOOKING_NOTE_LIMIT} · optional, {coachName} sees it with your request
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fields: { gap: SPACING.sm },
  label: { fontSize: 13, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 34, justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minHeight: 72, fontSize: 15, textAlignVertical: "top" },
  inputShort: { minHeight: 56 },
  count: { fontSize: 12 },
});
