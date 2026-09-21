import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle, Defs, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { LevelReward } from "../../features/profile/levelRewards";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * The moment something is earned. How big the moment is depends on how hard it was: a bronze
 * achievement gets a medal and a spark, silver adds turning light, gold takes the whole screen
 * with confetti, and platinum adds a shockwave and a spotlight. Reaching a new level shows the
 * ring it earns and everything it unlocks.
 */

export type Tier = "bronze" | "silver" | "gold" | "platinum";

export type CelebrationItem =
  | {
      kind: "achievement";
      id: string;
      title: string;
      description: string;
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      tier: Tier;
      xpReward: number;
    }
  | {
      kind: "level";
      id: string;
      level: number;
      title: string;
      rewards: LevelReward[];
      /** The colour of the ring the level reaches. */
      ringColour: string;
    };

type TierLook = {
  label: string;
  /** Lit, base and shadow tones of the metal. */
  metal: [string, string, string];
  accent: string;
  sparks: number;
  rays: boolean;
  confetti: number;
  shockwave: boolean;
  fullScreen: boolean;
};

export const TIERS: Record<Tier, TierLook> = {
  bronze: {
    label: "BRONZE",
    metal: ["#F6C99A", "#C47A36", "#5A3010"],
    accent: "#D9924E",
    sparks: 12,
    rays: false,
    confetti: 0,
    shockwave: false,
    fullScreen: false,
  },
  silver: {
    label: "SILVER",
    metal: ["#FFFFFF", "#BCC5CC", "#535E67"],
    accent: "#D3DCE2",
    sparks: 18,
    rays: true,
    confetti: 0,
    shockwave: false,
    fullScreen: false,
  },
  gold: {
    label: "GOLD",
    metal: ["#FFF4B8", "#E2B436", "#77510E"],
    accent: "#F2C94C",
    sparks: 24,
    rays: true,
    confetti: 40,
    shockwave: false,
    fullScreen: true,
  },
  platinum: {
    label: "PLATINUM",
    metal: ["#FFFFFF", "#D8E6EE", "#71899A"],
    accent: "#BDEBFF",
    sparks: 30,
    rays: true,
    confetti: 64,
    shockwave: true,
    fullScreen: true,
  },
};

const CONFETTI_COLOURS = ["#C8102E", "#F2C230", "#1E8A4C", "#1F5FBF", "#E8779A", "#F4F1E6"];

const haptic = async (tier: Tier | "level") => {
  try {
    if (tier === "bronze") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (tier === "gold" || tier === "level") {
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), 320);
    }
    if (tier === "platinum") {
      [260, 460, 660].forEach((delay) =>
        setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), delay)
      );
    }
  } catch {
    // No haptics on this device.
  }
};

/** A struck medal: a milled metal rim, a dark face, the achievement's mark in the middle. */
const Medal = ({
  size,
  look,
  icon,
  id,
}: {
  size: number;
  look: TierLook;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: string;
}) => {
  const [lit, base, shadow] = look.metal;
  const r = size / 2;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!look.rays) return;
    Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, [look.rays, shine]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}-rim`} cx="35%" cy="28%" r="80%">
            <Stop offset="0" stopColor={lit} />
            <Stop offset="0.5" stopColor={base} />
            <Stop offset="1" stopColor={shadow} />
          </RadialGradient>
          <LinearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shadow} />
            <Stop offset="1" stopColor="#0B0E0D" />
          </LinearGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id}-rim)`} />
        {Array.from({ length: 36 }, (_, index) => {
          const angle = (index / 36) * Math.PI * 2;
          return (
            <Line
              key={index}
              x1={r + Math.cos(angle) * r * 0.86}
              y1={r + Math.sin(angle) * r * 0.86}
              x2={r + Math.cos(angle) * r * 0.97}
              y2={r + Math.sin(angle) * r * 0.97}
              stroke={shadow}
              strokeOpacity={0.35}
              strokeWidth={1.2}
            />
          );
        })}
        <Circle
          cx={r}
          cy={r}
          r={r * 0.76}
          fill={`url(#${id}-face)`}
          stroke={lit}
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>
        <MaterialCommunityIcons name={icon} size={size * 0.38} color={lit} />
      </View>
      {look.rays ? (
        <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: "hidden" }]} pointerEvents="none">
          <Animated.View
            style={[
              styles.shine,
              {
                width: size * 0.28,
                height: size * 1.6,
                top: -size * 0.3,
                transform: [
                  { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.6, size * 1.2] }) },
                  { rotate: "24deg" },
                ],
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
};

