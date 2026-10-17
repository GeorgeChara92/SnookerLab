import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { RouteProp, ParamListBase } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../hooks/useAppTheme";
import { HeaderProfileButton } from "../components/profile/HeaderProfileButton";
import { HelpButton } from "../components/help/HelpButton";

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

/** A header's right-hand buttons in a row - the "?" first, then whatever the screen adds. */
export const HeaderButtons: React.FC<{ children: React.ReactNode }> = ({ children }) => <View style={styles.buttonRow}>{children}</View>;

/** Every stack screen's header: the back arrow, and on the right the screen's "?" help (when it has
 *  a topic) - plus, on a tab's landing screen, the profile shortcut. A function of the route, so
 *  each screen's "?" opens its own help. */
export const useAppStackScreenOptions = (
  withProfileShortcut = true
): ((props: { route: RouteProp<ParamListBase, string> }) => NativeStackNavigationOptions) => {
  const { colors } = useAppTheme();

  return ({ route }) => ({
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
    headerRight: (props) =>
      withProfileShortcut && !props.canGoBack ? (
        <View style={[styles.rightSlot, styles.buttonRow]}>
          <HelpButton routeName={route.name} />
          <HeaderProfileButton />
        </View>
      ) : (
        <HelpButton routeName={route.name} color={props.tintColor} />
      ),
    contentStyle: { backgroundColor: colors.background },
  });
};

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rightSlot: {
    paddingRight: 12,
    minWidth: 100,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
