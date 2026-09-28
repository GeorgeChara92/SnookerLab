import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AIDashboardScreen } from "../screens/ai-coach/AIDashboardScreen";
import { AnalysisDetailScreen } from "../screens/ai-coach/AnalysisDetailScreen";
import { AnalysisHistoryScreen } from "../screens/ai-coach/AnalysisHistoryScreen";
import { VideoUploadScreen } from "../screens/ai-coach/VideoUploadScreen";
import { AICoachStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { PlayerRootHeader } from "./PlayerRootHeader";

const Stack = createNativeStackNavigator<AICoachStackParamList>();

export const AICoachNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AIDashboard"
        component={AIDashboardScreen}
        options={{ title: "Snookered Coach", header: PlayerRootHeader }}
      />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen} options={{ title: "Upload a clip" }} />
      <Stack.Screen name="AnalysisHistory" component={AnalysisHistoryScreen} options={{ title: "All reports" }} />
      <Stack.Screen name="AnalysisDetail" component={AnalysisDetailScreen} options={{ title: "Coaching report" }} />
    </Stack.Navigator>
  );
};
