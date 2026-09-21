import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { SubscriptionPlansScreen } from "../screens/profile/SubscriptionPlansScreen";
import { AchievementsScreen } from "../screens/profile/AchievementsScreen";
import { EditProfileFieldScreen } from "../screens/profile/EditProfileFieldScreen";
import { AvatarPickerScreen } from "../screens/profile/AvatarPickerScreen";
import { ProfileStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { DialogProvider } from "../components/ui/DialogProvider";
import { UnlockQueueProvider } from "../components/achievements/UnlockQueueProvider";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);

  // Profile opens as a sheet over the app. iOS will not show a pop-up from the app's root while
  // a sheet is on top of it, so a pop-up raised in here (sign out, help, locked outfits) never
  // appeared. This area gets its own dialog host, inside the sheet, which shows over it - and
  // its own celebration host, for replaying achievements from the Achievements screen.
  return (
    <DialogProvider>
      <UnlockQueueProvider>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: "Profile" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Account settings" }} />
          <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} options={{ title: "Plans" }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: "Achievements" }} />
          <Stack.Screen name="AvatarPicker" component={AvatarPickerScreen} options={{ title: "Choose an avatar" }} />
          <Stack.Screen
            name="EditProfileField"
            component={EditProfileFieldScreen}
            options={({ route }) => ({
              title: "Edit profile",
              gestureEnabled: route.params.field !== "cue_preference",
            })}
          />
        </Stack.Navigator>
      </UnlockQueueProvider>
    </DialogProvider>
  );
};
