import { accountAge } from "../accountAge";

describe("account age", () => {
  const now = Date.parse("2026-09-22T12:00:00.000Z");

  it("reads Supabase's dates, however many decimal places", () => {
    expect(accountAge("2026-09-22T11:00:00.123456789Z", now)).toBe(3600_000 - 123);
    expect(accountAge("2026-09-22T11:00:00.123456Z", now)).toBe(3600_000 - 123);
    expect(accountAge("2026-09-22T11:00:00Z", now)).toBe(3600_000);
  });

  it("counts an unreadable date as brand new", () => {
    expect(accountAge("not a date", now)).toBe(0);
    expect(accountAge(undefined, now)).toBe(0);
  });
});
