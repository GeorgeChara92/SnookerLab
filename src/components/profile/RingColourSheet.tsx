import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useAppTheme } from "../../hooks/useAppTheme";
import { PlayerAvatar } from "./PlayerAvatar";
import { hexToHsl, hslToHex, parseHex, type AvatarSpec, type HexColour } from "../../features/profile/avatarSpec";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Colouring the ring yourself, once the black is earned. Drag for the colour and the shade, or
 * type a hex code if you already know the one you want.
 */

const TRACK_HEIGHT = 30;
const THUMB = 30;

/** A few to start from, chosen to sit well on the green of the app. */
const SUGGESTIONS: HexColour[] = [
  "#C9A44C",
  "#1BA39C",
  "#6B3FA0",
  "#E8731B",
  "#4FA3E0",
  "#8E1B2E",
  "#5ED3A1",
  "#56636B",
];

/**
 * One slider drawn as a gradient. The thumb follows the finger from wherever it lands, so a tap
 * anywhere on the track jumps straight there.
 */
const GradientSlider = ({
  stops,
  value,
  onChange,
  label,
  id,
}: {
  stops: string[];
  /** 0 to 1 along the track. */
  value: number;
  onChange: (value: number) => void;
  label: string;
  id: string;
}) => {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const start = useRef(0);
  const widthRef = useRef(0);
  const change = useRef(onChange);
  change.current = onChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          start.current = event.nativeEvent.locationX;
          if (widthRef.current) change.current(Math.max(0, Math.min(1, start.current / widthRef.current)));
        },
        onPanResponderMove: (_, gesture) => {
          if (!widthRef.current) return;
          change.current(Math.max(0, Math.min(1, (start.current + gesture.dx) / widthRef.current)));
        },
      }),
    []
  );

  return (
    <View style={styles.sliderBlock}>
      <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>{label}</Text>
      <View
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width;
          setWidth(event.nativeEvent.layout.width);
        }}
        style={styles.track}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          onChange(Math.max(0, Math.min(1, value + (event.nativeEvent.actionName === "increment" ? 0.05 : -0.05))))
        }
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height={TRACK_HEIGHT}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                {stops.map((colour, index) => (
                  <Stop key={index} offset={index / (stops.length - 1)} stopColor={colour} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={TRACK_HEIGHT} rx={TRACK_HEIGHT / 2} fill={`url(#${id})`} />
          </Svg>
        </View>
        {width ? (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: Math.max(0, Math.min(1, value)) * (width - THUMB),
                borderColor: "#FFFFFF",
                shadowColor: "#000000",
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The avatar as it stands, for the preview. */
  draft: AvatarSpec;
  /** Where the sliders start: the current custom colour, or a first suggestion. */
  initial: HexColour;
  onPick: (colour: HexColour) => void;
};

export const RingColourSheet = ({ visible, onClose, draft, initial, onPick }: Props) => {
  const { colors } = useAppTheme();
  const [hex, setHex] = useState<HexColour>(initial);
  const [hsl, setHsl] = useState(() => hexToHsl(initial));
  const [typed, setTyped] = useState(initial.slice(1));
  const [typedError, setTypedError] = useState(false);

  // Each time the sheet opens, it starts from the ring as it is now.
  useEffect(() => {
    if (!visible) return;
    setHex(initial);
    setHsl(hexToHsl(initial));
    setTyped(initial.slice(1));
    setTypedError(false);
  }, [initial, visible]);

  /** From the sliders: the hex follows them. */
  const slide = (next: { h: number; s: number; l: number }) => {
    setHsl(next);
    const colour = hslToHex(next.h, next.s, next.l);
    setHex(colour);
    setTyped(colour.slice(1));
    setTypedError(false);
  };

  /** From a typed code or a suggestion: exactly that colour, and the sliders move to match. */
  const applyExact = (colour: HexColour) => {
    setHex(colour);
    setHsl(hexToHsl(colour));
    setTyped(colour.slice(1));
    setTypedError(false);
  };

  // A shade slider always has room to move, even from pure black or white.
  const saturation = hsl.s || 70;
  const hueStops = [0, 60, 120, 180, 240, 300, 360].map((h) => hslToHex(h, saturation, 50));
  const shadeStops = [12, 50, 88].map((l) => hslToHex(hsl.h, saturation, l));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.sheet, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Your own colour</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Earned by clearing the colours. Pick any ring you like.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={[styles.close, { backgroundColor: colors.surfaceMuted }]}
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" scrollEnabled>
          <View style={styles.preview}>
            <PlayerAvatar spec={{ ...draft, ball: hex }} size={112} />
            <Text style={[styles.previewHex, { color: colors.text }]}>{hex}</Text>
          </View>

          <GradientSlider
            id="ring-hue"
            label="COLOUR"
            stops={hueStops}
            value={hsl.h / 360}
            onChange={(value) => slide({ ...hsl, s: saturation, h: Math.round(value * 360) })}
          />
          <GradientSlider
            id="ring-shade"
            label="SHADE"
            stops={shadeStops}
            value={(hsl.l - 12) / 76}
            onChange={(value) => slide({ ...hsl, s: saturation, l: Math.round(12 + value * 76) })}
          />

          <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>HEX CODE</Text>
          <View
            style={[
              styles.hexField,
              { backgroundColor: colors.surface, borderColor: typedError ? colors.danger : colors.border },
            ]}
          >
            <Text style={[styles.hexHash, { color: colors.textMuted }]}>#</Text>
            <TextInput
              value={typed}
              onChangeText={(text) => {
                const cleaned = text
                  .replace(/[^0-9a-f]/gi, "")
                  .slice(0, 6)
                  .toUpperCase();
                setTyped(cleaned);
                const colour = cleaned.length === 6 ? parseHex(cleaned) : null;
                if (colour) applyExact(colour);
                else setTypedError(false);
              }}
              onBlur={() => {
                const colour = parseHex(typed);
                if (colour) applyExact(colour);
                else setTypedError(true);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              placeholder="3A7BD5"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Hex code"
              returnKeyType="done"
              style={[styles.hexInput, { color: colors.text }]}
            />
            <View style={[styles.hexSwatch, { backgroundColor: hex, borderColor: colors.border }]} />
          </View>
          {typedError ? (
            <Text style={[styles.error, { color: colors.danger }]}>
              A hex code is 6 characters, 0 to 9 and A to F, like 3A7BD5.
            </Text>
          ) : null}

          <Text style={[styles.sliderLabel, { color: colors.textMuted, marginTop: SPACING.lg }]}>SUGGESTIONS</Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((colour) => (
              <Pressable
                key={colour}
                onPress={() => applyExact(colour)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${colour}`}
                accessibilityState={{ selected: hex === colour }}
                hitSlop={4}
                style={[
                  styles.suggestion,
                  { backgroundColor: colour, borderColor: hex === colour ? colors.text : "transparent" },
                ]}
              />
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => {
              onPick(hex);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Use ${hex} for the ring`}
            style={({ pressed }) => [styles.use, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.useText, { color: colors.onPrimary }]}>Use this colour</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  preview: { alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.lg },
  previewHex: { fontFamily: FONTS.board, fontSize: 22, letterSpacing: 1.6 },

  sliderBlock: { marginBottom: SPACING.lg },
  sliderLabel: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.6, marginBottom: SPACING.sm },
  track: { height: TRACK_HEIGHT, justifyContent: "center" },
  thumb: {
    position: "absolute",
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },

  hexField: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  hexHash: { fontFamily: FONTS.board, fontSize: 22 },
  hexInput: { flex: 1, fontFamily: FONTS.board, fontSize: 22, letterSpacing: 1.6, paddingVertical: SPACING.sm },
  hexSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  error: { fontSize: 13, marginTop: SPACING.xs },

  suggestions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: SPACING.sm },
  suggestion: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },

  footer: { borderTopWidth: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  use: { minHeight: HIT_TARGET + 4, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  useText: { fontSize: 16, fontWeight: "800" },
});
