import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../hooks/useAppTheme";
import { HeaderProfileButton } from "../components/profile/HeaderProfileButton";

const HeaderBackArrow: React.FC<{ tintColor?: string }> = ({ tintColor }) => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.backButton}
    >
      <MaterialCommunityIcons name="chevron-left" size={28} color={tintColor ?? colors.text} />
    </Pressable>
  );
};

/**
 * An icon button for a header, the same fixed square as the back arrow so iOS centres it inside
 * its round glass button instead of pushing the icon to one side.
 */
export const HeaderIconButton: React.FC<{
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  label: string;
  onPress: () => void;
  size?: number;
}> = ({ icon, color, label, onPress, size = 22 }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.backButton}>
    <MaterialCommunityIcons name={icon} size={size} color={color} />
  </Pressable>
);

export const useAppStackScreenOptions = (withProfileShortcut = true): NativeStackNavigationOptions => {
  const { colors } = useAppTheme();

  return {
    headerStyle: {
      backgroundColor: colors.surface,
    },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    headerTitleStyle: {
      fontWeight: "800",
      fontSize: 17,
    },
    headerLeft: withProfileShortcut
      ? (props) => (props.canGoBack ? <HeaderBackArrow tintColor={props.tintColor} /> : null)
      : undefined,
    headerRight: withProfileShortcut
      ? (props) =>
          props.canGoBack ? null : (
            <View style={styles.rightSlot}>
              <HeaderProfileButton />
            </View>
          )
      : undefined,
    contentStyle: { backgroundColor: colors.background },
  };
};

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rightSlot: {
    paddingRight: 12,
    minWidth: 100,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
