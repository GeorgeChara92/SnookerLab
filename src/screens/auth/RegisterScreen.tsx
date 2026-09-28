import React, { useMemo, useRef, useState } from "react";
import { FlatList, Image, Linking, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../store";
import { useUiModeStore } from "../../store/uiModeStore";
import type { AuthStackParamList, SkillLevel } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AuthBanner, AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { PlayerAvatar } from "../../components/profile/PlayerAvatar";
import { encodeAvatar, faceSeeds, topBallFor } from "../../features/profile/avatarSpec";
import {
  COUNTRIES,
  getCountryByCode,
  SKILL_LEVELS,
  CUE_LENGTH_OPTIONS,
  CUE_FERRULE_OPTIONS,
  CUE_TIP_OPTIONS,
  CUE_WEIGHT_OPTIONS,
  DEFAULT_CUE_SETUP,
  buildCuePreferenceValue,
  type CueSetupSelection,
} from "../../constants/profileOptions";
import { cleanHandle, handleProblem, suggestHandle } from "../../features/community/handle";
import { getAuthErrorMessage } from "../../utils/authErrors";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;
type AccountType = "player" | "coach" | "both";
type StepKey = "type" | "details" | "game" | "coach" | "identity";
type Field = "fullName" | "username" | "email" | "password" | "handle";
type CueFieldKey = keyof CueSetupSelection;
const AVATAR_COUNT = 10;

const CUE_FIELD_CONFIG: Record<CueFieldKey, { label: string; options: readonly string[]; format: (value: string) => string }> = {
  lengthIn: { label: "Length", options: CUE_LENGTH_OPTIONS, format: (value) => `${value} in` },
  ferrule: { label: "Ferrule", options: CUE_FERRULE_OPTIONS, format: (value) => (value === "brass" ? "Brass" : "Titanium") },
  tipMm: { label: "Tip", options: CUE_TIP_OPTIONS, format: (value) => `${value} mm` },
  weightOz: { label: "Weight", options: CUE_WEIGHT_OPTIONS, format: (value) => `${value} oz` },
};

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snookeredapp.com/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snookeredapp.com/terms";

const BIO_LIMIT = 160;
const LOCATION_LIMIT = 120;
const QUALIFICATION_LIMIT = 40;
const MAX_QUALIFICATIONS = 6;

const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

/** Which steps a given account type walks through - type and details always, then whichever
 * profile sections actually apply, ending on the one identity step everyone shares. */
const stepsFor = (accountType: AccountType): StepKey[] => {
  const steps: StepKey[] = ["type", "details"];
  if (accountType === "player" || accountType === "both") steps.push("game");
  if (accountType === "coach" || accountType === "both") steps.push("coach");
  steps.push("identity");
  return steps;
};

const stepMeta = (key: StepKey, accountType: AccountType): { title: string; subtitle: string } => {
  switch (key) {
    case "type":
      return {
        title: "Create your account",
        subtitle: "Free to start. Your matches, practice and coaching, on every device you sign in on.",
      };
    case "details":
      return { title: "The basics", subtitle: "How you sign in, and how a coach or player sees your name." };
    case "game":
      return { title: "About your game", subtitle: "Helps us pitch practice routines at your level. Change this anytime." };
    case "coach":
      return {
        title: "Your coaching profile",
        subtitle: "What a player sees before booking you. Change any of this anytime from Coach Settings.",
      };
    case "identity":
      return {
        title: "Your handle",
        subtitle:
          accountType === "player"
            ? "How other players find and mention you."
            : "How players find and mention you, alongside your coaching profile.",
      };
  }
};

export const RegisterScreen = ({ navigation }: Props) => {
  const [accountType, setAccountType] = useState<AccountType>("player");
  const [step, setStep] = useState(0);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [skillLevel, setSkillLevel] = useState<SkillLevel | "">("");
  const [countryCode, setCountryCode] = useState("");
  const [pickingCountry, setPickingCountry] = useState(false);
  const [cueSetup, setCueSetup] = useState<CueSetupSelection>(DEFAULT_CUE_SETUP);
  const [activeCueField, setActiveCueField] = useState<CueFieldKey | null>(null);

  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [coachBio, setCoachBio] = useState("");
  const [coachLocation, setCoachLocation] = useState("");
  const [coachCoords, setCoachCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [wpbsa, setWpbsa] = useState(false);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const [handle, setHandle] = useState("");
  const [playerBio, setPlayerBio] = useState("");

  const [problem, setProblem] = useState<{ field?: Field; message: string } | null>(null);
  const { signUp, isLoading } = useAuthStore();
  const { colors } = useAppTheme();
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const country = countryCode ? getCountryByCode(countryCode) : null;
  const steps = useMemo(() => stepsFor(accountType), [accountType]);
  const stepKey = steps[step];
  const meta = stepMeta(stepKey, accountType);
  const isLastStep = step === steps.length - 1;

  const faceOptions = useMemo(() => faceSeeds(username || fullName || "player", 0, AVATAR_COUNT), [username, fullName]);
  const selectedSeed = avatarSeed ?? faceOptions[0];

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setProblem({ message: "Turn on location for Snookered in Settings to use this, or type your club in by hand." });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const label = place ? [place.city ?? place.subregion, place.region ?? place.country].filter(Boolean).join(", ") : null;
      setCoachCoords({ lat: latitude, lng: longitude });
      if (label) setCoachLocation(label.slice(0, LOCATION_LIMIT));
    } catch {
      setProblem({ message: "Could not get your location. Check your connection and try again." });
    } finally {
      setLocating(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      setProblem({ message: "Allow access to your photo library in Settings, then choose a photo." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUri(result.assets[0].uri);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag || qualifications.includes(tag) || qualifications.length >= MAX_QUALIFICATIONS) return;
    setQualifications([...qualifications, tag]);
    setNewTag("");
  };
  const removeTag = (tag: string) => setQualifications(qualifications.filter((item) => item !== tag));

  const validate = (key: StepKey): boolean => {
    if (key === "details") {
      const cleanFullName = fullName.trim();
      const cleanUsername = username.trim();
      const cleanEmail = email.trim();
      if (cleanFullName.length < 2) {
        setProblem({ field: "fullName", message: "Enter your name, so a coach you book with knows who they're seeing." });
        return false;
      }
      if (cleanUsername.length < 2) {
        setProblem({ field: "username", message: "Choose a username of at least 2 characters." });
        return false;
      }
      if (!looksLikeEmail(cleanEmail)) {
        setProblem({ field: "email", message: "Enter an email address you can open: we send a link to confirm it." });
        emailRef.current?.focus();
        return false;
      }
      if (password.length < 6) {
        setProblem({ field: "password", message: "Choose a password of at least 6 characters." });
        passwordRef.current?.focus();
        return false;
      }
    }
    if (key === "identity" && handle) {
      const issue = handleProblem(handle);
      if (issue) {
        setProblem({ field: "handle", message: issue });
        return false;
      }
    }
    setProblem(null);
    return true;
  };

  const handleRegister = async () => {
    try {
      const bio = (accountType === "player" ? playerBio : coachBio).trim();
      const { alreadyRegistered } = await signUp({
        email: email.trim(),
        password,
        username: username.trim(),
        fullName: fullName.trim(),
        accountType,
        skillLevel: skillLevel || undefined,
        countryCode: countryCode || undefined,
        cuePreference: steps.includes("game") ? buildCuePreferenceValue(cueSetup) : undefined,
        avatarPreset: encodeAvatar({ seed: selectedSeed, outfit: "casual", ball: topBallFor(1) }),
        handle: handle || undefined,
        bio: bio || undefined,
        coachLocation: accountType !== "player" ? coachLocation || undefined : undefined,
        coachLat: accountType !== "player" ? coachCoords?.lat : undefined,
        coachLng: accountType !== "player" ? coachCoords?.lng : undefined,
        wpbsaAccredited: accountType !== "player" ? wpbsa : undefined,
        coachQualifications: accountType !== "player" ? qualifications : undefined,
      });
      if (alreadyRegistered) {
        // No email is sent for an address that already has an account: send them to log in.
        navigation.navigate("Login", {
          prefillEmail: email.trim(),
          notice: "That email already has an account. Log in, or use Forgot password if you need a new one.",
        });
        return;
      }
      // "Coach" said this is their only reason for being here - open straight into coach view
      // rather than asking again what a "both" account genuinely needs asked (see ChooseViewScreen).
      if (accountType === "coach") useUiModeStore.getState().setViewMode("coach");
      // Staged now, uploaded the moment a session exists (AppNavigator, on first login) - so the
      // photo they picked here just seems to already be on their profile.
      if (photoUri) {
        try {
          await useAuthStore.getState().stagePendingAvatar(photoUri);
        } catch (error) {
          console.warn("Could not stage the picked avatar:", error);
        }
      }
      navigation.navigate("ConfirmEmail", { email: email.trim() });
    } catch (error: any) {
      setProblem({ message: getAuthErrorMessage(error, "sign-up") });
    }
  };

  const goNext = () => {
    if (!validate(stepKey)) return;
    if (isLastStep) {
      void handleRegister();
      return;
    }
    const nextIndex = step + 1;
    if (steps[nextIndex] === "identity" && !handle) setHandle(suggestHandle(username || fullName));
    setStep(nextIndex);
  };

  const goBack = () => {
    setProblem(null);
    setStep((current) => Math.max(0, current - 1));
  };

  return (
    <AuthShell strapline="EVERY FRAME COUNTS FROM HERE" title={meta.title} subtitle={meta.subtitle}>
      <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((key, index) => (
          <View
            key={key}
            style={[
              styles.progressDot,
              { backgroundColor: index <= step ? colors.primary : colors.border, flex: index === steps.length - 1 ? 0 : 1 },
            ]}
          />
        ))}
      </View>

      {problem ? <AuthBanner tone="danger" message={problem.message} /> : null}

      {stepKey === "type" ? (
        <View style={styles.accountTypeColumn}>
          {(
            [
              { value: "player" as const, label: "Player", icon: "bullseye-arrow" as const, hint: "Log matches, practise, join the community." },
              { value: "coach" as const, label: "Coach", icon: "whistle-outline" as const, hint: "Take bookings and run your own coaching profile." },
              { value: "both" as const, label: "Both", icon: "account-multiple-outline" as const, hint: "Play and coach from the same account." },
            ]
          ).map((option) => {
            const selected = accountType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setAccountType(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.accountTypeOption,
                  { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border },
                ]}
              >
                <MaterialCommunityIcons name={option.icon} size={24} color={selected ? colors.onPrimary : colors.text} />
                <View style={styles.accountTypeText}>
                  <Text style={[styles.accountTypeLabel, { color: selected ? colors.onPrimary : colors.text }]}>{option.label}</Text>
                  <Text style={[styles.accountTypeHint, { color: selected ? colors.onPrimary : colors.textMuted }]}>{option.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {stepKey === "details" ? (
        <>
          <AuthField
            label="Full name"
            icon="badge-account-outline"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            invalid={problem?.field === "fullName"}
          />
          <AuthField
            ref={usernameRef}
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
            textContentType="newPassword"
            autoComplete="new-password"
            passwordRules="minlength: 6;"
            returnKeyType="done"
            hint="At least 6 characters. Tap the eye to check what you typed."
            invalid={problem?.field === "password"}
          />
        </>
      ) : null}

      {stepKey === "game" ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Skill level</Text>
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
                    { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border },
                  ]}
                >
                  <Text style={[styles.levelText, { color: selected ? colors.onPrimary : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {level.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>Country</Text>
          <Pressable
            onPress={() => setPickingCountry(true)}
            accessibilityRole="button"
            accessibilityLabel={country ? `Country: ${country.name}. Change` : "Choose your country"}
            style={[styles.countryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {country ? <Text style={styles.flag}>{country.emoji}</Text> : <MaterialCommunityIcons name="earth" size={20} color={colors.textMuted} />}
            <Text style={[styles.countryText, { color: country ? colors.text : colors.textMuted }]}>{country ? country.name : "Country"}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Text style={[styles.hint, { color: colors.textSubtle }]}>Both optional - you can set or change these anytime from your profile.</Text>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>Cue setup</Text>
          <View style={styles.cueGrid}>
            {(Object.keys(CUE_FIELD_CONFIG) as CueFieldKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setActiveCueField(key)}
                accessibilityRole="button"
                style={[styles.cueField, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.cueFieldLabel, { color: colors.textMuted }]}>{CUE_FIELD_CONFIG[key].label}</Text>
                <View style={styles.cueFieldValueRow}>
                  <Text style={[styles.cueFieldValue, { color: colors.text }]}>{CUE_FIELD_CONFIG[key].format(cueSetup[key])}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.textSubtle }]}>A starting point - change any of these anytime from your profile.</Text>

          <Modal visible={activeCueField !== null} transparent animationType="fade" onRequestClose={() => setActiveCueField(null)}>
            <Pressable style={styles.cueOverlay} onPress={() => setActiveCueField(null)} accessibilityLabel="Close">
              <Pressable style={[styles.cueModal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => null} accessibilityViewIsModal>
                {activeCueField ? (
                  <>
                    <Text style={[styles.cueModalTitle, { color: colors.text }]}>{CUE_FIELD_CONFIG[activeCueField].label}</Text>
                    <FlatList
                      data={CUE_FIELD_CONFIG[activeCueField].options}
                      keyExtractor={(item) => item}
                      renderItem={({ item }) => {
                        const isSelected = cueSetup[activeCueField] === item;
                        return (
                          <Pressable
                            onPress={() => {
                              setCueSetup((prev) => ({ ...prev, [activeCueField]: item }));
                              setActiveCueField(null);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            style={[styles.cueOption, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.surfaceMuted }]}
                          >
                            <Text style={[styles.cueOptionText, { color: isSelected ? colors.primary : colors.text }]}>
                              {CUE_FIELD_CONFIG[activeCueField].format(item)}
                            </Text>
                            {isSelected ? <MaterialCommunityIcons name="check" size={18} color={colors.primary} /> : null}
                          </Pressable>
                        );
                      }}
                    />
                  </>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : null}

      {stepKey === "coach" ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bio</Text>
          <TextInput
            value={coachBio}
            onChangeText={(text) => setCoachBio(text.slice(0, BIO_LIMIT))}
            placeholder="Your teaching style, what you specialise in, who you coach..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.bioInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <Text style={[styles.hint, { color: colors.textSubtle }]}>{coachBio.length}/{BIO_LIMIT} · shown to players browsing for a coach</Text>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>Where you coach</Text>
          <AuthField
            label="Location"
            icon="map-marker-outline"
            value={coachLocation}
            onChangeText={(text) => {
              setCoachLocation(text.slice(0, LOCATION_LIMIT));
              setCoachCoords(null);
            }}
            placeholder="A club or town, e.g. The Cue Club, Sheffield"
          />
          <Pressable onPress={useCurrentLocation} disabled={locating} accessibilityRole="button" style={styles.locateButton}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
            <Text style={[styles.locateText, { color: colors.primary }]}>{locating ? "Finding you..." : "Use my current location"}</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>Credentials</Text>
          <View style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.switchText}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>WPBSA accredited</Text>
              <Text style={[styles.hint, { color: colors.textSubtle }]}>Self-declared - not checked against the WPBSA's own records.</Text>
            </View>
            <Switch value={wpbsa} onValueChange={setWpbsa} trackColor={{ true: colors.primary }} />
          </View>

          {qualifications.length ? (
            <View style={styles.tags}>
              {qualifications.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => removeTag(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tag}`}
                  style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{tag}</Text>
                  <MaterialCommunityIcons name="close" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {qualifications.length < MAX_QUALIFICATIONS ? (
            <View style={styles.addTag}>
              <TextInput
                value={newTag}
                onChangeText={(text) => setNewTag(text.slice(0, QUALIFICATION_LIMIT))}
                placeholder="e.g. WPBSA Level 2"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={addTag}
                returnKeyType="done"
                style={[styles.tagInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
              <Pressable
                onPress={addTag}
                disabled={!newTag.trim()}
                accessibilityRole="button"
                accessibilityLabel="Add qualification"
                style={[styles.addButton, { backgroundColor: colors.primary, opacity: newTag.trim() ? 1 : 0.4 }]}
              >
                <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
              </Pressable>
            </View>
          ) : null}
          <Text style={[styles.hint, { color: colors.textSubtle }]}>All optional - fill in as much or as little as you like now.</Text>
        </>
      ) : null}

      {stepKey === "identity" ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Avatar</Text>
          <View style={styles.avatarPreview}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={[styles.avatarPhoto, { borderColor: colors.primary }]} />
            ) : (
              <PlayerAvatar spec={{ seed: selectedSeed, outfit: "casual", ball: topBallFor(1) }} size={84} />
            )}
          </View>

          {photoUri ? (
            <Pressable onPress={() => setPhotoUri(null)} style={styles.avatarPhotoAction}>
              <Text style={[styles.link, { color: colors.primary }]}>Use a generated face instead</Text>
            </Pressable>
          ) : (
            <>
              <FlatList
                horizontal
                data={faceOptions}
                keyExtractor={(seed) => seed}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.faceRow}
                renderItem={({ item: seed }) => {
                  const selected = selectedSeed === seed;
                  return (
                    <Pressable
                      onPress={() => setAvatarSeed(seed)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel="Use this face"
                      style={[styles.faceTile, { borderColor: selected ? colors.primary : "transparent", backgroundColor: colors.surface }]}
                    >
                      <PlayerAvatar spec={{ seed, outfit: "casual", ball: topBallFor(1) }} size={48} showRing={false} />
                    </Pressable>
                  );
                }}
              />
              <Pressable onPress={pickPhoto} style={styles.avatarPhotoAction}>
                <Text style={[styles.link, { color: colors.primary }]}>Use a real photo instead</Text>
              </Pressable>
            </>
          )}
          <Text style={[styles.hint, { color: colors.textSubtle }]}>
            {photoUri
              ? "This goes on your profile as soon as you confirm your email and sign in."
              : "Prefer a real photo? Add one anytime from your profile once you're signed in."}
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>Handle</Text>
          <View style={[styles.handleBox, { backgroundColor: colors.surface, borderColor: problem?.field === "handle" ? colors.danger : colors.border }]}>
            <Text style={[styles.at, { color: colors.textMuted }]}>@</Text>
            <TextInput
              value={handle}
              onChangeText={(text) => setHandle(cleanHandle(text))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={[styles.handleInput, { color: colors.text }]}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textSubtle }]}>
            Letters, numbers, dots and underscores. We'll let you know if it's taken once you're signed in.
          </Text>

          {accountType === "player" ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>Bio</Text>
              <TextInput
                value={playerBio}
                onChangeText={(text) => setPlayerBio(text.slice(0, BIO_LIMIT))}
                placeholder="Your club, your high break, what you are working on"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={[styles.bioInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              />
              <Text style={[styles.hint, { color: colors.textSubtle }]}>{playerBio.length}/{BIO_LIMIT} · optional</Text>
            </>
          ) : null}
        </>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? <AppButton label="Back" variant="secondary" onPress={goBack} /> : null}
        <View style={styles.flexButton}>
          <AppButton label={isLastStep ? "Create account" : "Next"} onPress={goNext} loading={isLastStep && isLoading} />
        </View>
      </View>

      {step === 0 ? (
        <>
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
        </>
      ) : null}

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
    return COUNTRIES.filter((item) => item.name.toLowerCase().includes(query) || item.code.toLowerCase() === query);
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
  progress: { flexDirection: "row", gap: 6, marginBottom: SPACING.lg },
  progressDot: { height: 4, borderRadius: 2, minWidth: 20 },

  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: SPACING.sm },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6 },

  accountTypeColumn: { gap: SPACING.sm, marginBottom: SPACING.sm },
  accountTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 16,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  accountTypeText: { flex: 1, gap: 2 },
  accountTypeLabel: { fontSize: 16, fontWeight: "800" },
  accountTypeHint: { fontSize: 12, lineHeight: 16 },

  levels: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  level: {
    width: "48.5%",
    minHeight: HIT_TARGET,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  levelText: { fontSize: 15, fontWeight: "700" },

  cueGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cueField: { width: "48.5%", borderWidth: 1.5, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 68, justifyContent: "space-between" },
  cueFieldLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  cueFieldValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  cueFieldValue: { fontSize: 16, fontWeight: "800" },
  cueOverlay: { flex: 1, backgroundColor: SCRIM, justifyContent: "center", paddingHorizontal: SPACING.xl },
  cueModal: { borderWidth: 1, borderRadius: RADIUS.xl, maxHeight: "72%", padding: SPACING.xl },
  cueModalTitle: { fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: SPACING.md },
  cueOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cueOptionText: { fontSize: 15, fontWeight: "700" },

  avatarPreview: { alignItems: "center", marginBottom: SPACING.md },
  avatarPhoto: { width: 84, height: 84, borderRadius: 42, borderWidth: 2 },
  avatarPhotoAction: { alignSelf: "center", marginTop: SPACING.sm },
  faceRow: { gap: SPACING.sm, paddingBottom: 2 },
  faceTile: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center" },

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

  bioInput: { minHeight: 90, borderWidth: 1.5, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, lineHeight: 20 },
  locateButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm, alignSelf: "flex-start", minHeight: HIT_TARGET - 12 },
  locateText: { fontSize: 14, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, borderWidth: 1.5, borderRadius: RADIUS.md, padding: SPACING.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  addTag: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  tagInput: { flex: 1, minHeight: HIT_TARGET, borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: 15 },
  addButton: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },

  handleBox: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 52, borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md },
  at: { fontSize: 18, fontWeight: "800" },
  handleInput: { flex: 1, fontSize: 16, fontWeight: "700", paddingVertical: SPACING.sm },

  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xl },
  flexButton: { flex: 1 },
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
