import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { selectLapPosition, useRecordSnookerStore } from "../../store/recordSnookerStore";
import { LapScan } from "../../components/scanSnooker/LapScan";
import { arSupport, lapAvailable } from "../../../modules/snooker-ar";
import { BALL_LOOK, TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { type BallColour, type Point } from "../../features/scanSnooker/table";
import type { LapBall } from "../../features/scanSnooker/lap";
import { countOf, moveBall, placeBall, removeBall, summarise, type PlacedBall } from "../../features/scanSnooker/position";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Record a Snooker: walk once round the table and the balls are found for you, then check what was
 * found and correct anything it got wrong. Nothing a lap finds is trusted until a player has seen
 * it. This sits beside Scan Snooker, and shares none of its saved positions, while it is tested.
 */

const TRAY: BallColour[] = ["cue", "red", "yellow", "green", "brown", "blue", "pink", "black"];

export const RecordSnookerScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "RecordSnooker">>();
  const navigation = useNavigation();
  const { matchId, frameNumber } = route.params;
  const support = useMemo(() => ({ camera: arSupport().available, lap: lapAvailable() }), []);
  const saved = useRecordSnookerStore(selectLapPosition(matchId, frameNumber));
  const [view, setView] = useState<"camera" | "review">(support.lap && !saved ? "camera" : "review");
  const [found, setFound] = useState<{ balls: LapBall[]; report: string } | null>(null);
  // Bumped to start the camera afresh for another lap.
  const [lapRun, setLapRun] = useState(0);

  const camera = view === "camera" && support.lap;
  useEffect(() => {
    navigation.setOptions({ title: `Record a snooker · Frame ${frameNumber}`, headerShown: !camera });
  }, [camera, frameNumber, navigation]);

  if (camera) {
    return (
      <LapScan
        key={lapRun}
        onFinish={(balls, report) => {
          setFound({ balls, report });
          setView("review");
        }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <LapReview
      key={lapRun}
      matchId={matchId}
      frameNumber={frameNumber}
      found={found}
      lapReady={support.lap}
      cameraReady={support.camera}
      onNewLap={() => {
        setFound(null);
        setLapRun((value) => value + 1);
        setView("camera");
      }}
      onDone={() => navigation.goBack()}
    />
  );
};

/** What the lap found, on the diagram, to check and correct before it is kept. */
const LapReview = ({
  matchId,
  frameNumber,
  found,
  lapReady,
  cameraReady,
  onNewLap,
  onDone,
}: {
  matchId: string;
  frameNumber: number;
  found: { balls: LapBall[]; report: string } | null;
  lapReady: boolean;
  cameraReady: boolean;
  onNewLap: () => void;
  onDone: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const saved = useRecordSnookerStore(selectLapPosition(matchId, frameNumber));
  const savePosition = useRecordSnookerStore((state) => state.savePosition);

  const [balls, setBalls] = useState<PlacedBall[]>(found?.balls ?? saved?.balls ?? []);
  const [unsure, setUnsure] = useState<string[]>(() => found?.balls.filter((ball) => ball.unsure).map((ball) => ball.id) ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(unsure[0] ?? null);
  const [colour, setColour] = useState<BallColour>("red");
  const [notice, setNotice] = useState<string | null>(null);

  const selected = balls.find((ball) => ball.id === selectedId) ?? null;

  const settle = (id: string) => setUnsure((current) => current.filter((item) => item !== id));

  const place = (point: Point) => {
    const result = placeBall(balls, colour, point);
    if (result.refused) {
      setNotice(result.refused);
      return;
    }
    setNotice(null);
    setBalls(result.balls);
    setSelectedId(result.placed?.id ?? null);
  };

  /** With a ball selected the tray says what it really is; otherwise, what to add next. */
  const chooseColour = (item: BallColour) => {
    setColour(item);
    if (!selected) return;
    const point = { x: selected.x, y: selected.y };
    const result = placeBall(removeBall(balls, selected.id), item, point);
    if (result.refused) {
      setNotice(result.refused);
      return;
    }
    setNotice(null);
    setBalls(result.balls);
    setSelectedId(result.placed?.id ?? null);
    settle(selected.id);
  };

  const remove = () => {
    if (!selected) return;
    setBalls(removeBall(balls, selected.id));
    settle(selected.id);
    setSelectedId(null);
  };

  const hint = !lapReady
    ? cameraReady
      ? "This build doesn't have the lap in it yet. It needs the next development build."
      : "Walking a lap needs an iPhone with ARKit."
    : unsure.length
      ? `${unsure.length} ${unsure.length === 1 ? "ball needs" : "balls need"} checking. Choose what the selected ball really is, or tap another.`
      : balls.length
        ? `${summarise(balls)}. Tap a ball to change it, drag to move it, or tap the table to add one.`
        : "No balls were found. Walk another lap, or tap the table to add them.";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACING.sm }]}>
      <Text style={[styles.hint, { color: notice ? colors.danger : colors.textMuted }]}>{notice ?? hint}</Text>

      <View style={styles.table}>
        <TableDiagram
          balls={balls}
          selectedId={selectedId}
          onPlace={place}
          onMove={(id, point) => setBalls((current) => moveBall(current, id, point))}
          onSelect={setSelectedId}
          zoomable
        />
      </View>

      {selected ? (
        <View style={[styles.detail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.detailBall, { backgroundColor: BALL_LOOK[selected.colour].fill, borderColor: BALL_LOOK[selected.colour].edge }]} />
          <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={1}>
            {BALL_LOOK[selected.colour].label}
            {unsure.includes(selected.id) ? " · not sure" : ""}
          </Text>
          <Pressable
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove the ${BALL_LOOK[selected.colour].label.toLowerCase()}`}
            hitSlop={8}
            style={styles.detailAction}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={22} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tray}>
        {TRAY.map((item) => {
          const active = selected ? selected.colour === item : colour === item;
          const count = countOf(balls, item);
          return (
            <Pressable
              key={item}
              onPress={() => chooseColour(item)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${BALL_LOOK[item].label}${item === "red" ? `, ${count} of 15` : count ? ", found" : ""}`}
              style={[styles.trayItem, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.surface }]}
            >
              <View style={[styles.trayBall, { backgroundColor: BALL_LOOK[item].fill, borderColor: BALL_LOOK[item].edge }]} />
              <Text style={[styles.trayCount, { color: active ? colors.text : colors.textMuted }]}>
                {item === "red" ? count : count ? "✓" : " "}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onNewLap}
          disabled={!lapReady}
          accessibilityRole="button"
          accessibilityState={{ disabled: !lapReady }}
          style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.surface, opacity: lapReady ? 1 : 0.5 }]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            Walk a new lap
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            savePosition(matchId, frameNumber, balls);
            onDone();
          }}
          disabled={!balls.length}
          accessibilityRole="button"
          accessibilityState={{ disabled: !balls.length }}
          style={[styles.primary, { backgroundColor: balls.length ? colors.primary : colors.surfaceMuted }]}
        >
          <Text style={[styles.primaryText, { color: balls.length ? colors.onPrimary : colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
            Save position
          </Text>
        </Pressable>
      </View>

      {found ? (
        <Pressable onPress={() => Share.share({ message: found.report })} accessibilityRole="button" hitSlop={4} style={styles.report}>
          <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.primary} />
          <Text style={[styles.reportText, { color: colors.primary }]}>Share the lap report</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: SPACING.xs },
  table: { flex: 1, marginVertical: SPACING.xs },

  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: HIT_TARGET,
  },
  detailBall: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  detailTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  detailAction: { minWidth: HIT_TARGET, minHeight: HIT_TARGET, alignItems: "center", justifyContent: "center" },

  tray: { flexDirection: "row", gap: 6, paddingVertical: SPACING.sm },
  trayItem: { flex: 1, maxWidth: 56, alignItems: "center", gap: 3, borderWidth: 2, borderRadius: RADIUS.md, paddingVertical: 6 },
  trayBall: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  trayCount: { fontFamily: FONTS.boardLabel, fontSize: 12 },

  actions: { flexDirection: "row", gap: SPACING.sm },
  secondary: {
    flex: 1,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  primary: { flex: 1.3, minHeight: HIT_TARGET + 4, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.sm },
  primaryText: { fontSize: 16, fontWeight: "800" },
  report: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: HIT_TARGET, marginTop: 2 },
  reportText: { fontSize: 14, fontWeight: "700" },
});
