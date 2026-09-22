import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { ReleaseNote } from "../../constants/releaseNotes";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

/**
 * What changed since the player last looked, newest version first: what they can now do, and
 * what was fixed. Shown once after an update, and any time from Settings.
 */
export const WhatsNewSheet = ({
  visible,
  notes,
  onClose,
}: {
  visible: boolean;
  notes: ReleaseNote[];
  onClose: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (!notes.length) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notes.map((note, index) => (
            <View key={note.version} style={[styles.release, index > 0 ? { borderTopColor: colors.border } : null]}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
                WHAT'S NEW · VERSION {note.version} · {note.date.toUpperCase()}
              </Text>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.headline, { color: colors.text }]}>
                {note.headline}
              </Text>

              <View style={styles.items}>
                {note.added.map((item) => (
                  <View key={item.title} style={styles.item}>
                    <View style={[styles.icon, { backgroundColor: colors.board }]}>
                      <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.boardRule} />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.itemBody, { color: colors.textMuted }]}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {note.fixed?.length ? (
                <View style={[styles.fixed, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.fixedLabel, { color: colors.textMuted }]}
                  >
                    FIXED
                  </Text>
                  {note.fixed.map((line) => (
                    <View key={line} style={styles.fixedRow}>
                      <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                      <Text style={[styles.fixedText, { color: colors.text }]}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.done, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.doneText, { color: colors.onPrimary }]}>Got it</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    marginTop: "auto",
    maxHeight: "88%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.md },
  content: { paddingBottom: SPACING.md },
  release: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 0 },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.4 },
  headline: { fontFamily: FONTS.boardHeavy, fontSize: 32, lineHeight: 34, textTransform: "uppercase" },
  items: { gap: SPACING.md, marginTop: SPACING.sm },
  item: { flexDirection: "row", gap: SPACING.md, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { fontSize: 16, fontWeight: "800" },
  itemBody: { fontSize: 14, lineHeight: 20 },
  fixed: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, marginTop: SPACING.md },
  fixedLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.2 },
  fixedRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  fixedText: { flex: 1, fontSize: 14, lineHeight: 20 },
  done: {
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  doneText: { fontSize: 17, fontWeight: "800" },
});
