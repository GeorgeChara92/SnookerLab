import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CommunityHomeScreen } from "../screens/community/CommunityHomeScreen";
import { PlayerProfileScreen } from "../screens/community/PlayerProfileScreen";
import { CoachProfileScreen } from "../screens/community/CoachProfileScreen";
import { PlayerRootHeader } from "./PlayerRootHeader";
import { CommunitySettingsScreen } from "../screens/community/CommunitySettingsScreen";
import { AdminReportsScreen } from "../screens/community/AdminReportsScreen";
import { RoutineLibraryScreen } from "../screens/community/RoutineLibraryScreen";
import { SharedRoutineScreen } from "../screens/community/SharedRoutineScreen";
import { LeaderboardsScreen } from "../screens/community/LeaderboardsScreen";
import { RoutineLeaderboardScreen } from "../screens/community/RoutineLeaderboardScreen";
import { RoutineBoardsScreen } from "../screens/community/RoutineBoardsScreen";
import { ChatsScreen } from "../screens/community/ChatsScreen";
import { TourNewsScreen } from "../screens/community/TourNewsScreen";
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
      <Stack.Screen name="RoutineLibrary" component={RoutineLibraryScreen} options={{ title: "Routine library" }} />
      <Stack.Screen name="SharedRoutine" component={SharedRoutineScreen} options={{ title: "Routine" }} />
      <Stack.Screen name="Leaderboards" component={LeaderboardsScreen} options={{ title: "Leaderboards" }} />
      <Stack.Screen name="TourNews" component={TourNewsScreen} options={{ title: "Pro Tour" }} />
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
