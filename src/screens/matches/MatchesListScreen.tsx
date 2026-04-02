import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useMatchesStore, useTournamentsStore } from "../../store";
import type { Match, MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

type OpponentGroup = {
  opponentName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  framesFor: number;
  framesAgainst: number;
};

export const MatchesListScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { matches } = useMatchesStore();
  const { tournaments } = useTournamentsStore();
  const { colors } = useAppTheme();
  const activeTournaments = tournaments.filter((item) => item.status !== "completed");
  const completedTournaments = tournaments.filter((item) => item.status === "completed");

  const getChampionLabel = (tournament: (typeof tournaments)[number]) => {
    if (tournament.tournament_type === "knockout") {
      const finalRound = Math.max(...tournament.fixtures.map((fixture) => fixture.round_number), 1);
      const finalFixture = tournament.fixtures.find((fixture) => fixture.round_number === finalRound);
      return finalFixture?.winner ?? tournament.previous_champion ?? "See details";
    }
    return tournament.previous_champion ?? "See details";
  };

  const groups = useMemo(() => {
    const map = new Map<string, OpponentGroup>();

    matches.forEach((match: Match) => {
      const existing = map.get(match.opponent_name) ?? {
        opponentName: match.opponent_name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        framesFor: 0,
        framesAgainst: 0,
      };

      existing.matchesPlayed += 1;
      existing.framesFor += match.user_score;
      existing.framesAgainst += match.opponent_score;

      if (match.result === "win") existing.wins += 1;
      if (match.result === "loss") existing.losses += 1;
      if (match.result === "draw") existing.draws += 1;

      map.set(match.opponent_name, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  }, [matches]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.actionsRow}>
        <Pressable style={[styles.newMatchButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate("NewMatch")}>
          <Text style={[styles.newMatchButtonText, { color: colors.onPrimary }]}>+ New Match</Text>
        </Pressable>
        <Pressable style={[styles.newTournamentButton, { backgroundColor: colors.primaryStrong }]} onPress={() => navigation.navigate("NewTournament")}>
          <Text style={[styles.newMatchButtonText, { color: colors.onPrimary }]}>+ Tournament</Text>
        </Pressable>
      </View>

      <View style={[styles.tournamentBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.tournamentHead}>
          <Text style={[styles.tournamentTitle, { color: colors.text }]}>Active Tournaments</Text>
          <Text style={[styles.tournamentMeta, { color: colors.textMuted }]}>{activeTournaments.length}</Text>
        </View>
        {activeTournaments.length === 0 ? (
          <Text style={[styles.tournamentEmpty, { color: colors.textMuted }]}>Create your first knockout or league event.</Text>
        ) : (
          activeTournaments.slice(0, 4).map((tournament) => (
            <Pressable
              key={tournament.id}
              style={[styles.tournamentCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}
            >
              <Text style={[styles.tournamentName, { color: colors.text }]}>{tournament.name}</Text>
              <Text style={[styles.tournamentInfo, { color: colors.textMuted }]}>
                {tournament.tournament_type.toUpperCase()} · {tournament.entry_mode.toUpperCase()} · Best of {tournament.best_of_frames}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.tournamentBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.tournamentHead}>
          <Text style={[styles.tournamentTitle, { color: colors.text }]}>Completed Tournaments</Text>
          <Text style={[styles.tournamentMeta, { color: colors.textMuted }]}>{completedTournaments.length}</Text>
        </View>
        {completedTournaments.length === 0 ? (
          <Text style={[styles.tournamentEmpty, { color: colors.textMuted }]}>No completed tournaments yet.</Text>
        ) : (
          completedTournaments.slice(0, 4).map((tournament) => (
            <Pressable
              key={tournament.id}
              style={[styles.tournamentCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}
            >
              <Text style={[styles.tournamentName, { color: colors.text }]}>{tournament.name}</Text>
              <Text style={[styles.tournamentInfo, { color: colors.textMuted }]}>Champion: {getChampionLabel(tournament)}</Text>
            </Pressable>
          ))
        )}
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.opponentName}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No matches yet. Add your first result 🏆</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate("OpponentMatches", { opponentName: item.opponentName })}
          >
            <View style={styles.topRow}>
              <Text style={[styles.opponentName, { color: colors.text }]}>🎱 {item.opponentName}</Text>
              <Text style={[styles.matchesPlayed, { color: colors.textMuted }]}>{item.matchesPlayed} matches</Text>
            </View>

            <Text style={[styles.record, { color: colors.text }]}>Record: {item.wins}W - {item.losses}L - {item.draws}D</Text>
            <Text style={[styles.frames, { color: colors.textMuted }]}>Total Points: {item.framesFor} - {item.framesAgainst}</Text>
            <Text style={[styles.tapHint, { color: colors.primary }]}>Tap to view match history ›</Text>
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
  newMatchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  newTournamentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  newMatchButtonText: {
    fontWeight: "700",
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tournamentBlock: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  tournamentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tournamentTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  tournamentMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  tournamentEmpty: {
    marginTop: 8,
    fontSize: 12,
  },
  tournamentCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
  },
  tournamentName: {
    fontSize: 13,
    fontWeight: "700",
  },
  tournamentInfo: {
    marginTop: 2,
    fontSize: 11,
  },
  list: {
    paddingTop: 14,
    paddingBottom: 20,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  opponentName: {
    fontSize: 17,
    fontWeight: "700",
  },
  matchesPlayed: {
    fontSize: 12,
  },
  record: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  frames: {
    marginTop: 4,
    fontSize: 13,
  },
  tapHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    marginTop: 30,
  },
});
