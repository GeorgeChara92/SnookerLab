import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DashboardScreen } from "../screens/stats/DashboardScreen";
import { StatsStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { PlayerRootHeader } from "./PlayerRootHeader";

const Stack = createNativeStackNavigator<StatsStackParamList>();

export const StatsNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Statistics", header: PlayerRootHeader }}
      />
    </Stack.Navigator>
  );
};
