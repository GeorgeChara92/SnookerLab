import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View, Vibration } from "react-native";
import { useNavigation, type RouteProp } from "@react-navigation/native";
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
import { useSnookerScanStore, type SnookerBallColor, type SnookerCalibration } from "../../store/snookerScanStore";
import type { MatchesStackParamList } from "../../types";
import {
  applyAlignmentAdjustments as applyTableAdjustments,
  buildVirtualCalibration as buildTableVirtualCalibration,
  computeCalibrationFromBlackPink,
  getCalibrationGuidance,
  getCalibrationQualityBand,
  normFromWorld,
  worldFromNorm,
} from "../../features/ar/snookerTableCalibration";

type CaptureStage = "black" | "pink" | "calibrated";
type ARMode = "live" | "virtual";

type GroundPoint = { x: number; y: number; z: number };

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
      showCalibrationMarkers: boolean;
      showReticle: boolean;
      calibration: SnookerCalibration | null;
      arMode: ARMode;
      showGrid: boolean;
      positionedMarkers: Array<{
        id: string;
        color: SnookerBallColor;
        x: number;
        y: number;
        z: number;
      }>;
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

const TABLE_LENGTH_M = 3.657;
const TABLE_WIDTH_M = 1.829;
const BLACK_Y_NORM = 0.324 / TABLE_LENGTH_M;
const PINK_Y_NORM = 0.25;
const BALL_DIAMETER_M = 0.0525;
const BALL_RENDER_SCALE = 0.94;
const BALL_RADIUS_M = (BALL_DIAMETER_M / 2) * BALL_RENDER_SCALE;

const BALL_COLORS: Array<{ color: SnookerBallColor }> = [
  { color: "white" },
  { color: "red" },
  { color: "yellow" },
  { color: "green" },
  { color: "brown" },
  { color: "blue" },
  { color: "pink" },
  { color: "black" },
];

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

