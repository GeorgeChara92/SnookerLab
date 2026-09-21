import React, { useMemo, useRef, useState } from "react";
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store";
import type { AuthStackParamList, SkillLevel } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AuthBanner, AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { COUNTRIES, getCountryByCode, SKILL_LEVELS } from "../../constants/profileOptions";
import { getAuthErrorMessage } from "../../utils/authErrors";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;
type Field = "username" | "email" | "password";

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snooker-lab.vercel.app/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snooker-lab.vercel.app/terms";

const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export const RegisterScreen = ({ navigation }: Props) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "">("");
  const [countryCode, setCountryCode] = useState("");
  const [pickingCountry, setPickingCountry] = useState(false);
  const [problem, setProblem] = useState<{ field?: Field; message: string } | null>(null);
  const { signUp, isLoading } = useAuthStore();
  const { colors } = useAppTheme();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const country = countryCode ? getCountryByCode(countryCode) : null;

  const handleRegister = async () => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    if (cleanUsername.length < 2) {
      setProblem({ field: "username", message: "Choose a username of at least 2 characters." });
      return;
    }
    if (!looksLikeEmail(cleanEmail)) {
      setProblem({ field: "email", message: "Enter an email address you can open: we send a link to confirm it." });
      emailRef.current?.focus();
      return;
    }
    if (password.length < 6) {
      setProblem({ field: "password", message: "Choose a password of at least 6 characters." });
      passwordRef.current?.focus();
      return;
    }

    setProblem(null);
    try {
      await signUp(cleanEmail, password, cleanUsername, skillLevel || undefined, countryCode || undefined);
      navigation.navigate("ConfirmEmail", { email: cleanEmail });
    } catch (error: any) {
      setProblem({ message: getAuthErrorMessage(error, "sign-up") });
    }
  };

  return (
    <AuthShell
      strapline="EVERY FRAME COUNTS FROM HERE"
      title="Create your account"
      subtitle="Free to start. Your matches, practice and coaching, on every device you sign in on."
    >
      {problem ? <AuthBanner tone="danger" message={problem.message} /> : null}

      <AuthField
        label="Username"
        icon="account-outline"
        value={username}
        onChangeText={setUsername}
        placeholder="What other players see"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username-new"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        invalid={problem?.field === "username"}
      />
      <AuthField
        ref={emailRef}
        label="Email"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        invalid={problem?.field === "email"}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        revealable
        // Lets iOS suggest a strong password and save it to the keychain.
        textContentType="newPassword"
        autoComplete="new-password"
        passwordRules="minlength: 6;"
        returnKeyType="done"
        hint="At least 6 characters. Tap the eye to check what you typed."
        invalid={problem?.field === "password"}
      />

      {/* ------------------------------------------------ about your game */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About your game</Text>
        <Text style={[styles.optional, { color: colors.textMuted }]}>Optional</Text>
      </View>
      <Text style={[styles.sectionText, { color: colors.textMuted }]}>
        Helps us pitch practice routines at your level. You can change these later.
      </Text>

      <View style={styles.levels}>
        {SKILL_LEVELS.map((level) => {
          const selected = skillLevel === level.value;
          return (
            <Pressable
              key={level.value}
              onPress={() => setSkillLevel(selected ? "" : level.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.level,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.levelText, { color: selected ? colors.onPrimary : colors.text }]}>{level.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => setPickingCountry(true)}
        accessibilityRole="button"
        accessibilityLabel={country ? `Country: ${country.name}. Change` : "Choose your country"}
        style={[styles.countryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {country ? <Text style={styles.flag}>{country.emoji}</Text> : (
          <MaterialCommunityIcons name="earth" size={20} color={colors.textMuted} />
        )}
        <Text style={[styles.countryText, { color: country ? colors.text : colors.textMuted }]}>
          {country ? country.name : "Country"}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={styles.submit}>
        <AppButton label="Create account" onPress={handleRegister} loading={isLoading} />
      </View>

      <Pressable onPress={() => navigation.navigate("Login")} accessibilityRole="button" style={styles.switch}>
        <Text style={[styles.quiet, { color: colors.textMuted }]}>
          Already have an account? <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
        </Text>
      </Pressable>

      <Text style={[styles.legal, { color: colors.textMuted }]}>
        By creating an account you agree to the{" "}
        <Text style={[styles.legalLink, { color: colors.text }]} onPress={() => void Linking.openURL(TERMS_URL)}>
          Terms of Use
        </Text>{" "}
        and{" "}
        <Text style={[styles.legalLink, { color: colors.text }]} onPress={() => void Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </Text>
        .
      </Text>

      <CountrySheet
        visible={pickingCountry}
        selected={countryCode}
        onClose={() => setPickingCountry(false)}
        onPick={(code) => {
          setCountryCode(code);
          setPickingCountry(false);
        }}
      />
    </AuthShell>
  );
};

/** Every country, searchable by name or code. */
const CountrySheet = ({
  visible,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  selected: string;
  onClose: () => void;
  onPick: (code: string) => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const countries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter(
      (item) => item.name.toLowerCase().includes(query) || item.code.toLowerCase() === query
    );
  }, [search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.countrySheet, { backgroundColor: colors.background }]}>
        <View style={[styles.countryHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.countryTitle, { color: colors.text }]}>Your country</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.countrySearch}>
          <AuthField
            label="Search"
            icon="magnify"
            value={search}
            onChangeText={setSearch}
            placeholder="Country name"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <FlatList
          data={countries}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
          renderItem={({ item }) => {
            const isSelected = item.code === selected;
            return (
              <Pressable
                onPress={() => onPick(isSelected ? "" : item.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.countryRow,
                  { backgroundColor: pressed ? colors.surfaceMuted : "transparent", borderBottomColor: colors.border },
                ]}
              >
                <Text style={styles.flag}>{item.emoji}</Text>
                <Text style={[styles.countryRowText, { color: colors.text }]}>{item.name}</Text>
                {isSelected ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No country matches "{search.trim()}".</Text>
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: SPACING.lg },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  optional: { fontSize: 13, fontWeight: "600" },
  sectionText: { fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: SPACING.md },

  levels: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  level: {
    width: "48.5%",
    minHeight: HIT_TARGET,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: { fontSize: 15, fontWeight: "700" },

  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  flag: { fontSize: 20 },
  countryText: { flex: 1, fontSize: 16 },

  submit: { marginTop: SPACING.xl },
  switch: { marginTop: SPACING.lg, minHeight: HIT_TARGET, justifyContent: "center" },
  quiet: { fontSize: 14, textAlign: "center" },
  link: { fontSize: 14, fontWeight: "700" },
  legal: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: SPACING.sm },
  legalLink: { fontWeight: "700", textDecorationLine: "underline" },

  countrySheet: { flex: 1 },
  countryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryTitle: { fontSize: 20, fontWeight: "800" },
  countrySearch: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryRowText: { flex: 1, fontSize: 16 },
  empty: { fontSize: 14, textAlign: "center", padding: SPACING.xl },
});
