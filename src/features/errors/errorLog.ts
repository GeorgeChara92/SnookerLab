import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { supabase } from "../../api/supabase";
import { navigationRef } from "../../navigation/navigationRef";

/**
 * Sends a crash to the app_errors table (20261105_0002_app_errors.sql), which only an admin can
 * read, so problems on other people's phones are seen without them having to say. Nothing about
 * the player goes with it beyond their account id: the error, where it happened, and which
 * version of the app it was.
 *
 * Never throws, and stops after a handful per launch so one broken screen can't flood the table.
 */

const MAX_PER_LAUNCH = 5;
let sent = 0;
const seen = new Set<string>();

export type ErrorSource = "render" | "global";

const currentScreen = () => {
  try {
    return navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? null) : null;
  } catch {
    return null;
  }
};

export const logAppError = async (
  error: unknown,
  source: ErrorSource,
  extra: { fatal?: boolean; componentStack?: string | null } = {}
): Promise<void> => {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = `${err.name}: ${err.message}`.slice(0, 1000);
    const key = `${source}:${message}`;
    if (sent >= MAX_PER_LAUNCH || seen.has(key)) return;
    seen.add(key);
    sent += 1;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    // Only signed-in players can write to the table.
    if (!userId) return;
    const stack = [err.stack ?? "", extra.componentStack ? `\nComponent stack:${extra.componentStack}` : ""]
      .join("")
      .slice(0, 8000);
    await supabase.from("app_errors").insert({
      user_id: userId,
      source,
      fatal: extra.fatal ?? false,
      message,
      stack: stack || null,
      screen: currentScreen(),
      app_version: Constants.expoConfig?.version ?? null,
      update_id: Updates.updateId ?? null,
      platform: `${Platform.OS} ${String(Platform.Version)}`,
    });
  } catch {
    // Logging a crash must never cause another one.
  }
};

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

/** Also catches errors thrown outside a screen's drawing (in a tap handler or a timer), which
 *  the error screen can't. The app's own handling carries on after it. */
export const installGlobalErrorLogging = () => {
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void } })
    .ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    void logAppError(error, "global", { fatal: !!isFatal });
    previous(error, isFatal);
  });
};
