import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { DiagramBallColour, RoutineDiagram } from "../../types";
import { RADIUS, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";

/**
 * A snooker table, drawn from the drill's own ball positions.
 *
 * Positions are fractions of the playing surface, so a drill describes where balls go once and
 * it renders at any width. The table is drawn with plain views rather than an image, so it
 * stays sharp, themes with the app and costs nothing to ship.
 */

/** Playing surface is 11ft 8.5in by 5ft 10in, so it is almost exactly twice as long as it is wide. */
const TABLE_RATIO = 2;

/** A ball is 52.5mm across a 1778mm bed, a little over 3%. Nudged up so it reads on a phone. */
const BALL_SIZE_RATIO = 0.055;

/**
 * The balls keep their real colours whatever the app theme is doing, because they are sitting
 * on green cloth: a themed "black" that turns pale grey would simply be wrong here.
 */
const BALL_FILL: Record<DiagramBallColour, string> = {
  cue: "#F5F2E7",
  red: "#C8102E",
  yellow: "#E8B10B",
  green: "#1E7A46",
  brown: "#7A4B2A",
  blue: "#1763B6",
  pink: "#E191B4",
  black: "#14181A",
};

/** Labels sit on top of the ball, so they need the readable side of each colour. */
const LABEL_COLOUR: Record<DiagramBallColour, string> = {
  cue: "#1A1A1A",
  red: "#FFFFFF",
  yellow: "#1A1A1A",
  green: "#FFFFFF",
  brown: "#FFFFFF",
  blue: "#FFFFFF",
  pink: "#1A1A1A",
  black: "#FFFFFF",
};

const CLOTH = "#12694A";
const CLOTH_DARK = "#0E5A3F";
const CUSHION = "#5A3A1E";
const MARKING = "rgba(255, 255, 255, 0.28)";

/** Corner and middle pockets, in the same fractional coordinates as the balls. */
const POCKETS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 0.5],
  [1, 0.5],
  [0, 1],
  [1, 1],
];

/** The baulk line sits 29in up a 140.5in bed; the D has an 11.5in radius across a 70.5in width. */
const BAULK_Y = 0.206;
const D_RADIUS = 0.163;

export const TableDiagram = ({ diagram, width = 250 }: { diagram: RoutineDiagram; width?: number }) => {
  const { colors } = useAppTheme();

  const height = width * TABLE_RATIO;
  const ball = Math.round(width * BALL_SIZE_RATIO);

  // y runs from the baulk cushion up the table, so it is flipped to screen coordinates.
  const left = (x: number) => x * width - ball / 2;
  const top = (y: number) => (1 - y) * height - ball / 2;

  return (
    <View style={styles.wrap}>
      <View style={[styles.table, { width, height, backgroundColor: CLOTH, borderColor: CUSHION }]}>
        <View style={[styles.cloth, { backgroundColor: CLOTH_DARK }]} />

        <View style={[styles.baulkLine, { top: (1 - BAULK_Y) * height, backgroundColor: MARKING }]} />
        {/* The D bulges towards the baulk cushion, so only the half below the line is drawn. */}
        <View
          style={[
            styles.dClip,
            {
              width: D_RADIUS * 2 * width,
              height: D_RADIUS * width,
              left: (0.5 - D_RADIUS) * width,
              top: (1 - BAULK_Y) * height,
            },
          ]}
        >
          <View
            style={[
              styles.dArc,
              {
                width: D_RADIUS * 2 * width,
                height: D_RADIUS * 2 * width,
                borderRadius: D_RADIUS * width,
                top: -D_RADIUS * width,
                borderColor: MARKING,
              },
            ]}
          />
        </View>

        {POCKETS.map(([x, y], index) => (
          <View
            key={`pocket-${index}`}
            style={[
              styles.pocket,
              {
                width: ball * 1.5,
                height: ball * 1.5,
                borderRadius: ball * 0.75,
                left: x * width - ball * 0.75,
                top: (1 - y) * height - ball * 0.75,
              },
            ]}
          />
        ))}

        {(diagram.lines ?? []).map((line, index) => {
          const x1 = line.from[0] * width;
          const y1 = (1 - line.from[1]) * height;
          const x2 = line.to[0] * width;
          const y2 = (1 - line.to[1]) * height;
          const length = Math.hypot(x2 - x1, y2 - y1);
          const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

          return (
            <View
              key={`line-${index}`}
              style={[
                styles.line,
                {
                  width: length,
                  left: x1,
                  top: y1,
                  borderColor: line.kind === "shot" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)",
                  borderStyle: line.kind === "shot" ? "solid" : "dashed",
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {diagram.balls.map((item, index) => (
          <View
            key={`ball-${index}`}
            style={[
              styles.ball,
              {
                width: ball,
                height: ball,
                borderRadius: ball / 2,
                left: left(item.x),
                top: top(item.y),
                backgroundColor: BALL_FILL[item.colour],
                borderColor: item.colour === "cue" ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.25)",
              },
            ]}
          >
            {item.label ? (
              <Text style={[styles.ballLabel, { color: LABEL_COLOUR[item.colour], fontSize: ball * 0.55 }]}>
                {item.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {diagram.caption ? (
        <Text style={[styles.caption, { color: colors.textMuted, maxWidth: width + 40 }]}>{diagram.caption}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  table: {
    borderWidth: 6,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
  },
  cloth: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  baulkLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
  },
  dClip: {
    position: "absolute",
    overflow: "hidden",
  },
  dArc: {
    position: "absolute",
    left: 0,
    borderWidth: 1,
  },
  pocket: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  line: {
    position: "absolute",
    height: 0,
    borderTopWidth: 1,
    transformOrigin: "left center",
  },
  ball: {
    position: "absolute",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ballLabel: {
    fontWeight: "800",
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    fontWeight: "600",
  },
});