/** Light turning slowly behind the medal. */
const Rays = ({ size, colour }: { size: number; colour: string }) => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [spin]);
  const c = size / 2;
  const count = 18;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="rays-fade" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colour} stopOpacity={0.5} />
            <Stop offset="1" stopColor={colour} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {Array.from({ length: count }, (_, index) => {
          const a1 = (index / count) * Math.PI * 2;
          const a2 = a1 + (Math.PI * 2) / count / 2;
          return (
            <Path
              key={index}
              d={`M ${c} ${c} L ${c + Math.cos(a1) * c} ${c + Math.sin(a1) * c} L ${c + Math.cos(a2) * c} ${c + Math.sin(a2) * c} Z`}
              fill="url(#rays-fade)"
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
};

/** Sparks flying out from the middle. */
const Sparks = ({ count, colour, distance }: { count: number; colour: string; distance: number }) => {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        angle: (index / count) * Math.PI * 2 + Math.random() * 0.3,
        reach: distance * (0.7 + Math.random() * 0.5),
        size: 4 + Math.random() * 5,
        value: new Animated.Value(0),
      })),
    [count, distance]
  );
  useEffect(() => {
    Animated.stagger(
      12,
      sparks.map((spark) =>
        Animated.timing(spark.value, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [sparks]);
  return (
    <>
      {sparks.map((spark, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={{
            position: "absolute",
            width: spark.size,
            height: spark.size,
            borderRadius: spark.size / 2,
            backgroundColor: colour,
            opacity: spark.value.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
            transform: [
              {
                translateX: spark.value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.cos(spark.angle) * spark.reach],
                }),
              },
              {
                translateY: spark.value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.sin(spark.angle) * spark.reach],
                }),
              },
            ],
          }}
        />
      ))}
    </>
  );
};

/** Confetti falling from the top of the screen, in the colours of the balls. */
const Confetti = ({
  count,
  accent,
  width,
  height,
}: {
  count: number;
  accent: string;
  width: number;
  height: number;
}) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        w: 6 + Math.random() * 5,
        h: 10 + Math.random() * 8,
        colour: index % 3 === 0 ? accent : CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        delay: Math.random() * 700,
        duration: 2400 + Math.random() * 1600,
        value: new Animated.Value(0),
      })),
    [count, accent, width]
  );
  useEffect(() => {
    Animated.parallel(
      pieces.map((piece) =>
        Animated.timing(piece.value, {
          toValue: 1,
          duration: piece.duration,
          delay: piece.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            left: piece.x,
            top: -30,
            width: piece.w,
            height: piece.h,
            borderRadius: 2,
            backgroundColor: piece.colour,
            opacity: piece.value.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: piece.value.interpolate({ inputRange: [0, 1], outputRange: [0, height + 60] }) },
              { translateX: piece.value.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
              { rotate: piece.value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${piece.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};

/** A ring of light rushing outwards as the medal lands. */
const Shockwave = ({ size, colour }: { size: number; colour: string }) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 1100,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3,
        borderColor: colour,
        opacity: value.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
        transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.2] }) }],
      }}
    />
  );
};

/** The XP counting up, for the bigger moments. */
const useCountUp = (target: number, run: boolean) => {
  const [shown, setShown] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) {
      setShown(target);
      return;
    }
    const value = new Animated.Value(0);
    const id = value.addListener(({ value: next }) => setShown(Math.round(next)));
    Animated.timing(value, {
      toValue: target,
      duration: 1000,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => value.removeListener(id);
  }, [run, target]);
  return shown;
};

