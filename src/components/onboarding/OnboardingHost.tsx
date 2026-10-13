import React, { useMemo } from "react";
import Constants from "expo-constants";
import { useAuthStore } from "../../store";
import { supabase } from "../../api/supabase";
import { accountAge } from "../../features/onboarding/accountAge";
import { useOnboardingStore, type Audience } from "../../store/onboardingStore";
import { RELEASE_NOTES, unseenNotes } from "../../constants/releaseNotes";
import { navigationRef } from "../../navigation/navigationRef";
import { WelcomeTour, type TourChoice } from "./WelcomeTour";
import { WhatsNewSheet } from "./WhatsNewSheet";

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** A player account this new gets the tour; anyone older has been using the app already. Every
 * coach account is new to coach view the first time it opens it, so the coach tour has no age
 * gate - "have they seen coach view before" is the only question that makes sense there. */
const NEW_FOR_MS = 30 * 86_400_000;

/** Remembered on the account too, so a new phone or a reinstall does not show it again. */
const rememberOnAccount = (audience: Audience) =>
  void supabase.auth
    .updateUser({ data: audience === "coach" ? { coach_tour_seen: true } : { tour_seen: true } })
    .catch(() => undefined);

/**
 * Whether to show the welcome tour or the "What's new" sheet for a view, and which - never both,
 * since someone just shown round does not need telling what's new as well. Call this from that
 * view's own dashboard screen, on focus (see DashboardHomeScreen and CoachAnalyticsDashboardScreen)
 * rather than on a fixed timer after sign in: a timer fires wherever the app happens to be a moment
 * after login, which could be anywhere the user navigated straight to, not necessarily a dashboard.
 * Tied to focus instead, it only ever appears where it is meant to, and re-checks itself every time
 * that view is opened - including a switch from player to coach view later in the same session.
 */
export const showOnboardingIfDue = (audience: Audience) => {
  const user = useAuthStore.getState().user;
  if (!user?.id) return;
  const store = useOnboardingStore.getState();
  if (store.open) return;

  const seenOnAccount = audience === "coach" ? user.coach_tour_seen : user.tour_seen;
  if (!store.toursDone[audience].includes(user.id) && !seenOnAccount) {
    if (audience === "coach" || accountAge(user.created_at) < NEW_FOR_MS) {
      store.openTour(audience);
      return;
    }
    store.skipTour(user.id, audience);
    rememberOnAccount(audience);
  }

  if (unseenNotes(APP_VERSION, store.seenVersion[audience], audience).length) store.openWhatsNew(audience);
  else store.markSeen(audience, APP_VERSION);
};

export const OnboardingHost = () => {
  const user = useAuthStore((state) => state.user);
  const open = useOnboardingStore((state) => state.open);
  const seenVersion = useOnboardingStore((state) => state.seenVersion);
  const finishTour = useOnboardingStore((state) => state.finishTour);
  const close = useOnboardingStore((state) => state.close);
  const markSeen = useOnboardingStore((state) => state.markSeen);

  // After an update, what is new since last time in this view; from Settings, the latest release
  // for this view at least.
  const notes = useMemo(() => {
    if (!open) return [];
    const unseen = unseenNotes(APP_VERSION, seenVersion[open.audience], open.audience);
    if (unseen.length) return unseen;
    return RELEASE_NOTES.filter((note) => note.audience === open.audience || note.audience === "both").slice(0, 1);
  }, [open, seenVersion]);

  const onTourDone = (choice: TourChoice) => {
    if (!open) return;
    const audience = open.audience;
    finishTour(user?.id ?? null, audience, APP_VERSION);
    rememberOnAccount(audience);
    if (!choice || !navigationRef.isReady()) return;
    // Once the tour has gone, take them where they chose.
    setTimeout(() => {
      if (audience === "player") {
        if (choice === "match")
          navigationRef.navigate("Main", { screen: "Matches", params: { screen: "NewMatch", initial: false } });
        if (choice === "practice") navigationRef.navigate("Main", { screen: "Practice" });
        if (choice === "community") navigationRef.navigate("Main", { screen: "Community" });
      } else {
        if (choice === "calendar") navigationRef.navigate("Main", { screen: "CoachCalendar" });
        if (choice === "clients") navigationRef.navigate("Main", { screen: "CoachClients" });
        if (choice === "groups") navigationRef.navigate("Main", { screen: "CoachGroups" });
      }
    }, 400);
  };

  return (
    <>
      <WelcomeTour visible={open?.kind === "tour"} variant={open?.audience ?? "player"} onDone={onTourDone} />
      <WhatsNewSheet
        visible={open?.kind === "whatsNew"}
        notes={notes}
        onClose={() => {
          if (open) markSeen(open.audience, APP_VERSION);
          close();
        }}
      />
    </>
  );
};
