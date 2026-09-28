/** A window of time a coach has said they can take a session. */
export type CoachSlot = {
  id: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
};

export type BookingStatus = "pending" | "accepted" | "declined" | "cancelled";

/** A player's request for a slot, and how the coach answered it - or an entry the coach put
 * straight into their own diary. playerId is null exactly when guestName is set: someone with no
 * Snookered account, booked in by name alone. */
export type CoachBooking = {
  id: string;
  coachId: string;
  playerId: string | null;
  guestName: string | null;
  availabilityId: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  note: string | null;
  /** Why it was last moved, if the person who moved it said - shown to whichever side did not. */
  rescheduleReason: string | null;
  /** While status is "pending", who still needs to answer - the coach for a fresh request or a
   * player-proposed reschedule, the player for a coach-proposed reschedule. Null once answered. */
  awaitingResponseFrom: "coach" | "player" | null;
  createdAt: string;
};

export const slotFromRow = (row: any): CoachSlot => ({
  id: row.id,
  coachId: row.coach_id,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
});

export const SLOT_COLUMNS = "id, coach_id, starts_at, ends_at";

export const bookingFromRow = (row: any): CoachBooking => ({
  id: row.id,
  coachId: row.coach_id,
  playerId: row.player_id ?? null,
  guestName: row.guest_name ?? null,
  availabilityId: row.availability_id ?? null,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  status: row.status,
  note: row.note ?? null,
  rescheduleReason: row.reschedule_reason ?? null,
  awaitingResponseFrom: row.awaiting_response_from ?? null,
  createdAt: row.created_at,
});

export const BOOKING_COLUMNS =
  "id, coach_id, player_id, guest_name, availability_id, starts_at, ends_at, status, note, reschedule_reason, awaiting_response_from, created_at";

/** Great-circle distance between two points, in kilometres. */
export const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** playerId is set for a real account, guestName for someone booked in by name alone - never both.
 * key is what groups repeat bookings into one client row: the player's id, or the guest's name
 * lowercased (there is no account to key a guest by, so the same typed name is what makes them
 * "the same client" across visits). */
export type Client = { key: string; playerId: string | null; guestName: string | null; sessions: number; lastAt: string };

/** The same grouping key clientsOf uses, exposed so a client's booking history can be found again
 * by whichever key was used to navigate to them (a real playerId, or a guest's "guest:name" key). */
export const clientKeyOf = (booking: CoachBooking): string =>
  booking.playerId ?? `guest:${(booking.guestName ?? "").trim().toLowerCase()}`;

/** Everyone who has ever had a live booking with this coach, most recently active first. Declined
 * and cancelled requests never happened, so they do not count as a session or make someone a client. */
