/**
 * When the account was made. Supabase sends up to nine decimal places on the seconds, which the
 * app's JavaScript engine does not always read, so they are cut to three first. A date that
 * still cannot be read counts as new: better to show the tour once too often than never.
 */
export const accountAge = (createdAt: string | undefined, now = Date.now()) => {
  const time = Date.parse(String(createdAt ?? "").replace(/(\.\d{3})\d+/, "$1"));
  return Number.isFinite(time) ? now - time : 0;
};
