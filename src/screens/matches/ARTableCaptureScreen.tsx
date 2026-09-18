import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { MatchesStackParamList } from "../../types";
import { SnookerARKitView, isNativeARKitViewAvailable, type GroundPoint } from "../../features/arkit/SnookerARKitView";
import { ARTableTopDownView } from "../../components/arTableCapture/ARTableTopDownView";
import { buildTableFrame, tableMmToWorld, validateCornerShape, worldToTableMm } from "../../features/arTableCapture/geometry";
import { saveARTableSnapshot } from "../../features/arTableCapture/snapshotStorage";
import { TABLE_LENGTH_MM, TABLE_WIDTH_MM, type ARPoint3D, type BallColour, type CapturedBall, type ARTableSnapshot } from "../../features/arTableCapture/types";

type Step = "baulkLeft" | "baulkRight" | "blackRight" | "blackLeft" | "confirm" | "balls";

const STEP_LABELS: Record<Step, string> = {
  baulkLeft: "Mark baulk-left corner",
  baulkRight: "Mark baulk-right corner",
  blackRight: "Mark black-right corner",
  blackLeft: "Mark black-left corner",
  confirm: "Confirm table",
  balls: "Place balls",
};

const BALLS: BallColour[] = ["white", "red", "yellow", "green", "brown", "blue", "pink", "black"];

const BALL_HEX: Record<BallColour, string> = {
  white: "#F8FAFC",
  red: "#DC2626",
  yellow: "#FACC15",
  green: "#16A34A",
  brown: "#8B5A2B",
  blue: "#2563EB",
  pink: "#EC4899",
  black: "#101010",
};

