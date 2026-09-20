import React, { useCallback, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { Routine, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PracticeFocus = "potting" | "position" | "break-building" | "safety" | "technique";
type SessionLength = "quick" | "standard" | "intensive";

const FALLBACK_MINUTES = 5;

const PRACTICE_OPTIONS: {
  id: PracticeFocus;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { id: "potting", label: "Potting", description: "Accuracy and consistency", icon: "target" },
  { id: "position", label: "Position", description: "Cue ball control", icon: "circle-outline" },
  { id: "break-building", label: "Break building", description: "Scoring visits and clearances", icon: "fire" },
  { id: "safety", label: "Safety", description: "Snookers and escapes", icon: "shield-outline" },
  { id: "technique", label: "Technique", description: "Stance, grip and delivery", icon: "billiards" },
];

const SESSION_LENGTHS: { id: SessionLength; label: string; duration: string; routineCount: number }[] = [
  { id: "quick", label: "Quick", duration: "10 to 15 min", routineCount: 2 },
  { id: "standard", label: "Standard", duration: "20 to 30 min", routineCount: 4 },
  { id: "intensive", label: "Long", duration: "40 min or more", routineCount: 6 },
];

/** The words a tag looks for in a routine, so picking one actually changes the session. */
const FOCUS_TAGS: Record<PracticeFocus, { id: string; label: string; keywords: string[] }[]> = {
  potting: [
    { id: "long-potting", label: "Long pots", keywords: ["long", "distance", "baulk"] },
    { id: "mid-range", label: "Mid-range", keywords: ["mid", "middle", "pot"] },
    { id: "straight-pots", label: "Straight pots", keywords: ["straight", "line", "blue"] },
    { id: "awkward-angles", label: "Awkward angles", keywords: ["angle", "cut", "thin"] },
  ],
  position: [
    { id: "stun", label: "Stun", keywords: ["stun", "control"] },
    { id: "screw", label: "Screw back", keywords: ["screw", "back", "draw"] },
    { id: "follow", label: "Follow through", keywords: ["follow", "top", "through"] },
    { id: "side-spin", label: "Side", keywords: ["side", "spin", "english"] },
  ],
  "break-building": [
    { id: "clearances", label: "Clearances", keywords: ["clearance", "clear"] },
    { id: "colours", label: "Colours", keywords: ["colour", "black", "pink"] },
    { id: "reds", label: "Reds", keywords: ["red", "pack"] },
    { id: "split", label: "Splitting the pack", keywords: ["split", "pack", "develop"] },
  ],
  safety: [
    { id: "escapes", label: "Escapes", keywords: ["escape", "snooker"] },
    { id: "baulk-safety", label: "Baulk safety", keywords: ["baulk", "safety"] },
    { id: "two-cushion", label: "Two cushion", keywords: ["cushion", "two"] },
    { id: "three-cushion", label: "Three cushion", keywords: ["cushion", "three"] },
  ],
  technique: [
    { id: "stance", label: "Stance", keywords: ["stance", "alignment", "body"] },
    { id: "grip", label: "Grip", keywords: ["grip", "hand"] },
    { id: "cue-action", label: "Cue action", keywords: ["cue", "action", "delivery"] },
    { id: "follow-through", label: "Follow through", keywords: ["follow", "through", "timing"] },
  ],
};

const CATEGORY_WEIGHTS: Record<PracticeFocus, { categoryId: string; weight: number }[]> = {
  potting: [
    { categoryId: "cat-long-potting", weight: 1 },
    { categoryId: "cat-straight-cueing", weight: 0.8 },
    { categoryId: "cat-basics", weight: 0.5 },
  ],
  position: [
    { categoryId: "cat-cue-ball-control", weight: 1 },
    { categoryId: "cat-basics", weight: 0.6 },
  ],
  "break-building": [
    { categoryId: "cat-break-building", weight: 1 },
    { categoryId: "cat-cue-ball-control", weight: 0.5 },
  ],
  safety: [
    { categoryId: "cat-safety", weight: 1 },
    { categoryId: "cat-basics", weight: 0.3 },
  ],
  technique: [
    { categoryId: "cat-basics", weight: 1 },
    { categoryId: "cat-straight-cueing", weight: 0.7 },
  ],
};

const STEP_TITLES = ["Focus", "Length", "Detail", "Review"];

export const GuidedSessionBuilder = () => {
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { categories, routines } = useRoutinesStore();
  const { createTemplate } = useSessionsStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [practiceFocus, setPracticeFocus] = useState<PracticeFocus | null>(null);
  const [sessionLength, setSessionLength] = useState<SessionLength | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  /** Bumped by the shuffle button, so the picks only change when the player asks. */
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const goToStep = (next: 1 | 2 | 3 | 4) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
  };

  const suggestedRoutines = useMemo(() => {
    if (!practiceFocus || !sessionLength) return [] as Routine[];

    const targetCount = SESSION_LENGTHS.find((option) => option.id === sessionLength)?.routineCount ?? 4;
    const tagKeywords = (FOCUS_TAGS[practiceFocus] ?? [])
      .filter((tag) => selectedTags.includes(tag.id))
      .flatMap((tag) => tag.keywords);

    const scored = CATEGORY_WEIGHTS[practiceFocus]
      .flatMap(({ categoryId, weight }) =>
        routines
          .filter((routine) => routine.category_id === categoryId && routine.content_type !== "guide")
          .map((routine) => {
            const haystack = [routine.name, routine.summary, routine.success_criteria, ...(routine.improves ?? [])]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            // A chosen detail lifts anything that mentions it, so step 3 changes the answer.
            const matches = tagKeywords.filter((keyword) => haystack.includes(keyword)).length;

            return { routine, score: weight + matches * 0.5 + ((routine.id.charCodeAt(0) + shuffleSeed) % 7) * 0.01 };
          })
      )
      .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const picked: Routine[] = [];

    for (const entry of scored) {
      if (seen.has(entry.routine.id)) continue;
      seen.add(entry.routine.id);
      picked.push(entry.routine);
      if (picked.length === targetCount) break;
    }

    return picked;
  }, [practiceFocus, sessionLength, selectedTags, routines, shuffleSeed]);

  const totalMinutes = useMemo(
    () => suggestedRoutines.reduce((total, routine) => total + (routine.estimated_duration_minutes ?? FALLBACK_MINUTES), 0),
    [suggestedRoutines]
  );

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }, []);

  const handleSave = async () => {
    if (!practiceFocus || !sessionLength || !suggestedRoutines.length) return;

    const focusOption = PRACTICE_OPTIONS.find((option) => option.id === practiceFocus);
    const lengthOption = SESSION_LENGTHS.find((option) => option.id === sessionLength);
    const tagLabels = (FOCUS_TAGS[practiceFocus] ?? [])
      .filter((tag) => selectedTags.includes(tag.id))
      .map((tag) => tag.label);

    try {
      setIsSaving(true);
      const templateId = await createTemplate({
        name: `${focusOption?.label} · ${lengthOption?.label}`,
        notes: tagLabels.length ? `Working on ${tagLabels.join(", ").toLowerCase()}.` : undefined,
        routineIds: suggestedRoutines.map((routine) => routine.id),
      });

      navigation.navigate("SessionTemplateDetail", { templateId });
    } catch (error) {
      dialog.alert({
        title: "Could not save this session",
        message: "The session was not created. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "Try again",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startOver = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(1);
    setPracticeFocus(null);
    setSessionLength(null);
    setSelectedTags([]);
  };

  const canContinue = step === 1 ? !!practiceFocus : step === 2 ? !!sessionLength : true;

  const continueLabel = step === 3 ? "Build my session" : "Continue";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.stepHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.stepRow}>
          {STEP_TITLES.map((title, index) => {
            const number = index + 1;
            const done = step > number;
            const current = step === number;

            return (
              <View key={title} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: done || current ? colors.primary : colors.surfaceMuted,
                      borderColor: done || current ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {done ? (
                    <MaterialCommunityIcons name="check" size={12} color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.stepDotText, { color: current ? colors.onPrimary : colors.textMuted }]}>
                      {number}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.stepLabel, { color: current ? colors.text : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>What are you working on?</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Pick the part of your game this session is for.
            </Text>

            {PRACTICE_OPTIONS.map((option) => {
              const selected = practiceFocus === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setPracticeFocus(option.id);
                    setSelectedTags([]);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label}. ${option.description}`}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.onPrimary : colors.textMuted}
                    />
                  </View>

                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: colors.textMuted }]}>{option.description}</Text>
                  </View>

                  {selected ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>How long have you got?</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>This decides how many routines you get.</Text>

            {SESSION_LENGTHS.map((option) => {
              const selected = sessionLength === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSessionLength(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label}, ${option.duration}, ${option.routineCount} routines`}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                      {option.duration} · {option.routineCount} routines
                    </Text>
                  </View>

                  {selected ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Anything in particular?</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Optional. What you pick here pulls matching routines to the front.
            </Text>

            <View style={styles.tagGrid}>
              {(practiceFocus ? FOCUS_TAGS[practiceFocus] : []).map((tag) => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={tag.label}
                    style={[
                      styles.tag,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: selected ? colors.onPrimary : colors.text }]}>
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Your session</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {suggestedRoutines.length} {suggestedRoutines.length === 1 ? "routine" : "routines"} · about{" "}
              {totalMinutes} min
            </Text>

            {suggestedRoutines.map((routine, index) => (
              <View
                key={routine.id}
                style={[styles.routineRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.routineIndex, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.routineIndexText, { color: colors.textMuted }]}>{index + 1}</Text>
                </View>

                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={1}>
                    {routine.name}
                  </Text>
                  <Text style={[styles.optionDescription, { color: colors.textMuted }]} numberOfLines={1}>
                    {categories.find((category) => category.id === routine.category_id)?.name ?? ""} · about{" "}
                    {routine.estimated_duration_minutes ?? FALLBACK_MINUTES} min
                  </Text>
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => setShuffleSeed((seed) => seed + 1)}
              accessibilityRole="button"
              accessibilityLabel="Suggest a different set of routines"
              style={[styles.shuffleButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons name="shuffle-variant" size={18} color={colors.textMuted} />
              <Text style={[styles.shuffleText, { color: colors.textMuted }]}>Suggest different routines</Text>
            </Pressable>

            <Pressable
              onPress={startOver}
              accessibilityRole="button"
              accessibilityLabel="Start the builder again"
              style={styles.startOver}
            >
              <Text style={[styles.startOverText, { color: colors.textMuted }]}>Start again</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {step > 1 ? (
          <Pressable
            onPress={() => goToStep((step - 1) as 1 | 2 | 3)}
            accessibilityRole="button"
            accessibilityLabel="Go back a step"
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => (step === 4 ? void handleSave() : goToStep((step + 1) as 2 | 3 | 4))}
          disabled={!canContinue || isSaving || (step === 4 && !suggestedRoutines.length)}
          accessibilityRole="button"
          accessibilityLabel={step === 4 ? "Save this session" : continueLabel}
          accessibilityState={{ disabled: !canContinue || isSaving }}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: canContinue ? colors.primary : colors.surfaceMuted,
              opacity: pressed && canContinue ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.continueText, { color: canContinue ? colors.onPrimary : colors.textMuted }]}>
            {step === 4 ? (isSaving ? "Saving..." : "Save session") : continueLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  stepHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  stepRow: { flexDirection: "row", gap: SPACING.sm },
  stepItem: { flex: 1, alignItems: "center", gap: 4 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontSize: 11, fontWeight: "800" },
  stepLabel: { fontSize: 11, fontWeight: "700" },

  scrollView: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 120 },

  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: SPACING.lg },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: "700" },
  optionDescription: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tag: {
    minHeight: HIT_TARGET,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  tagText: { fontSize: 14, fontWeight: "700" },

  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 60,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  routineIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  routineIndexText: { fontSize: 12, fontWeight: "800" },

  shuffleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  shuffleText: { fontSize: 14, fontWeight: "700" },
  startOver: {
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  startOverText: { fontSize: 13, fontWeight: "600" },

  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButton: {
    flex: 1,
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
  },
  continueText: { fontSize: 15, fontWeight: "800" },
});
