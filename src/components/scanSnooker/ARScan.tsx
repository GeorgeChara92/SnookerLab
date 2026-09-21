import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
import { countOf, placeBall, removeBall, summarise, type PlacedBall, type RecordedPosition } from "../../features/scanSnooker/position";
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
  fair: "Fair fit: check the lines, or redo it",
  poor: "Poor fit: redo it, aiming at the centre of each point",
};

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
};

export const ARScan = ({ intent, saved, onSave, onUseDiagram }: Props) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
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

  const landmark = (id: string) => LANDMARKS.find((item) => item.id === id)!;
  const current = taps.length < 2 ? landmark(landmarks[taps.length]) : null;
  const target = phase === "replace" ? saved?.balls ?? [] : balls;

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
    const tapRay = tapped.ok && tapped.origin && tapped.direction ? { origin: tapped.origin, direction: tapped.direction } : null;
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
      return balls.map((ball) => ({ id: ball.id, colour: BALL_LOOK[ball.colour].fill, ...tableToWorld(frame, ball), kind: "tag" }));
    }
    return markers;
  }, [balls, checkTarget?.id, frame, phase, saved, taps]);

  // ---------------------------------------------------------------- the words at the top
  const quality = frame ? calibrationQuality(frame.errorMm) : null;
  const step = (() => {
    switch (phase) {
      case "find":
        return { title: "Find the table", body: "Point the camera at the cloth and move the phone slowly until it finds the surface." };
      case "calibrate":
        return {
          title: `Calibrate: ${taps.length + 1} of 2`,
          body: `Aim the cross at the ${current?.label.toLowerCase()} and tap Set. Any landmark you can see will do.`,
        };
      case "check":
        return { title: "Does it line up?", body: "The white lines should sit on the cushions, the baulk line and the D." };
      case "scan":
        return {
          title: "Scan the balls",
          body: "Choose a ball, aim the cross at its middle and tap Add, or tap the ball on screen.",
        };
      default:
        return {
          title: "Put the balls back",
          body: "Ghosts show where each ball was. Choose a ball and aim at the real one to see which way to move it.",
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
          <View style={[styles.crosshair, { borderColor: aim?.hit || aimedOnTable ? "#FFFFFF" : "rgba(255,255,255,0.45)" }]} />
          <View style={styles.crossH} />
          <View style={styles.crossV} />
        </View>
      ) : null}

      {/* ------------------------------------------------ the step */}
      <View style={[styles.top, { paddingTop: SPACING.sm }]} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: "rgba(8,20,16,0.82)" }]}>
          <Text style={styles.cardTitle}>{step.title}</Text>
          <Text style={styles.cardBody}>{step.body}</Text>
          {trackingProblem ? <Text style={styles.warning}>{trackingProblem}</Text> : null}
          {phase === "check" && quality ? (
            <Text style={[styles.quality, { color: quality === "good" ? "#6FE3A8" : quality === "fair" ? "#F2C230" : "#FF8A8A" }]}>
              {QUALITY_TEXT[quality]} · {Math.round(frame!.errorMm / 10)} cm out{lidar ? "" : " · no LiDAR, expect a few cm"}
            </Text>
          ) : null}
        </View>

        {/* A live diagram of what has been scanned; tap it to see it full size. */}
        {(phase === "scan" || phase === "replace") && target.length ? (
          <Pressable
            onPress={() => setShowDiagram(true)}
            accessibilityRole="button"
            accessibilityLabel="Show the diagram"
            style={styles.miniDiagram}
          >
            <TableDiagram balls={target} readOnly />
          </Pressable>
        ) : null}
      </View>

      {/* ------------------------------------------------ the controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: "rgba(8,20,16,0.88)" }]}>
        {notice ? <Text style={styles.warning}>{notice}</Text> : null}

        {phase === "find" ? (
          <Pressable onPress={onUseDiagram} accessibilityRole="button" style={styles.quiet}>
            <Text style={styles.quietText}>Use the diagram instead</Text>
          </Pressable>
        ) : null}

        {phase === "calibrate" && current ? (
          <>
            <Pressable
              onPress={() => setPickingLandmark(taps.length as 0 | 1)}
              accessibilityRole="button"
              accessibilityLabel={`Landmark: ${current.label}. Change`}
              style={styles.landmark}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={18} color="#FFFFFF" />
              <Text style={styles.landmarkText}>{current.label}</Text>
              <Text style={styles.change}>Change</Text>
            </Pressable>
            <Pressable onPress={setLandmark} accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.primary }]}>
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Set {current.label.toLowerCase()}</Text>
            </Pressable>
          </>
        ) : null}

        {phase === "check" ? (
          <View style={styles.row}>
            <Pressable onPress={redoCalibration} accessibilityRole="button" style={styles.secondary}>
              <Text style={styles.secondaryText}>Redo</Text>
            </Pressable>
            <Pressable
              onPress={() => setPhase(intent === "replace" && saved ? "replace" : "scan")}
              accessibilityRole="button"
              style={[styles.primary, styles.flex, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Lines up</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "scan" ? (
          <>
            <View style={styles.tray}>
              {TRAY.map((item) => {
                const active = colour === item;
                const count = countOf(balls, item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => setColour(item)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${BALL_LOOK[item].label}${item === "red" ? `, ${count} of 15` : count ? ", scanned" : ""}`}
                    style={[styles.trayItem, { borderColor: active ? "#FFFFFF" : "rgba(255,255,255,0.2)" }]}
                  >
                    <View style={[styles.trayBall, { backgroundColor: BALL_LOOK[item].fill, borderColor: BALL_LOOK[item].edge }]} />
                    <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={styles.trayCount}>
                      {item === "red" ? `${count}/15` : count >= BALL_LIMIT[item] ? "✓" : " "}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <Pressable
                onPress={() => {
                  const last = balls[balls.length - 1];
                  if (last) setBalls(removeBall(balls, last.id));
                }}
                disabled={!balls.length}
                accessibilityRole="button"
                accessibilityLabel="Undo the last ball"
                style={[styles.secondary, { opacity: balls.length ? 1 : 0.4 }]}
              >
                <MaterialCommunityIcons name="undo" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => addAimedBall(aimedBall)}
                accessibilityRole="button"
                style={[styles.primary, styles.flex, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Add {BALL_LOOK[colour].label.toLowerCase()}</Text>
              </Pressable>
              <Pressable
                onPress={() => (balls.length ? onSave(balls) : setNotice("Scan at least the cue ball first."))}
                accessibilityRole="button"
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Save</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {phase === "replace" && saved ? (
          <>
            <Text style={styles.guidance}>
              {guidance
                ? guidance === "In place"
                  ? `${BALL_LOOK[checking].label}: in place`
                  : `${BALL_LOOK[checking].label}: move it ${guidance}`
                : `Aim at the real ${BALL_LOOK[checking].label.toLowerCase()}`}
            </Text>
            <View style={styles.tray}>
              {TRAY.filter((item) => countOf(saved.balls, item) > 0).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setChecking(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: checking === item }}
                  accessibilityLabel={`Check the ${BALL_LOOK[item].label.toLowerCase()}`}
                  style={[styles.trayItem, { borderColor: checking === item ? "#FFFFFF" : "rgba(255,255,255,0.2)" }]}
                >
                  <View style={[styles.trayBall, { backgroundColor: BALL_LOOK[item].fill, borderColor: BALL_LOOK[item].edge }]} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.summary}>{summarise(saved.balls)}</Text>
          </>
        ) : null}
      </View>

      {/* ------------------------------------------------ choosing a landmark */}
      <Modal visible={pickingLandmark !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickingLandmark(null)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Which landmark?</Text>
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
                style={({ pressed }) => [styles.sheetRow, { borderBottomColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
              >
                <Text style={[styles.sheetRowText, { color: colors.text }]}>{item.label}</Text>
                {landmarks[pickingLandmark ?? 0] === item.id ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* ------------------------------------------------ the diagram, full size */}
      <Modal visible={showDiagram} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDiagram(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{summarise(target)}</Text>
            <Pressable onPress={() => setShowDiagram(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.flex}>
            <TableDiagram balls={target} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CROSS = 44;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },

  crosshairWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  crosshair: { width: CROSS, height: CROSS, borderRadius: CROSS / 2, borderWidth: 2 },
  crossH: { position: "absolute", width: 14, height: 2, backgroundColor: "#FFFFFF" },
  crossV: { position: "absolute", width: 2, height: 14, backgroundColor: "#FFFFFF" },

  top: { position: "absolute", left: SPACING.md, right: SPACING.md, top: 0, flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  card: { flex: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  cardTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  cardBody: { color: "rgba(255,255,255,0.82)", fontSize: 13, lineHeight: 18, marginTop: 3 },
  warning: { color: "#F2C230", fontSize: 13, fontWeight: "700", marginTop: SPACING.xs },
  quality: { fontSize: 13, fontWeight: "800", marginTop: SPACING.xs },
  miniDiagram: { width: 64, height: 124, borderRadius: RADIUS.sm, overflow: "hidden" },

  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  row: { flexDirection: "row", gap: SPACING.sm },
  primary: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.lg },
  primaryText: { fontSize: 16, fontWeight: "800" },
  secondary: {
    minWidth: HIT_TARGET + 6,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  secondaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  quiet: { minHeight: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  quietText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },

  landmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: SPACING.md,
  },
  landmarkText: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  change: { color: "#6FE3A8", fontSize: 14, fontWeight: "700" },

  tray: { flexDirection: "row", gap: 6, justifyContent: "center" },
  trayItem: { flex: 1, maxWidth: 52, alignItems: "center", gap: 2, borderWidth: 2, borderRadius: RADIUS.md, paddingVertical: 5 },
  trayBall: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  trayCount: { color: "rgba(255,255,255,0.8)", fontFamily: FONTS.boardLabel, fontSize: 11 },

  guidance: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center" },
  summary: { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center" },

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
