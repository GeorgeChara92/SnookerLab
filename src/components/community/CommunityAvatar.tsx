import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { PlayerAvatar } from "../profile/PlayerAvatar";
import { SubscriberBadge } from "./SubscriberBadge";
import type { PublicProfile } from "../../features/community/types";

/** Another player's picture: their photo if they have one, otherwise their avatar and ring, with a
 * subscriber badge in the corner if they pay for one of the paid tiers. */
export const CommunityAvatar = ({
  profile,
  size = 44,
  borderColour,
}: {
  profile:
    | Pick<PublicProfile, "avatarUrl" | "avatarPreset" | "displayName" | "handle" | "level" | "subscriptionTier">
    | null
    | undefined;
  size?: number;
  /** Passed through to the badge - match whatever this avatar sits on if it isn't the screen background. */
  borderColour?: string;
}) => (
  <View style={{ width: size, height: size }}>
    {profile?.avatarUrl ? (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <Image
          source={{ uri: profile.avatarUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>
    ) : (
      <PlayerAvatar
        preset={profile?.avatarPreset ?? undefined}
        name={profile?.displayName ?? profile?.handle ?? ""}
        level={profile?.level ?? 1}
        size={size}
      />
    )}
    {profile?.subscriptionTier ? <SubscriberBadge tier={profile.subscriptionTier} size={size} borderColour={borderColour} /> : null}
  </View>
);

/** A country code as its flag, e.g. "GB" as the Union flag. */
export const flagOf = (code: string | null | undefined) =>
  code && /^[A-Za-z]{2}$/.test(code)
    ? String.fromCodePoint(
        ...code
          .toUpperCase()
          .split("")
          .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
      )
    : "";
