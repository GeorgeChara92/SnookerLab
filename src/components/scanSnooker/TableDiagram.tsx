import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BAULK_LINE_Y, POCKETS, SPOTS, TABLE, clampToBed, distance, type BallColour, type Point } from "../../features/scanSnooker/table";
import type { PlacedBall } from "../../features/scanSnooker/position";

/**
 * A full-size table seen from above, drawn to scale, black end at the top. Positions go in and
 * come out in table millimetres, so the diagram can be any size: it fits whatever space it is
 * given, on the smallest phone or the largest.
 *
 * Touch: tap the bed to place a ball, press a ball to select it, drag a ball to move it. The
 * dragged ball follows the finger here and is only reported when let go, so dragging stays smooth.
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
/** Balls are drawn a touch larger than scale, so they can be seen and pressed on a phone. */
const BALL_SCALE = 1.35;
/** How close a touch must be to a ball to pick it up: most of a ball, and never under a fingertip. */
const GRAB = 0.9;
const MIN_GRAB_PX = 22;

type Props = {
  balls: PlacedBall[];
  selectedId?: string | null;
  /** Leave out to make the diagram read-only for dragging. */
  onPlace?: (point: Point) => void;
  onMove?: (id: string, point: Point) => void;
  onSelect?: (id: string | null) => void;
};

export const TableDiagram = ({ balls, selectedId, onPlace, onMove, onSelect }: Props) => {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState<{ id: string; point: Point } | null>(null);

  // ---------------------------------------------------------------- fit the table to the space
  const fit = useMemo(() => {
    if (!box.width || !box.height) return null;
    const outerW = TABLE.width * (1 + RAIL_SHARE * 2);
    const outerL = TABLE.length + TABLE.width * RAIL_SHARE * 2;
    const scale = Math.min(box.width / outerW, box.height / outerL); // px per mm
    const rail = TABLE.width * RAIL_SHARE * scale;
    const bedW = TABLE.width * scale;
    const bedL = TABLE.length * scale;
    const left = (box.width - bedW) / 2;
    const top = (box.height - bedL) / 2;
    return { scale, rail, bedW, bedL, left, top, d: Math.max(9, TABLE.ball * scale * BALL_SCALE) };
  }, [box]);

  const toPx = (point: Point) => ({ x: fit!.left + point.x * fit!.scale, y: fit!.top + point.y * fit!.scale });

  // The latest values, for the touch handlers created once below.
  const live = useRef({ fit, balls, onPlace, onMove, onSelect });
  live.current = { fit, balls, onPlace, onMove, onSelect };

  const touch = useRef<{ id: string | null; start: Point; moved: boolean }>({ id: null, start: { x: 0, y: 0 }, moved: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const current = live.current;
          if (!current.fit) return;
          const { locationX, locationY } = event.nativeEvent;
          const at = { x: locationX, y: locationY };
          const grabRadius = Math.max(current.fit.d * GRAB, MIN_GRAB_PX);
          const hit = [...current.balls]
            .map((ball) => ({ ball, gap: distance(at, { x: current.fit!.left + ball.x * current.fit!.scale, y: current.fit!.top + ball.y * current.fit!.scale }) }))
            .filter(({ gap }) => gap <= grabRadius)
            .sort((a, b) => a.gap - b.gap)[0];
          touch.current = { id: hit ? hit.ball.id : null, start: at, moved: false };
        },
        onPanResponderMove: (_, gesture) => {
          const current = live.current;
          const { id, start } = touch.current;
          if (!current.fit || !id || !current.onMove) return;
          if (!touch.current.moved && Math.hypot(gesture.dx, gesture.dy) < 4) return;
          touch.current.moved = true;
          const point = clampToBed({
            x: (start.x + gesture.dx - current.fit.left) / current.fit.scale,
            y: (start.y + gesture.dy - current.fit.top) / current.fit.scale,
          });
          setDragging({ id, point });
        },
        onPanResponderRelease: (_, gesture) => {
          const current = live.current;
          const { id, start, moved } = touch.current;
          setDragging(null);
          if (!current.fit) return;
          if (id && moved && current.onMove) {
            current.onMove(id, {
              x: (start.x + gesture.dx - current.fit.left) / current.fit.scale,
              y: (start.y + gesture.dy - current.fit.top) / current.fit.scale,
            });
            current.onSelect?.(id);
            return;
          }
          if (id) {
            current.onSelect?.(id);
            return;
          }
          // A tap on the bed (not the rail) places a ball.
          const point = {
            x: (start.x - current.fit.left) / current.fit.scale,
            y: (start.y - current.fit.top) / current.fit.scale,
          };
          const onBed = point.x >= 0 && point.x <= TABLE.width && point.y >= 0 && point.y <= TABLE.length;
          if (onBed && current.onPlace) current.onPlace(clampToBed(point));
          else current.onSelect?.(null);
        },
        onPanResponderTerminate: () => setDragging(null),
      }),
    []
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  return (
    <View style={styles.box} onLayout={onLayout} {...responder.panHandlers}>
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
              { left: fit.left, top: fit.top, width: fit.bedW, height: fit.bedL, backgroundColor: BAIZE, borderColor: CUSHION, borderWidth: 2 },
            ]}
          />
          {Object.values(POCKETS).map((pocket, index) => {
            const p = toPx(pocket);
            const r = fit.d * 0.95;
            return <View key={index} style={[styles.abs, styles.pocket, { left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: r }]} />;
          })}

          {/* ------------------------------------------------ baulk line, D and spots */}
          <View style={[styles.abs, { left: fit.left, width: fit.bedW, top: toPx({ x: 0, y: BAULK_LINE_Y }).y, height: 1, backgroundColor: LINE }]} />
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
                    transform: [{ scale: dragging?.id === ball.id ? 1.3 : 1 }],
                  },
                ]}
              >
                <View style={[styles.shine, { width: fit.d * 0.32, height: fit.d * 0.32, borderRadius: fit.d * 0.16 }]} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  box: { flex: 1 },
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
});