export const ARTableCaptureScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "ARTableCapture">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const [crosshair, setCrosshair] = React.useState<GroundPoint | null>(null);
  const [tracking, setTracking] = React.useState<"normal" | "limited" | "unavailable">("unavailable");
  const [step, setStep] = React.useState<Step>("baulkLeft");
  const [selectedColour, setSelectedColour] = React.useState<BallColour>("white");
  const [warning, setWarning] = React.useState<string | null>(null);
  const [allowTestBypass, setAllowTestBypass] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<ARTableSnapshot | null>(null);

  const [corners, setCorners] = React.useState<Partial<Record<"baulkLeft" | "baulkRight" | "blackRight" | "blackLeft", ARPoint3D>>>({});
  const [balls, setBalls] = React.useState<CapturedBall[]>([]);

  const frame = React.useMemo(() => {
    if (!corners.baulkLeft || !corners.baulkRight || !corners.blackRight || !corners.blackLeft) return null;
    return buildTableFrame({
      baulkLeft: corners.baulkLeft,
      baulkRight: corners.baulkRight,
      blackRight: corners.blackRight,
      blackLeft: corners.blackLeft,
    });
  }, [corners.baulkLeft, corners.baulkRight, corners.blackLeft, corners.blackRight]);

  const placedMarkers = React.useMemo(() => {
    const cornerMarkers = Object.entries(corners).map(([id, p]) => ({ id: `corner-${id}`, color: "white" as const, ...(p as ARPoint3D) }));
    const ballMarkers = frame
      ? balls.map((ball) => ({
          id: ball.id,
          color: ball.colour,
          ...tableMmToWorld(frame, ball.xMm, ball.yMm),
        }))
      : [];
    return [...cornerMarkers, ...ballMarkers];
  }, [balls, corners, frame]);

  const markCurrentCorner = () => {
    if (!crosshair) {
      setWarning("Aim at the inner cushion corner first.");
      return;
    }
    if (step === "balls" || step === "confirm") return;
    setCorners((prev) => ({ ...prev, [step]: { ...crosshair } }));
    setWarning(null);
    if (step === "baulkLeft") setStep("baulkRight");
    else if (step === "baulkRight") setStep("blackRight");
    else if (step === "blackRight") setStep("blackLeft");
    else setStep("confirm");
  };

  const undo = () => {
    if (step === "balls") {
      setBalls((prev) => prev.slice(0, -1));
      return;
    }
    const order: Step[] = ["baulkLeft", "baulkRight", "blackRight", "blackLeft"];
    const idx = order.indexOf(step);
    const target = idx <= 0 ? "baulkLeft" : order[idx - 1];
    setCorners((prev) => ({ ...prev, [target]: undefined }));
    setStep(target);
  };

  const resetAll = () => {
    setCorners({});
    setBalls([]);
    setStep("baulkLeft");
    setWarning(null);
  };

  const confirmTable = () => {
    if (!frame) return;
    const v = validateCornerShape(frame);
    if (!v.isReasonable && !allowTestBypass) {
      setWarning(v.warning);
      return;
    }
    setWarning(null);
    setStep("balls");
  };

  const placeBallAtCrosshair = () => {
    if (!frame || !crosshair) return;
    const { xMm, yMm } = worldToTableMm(frame, crosshair);
    setBalls((prev) => [
      ...prev,
      {
        id: `ball-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        colour: selectedColour,
        xMm,
        yMm,
        radiusMm: 26.25,
        confidence: 1,
      },
    ]);
  };

  const applyTestCorners = () => {
    if (!crosshair) {
      setWarning("Move the device so AR tracking gets a ground point first.");
      return;
    }
    const origin = crosshair;
    const widthM = TABLE_WIDTH_MM / 1000;
    const lengthM = TABLE_LENGTH_MM / 1000;
    const testCorners = {
      baulkLeft: origin,
      baulkRight: { x: origin.x + widthM, y: origin.y, z: origin.z },
      blackRight: { x: origin.x + widthM, y: origin.y, z: origin.z - lengthM },
      blackLeft: { x: origin.x, y: origin.y, z: origin.z - lengthM },
    };
    setCorners(testCorners);
    setAllowTestBypass(true);
    setStep("confirm");
    setWarning("Test table applied. Use Confirm Table to continue.");
  };

  const saveSnapshot = async () => {
    if (!corners.baulkLeft || !corners.baulkRight || !corners.blackRight || !corners.blackLeft) {
      Alert.alert("Table not calibrated", "Mark all four corners first.");
      return;
    }
    const next: ARTableSnapshot = {
      id: `snapshot-${Date.now()}`,
      createdAt: new Date().toISOString(),
      tableDimensions: { widthMm: 1778, lengthMm: 3569 },
      cornersWorld: {
        baulkLeft: corners.baulkLeft,
        baulkRight: corners.baulkRight,
        blackRight: corners.blackRight,
        blackLeft: corners.blackLeft,
      },
      balls: balls.map((b) => ({
        ...b,
        xMm: Math.max(0, Math.min(TABLE_WIDTH_MM, b.xMm)),
        yMm: Math.max(0, Math.min(TABLE_LENGTH_MM, b.yMm)),
      })),
    };

    await saveARTableSnapshot(next);
    setSnapshot(next);
    Alert.alert("Saved", "AR table snapshot saved for foul-and-miss restoration.", [
      { text: "Done", onPress: () => navigation.goBack() },
    ]);
  };

  if (!isNativeARKitViewAvailable()) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>ARKit bridge not available</Text>
        <Text style={styles.emptyText}>Build on macOS with iOS native modules enabled, then reopen this screen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SnookerARKitView
        style={StyleSheet.absoluteFill}
        arMode="live"
        showGrid={true}
        showReticle={true}
        showCalibrationMarkers={true}
        calibration={null}
        crosshairPoint={crosshair}
        blackPoint={corners.blackRight ?? null}
        pinkPoint={corners.blackLeft ?? null}
        bluePoint={corners.baulkRight ?? null}
        positionedMarkers={placedMarkers as any}
        selectedMarkerId={null}
        onCrosshairPoint={(p) => setCrosshair(p)}
        onTrackingState={setTracking}
      />

      <View style={styles.overlayTop}>
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
          <Pressable style={styles.backBtn} onPress={applyTestCorners}>
            <Text style={styles.backBtnText}>Use Test Table</Text>
          </Pressable>
        </View>
        <Text style={styles.stepText}>{STEP_LABELS[step]}</Text>
        <Text style={styles.subText}>Tracking: {tracking} · Match {route.params.matchId} · Frame {route.params.frameNumber}</Text>
        {warning ? <Text style={styles.warnText}>{warning}</Text> : null}
      </View>

      <View pointerEvents="none" style={styles.reticleWrap}>
        <View style={styles.reticleOuter}>
          <View style={styles.reticleDot} />
        </View>
      </View>

      {step === "balls" ? (
        <View style={styles.colourRow}>
          {BALLS.map((colour) => (
            <Pressable
              key={colour}
              onPress={() => setSelectedColour(colour)}
              style={[styles.colourChip, { backgroundColor: BALL_HEX[colour], borderColor: selectedColour === colour ? "#FFFFFF" : "rgba(255,255,255,0.35)" }]}
            >
              <Text style={{ color: colour === "white" || colour === "yellow" ? "#111827" : "#FFFFFF", fontWeight: "800" }}>{colour[0].toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.overlayBottom}>
        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryBtn} onPress={undo}><Text style={styles.secondaryText}>Undo</Text></Pressable>
          <Pressable style={styles.secondaryBtn} onPress={resetAll}><Text style={styles.secondaryText}>Reset</Text></Pressable>
          {step === "confirm" ? (
            <Pressable style={styles.primaryBtn} onPress={confirmTable}><Text style={styles.primaryText}>Confirm Table</Text></Pressable>
          ) : step === "balls" ? (
            <Pressable style={styles.primaryBtn} onPress={placeBallAtCrosshair}><Text style={styles.primaryText}>Place Ball</Text></Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={markCurrentCorner}><Text style={styles.primaryText}>Capture Corner</Text></Pressable>
          )}
        </View>
        {step === "balls" ? (
          <Pressable style={[styles.primaryBtn, { marginTop: 10 }]} onPress={saveSnapshot}><Text style={styles.primaryText}>Save Snapshot</Text></Pressable>
        ) : null}

        {snapshot ? (
          <ScrollView style={styles.restoreWrap}>
            <Text style={styles.restoreTitle}>Restore View</Text>
            <ARTableTopDownView balls={snapshot.balls} onChange={(next) => setSnapshot({ ...snapshot, balls: next })} />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  overlayTop: {
    position: "absolute",
    top: 44,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,0.75)",
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  backBtn: {
    backgroundColor: "rgba(15,23,42,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backBtnText: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  reticleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  reticleOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.22)",
  },
  reticleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF" },
  stepText: { color: "#F8FAFC", fontWeight: "800", fontSize: 16 },
  subText: { color: "#93C5FD", fontSize: 12, marginTop: 2 },
  warnText: { color: "#FCA5A5", marginTop: 4, fontSize: 12 },
  colourRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 164,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  colourChip: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  overlayBottom: { position: "absolute", left: 12, right: 12, bottom: 16 },
  actionsRow: { flexDirection: "row", gap: 8 },
  primaryBtn: { flex: 1, backgroundColor: "#10B981", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: { flex: 1, backgroundColor: "rgba(15,23,42,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#052E2B", fontWeight: "800" },
  secondaryText: { color: "#E2E8F0", fontWeight: "700" },
  restoreWrap: { marginTop: 12, maxHeight: 260, backgroundColor: "rgba(2,6,23,0.68)", borderRadius: 10, padding: 10 },
  restoreTitle: { color: "#F8FAFC", fontWeight: "700", marginBottom: 8 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#020617" },
  emptyTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800" },
  emptyText: { color: "#94A3B8", textAlign: "center", marginTop: 8 },
});
