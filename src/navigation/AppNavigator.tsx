import React, { useEffect } from "react";
import { Linking } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  useAIAnalysesStore,
  useAuthStore,
  useMatchesStore,
  useRoutineScoresStore,
  useSessionsStore,
  useTournamentsStore,
} from "../store";
import { supabase } from "../api/supabase";
import { startSync, stopSync } from "../sync";
import { MainTabNavigator } from "./MainTabNavigator";
import { AuthNavigator } from "./AuthNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { RootStackParamList } from "../types";
import { useAppTheme } from "../hooks/useAppTheme";
import { initBilling, isBillingConfigured } from "../services/billing";
import { UnlockQueueProvider } from "../components/achievements/UnlockQueueProvider";
import { AchievementWatcher } from "../components/achievements/AchievementWatcher";

const Stack = createNativeStackNavigator<RootStackParamList>();

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
      setSessionsOwner(session.user.id);
      void hydrateSessionsForUser(session.user.id);
      setMatchesOwner(session.user.id);
      void hydrateMatchesForUser(session.user.id);
      setRoutineScoresOwner(session.user.id);
      void hydrateRoutineScoresForUser(session.user.id);
      setTournamentsOwner(session.user.id);
      void hydrateTournamentsForUser(session.user.id);
      setAIOwner(session.user.id);
      void hydrateAIForUser(session.user.id);
      startSync(session.user.id);
    } else {
      stopSync();
      setSessionsOwner(null);
      setMatchesOwner(null);
      setRoutineScoresOwner(null);
      setTournamentsOwner(null);
      setAIOwner(null);
    }
  }, [
    hydrateAIForUser,
    hydrateMatchesForUser,
    hydrateRoutineScoresForUser,
    hydrateSessionsForUser,
    hydrateTournamentsForUser,
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
        setSessionsOwner(nextSession.user.id);
        void hydrateSessionsForUser(nextSession.user.id);
        setMatchesOwner(nextSession.user.id);
        void hydrateMatchesForUser(nextSession.user.id);
        setRoutineScoresOwner(nextSession.user.id);
        void hydrateRoutineScoresForUser(nextSession.user.id);
        setTournamentsOwner(nextSession.user.id);
        void hydrateTournamentsForUser(nextSession.user.id);
        setAIOwner(nextSession.user.id);
        void hydrateAIForUser(nextSession.user.id);
        startSync(nextSession.user.id);
        return;
      }

      setUser(null);
      setRequiresPasswordReset(false);
      stopSync();
      setSessionsOwner(null);
      setMatchesOwner(null);
      setRoutineScoresOwner(null);
      setTournamentsOwner(null);
      setAIOwner(null);
    });

    return () => listener.subscription.unsubscribe();
  }, [
    hydrateAIForUser,
    hydrateMatchesForUser,
    hydrateRoutineScoresForUser,
    hydrateSessionsForUser,
    hydrateTournamentsForUser,
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
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isAuthenticated && !requiresPasswordReset ? (
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
