import React, { useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { FONTS } from "../../constants";

/**
 * The opening shot: a break-off, as it is played.
 *
 * The baize fills the screen with the cushions just out of view: the baulk line, the D, the
 * colours on their spots and the reds racked behind the pink, all to the real proportions. The
 * cue settles behind the cue ball between the brown and the yellow, draws back, pauses and
 * strikes. The cue ball runs up the table and takes the back-right corner red thin, goes
 * three cushions - top, right, then across to the left - and comes to rest behind the baulk
 * colours, while the corner red and its neighbours ease out of the pack. Then the name settles
 * in. About three and a half seconds; a tap skips it, and with Reduce Motion on it shows the table and name.
 *
 * Everything runs off one clock on the phone's animation thread, so the shot keeps its timing
 * while the app loads.
 */

// ---------------------------------------------------------------------------- colours
const BAIZE = "#0F4A33";
const BAIZE_LIGHT = "#17623F";
const BAIZE_EDGE = "#0A3625";
const LINE = "rgba(255,255,255,0.3)";
const TEXT = "#F4F1E8";
const BRASS = "#C9A44C";

const BALL = {
  red: ["#D0142F", "#8E0B20"],
  yellow: ["#F2C230", "#B08A10"],
  green: ["#1F8A4C", "#0F5A2E"],
  brown: ["#7A4B2A", "#4E2F18"],
  blue: ["#1B6FD0", "#0E4686"],
  pink: ["#F29AC0", "#C0648C"],
  black: ["#1A1E20", "#000000"],
  cue: ["#F7F4EA", "#C9C4B4"],
} as const;

// ---------------------------------------------------------------------------- the table in mm
const TABLE_LENGTH = 3569;
const TABLE_WIDTH = 1778;
const BALL_MM = 52.5;
const BAULK_FROM_BOTTOM = 737;
const D_RADIUS = 292;
const BLACK_FROM_TOP = 324;
/** How far past the screen the cushions sit, so the pockets and rails stay out of sight. */
const OVERHANG = 14;

/** When each part of the shot happens, in milliseconds on the one clock. */
const T = {
  tableIn: [0, 300],
  cueIn: [200, 450],
  // The cue: at the ball, one smooth draw back, a moment's pause, then through.
  cue: [450, 980, 1100, 1210, 1320],
  cueOut: [1380, 1630],
  travel: [1200, 1540], // cue ball from the strike to the pack
  around: [1540, 2780], // three cushions and back to baulk
  ripple: [1540, 1840],
  reds: 1540,
  dim: [2580, 2880],
  name: [2660, 3000],
  end: 3350,
  /** The app starts loading underneath once the cue ball is on its way round. */
  loadApp: 2000,
  fade: 300,
};

/**
 * An eased move over a window of the clock, as points on a line. The native animation driver
 * cannot run an easing inside an interpolation, so the curve is sampled into short straight steps
 * instead - close enough that the eye cannot tell.
 */
const SAMPLES = 12;
const easedStops = (times: number[], values: number[], easing: (t: number) => number) => {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let leg = 0; leg < times.length - 1; leg += 1) {
    const [t0, t1, v0, v1] = [times[leg], times[leg + 1], values[leg], values[leg + 1]];
    for (let i = leg === 0 ? 0 : 1; i <= SAMPLES; i += 1) {
      const f = i / SAMPLES;
      inputRange.push(t0 + (t1 - t0) * f);
      outputRange.push(v0 + (v1 - v0) * easing(f));
    }
  }
  return { inputRange, outputRange };
};

type Point = { x: number; y: number };

const jitter = (index: number, salt: number) => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** How far along a ray from `from` (unit direction `dir`) a ball first touches one at `centre`. */
const firstTouch = (from: Point, dir: Point, centre: Point, d: number) => {
  const fx = from.x - centre.x;
  const fy = from.y - centre.y;
  const b = fx * dir.x + fy * dir.y;
  const c = fx * fx + fy * fy - d * d;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
};

const Ball = ({ size, colours }: { size: number; colours: readonly [string, string] }) => (
  <View
    style={[
      styles.ball,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: colours[0], borderColor: colours[1] },
    ]}
  >
    <View style={[styles.shine, { width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }]} />
  </View>
);

type Props = {
  /** The wordmark waits for the scoreboard face; until then it uses the system font. */
  fontsReady: boolean;
  onFinish: () => void;
  /** Called part-way through, when the app can start loading underneath without slowing the shot. */
  onLoadApp?: () => void;
};

