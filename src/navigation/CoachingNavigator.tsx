import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MyCoachingScreen } from "../screens/coaching/MyCoachingScreen";
import { CoachGroupScreen } from "../screens/coach/CoachGroupScreen";
import { CoachingSessionScreen } from "../screens/coaching/CoachingSessionScreen";
import type { CoachingStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { PlayerRootHeader } from "./PlayerRootHeader";

const Stack = createNativeStackNavigator<CoachingStackParamList>();

export const CoachingNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="CoachingHome"
        component={MyCoachingScreen}
        options={{ title: "Coaching", header: PlayerRootHeader }}
      />
      <Stack.Screen
        name="CoachGroup"
        component={CoachGroupScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <Stack.Screen name="CoachingSession" component={CoachingSessionScreen} options={{ title: "Session" }} />
    </Stack.Navigator>
  );
};
