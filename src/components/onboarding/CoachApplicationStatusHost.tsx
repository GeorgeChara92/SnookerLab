import { useEffect } from "react";
import { useAuthStore } from "../../store";
import { useCoachApplicationStatusStore } from "../../store/coachApplicationStatusStore";
import { useMyCoachApplicationStore } from "../../store/myCoachApplicationStore";
import { useDialog } from "../ui/DialogProvider";

/**
 * Tells a player, once, the moment their coach application has been decided - approved or
 * rejected - rather than leaving them to notice next time they open Profile. Pending applications
 * show their status there instead, and now in the player-view header pill too (PlayerRootHeader);
 * this is only for the moment it stops being pending.
 */
export const CoachApplicationStatusHost = () => {
  const user = useAuthStore((state) => state.user);
  const dialog = useDialog();
  const { seen, markSeen } = useCoachApplicationStatusStore();
  const refresh = useMyCoachApplicationStore((state) => state.refresh);

  useEffect(() => {
    if (!user?.id || !user.email) return;
    const timer = setTimeout(() => {
      void refresh(user.id, user.email!).then(() => {
        const application = useMyCoachApplicationStore.getState().application;
        if (!application || application.status === "pending") return;
        if (seen[application.id] === application.status) return;
        markSeen(application.id, application.status);
        if (application.status === "approved") {
          dialog.alert({
            title: "You're a coach!",
            message: "Your application was approved. Head to Profile to set up your coaching profile and open your calendar.",
            icon: "whistle-outline",
            confirmLabel: "Great",
          });
        } else {
          dialog.alert({
            title: "Your coach application",
            message: application.reviewerNote || "We could not approve it this time. You're welcome to apply again.",
            icon: "close-circle-outline",
            confirmLabel: "OK",
          });
        }
      });
    }, 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
};
