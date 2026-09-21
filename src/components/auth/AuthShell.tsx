import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FONTS, RADIUS, SPACING } from "../../constants";

/**
 * The frame for signing in and signing up: the scoreboard strip at the top, with the name and
 * the seven balls in the order of their value, then the form on the page below.
 */

/** Red, then the colours from yellow (2) to black (7). */
const VALUE_ORDER = [
  { colour: "#D0142F", value: 1 },
  { colour: "#F2C230", value: 2 },
  { colour: "#1F8A4C", value: 3 },
  { colour: "#7A4B2A", value: 4 },
  { colour: "#1B6FD0", value: 5 },
  { colour: "#F29AC0", value: 6 },
  { colour: "#1A1E20", value: 7 },
];

type Props = {
  /** A line under the name, in the scoreboard's voice. */
  strapline: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export const AuthShell = ({ strapline, title, subtitle, children }: Props) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The strip is the scoreboard green in both themes, so the clock sits on it in white. */}
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ------------------------------------------------ the scoreboard strip */}
          <View
            style={[
              styles.hero,
              { backgroundColor: colors.board, borderBottomColor: colors.boardRule, paddingTop: insets.top + SPACING.xl },
            ]}
          >
            <Text style={[styles.wordmark, { color: colors.boardText }]} accessibilityRole="header">
              SNOOKER LAB
            </Text>
            <Text style={[styles.strapline, { color: colors.boardMuted }]}>{strapline}</Text>

            <View style={styles.balls} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {VALUE_ORDER.map((ball) => (
                <View key={ball.value} style={styles.ballCell}>
                  <View
                    style={[
                      styles.ball,
                      {
                        backgroundColor: ball.colour,
                        borderColor: ball.value === 7 ? colors.boardMuted : "transparent",
                      },
                    ]}
                  >
                    <View style={styles.shine} />
                  </View>
                  <Text style={[styles.value, { color: colors.boardMuted }]}>{ball.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ------------------------------------------------ the form */}
          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/** A notice or problem shown above the form. */
export const AuthBanner = ({ tone, message }: { tone: "info" | "danger"; message: string }) => {
  const { colors } = useAppTheme();
  const colour = tone === "danger" ? colors.danger : colors.primary;
  return (
    <View
      style={[styles.banner, { borderColor: colour, backgroundColor: colors.surface }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.bannerBar, { backgroundColor: colour }]} />
      <Text style={[styles.bannerText, { color: colors.text }]}>{message}</Text>
    </View>
  );
};

const BALL = 22;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },

  hero: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    borderBottomWidth: 3,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  wordmark: { fontFamily: FONTS.boardHeavy, fontSize: 40, letterSpacing: 4, lineHeight: 44 },
  strapline: { fontFamily: FONTS.boardLabel, fontSize: 15, letterSpacing: 1.6, marginTop: 2 },
  balls: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.xl, maxWidth: 360 },
  ballCell: { alignItems: "center", gap: 4 },
  ball: { width: BALL, height: BALL, borderRadius: BALL / 2, borderWidth: 1 },
  shine: {
    position: "absolute",
    top: 4,
    left: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  value: { fontFamily: FONTS.board, fontSize: 13 },

  body: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: SPACING.xs, marginBottom: SPACING.lg },

  banner: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    marginBottom: SPACING.lg,
  },
  bannerBar: { width: 4 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600", padding: SPACING.md },
});
