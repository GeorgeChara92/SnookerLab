import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoutinesListScreen } from "../screens/routines/RoutinesListScreen";
import { RoutineDetailScreen } from "../screens/routines/RoutineDetailScreen";
import { RecordRoutineScoreScreen } from "../screens/routines/RecordRoutineScoreScreen";
import { PracticeStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export const PracticeNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="RoutinesList" component={RoutinesListScreen} options={{ title: "Practice Routines" }} />
      <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} options={{ title: "Routine Details" }} />
      <Stack.Screen name="RecordRoutineScore" component={RecordRoutineScoreScreen} options={{ title: "Record Score" }} />
    </Stack.Navigator>
  );
};
