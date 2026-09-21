import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import {
  BAULK_LINE_Y,
  POCKETS,
  SPOTS,
  TABLE,
  clampToBed,
  distance,
  type BallColour,
  type Point,
} from "../../features/scanSnooker/table";
import { pointsAlongLine, snapPoint, type PlacedBall, type SnapGuides } from "../../features/scanSnooker/position";

/**
 * A full-size table seen from above, drawn to scale, black end at the top. Positions go in and
 * come out in table millimetres, so the diagram can be any size: it fits whatever space it is
 * given, on the smallest phone or the largest.
 *
 * Touch: tap the bed to place a ball, press a ball to select it, drag a ball to move it. With
 * `zoomable`, pinch to zoom in (up to 5x) for placing balls close together, drag the cloth with one
 * finger to move around, and use the + / - / fit buttons for one-handed use. Zoomed in, balls are
 * drawn at their true size, so two touching balls look exactly as they would on the table.
 */

export const BALL_LOOK: Record<BallColour, { fill: string; edge: string; label: string }> = {
  cue: { fill: "#F7F4EA", edge: "#B9B4A4", label: "Cue ball" },
  red: { fill: "#D0142F", edge: "#8E0B20", label: "Red" },
  yellow: { fill: "#F2C230", edge: "#B08A10", label: "Yellow" },
  green: { fill: "#1F8A4C", edge: "#0F5A2E", label: "Green" },
  brown: { fill: "#7A4B2A", edge: "#4E2F18", label: "Brown" },
  blue: { fill: "#1B6FD0", edge: "#0E4686", label: "Blue" },
  pink: { fill: "#F29AC0", edge: "#C0648C", label: "Pink" },
  black: { fill: "#1A1E20", edge: "#5A5F62", label: "Black" },
};

const BAIZE = "#0F4A33";
const RAIL = "#3E2616";
const CUSHION = "#0B3324";
const LINE = "rgba(255,255,255,0.35)";
const SPOT = "rgba(255,255,255,0.45)";

/** The rail around the bed, as a share of the bed's width. */
const RAIL_SHARE = 0.055;
/** At full view balls are drawn a touch larger than scale so they can be seen and pressed. */
const BALL_SCALE = 1.35;
/**
 * How close a touch must be to a ball to pick it up: on the ball, or just round its edge. Any
 * wider and a tap meant to place a ball beside another picked up the other one instead.
 */
const GRAB_MARGIN_PX = 5;
const MIN_GRAB_PX = 11;
const grabRadiusFor = (d: number) => Math.max(d / 2 + GRAB_MARGIN_PX, MIN_GRAB_PX);
const MAX_ZOOM = 5;
/** How near, on screen, a ball must come to lining up before it snaps level. */
const SNAP_PX = 8;
const GUIDE = "#E3C15A";
/** A finger moving less than this is a tap, not a drag. */
const TAP_SLOP = 6;

type View2 = { zoom: number; panX: number; panY: number };
const FULL_VIEW: View2 = { zoom: 1, panX: 0, panY: 0 };

type Props = {
  balls: PlacedBall[];
  selectedId?: string | null;
  /** Leave out to make the diagram read-only for dragging. */
  onPlace?: (point: Point) => void;
  onMove?: (id: string, point: Point) => void;
  onSelect?: (id: string | null) => void;
  /** A picture only: touches pass through, e.g. to a button wrapped round it. */
  readOnly?: boolean;
  /** Pinch and buttons to zoom in, for placing balls close together. */
  zoomable?: boolean;
  /**
   * Drawing a line instead of placing one ball: a one-finger drag shows `lineCount` reds along
   * it, and letting go hands the line to `onLine`. Pinching still zooms.
   */
  lineMode?: boolean;
  lineCount?: number;
  onLine?: (start: Point, end: Point) => void;
  /** Line balls up with each other and the spots as they are placed and moved, showing guides. */
  snap?: boolean;
};

