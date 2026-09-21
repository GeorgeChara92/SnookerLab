import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { PracticeStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCustomRoutinesStore } from "../../store";
import { ARScan } from "../../components/scanSnooker/ARScan";
import { arSupport } from "../../../modules/snooker-ar";
import type { RecordedPosition } from "../../features/scanSnooker/position";

/**
 * Setting a routine up on the real table: calibrate, and each ball appears as a ghost where it
 * goes. The same camera flow as Scan Snooker, fed the routine's layout instead of a snooker.
 */
export const RoutineARScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const route = useRoute<RouteProp<PracticeStackParamList, "RoutineAR">>();
  const routine = useCustomRoutinesStore((state) => state.getById(route.params.routineId));
  const { colors } = useAppTheme();
  const supported = useMemo(() => arSupport().available, []);

  // The camera takes the whole screen.
  useEffect(() => {
    navigation.setOptions({ headerShown: !supported || !routine });
  }, [navigation, routine, supported]);

  // The routine's layout, in the shape the camera flow puts back.
  const layout = useMemo<RecordedPosition | undefined>(
    () =>
      routine
        ? { matchId: routine.id, frameNumber: 0, recordedAt: routine.updatedAt, balls: routine.balls }
        : undefined,
    [routine]
  );

  if (!routine || !layout || !supported) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Text style={[styles.missingText, { color: colors.textMuted }]}>
          {!routine ? "This routine has been deleted." : "Setting up with the camera needs an iPhone with ARKit."}
        </Text>
      </View>
    );
  }

  return (
    <ARScan
      intent="replace"
      purpose="routine"
      saved={layout}
      onSave={() => undefined}
      onDiscard={() => undefined}
      onUseDiagram={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
    />
  );
};

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  missingText: { fontSize: 15, textAlign: "center" },
});
