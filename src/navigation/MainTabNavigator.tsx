import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DashboardNavigator } from "./DashboardNavigator";
import { PracticeNavigator } from "./PracticeNavigator";
import { CommunityNavigator } from "./CommunityNavigator";
import { useAuthStore } from "../store";
import { useCommunityStore } from "../store/communityStore";
import { splitBadges, useChatBadges } from "../store/chatStore";
import { MatchesNavigator } from "./MatchesNavigator";
import { StatsNavigator } from "./StatsNavigator";
import { AICoachNavigator } from "./AICoachNavigator";
import { MainTabParamList } from "../types";
import { useAppTheme } from "../hooks/useAppTheme";

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Screens inside a tab that take the whole screen, tab bar and all. */
const FULL_SCREEN_ROUTES = new Set(["ScanSnooker", "RoutineAR"]);

export const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  // Friend requests waiting for this player, on the Community tab.
  const friendRequests = useCommunityStore(
    (state) => state.friendships.filter((item) => item.status === "pending" && item.addressee === userId).length
  );
  const chat = splitBadges(useChatBadges());
  // Friend requests, message requests and chats with something unread.
  const waiting = friendRequests + chat.requests + chat.unread;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardNavigator}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeNavigator}
        options={({ route }) => ({
          tabBarLabel: "Practice",
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bullseye-arrow" size={size} color={color} />,
          ...(FULL_SCREEN_ROUTES.has(getFocusedRouteNameFromRoute(route) ?? "")
            ? { tabBarStyle: { display: "none" as const } }
            : {}),
        })}
      />
      <Tab.Screen
        name="Community"
        component={CommunityNavigator}
        options={{
          tabBarLabel: "Community",
          popToTopOnBlur: true,
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Matches"
        component={MatchesNavigator}
        options={({ route }) => ({
          tabBarLabel: "Matches",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="trophy-outline" size={size} color={color} />,
          // Scan Snooker is a full-screen camera: no tab bar over it.
          ...(FULL_SCREEN_ROUTES.has(getFocusedRouteNameFromRoute(route) ?? "")
            ? { tabBarStyle: { display: "none" as const } }
            : {}),
        })}
      />
      <Tab.Screen
        name="Stats"
        component={StatsNavigator}
        options={{
          tabBarLabel: "Stats",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-line" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AICoach"
        component={AICoachNavigator}
        options={{
          tabBarLabel: "AI Coach",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="robot-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
