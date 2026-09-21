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
import { navigationRef } from "./navigationRef";
import { supabase } from "../api/supabase";
import { startSync, stopSync } from "../sync";
import { MainTabNavigator } from "./MainTabNavigator";
import { AuthNavigator } from "./AuthNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { LoadingPlayerScreen } from "../screens/auth/LoadingPlayerScreen";
import { RootStackParamList } from "../types";
import { useAppTheme } from "../hooks/useAppTheme";
import { initBilling, isBillingConfigured } from "../services/billing";
import { UnlockQueueProvider } from "../components/achievements/UnlockQueueProvider";
import { AchievementWatcher } from "../components/achievements/AchievementWatcher";

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
      // Not waited for: positions are only needed once a match is open.
      void useScanSnookerStore.getState().hydrate(id);
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

  const forgetUser = useCallback(() => {
    loadingFor.current = null;
    useCustomRoutinesStore.getState().setOwner(null);
    usePracticePlanStore.getState().setOwner(null);
    useScanSnookerStore.getState().setOwner(null);
    setReadyUserId(null);
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

    return { access_token, refresh_token, type };
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

      const { access_token, refresh_token, type } = extractAuthParams(url);
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
            ) : isAuthenticated && !requiresPasswordReset ? (
              <>
                <Stack.Screen name="Main" component={MainTabNavigator} />
                <Stack.Screen
                  name="ProfileModal"
                  component={ProfileNavigator}
                  options={{ presentation: "modal" }}
                />
              </>
            ) : (
              <Stack.Screen name="Auth" component={AuthNavigator} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AchievementWatcher>
    </UnlockQueueProvider>
  );
};
