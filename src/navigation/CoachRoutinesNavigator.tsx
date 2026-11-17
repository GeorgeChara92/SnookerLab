import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CoachRoutinesScreen } from "../screens/coach/CoachRoutinesScreen";
import { CoachRoutineScreen } from "../screens/coach/CoachRoutineScreen";
import type { CoachRoutinesStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { MaterialTopHeader } from "./MaterialTopHeader";

// MaterialTopHeader has its own "?" beside the title; the stack's "?" here would be a second one.
const noSecondHelp = () => null;

const Stack = createNativeStackNavigator<CoachRoutinesStackParamList>();

/** A coach's routines: their own and the library, each ready to set as homework or send to a client.
 * Building and editing one opens the same builder as player view (a modal on the root stack). */
export const CoachRoutinesNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="RoutinesHome"
        component={CoachRoutinesScreen}
        // The tab's first screen wears the coach header, so the switch to player view is on every tab.
        options={{ title: "Routines", header: (props) => <MaterialTopHeader {...props} />, headerRight: noSecondHelp }}
      />
      <Stack.Screen name="CoachRoutine" component={CoachRoutineScreen} options={{ title: "Routine" }} />
    </Stack.Navigator>
  );
};
