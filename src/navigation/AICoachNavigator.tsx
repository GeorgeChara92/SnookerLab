import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AIDashboardScreen } from "../screens/ai-coach/AIDashboardScreen";
import { AnalysisDetailScreen } from "../screens/ai-coach/AnalysisDetailScreen";
import { AnalysisHistoryScreen } from "../screens/ai-coach/AnalysisHistoryScreen";
import { VideoUploadScreen } from "../screens/ai-coach/VideoUploadScreen";
import { AICoachStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<AICoachStackParamList>();

export const AICoachNavigator = () => {
  const screenOptions = useAppStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AIDashboard" component={AIDashboardScreen} options={{ title: "AI Coach" }} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen} options={{ title: "Upload Video" }} />
      <Stack.Screen name="AnalysisHistory" component={AnalysisHistoryScreen} options={{ title: "All Analyses" }} />
      <Stack.Screen name="AnalysisDetail" component={AnalysisDetailScreen} options={{ title: "Analysis Detail" }} />
    </Stack.Navigator>
  );
};