export const clientsOf = (bookings: CoachBooking[]): Client[] => {
  const byClient = new Map<string, Client>();
  for (const booking of bookings) {
    if (booking.status === "cancelled" || booking.status === "declined") continue;
    const key = clientKeyOf(booking);
    const existing = byClient.get(key);
    if (!existing) {
      byClient.set(key, { key, playerId: booking.playerId, guestName: booking.guestName, sessions: 1, lastAt: booking.startsAt });
    } else {
      existing.sessions += 1;
      if (booking.startsAt > existing.lastAt) existing.lastAt = booking.startsAt;
    }
  }
  return [...byClient.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
};

/** Slots still open to book: no live (pending or accepted) booking sits against them, and they
 * have not already passed. */
export const openSlots = (slots: CoachSlot[], bookings: CoachBooking[], now: Date = new Date()): CoachSlot[] => {
  const taken = new Set(
    bookings.filter((booking) => booking.status === "pending" || booking.status === "accepted").map((booking) => booking.availabilityId)
  );
  return slots.filter((slot) => !taken.has(slot.id) && new Date(slot.startsAt) > now);
};

export type CoachStats = {
  sessionsThisMonth: number;
  sessionsToday: number;
  topClient: Client | null;
};

/** The numbers for a coach's dashboard: confirmed sessions this month and today, and who they see
 * most - counting only accepted bookings, since a request that never happened is not a session. */
export const coachStats = (bookings: CoachBooking[], now: Date = new Date()): CoachStats => {
  const accepted = bookings.filter((booking) => booking.status === "accepted");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayKey = (iso: string) => new Date(iso).toDateString();
  const sessionsThisMonth = accepted.filter((booking) => new Date(booking.startsAt) >= monthStart).length;
  const sessionsToday = accepted.filter((booking) => dayKey(booking.startsAt) === now.toDateString()).length;
  const clients = clientsOf(bookings);
  const topClient = clients.length ? clients.reduce((top, client) => (client.sessions > top.sessions ? client : top)) : null;
  return { sessionsThisMonth, sessionsToday, topClient };
};

/** Whether a session's time window has started but not yet ended, for the "start session" flow. */
export const isSessionLive = (booking: Pick<CoachBooking, "startsAt" | "endsAt">, now: Date = new Date()): boolean =>
  now >= new Date(booking.startsAt) && now <= new Date(booking.endsAt);

/** A routine covered in one session: what was worked on, how the client did, and any notes
 * specific to that routine - several of these can sit under one session. */
export type SessionRoutineEntry = {
  id: string;
  bookingId: string;
  routineId: string;
  routineName: string;
  score: number | null;
  notes: string | null;
  createdAt: string;
};

export const sessionRoutineFromRow = (row: any): SessionRoutineEntry => ({
  id: row.id,
  bookingId: row.booking_id,
  routineId: row.routine_id,
  routineName: row.routine_name,
  score: row.score ?? null,
  notes: row.notes ?? null,
  createdAt: row.created_at,
});

export const SESSION_ROUTINE_COLUMNS = "id, booking_id, routine_id, routine_name, score, notes, created_at";

/** A coach's own broadcast group: their clients, and the practice content they post for them. */
export type CoachGroup = { id: string; coachId: string; name: string; createdAt: string };

export const coachGroupFromRow = (row: any): CoachGroup => ({
  id: row.id,
  coachId: row.coach_id,
  name: row.name,
  createdAt: row.created_at,
});

export const COACH_GROUP_COLUMNS = "id, coach_id, name, created_at";

export type CoachGroupMember = { groupId: string; playerId: string; addedAt: string };

export const coachGroupMemberFromRow = (row: any): CoachGroupMember => ({
  groupId: row.group_id,
  playerId: row.player_id,
  addedAt: row.added_at,
});

export type CoachGroupMediaType = "image" | "video" | "pdf";

export type CoachGroupPost = {
  id: string;
  groupId: string;
  coachId: string;
  caption: string | null;
  mediaPath: string;
  mediaType: CoachGroupMediaType;
  /** The file's own original name, e.g. "Week 3 Safety Drills.pdf" - shown when there is no caption. */
  fileName: string | null;
  createdAt: string;
};

export const coachGroupPostFromRow = (row: any): CoachGroupPost => ({
  id: row.id,
  groupId: row.group_id,
  coachId: row.coach_id,
  caption: row.caption ?? null,
  mediaPath: row.media_path,
  mediaType: row.media_type,
  fileName: row.file_name ?? null,
  createdAt: row.created_at,
});

/** A time of day, in the coach's own local time - hours 0-23. */
export type TimeOfDay = { hour: number; minute: number };

/**
 * Every slot a standing weekly pattern would open, for the next `weeks` weeks - a coach who works
 * "Monday to Friday, 9 to 5" sets that once instead of adding one slot at a time. `daysOfWeek` uses
 * JavaScript's own numbering (0 = Sunday .. 6 = Saturday). Slots already on the calendar (same
 * start time) are left out, so running this again after adding a few slots by hand does not
 * duplicate them.
 */
export const generateWeeklySlots = (
  daysOfWeek: number[],
  start: TimeOfDay,
  end: TimeOfDay,
  slotMinutes: number,
  weeks: number,
  existing: CoachSlot[],
  now: Date = new Date()
): Array<{ startsAt: string; endsAt: string }> => {
  const days = new Set(daysOfWeek);
  const existingStarts = new Set(existing.map((slot) => slot.startsAt));
  const dayStartMinutes = start.hour * 60 + start.minute;
  const dayEndMinutes = end.hour * 60 + end.minute;
  const slots: Array<{ startsAt: string; endsAt: string }> = [];

  for (let dayOffset = 0; dayOffset < weeks * 7; dayOffset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    if (!days.has(day.getDay())) continue;
    for (let minutes = dayStartMinutes; minutes + slotMinutes <= dayEndMinutes; minutes += slotMinutes) {
      const startsAt = new Date(day);
      startsAt.setHours(0, minutes, 0, 0);
      if (startsAt <= now) continue;
      const endsAt = new Date(startsAt.getTime() + slotMinutes * 60_000);
      const startIso = startsAt.toISOString();
      if (existingStarts.has(startIso)) continue;
      slots.push({ startsAt: startIso, endsAt: endsAt.toISOString() });
    }
  }
  return slots;
};

export const COACH_GROUP_POST_COLUMNS = "id, group_id, coach_id, caption, media_path, media_type, file_name, created_at";
