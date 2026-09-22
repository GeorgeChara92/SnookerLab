export const getAuthEmailActionErrorMessage = (error: any) => {
  const raw = typeof error?.message === "string" ? error.message : "";
  const msg = raw.toLowerCase();

  // The hourly cap on emails from the whole app, not just this person.
  if (msg.includes("email rate limit")) {
    return "We have sent a lot of emails in the last hour. Try again a little later, and check your inbox and spam for one we already sent.";
  }
  // Asking again for the same email within a minute.
  if (msg.includes("security purposes") || msg.includes("seconds")) {
    return "An email is already on its way. Give it a minute before asking for another.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many requests in a short time. Wait a few minutes, then try again.";
  }

  if (msg.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  if (msg.includes("not found") || msg.includes("no user")) {
    return "We could not find an account with that email address.";
  }

  return "Something went wrong at our end. Have another go in a moment.";
};

/** What went wrong signing in or signing up, in words a player can act on. */
export const getAuthErrorMessage = (error: any, action: "sign-in" | "sign-up") => {
  const raw = typeof error?.message === "string" ? error.message : "";
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "That email and password do not match an account. Check them and try again.";
  }
  if (/confirm|verif/.test(msg)) {
    return "Confirm your email address first: open the link we sent you, then sign in.";
  }
  if (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already exists")
  ) {
    return "There is already an account with that email. Sign in instead, or reset your password.";
  }
  if (msg.includes("password") && (msg.includes("at least") || msg.includes("weak") || msg.includes("short"))) {
    return "Choose a longer password: at least 6 characters.";
  }
  if (msg.includes("email rate limit")) {
    return "We have sent a lot of emails in the last hour, so we cannot send your confirmation right now. Try again a little later.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts in a short time. Wait a few minutes, then try again.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timed out") || msg.includes("offline")) {
    return "Could not reach Snookered. Check your connection and try again.";
  }
  if (msg.includes("invalid email") || (msg.includes("email address") && msg.includes("invalid"))) {
    return "That email address does not look right. Check it and try again.";
  }
  return action === "sign-in"
    ? "Could not sign you in. Try again in a moment."
    : "Could not create your account. Try again in a moment.";
};
