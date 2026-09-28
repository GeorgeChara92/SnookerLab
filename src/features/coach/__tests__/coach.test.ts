import {
  clientsOf,
  coachStats,
  distanceKm,
  generateWeeklySlots,
  isSessionLive,
  openSlots,
  type CoachBooking,
  type CoachSlot,
} from "../types";

const slot = (id: string, hoursFromNow: number): CoachSlot => {
  const start = new Date(NOW.getTime() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  return { id, coachId: "coach-1", startsAt: start.toISOString(), endsAt: end.toISOString() };
};

const booking = (
  availabilityId: string,
  status: CoachBooking["status"],
  overrides: Partial<Pick<CoachBooking, "playerId" | "guestName" | "startsAt">> = {}
): CoachBooking => ({
  id: `booking-${availabilityId}-${status}-${overrides.playerId ?? "player-1"}-${overrides.startsAt ?? ""}`,
  coachId: "coach-1",
  playerId: overrides.guestName ? null : overrides.playerId ?? "player-1",
  guestName: overrides.guestName ?? null,
  availabilityId,
  startsAt: overrides.startsAt ?? new Date().toISOString(),
  endsAt: new Date().toISOString(),
  status,
  note: null,
  rescheduleReason: null,
  awaitingResponseFrom: status === "pending" ? "coach" : null,
  createdAt: new Date().toISOString(),
});

const NOW = new Date("2026-09-29T12:00:00Z");

describe("a coach's open slots", () => {
  it("includes a future slot with no booking against it", () => {
    const slots = [slot("a", 2)];
    expect(openSlots(slots, [], NOW).map((item) => item.id)).toEqual(["a"]);
  });

  it("excludes a slot that already has a pending or accepted booking", () => {
    const slots = [slot("a", 2), slot("b", 3)];
    const bookings = [booking("a", "pending")];
    expect(openSlots(slots, bookings, NOW).map((item) => item.id)).toEqual(["b"]);
  });

  it("keeps a slot free again once its booking was declined or cancelled", () => {
    const slots = [slot("a", 2)];
    expect(openSlots(slots, [booking("a", "declined")], NOW).map((item) => item.id)).toEqual(["a"]);
    expect(openSlots(slots, [booking("a", "cancelled")], NOW).map((item) => item.id)).toEqual(["a"]);
  });

  it("excludes a slot that has already started", () => {
    const slots = [slot("a", -1)];
    expect(openSlots(slots, [], NOW)).toEqual([]);
  });
});

describe("a coach's clients", () => {
  it("groups bookings by player, counting sessions and keeping the latest date", () => {
    const bookings = [
      booking("a", "accepted", { playerId: "alex", startsAt: "2026-09-01T10:00:00Z" }),
      booking("b", "accepted", { playerId: "alex", startsAt: "2026-09-15T10:00:00Z" }),
      booking("c", "pending", { playerId: "sam", startsAt: "2026-09-10T10:00:00Z" }),
    ];
    const clients = clientsOf(bookings);
    expect(clients).toEqual([
      { key: "alex", playerId: "alex", guestName: null, sessions: 2, lastAt: "2026-09-15T10:00:00Z" },
      { key: "sam", playerId: "sam", guestName: null, sessions: 1, lastAt: "2026-09-10T10:00:00Z" },
    ]);
  });

  it("groups a guest with no account by name instead, across repeat visits", () => {
    const bookings = [
      booking("a", "accepted", { guestName: "Jordan Lee", startsAt: "2026-09-01T10:00:00Z" }),
      booking("b", "accepted", { guestName: "Jordan Lee", startsAt: "2026-09-15T10:00:00Z" }),
    ];
    const clients = clientsOf(bookings);
    expect(clients).toEqual([{ key: "guest:jordan lee", playerId: null, guestName: "Jordan Lee", sessions: 2, lastAt: "2026-09-15T10:00:00Z" }]);
  });

  it("does not count a declined or cancelled request as a session", () => {
    const bookings = [
      booking("a", "declined", { playerId: "alex" }),
      booking("b", "cancelled", { playerId: "alex" }),
    ];
    expect(clientsOf(bookings)).toEqual([]);
  });

  it("orders clients by most recently active first", () => {
    const bookings = [
      booking("a", "accepted", { playerId: "old", startsAt: "2026-01-01T10:00:00Z" }),
      booking("b", "accepted", { playerId: "new", startsAt: "2026-09-01T10:00:00Z" }),
    ];
    expect(clientsOf(bookings).map((client) => client.playerId)).toEqual(["new", "old"]);
  });
});

describe("distance between two coordinates", () => {
  it("is zero for the same point", () => {
    expect(distanceKm({ lat: 53.4808, lng: -2.2426 }, { lat: 53.4808, lng: -2.2426 })).toBeCloseTo(0, 5);
  });

  it("matches the known distance between Manchester and London, to the nearest 5km", () => {
    const manchester = { lat: 53.4808, lng: -2.2426 };
    const london = { lat: 51.5074, lng: -0.1278 };
    expect(distanceKm(manchester, london)).toBeGreaterThan(255);
    expect(distanceKm(manchester, london)).toBeLessThan(265);
  });
});

describe("a coach's dashboard stats", () => {
  it("counts only accepted sessions this month and today", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const bookings = [
      booking("a", "accepted", { playerId: "alex", startsAt: "2026-09-29T09:00:00Z" }), // today, this month
      booking("b", "accepted", { playerId: "sam", startsAt: "2026-09-10T09:00:00Z" }), // this month
      booking("c", "pending", { playerId: "sam", startsAt: "2026-09-29T09:00:00Z" }), // today, but not accepted
      booking("d", "accepted", { playerId: "sam", startsAt: "2026-08-15T09:00:00Z" }), // last month
    ];
    const stats = coachStats(bookings, now);
    expect(stats.sessionsToday).toBe(1);
    expect(stats.sessionsThisMonth).toBe(2);
  });

  it("finds the client with the most sessions", () => {
    const bookings = [
      booking("a", "accepted", { playerId: "alex", startsAt: "2026-09-01T09:00:00Z" }),
      booking("b", "accepted", { playerId: "alex", startsAt: "2026-09-10T09:00:00Z" }),
      booking("c", "accepted", { playerId: "sam", startsAt: "2026-09-15T09:00:00Z" }),
    ];
    expect(coachStats(bookings).topClient?.playerId).toBe("alex");
  });

  it("has no top client when there are no bookings", () => {
    expect(coachStats([]).topClient).toBeNull();
  });
});

