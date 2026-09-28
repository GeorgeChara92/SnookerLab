import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useUiModeStore } from "../../store/uiModeStore";
import { SPACING, RADIUS } from "../../constants";

type Props = { onChoose: () => void };

/**
 * Shown once per app open to an account flagged as a coach, right after signing in: player or
 * coach view first. Added because always opening into the player view, with the coach view
 * buried in Profile settings, meant nobody could find their way to it.
 *
 * A compact, centred card rather than a full page - the choice itself is small, and a full
 * screen just for two buttons left most of it empty.
 */
export const ChooseViewScreen = ({ onChoose }: Props) => {
  const { colors } = useAppTheme();
  const setViewMode = useUiModeStore((state) => state.setViewMode);

  const choose = (mode: "player" | "coach") => {
    setViewMode(mode);
    onChoose();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>How do you want to open Snookered?</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>You can switch any time from Profile.</Text>

        <View style={styles.options}>
          <Pressable
            onPress={() => choose("player")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.option,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="billiards-rack" size={30} color={colors.primary} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>Play</Text>
            <Text style={[styles.optionBody, { color: colors.textMuted }]}>Matches, practice, stats</Text>
          </Pressable>

          <Pressable
            onPress={() => choose("coach")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.option,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="whistle-outline" size={30} color={colors.primary} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>Coach</Text>
            <Text style={[styles.optionBody, { color: colors.textMuted }]}>Sessions, calendar, clients</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  card: {
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.xs,
  },
  title: { fontSize: 19, fontWeight: "800", textAlign: "center", lineHeight: 25 },
  subtitle: { fontSize: 13, textAlign: "center", marginBottom: SPACING.md },
  options: { flexDirection: "row", gap: SPACING.sm },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  optionTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  optionBody: { fontSize: 12, textAlign: "center", lineHeight: 16 },
});