const computeCalibration = (black: GroundPoint | null, pink: GroundPoint | null): SnookerCalibration | null => {
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

const buildVirtualCalibration = (pose: CameraPose | null, scale: number): SnookerCalibration | null => {
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

const toWorldPoint = (calibration: SnookerCalibration, xNorm: number, yNorm: number): GroundPoint => {
  const along = yNorm * calibration.tableLengthM;
  const across = (xNorm - 0.5) * calibration.tableWidthM;

  return {
    x: calibration.topCenter.x + calibration.axis.x * along + calibration.perpendicular.x * across,
    y: calibration.tableY,
    z: calibration.topCenter.z + calibration.axis.z * along + calibration.perpendicular.z * across,
  };
};

const SnookerScanARScene = (props: ARSceneProps) => {
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

      {appProps?.showCalibrationMarkers && appProps?.blackPoint ? (
        <ViroSphere position={[appProps.blackPoint.x, appProps.blackPoint.y + 0.01, appProps.blackPoint.z]} radius={BALL_RADIUS_M} materials={["black"]} />
      ) : null}
      {appProps?.showCalibrationMarkers && appProps?.pinkPoint ? (
        <ViroSphere position={[appProps.pinkPoint.x, appProps.pinkPoint.y + 0.01, appProps.pinkPoint.z]} radius={BALL_RADIUS_M} materials={["pink"]} />
      ) : null}

      {appProps?.positionedMarkers.map((marker) => (
        <ViroSphere key={marker.id} position={[marker.x, marker.y + 0.012, marker.z]} radius={BALL_RADIUS_M} materials={[marker.color]} />
      ))}

      {appProps?.showReticle && appProps.crosshairPoint ? (
        <ViroSphere position={[appProps.crosshairPoint.x, appProps.crosshairPoint.y + 0.01, appProps.crosshairPoint.z]} radius={0.022} materials={["reticle"]} />
      ) : null}
    </ViroARScene>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const triggerHaptic = (type: "light" | "medium" | "heavy" = "light") => {
  try {
    if (type === "light") Vibration.vibrate(10);
    else if (type === "medium") Vibration.vibrate(20);
    else Vibration.vibrate(40);
  } catch {}
};

export const SnookerScanViroScreen = () => {
  ensureViroMaterials();

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const store = useSnookerScanStore();

  const [arMode, setArMode] = useState<ARMode>("live");
  const [stage, setStage] = useState<CaptureStage>("black");
  const [crosshairPoint, setCrosshairPoint] = useState<GroundPoint | null>(null);
  const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
  const [blackPoint, setBlackPoint] = useState<GroundPoint | null>(null);
  const [pinkPoint, setPinkPoint] = useState<GroundPoint | null>(null);
  const [pendingCalibration, setPendingCalibration] = useState<SnookerCalibration | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [virtualScale, setVirtualScale] = useState(0.45);
  const [offsetAlong, setOffsetAlong] = useState(0);
  const [offsetAcross, setOffsetAcross] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [hasPlacedMarker, setHasPlacedMarker] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const topBarSlideAnim = useRef(new Animated.Value(0)).current;
  const placeScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: "none" } });
    }
    return () => {
      if (parent) {
        parent.setOptions({ tabBarStyle: undefined });
      }
    };
  }, [navigation]);

  useEffect(() => {
    if (uiVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(topBarSlideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
        Animated.timing(topBarSlideAnim, { toValue: -100, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [uiVisible]);

  useEffect(() => {
    if (stage === "calibrated" && crosshairPoint) {
      Animated.sequence([
        Animated.timing(placeScaleAnim, { toValue: 1.08, duration: 100, useNativeDriver: true }),
        Animated.timing(placeScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [stage, crosshairPoint]);

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
    }) as SnookerCalibration;
  }, [baseCalibration, offsetAlong, offsetAcross, rotationDeg, scaleFactor]);
  const calibrationBand = getCalibrationQualityBand(baseCalibration?.scanQuality ?? 0);
  const calibrationHint = getCalibrationGuidance(baseCalibration?.scanQuality ?? 0);

  const positionedMarkers = useMemo(() => {
    if (!calibration || stage !== "calibrated") return [];
    return store.markers.map((marker) => {
      const point = worldFromNorm(calibration, marker.xNorm, marker.yNorm);
      return { ...marker, x: point.x, y: point.y, z: point.z };
    });
  }, [calibration, stage, store.markers]);

  const showCalibrationMarkers = stage === "black" || stage === "pink";

  const resetCalibration = useCallback(() => {
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
  }, []);

  const toggleARMode = useCallback(() => {
    setArMode((prev) => {
      const next = prev === "live" ? "virtual" : "live";
      if (next === "virtual") {
        setStage("calibrated");
      } else {
        setStage("black");
        setBlackPoint(null);
        setPinkPoint(null);
        setPendingCalibration(null);
        setCrosshairPoint(null);
      }
      setOffsetAlong(0);
      setOffsetAcross(0);
      setRotationDeg(0);
      setScaleFactor(1);
      setScanError(null);
      return next;
    });
  }, []);

  const capture = useCallback(() => {
    if (arMode === "virtual") return;
    if (!crosshairPoint) return;

    if (stage === "black") {
      setBlackPoint(crosshairPoint);
      setStage("pink");
      return;
    }

    if (stage === "pink") {
      const solved = computeCalibrationFromBlackPink(blackPoint, crosshairPoint) as SnookerCalibration | null;
      if (!solved) {
        setScanError("Calibration failed. Re-scan Black and Pink with stable reticle lock.");
        return;
      }
      const band = getCalibrationQualityBand(solved.scanQuality);
      if (band === "poor") {
        setPendingCalibration(solved);
        setScanError("Calibration quality is poor. Re-scan, or use manual confirm to tune alignment.");
        return;
      }
      setPinkPoint(crosshairPoint);
      store.setCalibration(solved);
      setStage("calibrated");
      setPendingCalibration(null);
      setScanError(null);
      return;
    }
  }, [arMode, crosshairPoint, stage, blackPoint, store]);

  const placeMarkerAtCrosshair = useCallback(() => {
    if (!calibration || stage !== "calibrated" || !crosshairPoint) return;

    const { xNorm, yNorm } = normFromWorld(calibration, crosshairPoint);

    if (yNorm < -0.02 || yNorm > 1.02 || xNorm < -0.02 || xNorm > 1.02) {
      setScanError("Point is outside table bounds.");
      if (!uiVisible) {
        setErrorMessage("Point is outside table bounds. Aim at the table surface.");
        setShowErrorPopup(true);
      }
      return;
    }

    store.addMarker({ color: store.selectedBallColor, xNorm, yNorm });
    setScanError(null);
    setHasPlacedMarker(true);
    triggerHaptic("heavy");
  }, [calibration, stage, crosshairPoint, store, uiVisible]);

  const undoLastMarker = useCallback(() => {
    if (store.markers.length > 0) {
      const lastMarker = store.markers[store.markers.length - 1];
      store.removeMarker(lastMarker.id);
      setScanError(null);
    }
  }, [store]);

  const acceptPendingCalibration = useCallback(() => {
    if (!pendingCalibration || !crosshairPoint) return;
    setPinkPoint(crosshairPoint);
    store.setCalibration(pendingCalibration);
    setStage("calibrated");
    setPendingCalibration(null);
    setScanError("Calibration accepted with manual tuning enabled.");
  }, [pendingCalibration, crosshairPoint, store]);

  const endAndReturn = useCallback(() => {
    store.endScan();
    navigation.goBack();
  }, [store, navigation]);

  const selectedBallHex = BALL_HEX[store.selectedBallColor];

  const topBarTranslateY = topBarSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -100] });
  const bottomPanelTranslateY = slideAnim.interpolate({ inputRange: [0, 300], outputRange: [0, 400] });
  const ballSelectorWidth = BALL_COLORS.length * 44 + (BALL_COLORS.length - 1) * 6;

  return (
    <View style={styles.container}>
      <View style={styles.engineBadge} pointerEvents="none">
        <Text style={styles.engineBadgeText}>AR Engine: ReactVision (Viro)</Text>
      </View>

      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: SnookerScanARScene as any }}
        worldAlignment="Gravity"
        videoQuality="High"
        viroAppProps={{
          crosshairPoint,
          blackPoint,
          pinkPoint,
          showCalibrationMarkers,
          showReticle: arMode === "live",
          positionedMarkers,
          calibration,
          arMode,
          showGrid,
          onCrosshairPoint: setCrosshairPoint,
          onCameraPose: setCameraPose,
        }}
        style={StyleSheet.absoluteFill}
      />

      {stage !== "calibrated" && arMode === "live" && (
        <View pointerEvents="none" style={styles.reticleWrap}>
          <View style={styles.reticleRing}>
            <View style={styles.reticleDot} />
            <View style={[styles.reticleLineHorizontal, !crosshairPoint && styles.reticleLineDim]} />
            <View style={[styles.reticleLineVertical, !crosshairPoint && styles.reticleLineDim]} />
          </View>
          <Text style={styles.reticleLabel}>{crosshairPoint ? "Aim point" : "Point at table"}</Text>
        </View>
      )}

      {stage === "calibrated" && arMode === "live" && crosshairPoint && (
        <View pointerEvents="none" style={styles.reticleWrap}>
          <Animated.View style={[styles.reticleRingActive, { transform: [{ scale: placeScaleAnim }] }]}>
            <View style={styles.reticleDot} />
          </Animated.View>
        </View>
      )}

<Animated.View style={[styles.topBar, { paddingTop: insets.top + 8, transform: [{ translateY: topBarTranslateY }], opacity: fadeAnim }]}>
        <Text style={styles.title}>Snooker Scan</Text>
        <View style={styles.topButtons}>
          <Pressable style={styles.topButton} onPress={() => setUiVisible((prev) => !prev)}>
            <Text style={styles.topButtonText}>{uiVisible ? "HIDE" : "SHOW"}</Text>
          </Pressable>
          {stage === "calibrated" && (
            <Pressable style={styles.topButton} onPress={() => setShowGrid((prev) => !prev)}>
              <Text style={styles.topButtonText}>{showGrid ? "GRID OFF" : "GRID"}</Text>
            </Pressable>
          )}
          <Pressable style={styles.topButton} onPress={toggleARMode}>
            <Text style={styles.topButtonText}>{arMode === "live" ? "VIRTUAL" : "LIVE"}</Text>
          </Pressable>
        </View>
      </Animated.View>

      {!uiVisible && stage !== "calibrated" && (
        <>
          <Pressable style={[styles.minimalShowButton, { top: insets.top + 12 }]} onPress={() => setUiVisible(true)}>
            <Text style={styles.minimalShowButtonText}>SHOW</Text>
          </Pressable>

          <View style={[styles.minimalCalibrationPanel, { bottom: insets.bottom + 100 }]}>
            <Text style={styles.minimalCalibrationText}>{stage === "black" ? "Point at BLACK spot" : "Point at PINK spot"}</Text>
            <Pressable
              style={[styles.minimalCaptureButton, !crosshairPoint && styles.captureButtonDisabled]}
              onPress={() => capture()}
              disabled={!crosshairPoint}
            >
              <Text style={styles.minimalCaptureText}>{crosshairPoint ? "Capture" : "Aim at table"}</Text>
            </Pressable>
          </View>
        </>
      )}

      {!uiVisible && stage === "calibrated" && (
        <>
          <Pressable style={[styles.minimalShowButton, { top: insets.top + 12 }]} onPress={() => setUiVisible(true)}>
            <Text style={styles.minimalShowButtonText}>SHOW</Text>
          </Pressable>

          {store.markers.length > 0 && (
            <View style={[styles.minimalCountBadge, { top: insets.top + 12, right: 12 }]}>
              <Text style={styles.minimalCountText}>{store.markers.length}</Text>
            </View>
          )}

          <Pressable style={[styles.minimalDoneButton, { top: insets.top + 12, right: store.markers.length > 0 ? 56 : 12 }]} onPress={() => endAndReturn()}>
            <Text style={styles.minimalDoneText}>Done</Text>
          </Pressable>

          <View style={[styles.minimalPlaceRow, { bottom: insets.bottom + 90 }]}>
            {store.markers.length > 0 && (
              <Pressable style={styles.minimalUndoRowButton} onPress={() => undoLastMarker()}>
                <Text style={styles.minimalUndoRowText}>Undo</Text>
              </Pressable>
            )}

            <Animated.View style={{ transform: [{ scale: placeScaleAnim }] }}>
              <Pressable
                style={[styles.minimalPlaceCircle, !crosshairPoint && styles.captureButtonDisabled]}
                onPress={() => { if (crosshairPoint) placeMarkerAtCrosshair(); }}
                disabled={!crosshairPoint}
              >
                <View style={[styles.minimalPlaceCircleInner, { backgroundColor: selectedBallHex + "25" }]}>
                  <View style={[styles.minimalPlaceCircleDot, { backgroundColor: selectedBallHex }]} />
                </View>
              </Pressable>
            </Animated.View>
          </View>

          <View style={[styles.minimalPanel, { bottom: insets.bottom + 16 }]}>
            <View style={styles.minimalBallRow}>
              {BALL_COLORS.map((item) => (
                <Pressable
                  key={item.color}
                  style={[styles.minimalBallButton, store.selectedBallColor === item.color && styles.minimalBallButtonActive]}
                  onPress={() => store.setSelectedBallColor(item.color)}
                >
                  <View style={[styles.minimalBallDot, { backgroundColor: BALL_HEX[item.color] }]} />
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {showErrorPopup && (
        <Pressable style={styles.errorPopupOverlay} onPress={() => setShowErrorPopup(false)}>
          <View style={styles.errorPopupCard}>
            <Text style={styles.errorPopupTitle}>Unable to Place</Text>
            <Text style={styles.errorPopupMessage}>{errorMessage}</Text>
            <Pressable style={styles.errorPopupButton} onPress={() => { setShowErrorPopup(false); triggerHaptic("light"); }}>
              <Text style={styles.errorPopupButtonText}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      <Animated.View
        style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12, opacity: fadeAnim, transform: [{ translateY: bottomPanelTranslateY }] }]}
        pointerEvents={uiVisible ? "auto" : "none"}
      >
        {stage !== "calibrated" && (
          <>
            <Text style={styles.stageText}>
              {arMode === "virtual" ? "Virtual mode: no table needed" : stage === "black" ? "Point at the BLACK spot" : "Point at the PINK spot"}
            </Text>
            <Text style={styles.metricsText}>
              {arMode === "virtual" ? `Scale ${virtualScale.toFixed(2)}x` : calibration ? `Quality ${calibration.scanQuality}%` : crosshairPoint ? "Tap capture to mark" : "Aim at table surface"}
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

            {arMode === "virtual" && (
              <View style={styles.tuneRowCompact}>
                <Pressable style={styles.tuneButtonSmall} onPress={() => setVirtualScale((prev) => Math.max(0.25, Number((prev - 0.05).toFixed(2))))}>
                  <Text style={styles.tuneButtonTextSmall}>−</Text>
                </Pressable>
                <Text style={styles.tuneLabel}>Scale</Text>
                <Pressable style={styles.tuneButtonSmall} onPress={() => setVirtualScale((prev) => Math.min(1, Number((prev + 0.05).toFixed(2))))}>
                  <Text style={styles.tuneButtonTextSmall}>+</Text>
                </Pressable>
              </View>
            )}

            {scanError && <Text style={styles.errorText}>{scanError}</Text>}

            {pendingCalibration && stage === "pink" && (
              <View style={styles.pendingCalibrationRow}>
                <Pressable style={styles.actionButtonSecondary} onPress={resetCalibration}>
                  <Text style={styles.actionButtonSecondaryText}>Re-scan</Text>
                </Pressable>
                <Pressable style={styles.actionButtonPrimary} onPress={acceptPendingCalibration}>
                  <Text style={styles.actionButtonPrimaryText}>Use & Tune</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.actionRow}>
              {arMode === "live" && (
                <>
                  <Pressable style={styles.actionButtonSecondary} onPress={() => resetCalibration()}>
                    <Text style={styles.actionButtonSecondaryText}>Reset</Text>
                  </Pressable>
                  <Pressable style={[styles.captureButtonLarge, !crosshairPoint && styles.captureButtonDisabled]} onPress={() => capture()} disabled={!crosshairPoint}>
                    <Text style={styles.captureButtonLargeText}>Capture {stage === "black" ? "BLACK" : "PINK"}</Text>
                  </Pressable>
                </>
              )}
              {arMode === "virtual" && (
                <Pressable style={styles.actionButtonPrimary} onPress={() => setStage("calibrated")}>
                  <Text style={styles.actionButtonPrimaryText}>Start Placing</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {stage === "calibrated" && (
          <>
            {arMode === "live" && (
              <View style={styles.tunePanel}>
                <Text style={styles.tuneTitle}>Table alignment tuning</Text>
                <View style={styles.tuneRowCompact}>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setOffsetAlong((prev) => Number((prev - 0.03).toFixed(2)))}>
                    <Text style={styles.tuneButtonTextSmall}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setOffsetAlong((prev) => Number((prev + 0.03).toFixed(2)))}>
                    <Text style={styles.tuneButtonTextSmall}>Fwd</Text>
                  </Pressable>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setOffsetAcross((prev) => Number((prev - 0.03).toFixed(2)))}>
                    <Text style={styles.tuneButtonTextSmall}>Left</Text>
                  </Pressable>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setOffsetAcross((prev) => Number((prev + 0.03).toFixed(2)))}>
                    <Text style={styles.tuneButtonTextSmall}>Right</Text>
                  </Pressable>
                </View>
                <View style={styles.tuneRowCompact}>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setRotationDeg((prev) => Math.max(-12, prev - 1))}>
                    <Text style={styles.tuneButtonTextSmall}>Rot-</Text>
                  </Pressable>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setRotationDeg((prev) => Math.min(12, prev + 1))}>
                    <Text style={styles.tuneButtonTextSmall}>Rot+</Text>
                  </Pressable>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setScaleFactor((prev) => Math.max(0.88, Number((prev - 0.01).toFixed(2))))}>
                    <Text style={styles.tuneButtonTextSmall}>Scale-</Text>
                  </Pressable>
                  <Pressable style={styles.tuneButtonSmall} onPress={() => setScaleFactor((prev) => Math.min(1.12, Number((prev + 0.01).toFixed(2))))}>
                    <Text style={styles.tuneButtonTextSmall}>Scale+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.ballSelectorWrap}>
              <View style={[styles.ballSelectorRow, { width: ballSelectorWidth }]}>
                {BALL_COLORS.map((item) => (
                  <Pressable
                    key={item.color}
                    style={[styles.ballChip, store.selectedBallColor === item.color && styles.ballChipActive]}
                    onPress={() => store.setSelectedBallColor(item.color)}
                  >
                    <View style={[styles.ballDot, { backgroundColor: BALL_HEX[item.color] }]} />
                  </Pressable>
                ))}
              </View>
            </View>

            {store.markers.length > 0 && (
              <View style={styles.markersInfo}>
                <Text style={styles.markersCount}>{store.markers.length} marker{store.markers.length !== 1 ? "s" : ""}</Text>
                <Pressable onPress={() => store.clearMarkers()}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </Pressable>
              </View>
            )}

            {!hasPlacedMarker && <Text style={styles.helperText}>Aim and tap Place to add marker</Text>}
            {hasPlacedMarker && crosshairPoint && <Text style={styles.helperTextSubtle}>Place {store.selectedBallColor}</Text>}

            {scanError && <Text style={styles.errorText}>{scanError}</Text>}

            <View style={styles.actionRow}>
              {store.markers.length > 0 && (
                <Pressable style={styles.actionButtonSecondary} onPress={() => undoLastMarker()}>
                  <Text style={styles.actionButtonSecondaryText}>Undo</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.placeButton, !crosshairPoint && styles.captureButtonDisabled, { borderColor: selectedBallHex }]}
                onPress={() => { if (crosshairPoint) placeMarkerAtCrosshair(); }}
              >
                <View style={[styles.placeButtonInner, { backgroundColor: selectedBallHex + "20" }]}>
                  <View style={[styles.placeButtonDot, { backgroundColor: selectedBallHex }]} />
                  <Text style={styles.placeButtonText}>Place</Text>
                </View>
              </Pressable>
              <Pressable style={styles.actionButtonPrimary} onPress={() => endAndReturn()}>
                <Text style={styles.actionButtonPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>
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
  reticleRing: { width: 56, height: 56, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", backgroundColor: "rgba(255,255,255,0.03)", alignItems: "center", justifyContent: "center" },
  reticleRingActive: { width: 50, height: 50, borderRadius: 999, borderWidth: 2.5, borderColor: "rgba(110,224,177,0.85)", backgroundColor: "rgba(110,224,177,0.06)", alignItems: "center", justifyContent: "center" },
  reticleDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: "#FFFFFF" },
  reticleLineHorizontal: { position: "absolute", width: 16, height: 1.5, backgroundColor: "#FFFFFF" },
  reticleLineVertical: { position: "absolute", height: 16, width: 1.5, backgroundColor: "#FFFFFF" },
  reticleLineDim: { opacity: 0.35 },
  reticleLabel: { marginTop: 6, color: "#E5E7EB", fontSize: 10, fontWeight: "700", letterSpacing: 0.3, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },

  topBar: { position: "absolute", top: 0, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  topButtons: { flexDirection: "row", gap: 6 },
  topButton: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  topButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  bottomPanel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: "rgba(8,12,20,0.92)", borderTopLeftRadius: 20, borderTopRightRadius: 20 },

  stageText: { color: "#FFFFFF", textAlign: "center", fontSize: 14, fontWeight: "700", marginBottom: 3 },
  metricsText: { color: "#9CA3AF", textAlign: "center", fontSize: 12, marginBottom: 8 },
  helperText: { color: "#6EE0B1", textAlign: "center", fontSize: 12, fontWeight: "600", marginBottom: 5 },
  helperTextSubtle: { color: "#9CA3AF", textAlign: "center", fontSize: 11, fontWeight: "600", marginBottom: 5 },
  errorText: { color: "#FCA5A5", textAlign: "center", fontSize: 11, marginTop: 5, marginBottom: 5 },
  qualityPill: {
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },
  qualityPoor: { backgroundColor: "rgba(239,68,68,0.15)", color: "#FCA5A5" },
  qualityUsable: { backgroundColor: "rgba(245,158,11,0.14)", color: "#FCD34D" },
  qualityGood: { backgroundColor: "rgba(59,130,246,0.14)", color: "#93C5FD" },
  qualityLocked: { backgroundColor: "rgba(16,185,129,0.16)", color: "#6EE7B7" },

  tuneRowCompact: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 8, marginBottom: 8 },
  tuneButtonSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  tuneButtonTextSmall: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  tuneLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "600" },

  ballSelectorWrap: { alignItems: "center", marginBottom: 8 },
  ballSelectorRow: { flexDirection: "row", gap: 6 },
  ballChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  ballChipActive: { borderColor: "rgba(110,224,177,0.85)", backgroundColor: "rgba(110,224,177,0.1)" },
  ballDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },

  markersInfo: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14, marginBottom: 5 },
  markersCount: { color: "#E5E7EB", fontSize: 12, fontWeight: "600" },
  clearAllText: { color: "#F87171", fontSize: 11, fontWeight: "700" },

  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  pendingCalibrationRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 6 },
  actionButtonSecondary: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  actionButtonSecondaryText: { color: "#D1D5DB", fontSize: 13, fontWeight: "700" },
  actionButtonDisabled: { opacity: 0.4 },
  actionButtonTextDisabled: { color: "#6B7280" },
  actionButtonPrimary: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, backgroundColor: "rgba(110,224,177,0.18)", borderWidth: 1, borderColor: "rgba(110,224,177,0.45)" },
  actionButtonPrimaryText: { color: "#6EE0B1", fontSize: 13, fontWeight: "800" },

  captureButtonLarge: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  captureButtonLargeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  captureButtonDisabled: { opacity: 0.4 },

  placeButton: { flex: 1, borderRadius: 12, borderWidth: 2, overflow: "hidden" },
  placeButtonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  placeButtonDot: { width: 14, height: 14, borderRadius: 7 },
  placeButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  tunePanel: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 8,
    backgroundColor: "rgba(7,12,20,0.65)",
  },
  tuneTitle: {
    color: "#E5E7EB",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },

  minimalShowButton: { position: "absolute", left: 16, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(8,12,20,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  minimalShowButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  minimalCountBadge: { position: "absolute", backgroundColor: "rgba(110,224,177,0.22)", borderWidth: 1, borderColor: "rgba(110,224,177,0.55)", borderRadius: 14, minWidth: 32, height: 28, alignItems: "center", justifyContent: "center" },
  minimalCountText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  minimalDoneButton: { position: "absolute", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(110,224,177,0.18)", borderWidth: 1, borderColor: "rgba(110,224,177,0.45)" },
  minimalDoneText: { color: "#6EE0B1", fontSize: 12, fontWeight: "700" },

  minimalCalibrationPanel: { position: "absolute", left: 16, right: 16, alignItems: "center", backgroundColor: "rgba(8,12,20,0.88)", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14 },
  minimalCalibrationText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  minimalCaptureButton: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 2, borderColor: "#FFFFFF" },
  minimalCaptureText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  minimalPlaceRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  minimalUndoRowButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  minimalUndoDisabled: { opacity: 0.35 },
  minimalUndoRowText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  minimalUndoTextDisabled: { color: "#6B7280" },

  minimalPlaceCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(110,224,177,0.12)", borderWidth: 2.5, borderColor: "rgba(110,224,177,0.6)", alignItems: "center", justifyContent: "center" },
  minimalPlaceCircleInner: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  minimalPlaceCircleDot: { width: 28, height: 28, borderRadius: 14 },

  minimalPanel: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,12,20,0.82)", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  minimalBallRow: { flexDirection: "row", gap: 5 },
  minimalBallButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  minimalBallButtonActive: { borderColor: "rgba(110,224,177,0.85)", backgroundColor: "rgba(110,224,177,0.08)" },
  minimalBallDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },

  errorPopupOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  errorPopupCard: { backgroundColor: "#1A1F2E", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 20, marginHorizontal: 32, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", maxWidth: 300 },
  errorPopupTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  errorPopupMessage: { color: "#9CA3AF", fontSize: 14, textAlign: "center", marginBottom: 16 },
  errorPopupButton: { backgroundColor: "rgba(110,224,177,0.2)", borderWidth: 1, borderColor: "rgba(110,224,177,0.5)", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  errorPopupButtonText: { color: "#6EE0B1", fontSize: 14, fontWeight: "700" },
});
