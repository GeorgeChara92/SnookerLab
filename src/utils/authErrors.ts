export const getAuthEmailActionErrorMessage = (error: any) => {
  const raw = typeof error?.message === "string" ? error.message : "";
  const msg = raw.toLowerCase();

  if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("email rate limit")) {
    return "Too many email requests were sent recently. Please wait a minute and try again.";
  }

  if (msg.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  return raw || "Please try again in a moment.";
};
