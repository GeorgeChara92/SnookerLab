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
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";
import { FONTS } from "../../constants";

/**
 * The opening shot: a break-off on a full-size table.
 *
 * The table is drawn to the real proportions - a 2:1 bed, the baulk line 737mm from the bottom
 * cushion, the D, and the colours on their spots - with the reds racked behind the pink. A cue
 * addresses the cue ball on the baulk line, draws back and strikes; the cue ball runs up past
 * the pink into the side of the pack, the reds scatter, and it comes off the side cushion back
 * towards baulk. Then the name settles in and the app shows through. About three seconds; a tap
 * skips it, and with Reduce Motion on the table simply fades.
 */

// ---------------------------------------------------------------------------- colours
const ROOM = "#07110D";
const RAIL = "#3E2616";
const RAIL_EDGE = "#5A3A22";
const CUSHION = "#0B3324";
const BAIZE = "#0F4A33";
const BAIZE_LIGHT = "#15603F";
const LINE = "rgba(255,255,255,0.28)";
const POCKET = "#030605";
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

/** When each part of the shot happens, in milliseconds from the start. */
const T = {
  table: 320,
  cueIn: 260,
  draw: 480,
  strike: 880,
  follow: 990,
  contactAfter: 360, // the cue ball's run from the strike to the pack
  name: 1900,
  leave: 2800,
  fade: 380,
};

/** A fixed spread, so the break is the same every time. */
const jitter = (index: number, salt: number) => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

type Point = { x: number; y: number };

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
};

