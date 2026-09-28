import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { PlayerAvatar } from "../profile/PlayerAvatar";
import type { PublicProfile } from "../../features/community/types";

/** Another player's picture: their photo if they have one, otherwise their avatar and ring. */
export const CommunityAvatar = ({
  profile,
  size = 44,
}: {
  profile: Pick<PublicProfile, "avatarUrl" | "avatarPreset" | "displayName" | "handle" | "level"> | null | undefined;
  size?: number;
}) => {
  if (profile?.avatarUrl) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <Image
          source={{ uri: profile.avatarUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>
    );
  }
  return (
    <PlayerAvatar
      preset={profile?.avatarPreset ?? undefined}
      name={profile?.displayName ?? profile?.handle ?? ""}
      level={profile?.level ?? 1}
      size={size}
    />
  );
};

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
