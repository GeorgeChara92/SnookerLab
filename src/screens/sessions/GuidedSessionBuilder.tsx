import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";

type PracticeFocus = "potting" | "position" | "break-building" | "safety" | "technique";
type SessionLength = "quick" | "standard" | "intensive";

const PRACTICE_OPTIONS: { id: PracticeFocus; label: string; description: string; icon: string }[] = [
  { id: "potting", label: "Potting", description: "Shot accuracy and consistency", icon: "🎯" },
  { id: "position", label: "Position Play", description: "Cue ball control and positioning", icon: "⚪" },
  { id: "break-building", label: "Break Building", description: "Scoring breaks and clearance", icon: "🔥" },
  { id: "safety", label: "Safety Play", description: "Defensive shots and escapes", icon: "🛡️" },
  { id: "technique", label: "Technique", description: "Stance, grip, and delivery", icon: "🎱" },
];

const SESSION_LENGTHS: { id: SessionLength; label: string; duration: string; routineCount: number }[] = [
  { id: "quick", label: "Quick", duration: "10-15 min", routineCount: 2 },
  { id: "standard", label: "Standard", duration: "20-30 min", routineCount: 4 },
  { id: "intensive", label: "Intensive", duration: "40+ min", routineCount: 6 },
];

const FOCUS_TAGS: Record<PracticeFocus, { id: string; label: string }[]> = {
  potting: [
    { id: "long-potting", label: "Long pots" },
    { id: "mid-range", label: "Mid-range" },
    { id: "straight-pots", label: "Straight pots" },
    { id: "awkward-angles", label: "Awkward angles" },
  ],
  position: [
    { id: "stun", label: "Stun" },
    { id: "screw", label: "Screw back" },
    { id: "follow", label: "Follow through" },
    { id: "side-spin", label: "Side spin" },
  ],
  "break-building": [
    { id: "clearances", label: "Clearances" },
    { id: "colours", label: "Colours" },
    { id: "reds", label: "Reds" },
    { id: "split", label: "Pack split" },
  ],
  safety: [
    { id: "escapes", label: "Escapes" },
    { id: "baulk-safety", label: "Baulk safety" },
    { id: "two-cushion", label: "Two cushion" },
    { id: "three-cushion", label: "Three cushion" },
  ],
  technique: [
    { id: "stance", label: "Stance" },
    { id: "grip", label: "Grip" },
    { id: "cue-action", label: "Cue action" },
    { id: "follow-through", label: "Follow through" },
  ],
};

