import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useScanSnookerStore } from "../../store/scanSnookerStore";
import { ARScan } from "../../components/scanSnooker/ARScan";
import { arSupport } from "../../../modules/snooker-ar";
import { BALL_LOOK, TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { BALL_LIMIT, describePosition, type BallColour } from "../../features/scanSnooker/table";
import {
  coloursOnSpots,
  countOf,
  moveBall,
  placeBall,
  removeBall,
  summarise,
  type PlacedBall,
} from "../../features/scanSnooker/position";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Scan Snooker: record where the balls are before a snookered player plays, then put them back
 * after a miss.
 *
 * The camera is the main way in: scan the table and the balls, and see the recorded position as
 * ghosts on the real table afterwards. The diagram is the same position drawn flat - a preview of
 * what was scanned, a way to tweak it, and the whole feature on phones that cannot run the camera
 * version (Android, older iPhones).
 */

type Mode = "record" | "replace";

const TRAY: BallColour[] = ["cue", "red", "yellow", "green", "brown", "blue", "pink", "black"];

const minutesAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export const ScanSnookerScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "ScanSnooker">>();
  const navigation = useNavigation();
  const { matchId, frameNumber } = route.params;
  const support = useMemo(() => arSupport(), []);
  const saved = useScanSnookerStore((state) => state.getPosition(matchId, frameNumber));
  const savePosition = useScanSnookerStore((state) => state.savePosition);
  const [view, setView] = useState<"camera" | "diagram">(support.available ? "camera" : "diagram");
  // Bumped to start the camera afresh, e.g. to scan again after saving.
  const [cameraRun, setCameraRun] = useState(0);
  const [intent, setIntent] = useState<"record" | "replace">(saved ? "replace" : "record");

  // The camera fills the screen; the diagram keeps the header and its back button.
  const camera = view === "camera" && support.available;
  useEffect(() => {
    navigation.setOptions({ title: `Scan snooker · Frame ${frameNumber}`, headerShown: !camera });
  }, [camera, frameNumber, navigation]);

  if (camera) {
    return (
      <ARScan
        key={`${intent}-${cameraRun}`}
        intent={intent}
        saved={saved}
        onSave={(balls) => {
          savePosition(matchId, frameNumber, balls);
          // Straight to the diagram of what was scanned, which is where it is checked and tweaked.
          setView("diagram");
        }}
        onUseDiagram={() => setView("diagram")}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <DiagramScan
      matchId={matchId}
      frameNumber={frameNumber}
      cameraAvailable={support.available}
      onUseCamera={(next) => {
        setIntent(next);
        setCameraRun((value) => value + 1);
        setView("camera");
      }}
    />
  );
};

/** The recorded position on a flat table: preview, tweak, and the fallback without a camera. */
const DiagramScan = ({
  matchId,
  frameNumber,
  cameraAvailable,
  onUseCamera,
}: {
  matchId: string;
  frameNumber: number;
  cameraAvailable: boolean;
  onUseCamera: (intent: "record" | "replace") => void;
}) => {
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();

  const saved = useScanSnookerStore((state) => state.getPosition(matchId, frameNumber));
  const savePosition = useScanSnookerStore((state) => state.savePosition);
  const clearPosition = useScanSnookerStore((state) => state.clearPosition);

  // With a position already recorded for this frame, the likely job is putting the balls back.
  const [mode, setMode] = useState<Mode>(saved ? "replace" : "record");
  const [balls, setBalls] = useState<PlacedBall[]>(saved?.balls ?? []);
  const [colour, setColour] = useState<BallColour>("cue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = mode === "replace" && saved ? saved.balls : balls;
  const selected = shown.find((ball) => ball.id === selectedId) ?? null;
  const unsaved = useMemo(() => JSON.stringify(balls) !== JSON.stringify(saved?.balls ?? []), [balls, saved]);

  // ---------------------------------------------------------------- recording
  const place = (point: { x: number; y: number }) => {
    const result = placeBall(balls, colour, point);
    if (result.refused) {
      setNotice(result.refused);
      return;
    }
    setNotice(null);
    setBalls(result.balls);
    setSelectedId(result.placed?.id ?? null);
    // After the cue ball, the next thing to place is nearly always a red.
    if (colour === "cue") setColour("red");
  };

  const save = () => {
    if (!balls.length) {
      setNotice("Place at least the cue ball and the balls near it, then save.");
      return;
    }
    savePosition(matchId, frameNumber, balls);
    setSelectedId(null);
    setNotice(null);
    setMode("replace");
  };

  const clearAll = () =>
    dialog.confirm({
      title: "Clear the table?",
      message: saved
        ? "This removes the recorded position for this frame."
        : "This removes every ball you have placed.",
      icon: "delete-outline",
      tone: "danger",
      confirmLabel: "Clear",
      cancelLabel: "Keep it",
      onConfirm: () => {
        clearPosition(matchId, frameNumber);
        setBalls([]);
        setSelectedId(null);
        setMode("record");
      },
    });

  const edit = () => {
    setBalls(saved?.balls ?? []);
    setSelectedId(null);
    setMode("record");
  };

  // ---------------------------------------------------------------- layout
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACING.sm }]}>
      {/* ------------------------------------------------ mode */}
      <View style={[styles.modes, { backgroundColor: colors.surfaceMuted }]}>
        {(["record", "replace"] as Mode[]).map((item) => {
          const active = mode === item;
          const disabled = item === "replace" && !saved;
          return (
            <Pressable
              key={item}
              onPress={() => {
                // Tapping the tab you are on does nothing, so unsaved balls are never lost.
                if (disabled || item === mode) return;
                setSelectedId(null);
                if (item === "record") edit();
                else setMode("replace");
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              style={[styles.mode, active && { backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons
                name={item === "record" ? "record-circle-outline" : "backup-restore"}
                size={16}
                color={disabled ? colors.textSubtle : active ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.modeText,
                  { color: disabled ? colors.textSubtle : active ? colors.text : colors.textMuted },
                ]}
              >
                {item === "record" ? "Record" : "Replace"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {cameraAvailable ? (
        <Pressable
          onPress={() => onUseCamera(mode === "replace" && saved ? "replace" : "record")}
          accessibilityRole="button"
          style={[styles.camera, { backgroundColor: colors.primary }]}
        >
          <MaterialCommunityIcons name="camera-outline" size={18} color={colors.onPrimary} />
          <Text style={[styles.cameraText, { color: colors.onPrimary }]}>
            {mode === "replace" && saved
              ? "Put the balls back with the camera"
              : saved
                ? "Scan again with the camera"
                : "Scan with the camera"}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Scanning with the camera needs an iPhone with ARKit. You can record the position on the diagram instead.
        </Text>
      )}

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {mode === "record"
          ? "Choose a ball below and tap where it is on the table. Drag to adjust."
          : saved
            ? `Recorded ${minutesAgo(saved.recordedAt)} · ${summarise(saved.balls)}. Tap a ball for where it goes.`
            : ""}
      </Text>

      {/* ------------------------------------------------ the table */}
      <View style={styles.table}>
        <TableDiagram
          balls={shown}
          selectedId={selectedId}
          onPlace={mode === "record" ? place : undefined}
          onMove={mode === "record" ? (id, point) => setBalls((current) => moveBall(current, id, point)) : undefined}
          onSelect={setSelectedId}
        />
      </View>

      {/* ------------------------------------------------ the selected ball */}
      {selected ? (
        <View style={[styles.detail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View
            style={[
              styles.detailBall,
              { backgroundColor: BALL_LOOK[selected.colour].fill, borderColor: BALL_LOOK[selected.colour].edge },
            ]}
          />
          <View style={styles.detailText}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{BALL_LOOK[selected.colour].label}</Text>
            <Text style={[styles.detailLine, { color: colors.textMuted }]}>
              {describePosition(selected).side} · {describePosition(selected).end}
            </Text>
          </View>
          {mode === "record" ? (
            <Pressable
              onPress={() => {
                setBalls((current) => removeBall(current, selected.id));
                setSelectedId(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${BALL_LOOK[selected.colour].label.toLowerCase()}`}
              hitSlop={8}
              style={styles.detailAction}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ) : notice ? (
        <Text style={[styles.notice, { color: colors.danger }]}>{notice}</Text>
      ) : null}

      {/* ------------------------------------------------ record: the tray and actions */}
      {mode === "record" ? (
        <>
          {/* Eight balls sharing the width, so every one is in view on the smallest phone. */}
          <View style={styles.tray}>
            {TRAY.map((item) => {
              const active = colour === item;
              const count = countOf(balls, item);
              const full = count >= BALL_LIMIT[item];
              return (
                <Pressable
                  key={item}
                  onPress={() => setColour(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${BALL_LOOK[item].label}${item === "red" ? `, ${count} of 15 placed` : count ? ", placed" : ""}`}
                  style={[
                    styles.trayItem,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.trayBall,
                      {
                        backgroundColor: BALL_LOOK[item].fill,
                        borderColor: BALL_LOOK[item].edge,
                        opacity: full && item !== "red" && !active ? 0.45 : 1,
                      },
                    ]}
                  />
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.trayCount, { color: active ? colors.text : colors.textMuted }]}
                  >
                    {item === "red" ? `${count}/15` : count ? "✓" : " "}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => setBalls((current) => coloursOnSpots(current))}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                Colours on spots
              </Text>
            </Pressable>
            <Pressable
              onPress={save}
              accessibilityRole="button"
              accessibilityState={{ disabled: !balls.length }}
              style={[styles.primary, { backgroundColor: balls.length ? colors.primary : colors.surfaceMuted }]}
            >
              <Text
                style={[styles.primaryText, { color: balls.length ? colors.onPrimary : colors.textMuted }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {saved && unsaved ? "Save changes" : "Save position"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={edit}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>Edit position</Text>
          </Pressable>
          <Pressable
            onPress={clearAll}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: colors.danger, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.secondaryText, { color: colors.danger }]}>Clear</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },

  modes: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  mode: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: RADIUS.sm,
  },
  modeText: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 18, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  camera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  cameraText: { fontSize: 15, fontWeight: "800" },

  table: { flex: 1, marginVertical: SPACING.xs },

  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  detailBall: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  detailText: { flex: 1 },
  detailTitle: { fontSize: 15, fontWeight: "800" },
  detailLine: { fontSize: 13, marginTop: 1 },
  detailAction: { minWidth: HIT_TARGET, minHeight: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  notice: { fontSize: 13, fontWeight: "600", textAlign: "center", minHeight: 20 },

  tray: { flexDirection: "row", gap: 6, paddingVertical: SPACING.sm },
  trayItem: {
    flex: 1,
    maxWidth: 56,
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
  },
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
  primary: {
    flex: 1.3,
    minHeight: HIT_TARGET + 4,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
});
