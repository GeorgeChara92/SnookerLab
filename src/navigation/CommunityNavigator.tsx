import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CommunityHomeScreen } from "../screens/community/CommunityHomeScreen";
import { PlayerProfileScreen } from "../screens/community/PlayerProfileScreen";
import { CoachProfileScreen } from "../screens/community/CoachProfileScreen";
import { PlayerRootHeader } from "./PlayerRootHeader";
import { CommunitySettingsScreen } from "../screens/community/CommunitySettingsScreen";
import { AdminReportsScreen } from "../screens/community/AdminReportsScreen";
import { AdminCoachApplicationsScreen } from "../screens/community/AdminCoachApplicationsScreen";
import { RoutineLibraryScreen } from "../screens/community/RoutineLibraryScreen";
import { SharedRoutineScreen } from "../screens/community/SharedRoutineScreen";
import { LeaderboardsScreen } from "../screens/community/LeaderboardsScreen";
import { RoutineLeaderboardScreen } from "../screens/community/RoutineLeaderboardScreen";
import { RoutineBoardsScreen } from "../screens/community/RoutineBoardsScreen";
import { ChatsScreen } from "../screens/community/ChatsScreen";
import { TourNewsScreen } from "../screens/community/TourNewsScreen";
import { ProTourPlayerScreen } from "../screens/community/ProTourPlayerScreen";
import { ProTourTournamentScreen } from "../screens/community/ProTourTournamentScreen";
import { ProTourMatchScreen } from "../screens/community/ProTourMatchScreen";
import { useAppTheme } from "../hooks/useAppTheme";
import { FONTS } from "../constants";
import { LiveMatchScreen } from "../screens/community/LiveMatchScreen";
import { ChatScreen } from "../screens/community/ChatScreen";
import { NewChatScreen } from "../screens/community/NewChatScreen";
import { GroupsScreen } from "../screens/community/GroupsScreen";
import { GroupScreen } from "../screens/community/GroupScreen";
import { GroupFormScreen } from "../screens/community/GroupFormScreen";
import { BookCoachScreen } from "../screens/community/BookCoachScreen";
import { FindCoachScreen } from "../screens/community/FindCoachScreen";
import type { CommunityStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export const CommunityNavigator = () => {
  const screenOptions = useAppStackScreenOptions();
  const { colors } = useAppTheme();
  // The pro tour's own screens read as the broadcast continuing past the segmented tabs, not a
  // different app underneath them, so their header takes the same board colours as the body.
  const proTourHeaderOptions = {
    headerStyle: { backgroundColor: colors.board },
    headerTintColor: colors.boardText,
    headerTitleStyle: { fontFamily: FONTS.board, fontSize: 18, letterSpacing: 0.6 },
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="CommunityHome"
        component={CommunityHomeScreen}
        options={{ title: "Community", header: PlayerRootHeader }}
      />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} options={{ title: "Player" }} />
      <Stack.Screen name="CoachProfile" component={CoachProfileScreen} options={{ title: "Coach" }} />
      <Stack.Screen
        name="CommunitySettings"
        component={CommunitySettingsScreen}
        options={{ title: "Community settings" }}
      />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: "Reports" }} />
      <Stack.Screen
        name="AdminCoachApplications"
        component={AdminCoachApplicationsScreen}
        options={{ title: "Coach applications" }}
      />
      <Stack.Screen name="RoutineLibrary" component={RoutineLibraryScreen} options={{ title: "Routine library" }} />
      <Stack.Screen name="SharedRoutine" component={SharedRoutineScreen} options={{ title: "Routine" }} />
      <Stack.Screen name="Leaderboards" component={LeaderboardsScreen} options={{ title: "Leaderboards" }} />
      <Stack.Screen name="TourNews" component={TourNewsScreen} options={{ title: "Pro Tour", ...proTourHeaderOptions }} />
      <Stack.Screen name="ProTourPlayer" component={ProTourPlayerScreen} options={{ title: "Player", ...proTourHeaderOptions }} />
      <Stack.Screen name="ProTourMatch" component={ProTourMatchScreen} options={{ title: "Match", ...proTourHeaderOptions }} />
      <Stack.Screen
        name="ProTourTournament"
        component={ProTourTournamentScreen}
        options={{ title: "Tournament", ...proTourHeaderOptions }}
      />
      <Stack.Screen name="LiveMatch" component={LiveMatchScreen} options={{ title: "Live" }} />
      <Stack.Screen name="RoutineBoards" component={RoutineBoardsScreen} options={{ title: "Routine leaderboards" }} />
      <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: "Chats" }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "" }} />
      <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: "New message" }} />
      <Stack.Screen name="Groups" component={GroupsScreen} options={{ title: "Groups" }} />
      <Stack.Screen name="Group" component={GroupScreen} options={{ title: "Group" }} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} options={{ title: "New group" }} />
      <Stack.Screen name="RoutineLeaderboard" component={RoutineLeaderboardScreen} options={{ title: "Leaderboard" }} />
      <Stack.Screen name="BookCoach" component={BookCoachScreen} options={{ title: "Book a session" }} />
      <Stack.Screen name="FindCoach" component={FindCoachScreen} options={{ title: "Find a coach" }} />
    </Stack.Navigator>
  );
};
