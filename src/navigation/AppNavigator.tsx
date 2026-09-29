import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  useAIAnalysesStore,
  useAuthStore,
  useCustomRoutinesStore,
  usePracticePlanStore,
  useMatchesStore,
  useRoutineScoresStore,
  useSessionsStore,
  useTournamentsStore,
} from "../store";
import { useScanSnookerStore } from "../store/scanSnookerStore";
import { useCommunityStore } from "../store/communityStore";
import { useChatStore } from "../store/chatStore";
import { useCoachStore } from "../store/coachStore";
import { navigationRef } from "./navigationRef";
import { routineIdFromLink } from "../features/community/links";

/** A routine link that arrived before the app was ready to show it. */
let pendingRoutineId: string | null = null;

const openRoutine = (id: string) => {
  if (navigationRef.isReady() && navigationRef.getRootState()?.routeNames?.includes("Main")) {
    navigationRef.navigate("Main", { screen: "Community", params: { screen: "SharedRoutine", params: { id } } });
    pendingRoutineId = null;
  } else {
    pendingRoutineId = id;
  }
};
import { supabase } from "../api/supabase";
import { startSync, stopSync } from "../sync";
import { MainTabNavigator } from "./MainTabNavigator";
import { CoachModeNavigator } from "./CoachModeNavigator";
import { useUiModeStore } from "../store/uiModeStore";
import { AuthNavigator } from "./AuthNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { LoadingPlayerScreen } from "../screens/auth/LoadingPlayerScreen";
import { ChooseViewScreen } from "../screens/auth/ChooseViewScreen";
import { LiveSessionScreen } from "../screens/coach/LiveSessionScreen";
import { PdfViewerScreen } from "../screens/shared/PdfViewerScreen";
import { CustomRoutineBuilderScreen } from "../screens/routines/CustomRoutineBuilderScreen";
import { RootStackParamList } from "../types";
import { useAppTheme } from "../hooks/useAppTheme";
import { initBilling, isBillingConfigured } from "../services/billing";
import { UnlockQueueProvider } from "../components/achievements/UnlockQueueProvider";
import { AchievementWatcher } from "../components/achievements/AchievementWatcher";
import { SendToChatScreen } from "../screens/community/SendToChatScreen";
import { OnboardingHost } from "../components/onboarding/OnboardingHost";
import { CoachApplicationStatusHost } from "../components/onboarding/CoachApplicationStatusHost";

const Stack = createNativeStackNavigator<RootStackParamList>();

/** The longest a fresh sign in waits for the player's data before opening anyway. */
const LOAD_TIMEOUT_MS = 10000;

