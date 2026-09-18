import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import type { MatchesStackParamList } from "../../types";
import { CameraCaptureView } from "../../components/tableCapture/CameraCaptureView";
import { CornerCalibrationOverlay } from "../../components/tableCapture/CornerCalibrationOverlay";
import { BallPlacementOverlay } from "../../components/tableCapture/BallPlacementOverlay";
import { SnookerTableTopDownView } from "../../components/tableCapture/SnookerTableTopDownView";
import { saveTableSnapshot } from "../../features/tableCapture/snapshotStorage";
import {
  createInitialCorners,
  detectTableAndBallsAutomatically,
  screenToNormalized,
} from "../../features/tableCapture/tableGeometry";
import type { BallColour, CapturedBall, Point, TableCorners, TableSnapshot } from "../../features/tableCapture/ballTypes";

type WorkingBall = {
  id: string;
  colour: BallColour;
  position: Point;
};

export const TablePositionCaptureScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "TablePositionCapture">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();

  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [step, setStep] = React.useState<"corners" | "balls" | "restore">("corners");
  const [corners, setCorners] = React.useState<TableCorners | null>(null);
  const [selectedColour, setSelectedColour] = React.useState<BallColour>("white");
  const [balls, setBalls] = React.useState<WorkingBall[]>([]);
  const [snapshot, setSnapshot] = React.useState<TableSnapshot | null>(null);

  React.useEffect(() => {
    if (!size.width || !size.height || corners) return;
    setCorners(createInitialCorners(size.width, size.height));

    // Future OpenCV/ML hook: use frame inference to pre-fill corner/ball candidates.
    detectTableAndBallsAutomatically().catch(() => {});
  }, [corners, size.height, size.width]);

  const setCorner = (key: keyof TableCorners, point: Point) => {
    if (!corners) return;
    setCorners({ ...corners, [key]: point });
  };

  const handleSavePosition = async () => {
    if (!corners) return;
    const normalizedBalls: CapturedBall[] = balls.map((ball) => {
      const normalized = screenToNormalized(corners, ball.position);
      return {
        id: ball.id,
        colour: ball.colour,
        x: normalized.x,
        y: normalized.y,
        confidence: 1,
      };
    });

    const nextSnapshot: TableSnapshot = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      corners,
      balls: normalizedBalls,
    };

    try {
      await saveTableSnapshot(nextSnapshot);
      setSnapshot(nextSnapshot);
      setStep("restore");
    } catch {
      Alert.alert("Save failed", "Could not save table position right now.");
    }
  };

  const handleRestoreBallsChange = (next: CapturedBall[]) => {
    setSnapshot((prev) => (prev ? { ...prev, balls: next } : prev));
  };

  const applyRestoreEditsAndExit = async () => {
    if (!snapshot || !corners) {
      navigation.goBack();
      return;
    }

    try {
      await saveTableSnapshot(snapshot);
      Alert.alert("Saved", "Table position snapshot captured for foul-and-miss restoration.", [
        {
          text: "Done",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch {
      Alert.alert("Save failed", "Could not update restore map.");
    }
  };

  return (
    <View style={styles.container}>
      {step !== "restore" ? (
        <View style={styles.captureStage} onLayout={(event) => setSize(event.nativeEvent.layout)}>
          <CameraCaptureView>
            {corners && size.width > 0 && size.height > 0 && step === "corners" ? (
              <CornerCalibrationOverlay
                width={size.width}
                height={size.height}
                corners={corners}
                setCorner={setCorner}
                onConfirm={() => setStep("balls")}
              />
            ) : null}

            {corners && size.width > 0 && size.height > 0 && step === "balls" ? (
              <BallPlacementOverlay
                width={size.width}
                height={size.height}
                corners={corners}
                balls={balls}
                setBalls={setBalls}
                selectedColour={selectedColour}
                setSelectedColour={setSelectedColour}
                onSave={handleSavePosition}
                onBack={() => setStep("corners")}
              />
            ) : null}
          </CameraCaptureView>

          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>Table Position Capture · Frame {route.params.frameNumber}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.restoreStage}>
          <ScrollView contentContainerStyle={styles.restoreContent}>
            <Text style={styles.restoreTitle}>Restore Map</Text>
            <Text style={styles.restoreSubtitle}>Top-down ghost layout saved. Drag balls to fine-tune, then save.</Text>
            {snapshot ? <SnookerTableTopDownView balls={snapshot.balls} onChange={handleRestoreBallsChange} /> : null}

            <View style={styles.restoreActions}>
              <Pressable style={[styles.restoreBtn, styles.secondary]} onPress={() => setStep("balls")}>
                <Text style={styles.secondaryText}>Back to Camera</Text>
              </Pressable>
              <Pressable style={[styles.restoreBtn, styles.primary]} onPress={applyRestoreEditsAndExit}>
                <Text style={styles.primaryText}>Save Snapshot</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  captureStage: { flex: 1 },
  topBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    backgroundColor: "rgba(2,6,23,0.82)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  topBadgeText: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  restoreStage: { flex: 1, backgroundColor: "#081711" },
  restoreContent: { padding: 16, gap: 12 },
  restoreTitle: { color: "#ECFDF5", fontWeight: "800", fontSize: 24 },
  restoreSubtitle: { color: "#A7F3D0", fontSize: 13, marginBottom: 4 },
  restoreActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  restoreBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  primary: { backgroundColor: "#10B981" },
  secondary: { backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#334155" },
  primaryText: { color: "#052E2B", fontWeight: "800" },
  secondaryText: { color: "#E2E8F0", fontWeight: "700" },
});
