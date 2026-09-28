import { create } from "zustand";
import { supabase } from "../api/supabase";
import {
  BOOKING_COLUMNS,
  COACH_GROUP_COLUMNS,
  SESSION_ROUTINE_COLUMNS,
  SLOT_COLUMNS,
  bookingFromRow,
  coachGroupFromRow,
  sessionRoutineFromRow,
  slotFromRow,
  type BookingStatus,
  type CoachBooking,
  type CoachGroup,
  type CoachSlot,
  type SessionRoutineEntry,
} from "../features/coach/types";
import { PROFILE_COLUMNS, profileFromRow, nameOf, type PublicProfile } from "../features/community/types";
import { useCommunityStore } from "./communityStore";
import { cancelSessionReminder, notifyBookingUpdate, scheduleSessionReminder } from "../features/coach/sessionReminders";
import { listMemberCoachGroups } from "../features/coach/groups";

type BookingTransitionKind = "accepted" | "declined" | "cancelled" | "needs_response";

/** What changed between the last known copy of these bookings and the fresh one, per booking -
 * how a device notices "something happened" without knowing who made it happen or when. Reschedule
 * is no longer instant: it moves an accepted booking back to "pending" with a new
 * awaitingResponseFrom, which is what "needs_response" below catches. */
const diffBookingTransitions = (
  oldBookings: CoachBooking[],
  newBookings: CoachBooking[]
): Array<{ booking: CoachBooking; kind: BookingTransitionKind }> => {
  const oldById = new Map(oldBookings.map((booking) => [booking.id, booking]));
  const transitions: Array<{ booking: CoachBooking; kind: BookingTransitionKind }> = [];
  for (const booking of newBookings) {
    const before = oldById.get(booking.id);
    if (!before) continue;
    if (before.status === "pending" && booking.status === "accepted") {
      transitions.push({ booking, kind: "accepted" });
    } else if (before.status === "pending" && booking.status === "declined") {
      transitions.push({ booking, kind: "declined" });
    } else if (before.status === "accepted" && booking.status === "cancelled") {
      transitions.push({ booking, kind: "cancelled" });
    } else if (before.status === "accepted" && booking.status === "pending" && booking.awaitingResponseFrom) {
      transitions.push({ booking, kind: "needs_response" });
    }
  }
  return transitions;
};

const formatSessionDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * A coach's own availability and bookings, and the bookings a player has made with a coach. Kept
 * separate from communityStore (which only knows `is_coach` on a profile) because this is about
 * scheduling, not the social graph.
 */

type Result = { ok: true } | { ok: false; message: string };