export const Celebration = ({
  item,
  onClose,
  onTryOn,
}: {
  item: CelebrationItem;
  onClose: () => void;
  /** Opens the avatar picker, for a level that unlocks something to wear. */
  onTryOn?: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLevel = item.kind === "level";
  const look = item.kind === "achievement" ? TIERS[item.tier] : null;
  const fullScreen = isLevel || Boolean(look?.fullScreen);
  const accent = look?.accent ?? (item.kind === "level" ? "#F2C94C" : colors.primary);

  const backdrop = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void haptic(item.kind === "achievement" ? item.tier : "level");
    Animated.sequence([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: fullScreen ? 5 : 6, tension: 90, useNativeDriver: true }),
        Animated.timing(text, {
          toValue: 1,
          duration: 420,
          delay: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [backdrop, fullScreen, item, pop, text]);

  const close = () => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0.85, duration: 180, useNativeDriver: true }),
      Animated.timing(text, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const xp = useCountUp(item.kind === "achievement" ? item.xpReward : 0, fullScreen);
  const medalSize = fullScreen ? Math.min(168, width * 0.42) : 108;
  const textStyle = {
    opacity: text,
    transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };
  const heroStyle = {
    transform: [
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
      ...(fullScreen ? [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] : []),
    ],
  };

  // The medal, or for a level the ring it earns with the number in it.
  const hero = (
    <View style={[styles.centre, { width: medalSize, height: medalSize }]}>
      {fullScreen ? <Rays size={medalSize * (fullScreen ? 3.4 : 2.4)} colour={accent} /> : null}
      {look?.shockwave || isLevel ? <Shockwave size={medalSize} colour={accent} /> : null}
      <Sparks count={look?.sparks ?? 24} colour={accent} distance={medalSize * (fullScreen ? 1.3 : 1)} />
      <Animated.View style={heroStyle}>
        {item.kind === "achievement" && look ? (
          <Medal size={medalSize} look={look} icon={item.icon} id={`medal-${item.id}`} />
        ) : item.kind === "level" ? (
          <View
            style={[
              styles.levelRing,
              {
                width: medalSize,
                height: medalSize,
                borderRadius: medalSize / 2,
                borderColor: item.ringColour,
                backgroundColor: "#0B1310",
              },
            ]}
          >
            <Text allowFontScaling={false} style={[styles.levelKicker, { color: "#9DB5AC" }]}>
              LEVEL
            </Text>
            <Text
              allowFontScaling={false}
              style={[
                styles.levelNumber,
                { color: "#F4F1E8", fontSize: medalSize * 0.46, lineHeight: medalSize * 0.5 },
              ]}
            >
              {item.level}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );

  const kicker = item.kind === "level" ? "LEVEL UP" : `${look?.label} ACHIEVEMENT`;

  const words =
    item.kind === "level" ? (
      <>
        <Text maxFontSizeMultiplier={1.2} style={[styles.kicker, { color: accent }]}>
          {kicker}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={[styles.titleLarge, { color: "#F4F1E8" }]}>
          {item.title}
        </Text>
        {item.rewards.length ? (
          <View style={[styles.rewards, { borderColor: "rgba(255,255,255,0.12)" }]}>
            <Text maxFontSizeMultiplier={1.2} style={[styles.rewardsKicker, { color: "#9DB5AC" }]}>
              UNLOCKED
            </Text>
            {item.rewards.map((reward) => (
              <View key={reward.label} style={styles.reward}>
                {reward.kind === "ring" ? (
                  <View style={[styles.rewardRing, { borderColor: reward.colour }]} />
                ) : (
                  <MaterialCommunityIcons
                    name={reward.kind === "outfit" ? "tshirt-crew-outline" : "palette-outline"}
                    size={22}
                    color="#F4F1E8"
                  />
                )}
                <Text style={[styles.rewardLabel, { color: "#F4F1E8" }]}>{reward.label}</Text>
                <View style={[styles.newTag, { backgroundColor: accent }]}>
                  <Text allowFontScaling={false} style={styles.newTagText}>
                    NEW
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.body, { color: "#B9C8C1" }]}>Keep going: the next level brings something new.</Text>
        )}
      </>
    ) : (
      <>
        <Text maxFontSizeMultiplier={1.2} style={[styles.kicker, { color: accent }]}>
          {kicker}
        </Text>
        <Text
          maxFontSizeMultiplier={1.2}
          style={[fullScreen ? styles.titleLarge : styles.title, { color: fullScreen ? "#F4F1E8" : colors.text }]}
        >
          {item.title}
        </Text>
        <Text style={[styles.body, { color: fullScreen ? "#B9C8C1" : colors.textMuted }]}>{item.description}</Text>
        <View style={[styles.xp, { borderColor: accent, backgroundColor: `${accent}1F` }]}>
          <MaterialCommunityIcons name="star-four-points" size={16} color={accent} />
          <Text allowFontScaling={false} style={[styles.xpText, { color: accent }]}>
            +{xp} XP
          </Text>
        </View>
      </>
    );

  const buttons = (
    <View style={styles.buttons}>
      {item.kind === "level" && item.rewards.length && onTryOn ? (
        <Pressable
          onPress={() => {
            close();
            setTimeout(onTryOn, 220);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: "#10140F" }]}>Try it on</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={close}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          fullScreen
            ? { borderWidth: 1.5, borderColor: `${accent}AA`, opacity: pressed ? 0.7 : 1 }
            : { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: fullScreen ? "#F4F1E8" : colors.text }]}>
          {item.kind === "level" && item.rewards.length ? "Later" : "Continue"}
        </Text>
      </Pressable>
    </View>
  );

  if (fullScreen) {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]}>
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Defs>
            <RadialGradient id="spot" cx="50%" cy="34%" r="70%">
              <Stop
                offset="0"
                stopColor={accent}
                stopOpacity={item.kind === "achievement" && item.tier === "platinum" ? 0.32 : 0.22}
              />
              <Stop offset="0.55" stopColor="#07100C" stopOpacity={1} />
              <Stop offset="1" stopColor="#030605" stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#spot)" />
        </Svg>
        <Confetti count={isLevel ? 30 : (look?.confetti ?? 0)} accent={accent} width={width} height={height} />
        <View style={[styles.full, { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={[styles.centre, styles.fullHero]}>{hero}</View>
          <Animated.View style={[styles.words, textStyle]}>{words}</Animated.View>
          <Animated.View style={[styles.fullButtons, textStyle]}>{buttons}</Animated.View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.centre, { backgroundColor: "rgba(0,0,0,0.74)", opacity: backdrop }]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.cardWrap, { width: Math.min(360, width - SPACING.lg * 2) }]}>
        <View style={[styles.centre, styles.cardHero]}>{hero}</View>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: accent,
              shadowColor: accent,
              paddingTop: medalSize / 2 + SPACING.md,
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <Animated.View style={[styles.words, textStyle]}>{words}</Animated.View>
          {buttons}
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
  shine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.35)" },
  levelRing: { borderWidth: 10, alignItems: "center", justifyContent: "center" },
  levelKicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 3 },
  levelNumber: { fontFamily: FONTS.boardHeavy },
  full: { flex: 1, justifyContent: "space-between", paddingHorizontal: SPACING.xl },
  fullHero: { flex: 1 },
  fullButtons: {},
  words: { alignItems: "center", gap: SPACING.sm },
  kicker: { fontFamily: FONTS.boardHeavy, fontSize: 15, letterSpacing: 4, textAlign: "center" },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  titleLarge: { fontSize: 34, fontWeight: "800", textAlign: "center", letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 22, textAlign: "center" },
  xp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginTop: SPACING.xs,
  },
  xpText: { fontFamily: FONTS.boardHeavy, fontSize: 20, letterSpacing: 0.5 },
  rewards: { alignSelf: "stretch", borderTopWidth: 1, marginTop: SPACING.md, paddingTop: SPACING.md, gap: SPACING.sm },
  rewardsKicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 2, textAlign: "center" },
  reward: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 36 },
  rewardRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 4 },
  rewardLabel: { flex: 1, fontSize: 16, fontWeight: "700" },
  newTag: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  newTagText: { fontFamily: FONTS.boardHeavy, fontSize: 11, letterSpacing: 1, color: "#10140F" },
  buttons: { gap: SPACING.sm, alignSelf: "stretch", marginTop: SPACING.lg },
  button: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "800" },
  cardWrap: { alignItems: "center" },
  cardHero: { position: "absolute", top: 0, zIndex: 2 },
  card: {
    alignSelf: "stretch",
    marginTop: 54,
    borderWidth: 1.5,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
});
