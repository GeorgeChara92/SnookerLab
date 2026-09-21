import { getAuthErrorMessage } from "../authErrors";

describe("auth error messages", () => {
  it("turns Supabase's wording into something a player can act on", () => {
    expect(getAuthErrorMessage({ message: "Invalid login credentials" }, "sign-in")).toMatch(/do not match/);
    expect(getAuthErrorMessage({ message: "Email not confirmed" }, "sign-in")).toMatch(/Confirm your email/);
    expect(getAuthErrorMessage({ message: "User already registered" }, "sign-up")).toMatch(/already an account/);
    expect(getAuthErrorMessage({ message: "Network request failed" }, "sign-in")).toMatch(/connection/);
  });

  it("never shows raw text it does not recognise", () => {
    expect(getAuthErrorMessage({ message: "PGRST301 something odd" }, "sign-up")).toBe(
      "Could not create your account. Try again in a moment."
    );
    expect(getAuthErrorMessage(undefined, "sign-in")).toBe("Could not sign you in. Try again in a moment.");
  });
});
