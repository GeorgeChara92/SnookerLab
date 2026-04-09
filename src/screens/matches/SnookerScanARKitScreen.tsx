import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SnookerARKitView, isNativeARKitViewAvailable, type ARMode } from "../../features/arkit/SnookerARKitView";
import { useSnookerScanStore, type SnookerBallColor } from "../../store/snookerScanStore";
import { useSnookerTableCalibrationController } from "../../features/ar/SnookerTableCalibrationController";
import { useSnookerMarkerPlacementController } from "../../features/ar/SnookerMarkerPlacementController";
import { ARTopChrome } from "../../features/ar/ui/ARTopChrome";
import { ARReticle } from "../../features/ar/ui/ARReticle";
import { ARInstructionLabel } from "../../features/ar/ui/ARInstructionLabel";
import { ARBottomActionBar } from "../../features/ar/ui/ARBottomActionBar";
import { ARBallSelector } from "../../features/ar/ui/ARBallSelector";
import { ARModeSwitcher } from "../../features/ar/ui/ARModeSwitcher";

type InteractionMode = "place" | "edit";

const BALL_COLORS: SnookerBallColor[] = ["white", "red", "yellow", "green", "brown", "blue", "pink", "black"];

const BALL_HEX: Record<SnookerBallColor, string> = {
  white: "#F8FAFC",
  red: "#DC2626",
  yellow: "#FACC15",
  green: "#16A34A",
  brown: "#8B5A2B",
  blue: "#2563EB",
  pink: "#EC4899",
  black: "#101010",
};

const stepInstruction = (step: string) => {
  if (step === "scan_plane") return "Move slowly to detect table surface";
  if (step === "align_black") return "Align reticle with black spot";
  if (step === "align_pink") return "Align reticle with pink spot";
  if (step === "align_blue") return "Align reticle with blue spot";
  if (step === "confirm") return "Confirm calibration lock";
  return "Marker placement ready";
};

