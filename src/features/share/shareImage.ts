import type { RefObject } from "react";
import { Share, TurboModuleRegistry, type View } from "react-native";

/**
 * Sharing a view as a picture.
 *
 * The picture is taken by react-native-view-shot, which is native code: an app built before it
 * was added does not have it, and loading the library there would crash. So it is only loaded
 * once the native side is known to be present, and until then sharing falls back to text.
 */

type ViewShot = typeof import("react-native-view-shot");

let viewShot: ViewShot | null | undefined;

const loadViewShot = (): ViewShot | null => {
  if (viewShot !== undefined) return viewShot;
  try {
    viewShot = TurboModuleRegistry.get("RNViewShot") ? (require("react-native-view-shot") as ViewShot) : null;
  } catch {
    viewShot = null;
  }
  return viewShot;
};

/** Whether this build can share pictures (it needs a build made after the library was added). */
export const canShareImages = () => loadViewShot() !== null;

/**
 * Shares the view as a PNG at the given size, with the message alongside where the app shared
 * to takes one. Returns false if a picture could not be made, so the caller can share text.
 */
export const shareViewAsImage = async (
  ref: RefObject<View | null>,
  message: string,
  size: { width: number; height: number }
) => {
  const shot = loadViewShot();
  if (!shot || !ref.current) return false;
  try {
    const uri = await shot.captureRef(ref, { format: "png", quality: 1, result: "tmpfile", ...size });
    await Share.share({ url: uri, message });
    return true;
  } catch (error) {
    console.warn("Could not share the picture:", error);
    return false;
  }
};

export const shareText = (message: string) => Share.share({ message });
