import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

/**
 * Adds a confirmed session to the phone's own calendar app, so it shows up next to everything
 * else a coach has on that day - not automatic, only when they tap "Add to calendar" on a booking.
 */
export const addBookingToCalendar = async (
  booking: { startsAt: string; endsAt: string },
  title: string
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") {
    return { ok: false, message: "Turn on Calendar access for Snookered in Settings to add this." };
  }

  let calendarId: string | null = null;
  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    calendarId = defaultCalendar?.id ?? null;
  }
  if (!calendarId) {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    calendarId = calendars.find((item) => item.allowsModifications)?.id ?? null;
  }
  if (!calendarId) return { ok: false, message: "No calendar on this phone can be added to." };

  await Calendar.createEventAsync(calendarId, {
    title,
    startDate: new Date(booking.startsAt),
    endDate: new Date(booking.endsAt),
  });
  return { ok: true };
};
