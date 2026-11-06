import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";
import type { BallColourName } from "../../constants/theme";
import { RULE_GROUPS, getRuleTopic, type RuleTopic } from "../../features/rules/rules";
import type { PracticeStackParamList } from "../../types";

const VALUES: Array<{ ball: BallColourName; value: number }> = [
  { ball: "red", value: 1 },
  { ball: "yellow", value: 2 },
  { ball: "green", value: 3 },
  { ball: "brown", value: 4 },
  { ball: "blue", value: 5 },
  { ball: "pink", value: 6 },
  { ball: "black", value: 7 },
];

/** A ball with its value on it, in the scoreboard's numerals. Sizes to the space it's given. */
export const ValueBall = ({ ball, value, size }: { ball: BallColourName; value: number; size?: number }) => {
  const { colors } = useAppTheme();
  const look = colors.balls[ball];
  return (
    <View
      style={[
        styles.ball,
        size ? { width: size, height: size, flex: 0 } : null,
        { backgroundColor: look.base, borderColor: colors.boardRaised },
      ]}
    >
      <Text maxFontSizeMultiplier={1} style={[styles.ballValue, size ? { fontSize: size * 0.52 } : null, { color: look.on }]}>
        {value}
      </Text>
    </View>
  );
};

/** Every rule topic, grouped, under a scoreboard panel of what each ball is worth. */
export const RulesScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const { colors } = useAppTheme();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <BoardPanel kicker="THE RULES" aside="WPBSA">
        <View style={styles.ballRow} accessible accessibilityLabel="Ball values: red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7">
          {VALUES.map((item) => (
            <ValueBall key={item.ball} {...item} />
          ))}
        </View>
        <Text style={[styles.heroText, { color: colors.boardText }]}>
          A red, then a colour, until the reds are gone. Then the colours in order, yellow to black.
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.boardRule }]} />
        <View style={styles.foulRow} accessible accessibilityLabel="A foul costs 4 points at least, up to 7">
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.foulLabel, { color: colors.boardRule }]}>
            A FOUL COSTS
          </Text>
          <View style={styles.foulBalls}>
            {VALUES.slice(3).map((item) => (
              <ValueBall key={item.ball} {...item} size={26} />
            ))}
          </View>
        </View>
        <Text style={[styles.heroNote, { color: colors.boardMuted }]}>4 at least, or the value of the ball involved.</Text>
      </BoardPanel>

      {RULE_GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textMuted }]}>
            {group.title.toUpperCase()}
          </Text>
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {group.topics
              .map(getRuleTopic)
              .filter((topic): topic is RuleTopic => !!topic)
              .map((topic, index) => (
                <Pressable
                  key={topic.id}
                  onPress={() => navigation.navigate("RuleTopic", { topicId: topic.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${topic.title}. ${topic.short}`}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialCommunityIcons name={topic.icon as any} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{topic.title}</Text>
                    <Text style={[styles.rowShort, { color: colors.textMuted }]} numberOfLines={2}>
                      {topic.short}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} />
                </Pressable>
              ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.xl },
  ballRow: { flexDirection: "row", gap: 4 },
  ball: {
    flex: 1,
    maxWidth: 44,
    aspectRatio: 1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ballValue: { fontFamily: FONTS.board, fontSize: 19 },
  heroText: { fontSize: 15, lineHeight: 22, marginTop: SPACING.md, fontWeight: "600" },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.md, opacity: 0.7 },
  foulRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.sm },
  foulLabel: { fontFamily: FONTS.board, fontSize: 14, letterSpacing: 1.6 },
  foulBalls: { flexDirection: "row", gap: 6 },
  heroNote: { fontSize: 13, lineHeight: 18, marginTop: SPACING.sm },
  group: { gap: SPACING.sm },
  groupTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  list: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, minHeight: 72 },
  icon: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "800" },
  rowShort: { fontSize: 13, lineHeight: 18 },
});
