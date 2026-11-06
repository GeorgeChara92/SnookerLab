import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useNavigation, useRoute, StackActions, type RouteProp } from "@react-navigation/native";
import { RuleBody } from "../../components/rules/RuleBody";
import { useAppTheme } from "../../hooks/useAppTheme";
import { SPACING } from "../../constants";
import { getRuleTopic } from "../../features/rules/rules";
import type { PracticeStackParamList } from "../../types";

/** One rule in full. "See also" opens the next rule on top, so Back returns here. */
export const RuleTopicScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PracticeStackParamList, "RuleTopic">>();
  const { colors } = useAppTheme();
  const topic = getRuleTopic(route.params.topicId);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {topic ? (
        <RuleBody topic={topic} onOpenTopic={(topicId) => navigation.dispatch(StackActions.push("RuleTopic", { topicId }))} />
      ) : (
        <Text style={{ color: colors.textMuted }}>This rule isn't available.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
});
