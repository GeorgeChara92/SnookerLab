import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CoachClientsScreen } from "../screens/coach/CoachClientsScreen";
import { CoachClientDetailScreen } from "../screens/coach/CoachClientDetailScreen";
import { ChatScreen } from "../screens/community/ChatScreen";
import { PlayerProfileScreen } from "../screens/community/PlayerProfileScreen";
import type { CoachClientsStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { MaterialTopHeader } from "./MaterialTopHeader";

// MaterialTopHeader has its own "?" beside the title; the stack's "?" here would be a second one.
const noSecondHelp = () => null;

const Stack = createNativeStackNavigator<CoachClientsStackParamList>();

export const CoachClientsNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ClientsList"
        component={CoachClientsScreen}
        // The tab's first screen wears the coach header, so the switch to player view is on every tab.
        options={{ title: "Clients", header: (props) => <MaterialTopHeader {...props} />, headerRight: noSecondHelp }}
      />
      <Stack.Screen
        name="ClientDetail"
        component={CoachClientDetailScreen}
        options={({ route }) => ({ title: route.params.clientName })}
      />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "" }} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} options={{ title: "Player" }} />
    </Stack.Navigator>
  );
};
