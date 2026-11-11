/**
 * Adds an email to the launch list (see supabase/migrations/20261111_0001_launch_list.sql).
 *
 * The site already publishes the app's public Supabase settings in /auth-config.js for the email
 * confirmation pages, so this reads them from there rather than keeping a second copy. They are
 * public by design: the database function, not the key, decides what the call can do - and all it
 * can do is add one email.
 */

type PublicConfig = { url: string; anonKey: string };

declare global {
  interface Window {
    SNOOKER_LAB_AUTH?: PublicConfig;
  }
}

let loading: Promise<PublicConfig> | null = null;

const publicConfig = (): Promise<PublicConfig> => {
  if (window.SNOOKER_LAB_AUTH) return Promise.resolve(window.SNOOKER_LAB_AUTH);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/auth-config.js";
    script.async = true;
    script.onload = () => (window.SNOOKER_LAB_AUTH ? resolve(window.SNOOKER_LAB_AUTH) : reject(new Error("config")));
    script.onerror = () => reject(new Error("config"));
    document.head.appendChild(script);
  }).catch((error) => {
    loading = null;
    throw error;
  }) as Promise<PublicConfig>;
  return loading;
};

export type Platform = "iphone" | "android";

export const looksLikeEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value.trim());

/** Resolves when the email is on the list; rejects with a message to show the person if not. */
export async function joinLaunchList(email: string, platform: Platform | null, source: string): Promise<void> {
  let config: PublicConfig;
  try {
    config = await publicConfig();
  } catch {
    throw new Error("We couldn't reach the sign-up just now. Check your connection and try again.");
  }

  let response: Response;
  try {
    response = await fetch(`${config.url}/rest/v1/rpc/join_launch_list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify({ p_email: email.trim(), p_platform: platform, p_source: source }),
    });
  } catch {
    throw new Error("We couldn't reach the sign-up just now. Check your connection and try again.");
  }

  if (response.ok) return;
  const detail = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
  // The database's own messages for a bad email or a burst of sign-ups are written to be shown.
  if (detail?.code === "22023" || detail?.code === "53400") throw new Error(detail.message ?? "Please try again.");
  throw new Error("Something went wrong on our side. Please try again in a moment.");
}
