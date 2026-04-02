import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import type { Match, MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";

export const OpponentMatchesScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "OpponentMatches">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { opponentName } = route.params;

  const { matches } = useMatchesStore();
  const { colors } = useAppTheme();

  const opponentMatches = useMemo(
    () =>
      matches
        .filter((match: Match) => match.opponent_name === opponentName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches, opponentName]
  );

  const summary = useMemo(() => {
    return opponentMatches.reduce(
      (acc, match) => {
        if (match.result === "win") acc.wins += 1;
        if (match.result === "loss") acc.losses += 1;
        if (match.result === "draw") acc.draws += 1;
        acc.framesFor += match.user_score;
        acc.framesAgainst += match.opponent_score;
        return acc;
      },
      { wins: 0, losses: 0, draws: 0, framesFor: 0, framesAgainst: 0 }
    );
  }, [opponentMatches]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.summaryCard, { backgroundColor: colors.primaryStrong }]}> 
        <Text style={[styles.title, { color: colors.onPrimary }]}>🎱 {opponentName}</Text>
        <Text style={[styles.summaryLine, { color: "#C8DED5" }]}> 
          Record: {summary.wins}W - {summary.losses}L - {summary.draws}D
        </Text>
        <Text style={[styles.summaryLine, { color: "#C8DED5" }]}>Total Points: {summary.framesFor} - {summary.framesAgainst}</Text>

        <View style={styles.addButtonWrap}>
          <AppButton
            label="Add Match Against This Opponent"
            variant="secondary"
            onPress={() => navigation.navigate("NewMatch", { opponentName })}
          />
        </View>
      </View>

      <FlatList
        data={opponentMatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.matchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate("MatchDetail", { matchId: item.id })}
          >
            <View style={styles.row}>
              <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={[styles.result, styles[item.result]]}>{item.result.toUpperCase()}</Text>
            </View>
            <Text style={[styles.score, { color: colors.text }]}>{item.user_score} - {item.opponent_score}</Text>
            {item.location ? <Text style={[styles.location, { color: colors.textMuted }]}>📍 {item.location}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  summaryLine: {
    marginTop: 6,
    fontSize: 13,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  addButtonWrap: {
    marginTop: 12,
  },
  matchCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    fontSize: 13,
  },
  result: {
    fontSize: 12,
    fontWeight: "700",
  },
  win: { color: "#0F766E" },
  loss: { color: "#B91C1C" },
  draw: { color: "#B45309" },
  score: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "800",
  },
  location: {
    marginTop: 4,
    fontSize: 12,
  },
});
