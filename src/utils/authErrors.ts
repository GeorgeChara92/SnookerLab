export const getAuthEmailActionErrorMessage = (error: any) => {
  const raw = typeof error?.message === "string" ? error.message : "";
  const msg = raw.toLowerCase();

  if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("email rate limit")) {
    return "Too many email requests were sent recently. Please wait a minute and try again.";
  }

  if (msg.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  if (msg.includes("not found") || msg.includes("no user")) {
    return "We could not find an account with that email address.";
  }

  return "Something went wrong at our end. Have another go in a moment.";
};
