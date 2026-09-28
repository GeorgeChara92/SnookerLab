import * as Notifications from "expo-notifications";
import type { CoachBooking } from "./types";

const REMINDER_LEAD_MINUTES = 60;

/**
 * A local, on-device reminder that a confirmed session is coming up - scheduled and cancelled
 * entirely on the phone, keyed by booking id so re-scheduling the same booking just replaces it.
 * No server or push infrastructure involved.
 */
export const scheduleSessionReminder = async (booking: Pick<CoachBooking, "id" | "startsAt">, playerName: string): Promise<void> => {
  const fireAt = new Date(new Date(booking.startsAt).getTime() - REMINDER_LEAD_MINUTES * 60_000);
  if (fireAt.getTime() <= Date.now()) {
    await cancelSessionReminder(booking.id);
    return;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  await Notifications.scheduleNotificationAsync({
    identifier: booking.id,
    content: {
      title: "Session coming up",
      body: `${playerName} in ${REMINDER_LEAD_MINUTES} minutes`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
};

export const cancelSessionReminder = async (bookingId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(bookingId);
};

/** A notification right now, for something that just happened to a booking (accepted, declined,
 * cancelled, moved) - fired locally on whoever's own device notices the change via live sync, not
 * pushed from the other person's phone. */
export const notifyBookingUpdate = async (title: string, body: string): Promise<void> => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
};
