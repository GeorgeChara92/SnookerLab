import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CommunityHomeScreen } from "../screens/community/CommunityHomeScreen";
import { PlayerProfileScreen } from "../screens/community/PlayerProfileScreen";
import { CommunitySettingsScreen } from "../screens/community/CommunitySettingsScreen";
import { AdminReportsScreen } from "../screens/community/AdminReportsScreen";
import type { CommunityStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export const CommunityNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="CommunityHome" component={CommunityHomeScreen} options={{ title: "Community" }} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} options={{ title: "Player" }} />
      <Stack.Screen
        name="CommunitySettings"
        component={CommunitySettingsScreen}
        options={{ title: "Community settings" }}
      />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: "Reports" }} />
    </Stack.Navigator>
  );
};
