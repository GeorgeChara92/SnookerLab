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

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export const RegisterScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { signUp, isLoading } = useAuthStore();
  const { colors, isDark } = useAppTheme();

  const handleRegister = async () => {
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    if (cleanUsername.length < 2) {
      setErrorMessage("Username must be at least 2 characters.");
      return;
    }
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
      await signUp(cleanEmail, password, cleanUsername);
      Alert.alert("Success", "Account created! Please check your email to verify.");
      navigation.navigate("Login");
    } catch (error: any) {
      const message = error?.message ?? "Unable to create account.";
      setErrorMessage(message);
      Alert.alert("Registration failed", message);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}> 
      <View
        style={[
          styles.backgroundOrbTop,
          { backgroundColor: isDark ? colors.primary : "#D5E9DF", opacity: isDark ? 0.25 : 0.7 },
        ]}
      />
      <View
        style={[
          styles.backgroundOrbBottom,
          { backgroundColor: isDark ? "#2A5648" : "#C6DED3", opacity: isDark ? 0.2 : 0.65 },
        ]}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.brand, { color: colors.primary }]}>SNOOKERLAB</Text>
            <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Start tracking every session, match and improvement trend.</Text>

            {errorMessage ? <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text> : null}

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCorrect={false}
              returnKeyType="next"
            />
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
              onSubmitEditing={handleRegister}
            />

            <AppButton label="Create Account" onPress={handleRegister} loading={isLoading} />

            <Pressable style={styles.switchWrap} onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.switchText, { color: colors.textMuted }]}>Already registered? <Text style={[styles.switchTextStrong, { color: colors.primary }]}>Sign in</Text></Text>
            </Pressable>

            <Text style={[styles.footnote, { color: colors.textMuted }]}>By continuing, you agree to future Terms and Privacy updates.</Text>
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
    left: -70,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -90,
    right: -70,
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
  switchWrap: {
    marginTop: 14,
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