const CATEGORY_ROUTINE_MAP: Record<PracticeFocus, { categoryId: string; weight: number }[]> = {
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

export const GuidedSessionBuilder = () => {
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { categories, routines } = useRoutinesStore();
  const { createTemplate } = useSessionsStore();
  const { colors } = useAppTheme();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [practiceFocus, setPracticeFocus] = useState<PracticeFocus | null>(null);
  const [sessionLength, setSessionLength] = useState<SessionLength | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const suggestedRoutines = useMemo(() => {
    if (!practiceFocus || !sessionLength) return [];

    const lengthConfig = SESSION_LENGTHS.find((l) => l.id === sessionLength);
    const targetCount = lengthConfig?.routineCount ?? 4;

    const categoryWeights = CATEGORY_ROUTINE_MAP[practiceFocus];
    const allRoutines: { routine: typeof routines[0]; weight: number }[] = [];

    categoryWeights.forEach(({ categoryId, weight }) => {
      const categoryRoutines = routines.filter(
        (r) => r.category_id === categoryId && r.content_type !== "guide"
      );
      categoryRoutines.forEach((routine) => {
        allRoutines.push({ routine, weight });
      });
    });

    allRoutines.sort((a, b) => b.weight - a.weight);

    const shuffled = allRoutines.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    return selected.map((item) => ({
      ...item.routine,
      categoryName: categories.find((c) => c.id === item.routine.category_id)?.name ?? "",
    }));
  }, [practiceFocus, sessionLength, routines, categories]);

  const handleSave = async () => {
    if (!practiceFocus || !sessionLength) return;

    setIsSaving(true);
    try {
      const focusOption = PRACTICE_OPTIONS.find((o) => o.id === practiceFocus);
      const lengthOption = SESSION_LENGTHS.find((l) => l.id === sessionLength);
      const name = `${focusOption?.label} - ${lengthOption?.label}`;

      const routineIds = suggestedRoutines.map((r) => r.id);

      const templateId = await createTemplate({
        name,
        notes: selectedTags.length > 0 ? `Focus: ${selectedTags.join(", ")}` : undefined,
        routineIds,
      });

      navigation.navigate("SessionTemplateDetail", { templateId });
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>What would you like to practise?</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Choose your main focus for this session.</Text>

      <View style={styles.optionsGrid}>
        {PRACTICE_OPTIONS.map((option) => {
          const selected = practiceFocus === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border }]}
              onPress={() => {
                setPracticeFocus(option.id);
                setSelectedTags([]);
              }}
            >
              <Text style={styles.optionIcon}>{option.icon}</Text>
              <Text style={[styles.optionLabel, { color: selected ? colors.primary : colors.text }]}>{option.label}</Text>
              <Text style={[styles.optionDescription, { color: colors.textMuted }]}>{option.description}</Text>
              {selected && <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}><Text style={styles.selectedBadgeText}>✓</Text></View>}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.buttonContainer}>
        <AppButton
          label="Continue"
          onPress={() => practiceFocus && setStep(2)}
          disabled={!practiceFocus}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>How long do you have?</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Choose your session duration.</Text>

      <View style={styles.lengthOptions}>
        {SESSION_LENGTHS.map((option) => {
          const selected = sessionLength === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.lengthCard, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border }]}
              onPress={() => setSessionLength(option.id)}
            >
              <Text style={[styles.lengthLabel, { color: selected ? colors.primary : colors.text }]}>{option.label}</Text>
              <Text style={[styles.lengthDuration, { color: colors.textMuted }]}>{option.duration}</Text>
              <Text style={[styles.lengthRoutines, { color: colors.textMuted }]}>{option.routineCount} routines</Text>
              {selected && <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}><Text style={styles.selectedBadgeText}>✓</Text></View>}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.buttonContainer}>
        <AppButton
          label="Continue"
          onPress={() => sessionLength && setStep(3)}
          disabled={!sessionLength}
        />
      </View>
    </View>
  );

  const renderStep3 = () => {
    const focusTags = practiceFocus ? FOCUS_TAGS[practiceFocus] : [];

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Any specific focus?</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Optional · refine your session</Text>

        {focusTags.length > 0 && (
          <View style={styles.tagsGrid}>
            {focusTags.map((tag) => {
              const selected = selectedTags.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  style={[styles.tag, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : "transparent" }]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={[styles.tagText, { color: selected ? colors.primary : colors.textMuted }]}>{tag.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <AppButton label="See Suggested Session" onPress={() => setStep(4)} />
        </View>
      </View>
    );
  };

  const renderStep4 = () => {
    const focusOption = PRACTICE_OPTIONS.find((o) => o.id === practiceFocus);
    const lengthOption = SESSION_LENGTHS.find((l) => l.id === sessionLength);
    const totalDuration = suggestedRoutines.length * 5;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Your Session</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>Preview and save your practice plan.</Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{focusOption?.label} Practice</Text>
            <Text style={[styles.summaryDuration, { color: colors.primary }]}>{totalDuration}+ min</Text>
          </View>
          <Text style={[styles.summaryDetails, { color: colors.textMuted }]}>
            {lengthOption?.routineCount} routines · {lengthOption?.duration}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Routines</Text>
        <View style={styles.routinesList}>
          {suggestedRoutines.map((routine, index) => (
            <View key={routine.id} style={[styles.routineItem, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={styles.routineNumber}>{index + 1}</Text>
              <View style={styles.routineInfo}>
                <Text style={[styles.routineName, { color: colors.text }]}>{routine.name}</Text>
                <Text style={[styles.routineCategory, { color: colors.textMuted }]}>{routine.categoryName}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <AppButton label="Save & Start Practising" onPress={handleSave} loading={isSaving} />
          <View style={styles.buttonSpacer} />
          <AppButton label="Start Over" variant="secondary" onPress={() => { setStep(1); setPracticeFocus(null); setSessionLength(null); setSelectedTags([]); }} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={styles.progressItem}>
            <View style={[styles.progressDot, { backgroundColor: step >= s ? colors.primary : colors.border }]} />
            {s < 4 && <View style={[styles.progressLine, { backgroundColor: step > s ? colors.primary : colors.border }]} />}
          </View>
        ))}
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  progressItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  stepContainer: {},
  stepTitle: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  stepSubtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  optionCard: {
    width: "48%",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    position: "relative",
  },
  optionIcon: { fontSize: 28, marginBottom: 8 },
  optionLabel: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  optionDescription: { fontSize: 12, lineHeight: 16 },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  lengthOptions: {
    gap: 12,
    marginBottom: 24,
  },
  lengthCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    position: "relative",
  },
  lengthLabel: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  lengthDuration: { fontSize: 14, marginBottom: 2 },
  lengthRoutines: { fontSize: 12 },
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagText: { fontSize: 13, fontWeight: "600" },
  buttonContainer: {
    marginTop: 8,
  },
  buttonSpacer: {
    height: 10,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryTitle: { fontSize: 18, fontWeight: "700" },
  summaryDuration: { fontSize: 14, fontWeight: "600" },
  summaryDetails: { fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  routinesList: {
    gap: 8,
    marginBottom: 24,
  },
  routineItem: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  routineNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F5A43",
    color: "#FFF",
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 28,
    fontWeight: "700",
    marginRight: 12,
  },
  routineInfo: { flex: 1 },
  routineName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  routineCategory: { fontSize: 12 },
});