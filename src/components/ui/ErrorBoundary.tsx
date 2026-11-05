import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { logAppError } from "../../features/errors/errorLog";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** What shows in place of the app when a screen fails to draw, instead of a blank white screen. */
const Fallback = ({ error, onRetry }: { error: Error; onRetry: () => void }) => {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      accessibilityRole="alert"
    >
      <View style={[styles.board, { backgroundColor: colors.board }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#FFFFFF" />
        <Text style={styles.boardLabel} maxFontSizeMultiplier={1.4}>
          SOMETHING WENT WRONG
        </Text>
      </View>
      <Text style={[styles.body, { color: colors.text }]}>
        That screen hit a problem and couldn't open. What you've saved is still there.
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        Try again. If it keeps happening, tell us what you were doing from Send feedback in your profile.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Try again</Text>
      </Pressable>
      {__DEV__ ? (
        <Text style={[styles.detail, { color: colors.textMuted }]} selectable>
          {error.name}: {error.message}
        </Text>
      ) : null}
    </ScrollView>
  );
};

type Props = { children: React.ReactNode };
type State = { error: Error | null; attempt: number };

/**
 * Catches any screen that throws while drawing, logs it, and offers to try again. "Try again"
 * rebuilds everything inside it from scratch, so the app reopens on its first screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    void logAppError(error, "render", { componentStack: info.componentStack ?? null });
  }

  private retry = () => this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));

  render() {
    if (this.state.error) return <Fallback error={this.state.error} onRetry={this.retry} />;
    // A new key on retry remounts the tree rather than re-rendering the broken one.
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: SPACING.xl, gap: SPACING.lg },
  board: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  boardLabel: { flexShrink: 1, color: "#FFFFFF", fontFamily: FONTS.boardHeavy, fontSize: 22, letterSpacing: 1.5 },
  body: { fontSize: 16, lineHeight: 23 },
  button: {
    minHeight: Math.max(HIT_TARGET, 50),
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  buttonText: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 13, lineHeight: 18 },
});
