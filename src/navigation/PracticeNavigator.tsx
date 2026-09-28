import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoutineCategoriesScreen } from "../screens/routines/RoutineCategoriesScreen";
import { RoutinesListScreen } from "../screens/routines/RoutinesListScreen";
import { RoutineDetailScreen } from "../screens/routines/RoutineDetailScreen";
import { RecordRoutineScoreScreen } from "../screens/routines/RecordRoutineScoreScreen";
import { CustomRoutineScreen } from "../screens/routines/CustomRoutineScreen";
import { CustomRoutineBuilderScreen } from "../screens/routines/CustomRoutineBuilderScreen";
import { RoutineARScreen } from "../screens/routines/RoutineARScreen";
import { SessionTemplateDetailScreen } from "../screens/sessions/SessionTemplateDetailScreen";
import { SessionSetupScreen } from "../screens/sessions/SessionSetupScreen";
import { ActiveSessionScreen } from "../screens/sessions/ActiveSessionScreen";
import { GuidedSessionBuilder } from "../screens/sessions/GuidedSessionBuilder";
import { PracticePlanScreen } from "../screens/sessions/PracticePlanScreen";
import { NewGoalScreen } from "../screens/sessions/NewGoalScreen";
import { SessionsHomeScreen } from "../screens/sessions/SessionsHomeScreen";
import { RoutineLeaderboardScreen } from "../screens/community/RoutineLeaderboardScreen";
import { PracticeStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { PlayerRootHeader } from "./PlayerRootHeader";

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export const PracticeNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="RoutineCategories"
        component={RoutineCategoriesScreen}
        options={{ title: "Practice", header: PlayerRootHeader }}
      />
      <Stack.Screen name="RoutinesList" component={RoutinesListScreen} options={{ title: "Routines" }} />
      <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} options={{ title: "Routine Details" }} />
      <Stack.Screen
        name="RecordRoutineScore"
        component={RecordRoutineScoreScreen}
        options={{ title: "Record Score" }}
      />
      <Stack.Screen name="CustomRoutine" component={CustomRoutineScreen} options={{ title: "Routine" }} />
      <Stack.Screen
        name="CustomRoutineBuilder"
        component={CustomRoutineBuilderScreen}
        options={{ title: "New routine" }}
      />
      <Stack.Screen name="RoutineAR" component={RoutineARScreen} options={{ title: "Set up" }} />
      {/* Sessions live in Practice now; the list itself is a tab on the Practice home. */}
      <Stack.Screen name="SessionsHome" component={SessionsHomeScreen} options={{ title: "Sessions" }} />
      <Stack.Screen
        name="SessionTemplateDetail"
        component={SessionTemplateDetailScreen}
        options={{ title: "Session" }}
      />
      <Stack.Screen name="SessionSetup" component={SessionSetupScreen} options={{ title: "Session" }} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: "Log session" }} />
      <Stack.Screen
        name="GuidedSessionBuilder"
        component={GuidedSessionBuilder}
        options={{ title: "Practice builder" }}
      />
      <Stack.Screen name="PracticePlan" component={PracticePlanScreen} options={{ title: "Your plan" }} />
      <Stack.Screen name="NewGoal" component={NewGoalScreen} options={{ title: "New goal" }} />
      <Stack.Screen name="RoutineLeaderboard" component={RoutineLeaderboardScreen} options={{ title: "Leaderboard" }} />
    </Stack.Navigator>
  );
};
