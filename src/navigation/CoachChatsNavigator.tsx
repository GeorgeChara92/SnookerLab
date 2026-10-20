import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChatsScreen } from "../screens/community/ChatsScreen";
import { ChatScreen } from "../screens/community/ChatScreen";
import { NewChatScreen } from "../screens/community/NewChatScreen";
import { PlayerProfileScreen } from "../screens/community/PlayerProfileScreen";
import { GroupScreen } from "../screens/community/GroupScreen";
import { SharedRoutineScreen } from "../screens/community/SharedRoutineScreen";
import type { CoachChatsStackParamList } from "../types";
import { useAppStackScreenOptions } from "./stackOptions";
import { MaterialTopHeader } from "./MaterialTopHeader";

const Stack = createNativeStackNavigator<CoachChatsStackParamList>();

/** A coach's own messages, on their own tab - separate from Groups, so day-to-day conversation
 * with clients does not get lost among group posts. The same chat screens the player app uses. */
export const CoachChatsNavigator = () => {
  const screenOptions = useAppStackScreenOptions(false);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ChatsList"
        component={ChatsScreen}
        // The tab's first screen wears the coach header, so the switch to player view is on every tab.
        options={{ title: "Chats", header: (props) => <MaterialTopHeader {...props} /> }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "" }} />
      <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: "New message" }} />
      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} options={{ title: "Player" }} />
      <Stack.Screen name="Group" component={GroupScreen} options={{ title: "Group" }} />
      <Stack.Screen name="SharedRoutine" component={SharedRoutineScreen} options={{ title: "Shared routine" }} />
    </Stack.Navigator>
  );
};