/** Everything about the table and the shot that depends only on the screen size. */
export const layoutBreak = (width: number, height: number) => {
  // The bed covers the whole screen, a touch larger than it, so the cushions sit just off the edges.
  const bedW = Math.max(width + 2 * OVERHANG, (height + 2 * OVERHANG) * (TABLE_WIDTH / TABLE_LENGTH));
  const bedL = bedW * (TABLE_LENGTH / TABLE_WIDTH);
  const left = (width - bedW) / 2;
  const top = (height - bedL) / 2;
  const s = bedW / TABLE_WIDTH; // px per mm
  // True to scale the balls are specks on a phone, so they are drawn a little larger.
  const d = Math.max(12, BALL_MM * s * 1.6);
  const cx = width / 2;
  const y = (mmFromTop: number) => top + mmFromTop * s;

  const baulkY = y(TABLE_LENGTH - BAULK_FROM_BOTTOM);
  const dR = D_RADIUS * s;
  const pinkY = y(TABLE_LENGTH / 4);

  const colours = {
    // Seen from the baulk end, the yellow is on the right of the D and the green on the left.
    yellow: { x: cx + dR, y: baulkY },
    brown: { x: cx, y: baulkY },
    green: { x: cx - dR, y: baulkY },
    blue: { x: cx, y: y(TABLE_LENGTH / 2) },
    pink: { x: cx, y: pinkY },
    black: { x: cx, y: y(BLACK_FROM_TOP) },
  };

  // The reds: apex as close to the pink as it can be without touching, rows back towards the black.
  const apexY = pinkY - d * 1.08;
  const rack: Array<Point & { row: number }> = [];
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      rack.push({ x: cx + (i - row / 2) * d * 1.02, y: apexY - row * d * 0.88, row });
    }
  }
  const CORNER = 14; // the right-hand end of the back row

  // The cue ball, between the brown and the yellow, played thin onto the lower right of the
  // corner red.
  const cueStart = { x: cx + dR * 0.6, y: baulkY };
  const onCorner = { x: rack[CORNER].x + d * 0.9, y: rack[CORNER].y + d * 0.43 };
  const len = Math.hypot(onCorner.x - cueStart.x, onCorner.y - cueStart.y);
  const dir = { x: (onCorner.x - cueStart.x) / len, y: (onCorner.y - cueStart.y) / len };
  let run = len + d;
  let struck = CORNER;
  rack.forEach((red, index) => {
    const t = firstTouch(cueStart, dir, red, d);
    if (t !== null && t < run) {
      run = t;
      struck = index;
    }
  });
  const contact = { x: cueStart.x + dir.x * run, y: cueStart.y + dir.y * run };

  // Round the table: top cushion, right cushion, across to the left, and back behind the colours.
  const edge = {
    left: Math.max(left, 0) + d / 2,
    right: Math.min(left + bedW, width) - d / 2,
    top: Math.max(top, 0) + d / 2,
  };
  const path: Point[] = [
    contact,
    { x: cx + bedW * 0.3, y: edge.top },
    // Low enough on the right, and high enough on the left, that the run across passes below the blue.
    { x: edge.right, y: top + bedL * 0.38 },
    { x: edge.left, y: baulkY - bedL * 0.035 },
    // Behind the brown and the green, towards the bottom cushion.
    { x: cx - dR * 0.25, y: baulkY + dR * 1.05 },
  ];
  const lengths = path.slice(1).map((point, index) => Math.hypot(point.x - path[index].x, point.y - path[index].y));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let covered = 0;
  const pathStops = [0, ...lengths.map((value) => (covered += value) / total)];

  // The pack barely opens on a break-off: the red that was hit and the two behind it come out,
  // and the rest shift a little away from the contact.
  const released: Record<number, Point> = {
    [struck]: { x: d * 3.2, y: -d * 2.2 },
    13: { x: d * 0.6, y: -d * 1.6 },
    9: { x: d * 1.3, y: d * 0.35 },
  };
  // The rest loosen evenly out from the front red - every gap grows by the same share - so the
  // pack eases open towards the back without any two balls running into each other, and the
  // front red stays by the pink.
  const SPREAD = 0.05;
  const reds = rack.map((red, index) => {
    const distance = Math.hypot(red.x - contact.x, red.y - contact.y);
    let move = released[index] ?? { x: (red.x - rack[0].x) * SPREAD, y: (red.y - rack[0].y) * SPREAD };
    // Should a red ever land on a colour (a very short screen), it stays where it was.
    const lands = { x: red.x + move.x, y: red.y + move.y };
    if (Object.values(colours).some((ball) => Math.hypot(ball.x - lands.x, ball.y - lands.y) < d * 1.02)) {
      move = { x: 0, y: 0 };
    }
    return { ...red, move, delay: (distance / d) * 24 + jitter(index, 4) * 20, big: index in released };
  });

  return { bedW, bedL, left, top, d, cx, baulkY, dR, colours, reds, cueStart, contact, path, pathStops, dir, struck };
};

