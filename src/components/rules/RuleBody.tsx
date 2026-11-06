import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BoardPanel } from "../scoreboard/Scoreboard";
import { TableDiagram } from "../scanSnooker/TableDiagram";
import { useAppTheme } from "../../hooks/useAppTheme";
import { RADIUS, SPACING } from "../../constants";
import { RULES_SOURCE, getRuleTopic, type RuleTopic, type RuleTopicId } from "../../features/rules/rules";

/**
 * One rule, top to bottom: the short answer on the scoreboard panel, a table position when there
 * is one, the detail, then the questions people actually ask. Used on the rule's own screen and
 * inside the foul sheet during live scoring, so it takes no navigation of its own.
 */
export const RuleBody = ({ topic, onOpenTopic }: { topic: RuleTopic; onOpenTopic?: (id: RuleTopicId) => void }) => {
  const { colors } = useAppTheme();
  const related = topic.related.map(getRuleTopic).filter((item): item is RuleTopic => !!item);

  return (
    <View style={styles.wrap}>
      <BoardPanel kicker="IN SHORT">
        <Text style={[styles.short, { color: colors.boardText }]}>{topic.short}</Text>
      </BoardPanel>

      {topic.diagram ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.diagram} accessible accessibilityLabel={`Table diagram. ${topic.diagram.caption}`}>
            <TableDiagram balls={topic.diagram.balls} readOnly landscape />
          </View>
          <Text style={[styles.caption, { color: colors.textMuted }]}>{topic.diagram.caption}</Text>
        </View>
      ) : null}

      {topic.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
            {section.heading}
          </Text>
          {section.body ? <Text style={[styles.body, { color: colors.text }]}>{section.body}</Text> : null}
          {section.points?.map((point) => (
            <View key={point} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.pointText, { color: colors.text }]}>{point}</Text>
            </View>
          ))}
        </View>
      ))}

      {topic.questions.length ? (
        <View style={[styles.card, styles.questions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.kicker, { color: colors.textMuted }]}>
            COMMON QUESTIONS
          </Text>
          {topic.questions.map((item, index) => (
            <View
              key={item.q}
              style={[styles.question, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <Text style={[styles.q, { color: colors.text }]}>{item.q}</Text>
              <Text style={[styles.a, { color: colors.textMuted }]}>{item.a}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {onOpenTopic && related.length ? (
        <View style={styles.section}>
          <Text style={[styles.kicker, { color: colors.textMuted }]}>SEE ALSO</Text>
          <View style={styles.related}>
            {related.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onOpenTopic(item.id)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons name={item.icon as any} size={16} color={colors.primary} />
                <Text style={[styles.chipText, { color: colors.text }]}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={[styles.source, { color: colors.textSubtle }]}>{RULES_SOURCE}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.lg },
  short: { fontSize: 16, lineHeight: 23, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  diagram: { width: "100%", aspectRatio: 1.9, borderRadius: RADIUS.md, overflow: "hidden" },
  caption: { fontSize: 13, lineHeight: 19 },
  section: { gap: SPACING.sm },
  heading: { fontSize: 17, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 22 },
  point: { flexDirection: "row", gap: SPACING.sm, paddingRight: SPACING.xs },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  pointText: { flex: 1, fontSize: 15, lineHeight: 22 },
  questions: { gap: 0, paddingVertical: SPACING.md },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  question: { paddingVertical: SPACING.md, gap: 4 },
  q: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  a: { fontSize: 14, lineHeight: 21 },
  related: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: "700" },
  source: { fontSize: 12, lineHeight: 18 },
});
