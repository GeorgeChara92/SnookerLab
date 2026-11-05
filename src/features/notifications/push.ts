import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "../../api/supabase";
import { safeStorage } from "../../utils/storage";

/** This phone's Expo push token, kept so signing out can remove it from the account it was saved to. */
const TOKEN_KEY = "push-token";

/**
 * Registers this phone for push and saves its token against the signed-in account, which is what
 * lets the server send chat messages and followed pro matches to it. Saving the token moves it to
 * whoever is signed in now, so a shared phone never gets the last person's messages.
 *
 * Quietly does nothing when permission is refused, on a simulator, or signed out. With `ask` false
 * it never shows the system prompt, only refreshes a token the person already allowed.
 */
export const registerForPush = async (userId: string | null, ask = true): Promise<boolean> => {
  if (!userId) return false;
  try {
    const { status } = ask ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
    if (status !== "granted") return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return false;
    const { error } = await supabase
      .from("push_tokens")
      .upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: "token" });
    if (error) throw error;
    await safeStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch (error) {
    console.warn("push registration failed", error);
    return false;
  }
};

/** Takes this phone's token off the account before signing out, so its messages stop arriving here.
 *  Never throws: signing out has to work regardless. */
export const forgetPushToken = async (): Promise<void> => {
  try {
    const token = await safeStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.from("push_tokens").delete().eq("token", token);
    await safeStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.warn("push token removal failed", error);
  }
};

/** The chat on screen right now, so its own messages don't also arrive as a banner. */
let openConversation: string | null = null;
export const setOpenConversation = (conversationId: string | null) => {
  openConversation = conversationId;
};
export const isConversationOpen = (conversationId: string) => openConversation === conversationId;