export const BreakOffSplash = ({ fontsReady, onFinish, onLoadApp }: Props) => {
  const { width, height } = useWindowDimensions();
  const finished = useRef(false);
  const layout = useMemo(() => layoutBreak(width, height), [height, width]);
  const { bedW, bedL, top, d, cx, baulkY, dR, colours, reds, cueStart, contact, path, pathStops, dir } = layout;

  // ---------------------------------------------------------------- the clock
  const clock = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(1)).current;
  const loadedApp = useRef(false);

  const loadApp = () => {
    if (loadedApp.current) return;
    loadedApp.current = true;
    onLoadApp?.();
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    loadApp();
    Animated.timing(leave, { toValue: 0, duration: T.fade, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      () => onFinish()
    );
  };

  useEffect(() => {
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          clock.setValue(T.end);
          timers.push(setTimeout(finish, 900));
          return;
        }
        Animated.timing(clock, { toValue: T.end, duration: T.end, easing: Easing.linear, useNativeDriver: true }).start(
          ({ finished: done }) => done && finish()
        );
        timers.push(setTimeout(loadApp, T.loadApp));
      });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // Plays once, on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 0 to 1 over a window of the clock. */
  const phase = ([from, to]: number[], easing: (t: number) => number = Easing.linear) =>
    clock.interpolate({ ...easedStops([from, to], [0, 1], easing), extrapolate: "clamp" });

  const tableIn = phase(T.tableIn, Easing.out(Easing.quad));
  const cueOpacity = clock.interpolate({
    inputRange: [T.cueIn[0], T.cueIn[1], T.cueOut[0], T.cueOut[1]],
    outputRange: [0, 1, 1, 0],
    extrapolate: "clamp",
  });
  const tipGap = clock.interpolate({
    ...easedStops(T.cue, [d * 1.6, d * 4.6, d * 4.6, d * 0.5, -d * 0.8], Easing.inOut(Easing.quad)),
    extrapolate: "clamp",
  });

  // The cue ball: up the table to the pack, then round the cushions, slowing as it goes.
  const travel = phase(T.travel, Easing.out(Easing.quad));
  const around = phase(T.around, Easing.out(Easing.cubic));
  const cueBallX = Animated.add(
    travel.interpolate({ inputRange: [0, 1], outputRange: [0, contact.x - cueStart.x] }),
    around.interpolate({ inputRange: pathStops, outputRange: path.map((point) => point.x - contact.x) })
  );
  const cueBallY = Animated.add(
    travel.interpolate({ inputRange: [0, 1], outputRange: [0, contact.y - cueStart.y] }),
    around.interpolate({ inputRange: pathStops, outputRange: path.map((point) => point.y - contact.y) })
  );

  const ripple = phase(T.ripple, Easing.out(Easing.quad));
  const dim = phase(T.dim, Easing.out(Easing.quad));
  const name = phase(T.name, Easing.out(Easing.back(1.3)));
  const redMoves = reds.map((red) =>
    phase([T.reds + red.delay, T.reds + red.delay + (red.big ? 1000 : 450)], Easing.out(Easing.cubic))
  );

  const cueAngle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI + 90;
  const cueLength = Math.max(height * 0.55, 320);
  const cueW = Math.max(7, d * 0.5);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: leave }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Snooker Lab. Tap to skip the opening."
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: tableIn }]}>
          {/* ------------------------------------------------ the baize, lit from above */}
          <View
            style={{
              position: "absolute",
              width: bedW * 1.5,
              height: bedL * 0.95,
              borderRadius: bedW,
              left: cx - bedW * 0.75,
              top: top + bedL * 0.03,
              backgroundColor: BAIZE_LIGHT,
              opacity: 0.5,
            }}
          />
          <View style={[styles.edgeShade, { top: 0, height: height * 0.08 }]} />
          <View style={[styles.edgeShade, { bottom: 0, height: height * 0.08 }]} />

          {/* ------------------------------------------------ the baulk line and the D */}
          <View style={[styles.line, { left: 0, right: 0, top: baulkY - 0.5 }]} />
          {/* Drawn as an arc so it meets the baulk line at both ends. */}
          <Svg style={{ position: "absolute", left: cx - dR - 1, top: baulkY - 1 }} width={dR * 2 + 2} height={dR + 2}>
            <Path d={`M 1 1 A ${dR} ${dR} 0 0 0 ${dR * 2 + 1} 1`} stroke={LINE} strokeWidth={1} fill="none" />
          </Svg>

          {/* ------------------------------------------------ the colours on their spots */}
          {(Object.keys(colours) as Array<keyof typeof colours>).map((key) => (
            <View key={key} style={[styles.at, { left: colours[key].x - d / 2, top: colours[key].y - d / 2 }]}>
              <Ball size={d} colours={BALL[key]} />
            </View>
          ))}

          {/* ------------------------------------------------ the contact */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ripple,
              {
                width: d * 2,
                height: d * 2,
                borderRadius: d,
                left: contact.x - d,
                top: contact.y - d,
                opacity: ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.6] }) }],
              },
            ]}
          />

          {/* ------------------------------------------------ the reds */}
          {reds.map((red, index) => (
            <Animated.View
              key={index}
              style={[
                styles.at,
                {
                  left: red.x - d / 2,
                  top: red.y - d / 2,
                  transform: [
                    { translateX: redMoves[index].interpolate({ inputRange: [0, 1], outputRange: [0, red.move.x] }) },
                    { translateY: redMoves[index].interpolate({ inputRange: [0, 1], outputRange: [0, red.move.y] }) },
                  ],
                },
              ]}
            >
              <Ball size={d} colours={BALL.red} />
            </Animated.View>
          ))}

          {/* ------------------------------------------------ the cue ball */}
          <Animated.View
            style={[
              styles.at,
              {
                left: cueStart.x - d / 2,
                top: cueStart.y - d / 2,
                transform: [{ translateX: cueBallX }, { translateY: cueBallY }],
              },
            ]}
          >
            <Ball size={d} colours={BALL.cue} />
          </Animated.View>

          {/* ------------------------------------------------ the cue */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.cuePivot,
              { left: cueStart.x, top: cueStart.y, opacity: cueOpacity, transform: [{ rotate: `${cueAngle}deg` }] },
            ]}
          >
            <Animated.View style={{ position: "absolute", left: -cueW / 2, top: 0, transform: [{ translateY: tipGap }] }}>
              <Svg width={cueW} height={cueLength}>
                <Defs>
                  <LinearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#EBD6AA" />
                    <Stop offset="0.6" stopColor="#C99B5E" />
                    <Stop offset="0.64" stopColor="#2A1A10" />
                    <Stop offset="1" stopColor="#1A100A" />
                  </LinearGradient>
                </Defs>
                {/* Tapered from the tip to the butt, with a ferrule and a chalked tip. */}
                <Polygon points={`${cueW * 0.3},0 ${cueW * 0.7},0 ${cueW},${cueLength} 0,${cueLength}`} fill="url(#shaft)" />
                <Rect x={cueW * 0.3} y={0} width={cueW * 0.4} height={3} fill="#2B4E8C" />
                <Rect x={cueW * 0.28} y={3} width={cueW * 0.44} height={5} fill="#F2EEE2" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* ------------------------------------------------ the name */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.nameBlock,
            {
              top: height * 0.5 - 42,
              opacity: name,
              transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          <Text
            style={[styles.name, fontsReady ? { fontFamily: FONTS.boardHeavy } : styles.nameFallback]}
            accessibilityElementsHidden
          >
            SNOOKER LAB
          </Text>
          <View style={styles.rule} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: BAIZE, zIndex: 100, elevation: 100 },
  edgeShade: { position: "absolute", left: 0, right: 0, backgroundColor: BAIZE_EDGE, opacity: 0.55 },
  line: { position: "absolute", height: 1, backgroundColor: LINE },
  at: { position: "absolute" },
  ripple: { position: "absolute", borderWidth: 2, borderColor: "#FFFFFF" },
  ball: {
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 3,
  },
  shine: { position: "absolute", top: "14%", left: "20%", backgroundColor: "rgba(255,255,255,0.6)" },
  cuePivot: { position: "absolute", width: 0, height: 0 },
  dim: { backgroundColor: "rgba(3,8,6,0.55)" },
  nameBlock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  name: { color: TEXT, fontSize: 44, letterSpacing: 6 },
  nameFallback: { fontWeight: "900", fontSize: 36 },
  rule: { width: 72, height: 3, borderRadius: 2, backgroundColor: BRASS, marginTop: 10 },
});