type CoachState = {
  ownerId: string | null;
  loaded: boolean;
  /** This account's own open slots, when it is a coach. */
  mySlots: CoachSlot[];
  /** Bookings where this account is the coach being booked. */
  bookingsAsCoach: CoachBooking[];
  /** Bookings where this account is the player who asked for a session. */
  bookingsAsPlayer: CoachBooking[];
  /** This coach's own broadcast groups - loaded alongside everything else so the Groups tab never
   * has to fetch cold when a coach taps into it. */
  myCoachGroups: CoachGroup[];
  /** Groups this account has been added to as a player, by any coach - same reasoning as above,
   * for the "Coach groups" section on the player's Coaching tab. */
  memberCoachGroups: CoachGroup[];
  /** This coach's own private notes on a session, keyed by booking id - never visible to the player. */
  sessionNotes: Record<string, string>;
  /** Routines covered in a session, keyed by booking id - same privacy as sessionNotes. */
  sessionRoutines: Record<string, SessionRoutineEntry[]>;
  /** A request awaiting a response always shows in its own list (pending, filtered by
   * awaitingResponseFrom), so it needs no separate unseen count. These two only cover the one-off,
   * nothing-left-to-show events - a request being accepted or declined - for the nav bar's badge. */
  unseenPlayerResolutions: number;
  unseenCoachResolutions: number;
  markPlayerResolutionsSeen: () => void;
  markCoachResolutionsSeen: () => void;
  setOwner: (userId: string | null) => void;
  hydrate: (userId: string) => Promise<void>;
  /** Re-reads just this coach's own groups - after creating or deleting one, rather than a full
   * hydrate for a change that small. */
  refreshMyCoachGroups: () => Promise<void>;
  /** Re-reads just the coach groups this account belongs to as a player. */
  refreshMemberCoachGroups: () => Promise<void>;
  addSlot: (startsAt: string, endsAt: string) => Promise<Result>;
  removeSlot: (slotId: string) => Promise<Result>;
  /** Adds several slots at once, from a weekly pattern (see generateWeeklySlots). */
  addRecurringSlots: (slots: Array<{ startsAt: string; endsAt: string }>) => Promise<Result>;
  /** A coach's open slots and their bookings, for a player deciding what to request. */
  loadCoachSchedule: (coachId: string) => Promise<{ slots: CoachSlot[]; bookings: CoachBooking[] }>;
  /** Coaches whose name or coaching location matches, for a player browsing to find one. */
  searchCoaches: (query: string) => Promise<PublicProfile[]>;
  requestBooking: (coachId: string, slot: CoachSlot, note: string) => Promise<Result>;
  /** A coach booking their own diary directly, the way a request/response never needs to for a
   * walk-in or phone booking: either an existing client's playerId (still needs their confirmation,
   * same as any coach-proposed time) or a guestName for someone with no Snookered account at all
   * (confirmed immediately - there is no one else to ask). */
  createManualBooking: (slot: CoachSlot, client: { playerId: string } | { guestName: string }, note: string) => Promise<Result>;
  respondToBooking: (bookingId: string, status: Extract<BookingStatus, "accepted" | "declined">) => Promise<Result>;
  cancelBooking: (bookingId: string) => Promise<Result>;
  /** Permanently removes a resolved booking (declined, cancelled, or an accepted session that has
   * already ended) from the record - never one still pending or still to come. */
  deleteBooking: (bookingId: string) => Promise<Result>;
  /** The same, but every resolved booking a coach has ever had with one player at once - a live or
   * upcoming confirmed session with them, if there is one, is left alone. */
  deleteClientHistory: (playerId: string) => Promise<Result>;
  /** The same for a guest client, keyed by name since there is no account to key them by. */
  deleteGuestHistory: (guestName: string) => Promise<Result>;
  /** Moves an existing booking to a different open slot of the same coach - either side can call
   * this, since sometimes it's the coach's plans that change and sometimes the player's. */
  rescheduleBooking: (bookingId: string, slot: CoachSlot, reason?: string) => Promise<Result>;
  saveSessionNotes: (bookingId: string, notes: string) => Promise<Result>;
  addSessionRoutine: (
    bookingId: string,
    routineId: string,
    routineName: string,
    score: number | null,
    notes: string
  ) => Promise<Result>;
  removeSessionRoutine: (id: string, bookingId: string) => Promise<Result>;
  updateSessionRoutine: (id: string, bookingId: string, score: number | null, notes: string) => Promise<Result>;
};

const explain = (error: { code?: string; message?: string } | null): string => {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "23505") return "That slot has just been booked by someone else.";
  if (error.code === "42501" || error.message?.includes("row-level security")) return "That is not allowed.";
  return "Check your connection and try again.";
};