export const SnookerScanARKitScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const store = useSnookerScanStore();
  const calibration = useSnookerTableCalibrationController();
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("place");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const markerPlacement = useSnookerMarkerPlacementController(
    calibration.step === "ready" ? calibration.calibration : null,
    calibration.crosshairPoint,
    store
  );

  const arMode: ARMode = "live";

  useEffect(() => {
    if (calibration.confidence.state === "drift" && calibration.step === "ready") {
      calibration.relockFromDrift();
      setMessage("Tracking drift detected. Re-lock alignment.");
    }
  }, [calibration]);

  const endAndReturn = () => {
    store.endScan();
    navigation.goBack();
  };

  if (!isNativeARKitViewAvailable()) {
    return (
      <View style={[styles.container, styles.emptyWrap]}>
        <Text style={styles.emptyTitle}>ARKit bridge missing</Text>
        <Text style={styles.emptyText}>Run an iOS dev build with SnookerARKitView registered.</Text>
      </View>
    );
  }

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
        positionedMarkers={markerPlacement.positionedMarkers}
        selectedMarkerId={markerPlacement.selectedMarkerId}
        onCrosshairPoint={calibration.setCrosshairPoint}
        onCameraPose={calibration.setCameraPose}
        onTrackingState={calibration.setTrackingState}
      />

      <ARReticle visible={calibration.step !== "ready"} state={calibration.reticleState} label={calibration.reticleHint} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}> 
        <ARTopChrome
          title="Scan Snooker"
          subtitle={calibration.step === "ready" ? `${store.markers.length} markers` : "Calibration"}
          onBack={() => navigation.goBack()}
          rightLabel={calibration.step === "ready" ? "Done" : undefined}
          onRightPress={calibration.step === "ready" ? endAndReturn : undefined}
        />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(12, insets.bottom) }]}> 
        <ARInstructionLabel
          text={calibration.step === "ready" ? (interactionMode === "place" ? "Aim at ball center and place marker" : "Select marker, then nudge or move") : stepInstruction(calibration.step)}
          secondary={message ?? (calibration.step === "ready" ? calibration.confidence.guidance : calibration.calibrationHint)}
        />

        {calibration.step === "ready" ? (
          <>
            <ARModeSwitcher
              value={interactionMode}
              options={[
                { key: "place", label: "Place" },
                { key: "edit", label: "Edit" },
              ]}
              onChange={(value) => setInteractionMode(value as InteractionMode)}
            />

            <ARBallSelector
              colors={BALL_COLORS}
              colorHex={BALL_HEX}
              selected={store.selectedBallColor}
              onSelect={markerPlacement.setSelectedBallColor}
            />

            {interactionMode === "edit" ? (
              <View style={styles.editRow}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    markerPlacement.selectNearestMarkerToCrosshair();
                    setMessage("Nearest marker selected");
                  }}
                >
                  <Text style={styles.editButtonText}>Select</Text>
                </Pressable>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    markerPlacement.moveSelectedToCrosshair();
                    setMessage("Moved selected marker to reticle");
                  }}
                  disabled={!markerPlacement.selectedMarker}
                >
                  <Text style={styles.editButtonText}>Move</Text>
                </Pressable>
                <Pressable style={styles.editButton} onPress={markerPlacement.nudgeSelectedLeft} disabled={!markerPlacement.selectedMarker}><Text style={styles.editButtonText}>Left</Text></Pressable>
                <Pressable style={styles.editButton} onPress={markerPlacement.nudgeSelectedRight} disabled={!markerPlacement.selectedMarker}><Text style={styles.editButtonText}>Right</Text></Pressable>
                <Pressable style={styles.editButton} onPress={markerPlacement.nudgeSelectedUp} disabled={!markerPlacement.selectedMarker}><Text style={styles.editButtonText}>Up</Text></Pressable>
                <Pressable style={styles.editButton} onPress={markerPlacement.nudgeSelectedDown} disabled={!markerPlacement.selectedMarker}><Text style={styles.editButtonText}>Down</Text></Pressable>
              </View>
            ) : null}

            <ARBottomActionBar
              left={{
                label: interactionMode === "place" ? "Undo" : "Delete",
                onPress: () => {
                  if (interactionMode === "place") {
                    const last = store.markers[store.markers.length - 1];
                    if (last) {
                      store.removeMarker(last.id);
                      setMessage("Removed last marker");
                    }
                  } else {
                    markerPlacement.removeSelected();
                    setMessage("Selected marker removed");
                  }
                },
                disabled: interactionMode === "place" ? store.markers.length === 0 : !markerPlacement.selectedMarker,
              }}
              primaryLabel={interactionMode === "place" ? "Place" : "Done"}
              onPrimaryPress={() => {
                if (interactionMode === "place") {
                  const result = markerPlacement.placeMarker();
                  if (result.ok) {
                    Vibration.vibrate(12);
                    setMessage("Marker placed");
                  } else {
                    setMessage(result.reason);
                  }
                  return;
                }
                setInteractionMode("place");
                setMessage("Back to place mode");
              }}
              right={{ label: "Finish", onPress: endAndReturn }}
            />
          </>
        ) : (
          <ARBottomActionBar
            left={{ label: "Reset", onPress: calibration.resetCalibration }}
            primaryLabel={calibration.step === "confirm" ? "Confirm" : "Capture"}
            onPrimaryPress={calibration.step === "confirm" ? calibration.confirmCalibration : calibration.captureReference}
            primaryDisabled={calibration.step !== "confirm" && !calibration.crosshairPoint}
            right={{ label: "Back", onPress: () => navigation.goBack() }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07101B" },
  emptyWrap: { justifyContent: "center", alignItems: "center", padding: 24 },
  emptyTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  emptyText: { marginTop: 8, color: "#9CA3AF", fontSize: 14, textAlign: "center" },
  top: { position: "absolute", left: 12, right: 12, top: 0 },
  bottom: { position: "absolute", left: 10, right: 10, bottom: 0, gap: 10 },
  editRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(4,9,18,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  editButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  editButtonText: { color: "#E2E8F0", fontSize: 11, fontWeight: "700" },
});
