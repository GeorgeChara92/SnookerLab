import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCustomRoutinesStore, useRoutinesStore } from "../../store";
import { toRoutine } from "../../features/customRoutines/customRoutine";
import { summarise } from "../../features/scanSnooker/position";
import { openSendToChat } from "../../navigation/navigationRef";
import { RoutineThumb, hasDiagram } from "../../components/coach/RoutineThumb";
import { SetHomeworkSheet } from "../../components/coach/SetHomeworkSheet";
import type { CoachRoutinesStackParamList } from "../../types";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const capitalise = (text: string | null | undefined) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : null);

/**
 * One routine, from the coach's side: what it is, and the two things a coach does with it - set it
 * as homework for clients, or send it in a chat. The coach's own routines can be edited and deleted
 * here too; practising and scoring stay in player view.
 */
export const CoachRoutineScreen = () => {
  const navigation = useNavigation<NavigationProp<CoachRoutinesStackParamList>>();
  const { params } = useRoute<RouteProp<CoachRoutinesStackParamList, "CoachRoutine">>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const custom = useCustomRoutinesStore((state) => state.getById(params.routineId));
  const removeCustom = useCustomRoutinesStore((state) => state.remove);
  const libraryRoutine = useRoutinesStore((state) => state.routines.find((item) => item.id === params.routineId));
  const categoryName = useRoutinesStore(
    (state) => state.categories.find((category) => category.id === libraryRoutine?.category_id)?.name ?? null
  );
  const routine = useMemo(() => (custom ? toRoutine(custom) : (libraryRoutine ?? null)), [custom, libraryRoutine]);
  const [settingHomework, setSettingHomework] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: routine?.name ?? "Routine" });
  }, [navigation, routine?.name]);

  if (!routine) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Text style={[styles.missingText, { color: colors.textMuted }]}>This routine has been deleted.</Text>
      </View>
    );
  }

  const ownRoutine = custom && !custom.sourceSharedId;
  const description = custom ? custom.description : (routine.description ?? routine.summary);

  const send = () =>
    custom
      ? openSendToChat(
          {
            kind: "routine",
            name: custom.name,
            subtitle: custom.maxScore ? `Max score ${custom.maxScore}` : summarise(custom.balls),
            sharedId: custom.sharedId ?? custom.sourceSharedId ?? null,
          },
          custom.id
        )
      : openSendToChat({
          kind: "routine",
          name: routine.name,
          subtitle: routine.max_score ? `Up to ${routine.max_score}` : null,
          libraryId: routine.id,
        });

  const confirmDelete = () =>
    custom &&
    dialog.confirm({
      title: custom.sourceSharedId ? `Remove ${custom.name} from Saved?` : `Delete ${custom.name}?`,
      message: custom.sourceSharedId
        ? "Your copy goes from all your devices. The original stays in the community library."
        : "It goes from all your devices. Clients who already have it as homework keep their own copy.",
      icon: "delete-outline",
      tone: "danger",
      confirmLabel: "Delete routine",
      cancelLabel: "Keep it",
      onConfirm: () => {
        removeCustom(custom.id);
        navigation.goBack();
      },
    });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <RoutineThumb
        routine={routine}
        custom={custom}
        style={hasDiagram(routine, custom) ? styles.diagram : styles.photo}
        landscape
      />

      <View style={styles.chips}>
        {(custom
          ? [summarise(custom.balls), custom.maxScore ? `Max score ${custom.maxScore}` : "Counts attempts"]
          : [categoryName, routine.content_type === "guide" ? "Guide" : capitalise(routine.difficulty), routine.max_score ? `Up to ${routine.max_score}` : null]
        )
          .filter((chip): chip is string => Boolean(chip))
          .map((chip) => (
            <View key={chip} style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{chip}</Text>
            </View>
          ))}
      </View>

      {description ? <Text style={[styles.description, { color: colors.text }]}>{description}</Text> : null}

      {!custom && routine.steps?.length ? (
        <View style={[styles.steps, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {routine.steps.map((step, index) => (
            <View key={index} style={styles.step}>
              <Text style={[styles.stepNumber, { color: colors.primary }]}>{index + 1}</Text>
              <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => setSettingHomework(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.onPrimary} />
        <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Set as homework</Text>
      </Pressable>
      {custom ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {custom.sharedId || custom.sourceSharedId
            ? "Clients get their own copy to practise and score."
            : "Setting it shares it privately with the clients you pick - it isn't posted to the community."}
        </Text>
      ) : null}

      <Pressable
        onPress={send}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <MaterialCommunityIcons name="send-outline" size={20} color={colors.text} />
        <Text style={[styles.primaryText, { color: colors.text }]}>Send in a chat</Text>
      </Pressable>

      {custom ? (
        <View style={styles.row}>
          {ownRoutine ? (
            <Pressable
              onPress={() => (navigation as any).navigate("CustomRoutineBuilder", { routineId: custom.id })}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>Edit</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: colors.danger, backgroundColor: colors.surface }]}
          >
            <MaterialCommunityIcons name="delete-outline" size={18} color={colors.danger} />
            <Text style={[styles.secondaryText, { color: colors.danger }]}>{custom.sourceSharedId ? "Remove" : "Delete"}</Text>
          </Pressable>
        </View>
      ) : null}

      <SetHomeworkSheet
        routine={routine}
        visible={settingHomework}
        onClose={() => setSettingHomework(false)}
        onDone={(count) => {
          setSettingHomework(false);
          dialog.alert({
            title: count > 1 ? `Homework set for ${count} clients` : "Homework set",
            message: "It's on their Coaching page now, with how they're getting on showing on each client.",
            tone: "success",
            icon: "clipboard-check-outline",
          });
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md },
  // The table and rail's own shape, so a diagram fills the box edge to edge.
  diagram: { width: "100%", aspectRatio: 1.9, borderRadius: RADIUS.md },
  photo: { width: "100%", height: 200, borderRadius: RADIUS.md },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  missingText: { fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, justifyContent: "center" },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  steps: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
  step: { flexDirection: "row", gap: SPACING.sm },
  stepNumber: { width: 18, fontSize: 15, fontWeight: "800" },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  hint: { fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: -SPACING.xs },
  row: { flexDirection: "row", gap: SPACING.sm },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
});
