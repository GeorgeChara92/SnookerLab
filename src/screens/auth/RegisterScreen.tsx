import React, { useState } from "react";
import {
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store";
import type { AuthStackParamList, SkillLevel } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { COUNTRIES, getCountryByCode, SKILL_LEVELS } from "../../constants/profileOptions";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export const RegisterScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "">("");
  const [countryCode, setCountryCode] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { signUp, isLoading } = useAuthStore();
  const { colors, isDark } = useAppTheme();

  const filteredCountries = countrySearch
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : COUNTRIES.slice(0, 20);

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
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage("");

    try {
      await signUp(cleanEmail, password, cleanUsername, skillLevel || undefined, countryCode || undefined);
      navigation.navigate("ConfirmEmail", { email: cleanEmail });
    } catch (error: any) {
      const message = error?.message ?? "Unable to create account.";
      setErrorMessage(message);
    }
  };

  const selectedCountry = countryCode ? getCountryByCode(countryCode) : null;

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
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              returnKeyType="done"
            />

            {/* Skill Level */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Skill Level (optional)</Text>
            <View style={styles.optionsRow}>
              {SKILL_LEVELS.map((level) => {
                const isSelected = skillLevel === level.value;
                return (
                  <Pressable
                    key={level.value}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: isSelected ? colors.primary + "20" : colors.surfaceMuted,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSkillLevel(isSelected ? "" : level.value)}
                  >
                    <Text style={[styles.optionChipText, { color: isSelected ? colors.primary : colors.text }]}>{level.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Country */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Country (optional)</Text>
            <Pressable
              style={[styles.countryPicker, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              onPress={() => setShowCountryPicker(!showCountryPicker)}
            >
              {selectedCountry ? (
                <View style={styles.selectedCountryRow}>
                  <Text style={styles.countryEmoji}>{selectedCountry.emoji}</Text>
                  <Text style={[styles.countryText, { color: colors.text }]}>{selectedCountry.name}</Text>
                </View>
              ) : (
                <Text style={[styles.countryText, { color: colors.textMuted }]}>Select your country</Text>
              )}
              <MaterialCommunityIcons name={showCountryPicker ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
            </Pressable>

            {showCountryPicker && (
              <View style={[styles.countryDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.countrySearch, { backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }]}
                  placeholder="Search countries..."
                  placeholderTextColor={colors.textMuted}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                />
                <ScrollView style={styles.countryList} nestedScrollEnabled>
                  {filteredCountries.map((country) => {
                    const isSelected = countryCode === country.code;
                    return (
                      <Pressable
                        key={country.code}
                        style={[styles.countryItem, { backgroundColor: isSelected ? colors.primary + "10" : "transparent" }]}
                        onPress={() => {
                          setCountryCode(isSelected ? "" : country.code);
                          setShowCountryPicker(false);
                          setCountrySearch("");
                        }}
                      >
                        <Text style={styles.countryEmoji}>{country.emoji}</Text>
                        <Text style={[styles.countryItemText, { color: colors.text }]}>{country.name}</Text>
                        {isSelected && <MaterialCommunityIcons name="check" size={18} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.spacer} />

            <AppButton label="Create Account" onPress={handleRegister} loading={isLoading} />

            <Pressable style={styles.switchWrap} onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.switchText, { color: colors.textMuted }]}>
                Already registered? <Text style={[styles.switchTextStrong, { color: colors.primary }]}>Sign in</Text>
              </Text>
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
  content: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 18, paddingVertical: 20 },
  backgroundOrbTop: { position: "absolute", top: -80, left: -70, width: 250, height: 250, borderRadius: 125 },
  backgroundOrbBottom: { position: "absolute", bottom: -90, right: -70, width: 260, height: 260, borderRadius: 130 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24 },
  brand: { fontSize: 12, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase", fontWeight: "800" },
  title: { fontSize: 31, fontWeight: "800" },
  subtitle: { marginTop: 6, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  errorText: { marginBottom: 10, fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 12, borderRadius: 12, fontSize: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 8 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  optionChipText: { fontSize: 13, fontWeight: "600" },
  countryPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8 },
  selectedCountryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  countryText: { fontSize: 15 },
  countryEmoji: { fontSize: 20 },
  countryDropdown: { borderWidth: 1, borderRadius: 12, marginTop: -4, marginBottom: 12, maxHeight: 200 },
  countrySearch: { borderWidth: 1, margin: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontSize: 14 },
  countryList: { maxHeight: 150 },
  countryItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  countryItemText: { fontSize: 14, flex: 1 },
  spacer: { height: 12 },
  switchWrap: { marginTop: 14 },
  switchText: { textAlign: "center", fontSize: 14 },
  switchTextStrong: { fontWeight: "700" },
  footnote: { marginTop: 14, textAlign: "center", fontSize: 12 },
});