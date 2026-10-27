/** The database keeps a booking's note to 300 characters. */
export const BOOKING_NOTE_LIMIT = 300;

export type BookingNoteDraft = { focus: string[]; goals: string; info: string };
export const emptyBookingNote = (): BookingNoteDraft => ({ focus: [], goals: "", info: "" });

/**
 * The note a coach gets with a request, from what the player picked and wrote: what they want to
 * work on, then anything the coach should know beforehand. One line each, so it reads well on the
 * coach's Agenda card. Kept within the limit, cutting the free text rather than the focus areas.
 */
export const composeBookingNote = ({ focus, goals, info }: BookingNoteDraft) => {
  const lines = [
    focus.length ? `Work on: ${focus.join(", ")}` : "",
    goals.trim(),
    info.trim() ? `Good to know: ${info.trim()}` : "",
  ].filter(Boolean);
  const note = lines.join("\n");
  return note.length > BOOKING_NOTE_LIMIT ? `${note.slice(0, BOOKING_NOTE_LIMIT - 1).trimEnd()}…` : note;
};