export const useCoachStore = create<CoachState>()((set, get) => ({
  ownerId: null,
  loaded: false,
  mySlots: [],
  bookingsAsCoach: [],
  bookingsAsPlayer: [],
  myCoachGroups: [],
  memberCoachGroups: [],
  sessionNotes: {},
  sessionRoutines: {},
  unseenPlayerResolutions: 0,
  unseenCoachResolutions: 0,
  markPlayerResolutionsSeen: () => set({ unseenPlayerResolutions: 0 }),
  markCoachResolutionsSeen: () => set({ unseenCoachResolutions: 0 }),

  setOwner: (userId) => {
    if (get().ownerId === userId) return;
    set({
      ownerId: userId,
      loaded: false,
      mySlots: [],
      bookingsAsCoach: [],
      bookingsAsPlayer: [],
      myCoachGroups: [],
      memberCoachGroups: [],
      sessionNotes: {},
      sessionRoutines: {},
      unseenPlayerResolutions: 0,
      unseenCoachResolutions: 0,
    });
  },

  refreshMyCoachGroups: async () => {
    const ownerId = get().ownerId;
    if (!ownerId) return;
    const { data, error } = await supabase
      .from("coach_groups")
      .select(COACH_GROUP_COLUMNS)
      .eq("coach_id", ownerId)
      .order("created_at", { ascending: false });
    if (error || get().ownerId !== ownerId) return;
    set({ myCoachGroups: (data ?? []).map(coachGroupFromRow) });
  },

  refreshMemberCoachGroups: async () => {
    const ownerId = get().ownerId;
    if (!ownerId) return;
    const groups = await listMemberCoachGroups(ownerId);
    if (get().ownerId !== ownerId) return;
    set({ memberCoachGroups: groups });
  },

  hydrate: async (userId) => {
    const wasLoaded = get().loaded;
    const oldBookingsAsCoach = get().bookingsAsCoach;
    const oldBookingsAsPlayer = get().bookingsAsPlayer;
    const [slotsResult, coachBookingsResult, playerBookingsResult, notesResult, routinesResult, groupsResult, memberGroups] =
      await Promise.all([
        supabase.from("coach_availability").select(SLOT_COLUMNS).eq("coach_id", userId).order("starts_at"),
        supabase.from("coach_bookings").select(BOOKING_COLUMNS).eq("coach_id", userId).order("starts_at"),
        supabase.from("coach_bookings").select(BOOKING_COLUMNS).eq("player_id", userId).order("starts_at"),
        supabase.from("coach_session_notes").select("booking_id, notes").eq("coach_id", userId),
        supabase.from("coach_session_routines").select(SESSION_ROUTINE_COLUMNS).eq("coach_id", userId).order("created_at"),
        supabase.from("coach_groups").select(COACH_GROUP_COLUMNS).eq("coach_id", userId).order("created_at", { ascending: false }),
        listMemberCoachGroups(userId),
      ]);
    if (get().ownerId !== userId) return;
    if (slotsResult.error || coachBookingsResult.error || playerBookingsResult.error) {
      console.warn(
        "Could not load coach mode:",
        (slotsResult.error ?? coachBookingsResult.error ?? playerBookingsResult.error)?.message
      );
      return;
    }
    const bookingsAsCoach = (coachBookingsResult.data ?? []).map(bookingFromRow);
    const bookingsAsPlayer = (playerBookingsResult.data ?? []).map(bookingFromRow);
    const sessionNotes = Object.fromEntries((notesResult.data ?? []).map((row) => [row.booking_id, row.notes as string]));
    const sessionRoutines: Record<string, SessionRoutineEntry[]> = {};
    (routinesResult.data ?? []).map(sessionRoutineFromRow).forEach((entry) => {
      (sessionRoutines[entry.bookingId] ??= []).push(entry);
    });

    // A slot nobody booked before its own start time is just clutter from here on - it can never
    // be booked (openSlots already hides it from players) and only makes the coach's own calendar
    // noisier. Drop it from view now and clean it up server-side in the background.
    const allSlots = (slotsResult.data ?? []).map(slotFromRow);
    const activeAvailabilityIds = new Set(
      bookingsAsCoach.filter((b) => b.status === "pending" || b.status === "accepted").map((b) => b.availabilityId)
    );
    const now = new Date();
    const expiredSlotIds = allSlots
      .filter((slot) => new Date(slot.startsAt) <= now && !activeAvailabilityIds.has(slot.id))
      .map((slot) => slot.id);
    const mySlots = expiredSlotIds.length ? allSlots.filter((slot) => !expiredSlotIds.includes(slot.id)) : allSlots;

    set({
      mySlots,
      bookingsAsCoach,
      bookingsAsPlayer,
      myCoachGroups: (groupsResult.data ?? []).map(coachGroupFromRow),
      memberCoachGroups: memberGroups,
      sessionNotes,
      sessionRoutines,
      loaded: true,
    });

    if (expiredSlotIds.length) {
      void supabase
        .from("coach_availability")
        .delete()
        .in("id", expiredSlotIds)
        .then(({ error }) => {
          if (error) console.warn("Could not clear expired slots:", error.message);
        });
    }

    // The coach's dashboard shows each booking's other party by name; make sure their profile is
    // in communityStore's cache even if they have never been a friend or chat contact.
    const community = useCommunityStore.getState();
    const realPlayerIds = bookingsAsCoach.map((b) => b.playerId).filter((id): id is string => id !== null);
    const missing = [...new Set([...realPlayerIds, ...bookingsAsPlayer.map((b) => b.coachId)])].filter(
      (id) => !community.profiles[id]
    );
    void Promise.all(missing.map((id) => community.loadProfile(id))).then(() => {
      const latestProfiles = useCommunityStore.getState().profiles;
      const upcomingAsCoach = bookingsAsCoach.filter(
        (booking) => booking.status === "accepted" && new Date(booking.startsAt) > new Date()
      );
      const upcomingAsPlayer = bookingsAsPlayer.filter(
        (booking) => booking.status === "accepted" && new Date(booking.startsAt) > new Date()
      );
      void Promise.all([
        ...upcomingAsCoach.map((booking) =>
          scheduleSessionReminder(booking, booking.guestName ?? nameOf(latestProfiles[booking.playerId ?? ""]))
        ),
        ...upcomingAsPlayer.map((booking) => scheduleSessionReminder(booking, nameOf(latestProfiles[booking.coachId]))),
      ]);

      // Tell this device about anything that changed since the last time it looked - the coach
      // accepting or declining a request, either side cancelling, or a session moving to a new
      // time. Skipped on the very first hydrate (nothing to compare against yet).
      if (!wasLoaded) return;
      const playerNotices = diffBookingTransitions(oldBookingsAsPlayer, bookingsAsPlayer);
      const coachNotices = diffBookingTransitions(oldBookingsAsCoach, bookingsAsCoach);
      const withReason = (message: string, reason: string | null) => (reason ? `${message} "${reason}"` : message);
      // A pending request already shows in its own list until it's answered, so only accepted and
      // declined - which leave nothing on screen to badge from - bump the nav bar's unseen count.
      const resolvedCount = (notices: Array<{ kind: BookingTransitionKind }>) =>
        notices.filter(({ kind }) => kind === "accepted" || kind === "declined").length;
      if (resolvedCount(playerNotices) > 0) {
        set((state) => ({ unseenPlayerResolutions: state.unseenPlayerResolutions + resolvedCount(playerNotices) }));
      }
      if (resolvedCount(coachNotices) > 0) {
        set((state) => ({ unseenCoachResolutions: state.unseenCoachResolutions + resolvedCount(coachNotices) }));
      }
      playerNotices.forEach(({ booking, kind }) => {
        const coachName = nameOf(latestProfiles[booking.coachId]);
        if (kind === "accepted") {
          void notifyBookingUpdate("Session confirmed", `${coachName} confirmed your session for ${formatSessionDateTime(booking.startsAt)}.`);
        } else if (kind === "declined") {
          void notifyBookingUpdate("Request declined", `${coachName} can't make ${formatSessionDateTime(booking.startsAt)}.`);
        } else if (kind === "cancelled") {
          void notifyBookingUpdate("Session cancelled", `${coachName} cancelled your session on ${formatSessionDateTime(booking.startsAt)}.`);
        } else if (kind === "needs_response" && booking.awaitingResponseFrom === "player") {
          void notifyBookingUpdate(
            "New time proposed",
            withReason(`${coachName} wants to move your session to ${formatSessionDateTime(booking.startsAt)}. Review it.`, booking.rescheduleReason)
          );
        }
      });
      coachNotices.forEach(({ booking, kind }) => {
        const playerName = booking.guestName ?? nameOf(latestProfiles[booking.playerId ?? ""]);
        if (kind === "accepted") {
          void notifyBookingUpdate("Time confirmed", `${playerName} confirmed the new time: ${formatSessionDateTime(booking.startsAt)}.`);
        } else if (kind === "declined") {
          void notifyBookingUpdate("New time declined", `${playerName} declined the time you proposed.`);
        } else if (kind === "cancelled") {
          void notifyBookingUpdate("Session cancelled", `${playerName} cancelled their session on ${formatSessionDateTime(booking.startsAt)}.`);
        } else if (kind === "needs_response" && booking.awaitingResponseFrom === "coach") {
          void notifyBookingUpdate(
            "Reschedule requested",
            withReason(`${playerName} asked to move their session to ${formatSessionDateTime(booking.startsAt)}.`, booking.rescheduleReason)
          );
        }
      });
    });
  },

  addSlot: async (startsAt, endsAt) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { ok: false, message: "You need to be signed in." };
    const { data, error } = await supabase
      .from("coach_availability")
      .insert({ coach_id: ownerId, starts_at: startsAt, ends_at: endsAt })
      .select(SLOT_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    set((state) => ({ mySlots: [...state.mySlots, slotFromRow(data)].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }));
    return { ok: true };
  },

  removeSlot: async (slotId) => {
    const { error } = await supabase.from("coach_availability").delete().eq("id", slotId);
    if (error) return { ok: false, message: explain(error) };
    set((state) => ({ mySlots: state.mySlots.filter((slot) => slot.id !== slotId) }));
    return { ok: true };
  },

  addRecurringSlots: async (slots) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { ok: false, message: "You need to be signed in." };
    if (!slots.length) return { ok: true };
    const { data, error } = await supabase
      .from("coach_availability")
      .insert(slots.map((slot) => ({ coach_id: ownerId, starts_at: slot.startsAt, ends_at: slot.endsAt })))
      .select(SLOT_COLUMNS);
    if (error) return { ok: false, message: explain(error) };
    set((state) => ({
      mySlots: [...state.mySlots, ...(data ?? []).map(slotFromRow)].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }));
    return { ok: true };
  },

  loadCoachSchedule: async (coachId) => {
    const [slotsResult, bookingsResult] = await Promise.all([
      supabase
        .from("coach_availability")
        .select(SLOT_COLUMNS)
        .eq("coach_id", coachId)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at"),
      supabase.from("coach_bookings").select(BOOKING_COLUMNS).eq("coach_id", coachId),
    ]);
    return {
      slots: (slotsResult.data ?? []).map(slotFromRow),
      bookings: (bookingsResult.data ?? []).map(bookingFromRow),
    };
  },

  searchCoaches: async (query) => {
    const text = query.trim().replace(/^@/, "").replace(/[%_,()]/g, "");
    let request = supabase.from("profiles").select(PROFILE_COLUMNS).eq("is_coach", true).limit(50);
    if (text.length >= 2) {
      request = request.or(
        `handle.ilike.%${text}%,display_name.ilike.%${text}%,coach_location.ilike.%${text}%`
      );
    } else {
      request = request.order("handle");
    }
    const { data, error } = await request;
    if (error || !data) return [];
    return data.map(profileFromRow);
  },

  requestBooking: async (coachId, slot, note) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { ok: false, message: "You need to be signed in." };
    const { data, error } = await supabase
      .from("coach_bookings")
      .insert({
        coach_id: coachId,
        player_id: ownerId,
        availability_id: slot.id,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        note: note.trim() || null,
        awaiting_response_from: "coach",
      })
      .select(BOOKING_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    set((state) => ({ bookingsAsPlayer: [...state.bookingsAsPlayer, bookingFromRow(data)] }));
    return { ok: true };
  },

  createManualBooking: async (slot, client, note) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { ok: false, message: "You need to be signed in." };
    const isGuest = "guestName" in client;
    const { data, error } = await supabase
      .from("coach_bookings")
      .insert({
        coach_id: ownerId,
        player_id: isGuest ? null : client.playerId,
        guest_name: isGuest ? client.guestName.trim().slice(0, 80) : null,
        availability_id: slot.id,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        note: note.trim() || null,
        // A guest has no account to confirm with, so the booking is simply theirs from the moment
        // it's written - an existing client still gets to agree to the time, same as a reschedule.
        status: isGuest ? "accepted" : "pending",
        awaiting_response_from: isGuest ? null : "player",
      })
      .select(BOOKING_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    const created = bookingFromRow(data);
    set((state) => ({ bookingsAsCoach: [...state.bookingsAsCoach, created] }));
    if (created.status === "accepted") void scheduleSessionReminder(created, created.guestName ?? "your client");
    return { ok: true };
  },

  respondToBooking: async (bookingId, status) => {
    const ownerId = get().ownerId;
    const { data, error } = await supabase
      .from("coach_bookings")
      .update({ status, awaiting_response_from: null })
      .eq("id", bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    const updated = bookingFromRow(data);
    set((state) => ({
      bookingsAsCoach: state.bookingsAsCoach.map((booking) => (booking.id === bookingId ? updated : booking)),
      bookingsAsPlayer: state.bookingsAsPlayer.map((booking) => (booking.id === bookingId ? updated : booking)),
    }));
    if (updated.status === "accepted") {
      const otherPartyName =
        ownerId === updated.coachId
          ? updated.guestName ?? nameOf(useCommunityStore.getState().profiles[updated.playerId ?? ""])
          : nameOf(useCommunityStore.getState().profiles[updated.coachId]);
      void scheduleSessionReminder(updated, otherPartyName);
    } else {
      void cancelSessionReminder(bookingId);
    }
    return { ok: true };
  },

  cancelBooking: async (bookingId) => {
    const { data, error } = await supabase
      .from("coach_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    const updated = bookingFromRow(data);
    set((state) => ({
      bookingsAsCoach: state.bookingsAsCoach.map((booking) => (booking.id === bookingId ? updated : booking)),
      bookingsAsPlayer: state.bookingsAsPlayer.map((booking) => (booking.id === bookingId ? updated : booking)),
    }));
    void cancelSessionReminder(bookingId);
    return { ok: true };
  },

  deleteBooking: async (bookingId) => {
    const { error } = await supabase.from("coach_bookings").delete().eq("id", bookingId);
    if (error) return { ok: false, message: explain(error) };
    set((state) => {
      const { [bookingId]: _removedNotes, ...sessionNotes } = state.sessionNotes;
      const { [bookingId]: _removedRoutines, ...sessionRoutines } = state.sessionRoutines;
      return {
        bookingsAsCoach: state.bookingsAsCoach.filter((booking) => booking.id !== bookingId),
        bookingsAsPlayer: state.bookingsAsPlayer.filter((booking) => booking.id !== bookingId),
        sessionNotes,
        sessionRoutines,
      };
    });
    void cancelSessionReminder(bookingId);
    return { ok: true };
  },

  deleteClientHistory: async (playerId) => {
    const now = new Date();
    const targets = get().bookingsAsCoach.filter(
      (booking) => booking.playerId === playerId && (booking.status !== "accepted" || new Date(booking.endsAt) < now)
    );
    if (!targets.length) return { ok: true };
    const ids = targets.map((booking) => booking.id);
    const { error } = await supabase.from("coach_bookings").delete().in("id", ids);
    if (error) return { ok: false, message: explain(error) };
    const idSet = new Set(ids);
    set((state) => ({
      bookingsAsCoach: state.bookingsAsCoach.filter((booking) => !idSet.has(booking.id)),
      sessionNotes: Object.fromEntries(Object.entries(state.sessionNotes).filter(([id]) => !idSet.has(id))),
      sessionRoutines: Object.fromEntries(Object.entries(state.sessionRoutines).filter(([id]) => !idSet.has(id))),
    }));
    await Promise.all(ids.map((id) => cancelSessionReminder(id)));
    return { ok: true };
  },

  deleteGuestHistory: async (guestName) => {
    const now = new Date();
    const key = guestName.trim().toLowerCase();
    const targets = get().bookingsAsCoach.filter(
      (booking) =>
        (booking.guestName ?? "").trim().toLowerCase() === key && (booking.status !== "accepted" || new Date(booking.endsAt) < now)
    );
    if (!targets.length) return { ok: true };
    const ids = targets.map((booking) => booking.id);
    const { error } = await supabase.from("coach_bookings").delete().in("id", ids);
    if (error) return { ok: false, message: explain(error) };
    const idSet = new Set(ids);
    set((state) => ({
      bookingsAsCoach: state.bookingsAsCoach.filter((booking) => !idSet.has(booking.id)),
      sessionNotes: Object.fromEntries(Object.entries(state.sessionNotes).filter(([id]) => !idSet.has(id))),
      sessionRoutines: Object.fromEntries(Object.entries(state.sessionRoutines).filter(([id]) => !idSet.has(id))),
    }));
    await Promise.all(ids.map((id) => cancelSessionReminder(id)));
    return { ok: true };
  },

  rescheduleBooking: async (bookingId, slot, reason) => {
    const ownerId = get().ownerId;
    const existing = [...get().bookingsAsCoach, ...get().bookingsAsPlayer].find((booking) => booking.id === bookingId);
    if (!existing) return { ok: false, message: "That booking could not be found." };
    // A guest has no account to agree to a new time, so a reschedule just takes effect - same as
    // creating their booking in the first place. Otherwise, whoever is not making this change is
    // the one who has to agree to it.
    const isGuest = !existing.playerId;
    const awaitingResponseFrom: "coach" | "player" | null = isGuest ? null : ownerId === existing.coachId ? "player" : "coach";
    const { data, error } = await supabase
      .from("coach_bookings")
      .update({
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        availability_id: slot.id,
        status: isGuest ? "accepted" : "pending",
        awaiting_response_from: awaitingResponseFrom,
        reschedule_reason: reason?.trim() || null,
      })
      .eq("id", bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    const updated = bookingFromRow(data);
    set((state) => ({
      bookingsAsCoach: state.bookingsAsCoach.map((booking) => (booking.id === bookingId ? updated : booking)),
      bookingsAsPlayer: state.bookingsAsPlayer.map((booking) => (booking.id === bookingId ? updated : booking)),
    }));
    // No longer confirmed until the other side accepts the new time - any reminder for the old time is stale.
    void cancelSessionReminder(bookingId);
    return { ok: true };
  },

  saveSessionNotes: async (bookingId, notes) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { ok: false, message: "You need to be signed in." };
    const trimmed = notes.trim();
    if (!trimmed) {
      const { error } = await supabase.from("coach_session_notes").delete().eq("booking_id", bookingId);
      if (error) return { ok: false, message: explain(error) };
      set((state) => {
        const next = { ...state.sessionNotes };
        delete next[bookingId];
        return { sessionNotes: next };
      });
      return { ok: true };
    }
    const { error } = await supabase
      .from("coach_session_notes")
      .upsert({ booking_id: bookingId, coach_id: ownerId, notes: trimmed, updated_at: new Date().toISOString() });
    if (error) return { ok: false, message: explain(error) };
    set((state) => ({ sessionNotes: { ...state.sessionNotes, [bookingId]: trimmed } }));
    return { ok: true };
  },

  addSessionRoutine: async (bookingId, routineId, routineName, score, notes) => {
    const ownerId = get().ownerId;
    if (!ownerId) return { ok: false, message: "You need to be signed in." };
    const { data, error } = await supabase
      .from("coach_session_routines")
      .insert({
        booking_id: bookingId,
        coach_id: ownerId,
        routine_id: routineId,
        routine_name: routineName,
        score,
        notes: notes.trim() || null,
      })
      .select(SESSION_ROUTINE_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    const entry = sessionRoutineFromRow(data);
    set((state) => ({
      sessionRoutines: { ...state.sessionRoutines, [bookingId]: [...(state.sessionRoutines[bookingId] ?? []), entry] },
    }));
    return { ok: true };
  },

  removeSessionRoutine: async (id, bookingId) => {
    const { error } = await supabase.from("coach_session_routines").delete().eq("id", id);
    if (error) return { ok: false, message: explain(error) };
    set((state) => ({
      sessionRoutines: {
        ...state.sessionRoutines,
        [bookingId]: (state.sessionRoutines[bookingId] ?? []).filter((entry) => entry.id !== id),
      },
    }));
    return { ok: true };
  },

  updateSessionRoutine: async (id, bookingId, score, notes) => {
    const { data, error } = await supabase
      .from("coach_session_routines")
      .update({ score, notes: notes.trim() || null })
      .eq("id", id)
      .select(SESSION_ROUTINE_COLUMNS)
      .single();
    if (error || !data) return { ok: false, message: explain(error) };
    const updated = sessionRoutineFromRow(data);
    set((state) => ({
      sessionRoutines: {
        ...state.sessionRoutines,
        [bookingId]: (state.sessionRoutines[bookingId] ?? []).map((entry) => (entry.id === id ? updated : entry)),
      },
    }));
    return { ok: true };
  },
}));
