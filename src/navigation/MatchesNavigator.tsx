import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MatchesListScreen } from "../screens/matches/MatchesListScreen";
import { OpponentMatchesScreen } from "../screens/matches/OpponentMatchesScreen";
import { MatchDetailScreen } from "../screens/matches/MatchDetailScreen";
import { NewMatchScreen } from "../screens/matches/NewMatchScreen";
import { NewTournamentScreen } from "../screens/matches/NewTournamentScreen";
import { TournamentDetailScreen } from "../screens/matches/TournamentDetailScreen";
import { MatchesStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export const MatchesNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MatchesList" component={MatchesListScreen} options={{ title: "Matches" }} />
      <Stack.Screen name="OpponentMatches" component={OpponentMatchesScreen} options={{ title: "Opponent History" }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: "Match Details" }} />
      <Stack.Screen name="NewMatch" component={NewMatchScreen} options={{ title: "New Match" }} />
      <Stack.Screen name="NewTournament" component={NewTournamentScreen} options={{ title: "New Tournament" }} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} options={{ title: "Tournament" }} />
    </Stack.Navigator>
  );
};
