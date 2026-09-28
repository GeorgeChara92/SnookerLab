import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CoachGroupsListScreen } from "../screens/coach/CoachGroupsListScreen";
import { CoachGroupFormScreen } from "../screens/coach/CoachGroupFormScreen";
import { CoachGroupScreen } from "../screens/coach/CoachGroupScreen";
import { CoachGroupPostFormScreen } from "../screens/coach/CoachGroupPostFormScreen";
import type { CoachGroupsStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<CoachGroupsStackParamList>();

/** A coach's own client groups, on their own tab: their clients, and the practice content posted
 * for them. Kept apart from the Clients tab (which is about one-to-one bookings and messaging). */
export const CoachGroupsNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="GroupsList" component={CoachGroupsListScreen} options={{ title: "Groups" }} />
      <Stack.Screen name="CoachGroupForm" component={CoachGroupFormScreen} options={{ title: "New group" }} />
      <Stack.Screen
        name="CoachGroup"
        component={CoachGroupScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <Stack.Screen name="CoachGroupPostForm" component={CoachGroupPostFormScreen} options={{ title: "New post" }} />
    </Stack.Navigator>
  );
};