export const AppNavigator = () => {
  const { session, isAuthenticated, requiresPasswordReset, setRequiresPasswordReset, setUser } = useAuthStore();
  const setSessionsOwner = useSessionsStore((state) => state.setOwnerUserId);
  const hydrateSessionsForUser = useSessionsStore((state) => state.hydrateSessionsForUser);
  const setMatchesOwner = useMatchesStore((state) => state.setOwnerUserId);
  const hydrateMatchesForUser = useMatchesStore((state) => state.hydrateMatchesForUser);
  const setRoutineScoresOwner = useRoutineScoresStore((state) => state.setOwnerUserId);
  const hydrateRoutineScoresForUser = useRoutineScoresStore((state) => state.hydrateEntriesForUser);
  const setTournamentsOwner = useTournamentsStore((state) => state.setOwnerUserId);
  const hydrateTournamentsForUser = useTournamentsStore((state) => state.hydrateTournamentsForUser);
  const setAIOwner = useAIAnalysesStore((state) => state.setOwnerUserId);
  const hydrateAIForUser = useAIAnalysesStore((state) => state.hydrateAnalysesForUser);
  const { isDark, colors } = useAppTheme();
  const isCoach = useCommunityStore((state) => state.me?.isCoach ?? false);
  // Only a genuinely dual account needs asking which view to open in - a "coach" or "player" only
  // signup already answered that at registration (see RegisterScreen and uiModeStore's seeded
  // default), so re-asking every session would just contradict what they already told us. An
  // account from before this wizard existed has no account_type at all - treated as dual so it
  // keeps the behaviour it already had rather than losing the prompt it relied on.
  const isDualAccount = useAuthStore((state) => {
    const type = state.user?.account_type;
    return type === "both" || type === undefined;
  });
  const viewMode = useUiModeStore((state) => state.viewMode);
  const MainScreen = isCoach && viewMode === "coach" ? CoachModeNavigator : MainTabNavigator;

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
      notification: colors.danger,
    },
  };

  // ---------------------------------------------------------------- loading a player's data
  // After a fresh sign in the stores start empty and fill from the account over a few seconds.
  // Showing the app in that time shows a player with no matches, no practice and level 1, then
  // everything pops in. So the app waits for it - unless this phone already holds their data
  // from last time, when it opens straight away and refreshes in the background.
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const loadingFor = useRef<string | null>(null);
  // A coach picks player or coach view once per app open, rather than always landing on player
  // with the coach view buried in Profile settings. Not shown again until the app is reopened.
  const [viewChosen, setViewChosen] = useState(false);

  const loadUser = useCallback(
    async (id: string) => {
      if (loadingFor.current === id) return;
      loadingFor.current = id;
      const cached = useMatchesStore.getState().ownerUserId === id;

      setSessionsOwner(id);
      setMatchesOwner(id);
      setRoutineScoresOwner(id);
      setTournamentsOwner(id);
      setAIOwner(id);
      useCustomRoutinesStore.getState().setOwner(id);
      usePracticePlanStore.getState().setOwner(id);
      useScanSnookerStore.getState().setOwner(id);
      useCommunityStore.getState().setOwner(id);
      void useCommunityStore.getState().hydrate(id);
      // A photo picked during registration, before email confirmation, uploads itself the moment a
      // session exists - not waited for, so it never delays getting into the app.
      void useAuthStore.getState().uploadPendingAvatar();
      useChatStore.getState().setOwner(id);
      void useChatStore.getState().refresh();
      // Not waited for: positions are only needed once a match is open.
      void useScanSnookerStore.getState().hydrate(id);
      // Not waited for: coach availability and bookings are only needed once that tab is open.
      useCoachStore.getState().setOwner(id);
      void useCoachStore.getState().hydrate(id);
      const loaded = Promise.allSettled([
        usePracticePlanStore.getState().hydrate(id),
        useCustomRoutinesStore.getState().hydrate(id),
        hydrateSessionsForUser(id),
        hydrateMatchesForUser(id),
        hydrateRoutineScoresForUser(id),
        hydrateTournamentsForUser(id),
        hydrateAIForUser(id),
      ]);

      if (cached) {
        setReadyUserId(id);
        return;
      }
      // Never keep someone on the loading screen for long: on a poor connection, open with what
      // there is and let the rest arrive.
      await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS))]);
      if (loadingFor.current === id) setReadyUserId(id);
    },
    [
      hydrateAIForUser,
      hydrateMatchesForUser,
      hydrateRoutineScoresForUser,
      hydrateSessionsForUser,
      hydrateTournamentsForUser,
      setAIOwner,
      setMatchesOwner,
      setRoutineScoresOwner,
      setSessionsOwner,
      setTournamentsOwner,
    ]
  );

  // A routine link opened before sign in, or while the app was starting, opens once it is ready.
  useEffect(() => {
    if (!readyUserId || !pendingRoutineId) return;
    const timer = setTimeout(() => pendingRoutineId && openRoutine(pendingRoutineId), 600);
    return () => clearTimeout(timer);
  }, [readyUserId]);

  const forgetUser = useCallback(() => {
    loadingFor.current = null;
    useCustomRoutinesStore.getState().setOwner(null);
    usePracticePlanStore.getState().setOwner(null);
    useScanSnookerStore.getState().setOwner(null);
    useCommunityStore.getState().setOwner(null);
    useChatStore.getState().setOwner(null);
    useCoachStore.getState().setOwner(null);
    useUiModeStore.getState().setViewMode("player");
    setReadyUserId(null);
    setViewChosen(false);
  }, []);

  const extractAuthParams = (url: string) => {
    const decode = (value: string) => {
      try {
        return decodeURIComponent(value.replace(/\+/g, " "));
      } catch {
        return value;
      }
    };

    const parseChunk = (chunk: string) =>
      chunk
        .split("&")
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, pair) => {
          const [rawKey, ...rawRest] = pair.split("=");
          if (!rawKey) return acc;
          acc[decode(rawKey)] = decode(rawRest.join("="));
          return acc;
        }, {});

    const hash = url.includes("#") ? url.split("#")[1] : "";
    const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
    const params = { ...parseChunk(query), ...parseChunk(hash) };

    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    const type = params.type;
    const token_hash = params.token_hash;

    return { access_token, refresh_token, type, token_hash };
  };

  useEffect(() => {
    // Check for existing session on app start
    if (session?.user) {
      setUser(session.user);
      if (isBillingConfigured()) {
        void initBilling(session.user.id).catch((error) => {
          console.warn("Billing init failed:", {
            message: error?.message,
            detail: error?.detail,
            code: error?.code,
          });
        });
      }
      void loadUser(session.user.id);
      startSync(session.user.id);
    } else {
      forgetUser();
      stopSync();
      setSessionsOwner(null);
      setMatchesOwner(null);
      setRoutineScoresOwner(null);
      setTournamentsOwner(null);
      setAIOwner(null);
    }
  }, [
    forgetUser,
    loadUser,
    session,
    setMatchesOwner,
    setRoutineScoresOwner,
    setSessionsOwner,
    setTournamentsOwner,
    setAIOwner,
    setUser,
  ]);

  useEffect(() => {
    let disposed = false;

    const handleAuthDeepLink = async (url: string | null) => {
      if (!url || disposed) return;

      // A shared routine's link: open it (once signed in).
      const routineId = routineIdFromLink(url);
      if (routineId) {
        openRoutine(routineId);
        return;
      }

      const { access_token, refresh_token, type, token_hash } = extractAuthParams(url);

      // A password reset from the website carries a one-time code; the app spends it itself.
      if (token_hash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" });
        if (!error) setRequiresPasswordReset(true);
        return;
      }

      if (!access_token || !refresh_token) return;

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) return;

      setRequiresPasswordReset(type === "recovery");
    };

    void Linking.getInitialURL().then((url) => {
      void handleAuthDeepLink(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthDeepLink(url);
    });

    return () => {
      disposed = true;
      subscription.remove();
    };
  }, [setRequiresPasswordReset]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession?.user) {
        setUser(nextSession.user);
        if (isBillingConfigured()) {
          void initBilling(nextSession.user.id).catch((error) => {
            console.warn("Billing init failed:", {
              message: error?.message,
              detail: error?.detail,
              code: error?.code,
            });
          });
        }
        void loadUser(nextSession.user.id);
        startSync(nextSession.user.id);
        return;
      }

      setUser(null);
      setRequiresPasswordReset(false);
      forgetUser();
      stopSync();
      setSessionsOwner(null);
      setMatchesOwner(null);
      setRoutineScoresOwner(null);
      setTournamentsOwner(null);
      setAIOwner(null);
    });

    return () => listener.subscription.unsubscribe();
  }, [
    forgetUser,
    loadUser,
    setAIOwner,
    setMatchesOwner,
    setRoutineScoresOwner,
    setRequiresPasswordReset,
    setSessionsOwner,
    setTournamentsOwner,
    setUser,
  ]);

  return (
    <UnlockQueueProvider>
      <AchievementWatcher>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isAuthenticated && !requiresPasswordReset && readyUserId !== userId ? (
              <Stack.Screen name="Loading" component={LoadingPlayerScreen} />
            ) : isAuthenticated && !requiresPasswordReset && isCoach && isDualAccount && !viewChosen ? (
              <Stack.Screen name="ChooseView">
                {() => <ChooseViewScreen onChoose={() => setViewChosen(true)} />}
              </Stack.Screen>
            ) : isAuthenticated && !requiresPasswordReset ? (
              <>
                <Stack.Screen name="Main" component={MainScreen} />
                <Stack.Screen name="ProfileModal" component={ProfileNavigator} options={{ presentation: "modal" }} />
                <Stack.Screen name="SendToChat" component={SendToChatScreen} options={{ presentation: "modal" }} />
                <Stack.Screen name="LiveSession" component={LiveSessionScreen} options={{ presentation: "modal" }} />
                <Stack.Screen
                  name="PdfViewer"
                  component={PdfViewerScreen}
                  options={({ route }) => ({
                    presentation: "modal",
                    headerShown: true,
                    title: route.params.title || "Document",
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                  })}
                />
                <Stack.Screen
                  name="CustomRoutineBuilder"
                  component={CustomRoutineBuilderScreen}
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "New routine",
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                  }}
                />
              </>
            ) : (
              <Stack.Screen name="Auth" component={AuthNavigator} />
            )}
          </Stack.Navigator>
          {isAuthenticated &&
          !requiresPasswordReset &&
          readyUserId === userId &&
          !(isCoach && isDualAccount && !viewChosen) ? (
            <>
              <OnboardingHost />
              <CoachApplicationStatusHost />
            </>
          ) : null}
        </NavigationContainer>
      </AchievementWatcher>
    </UnlockQueueProvider>
  );
};
