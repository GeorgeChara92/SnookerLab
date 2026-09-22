import { createNavigationContainerRef } from "@react-navigation/native";
import type { ChatShare } from "../features/community/chatShare";

/** For the few places outside a screen that need to move the player somewhere. */
export const navigationRef = createNavigationContainerRef<any>();

/** Opens "Send to" for a routine or match result, from any tab. */
export const openSendToChat = (share: ChatShare, customRoutineId?: string) => {
  if (navigationRef.isReady()) navigationRef.navigate("SendToChat", { share, customRoutineId });
};
