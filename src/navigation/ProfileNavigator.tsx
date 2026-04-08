import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { SubscriptionPlansScreen } from "../screens/profile/SubscriptionPlansScreen";
import { AchievementsScreen } from "../screens/profile/AchievementsScreen";
import { EditProfileFieldScreen } from "../screens/profile/EditProfileFieldScreen";
import { ProfileStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Account Settings" }} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} options={{ title: "Plans" }} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: "Achievements" }} />
      <Stack.Screen name="EditProfileField" component={EditProfileFieldScreen} options={{ title: "Edit Profile" }} />
    </Stack.Navigator>
  );
};
