import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, SCRIM, SPACING } from "../../constants";
import { RuleBody } from "../rules/RuleBody";
import { getRuleTopic, type RuleTopicId } from "../../features/rules/rules";
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

/** The rule to read for each kind of foul. */
const RULE_FOR: Record<LiveFoulType, { topic: RuleTopicId; label: string }> = {
  in_off: { topic: "fouls", label: "What counts as a foul?" },
  foul_and_miss: { topic: "foul-and-miss", label: "When is it a miss?" },
  push_shot: { topic: "fouls", label: "What counts as a foul?" },
  touching_ball: { topic: "touching-ball", label: "Touching ball rules" },
  wrong_ball: { topic: "fouls", label: "What counts as a foul?" },
  other: { topic: "fouls", label: "What counts as a foul?" },
};

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
  const { height } = useWindowDimensions();
  // The rule being read, shown in place of the foul entry so the sheet never stacks a second modal.
  const [ruleId, setRuleId] = useState<RuleTopicId | null>(null);
  const rule = ruleId ? getRuleTopic(ruleId) : undefined;
  const ruleLink = RULE_FOR[foulType] ?? RULE_FOR.other;

  useEffect(() => {
    if (!visible) setRuleId(null);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => (ruleId ? setRuleId(null) : onCancel())}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close foul entry">
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => null}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {rule ? (
            <>
              <Pressable
                onPress={() => setRuleId(null)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>Back to the foul</Text>
              </Pressable>
              <ScrollView key={rule.id} style={{ maxHeight: height * 0.72 }} contentContainerStyle={styles.ruleScroll}>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                  {rule.title}
                </Text>
                <RuleBody topic={rule} onOpenTopic={setRuleId} />
              </ScrollView>
            </>
          ) : (
            <>
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

              <View style={styles.ruleLinks}>
                <Pressable
                  onPress={() => setRuleId(ruleLink.topic)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.ruleLink, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <MaterialCommunityIcons name="book-open-variant" size={16} color={colors.primary} />
                  <Text style={[styles.ruleLinkText, { color: colors.primary }]}>{ruleLink.label}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setRuleId("free-ball")}
                  accessibilityRole="button"
                  accessibilityLabel="Free ball rules, for when this foul leaves the next player snookered"
                  style={({ pressed }) => [styles.ruleLink, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <MaterialCommunityIcons name="book-open-variant" size={16} color={colors.primary} />
                  <Text style={[styles.ruleLinkText, { color: colors.primary }]}>Free ball?</Text>
                </Pressable>
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
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: SCRIM,
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
  ruleLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: SPACING.lg,
    marginTop: SPACING.sm,
  },
  ruleLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
  },
  ruleLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    minHeight: 44,
    marginLeft: -6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "700",
  },
  ruleScroll: {
    gap: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  note: {
    marginTop: SPACING.sm,
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
