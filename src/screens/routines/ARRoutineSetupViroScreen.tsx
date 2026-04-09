import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroAmbientLight,
  ViroBox,
  ViroMaterials,
  ViroOmniLight,
  ViroSphere,
  ViroTrackingStateConstants,
  type ViroCameraARHitTest,
} from "@reactvision/react-viro";
import { useRoutinesStore } from "../../store";
import type { PracticeStackParamList } from "../../types";
import { getRoutineLayoutDefinition, SPOT_COORDS, type BallColor } from "../../features/ar/routineLayouts";
import {
  applyAlignmentAdjustments as applyTableAdjustments,
  buildVirtualCalibration as buildTableVirtualCalibration,
  computeCalibrationFromBlackPink,
  getCalibrationGuidance,
  getCalibrationQualityBand,
  worldFromNorm,
} from "../../features/ar/snookerTableCalibration";

type CaptureStage = "black" | "pink" | "calibrated";
type ARMode = "live" | "virtual";
type ReticleState = "searching" | "close" | "locked";

type GroundPoint = { x: number; y: number; z: number };

type Marker = {
  id: string;
  xNorm: number;
  yNorm: number;
  color: BallColor;
  kind: "spot" | "routine";
  label?: string;
};

type PositionedMarker = Marker & { x: number; y: number; z: number };

type Calibration = {
  topCenter: GroundPoint;
  axis: GroundPoint;
  perpendicular: GroundPoint;
  tableLengthM: number;
  tableWidthM: number;
  tableY: number;
  scanQuality: number;
};

type AlignmentAdjustments = {
  offsetAlong: number;
  offsetAcross: number;
  rotationDeg: number;
  scaleFactor: number;
};

type CameraPose = {
  positionX: number;
  positionY: number;
  positionZ: number;
  forwardX: number;
  forwardZ: number;
};

type ARSceneProps = {
  sceneNavigator: {
    viroAppProps?: {
      crosshairPoint: GroundPoint | null;
      blackPoint: GroundPoint | null;
      pinkPoint: GroundPoint | null;
      showReticle: boolean;
      positionedMarkers: PositionedMarker[];
      calibration: Calibration | null;
      arMode: ARMode;
      showGrid: boolean;
      onCrosshairPoint?: (point: GroundPoint | null) => void;
      onCameraPose?: (pose: CameraPose) => void;
    };
  };
};

type CameraTransformEvent = {
  cameraTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    forward?: [number, number, number];
  };
};

const TABLE_LENGTH_M = 3.569;
const TABLE_WIDTH_M = 1.778;
const BLACK_Y_NORM = 0.0908;
const PINK_Y_NORM = 0.25;
const BALL_DIAMETER_M = 0.0525;
const BALL_RADIUS_M = BALL_DIAMETER_M / 2;

let materialsConfigured = false;
const ensureViroMaterials = () => {
  if (materialsConfigured) return;

  ViroMaterials.createMaterials({
    tableSurface: { diffuseColor: "rgba(16,120,88,0.32)", lightingModel: "Lambert" },
    tableGrid: { diffuseColor: "rgba(255,255,255,0.25)", lightingModel: "Constant" },
    reticle: { diffuseColor: "#FFFFFF", lightingModel: "Constant" },
    black: { diffuseColor: "#101010", lightingModel: "PBR", roughness: 0.2, metalness: 0.25 },
    pink: { diffuseColor: "#EC4899", lightingModel: "PBR", roughness: 0.22, metalness: 0.2 },
    blue: { diffuseColor: "#2563EB", lightingModel: "PBR", roughness: 0.22, metalness: 0.2 },
    brown: { diffuseColor: "#8B5A2B", lightingModel: "PBR", roughness: 0.28, metalness: 0.15 },
    green: { diffuseColor: "#16A34A", lightingModel: "PBR", roughness: 0.24, metalness: 0.15 },
    yellow: { diffuseColor: "#FACC15", lightingModel: "PBR", roughness: 0.2, metalness: 0.18 },
    red: { diffuseColor: "#DC2626", lightingModel: "PBR", roughness: 0.24, metalness: 0.2 },
    white: { diffuseColor: "#F8FAFC", lightingModel: "PBR", roughness: 0.17, metalness: 0.12 },
  });

  materialsConfigured = true;
};