export const TableDiagram = ({
  balls,
  selectedId,
  onPlace,
  onMove,
  onSelect,
  readOnly = false,
  zoomable = false,
  lineMode = false,
  lineCount = 5,
  onLine,
  snap = false,
}: Props) => {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View2>(FULL_VIEW);
  const [dragging, setDragging] = useState<{ id: string; point: Point } | null>(null);
  // The line being drawn, in table millimetres.
  const [line, setLineState] = useState<{ start: Point; end: Point } | null>(null);
  // Also kept in a ref, so letting go reads the finished line without a state updater's side effects.
  const lineRef = useRef<{ start: Point; end: Point } | null>(null);
  // What a ball being placed or moved has lined up with, drawn as guides while the finger is down.
  const [guides, setGuides] = useState<SnapGuides>({ x: null, y: null });
  const setLine = (next: { start: Point; end: Point } | null) => {
    lineRef.current = next;
    setLineState(next);
  };

  // ---------------------------------------------------------------- the whole table, fitted
  const base = useMemo(() => {
    if (!box.width || !box.height) return null;
    const outerW = TABLE.width * (1 + RAIL_SHARE * 2);
    const outerL = TABLE.length + TABLE.width * RAIL_SHARE * 2;
    const scale = Math.min(box.width / outerW, box.height / outerL); // px per mm at 1x
    return {
      scale,
      left: (box.width - TABLE.width * scale) / 2,
      top: (box.height - TABLE.length * scale) / 2,
      rail: TABLE.width * RAIL_SHARE * scale,
      cx: box.width / 2,
      cy: box.height / 2,
    };
  }, [box]);

  // The closest any two balls are, centre to centre, in mm. Balls are drawn larger than life at
  // full view so they can be seen, but never wider than this gap: enlarged any further, two balls
  // that are apart on the table would look as if they touched or overlapped.
  const closestMm = useMemo(() => {
    let closest = Infinity;
    for (let i = 0; i < balls.length; i += 1) {
      for (let j = i + 1; j < balls.length; j += 1) {
        closest = Math.min(closest, distance(balls[i], balls[j]));
      }
    }
    return closest;
  }, [balls]);

  /** Where the table is on screen for a given zoom and pan. */
  const layoutFor = (current: View2) => {
    if (!base) return null;
    const scale = base.scale * current.zoom;
    const left = base.cx + (base.left - base.cx) * current.zoom + current.panX;
    const top = base.cy + (base.top - base.cy) * current.zoom + current.panY;
    const ballScale = Math.max(1, BALL_SCALE / current.zoom);
    return {
      scale,
      left,
      top,
      rail: base.rail * current.zoom,
      bedW: TABLE.width * scale,
      bedL: TABLE.length * scale,
      // Enlarged for visibility, capped by the closest gap, and never below true size.
      d: Math.max(TABLE.ball * scale, Math.min(Math.max(9, TABLE.ball * scale * ballScale), closestMm * scale)),
    };
  };

  /** Keeps the table on screen: centred when it fits, never dragged away from an edge when it does not. */
  const clampView = (next: View2): View2 => {
    if (!base) return next;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom));
    const at = layoutFor({ ...next, zoom })!;
    const fit = (start: number, size: number, room: number) =>
      size <= room ? (room - size) / 2 : Math.min(0, Math.max(room - size, start));
    const contentW = at.bedW + at.rail * 2;
    const contentH = at.bedL + at.rail * 2;
    const wantedLeft = fit(at.left - at.rail, contentW, box.width) + at.rail;
    const wantedTop = fit(at.top - at.rail, contentH, box.height) + at.rail;
    return { zoom, panX: next.panX + (wantedLeft - at.left), panY: next.panY + (wantedTop - at.top) };
  };

  /** Zooms so the table point under `focus` (screen px) stays under it. */
  const zoomAround = (from: View2, zoom: number, focus: Point, focusNow: Point = focus): View2 => {
    const at = layoutFor(from);
    if (!at || !base) return from;
    const mm = { x: (focus.x - at.left) / at.scale, y: (focus.y - at.top) / at.scale };
    const target = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const left = focusNow.x - mm.x * base.scale * target;
    const top = focusNow.y - mm.y * base.scale * target;
    return clampView({
      zoom: target,
      panX: left - (base.cx + (base.left - base.cx) * target),
      panY: top - (base.cy + (base.top - base.cy) * target),
    });
  };

  const fit = layoutFor(view);
  const toPx = (point: Point) => ({ x: fit!.left + point.x * fit!.scale, y: fit!.top + point.y * fit!.scale });

  // ---------------------------------------------------------------- touch
  // The latest values, for the touch handlers created once below.
  /** A point lined up with `others` if snapping is on and it is close; also shows what it lined up with. */
  const snapTo = (point: Point, others: Point[]): Point => {
    if (!snap || !fit) return clampToBed(point);
    const result = snapPoint(point, others, SNAP_PX / fit.scale);
    setGuides(result.guides);
    return result.point;
  };
  const clearGuides = () => setGuides({ x: null, y: null });

  const live = useRef({
    fit,
    view,
    balls,
    onPlace,
    onMove,
    onSelect,
    zoomable,
    layoutFor,
    clampView,
    zoomAround,
    lineMode,
    onLine,
    snapTo,
  });
  live.current = {
    fit,
    view,
    balls,
    onPlace,
    onMove,
    onSelect,
    zoomable,
    layoutFor,
    clampView,
    zoomAround,
    lineMode,
    onLine,
    snapTo,
  };

  const touch = useRef<{
    mode: "tap" | "ball" | "pan" | "pinch" | "line";
    id: string | null;
    start: Point;
    origin: Point;
    startView: View2;
    pinchDistance: number;
    pinchMid: Point;
    /** Once a finger has gone past the tap distance it is a drag, even if it comes back. */
    moved: boolean;
  }>({
    mode: "tap",
    id: null,
    start: { x: 0, y: 0 },
    origin: { x: 0, y: 0 },
    startView: FULL_VIEW,
    pinchDistance: 1,
    pinchMid: { x: 0, y: 0 },
    moved: false,
  });

  const localTouches = (event: GestureResponderEvent) =>
    event.nativeEvent.touches.map((item) => ({
      x: item.pageX - touch.current.origin.x,
      y: item.pageY - touch.current.origin.y,
    }));

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const current = live.current;
          if (!current.fit) return;
          const { locationX, locationY, pageX, pageY } = event.nativeEvent;
          const at = { x: locationX, y: locationY };
          const grabRadius = grabRadiusFor(current.fit.d);
          const hit = current.onMove
            ? [...current.balls]
                .map((ball) => ({
                  ball,
                  gap: distance(at, {
                    x: current.fit!.left + ball.x * current.fit!.scale,
                    y: current.fit!.top + ball.y * current.fit!.scale,
                  }),
                }))
                .filter(({ gap }) => gap <= grabRadius)
                .sort((a, b) => a.gap - b.gap)[0]
            : undefined;
          const tapped = !hit
            ? current.balls
                .map((ball) => ({
                  ball,
                  gap: distance(at, {
                    x: current.fit!.left + ball.x * current.fit!.scale,
                    y: current.fit!.top + ball.y * current.fit!.scale,
                  }),
                }))
                .filter(({ gap }) => gap <= grabRadius)
                .sort((a, b) => a.gap - b.gap)[0]
            : undefined;
          if (current.lineMode) {
            const start = current.snapTo(
              { x: (at.x - current.fit.left) / current.fit.scale, y: (at.y - current.fit.top) / current.fit.scale },
              current.balls
            );
            setLine({ start, end: start });
          }
          touch.current = {
            mode: current.lineMode ? "line" : hit ? "ball" : "tap",
            id: hit?.ball.id ?? tapped?.ball.id ?? null,
            start: at,
            // Where this view sits on screen, to place other fingers of a pinch within it.
            origin: { x: pageX - locationX, y: pageY - locationY },
            startView: current.view,
            pinchDistance: 1,
            pinchMid: at,
            moved: false,
          };
        },
        onPanResponderMove: (event, gesture) => {
          const current = live.current;
          if (!current.fit) return;
          const state = touch.current;
          const fingers = localTouches(event);

          // Two fingers: pinch to zoom, and move the table with them.
          if (current.zoomable && fingers.length >= 2) {
            const [a, b] = fingers;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const gap = Math.max(1, distance(a, b));
            if (state.mode !== "pinch") {
              setDragging(null);
              setLine(null);
              touch.current = { ...state, mode: "pinch", startView: current.view, pinchDistance: gap, pinchMid: mid };
              return;
            }
            setView(
              current.zoomAround(
                state.startView,
                state.startView.zoom * (gap / state.pinchDistance),
                state.pinchMid,
                mid
              )
            );
            return;
          }
          if (state.mode === "pinch") return;

          if (!state.moved && Math.hypot(gesture.dx, gesture.dy) >= TAP_SLOP) state.moved = true;
          const moved = state.moved;
          if (state.mode === "line") {
            const end = current.snapTo(
              {
                x: (state.start.x + gesture.dx - current.fit.left) / current.fit.scale,
                y: (state.start.y + gesture.dy - current.fit.top) / current.fit.scale,
              },
              lineRef.current ? [...current.balls, lineRef.current.start] : current.balls
            );
            if (lineRef.current) setLine({ ...lineRef.current, end });
            return;
          }
          if (state.mode === "ball" && state.id && current.onMove) {
            if (!moved) return;
            const point = current.snapTo(
              {
                x: (state.start.x + gesture.dx - current.fit.left) / current.fit.scale,
                y: (state.start.y + gesture.dy - current.fit.top) / current.fit.scale,
              },
              current.balls.filter((ball) => ball.id !== state.id)
            );
            setDragging({ id: state.id, point });
            return;
          }
          // One finger on the cloth, zoomed in: move around the table.
          if (current.zoomable && current.view.zoom > 1 && (state.mode === "pan" || moved)) {
            touch.current = { ...state, mode: "pan" };
            setView(
              current.clampView({
                zoom: state.startView.zoom,
                panX: state.startView.panX + gesture.dx,
                panY: state.startView.panY + gesture.dy,
              })
            );
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const current = live.current;
          const state = touch.current;
          setDragging(null);
          clearGuides();
          if (state.mode === "line") {
            const drawn = lineRef.current;
            setLine(null);
            if (drawn && current.onLine) current.onLine(drawn.start, drawn.end);
            return;
          }
          if (!current.fit || state.mode === "pinch" || state.mode === "pan") return;
          const moved = state.moved;

          if (state.mode === "ball" && state.id && moved && current.onMove) {
            current.onMove(
              state.id,
              current.snapTo(
                {
                  x: (state.start.x + gesture.dx - current.fit.left) / current.fit.scale,
                  y: (state.start.y + gesture.dy - current.fit.top) / current.fit.scale,
                },
                current.balls.filter((ball) => ball.id !== state.id)
              )
            );
            clearGuides();
            current.onSelect?.(state.id);
            return;
          }
          if (state.id) {
            current.onSelect?.(state.id);
            return;
          }
          if (moved) return;
          // A tap on the bed (not the rail) places a ball.
          const point = {
            x: (state.start.x - current.fit.left) / current.fit.scale,
            y: (state.start.y - current.fit.top) / current.fit.scale,
          };
          const onBed = point.x >= 0 && point.x <= TABLE.width && point.y >= 0 && point.y <= TABLE.length;
          if (onBed && current.onPlace) {
            current.onPlace(current.snapTo(point, current.balls));
            clearGuides();
          } else current.onSelect?.(null);
        },
        onPanResponderTerminate: () => {
          setDragging(null);
          setLine(null);
          clearGuides();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  // When the space changes - a tool swaps the tray for another bar, say - keep the zoom the player
  // chose and just keep the table in view, rather than jumping back out to the whole table.
  useEffect(() => {
    setView((current) => clampView(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const zoomBy = (factor: number) => {
    if (!base) return;
    setView((current) => zoomAround(current, current.zoom * factor, { x: base.cx, y: base.cy }));
  };

  return (
    <View
      style={styles.box}
      onLayout={onLayout}
      pointerEvents={readOnly ? "none" : "auto"}
      {...(readOnly ? {} : responder.panHandlers)}
    >
      {fit ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* ------------------------------------------------ rail, bed and pockets */}
          <View
            style={[
              styles.abs,
              {
                left: fit.left - fit.rail,
                top: fit.top - fit.rail,
                width: fit.bedW + fit.rail * 2,
                height: fit.bedL + fit.rail * 2,
                borderRadius: fit.rail * 0.8,
                backgroundColor: RAIL,
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                left: fit.left,
                top: fit.top,
                width: fit.bedW,
                height: fit.bedL,
                backgroundColor: BAIZE,
                borderColor: CUSHION,
                borderWidth: 2,
              },
            ]}
          />
          {Object.values(POCKETS).map((pocket, index) => {
            const p = toPx(pocket);
            const r = TABLE.ball * fit.scale * 1.3;
            return (
              <View
                key={index}
                style={[
                  styles.abs,
                  styles.pocket,
                  { left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: r },
                ]}
              />
            );
          })}

          {/* ------------------------------------------------ baulk line, D and spots */}
          <View
            style={[
              styles.abs,
              {
                left: fit.left,
                width: fit.bedW,
                top: toPx({ x: 0, y: BAULK_LINE_Y }).y,
                height: 1,
                backgroundColor: LINE,
              },
            ]}
          />
          <Svg
            style={[styles.abs, { left: toPx(SPOTS.green).x - 1, top: toPx(SPOTS.brown).y - 1 }]}
            width={TABLE.dRadius * 2 * fit.scale + 2}
            height={TABLE.dRadius * fit.scale + 2}
          >
            <Path
              d={`M 1 1 A ${TABLE.dRadius * fit.scale} ${TABLE.dRadius * fit.scale} 0 0 0 ${TABLE.dRadius * 2 * fit.scale + 1} 1`}
              stroke={LINE}
              strokeWidth={1}
              fill="none"
            />
          </Svg>
          {Object.values(SPOTS).map((spot, index) => {
            const p = toPx(spot);
            return <View key={index} style={[styles.abs, styles.spot, { left: p.x - 2, top: p.y - 2 }]} />;
          })}

          {/* ------------------------------------------------ snap guides */}
          {guides.x !== null || guides.y !== null ? (
            <Svg style={StyleSheet.absoluteFill} width={box.width} height={box.height}>
              {guides.x !== null ? (
                <Path
                  d={`M ${toPx({ x: guides.x, y: 0 }).x} ${fit.top} V ${fit.top + fit.bedL}`}
                  stroke={GUIDE}
                  strokeWidth={1.2}
                  strokeDasharray="5 4"
                />
              ) : null}
              {guides.y !== null ? (
                <Path
                  d={`M ${fit.left} ${toPx({ x: 0, y: guides.y }).y} H ${fit.left + fit.bedW}`}
                  stroke={GUIDE}
                  strokeWidth={1.2}
                  strokeDasharray="5 4"
                />
              ) : null}
            </Svg>
          ) : null}

          {/* ------------------------------------------------ the line being drawn */}
          {line ? (
            <>
              <Svg style={StyleSheet.absoluteFill} width={box.width} height={box.height}>
                <Path
                  d={`M ${toPx(line.start).x} ${toPx(line.start).y} L ${toPx(line.end).x} ${toPx(line.end).y}`}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                />
              </Svg>
              {pointsAlongLine(line.start, line.end, lineCount).map((point, index) => {
                const p = toPx(point);
                return (
                  <View
                    key={`line-${index}`}
                    style={[
                      styles.abs,
                      styles.ghost,
                      {
                        left: p.x - fit.d / 2,
                        top: p.y - fit.d / 2,
                        width: fit.d,
                        height: fit.d,
                        borderRadius: fit.d / 2,
                      },
                    ]}
                  />
                );
              })}
            </>
          ) : null}

          {/* ------------------------------------------------ the balls */}
          {balls.map((ball) => {
            const at = dragging?.id === ball.id ? dragging.point : ball;
            const p = toPx(at);
            const look = BALL_LOOK[ball.colour];
            const selected = ball.id === selectedId;
            return (
              <View
                key={ball.id}
                style={[
                  styles.abs,
                  styles.ball,
                  {
                    left: p.x - fit.d / 2,
                    top: p.y - fit.d / 2,
                    width: fit.d,
                    height: fit.d,
                    borderRadius: fit.d / 2,
                    backgroundColor: look.fill,
                    borderColor: look.edge,
                    transform: [{ scale: dragging?.id === ball.id && view.zoom < 1.5 ? 1.3 : 1 }],
                  },
                ]}
              >
                <View
                  style={[styles.shine, { width: fit.d * 0.32, height: fit.d * 0.32, borderRadius: fit.d * 0.16 }]}
                />
                {selected ? (
                  <View
                    style={[
                      styles.abs,
                      styles.selected,
                      { left: -5, top: -5, width: fit.d + 10, height: fit.d + 10, borderRadius: (fit.d + 10) / 2 },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* ------------------------------------------------ zoom buttons */}
      {zoomable && !readOnly && fit ? (
        <View style={styles.zoomBar}>
          <Pressable
            onPress={() => zoomBy(1.6)}
            disabled={view.zoom >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            style={[styles.zoomButton, { opacity: view.zoom >= MAX_ZOOM ? 0.4 : 1 }]}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => zoomBy(1 / 1.6)}
            disabled={view.zoom <= 1}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            style={[styles.zoomButton, { opacity: view.zoom <= 1 ? 0.4 : 1 }]}
          >
            <MaterialCommunityIcons name="minus" size={20} color="#FFFFFF" />
          </Pressable>
          {view.zoom > 1 ? (
            <Pressable
              onPress={() => setView(FULL_VIEW)}
              accessibilityRole="button"
              accessibilityLabel="Show the whole table"
              style={styles.zoomButton}
            >
              <MaterialCommunityIcons name="fit-to-screen-outline" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { flex: 1, overflow: "hidden" },
  abs: { position: "absolute" },
  pocket: { backgroundColor: "#030605" },
  spot: { width: 4, height: 4, borderRadius: 2, backgroundColor: SPOT },
  ball: {
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  shine: { position: "absolute", top: "14%", left: "20%", backgroundColor: "rgba(255,255,255,0.6)" },
  selected: { borderWidth: 2, borderColor: "#FFFFFF" },
  ghost: { backgroundColor: "rgba(208,20,47,0.55)", borderWidth: 1.5, borderColor: "#FFFFFF" },
  zoomBar: { position: "absolute", right: 8, bottom: 8, gap: 8 },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(10,18,15,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
});
