import React from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { RADIUS, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { BallColourName } from "../../constants/theme";
import type { LiveFoulType } from "../../features/matches/liveFrameEngine";

/** A foul is worth the value of the ball involved, with four as the minimum. */
const PENALTIES: Array<{ value: 4 | 5 | 6 | 7; ball: BallColourName; note: string }> = [
  { value: 4, ball: "brown", note: "Minimum, or the brown" },
  { value: 5, ball: "blue", note: "The blue" },
  { value: 6, ball: "pink", note: "The pink" },
  { value: 7, ball: "black", note: "The black" },
];

const FOUL_TYPES: Array<{ key: LiveFoulType; label: string }> = [
  { key: "in_off", label: "In-off" },
  { key: "foul_and_miss", label: "Foul and a miss" },
  { key: "push_shot", label: "Push shot" },
  { key: "touching_ball", label: "Touching ball" },
  { key: "wrong_ball", label: "Wrong ball" },
  { key: "other", label: "Other foul" },
];

type Props = {
  visible: boolean;
  /** The lowest legal penalty for the ball currently on. */
  minimumValue: 4 | 5 | 6 | 7;
  value: 4 | 5 | 6 | 7;
  onValueChange: (value: 4 | 5 | 6 | 7) => void;
  foulType: LiveFoulType;
  onFoulTypeChange: (type: LiveFoulType) => void;
  note: string;
  onNoteChange: (note: string) => void;
  /** Who receives the penalty points. */
  awardedTo: string;
  onApply: () => void;
  onCancel: () => void;
};

export const FoulSheet = ({
  visible,
  minimumValue,
  value,
  onValueChange,
  foulType,
  onFoulTypeChange,
  note,
  onNoteChange,
  awardedTo,
  onApply,
  onCancel,
}: Props) => {
  const { colors } = useAppTheme();
  const penalty = Math.max(value, minimumValue);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close foul entry">
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => null}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>Foul</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {penalty} {penalty === 1 ? "point" : "points"} to {awardedTo}
          </Text>

          <View style={styles.ballRow}>
            {PENALTIES.map((option) => {
              const ball = colors.balls[option.ball];
              const selected = penalty === option.value;
              const disabled = option.value < minimumValue;

              return (
                <Pressable
                  key={option.value}
                  disabled={disabled}
                  onPress={() => onValueChange(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${option.value} point foul, ${option.note}`}
                  style={({ pressed }) => [
                    styles.ballOption,
                    { opacity: disabled ? 0.3 : pressed ? 0.8 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.ball,
                      {
                        backgroundColor: ball.base,
                        borderColor: selected ? colors.text : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.ballValue, { color: ball.on }]}>{option.value}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {minimumValue > 4 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              The ball on is worth {minimumValue}, so the foul cannot be less.
            </Text>
          ) : null}

          <View style={styles.typeWrap}>
            {FOUL_TYPES.map((type) => {
              const selected = foulType === type.key;
              return (
                <Pressable
                  key={type.key}
                  onPress={() => onFoulTypeChange(type.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.typeText, { color: selected ? colors.onPrimary : colors.text }]}>{type.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={note}
            onChangeText={onNoteChange}
            placeholder="Note (optional)"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Add a note about this foul"
            style={[styles.note, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
          />

          <Pressable
            onPress={onApply}
            accessibilityRole="button"
            accessibilityLabel={`Award ${penalty} points to ${awardedTo}`}
            style={({ pressed }) => [styles.apply, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.applyText, { color: colors.onPrimary }]}>Award {penalty} points</Text>
          </Pressable>

          <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 10, 8, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  ballRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.lg,
  },
  ballOption: {
    flex: 1,
    alignItems: "center",
  },
  ball: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ballValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  hint: {
    fontSize: 12,
    marginTop: SPACING.sm,
  },
  typeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  typeChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  note: {
    marginTop: SPACING.lg,
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
  },
  apply: {
    marginTop: SPACING.lg,
    minHeight: 50,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {
    fontSize: 15,
    fontWeight: "800",
  },
  cancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
