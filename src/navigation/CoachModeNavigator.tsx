import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CoachDashboardScreen } from "../screens/coach/CoachDashboardScreen";
import { CoachAnalyticsDashboardScreen } from "../screens/coach/CoachAnalyticsDashboardScreen";
import { CoachAvailabilityScreen } from "../screens/coach/CoachAvailabilityScreen";
import { CoachClientsNavigator } from "./CoachClientsNavigator";
import { CoachGroupsNavigator } from "./CoachGroupsNavigator";
import { CoachChatsNavigator } from "./CoachChatsNavigator";
import { useCoachStore } from "../store/coachStore";
import { splitBadges, useChatBadges } from "../store/chatStore";
import { useAppTheme } from "../hooks/useAppTheme";
import { MaterialTopHeader } from "./MaterialTopHeader";
import type { CoachModeTabParamList } from "../types";

const Tab = createBottomTabNavigator<CoachModeTabParamList>();

/**
 * A coach's own experience, shown instead of MainTabNavigator while in coach view: a dashboard of
 * trends and top clients, today's sessions, a calendar of their availability, and their clients.
 * Deliberately not one more tab on the player's app - a coach reviewing bookings should not be
 * looking at their own player level and subscription badge, which is what MainTabNavigator's
 * header shows on every screen.
 */
export const CoachModeNavigator = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const pendingRequests = useCoachStore(
    (state) => state.bookingsAsCoach.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "coach").length
  );
  const unseenCoachResolutions = useCoachStore((state) => state.unseenCoachResolutions);
  const todayBadge = pendingRequests + unseenCoachResolutions;
  const chat = splitBadges(useChatBadges());
  const chatWaiting = chat.unread + chat.requests;

  return (
    <Tab.Navigator
      screenOptions={{
        header: (props) => <MaterialTopHeader {...props} />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
      }}
    >
      <Tab.Screen
        name="CoachDashboard"
        component={CoachAnalyticsDashboardScreen}
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CoachToday"
        component={CoachDashboardScreen}
        options={{
          title: "Agenda",
          tabBarLabel: "Agenda",
          tabBarBadge: todayBadge > 0 ? todayBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-check-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CoachCalendar"
        component={CoachAvailabilityScreen}
        options={{
          title: "Calendar",
          tabBarLabel: "Calendar",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-month-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CoachClients"
        component={CoachClientsNavigator}
        options={{
          headerShown: false,
          tabBarLabel: "Clients",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-group-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CoachGroups"
        component={CoachGroupsNavigator}
        options={{
          headerShown: false,
          tabBarLabel: "Groups",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-multiple-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CoachChats"
        component={CoachChatsNavigator}
        options={{
          headerShown: false,
          tabBarLabel: "Chats",
          tabBarBadge: chatWaiting > 0 ? chatWaiting : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chat-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
