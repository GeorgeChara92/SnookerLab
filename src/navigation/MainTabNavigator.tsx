import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DashboardNavigator } from "./DashboardNavigator";
import { PracticeNavigator } from "./PracticeNavigator";
import { CommunityNavigator } from "./CommunityNavigator";
import { CoachingNavigator } from "./CoachingNavigator";
import { useAuthStore, useMatchesStore } from "../store";
import { useCommunityStore } from "../store/communityStore";
import { useCoachStore } from "../store/coachStore";
import { splitBadges, useChatBadges } from "../store/chatStore";
import { MatchesNavigator } from "./MatchesNavigator";
import { StatsNavigator } from "./StatsNavigator";
import { AICoachNavigator } from "./AICoachNavigator";
import { MainTabParamList } from "../types";
import { useAppTheme } from "../hooks/useAppTheme";

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Screens inside a tab that take the whole screen, tab bar and all. */
const FULL_SCREEN_ROUTES = new Set(["ScanSnooker", "RoutineAR"]);

/** Seven tabs is too many to label all at once without every word truncating ("Dashbo…", "AI
 * Co…") - only the active tab names itself, everything else is icon-only, exactly the way iOS's
 * own tab bar reads once you stop fighting it for space. */
const activeLabel =
  (text: string) =>
  ({ focused, color }: { focused: boolean; color: string }) =>
    focused ? (
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.2, color, marginTop: -2 }}>
        {text}
      </Text>
    ) : null;

/** A touch bigger and filled when selected, since there is no label doing that work for the other
 * six tabs at that moment. */
const tabIcon =
  (name: keyof typeof MaterialCommunityIcons.glyphMap, filledName?: keyof typeof MaterialCommunityIcons.glyphMap) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <MaterialCommunityIcons name={focused && filledName ? filledName : name} size={focused ? 25 : 22} color={color} />
  );

/**
 * The player's app. A coach account switches to CoachModeNavigator instead (see AppNavigator and
 * ProfileScreen's "Switch to coach view") rather than getting an extra tab here - see
 * CoachModeNavigator for why.
 */
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
  const matchRequests = useMatchesStore((state) => state.linkRequests.length);
  const coachNeedsResponse = useCoachStore(
    (state) => state.bookingsAsPlayer.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "player").length
  );
  const unseenPlayerResolutions = useCoachStore((state) => state.unseenPlayerResolutions);
  const coachingBadge = coachNeedsResponse + unseenPlayerResolutions;

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
          height: 54 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardNavigator}
        options={{
          tabBarLabel: activeLabel("Dashboard"),
          tabBarIcon: tabIcon("view-dashboard-outline", "view-dashboard"),
        }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeNavigator}
        options={({ route }) => ({
          tabBarLabel: activeLabel("Practice"),
          popToTopOnBlur: true,
          tabBarIcon: tabIcon("bullseye-arrow"),
          ...(FULL_SCREEN_ROUTES.has(getFocusedRouteNameFromRoute(route) ?? "")
            ? { tabBarStyle: { display: "none" as const } }
            : {}),
        })}
      />
      <Tab.Screen
        name="Community"
        component={CommunityNavigator}
        options={{
          tabBarLabel: activeLabel("Community"),
          popToTopOnBlur: true,
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
          tabBarIcon: tabIcon("account-group-outline", "account-group"),
        }}
      />
      <Tab.Screen
        name="Matches"
        component={MatchesNavigator}
        options={({ route }) => ({
          tabBarLabel: activeLabel("Matches"),
          tabBarBadge: matchRequests > 0 ? matchRequests : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
          tabBarIcon: tabIcon("trophy-outline", "trophy"),
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
          tabBarLabel: activeLabel("Stats"),
          tabBarIcon: tabIcon("chart-line"),
        }}
      />
      <Tab.Screen
        name="AICoach"
        component={AICoachNavigator}
        options={{
          tabBarLabel: activeLabel("Snookered Coach"),
          tabBarIcon: tabIcon("robot-outline", "robot"),
        }}
      />
      <Tab.Screen
        name="Coaching"
        component={CoachingNavigator}
        options={{
          tabBarLabel: activeLabel("Coaching"),
          tabBarBadge: coachingBadge > 0 ? coachingBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 11 },
          tabBarIcon: tabIcon("whistle-outline"),
        }}
      />
    </Tab.Navigator>
  );
};
