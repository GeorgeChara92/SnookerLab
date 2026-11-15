import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { navigationRef } from "../../navigation/navigationRef";
import { useAuthStore } from "../../store/authStore";
import { useUiModeStore } from "../../store/uiModeStore";
import { isConversationOpen, registerForPush } from "../../features/notifications/push";

const dataOf = (notification: Notifications.Notification) =>
  (notification.request.content.data as Record<string, unknown> | undefined) ?? {};

const matchIdOf = (notification: Notifications.Notification): number | null => {
  const id = Number(dataOf(notification).proTourMatchId);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const isAdminReport = (notification: Notifications.Notification) => dataOf(notification).adminReports === true;

const conversationIdOf = (notification: Notifications.Notification): string | null => {
  const id = dataOf(notification).conversationId;
  return typeof id === "string" && id ? id : null;
};

/** The social and coaching notifications the server sends (20261115_0002_more_push.sql). */
type Kind = "friendRequest" | "friendAccepted" | "matchConfirm" | "matchAnswered" | "groupInvite" | "coachBooking";
const KINDS: Kind[] = ["friendRequest", "friendAccepted", "matchConfirm", "matchAnswered", "groupInvite", "coachBooking"];
const kindOf = (notification: Notifications.Notification): Kind | null => {
  const kind = dataOf(notification).kind;
  return typeof kind === "string" && (KINDS as string[]).includes(kind) ? (kind as Kind) : null;
};
const textOf = (notification: Notifications.Notification, key: string): string | null => {
  const value = dataOf(notification)[key];
  return typeof value === "string" && value ? value : null;
};

// With the app open, a followed player's match starting or finishing shows as a banner, and so do
// a new report (for admins) and a chat message, unless that chat is the one on screen. Anything
// else stays quiet.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const conversationId = conversationIdOf(notification);
    const show =
      matchIdOf(notification) != null ||
      isAdminReport(notification) ||
      kindOf(notification) != null ||
      (conversationId != null && !isConversationOpen(conversationId));
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

const mainReady = () => !!navigationRef.isReady() && !!navigationRef.getRootState()?.routeNames?.includes("Main");

/** Whether coach view is on screen, which has its own Chats tab in place of Community. */
const inCoachView = () => {
  const main = navigationRef.getRootState()?.routes?.find((route) => route.name === "Main");
  const tabs = main?.state?.routeNames as string[] | undefined;
  return tabs ? tabs.includes("CoachChats") : useUiModeStore.getState().viewMode === "coach";
};

const openMatch = (matchId: number) => {
  if (!mainReady()) return false;
  navigationRef.navigate("Main", { screen: "Community", params: { screen: "ProTourMatch", params: { matchId } } });
  return true;
};

const openChat = (conversationId: string) => {
  if (!mainReady()) return false;
  // `initial: false` keeps the chat list underneath, so Back goes to it.
  const chat = { screen: "Chat", params: { conversationId }, initial: false };
  navigationRef.navigate("Main", inCoachView() ? { screen: "CoachChats", params: chat } : { screen: "Community", params: chat });
  return true;
};

/** Somewhere in the player's tabs: Community, Matches or Coaching. */
const openPlayerTab = (tab: "Community" | "Matches" | "Coaching", screen?: string, params?: object) => {
  if (!mainReady()) return false;
  if (inCoachView()) useUiModeStore.getState().setViewMode("player");
  navigationRef.navigate("Main", screen ? { screen: tab, params: { screen, params, initial: false } } : { screen: tab });
  return true;
};

/** A coach's own booking: the day's sessions in coach view, switching to it if need be. */
const openCoachToday = () => {
  if (!mainReady()) return false;
  if (!inCoachView()) {
    useUiModeStore.getState().setViewMode("coach");
    return false; // coach view mounts on the next frame; the retry below opens the tab
  }
  navigationRef.navigate("Main", { screen: "CoachToday" });
  return true;
};

/** Where each kind of notification leads when tapped. */
const openKind = (notification: Notifications.Notification): (() => boolean) | null => {
  switch (kindOf(notification)) {
    case "friendRequest":
      return () => openPlayerTab("Community", "CommunityHome", { segment: "requests" });
    case "friendAccepted": {
      const userId = textOf(notification, "userId");
      return () => (userId ? openPlayerTab("Community", "PlayerProfile", { userId }) : openPlayerTab("Community"));
    }
    case "matchConfirm":
      return () => openPlayerTab("Matches", "MatchesList");
    case "matchAnswered": {
      const matchId = textOf(notification, "matchId");
      return () => (matchId ? openPlayerTab("Matches", "MatchDetail", { matchId }) : openPlayerTab("Matches"));
    }
    case "groupInvite":
      return () => openPlayerTab("Community", "Groups");
    case "coachBooking":
      return textOf(notification, "side") === "coach" ? openCoachToday : () => openPlayerTab("Coaching");
    default:
      return null;
  }
};

/** Reports live under Community in the player's view; it is where an admin reviews them. */
const openReports = () => {
  if (!mainReady()) return false;
  navigationRef.navigate("Main", { screen: "Community", params: { screen: "AdminReports", initial: false } });
  return true;
};

/** Opens what a tapped notification is about: the pro match, the chat the message is in, or the
 *  admin's Reports, including the tap that launched the app. Also keeps this phone's push token on
 *  the account that is signed in, without asking for permission. */
export const NotificationHost = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  useEffect(() => {
    void registerForPush(userId, false);
  }, [userId]);

  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const matchId = matchIdOf(last.notification);
    const conversationId = conversationIdOf(last.notification);
    const go =
      matchId != null
        ? () => openMatch(matchId)
        : conversationId != null
          ? () => openChat(conversationId)
          : isAdminReport(last.notification)
            ? openReports
            : openKind(last.notification);
    if (!go) return;
    // Cleared only once it has opened: clearing changes `last`, which would cancel the retry.
    const open = () => {
      if (!go()) return false;
      void Notifications.clearLastNotificationResponseAsync?.();
      return true;
    };
    // The navigator may still be mounting on a cold start (or switching view); try again shortly.
    if (!open()) {
      const first = setTimeout(() => {
        if (!open()) second = setTimeout(open, 900);
      }, 800);
      let second: ReturnType<typeof setTimeout> | undefined;
      return () => {
        clearTimeout(first);
        if (second) clearTimeout(second);
      };
    }
  }, [last]);
  return null;
};
