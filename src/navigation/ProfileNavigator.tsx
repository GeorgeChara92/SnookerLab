import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { SettingsScreen } from "../screens/profile/SettingsScreen";
import { SubscriptionPlansScreen } from "../screens/profile/SubscriptionPlansScreen";
import { AchievementsScreen } from "../screens/profile/AchievementsScreen";
import { EditProfileFieldScreen } from "../screens/profile/EditProfileFieldScreen";
import { AvatarPickerScreen } from "../screens/profile/AvatarPickerScreen";
import { CoachSettingsScreen } from "../screens/profile/CoachSettingsScreen";
import { ApplyToCoachScreen } from "../screens/profile/ApplyToCoachScreen";
import { FeedbackScreen } from "../screens/profile/FeedbackScreen";
import { CoachSubscriptionScreen } from "../screens/coach/CoachSubscriptionScreen";
import { ProfileStackParamList } from "../types";
import { HeaderIconButton, useAppStackScreenOptions } from "./stackOptions";
import { useAppTheme } from "../hooks/useAppTheme";
import { DialogProvider } from "../components/ui/DialogProvider";
import { UnlockQueueProvider } from "../components/achievements/UnlockQueueProvider";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);
  const { colors } = useAppTheme();

  // Profile opens as a sheet over the app. iOS will not show a pop-up from the app's root while
  // a sheet is on top of it, so a pop-up raised in here (sign out, help, locked outfits) never
  // appeared. This area gets its own dialog host, inside the sheet, which shows over it - and
  // its own celebration host, for replaying achievements from the Achievements screen.
  return (
    <DialogProvider>
      <UnlockQueueProvider>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen
            name="ProfileHome"
            component={ProfileScreen}
            options={({ navigation }) => ({
              title: "Profile",
              // The sheet's way out, besides swiping it down.
              headerRight: () => (
                <HeaderIconButton icon="close" color={colors.text} label="Close profile" onPress={() => navigation.getParent()?.goBack()} />
              ),
            })}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Account settings" }} />
          <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} options={{ title: "Plans" }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: "Achievements" }} />
          <Stack.Screen name="AvatarPicker" component={AvatarPickerScreen} options={{ title: "Choose an avatar" }} />
          <Stack.Screen name="CoachSettings" component={CoachSettingsScreen} options={{ title: "Coach settings" }} />
          <Stack.Screen name="ApplyToCoach" component={ApplyToCoachScreen} options={{ title: "Apply to coach" }} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: "Send feedback" }} />
          <Stack.Screen name="CoachPlan" component={CoachSubscriptionScreen} options={{ title: "Coach plan" }} />
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
