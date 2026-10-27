import { BOOKING_NOTE_LIMIT, composeBookingNote, emptyBookingNote } from "../bookingNote";

describe("booking note", () => {
  it("is empty when nothing was picked or written", () => {
    expect(composeBookingNote(emptyBookingNote())).toBe("");
  });

  it("puts focus areas, goals and good-to-know on their own lines", () => {
    expect(
      composeBookingNote({ focus: ["Safety", "Long potting"], goals: "  I keep missing long reds ", info: "Bad shoulder" })
    ).toBe("Work on: Safety, Long potting\nI keep missing long reds\nGood to know: Bad shoulder");
  });

  it("leaves out what was left blank", () => {
    expect(composeBookingNote({ focus: [], goals: "", info: "First session with a coach" })).toBe("Good to know: First session with a coach");
  });

  it("stays within the database's limit, keeping the focus areas", () => {
    const note = composeBookingNote({ focus: ["Cue action"], goals: "x".repeat(400), info: "y".repeat(100) });
    expect(note.length).toBeLessThanOrEqual(BOOKING_NOTE_LIMIT);
    expect(note.startsWith("Work on: Cue action")).toBe(true);
    expect(note.endsWith("…")).toBe(true);
  });
});
