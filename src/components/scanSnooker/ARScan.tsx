import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SnookerARView, arSupport, type ARAim, type ARBallProp, type ARTracking } from "../../../modules/snooker-ar";
import { useAppTheme } from "../../hooks/useAppTheme";
import { BALL_LOOK, TableDiagram } from "./TableDiagram";
import {
  BALL_LIMIT,
  LANDMARKS,
  calibrationQuality,
  describeCorrection,
  distance,
  frameFromLandmarks,
  tableToWorld,
  type BallColour,
  type Point,
  type TableFrame,
  type WorldPoint,
} from "../../features/scanSnooker/table";
import { ballFromRay, clothFromAim, onTable, tableLines } from "../../features/scanSnooker/ar";
import {
  countOf,
  placeBall,
  removeBall,
  summarise,
  type PlacedBall,
  type RecordedPosition,
} from "../../features/scanSnooker/position";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Scan Snooker through the camera.
 *
 *   find      - the camera finds the cloth (Apple's own guidance shows until it does)
 *   calibrate - aim at two landmarks the player can see, one after the other
 *   check     - the table is drawn over the real one; if it lines up, carry on
 *   scan      - aim at each ball and add it; a diagram of what has been scanned builds alongside
 *   replace   - ghosts show where each ball was; aim at a real ball to see which way to move it
 *
 * Positions go in and out in table millimetres (see features/scanSnooker), so what is scanned
 * here is the same position the diagram shows and edits.
 */

type Phase = "find" | "calibrate" | "check" | "scan" | "replace";
type Tap = { landmarkId: string; world: WorldPoint };

const TRAY: BallColour[] = ["cue", "red", "yellow", "green", "brown", "blue", "pink", "black"];

/** Within this, a ball counts as back in place: about what the camera can tell apart. */
const IN_PLACE_MM = 12;

const QUALITY_TEXT = {
  good: "Good fit",
  fair: "Fair fit: check the lines, or redo",
  poor: "Poor fit: redo, aiming at each centre",
};
const QUALITY_COLOUR = { good: "#6FE3A8", fair: "#F2C230", poor: "#FF8A8A" };

const TRACKING_TEXT: Record<string, string> = {
  excessiveMotion: "Slow down: move the phone more gently.",
  insufficientFeatures: "Not enough detail in view. Turn the table lights up or include a cushion.",
  initializing: "Getting ready. Move the phone slowly over the table.",
  relocalizing: "Finding its place again. Point back at the table.",
  interrupted: "The camera was interrupted. Point back at the table.",
};

type Props = {
  intent: "record" | "replace";
  saved?: RecordedPosition;
  onSave: (balls: PlacedBall[]) => void;
  onUseDiagram: () => void;
  /** Back to the match. */
  onClose: () => void;
};

export const ARScan = ({ intent, saved, onSave, onUseDiagram, onClose }: Props) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Eight balls in the tray on any phone: 30pt where there is room, smaller on an SE.
  const { width } = useWindowDimensions();
  const trayBall = Math.min(30, Math.floor((width - SPACING.md * 2 - 24 - 7 * 8) / 8));
  const lidar = useMemo(() => arSupport().lidar, []);

  const [phase, setPhase] = useState<Phase>("find");
  const [tracking, setTracking] = useState<ARTracking>({ state: "limited", reason: "initializing" });
  const [aim, setAim] = useState<ARAim | null>(null);
  const [landmarks, setLandmarks] = useState<[string, string]>(["black-spot", "brown-spot"]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [frame, setFrame] = useState<TableFrame | null>(null);
  const [balls, setBalls] = useState<PlacedBall[]>(intent === "record" && saved ? saved.balls : []);
  const [colour, setColour] = useState<BallColour>("cue");
  const [checking, setChecking] = useState<BallColour>("cue");
  const [pickingLandmark, setPickingLandmark] = useState<0 | 1 | null>(null);
  const [showDiagram, setShowDiagram] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The tip under each step's title shows at first, and a tap on the title hides or brings it back.
  const [showTip, setShowTip] = useState(true);

  const landmark = (id: string) => LANDMARKS.find((item) => item.id === id)!;
  const current = taps.length < 2 ? landmark(landmarks[taps.length]) : null;
  const target = phase === "replace" ? (saved?.balls ?? []) : balls;

  // ---------------------------------------------------------------- what the crosshair is on
  const ray = aim?.ok && aim.origin && aim.direction ? { origin: aim.origin, direction: aim.direction } : null;
  const aimedBall: Point | null = frame && ray ? ballFromRay(frame, ray) : null;
  const aimedOnTable = aimedBall ? onTable(aimedBall) : false;

  // In replace, the ball being checked is the recorded one of that colour nearest the crosshair.
  const checkTarget = useMemo(() => {
    if (phase !== "replace" || !aimedBall) return null;
    const candidates = (saved?.balls ?? []).filter((ball) => ball.colour === checking);
    return candidates.sort((a, b) => distance(a, aimedBall) - distance(b, aimedBall))[0] ?? null;
  }, [aimedBall, checking, phase, saved]);

  // ---------------------------------------------------------------- calibrating
  const setLandmark = () => {
    if (!current) return;
    const world = aim ? clothFromAim(aim, taps[0]?.world.y) : null;
    if (!world) {
      setNotice("Aim the cross at the table itself, then tap Set.");
      return;
    }
    setNotice(null);
    const next = [...taps, { landmarkId: current.id, world }];
    setTaps(next);
    if (next.length === 2) {
      const built = frameFromLandmarks(
        { table: landmark(next[0].landmarkId).point, world: next[0].world },
        { table: landmark(next[1].landmarkId).point, world: next[1].world }
      );
      setFrame(built);
      setPhase("check");
    }
  };

  const redoCalibration = () => {
    setTaps([]);
    setFrame(null);
    setPhase("calibrate");
  };

  // ---------------------------------------------------------------- scanning
  const addAimedBall = (point: Point | null) => {
    if (!point || !onTable(point)) {
      setNotice("Aim the cross at the middle of a ball on the table.");
      return;
    }
    const result = placeBall(balls, colour, point);
    if (result.refused) {
      setNotice(result.refused);
      return;
    }
    setNotice(null);
    setBalls(result.balls);
    if (colour === "cue") setColour("red");
  };

  const onTapPoint = (event: { nativeEvent: ARAim }) => {
    if (phase !== "scan" || !frame) return;
    const tapped = event.nativeEvent;
    const tapRay =
      tapped.ok && tapped.origin && tapped.direction ? { origin: tapped.origin, direction: tapped.direction } : null;
    addAimedBall(tapRay ? ballFromRay(frame, tapRay) : null);
  };

  // ---------------------------------------------------------------- what the camera draws
  const lines = useMemo(() => (frame && phase !== "calibrate" ? tableLines(frame) : []), [frame, phase]);

  const drawn = useMemo<ARBallProp[]>(() => {
    const markers: ARBallProp[] = taps.map((tap, index) => ({
      id: `landmark-${index}`,
      colour: "#FFFFFF",
      ...tap.world,
      kind: "marker",
    }));
    if (!frame) return markers;
    if (phase === "replace") {
      return (saved?.balls ?? []).map((ball) => ({
        id: ball.id,
        colour: BALL_LOOK[ball.colour].fill,
        ...tableToWorld(frame, ball),
        kind: "ghost",
        highlighted: ball.id === checkTarget?.id,
      }));
    }
    if (phase === "scan") {
      return balls.map((ball) => ({
        id: ball.id,
        colour: BALL_LOOK[ball.colour].fill,
        ...tableToWorld(frame, ball),
        kind: "tag",
      }));
    }
    return markers;
  }, [balls, checkTarget?.id, frame, phase, saved, taps]);

  // ---------------------------------------------------------------- the words at the top
  const quality = frame ? calibrationQuality(frame.errorMm) : null;
  const step = (() => {
    switch (phase) {
      case "find":
        return { title: "Find the table", tip: "Point at the cloth and move the phone slowly." };
      case "calibrate":
        return {
          title: `Aim at the ${current?.label.toLowerCase()}`,
          tip: `Point ${taps.length + 1} of 2. Put the cross on its centre and tap the button. Any landmark you can see will do.`,
        };
      case "check":
        return {
          title: "Does it line up?",
          tip: "The white lines should sit on the cushions, the baulk line and the D.",
        };
      case "scan":
        return {
          title: "Scan the balls",
          tip: "Choose a ball, put the cross on its middle and tap the button, or tap the ball on screen.",
        };
      default:
        return {
          title: "Put the balls back",
          tip: "Choose a ball and aim at the real one to see which way to move it.",
        };
    }
  })();

  const trackingProblem = tracking.state !== "normal" && phase !== "find" ? TRACKING_TEXT[tracking.reason] : null;
  const guidance =
    phase === "replace" && aimedBall && checkTarget
      ? distance(aimedBall, checkTarget) <= IN_PLACE_MM
        ? "In place"
        : describeCorrection(aimedBall, checkTarget)
      : null;
  // One line under the title: a problem first, then the fit, then the tip if asked for.
  const subline =
    notice ??
    trackingProblem ??
    (phase === "check" && quality
      ? `${QUALITY_TEXT[quality]} · ${Math.round(frame!.errorMm / 10)} cm out${lidar ? "" : " · no LiDAR"}`
      : showTip
        ? step.tip
        : null);
  const sublineTone =
    notice || trackingProblem
      ? "#F2C230"
      : phase === "check" && quality
        ? QUALITY_COLOUR[quality]
        : "rgba(255,255,255,0.8)";

  const undoLast = () => {
    const last = balls[balls.length - 1];
    if (last) setBalls(removeBall(balls, last.id));
  };

  // The shutter does the one thing each step is for.
  const shutter =
    phase === "calibrate"
      ? {
          icon: "crosshairs-gps" as const,
          label: `Set the ${current?.label.toLowerCase()}`,
          onPress: setLandmark,
          fill: undefined,
        }
      : phase === "check"
        ? {
            icon: "check" as const,
            label: "The lines line up",
            onPress: () => setPhase(intent === "replace" && saved ? "replace" : "scan"),
            fill: undefined,
          }
        : phase === "scan"
          ? {
              icon: "plus" as const,
              label: `Add the ${BALL_LOOK[colour].label.toLowerCase()}`,
              onPress: () => addAimedBall(aimedBall),
              fill: BALL_LOOK[colour].fill,
            }
          : null;

  if (!SnookerARView) return null;

  return (
    <View style={styles.screen}>
      <SnookerARView
        style={StyleSheet.absoluteFill}
        balls={drawn}
        lines={lines}
        onTracking={(event) => setTracking(event.nativeEvent)}
        onPlane={() => setPhase((value) => (value === "find" ? "calibrate" : value))}
        onAim={(event) => setAim(event.nativeEvent)}
        onTapPoint={onTapPoint}
      />

      {/* ------------------------------------------------ the crosshair */}
      {phase === "calibrate" || phase === "scan" || phase === "replace" ? (
        <View pointerEvents="none" style={styles.crosshairWrap}>
          <View
            style={[styles.crosshair, { borderColor: aim?.hit || aimedOnTable ? "#FFFFFF" : "rgba(255,255,255,0.45)" }]}
          />
          <View style={styles.crossH} />
          <View style={styles.crossV} />
        </View>
      ) : null}

      {/* ------------------------------------------------ top: close, the step, the diagram */}
      <View style={[styles.top, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back to the match"
          hitSlop={8}
          style={styles.round}
        >
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

        {(phase === "scan" || phase === "replace") && target.length ? (
          <Pressable
            onPress={() => setShowDiagram(true)}
            accessibilityRole="button"
            accessibilityLabel="Show the diagram"
            style={styles.miniDiagram}
          >
            <TableDiagram balls={target} readOnly />
          </Pressable>
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>

      {/* ------------------------------------------------ bottom: the balls and the controls */}
      <View style={[styles.bottom, { bottom: insets.bottom + SPACING.md }]} pointerEvents="box-none">
        {phase === "calibrate" && current ? (
          <Pressable
            onPress={() => setPickingLandmark(taps.length as 0 | 1)}
            accessibilityRole="button"
            accessibilityLabel={`Landmark: ${current.label}. Change`}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{current.label}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {phase === "replace" ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {guidance
                ? guidance === "In place"
                  ? `${BALL_LOOK[checking].label} in place`
                  : `Move it ${guidance}`
                : `Aim at the real ${BALL_LOOK[checking].label.toLowerCase()}`}
            </Text>
          </View>
        ) : null}

        {phase === "scan" || (phase === "replace" && saved) ? (
          <View style={styles.tray}>
            {(phase === "scan" ? TRAY : TRAY.filter((item) => countOf(saved!.balls, item) > 0)).map((item) => {
              const active = phase === "scan" ? colour === item : checking === item;
              const count = countOf(balls, item);
              return (
                <Pressable
                  key={item}
                  onPress={() => (phase === "scan" ? setColour(item) : setChecking(item))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${BALL_LOOK[item].label}${phase === "scan" && item === "red" ? `, ${count} of 15` : ""}`}
                  hitSlop={4}
                  style={[
                    styles.trayBall,
                    {
                      width: trayBall,
                      height: trayBall,
                      borderRadius: trayBall / 2,
                      backgroundColor: BALL_LOOK[item].fill,
                      borderColor: active ? "#FFFFFF" : "rgba(255,255,255,0.25)",
                    },
                  ]}
                >
                  {phase === "scan" && item === "red" && count ? (
                    <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={styles.redCount}>
                      {count}
                    </Text>
                  ) : phase === "scan" && item !== "red" && count >= BALL_LIMIT[item] ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={14}
                      color={item === "cue" || item === "yellow" || item === "pink" ? "#1A1E20" : "#FFFFFF"}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.controls}>
          {/* left */}
          <View style={styles.side}>
            {phase === "scan" ? (
              <Pressable
                onPress={undoLast}
                disabled={!balls.length}
                accessibilityRole="button"
                accessibilityLabel="Undo the last ball"
                style={[styles.round, { opacity: balls.length ? 1 : 0.35 }]}
              >
                <MaterialCommunityIcons name="undo" size={22} color="#FFFFFF" />
              </Pressable>
            ) : phase === "check" ? (
              <Pressable
                onPress={redoCalibration}
                accessibilityRole="button"
                accessibilityLabel="Redo the calibration"
                style={styles.round}
              >
                <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {/* the shutter */}
          {shutter ? (
            <Pressable
              onPress={shutter.onPress}
              accessibilityRole="button"
              accessibilityLabel={shutter.label}
              style={styles.shutter}
            >
              <View style={[styles.shutterInner, { backgroundColor: shutter.fill ?? colors.primary }]}>
                <MaterialCommunityIcons
                  name={shutter.icon}
                  size={30}
                  color={
                    shutter.fill && (colour === "cue" || colour === "yellow" || colour === "pink")
                      ? "#1A1E20"
                      : "#FFFFFF"
                  }
                />
              </View>
            </Pressable>
          ) : phase === "find" ? (
            <Pressable onPress={onUseDiagram} accessibilityRole="button" style={styles.textButton}>
              <Text style={styles.textButtonText}>Use the diagram instead</Text>
            </Pressable>
          ) : (
            <View style={styles.shutterSpacer} />
          )}

          {/* right */}
          <View style={styles.side}>
            {phase === "scan" ? (
              <Pressable
                onPress={() => (balls.length ? onSave(balls) : setNotice("Scan at least the cue ball first."))}
                accessibilityRole="button"
                accessibilityLabel="Save the position"
                style={[styles.round, balls.length ? { backgroundColor: colors.primary } : null]}
              >
                <MaterialCommunityIcons name="content-save-outline" size={22} color="#FFFFFF" />
              </Pressable>
            ) : phase === "replace" ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Done, back to the match"
                style={[styles.round, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons name="check" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* ------------------------------------------------ choosing a landmark */}
      <Modal
        visible={pickingLandmark !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickingLandmark(null)}
      >
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Which landmark?</Text>
            <Pressable
              onPress={() => setPickingLandmark(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
            >
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
                {landmarks[pickingLandmark ?? 0] === item.id ? (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* ------------------------------------------------ the diagram, full size */}
      <Modal
        visible={showDiagram}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDiagram(false)}
      >
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{summarise(target)}</Text>
            <Pressable
              onPress={() => setShowDiagram(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.flex}>
            <TableDiagram balls={target} readOnly />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CROSS = 44;
const ROUND = 48;
const SHUTTER = 76;
/** Glass over the camera: dark enough for white text on any background, light enough to see through. */
const GLASS = "rgba(10,18,15,0.55)";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },

  crosshairWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  crosshair: { width: CROSS, height: CROSS, borderRadius: CROSS / 2, borderWidth: 2 },
  crossH: { position: "absolute", width: 14, height: 2, backgroundColor: "#FFFFFF" },
  crossV: { position: "absolute", width: 2, height: 14, backgroundColor: "#FFFFFF" },

  top: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  round: {
    width: ROUND,
    height: ROUND,
    borderRadius: ROUND / 2,
    backgroundColor: GLASS,
    alignItems: "center",
    justifyContent: "center",
  },
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
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: GLASS,
    paddingHorizontal: SPACING.lg,
  },
  chipText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  tray: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: GLASS,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trayBall: { borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  redCount: { color: "#FFFFFF", fontFamily: FONTS.board, fontSize: 13 },

  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  side: { width: ROUND + 16, alignItems: "center" },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: SHUTTER / 2,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: SHUTTER - 16,
    height: SHUTTER - 16,
    borderRadius: (SHUTTER - 16) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterSpacer: { width: SHUTTER, height: SHUTTER },
  textButton: {
    minHeight: HIT_TARGET,
    borderRadius: 22,
    backgroundColor: GLASS,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  textButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

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
