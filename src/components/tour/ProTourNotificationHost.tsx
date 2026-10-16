import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { navigationRef } from "../../navigation/navigationRef";

const matchIdOf = (notification: Notifications.Notification): number | null => {
  const id = Number((notification.request.content.data as Record<string, unknown> | undefined)?.proTourMatchId);
  return Number.isFinite(id) && id > 0 ? id : null;
};

// A followed player's match starting or finishing shows as a banner even with the app open. Every
// other notification keeps the default (nothing shown in the foreground).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = matchIdOf(notification) != null;
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

const openMatch = (matchId: number) => {
  if (!navigationRef.isReady() || !navigationRef.getRootState()?.routeNames?.includes("Main")) return false;
  navigationRef.navigate("Main", { screen: "Community", params: { screen: "ProTourMatch", params: { matchId } } });
  return true;
};

/** Opens the match when someone taps a "match started / finished" push for a player they follow -
 *  including the tap that launched the app. */
export const ProTourNotificationHost = () => {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const matchId = matchIdOf(last.notification);
    if (matchId == null) return;
    // The navigator may still be mounting on a cold start; try again shortly.
    if (!openMatch(matchId)) {
      const timer = setTimeout(() => openMatch(matchId), 800);
      return () => clearTimeout(timer);
    }
    void Notifications.clearLastNotificationResponseAsync?.();
  }, [last]);
  return null;
};