const materialForColor = (color: BallColor) => {
  switch (color) {
    case "black":
      return "black";
    case "pink":
      return "pink";
    case "blue":
      return "blue";
    case "brown":
      return "brown";
    case "green":
      return "green";
    case "yellow":
      return "yellow";
    case "white":
      return "white";
    default:
      return "red";
  }
};

const pickBestHitResult = (event: ViroCameraARHitTest) => {
  const order = ["ExistingPlaneUsingExtent", "ExistingPlane", "EstimatedHorizontalPlane", "FeaturePoint", "DepthPoint"] as const;
  for (const type of order) {
    const hit = event.hitTestResults.find((result) => result.type === type);
    if (hit) return hit;
  }
  return event.hitTestResults[0];
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const deriveCameraPose = (event: CameraTransformEvent): CameraPose | null => {
  const [positionX, positionY, positionZ] = event.cameraTransform.position;
  const explicitForward = event.cameraTransform.forward;

  let forwardX = 0;
  let forwardZ = -1;

  if (explicitForward && explicitForward.length >= 3) {
    forwardX = explicitForward[0];
    forwardZ = explicitForward[2];
  } else {
    const yaw = toRadians(event.cameraTransform.rotation[1] ?? 0);
    forwardX = -Math.sin(yaw);
    forwardZ = -Math.cos(yaw);
  }

  const magnitude = Math.hypot(forwardX, forwardZ);
  if (magnitude < 0.0001) return null;

  return {
    positionX,
    positionY,
    positionZ,
    forwardX: forwardX / magnitude,
    forwardZ: forwardZ / magnitude,
  };
};

const computeCalibration = (black: GroundPoint | null, pink: GroundPoint | null): Calibration | null => {
  if (!black || !pink) return null;

  const vectorX = pink.x - black.x;
  const vectorZ = pink.z - black.z;
  const blackPinkDistance = Math.hypot(vectorX, vectorZ);
  if (blackPinkDistance < 0.2) return null;

  const axisX = vectorX / blackPinkDistance;
  const axisZ = vectorZ / blackPinkDistance;
  const perpendicularX = -axisZ;
  const perpendicularZ = axisX;
  const normDistance = PINK_Y_NORM - BLACK_Y_NORM;

  const tableLengthM = blackPinkDistance / normDistance;
  const tableWidthM = tableLengthM * (TABLE_WIDTH_M / TABLE_LENGTH_M);
  const tableY = (black.y + pink.y) / 2;

  const topCenter = {
    x: black.x - axisX * (BLACK_Y_NORM * tableLengthM),
    y: tableY,
    z: black.z - axisZ * (BLACK_Y_NORM * tableLengthM),
  };

  const expectedBlackPink = TABLE_LENGTH_M * normDistance;
  const deviation = Math.abs(blackPinkDistance - expectedBlackPink) / expectedBlackPink;

  return {
    topCenter,
    axis: { x: axisX, y: 0, z: axisZ },
    perpendicular: { x: perpendicularX, y: 0, z: perpendicularZ },
    tableLengthM,
    tableWidthM,
    tableY,
    scanQuality: Math.max(0, Math.round((1 - deviation) * 100)),
  };
};

const buildVirtualCalibration = (pose: CameraPose | null, scale: number): Calibration | null => {
  if (!pose) return null;

  const tableLengthM = TABLE_LENGTH_M * scale;
  const tableWidthM = TABLE_WIDTH_M * scale;
  const center = { x: pose.positionX + pose.forwardX * 1.4, y: Math.max(0.05, pose.positionY - 0.75), z: pose.positionZ + pose.forwardZ * 1.4 };

  return {
    topCenter: {
      x: center.x - pose.forwardX * (tableLengthM / 2),
      y: center.y,
      z: center.z - pose.forwardZ * (tableLengthM / 2),
    },
    axis: { x: pose.forwardX, y: 0, z: pose.forwardZ },
    perpendicular: { x: -pose.forwardZ, y: 0, z: pose.forwardX },
    tableLengthM,
    tableWidthM,
    tableY: center.y,
    scanQuality: 100,
  };
};

const applyAlignmentAdjustments = (calibration: Calibration, adjustments: AlignmentAdjustments): Calibration => {
  const radians = (adjustments.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const axis = {
    x: calibration.axis.x * cos - calibration.axis.z * sin,
    y: 0,
    z: calibration.axis.x * sin + calibration.axis.z * cos,
  };

  const perpendicular = {
    x: calibration.perpendicular.x * cos - calibration.perpendicular.z * sin,
    y: 0,
    z: calibration.perpendicular.x * sin + calibration.perpendicular.z * cos,
  };

  return {
    ...calibration,
    axis,
    perpendicular,
    topCenter: {
      x: calibration.topCenter.x + axis.x * adjustments.offsetAlong + perpendicular.x * adjustments.offsetAcross,
      y: calibration.topCenter.y,
      z: calibration.topCenter.z + axis.z * adjustments.offsetAlong + perpendicular.z * adjustments.offsetAcross,
    },
    tableLengthM: calibration.tableLengthM * adjustments.scaleFactor,
    tableWidthM: calibration.tableWidthM * adjustments.scaleFactor,
  };
};

const toWorldPoint = (calibration: Calibration, marker: Marker): GroundPoint => {
  const along = marker.yNorm * calibration.tableLengthM;
  const across = (marker.xNorm - 0.5) * calibration.tableWidthM;

  return {
    x: calibration.topCenter.x + calibration.axis.x * along + calibration.perpendicular.x * across,
    y: calibration.tableY,
    z: calibration.topCenter.z + calibration.axis.z * along + calibration.perpendicular.z * across,
  };
};

const RoutineARScene = (props: ARSceneProps) => {
  const appProps = props.sceneNavigator.viroAppProps;

  return (
    <ViroARScene
      onTrackingUpdated={(state: number) => {
        if (state === ViroTrackingStateConstants.TRACKING_NORMAL) return;
      }}
      onCameraARHitTest={(event: ViroCameraARHitTest) => {
        if (appProps?.arMode !== "live") return;
        const best = pickBestHitResult(event);
        if (!best?.transform?.position) return;
        appProps?.onCrosshairPoint?.({ x: best.transform.position[0], y: best.transform.position[1], z: best.transform.position[2] });
      }}
      onCameraTransformUpdate={(event: unknown) => {
        const pose = deriveCameraPose(event as CameraTransformEvent);
        if (pose) appProps?.onCameraPose?.(pose);
      }}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={750} />
      <ViroOmniLight color="#FFFFFF" position={[0, 2.2, 0.5]} attenuationStartDistance={2} attenuationEndDistance={6} intensity={520} />

      {appProps?.calibration
        ? (() => {
            const calib = appProps.calibration;
            return (
              <>
                <ViroBox
                  position={[
                    calib.topCenter.x + calib.axis.x * (calib.tableLengthM / 2),
                    calib.tableY + 0.005,
                    calib.topCenter.z + calib.axis.z * (calib.tableLengthM / 2),
                  ]}
                  scale={[calib.tableWidthM, 0.001, calib.tableLengthM]}
                  rotation={[0, (Math.atan2(calib.axis.x, calib.axis.z) * 180) / Math.PI, 0]}
                  materials={["tableSurface"]}
                />
                {appProps.showGrid
                  ? [0.25, 0.5, 0.75].map((t) => (
                      <ViroBox
                        key={`grid-${t}`}
                        position={[
                          calib.topCenter.x + calib.axis.x * (calib.tableLengthM * t),
                          calib.tableY + 0.006,
                          calib.topCenter.z + calib.axis.z * (calib.tableLengthM * t),
                        ]}
                        scale={[calib.tableWidthM, 0.0006, 0.01]}
                        rotation={[0, (Math.atan2(calib.axis.x, calib.axis.z) * 180) / Math.PI + 90, 0]}
                        materials={["tableGrid"]}
                      />
                    ))
                  : null}
              </>
            );
          })()
        : null}

      {appProps?.blackPoint ? <ViroSphere position={[appProps.blackPoint.x, appProps.blackPoint.y + 0.01, appProps.blackPoint.z]} radius={BALL_RADIUS_M} materials={["black"]} /> : null}
      {appProps?.pinkPoint ? <ViroSphere position={[appProps.pinkPoint.x, appProps.pinkPoint.y + 0.01, appProps.pinkPoint.z]} radius={BALL_RADIUS_M} materials={["pink"]} /> : null}

      {appProps?.positionedMarkers.map((marker) => (
        <ViroSphere
          key={marker.id}
          position={[marker.x, marker.y + 0.012, marker.z]}
          radius={BALL_RADIUS_M}
          materials={[materialForColor(marker.color)]}
        />
      ))}

      {appProps?.showReticle && appProps.crosshairPoint ? (
        <ViroSphere position={[appProps.crosshairPoint.x, appProps.crosshairPoint.y + 0.01, appProps.crosshairPoint.z]} radius={0.022} materials={["reticle"]} />
      ) : null}
    </ViroARScene>
  );
};

export const ARRoutineSetupViroScreen = () => {
  ensureViroMaterials();

  const route = useRoute<RouteProp<PracticeStackParamList, "ARRoutineSetup">>();
  const insets = useSafeAreaInsets();

  const { getRoutineById } = useRoutinesStore();
  const routine = getRoutineById(route.params.routineId);

  const [arMode, setArMode] = useState<ARMode>("live");
  const [stage, setStage] = useState<CaptureStage>("black");
  const [crosshairPoint, setCrosshairPoint] = useState<GroundPoint | null>(null);
  const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
  const [blackPoint, setBlackPoint] = useState<GroundPoint | null>(null);
  const [pinkPoint, setPinkPoint] = useState<GroundPoint | null>(null);
  const [pendingCalibration, setPendingCalibration] = useState<Calibration | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [offsetAlong, setOffsetAlong] = useState(0);
  const [offsetAcross, setOffsetAcross] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [virtualScale, setVirtualScale] = useState(0.45);
  const [showGrid] = useState(false);
  const [reticleState, setReticleState] = useState<ReticleState>("searching");
  const [reticleHint, setReticleHint] = useState("Move over the table to detect the surface");

  const layoutDefinition = useMemo(() => getRoutineLayoutDefinition(routine), [routine]);

  const routineMarkers = useMemo<Marker[]>(
    () =>
      layoutDefinition.ballPlacements.map((ball) => ({
        id: ball.id,
        xNorm: ball.x,
        yNorm: ball.y,
        color: ball.color,
        kind: "routine",
        label: ball.label,
      })),
    [layoutDefinition.ballPlacements]
  );

  const spotMarkers = useMemo<Marker[]>(
    () =>
      layoutDefinition.spotMarkers.map((spotId) => ({
        id: spotId,
        xNorm: SPOT_COORDS[spotId].x,
        yNorm: SPOT_COORDS[spotId].y,
        color: SPOT_COORDS[spotId].color,
        kind: "spot",
        label: SPOT_COORDS[spotId].label,
      })),
    [layoutDefinition.spotMarkers]
  );

  const visibleMarkers = useMemo(() => [...spotMarkers, ...routineMarkers], [spotMarkers, routineMarkers]);

  const liveCalibration = useMemo(() => computeCalibrationFromBlackPink(blackPoint, pinkPoint), [blackPoint, pinkPoint]);
  const virtualCalibration = useMemo(() => buildTableVirtualCalibration(cameraPose, virtualScale), [cameraPose, virtualScale]);
  const baseCalibration = arMode === "virtual" ? virtualCalibration : liveCalibration;

  const calibration = useMemo(() => {
    if (!baseCalibration) return null;
    return applyTableAdjustments(baseCalibration, {
      offsetAlong,
      offsetAcross,
      rotationDeg,
      scaleFactor,
    });
  }, [baseCalibration, offsetAcross, offsetAlong, rotationDeg, scaleFactor]);
  const calibrationBand = getCalibrationQualityBand(baseCalibration?.scanQuality ?? 0);
  const calibrationHint = getCalibrationGuidance(baseCalibration?.scanQuality ?? 0);

  const positionedMarkers = useMemo(() => {
    if (!calibration || stage !== "calibrated") return [] as PositionedMarker[];
    return visibleMarkers.map((marker) => {
      const point = worldFromNorm(calibration, marker.xNorm, marker.yNorm);
      return { ...marker, x: point.x, y: point.y, z: point.z };
    });
  }, [calibration, stage, visibleMarkers]);

  useEffect(() => {
    if (stage === "calibrated") {
      setReticleState("locked");
      setReticleHint("Locked. Walk around and place balls on the guides.");
      return;
    }

    if (!crosshairPoint) {
      setReticleState("searching");
      setReticleHint("Move over the table to detect the surface");
      return;
    }

    setReticleState("close");
    setReticleHint(stage === "black" ? "Hold steady over the black spot" : "Hold steady over the pink spot");
  }, [crosshairPoint, stage]);

  const flowStep = useMemo(() => {
    if (stage === "calibrated") return 4;
    if (stage === "pink") return 3;
    if (stage === "black" && crosshairPoint) return 2;
    return 1;
  }, [stage, crosshairPoint]);

  const stepLabel = useMemo(() => {
    if (flowStep === 1) return "Detect Table";
    if (flowStep === 2) return "Align Black";
    if (flowStep === 3) return "Confirm Pink";
    return "Routine Ready";
  }, [flowStep]);

  const resetAll = () => {
    setBlackPoint(null);
    setPinkPoint(null);
    setPendingCalibration(null);
    setCrosshairPoint(null);
    setStage("black");
    setScanError(null);
    setOffsetAlong(0);
    setOffsetAcross(0);
    setRotationDeg(0);
    setScaleFactor(1);
  };

  const capture = () => {
    if (arMode === "virtual") return;
    if (!crosshairPoint) return;

    if (stage === "black") {
      setBlackPoint(crosshairPoint);
      setStage("pink");
      return;
    }

    if (stage === "pink") {
      const solved = computeCalibrationFromBlackPink(blackPoint, crosshairPoint);
      if (!solved) {
        setScanError("Calibration failed. Re-scan Black and Pink with stable reticle lock.");
        return;
      }
      const band = getCalibrationQualityBand(solved.scanQuality);
      if (band === "poor") {
        setPendingCalibration(solved as Calibration);
        setScanError("Calibration quality is poor. Re-scan or continue with manual tune.");
        return;
      }
      setPinkPoint(crosshairPoint);
      setStage("calibrated");
      setPendingCalibration(null);
      setScanError(null);
    }
  };

  const acceptPendingCalibration = () => {
    if (!pendingCalibration || !crosshairPoint) return;
    setPinkPoint(crosshairPoint);
    setStage("calibrated");
    setPendingCalibration(null);
    setScanError("Calibration accepted with manual tuning enabled.");
  };

  if (!routine) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Routine not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: RoutineARScene as any }}
        worldAlignment="Gravity"
        videoQuality="High"
        viroAppProps={{
          crosshairPoint,
          blackPoint,
          pinkPoint,
          showReticle: arMode === "live" && stage !== "calibrated",
          positionedMarkers,
          calibration,
          arMode,
          showGrid,
          onCrosshairPoint: setCrosshairPoint,
          onCameraPose: setCameraPose,
        }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.engineBadge} pointerEvents="none">
        <Text style={styles.engineBadgeText}>AR Engine: ReactVision (Viro)</Text>
      </View>

      {stage !== "calibrated" && arMode === "live" ? (
        <View pointerEvents="none" style={styles.reticleWrap}>
          <View
            style={[
              styles.reticleRing,
              reticleState === "searching"
                ? styles.reticleSearching
                : reticleState === "close"
                  ? styles.reticleClose
                  : styles.reticleLocked,
            ]}
          >
            <View style={styles.reticleDot} />
            <View style={[styles.reticleLineHorizontal, !crosshairPoint && styles.reticleLineDim]} />
            <View style={[styles.reticleLineVertical, !crosshairPoint && styles.reticleLineDim]} />
          </View>
          <Text style={styles.reticleLabel}>{reticleHint}</Text>
        </View>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}> 
        <Text style={styles.title}>AR Routine Setup</Text>
        <Text style={styles.stepTitle}>Step {flowStep} of 4 · {stepLabel}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(flowStep / 4) * 100}%` }]} />
        </View>
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
        <Text style={styles.instruction}>
          {arMode === "virtual"
            ? "Virtual bed mode: preview exact routine geometry away from a table."
            : flowStep === 1
              ? "Move your phone slowly above the table to detect the surface"
              : stage === "black"
                ? "Align with the black spot and hold steady"
                : stage === "pink"
                  ? "Now align with the pink spot and hold steady"
                : "Calibrated. Place balls directly on projected markers."}
        </Text>
        <Text style={styles.metrics}>
          {arMode === "virtual"
            ? `Virtual scale ${virtualScale.toFixed(2)}x • Markers ${positionedMarkers.length}`
            : stage === "calibrated"
              ? `Scan quality ${baseCalibration?.scanQuality ?? 0}% • Markers ${positionedMarkers.length}`
              : "Aim at table cloth to lock reticle"}
        </Text>
        {arMode === "live" && baseCalibration ? (
          <Text
            style={[
              styles.qualityPill,
              calibrationBand === "locked"
                ? styles.qualityLocked
                : calibrationBand === "good"
                  ? styles.qualityGood
                  : calibrationBand === "usable"
                    ? styles.qualityUsable
                    : styles.qualityPoor,
            ]}
          >
            {calibrationBand.toUpperCase()} · {calibrationHint}
          </Text>
        ) : null}

        {stage === "calibrated" && arMode === "live" ? (
          <View style={styles.tunePanel}>
            <Text style={styles.tuneTitle}>Alignment tune</Text>
            <View style={styles.tuneRow}>
              <Pressable style={styles.tuneButton} onPress={() => setOffsetAlong((prev) => Number((prev - 0.03).toFixed(2)))}><Text style={styles.tuneButtonText}>Back</Text></Pressable>
              <Pressable style={styles.tuneButton} onPress={() => setOffsetAlong((prev) => Number((prev + 0.03).toFixed(2)))}><Text style={styles.tuneButtonText}>Forward</Text></Pressable>
              <Pressable style={styles.tuneButton} onPress={() => setOffsetAcross((prev) => Number((prev - 0.03).toFixed(2)))}><Text style={styles.tuneButtonText}>Left</Text></Pressable>
              <Pressable style={styles.tuneButton} onPress={() => setOffsetAcross((prev) => Number((prev + 0.03).toFixed(2)))}><Text style={styles.tuneButtonText}>Right</Text></Pressable>
            </View>
            <View style={styles.tuneRow}>
              <Pressable style={styles.tuneButton} onPress={() => setRotationDeg((prev) => Math.max(-12, prev - 1))}><Text style={styles.tuneButtonText}>Rotate -</Text></Pressable>
              <Pressable style={styles.tuneButton} onPress={() => setRotationDeg((prev) => Math.min(12, prev + 1))}><Text style={styles.tuneButtonText}>Rotate +</Text></Pressable>
              <Pressable style={styles.tuneButton} onPress={() => setScaleFactor((prev) => Math.max(0.88, Number((prev - 0.01).toFixed(2))))}><Text style={styles.tuneButtonText}>Scale -</Text></Pressable>
              <Pressable style={styles.tuneButton} onPress={() => setScaleFactor((prev) => Math.min(1.12, Number((prev + 0.01).toFixed(2))))}><Text style={styles.tuneButtonText}>Scale +</Text></Pressable>
            </View>
            <Text style={styles.tuneMetrics}>{`F/B ${offsetAlong.toFixed(2)}m • L/R ${offsetAcross.toFixed(2)}m • Rot ${rotationDeg}deg • Scale ${scaleFactor.toFixed(2)}x`}</Text>
          </View>
        ) : null}

        {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}
        {pendingCalibration && stage === "pink" ? (
          <View style={styles.pendingCalibrationRow}>
            <Pressable style={styles.sideButton} onPress={resetAll}>
              <Text style={styles.sideButtonText}>Re-scan</Text>
            </Pressable>
            <Pressable style={styles.sideButton} onPress={acceptPendingCalibration}>
              <Text style={styles.sideButtonText}>Use & Tune</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.captureRow}>
          <Pressable style={styles.sideButton} onPress={stage === "calibrated" ? resetAll : () => setStage("black")}>
            <Text style={styles.sideButtonText}>Re-scan</Text>
          </Pressable>

          <Pressable style={[styles.captureButton, !crosshairPoint && stage !== "calibrated" && styles.captureDisabled]} onPress={stage === "calibrated" ? undefined : capture}>
            <View style={styles.captureCore} />
          </Pressable>

          <View style={styles.sideButton}>
            <Text style={styles.sideButtonText}>{flowStep < 4 ? "Confirm" : "Ready"}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#04070E" },
  engineBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 1000,
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "rgba(59,130,246,0.55)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  engineBadgeText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  reticleWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  reticleRing: { width: 62, height: 62, borderRadius: 999, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  reticleSearching: { borderColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.04)" },
  reticleClose: { borderColor: "rgba(245,158,11,0.9)", backgroundColor: "rgba(245,158,11,0.1)" },
  reticleLocked: { borderColor: "rgba(16,185,129,0.9)", backgroundColor: "rgba(16,185,129,0.12)" },
  reticleDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#FFFFFF" },
  reticleLineHorizontal: { position: "absolute", width: 20, height: 2, backgroundColor: "#FFFFFF" },
  reticleLineVertical: { position: "absolute", height: 20, width: 2, backgroundColor: "#FFFFFF" },
  reticleLineDim: { opacity: 0.4 },
  reticleLabel: { marginTop: 8, color: "#E5E7EB", fontSize: 11, fontWeight: "700", letterSpacing: 0.3, backgroundColor: "rgba(2,6,13,0.65)", borderRadius: 8, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  topBar: { position: "absolute", top: 0, left: 12, right: 12, gap: 6, backgroundColor: "rgba(2,6,13,0.55)", borderRadius: 12, paddingHorizontal: 10, paddingBottom: 10 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  stepTitle: { color: "#C5D2EA", fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: "#6EE0B1" },
  bottomPanel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: "rgba(3,6,14,0.62)" },
  instruction: { color: "#FFFFFF", textAlign: "center", fontSize: 16, fontWeight: "800" },
  metrics: { marginTop: 4, color: "#D1D5DB", textAlign: "center", fontSize: 12 },
  qualityPill: { marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, textAlign: "center", fontSize: 11, fontWeight: "700" },
  qualityPoor: { backgroundColor: "rgba(239,68,68,0.15)", color: "#FCA5A5" },
  qualityUsable: { backgroundColor: "rgba(245,158,11,0.14)", color: "#FCD34D" },
  qualityGood: { backgroundColor: "rgba(59,130,246,0.14)", color: "#93C5FD" },
  qualityLocked: { backgroundColor: "rgba(16,185,129,0.16)", color: "#6EE7B7" },
  tunePanel: { marginTop: 10, gap: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", padding: 8, backgroundColor: "rgba(10,14,24,0.7)" },
  tuneTitle: { color: "#E5E7EB", textAlign: "center", fontSize: 12, fontWeight: "700" },
  tuneRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  tuneButton: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(24,31,49,0.8)", paddingVertical: 7, alignItems: "center" },
  tuneButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  tuneMetrics: { color: "#CBD5E1", textAlign: "center", fontSize: 11, marginTop: 2 },
  errorText: { marginTop: 8, color: "#FCA5A5", textAlign: "center", fontSize: 12 },
  pendingCalibrationRow: { marginTop: 8, flexDirection: "row", justifyContent: "center", gap: 10 },
  captureRow: { marginTop: 12, marginBottom: 2, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14 },
  captureButton: { width: 80, height: 80, borderRadius: 999, borderWidth: 4, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  captureDisabled: { opacity: 0.45 },
  captureCore: { width: 54, height: 54, borderRadius: 999, backgroundColor: "#FFFFFF" },
  sideButton: { minWidth: 72, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(12,18,31,0.68)", paddingVertical: 10, paddingHorizontal: 10, alignItems: "center" },
  sideButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#070B14" },
  emptyTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
});
