import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DashboardHomeScreen } from "../screens/dashboard/DashboardHomeScreen";
import { DashboardStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { PlayerRootHeader } from "./PlayerRootHeader";

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export const DashboardNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DashboardHome"
        component={DashboardHomeScreen}
        options={{ title: "Dashboard", header: PlayerRootHeader }}
      />
    </Stack.Navigator>
  );
};
