import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const UNLOCKS = ["Your booking diary and calendar", "Your client list and session notes", "Homework and broadcast groups"];

/**
 * A coach feature behind the Coach plan: without the plan, the screen shows faded under frosted
 * glass with a lock and the way to subscribe - so a coach can see what they're getting, but not use
 * it. Lifts the moment the plan is active (the account's coach_subscription_active, set by the
 * server after it checks the purchase with RevenueCat).
 */
export const CoachPlanGate = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const active = useAuthStore((state) => state.user?.coach_subscription_active ?? false);
  if (active) return <>{children}</>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The feature itself, faded and untouchable, so the glass has something real behind it. */}
      <View pointerEvents="none" style={styles.behind} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background}99`, `${colors.background}E6`, colors.background]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.centre} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: `${colors.surface}F2`, borderColor: colors.boardRule }]}>
          <View style={[styles.lock, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
            <MaterialCommunityIcons name="lock-outline" size={26} color={colors.boardRule} />
          </View>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.accent }]}>
            COACH PLAN
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Unlock {title}</Text>
          <View style={styles.list}>
            {UNLOCKS.map((line) => (
              <View key={line} style={styles.item}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
                <Text style={[styles.itemText, { color: colors.text }]}>{line}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => navigation.navigate("ProfileModal", { screen: "CoachPlan" })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>See the Coach plan</Text>
          </Pressable>
          <Text style={[styles.note, { color: colors.textMuted }]}>Already subscribed? Open the plan to restore it.</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  behind: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
  centre: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  card: { width: "100%", maxWidth: 420, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: "center", gap: SPACING.sm },
  lock: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: SPACING.xs },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.4 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  list: { alignSelf: "stretch", gap: 8, marginVertical: SPACING.sm },
  item: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  itemText: { flex: 1, fontSize: 14, fontWeight: "600" },
  button: { alignSelf: "stretch", minHeight: HIT_TARGET + 4, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "800" },
  note: { fontSize: 12, textAlign: "center" },
});
