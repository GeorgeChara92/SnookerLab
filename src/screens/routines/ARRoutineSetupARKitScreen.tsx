import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SnookerARKitView, type ARMode } from "../../features/arkit/SnookerARKitView";
import { useRoutinesStore } from "../../store";
import type { PracticeStackParamList } from "../../types";
import { getRoutineLayoutDefinition } from "../../features/ar/routineLayouts";
import { useSnookerTableCalibrationController } from "../../features/ar/SnookerTableCalibrationController";
import { useRoutineARPlacementController } from "../../features/ar/RoutineARPlacementController";
import { ARTopChrome } from "../../features/ar/ui/ARTopChrome";
import { ARReticle } from "../../features/ar/ui/ARReticle";
import { ARInstructionLabel } from "../../features/ar/ui/ARInstructionLabel";
import { ARBottomActionBar } from "../../features/ar/ui/ARBottomActionBar";
import { ARModeSwitcher } from "../../features/ar/ui/ARModeSwitcher";

const stepInstruction = (step: string) => {
  if (step === "scan_plane") return "Move slowly over the table to establish tracking";
  if (step === "align_black") return "Aim at the black spot and hold steady";
  if (step === "align_pink") return "Now align the reticle with the pink spot";
  if (step === "align_blue") return "Align with blue spot to lock table scale";
  if (step === "confirm") return "Check fit, then confirm when confidence is high";
  return "Placement mode ready";
};

export const ARRoutineSetupARKitScreen = () => {
  const route = useRoute<RouteProp<PracticeStackParamList, "ARRoutineSetup">>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { getRoutineById } = useRoutinesStore();
  const routine = getRoutineById(route.params.routineId);

  const calibration = useSnookerTableCalibrationController();
  const arMode: ARMode = "live";
  const layout = useMemo(() => getRoutineLayoutDefinition(routine), [routine]);
  const routinePlacement = useRoutineARPlacementController(layout, calibration.step === "ready" ? calibration.calibration : null);

  useEffect(() => {
    if (calibration.confidence.state === "drift" && calibration.step === "ready") {
      calibration.relockFromDrift();
    }
  }, [calibration]);

  if (!routine) return null;

  const placementSubtitle = routinePlacement.activeMarker
    ? `${routinePlacement.activeMarker.label} (${routinePlacement.activeIndex + 1}/${routinePlacement.markerCount})`
    : "No markers in this routine";

  return (
    <View style={styles.container}>
      <SnookerARKitView
        style={StyleSheet.absoluteFill}
        arMode={arMode}
        showGrid={calibration.step === "confirm" || calibration.step === "ready"}
        showReticle={calibration.step !== "ready"}
        showCalibrationMarkers={calibration.step !== "ready"}
        calibration={calibration.calibration}
        crosshairPoint={calibration.crosshairPoint}
        blackPoint={calibration.blackPoint}
        pinkPoint={calibration.pinkPoint}
        bluePoint={calibration.bluePoint}
        positionedMarkers={routinePlacement.visibleMarkers}
        onCrosshairPoint={calibration.setCrosshairPoint}
        onCameraPose={calibration.setCameraPose}
        onTrackingState={calibration.setTrackingState}
      />

      <ARReticle visible={calibration.step !== "ready"} state={calibration.reticleState} label={calibration.reticleHint} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}> 
        <ARTopChrome
          title="Routine AR"
          subtitle={calibration.step === "ready" ? "Placement" : "Calibration"}
          onBack={() => navigation.goBack()}
          rightLabel={calibration.step === "ready" ? "Reset" : undefined}
          onRightPress={calibration.step === "ready" ? calibration.resetCalibration : undefined}
        />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(12, insets.bottom) }]}> 
        <ARInstructionLabel
          text={calibration.step === "ready" ? placementSubtitle : stepInstruction(calibration.step)}
          secondary={
            calibration.step === "ready"
              ? calibration.confidence.guidance
              : calibration.error ?? calibration.calibrationHint
          }
        />

        {calibration.step === "ready" ? (
          <>
            <ARModeSwitcher
              value={routinePlacement.viewMode}
              options={[
                { key: "sequence", label: "One-by-one" },
                { key: "full", label: "Show all" },
              ]}
              onChange={(value) => routinePlacement.setViewMode(value as "sequence" | "full")}
            />
            <ARBottomActionBar
              left={routinePlacement.viewMode === "sequence" ? { label: "Previous", onPress: routinePlacement.previousMarker } : undefined}
              primaryLabel={routinePlacement.viewMode === "sequence" ? "Next" : "Ready"}
              onPrimaryPress={routinePlacement.viewMode === "sequence" ? routinePlacement.nextMarker : () => {}}
              right={{ label: "Recal", onPress: calibration.resetCalibration }}
            />
          </>
        ) : (
          <>
            <ARBottomActionBar
              left={{ label: "Reset", onPress: calibration.resetCalibration }}
              primaryLabel={calibration.step === "confirm" ? "Confirm" : "Capture"}
              onPrimaryPress={() => {
                if (calibration.step === "confirm") {
                  calibration.confirmCalibration();
                  return;
                }
                calibration.captureReference();
              }}
              primaryDisabled={calibration.step !== "confirm" && !calibration.crosshairPoint}
              right={{ label: "Back", onPress: () => navigation.goBack() }}
            />
            {__DEV__ ? (
              <Pressable
                style={[styles.devPreviewButton, !calibration.cameraPose && styles.devPreviewButtonDisabled]}
                onPress={calibration.startDevPreview}
                disabled={!calibration.cameraPose}
              >
                <Text style={styles.devPreviewButtonText}>Dev Preview Routine</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07101B" },
  top: { position: "absolute", left: 12, right: 12, top: 0 },
  bottom: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 0,
    gap: 10,
  },
  devPreviewButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.32)",
    backgroundColor: "rgba(15,23,42,0.8)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  devPreviewButtonDisabled: {
    opacity: 0.45,
  },
  devPreviewButtonText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
  },
});
