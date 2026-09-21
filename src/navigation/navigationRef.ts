import { createNavigationContainerRef } from "@react-navigation/native";

/** For the few places outside a screen that need to move the player somewhere. */
export const navigationRef = createNavigationContainerRef<any>();