describe("generating a weekly availability pattern", () => {
  const monday9am = (hour = 8) => new Date(2026, 8, 28, hour, 0, 0, 0); // Monday 28 Sep 2026, local time

  it("creates a slot for every duration-sized chunk of the window, on the chosen days", () => {
    const now = monday9am(8);
    const slots = generateWeeklySlots([1, 3], { hour: 9, minute: 0 }, { hour: 11, minute: 0 }, 60, 1, [], now);
    expect(slots).toHaveLength(4); // Monday x2 + Wednesday x2
    expect(new Date(slots[0].startsAt).getHours()).toBe(9);
    expect(new Date(slots[0].endsAt).getHours()).toBe(10);
    expect(new Date(slots[1].startsAt).getHours()).toBe(10);
  });

  it("skips a day not in the chosen set", () => {
    const now = monday9am(8);
    const slots = generateWeeklySlots([2], { hour: 9, minute: 0 }, { hour: 10, minute: 0 }, 60, 1, [], now);
    expect(slots.every((slot) => new Date(slot.startsAt).getDay() === 2)).toBe(true);
  });

  it("skips a time on today that has already passed", () => {
    const now = monday9am(10); // 10am Monday - the 9am slot on Monday has already gone
    const slots = generateWeeklySlots([1], { hour: 9, minute: 0 }, { hour: 11, minute: 0 }, 60, 1, [], now);
    expect(slots.some((slot) => new Date(slot.startsAt).getDate() === now.getDate() && new Date(slot.startsAt).getHours() === 9)).toBe(false);
  });

  it("does not duplicate a slot that is already on the calendar", () => {
    const now = monday9am(8);
    const already: CoachSlot = {
      id: "x",
      coachId: "coach-1",
      startsAt: new Date(2026, 8, 28, 9, 0, 0, 0).toISOString(),
      endsAt: new Date(2026, 8, 28, 10, 0, 0, 0).toISOString(),
    };
    const slots = generateWeeklySlots([1], { hour: 9, minute: 0 }, { hour: 10, minute: 0 }, 60, 1, [already], now);
    expect(slots).toHaveLength(0);
  });
});

describe("whether a session is currently live", () => {
  const session = { startsAt: "2026-09-29T18:00:00Z", endsAt: "2026-09-29T19:00:00Z" };

  it("is true inside the session's time window", () => {
    expect(isSessionLive(session, new Date("2026-09-29T18:30:00Z"))).toBe(true);
  });

  it("is false before it starts or after it ends", () => {
    expect(isSessionLive(session, new Date("2026-09-29T17:59:00Z"))).toBe(false);
    expect(isSessionLive(session, new Date("2026-09-29T19:01:00Z"))).toBe(false);
  });
});
