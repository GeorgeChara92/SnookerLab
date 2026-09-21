import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PracticeStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCustomRoutinesStore } from "../../store";
import { TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { summarise } from "../../features/scanSnooker/position";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** One of the player's own routines: the table to set up, what it is, and a score to record. */
export const CustomRoutineScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const route = useRoute<RouteProp<PracticeStackParamList, "CustomRoutine">>();
  const routine = useCustomRoutinesStore((state) => state.getById(route.params.routineId));
  const remove = useCustomRoutinesStore((state) => state.remove);
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tableHeight = Math.round(Math.min(height * 0.5, (width - SPACING.lg * 2) * 1.95));

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

  const confirmDelete = () =>
    dialog.confirm({
      title: `Delete ${routine.name}?`,
      message: "It goes from all your devices. Scores you have recorded for it are kept.",
      icon: "delete-outline",
      tone: "danger",
      confirmLabel: "Delete routine",
      cancelLabel: "Keep it",
      onConfirm: () => {
        remove(routine.id);
        navigation.goBack();
      },
    });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={{ height: tableHeight }}>
        <TableDiagram balls={routine.balls} readOnly />
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.chipText, { color: colors.text }]}>{summarise(routine.balls)}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.chipText, { color: colors.text }]}>
            {routine.maxScore ? `Max score ${routine.maxScore}` : "Counts attempts"}
          </Text>
        </View>
      </View>

      {routine.description ? (
        <Text style={[styles.description, { color: colors.text }]}>{routine.description}</Text>
      ) : null}

      <Pressable
        onPress={() => navigation.navigate("RecordRoutineScore", { routineId: routine.id })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.onPrimary} />
        <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Record score</Text>
      </Pressable>

      <View style={styles.row}>
        <Pressable
          onPress={() => navigation.navigate("CustomRoutineBuilder", { routineId: routine.id })}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.text} />
          <Text style={[styles.secondaryText, { color: colors.text }]}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: colors.danger, backgroundColor: colors.surface }]}
        >
          <MaterialCommunityIcons name="delete-outline" size={18} color={colors.danger} />
          <Text style={[styles.secondaryText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  missingText: { fontSize: 15 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, justifyContent: "center" },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
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