export const BreakOffSplash = ({ fontsReady, onFinish }: Props) => {
  const { width, height } = useWindowDimensions();
  const finished = useRef(false);

  // ---------------------------------------------------------------- laying out the table
  const layout = useMemo(() => {
    const rail = Math.round(Math.min(width, height) * 0.04);
    const margin = 10;
    // The bed is 2:1; fit it to whichever of width or height runs out first.
    const bedW = Math.min(
      width - 2 * (rail + margin),
      (height - 2 * (rail + margin) - 40) / (TABLE_LENGTH / TABLE_WIDTH)
    );
    const bedL = bedW * (TABLE_LENGTH / TABLE_WIDTH);
    const left = (width - bedW) / 2;
    const top = (height - bedL) / 2;
    const s = bedW / TABLE_WIDTH; // px per mm
    // True to scale the balls are specks on a phone, so they are drawn a little larger.
    const d = Math.max(11, BALL_MM * s * 1.35);
    const cx = left + bedW / 2;
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

    // The cue ball sits on the baulk line between the brown and the yellow and is played up the
    // right of the pink, thin into the right-hand side of the pack.
    const cueStart = { x: cx + dR * 0.55, y: baulkY };
    const aimAt = { x: rack[9].x + d * 0.55, y: rack[9].y }; // just right of the fourth row's end
    const len = Math.hypot(aimAt.x - cueStart.x, aimAt.y - cueStart.y);
    const dir = { x: (aimAt.x - cueStart.x) / len, y: (aimAt.y - cueStart.y) / len };
    let travel = len;
    let struck = 9;
    rack.forEach((red, index) => {
      const t = firstTouch(cueStart, dir, red, d);
      if (t !== null && t < travel) {
        travel = t;
        struck = index;
      }
    });
    const contact = { x: cueStart.x + dir.x * travel, y: cueStart.y + dir.y * travel };
    // Off the right cushion and back down into baulk, clear of the colours.
    const cushion = { x: left + bedW - d / 2, y: contact.y + bedL * 0.16 };
    const rest = { x: cx + bedW * 0.22, y: top + bedL * 0.9 };

    // Where the reds come to rest: over the whole bed, apart from each other and the colours,
    // clear of the name and of the cue ball's resting place.
    const avoid = [...Object.values(colours), rest];
    const nameTop = height * 0.44;
    const nameBottom = height * 0.56;
    const spots: Point[] = [];
    for (let k = 0; spots.length < rack.length && k < 2000; k += 1) {
      const px = left + d + (bedW - 2 * d) * jitter(k, 7);
      const py = top + d + (bedL - 2 * d) * jitter(k, 8);
      if (py > nameTop && py < nameBottom) continue;
      if (avoid.some((ball) => Math.hypot(ball.x - px, ball.y - py) < d * 2.6)) continue;
      if (spots.some((spot) => Math.hypot(spot.x - px, spot.y - py) < d * 2.2)) continue;
      spots.push({ x: px, y: py });
    }
    // Each red goes to the spot lying in its own direction from the contact, so the pack
    // bursts outwards from where it was hit.
    const angle = (p: Point) => Math.atan2(p.y - contact.y, p.x - contact.x);
    const rackOrder = rack.map((red, index) => ({ ...red, index })).sort((a, b) => angle(a) - angle(b));
    const spotOrder = [...spots].sort((a, b) => angle(a) - angle(b));
    const reds = rack.map((red) => ({ ...red, to: { x: red.x, y: red.y }, delay: 0 }));
    rackOrder.forEach((red, order) => {
      const distance = Math.hypot(red.x - rack[struck].x, red.y - rack[struck].y);
      reds[red.index] = {
        ...red,
        to: spotOrder[order] ?? { x: red.x, y: red.y },
        // The hit travels through the pack: balls further from the contact move a touch later.
        delay: (distance / d) * 22 + jitter(red.index, 4) * 30,
      };
    });

    return {
      rail,
      bedW,
      bedL,
      left,
      top,
      d,
      cx,
      baulkY,
      dR,
      colours,
      reds,
      cueStart,
      contact,
      cushion,
      rest,
      cueAngle: (Math.atan2(dir.y, dir.x) * 180) / Math.PI + 90,
      cueLength: Math.max(height * 0.55, 320),
    };
  }, [height, width]);

  const { rail, bedW, bedL, left, top, d, baulkY, dR, colours, reds, cueStart, contact, cushion, rest } = layout;

  // ---------------------------------------------------------------- the motion
  const tableIn = useRef(new Animated.Value(0)).current;
  const cueOpacity = useRef(new Animated.Value(0)).current;
  const cueTip = useRef(new Animated.Value(0)).current; // 0 address, 1 drawn back, 2 strike, 2.4 through
  const travel = useRef(new Animated.Value(0)).current;
  const after = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const scatter = useRef(reds.map(() => new Animated.Value(0))).current;
  const dim = useRef(new Animated.Value(0)).current;
  const name = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(1)).current;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(leave, { toValue: 0, duration: T.fade, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      () => onFinish()
    );
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          tableIn.setValue(1);
          dim.setValue(1);
          name.setValue(1);
          timer = setTimeout(finish, 700);
          return;
        }

        const to = (
          value: Animated.Value,
          toValue: number,
          duration: number,
          easing: (t: number) => number,
          delay = 0
        ) => Animated.timing(value, { toValue, duration, easing, delay, useNativeDriver: true });
        // The tip meets the ball a little before the end of the follow-through.
        const strikeAt = T.follow - 110;
        const contactAt = strikeAt + T.contactAfter;

        Animated.parallel([
          to(tableIn, 1, T.table, Easing.out(Easing.quad)),
          // The cue: in, a slow draw back, a quick strike through, and away.
          to(cueOpacity, 1, 200, Easing.out(Easing.quad), T.cueIn),
          Animated.sequence([
            Animated.delay(T.draw),
            to(cueTip, 1, T.strike - T.draw, Easing.inOut(Easing.quad)),
            to(cueTip, 2, T.follow - T.strike, Easing.in(Easing.quad)),
            to(cueTip, 2.4, 220, Easing.out(Easing.quad)),
          ]),
          to(cueOpacity, 0, 320, Easing.in(Easing.quad), T.follow + 180),
          // The cue ball: up the table to the pack, then off the cushion back to baulk.
          to(travel, 1, T.contactAfter, Easing.out(Easing.quad), strikeAt),
          to(after, 1, 950, Easing.out(Easing.cubic), contactAt),
          to(ripple, 1, 450, Easing.out(Easing.quad), contactAt),
          ...scatter.map((value, index) =>
            to(value, 1, 760 + jitter(index, 5) * 300, Easing.out(Easing.cubic), contactAt + reds[index].delay)
          ),
          to(dim, 1, 450, Easing.out(Easing.quad), T.name - 150),
          to(name, 1, 420, Easing.out(Easing.back(1.4)), T.name),
        ]).start();

        timer = setTimeout(finish, T.leave);
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Plays once, on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- the cue ball's path
  const cueBallX = Animated.add(
    travel.interpolate({ inputRange: [0, 1], outputRange: [0, contact.x - cueStart.x] }),
    after.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, cushion.x - contact.x, rest.x - contact.x] })
  );
  const cueBallY = Animated.add(
    travel.interpolate({ inputRange: [0, 1], outputRange: [0, contact.y - cueStart.y] }),
    after.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, cushion.y - contact.y, rest.y - contact.y] })
  );

  // The cue lies along the line of the shot. Its tip starts a little behind the ball, draws back,
  // then goes through to where the ball was.
  const tipGap = cueTip.interpolate({
    inputRange: [0, 1, 2, 2.4],
    outputRange: [d * 1.4, d * 4.2, d * 0.5, -d * 0.6],
  });
  const cueW = Math.max(7, d * 0.55);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: leave }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Snooker Lab. Tap to skip the opening."
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: tableIn }]}>
          {/* ------------------------------------------------ rails, bed and pockets */}
          <View
            style={[
              styles.rail,
              {
                left: left - rail,
                top: top - rail,
                width: bedW + rail * 2,
                height: bedL + rail * 2,
                borderRadius: rail * 0.9,
                backgroundColor: RAIL,
                borderColor: RAIL_EDGE,
              },
            ]}
          />
          <View style={[styles.bed, { left, top, width: bedW, height: bedL, backgroundColor: BAIZE, borderColor: CUSHION }]}>
            {/* The light from the lamp above the table. */}
            <View
              style={{
                position: "absolute",
                width: bedW * 1.6,
                height: bedL * 0.9,
                borderRadius: bedW,
                left: -bedW * 0.3,
                top: bedL * 0.05,
                backgroundColor: BAIZE_LIGHT,
                opacity: 0.45,
              }}
            />
          </View>

          {[
            [left, top],
            [left + bedW, top],
            [left - d * 0.2, top + bedL / 2],
            [left + bedW + d * 0.2, top + bedL / 2],
            [left, top + bedL],
            [left + bedW, top + bedL],
          ].map(([px, py], index) => (
            <View
              key={index}
              style={[
                styles.pocket,
                { width: d * 1.9, height: d * 1.9, borderRadius: d * 0.95, left: px - d * 0.95, top: py - d * 0.95 },
              ]}
            />
          ))}

          {/* ------------------------------------------------ the baulk line and the D */}
          <View style={[styles.line, { left, width: bedW, top: baulkY - 0.5 }]} />
          <View
            style={[
              styles.dee,
              { width: dR * 2, height: dR * 2, borderRadius: dR, left: layout.cx - dR, top: baulkY - dR },
            ]}
          />

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
                opacity: ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] }),
                transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3] }) }],
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
                    { translateX: scatter[index].interpolate({ inputRange: [0, 1], outputRange: [0, red.to.x - red.x] }) },
                    { translateY: scatter[index].interpolate({ inputRange: [0, 1], outputRange: [0, red.to.y - red.y] }) },
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
              {
                left: cueStart.x,
                top: cueStart.y,
                opacity: cueOpacity,
                transform: [{ rotate: `${layout.cueAngle}deg` }],
              },
            ]}
          >
            <Animated.View style={{ position: "absolute", left: -cueW / 2, top: 0, transform: [{ translateY: tipGap }] }}>
              <Svg width={cueW} height={layout.cueLength}>
                <Defs>
                  <LinearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#E9D3A6" />
                    <Stop offset="0.62" stopColor="#C99B5E" />
                    <Stop offset="0.66" stopColor="#2A1A10" />
                    <Stop offset="1" stopColor="#1A100A" />
                  </LinearGradient>
                </Defs>
                {/* Tapered from the tip to the butt, with a ferrule and a chalked tip. */}
                <Polygon
                  points={`${cueW * 0.3},0 ${cueW * 0.7},0 ${cueW},${layout.cueLength} 0,${layout.cueLength}`}
                  fill="url(#shaft)"
                />
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
  root: { backgroundColor: ROOM, zIndex: 100, elevation: 100 },
  rail: { position: "absolute", borderWidth: 1 },
  bed: { position: "absolute", overflow: "hidden", borderWidth: 3 },
  pocket: { position: "absolute", backgroundColor: POCKET },
  line: { position: "absolute", height: 1, backgroundColor: LINE },
  dee: { position: "absolute", borderWidth: 1, borderColor: "transparent", borderBottomColor: LINE },
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
