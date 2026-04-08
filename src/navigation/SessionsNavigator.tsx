import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SessionsHomeScreen } from "../screens/sessions/SessionsHomeScreen";
import { SessionTemplateDetailScreen } from "../screens/sessions/SessionTemplateDetailScreen";
import { SessionSetupScreen } from "../screens/sessions/SessionSetupScreen";
import { ActiveSessionScreen } from "../screens/sessions/ActiveSessionScreen";
import { GuidedSessionBuilder } from "../screens/sessions/GuidedSessionBuilder";
import { SessionsStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<SessionsStackParamList>();

export const SessionsNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SessionsHome" component={SessionsHomeScreen} options={{ title: "Practice Sessions" }} />
      <Stack.Screen name="SessionTemplateDetail" component={SessionTemplateDetailScreen} options={{ title: "Session Preset" }} />
      <Stack.Screen name="SessionSetup" component={SessionSetupScreen} options={{ title: "Session Preset" }} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: "Log Session" }} />
      <Stack.Screen name="GuidedSessionBuilder" component={GuidedSessionBuilder} options={{ title: "Practice Builder" }} />
    </Stack.Navigator>
  );
};
