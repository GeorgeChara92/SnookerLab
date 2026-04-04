import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ConfirmEmailScreen } from "../screens/auth/ConfirmEmailScreen";
import { UpdatePasswordScreen } from "../screens/auth/UpdatePasswordScreen";
import { useAuthStore } from "../store";
import { AuthStackParamList } from "../types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  const requiresPasswordReset = useAuthStore((state) => state.requiresPasswordReset);

  return (
    <Stack.Navigator
      key={requiresPasswordReset ? "auth-reset" : "auth-default"}
      screenOptions={{ headerShown: false }}
      initialRouteName={requiresPasswordReset ? "UpdatePassword" : "Login"}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ConfirmEmail" component={ConfirmEmailScreen} />
      <Stack.Screen name="UpdatePassword" component={UpdatePasswordScreen} />
    </Stack.Navigator>
  );
};
