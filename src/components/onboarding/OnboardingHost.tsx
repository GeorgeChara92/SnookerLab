import React, { useEffect, useMemo } from "react";
import Constants from "expo-constants";
import { useAuthStore } from "../../store";
import { supabase } from "../../api/supabase";
import { accountAge } from "../../features/onboarding/accountAge";
import { useOnboardingStore } from "../../store/onboardingStore";
import { RELEASE_NOTES, unseenNotes } from "../../constants/releaseNotes";
import { navigationRef } from "../../navigation/navigationRef";
import { WelcomeTour, type TourChoice } from "./WelcomeTour";
import { WhatsNewSheet } from "./WhatsNewSheet";

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** An account this new gets the tour; anyone older has been using the app already. */
const NEW_FOR_MS = 30 * 86_400_000;

/** Remembered on the account too, so a new phone or a reinstall does not show it again. */
const rememberOnAccount = () => void supabase.auth.updateUser({ data: { tour_seen: true } }).catch(() => undefined);

/**
 * Shows the welcome tour to someone new, or the "What's new" sheet once after an update - never
 * both. It waits a moment after sign in so it does not land on top of the app loading.
 */
export const OnboardingHost = () => {
  const user = useAuthStore((state) => state.user);
  const { open, seenVersion, openTour, openWhatsNew, close, finishTour, skipTour, markSeen } = useOnboardingStore();

  useEffect(() => {
    if (!user?.id) return;
    const timer = setTimeout(() => {
      const state = useOnboardingStore.getState();
      if (state.open) return;
      if (!state.toursDone.includes(user.id) && !user.tour_seen) {
        if (accountAge(user.created_at) < NEW_FOR_MS) {
          openTour();
          return;
        }
        skipTour(user.id);
        rememberOnAccount();
      }
      if (unseenNotes(APP_VERSION, state.seenVersion).length) openWhatsNew();
      else markSeen(APP_VERSION);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // After an update, what is new since last time; from Settings, the latest release at least.
  const notes = useMemo(() => {
    const unseen = unseenNotes(APP_VERSION, seenVersion);
    return unseen.length ? unseen : RELEASE_NOTES.slice(0, 1);
  }, [seenVersion]);

  const onTourDone = (choice: TourChoice) => {
    finishTour(user?.id ?? null, APP_VERSION);
    rememberOnAccount();
    if (!choice || !navigationRef.isReady()) return;
    // Once the tour has gone, take them where they chose.
    setTimeout(() => {
      if (choice === "match")
        navigationRef.navigate("Main", { screen: "Matches", params: { screen: "NewMatch", initial: false } });
      if (choice === "practice") navigationRef.navigate("Main", { screen: "Practice" });
      if (choice === "community") navigationRef.navigate("Main", { screen: "Community" });
    }, 400);
  };

  return (
    <>
      <WelcomeTour visible={open === "tour"} onDone={onTourDone} />
      <WhatsNewSheet
        visible={open === "whatsNew"}
        notes={notes}
        onClose={() => {
          markSeen(APP_VERSION);
          close();
        }}
      />
    </>
  );
};
