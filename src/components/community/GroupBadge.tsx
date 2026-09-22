import React from "react";
import { Text, View } from "react-native";
import type { Group } from "../../features/community/chat";

/** A group's emoji on its colour, the way its members recognise it. */
export const GroupBadge = ({ group, size = 44 }: { group: Pick<Group, "emoji" | "colour">; size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      backgroundColor: group.colour,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text allowFontScaling={false} style={{ fontSize: size * 0.5 }}>
      {group.emoji}
    </Text>
  </View>
);
