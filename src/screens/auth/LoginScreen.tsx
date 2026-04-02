import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../../store";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { signIn, isLoading } = useAuthStore();
  const { colors, isDark } = useAppTheme();

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setErrorMessage("");

    try {
      await signIn(cleanEmail, password);
    } catch (error: any) {
      const message = error?.message ?? "Unable to sign in. Please try again.";
      setErrorMessage(message);
      Alert.alert("Sign in failed", message);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}> 
      <View
        style={[
          styles.backgroundOrbTop,
          { backgroundColor: isDark ? colors.primary : "#CFE6DC", opacity: isDark ? 0.25 : 0.75 },
        ]}
      />
      <View
        style={[
          styles.backgroundOrbBottom,
          { backgroundColor: isDark ? "#2F5A4D" : "#B9D5C9", opacity: isDark ? 0.2 : 0.65 },
        ]}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.brand, { color: colors.primary }]}>SNOOKERLAB</Text>
            <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track practice, matches and progress with pro-level clarity.</Text>

            {errorMessage ? <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text> : null}

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <AppButton label="Sign In" onPress={handleLogin} loading={isLoading} />

            <Pressable style={styles.forgotLink} onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={[styles.forgotLinkText, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text style={[styles.switchText, { color: colors.textMuted }]}>New here? <Text style={[styles.switchTextStrong, { color: colors.primary }]}>Create an account</Text></Text>
            </Pressable>

            <Text style={[styles.footnote, { color: colors.textMuted }]}>Private by design. Your data stays tied to your account only.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -100,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  title: {
    fontSize: 31,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  forgotLink: {
    marginTop: 12,
    marginBottom: 14,
    alignSelf: "flex-end",
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchText: {
    textAlign: "center",
    fontSize: 14,
  },
  switchTextStrong: {
    fontWeight: "700",
  },
  footnote: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 12,
  },
});
