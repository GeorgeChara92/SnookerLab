import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { SnookerPresetAvatar } from "./SnookerPresetAvatar";

export const HeaderProfileButton = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      onPress={() => navigation.navigate("ProfileModal")}
      style={styles.wrap}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
        {user?.profile_image_url ? (
          <Image source={{ uri: user.profile_image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <SnookerPresetAvatar presetId={user?.avatar_preset} size={34} />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
