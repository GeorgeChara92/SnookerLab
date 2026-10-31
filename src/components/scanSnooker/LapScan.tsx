import React, { useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SnookerARView,
  arSupport,
  type ARAim,
  type ARBallProp,
  type ARLapFrame,
  type ARLapTable,
  type ARMarkerMoved,
  type ARTracking,
} from "../../../modules/snooker-ar";
import { useAppTheme } from "../../hooks/useAppTheme";
import { BALL_LOOK, TableDiagram } from "./TableDiagram";
import {
  BALL_RADIUS,
  LANDMARKS,
  TABLE,
  calibrationQuality,
  describeScale,
  frameFromLandmarks,
  tableToWorld,
  type TableFrame,
  type WorldPoint,
} from "../../features/scanSnooker/table";
import { clothFromAim, rayAtHeight, tableLines } from "../../features/scanSnooker/ar";
import { AimStabiliser, type Stability } from "../../features/scanSnooker/stabilize";
import { LAP_COMPLETE, LAP_SECTORS, LapTracker, type LapBall } from "../../features/scanSnooker/lap";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Record a Snooker through the camera: calibrate as Scan Snooker does, then walk once round the
 * table and the balls are found along the way.
 *
 *   find      - the camera finds the cloth (Apple's own guidance shows until it does)
 *   calibrate - aim at two spots the player can see, one after the other
 *   check     - the table is drawn over the real one; if it lines up, carry on
 *   lap       - walk round the table; a marker lands on each ball as enough views agree on it
 *
 * This is apart from `ARScan` on purpose, while the lap is being tested. The balls come out as
 * table millimetres, the same as a scanned position, for the player to check and correct.
 */

type Phase = "find" | "calibrate" | "check" | "lap";
type Tap = { landmarkId: string; world: WorldPoint };

const QUALITY_TEXT = {
  good: "Good fit",
  fair: "Fair fit: check the lines, or redo",
  poor: "Poor fit: redo, aiming at each centre",
};
const QUALITY_COLOUR = { good: "#6FE3A8", fair: "#F2C230", poor: "#FF8A8A" };

const OFF_CLOTH_TEXT = "No snooker cloth in view. Point the phone down at the table.";

const TRACKING_TEXT: Record<string, string> = {
  excessiveMotion: "Slow down: move the phone more gently.",
  insufficientFeatures: "Not enough detail in view. Turn the table lights up or include a cushion.",
  initializing: "Getting ready. Move the phone slowly over the table.",
  relocalizing: "Finding its place again. Point back at the table.",
  interrupted: "The camera was interrupted. Point back at the table.",
};

type Props = {
  /** The lap is over: what it found, and the report of how it went. */
  onFinish: (balls: LapBall[], report: string) => void;
  onClose: () => void;
};

export const LapScan = ({ onFinish, onClose }: Props) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const lidar = useMemo(() => arSupport().lidar, []);

  const [phase, setPhase] = useState<Phase>("find");
  const [tracking, setTracking] = useState<ARTracking>({ state: "limited", reason: "initializing" });
  const [aim, setAim] = useState<ARAim | null>(null);
  const [landmarks, setLandmarks] = useState<[string, string]>(["black-spot", "pink-spot"]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [pickingLandmark, setPickingLandmark] = useState<0 | 1 | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(true);
  const stabiliser = useRef(new AimStabiliser()).current;
  const [stability, setStability] = useState<Stability>({ progress: 0, locked: null });

  // A fresh tracker for each lap; what it has found is copied out for drawing as each look comes in.
  const tracker = useRef(new LapTracker());
  const [balls, setBalls] = useState<LapBall[]>([]);
  const [walked, setWalked] = useState(0);
  const [offCloth, setOffCloth] = useState(false);

  const landmark = (id: string) => LANDMARKS.find((item) => item.id === id)!;
  const current = taps.length < 2 ? landmark(landmarks[taps.length]) : null;

  // Rebuilt whenever ARKit corrects either marker, for the same reason as in `ARScan`.
  const frame = useMemo<TableFrame | null>(
    () =>
      taps.length === 2
        ? frameFromLandmarks(
            { table: landmark(taps[0].landmarkId).point, world: taps[0].world },
            { table: landmark(taps[1].landmarkId).point, world: taps[1].world }
          )
        : null,
    [taps]
  );

  const onAim = (event: { nativeEvent: ARAim }) => {
    const next = event.nativeEvent;
    setAim(next);
    const world =
      tracking.state !== "normal"
        ? null
        : phase === "calibrate"
          ? clothFromAim(next, taps[0]?.world.y)
          : frame && next.ok && next.origin && next.direction
            ? rayAtHeight({ origin: next.origin, direction: next.direction }, frame.height + BALL_RADIUS / 1000)
            : null;
    setStability(stabiliser.update(world, Date.now()));
  };

  // ---------------------------------------------------------------- calibrating
  const setLandmark = () => {
    if (!current) return;
    if (tracking.state !== "normal") {
      setNotice("Wait for tracking to settle, then aim and try again.");
      return;
    }
    const world = stability.locked ?? (aim ? clothFromAim(aim, taps[0]?.world.y) : null);
    if (!world) {
      setNotice("Aim the cross at the table itself, then tap Set.");
      return;
    }
    setNotice(null);
    stabiliser.reset();
    setStability({ progress: 0, locked: null });
    const next = [...taps, { landmarkId: current.id, world }];
    setTaps(next);
    if (next.length === 2) setPhase("check");
  };

  const onMarkerMoved = (event: { nativeEvent: ARMarkerMoved }) => {
    const { id, x, y, z } = event.nativeEvent;
    const match = /^landmark-(\d)$/.exec(id);
    if (!match) return;
    const index = Number(match[1]);
    setTaps((prev) => (index < prev.length ? prev.map((tap, i) => (i === index ? { ...tap, world: { x, y, z } } : tap)) : prev));
  };

  const redoCalibration = () => {
    stabiliser.reset();
    setStability({ progress: 0, locked: null });
    setTaps([]);
    setNotice(null);
    setPhase("calibrate");
  };

  // ---------------------------------------------------------------- the lap
  const startLap = () => {
    // Everything found is placed through this fit, so a bad one means balls in the wrong places.
    if (frame && calibrationQuality(frame.scale) === "poor") {
      setNotice("That fit is too far out to find balls. Redo it, aiming at each centre.");
      return;
    }
    tracker.current = new LapTracker();
    setBalls([]);
    setWalked(0);
    setOffCloth(false);
    setNotice(null);
    setPhase("lap");
  };

  const onLapFrame = (event: { nativeEvent: ARLapFrame }) => {
    if (phase !== "lap" || !frame) return;
    tracker.current.add(event.nativeEvent, frame);
    setBalls(tracker.current.balls());
    setWalked(tracker.current.coverage());
    setOffCloth(!tracker.current.seeingCloth());
  };

  const finish = () => onFinish(tracker.current.balls(), tracker.current.report(frame, lidar));

  // Only set during the lap, so the camera is not looked through while calibrating.
  const lapTable = useMemo<ARLapTable | null>(
    () =>
      frame && phase === "lap"
        ? {
            originX: frame.origin.x,
            originZ: frame.origin.z,
            angle: frame.angle,
            ballHeight: frame.height + BALL_RADIUS / 1000,
            scale: frame.scale,
            width: TABLE.width / 1000,
            length: TABLE.length / 1000,
          }
        : null,
    [frame, phase]
  );

  // ---------------------------------------------------------------- what the camera draws
  // Left on during the lap: if they slide off the cushions, the markers can't be trusted either.
  const lines = useMemo(() => (frame ? tableLines(frame) : []), [frame]);

  const drawn = useMemo<ARBallProp[]>(() => {
    const markers: ARBallProp[] = taps.map((tap, index) => ({
      id: `landmark-${index}`,
      colour: "#FFFFFF",
      ...tap.world,
      kind: "marker",
    }));
    if (!frame || phase !== "lap") return markers;
    return [
      ...markers,
      ...balls.map((ball) => ({
        id: ball.id,
        colour: BALL_LOOK[ball.colour].fill,
        ...tableToWorld(frame, ball),
        kind: "tag" as const,
      })),
    ];
  }, [balls, frame, phase, taps]);

  // ---------------------------------------------------------------- the words at the top
  const lapDone = walked >= LAP_COMPLETE;
  const quality = frame ? calibrationQuality(frame.scale) : null;
  const step = (() => {
    switch (phase) {
      case "find":
        return { title: "Find the table", tip: "Point at the cloth and move the phone slowly." };
      case "calibrate":
        return {
          title: `Aim at the ${current?.label.toLowerCase()}`,
          tip: `Point ${taps.length + 1} of 2. Put the cross on its centre and tap the button. Any spot you can see will do.`,
        };
      case "check":
        return {
          title: "Does it line up?",
          tip: "The white lines should sit on the cushions, the baulk line and the D.",
        };
      default:
        return lapDone
          ? { title: "Lap done", tip: "Tap the tick to check what was found." }
          : {
              title: "Walk round the table",
              tip: "Go slowly, phone at chest height and tilted down at the balls, all the way round.",
            };
    }
  })();

  const trackingProblem =
    tracking.state !== "normal" && phase !== "find" ? TRACKING_TEXT[tracking.reason] : phase === "lap" && offCloth ? OFF_CLOTH_TEXT : null;
  const subline =
    notice ??
    trackingProblem ??
    (phase === "check" && quality
      ? `${QUALITY_TEXT[quality]} · ${describeScale(frame!.scale)}${lidar ? "" : " · no LiDAR"}`
      : showTip
        ? step.tip
        : null);
  const sublineTone =
    notice || trackingProblem
      ? "#F2C230"
      : phase === "check" && quality
        ? QUALITY_COLOUR[quality]
        : "rgba(255,255,255,0.8)";

  const shutter =
    phase === "calibrate"
      ? { icon: "crosshairs-gps" as const, label: `Set the ${current?.label.toLowerCase()}`, onPress: setLandmark }
      : phase === "check"
        ? { icon: "check" as const, label: "The lines line up, start the lap", onPress: startLap }
        : phase === "lap"
          ? { icon: "check" as const, label: "Finish the lap", onPress: finish }
          : null;

  if (!SnookerARView) return null;

  return (
    <View style={styles.screen}>
      <SnookerARView
        style={StyleSheet.absoluteFill}
        balls={drawn}
        lines={lines}
        lapTable={lapTable}
        onTracking={(event) => setTracking(event.nativeEvent)}
        onPlane={() => setPhase((value) => (value === "find" ? "calibrate" : value))}
        onAim={onAim}
        onMarkerMoved={onMarkerMoved}
        onLapFrame={onLapFrame}
      />

      {/* ------------------------------------------------ the crosshair, for the two spots */}
      {phase === "calibrate" ? (
        <View pointerEvents="none" style={styles.crosshairWrap}>
          <View style={[styles.crosshair, { borderColor: aim?.hit ? "#FFFFFF" : "rgba(255,255,255,0.45)" }]} />
          {stability.progress > 0 ? (
            <View
              style={[
                styles.crosshairFill,
                {
                  opacity: stability.progress,
                  transform: [{ scale: stability.progress }],
                  backgroundColor: stability.locked ? QUALITY_COLOUR.good : "#FFFFFF",
                },
              ]}
            />
          ) : null}
          <View style={styles.crossH} />
          <View style={styles.crossV} />
        </View>
      ) : null}

      {/* ------------------------------------------------ top: close, the step, the diagram */}
      <View style={[styles.top, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Back to the match" hitSlop={8} style={styles.round}>
          <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        <Pressable
          onPress={() => setShowTip((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={`${step.title}. ${step.tip}`}
          accessibilityHint="Shows or hides the tip"
          style={styles.pill}
        >
          <Text style={styles.pillTitle} numberOfLines={1}>
            {step.title}
          </Text>
          {subline ? <Text style={[styles.pillLine, { color: sublineTone }]}>{subline}</Text> : null}
        </Pressable>

        {phase === "lap" ? (
          <View style={styles.miniDiagram} pointerEvents="none">
            <TableDiagram balls={balls} readOnly />
          </View>
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>

      {/* ------------------------------------------------ bottom: progress and the controls */}
      <View style={[styles.bottom, { bottom: insets.bottom + SPACING.md }]} pointerEvents="box-none">
        {phase === "calibrate" && current ? (
          <Pressable
            onPress={() => setPickingLandmark(taps.length as 0 | 1)}
            accessibilityRole="button"
            accessibilityLabel={`Spot: ${current.label}. Change`}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{current.label}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {phase === "lap" ? (
          <View
            style={styles.progress}
            accessibilityRole="progressbar"
            accessibilityLabel={`${balls.length} ${balls.length === 1 ? "ball" : "balls"} found, ${walked} of ${LAP_SECTORS} of the way round`}
          >
            <Text style={styles.progressCount}>{balls.length}</Text>
            <View style={styles.progressBody}>
              <Text style={styles.progressLabel}>{balls.length === 1 ? "ball found" : "balls found"}</Text>
              <View style={styles.progressTrack}>
                {Array.from({ length: LAP_SECTORS }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.progressStep, { backgroundColor: index < walked ? (lapDone ? QUALITY_COLOUR.good : "#FFFFFF") : "rgba(255,255,255,0.25)" }]}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.side}>
            {phase === "check" ? (
              <Pressable onPress={redoCalibration} accessibilityRole="button" accessibilityLabel="Redo the calibration" style={styles.round}>
                <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
              </Pressable>
            ) : phase === "lap" ? (
              <Pressable onPress={startLap} accessibilityRole="button" accessibilityLabel="Start the lap again" style={styles.round}>
                <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {shutter ? (
            <Pressable onPress={shutter.onPress} accessibilityRole="button" accessibilityLabel={shutter.label} style={styles.shutter}>
              <View style={[styles.shutterInner, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name={shutter.icon} size={30} color="#FFFFFF" />
              </View>
            </Pressable>
          ) : (
            <View style={styles.shutterSpacer} />
          )}

          <View style={styles.side}>
            {phase === "lap" ? (
              <Pressable onPress={redoCalibration} accessibilityRole="button" accessibilityLabel="Recalibrate the table" style={styles.round}>
                <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* ------------------------------------------------ choosing a landmark */}
      <Modal visible={pickingLandmark !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickingLandmark(null)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Which spot?</Text>
            <Pressable onPress={() => setPickingLandmark(null)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.sheetHint, { color: colors.textMuted }]}>
            Choose one you can see clearly and that is not under a ball. Two far apart give the best fit.
          </Text>
          <FlatList
            data={LANDMARKS.filter((item) => pickingLandmark !== 1 || item.id !== landmarks[0])}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  const next: [string, string] = [...landmarks] as [string, string];
                  next[pickingLandmark ?? 0] = item.id;
                  setLandmarks(next);
                  setPickingLandmark(null);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetRow,
                  { borderBottomColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                ]}
              >
                <Text style={[styles.sheetRowText, { color: colors.text }]}>{item.label}</Text>
                {landmarks[pickingLandmark ?? 0] === item.id ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};

const CROSS = 44;
const ROUND = 48;
const SHUTTER = 76;
const GLASS = "rgba(10,18,15,0.55)";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },

  crosshairWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  crosshair: { width: CROSS, height: CROSS, borderRadius: CROSS / 2, borderWidth: 2 },
  crosshairFill: { position: "absolute", width: CROSS - 14, height: CROSS - 14, borderRadius: (CROSS - 14) / 2 },
  crossH: { position: "absolute", width: 14, height: 2, backgroundColor: "#FFFFFF" },
  crossV: { position: "absolute", width: 2, height: 14, backgroundColor: "#FFFFFF" },

  top: { position: "absolute", left: SPACING.md, right: SPACING.md, flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  round: { width: ROUND, height: ROUND, borderRadius: ROUND / 2, backgroundColor: GLASS, alignItems: "center", justifyContent: "center" },
  roundSpacer: { width: ROUND },
  pill: {
    flex: 1,
    minHeight: ROUND,
    borderRadius: ROUND / 2,
    backgroundColor: GLASS,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    justifyContent: "center",
  },
  pillTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "center" },
  pillLine: { fontSize: 12, lineHeight: 16, fontWeight: "600", textAlign: "center", marginTop: 2 },
  miniDiagram: { width: 54, height: 104, borderRadius: RADIUS.sm, overflow: "hidden" },

  bottom: { position: "absolute", left: SPACING.md, right: SPACING.md, alignItems: "center", gap: SPACING.md },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, borderRadius: 18, backgroundColor: GLASS, paddingHorizontal: SPACING.lg },
  chipText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  // The lap's score: balls found, on the same board numerals as the rest of the app.
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    alignSelf: "stretch",
    minHeight: HIT_TARGET + 12,
    borderRadius: RADIUS.lg,
    backgroundColor: GLASS,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  progressCount: { color: "#FFFFFF", fontFamily: FONTS.board, fontSize: 34, minWidth: 40, textAlign: "center" },
  progressBody: { flex: 1, gap: 6 },
  progressLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  progressTrack: { flexDirection: "row", gap: 3 },
  progressStep: { flex: 1, height: 6, borderRadius: 2 },

  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  side: { width: ROUND + 16, alignItems: "center" },
  shutter: { width: SHUTTER, height: SHUTTER, borderRadius: SHUTTER / 2, borderWidth: 4, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: SHUTTER - 16, height: SHUTTER - 16, borderRadius: (SHUTTER - 16) / 2, alignItems: "center", justifyContent: "center" },
  shutterSpacer: { width: SHUTTER, height: SHUTTER },

  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 19, fontWeight: "800", flexShrink: 1 },
  sheetHint: { fontSize: 13, lineHeight: 18, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { fontSize: 16 },
});
