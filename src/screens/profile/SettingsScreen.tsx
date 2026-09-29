import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";
import { useNavigation, useNavigationState, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useOnboardingStore } from "../../store/onboardingStore";
import { APP_VERSION } from "../../components/onboarding/OnboardingHost";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { CodeConfirmModal } from "../../components/ui/CodeConfirmModal";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAuthStore } from "../../store";
import type { ProfileStackParamList, RootStackParamList } from "../../types";
import { isBillingConfigured, openNativeSubscriptionSettings, presentCustomerCenter } from "../../services/billing";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";
import { flushOutbox, refreshEverything, useOutboxStore } from "../../sync";

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snookeredapp.com/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snookeredapp.com/terms";
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "support@snookeredapp.com";

const createChallenge = () => Math.random().toString(36).toUpperCase().slice(2, 8);

/** "3 minutes ago", near enough for a status line. */
const sinceLabel = (iso: string | null) => {
  if (!iso) return "Not yet";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
};

type SettingsRowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
};

const SettingsRow: React.FC<SettingsRowProps & { colors: any }> = ({
  icon,
  label,
  value,
  onPress,
  danger,
  chevron = true,
  colors,
}) => (
  <Pressable
    style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
    onPress={onPress}
  >
    <View style={[styles.rowIcon, { backgroundColor: danger ? colors.danger + "15" : colors.primary + "10" }]}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textMuted }]}>{value}</Text>}
    </View>
    {chevron && <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />}
  </Pressable>
);

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; colors: any }> = ({
  title,
  children,
  colors,
}) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
    <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  </View>
);

export const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ProfileStackParamList & RootStackParamList>>();
  // Settings is a sheet iOS will not show the tour over, so it closes first and the tour follows.
  const reopen = (which: "tour" | "whatsNew") => {
    (navigation as any).getParent?.()?.goBack?.() ?? (navigation as any).goBack();
    setTimeout(() => {
      const store = useOnboardingStore.getState();
      if (which === "tour") store.openTour();
      else store.openWhatsNew();
    }, 450);
  };
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const waiting = useOutboxStore((state) => state.jobs);
  const lastSyncedAt = useOutboxStore((state) => state.lastSyncedAt);
  const isSyncing = useOutboxStore((state) => state.isFlushing);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const syncNow = async () => {
    setIsRefreshing(true);
    try {
      // Send what is waiting first, so a refresh cannot pull the old numbers back over it.
      const { sent, stalled } = await flushOutbox({ force: true });
      await refreshEverything();

      if (stalled) {
        const blocked = useOutboxStore.getState().jobs[0];
        dialog.alert({
          title: "Still waiting to sync",
          message: blocked?.lastError
            ? `${blocked.description} could not be sent. The app will keep trying whenever it has a connection.`
            : "The server could not be reached. The app will keep trying whenever it has a connection.",
          tone: "danger",
          icon: "cloud-off-outline",
          confirmLabel: "Got it",
        });
        return;
      }

      dialog.alert({
        title: sent ? "Everything is synced" : "Up to date",
        message: sent
          ? `${sent} ${sent === 1 ? "change" : "changes"} sent, and this device has the latest from your other ones.`
          : "Nothing was waiting, and this device now has the latest from your other ones.",
        tone: "success",
        icon: "cloud-check-outline",
        confirmLabel: "Done",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  const subscription = useSubscriptionAccess();
  const { user, resetPassword, resendEmailVerification, deleteAccount, resetProfile, isLoading } = useAuthStore();

  // Reflects the actual OS-level icon rather than assuming - a reinstall or a restored backup can
  // leave this out of step with what the picker last set.
  const [appIcon, setAppIcon] = useState<string | null>(null);
  useEffect(() => {
    if (supportsAlternateIcons) setAppIcon(getAppIconName());
  }, []);
  const togglePremiumIcon = async () => {
    const next = appIcon === "Premium" ? null : "Premium";
    await setAlternateAppIcon(next);
    setAppIcon(next);
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteCodeInput, setDeleteCodeInput] = useState("");

  const openCustomerCenter = async () => {
    if (!isBillingConfigured()) {
      dialog.alert({
        title: "Subscription management unavailable",
        message: "This build cannot open subscription settings. You can manage your plan in your app store account.",
        icon: "credit-card-off-outline",
      });
      return;
    }

    try {
      await presentCustomerCenter();
    } catch {
      dialog.confirm({
        title: "Could not open subscription settings",
        message: "The subscription screen did not load. You can manage your plan in your app store account instead.",
        icon: "credit-card-outline",
        confirmLabel: "Open store subscriptions",
        cancelLabel: "Close",
        onConfirm: () => {
          void openNativeSubscriptionSettings().catch(() => {
            dialog.alert({
              title: "Could not open store subscriptions",
              message: "Open your device settings and manage your subscription from there.",
              icon: "credit-card-off-outline",
            });
          });
        },
      });
    }
  };

  const handlePasswordReset = async () => {
    const email = user?.email?.trim();
    if (!email) {
      dialog.alert({
        title: "No email on this account",
        message:
          "There is no email address on your profile, so we cannot send a reset link. Get in touch with support and we will sort it out.",
        icon: "email-alert-outline",
      });
      return;
    }

    try {
      await resetPassword(email);
      dialog.alert({
        title: "Check your inbox",
        message: `We have sent a link to reset your password to ${email}. It can take a minute to arrive.`,
        tone: "success",
        icon: "email-check-outline",
      });
    } catch (error: any) {
      dialog.alert({
        title: "Could not send the reset email",
        message: getAuthEmailActionErrorMessage(error),
        tone: "danger",
        icon: "alert-outline",
      });
    }
  };

  const handleResendVerification = async () => {
    const email = user?.email?.trim();
    if (!email) {
      dialog.alert({
        title: "No email on this account",
        message:
          "There is no email address on your profile, so we cannot send a verification link. Get in touch with support and we will sort it out.",
        icon: "email-alert-outline",
      });
      return;
    }

    try {
      await resendEmailVerification(email);
      dialog.alert({
        title: "Verification email sent",
        message: `Open the link we sent to ${email} to confirm your address.`,
        tone: "success",
        icon: "email-check-outline",
      });
    } catch (error: any) {
      dialog.alert({
        title: "Could not send the verification email",
        message: getAuthEmailActionErrorMessage(error),
        tone: "danger",
        icon: "alert-outline",
      });
    }
  };

  const openUrl = async (url: string, label: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch {
      dialog.alert({
        title: `Could not open ${label}`,
        message: "Check your connection and try again.",
        icon: "wifi-off",
      });
    }
  };

  const openSupportEmail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=Snookered%20account%20support`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch {
      dialog.alert({
        title: "Could not open your email app",
        message: `Write to us at ${SUPPORT_EMAIL} and we will get back to you.`,
        icon: "email-off-outline",
      });
    }
  };

  // Reset Profile Flow
  const startResetFlow = () => {
    setResetCode(createChallenge());
    setResetCodeInput("");
    setShowResetModal(true);
  };

  const handleResetFromModal = () => {
    setShowResetModal(false);
    setShowResetConfirm(true);
  };

  const confirmResetProfile = async () => {
    try {
      await resetProfile();
      setShowResetConfirm(false);
      // Reset navigation stack to Main tab
      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch {
      dialog.alert({
        title: "Could not reset your profile",
        message: "Nothing has been changed. Check your connection and try again.",
        tone: "danger",
        icon: "alert-outline",
      });
    }
  };

  // Delete Account Flow
  const startDeleteFlow = () => {
    setDeleteCode(createChallenge());
    setDeleteCodeInput("");
    setShowDeleteModal(true);
  };

  const handleDeleteFromModal = () => {
    setShowDeleteModal(false);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
    } catch {
      dialog.alert({
        title: "Could not delete your account",
        message: "Your account is still here. Check your connection and try again.",
        tone: "danger",
        icon: "alert-outline",
      });
    }
  };

  const matchesUsed = subscription.usage.matches;
  const matchesLimit = subscription.limits.matchesPerPeriod;
  const aiUsed = subscription.usage.aiAnalyses;
  const aiLimit = subscription.limits.aiAnalysesPerPeriod;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 90}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Subscription Section */}
        <AppCard style={styles.subscriptionCard}>
          <View style={styles.planHeader}>
            <View style={styles.planInfo}>
              <Text style={[styles.planLabel, { color: colors.textMuted }]}>Current Plan</Text>
              <Text style={[styles.planName, { color: colors.text }]}>{subscription.tierLabel}</Text>
            </View>
            {subscription.tier !== "free" && (
              <View style={[styles.planBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
                <MaterialCommunityIcons name="crown" size={14} color={colors.primary} />
                <Text style={[styles.planBadgeText, { color: colors.primary }]}>PRO</Text>
              </View>
            )}
          </View>

          {/* Usage Metrics */}
          <View style={styles.usageSection}>
            <View style={styles.usageRow}>
              <View style={styles.usageItem}>
                <Text style={[styles.usageLabel, { color: colors.textMuted }]}>Matches</Text>
                <Text style={[styles.usageValue, { color: colors.text }]}>
                  {matchesUsed}
                  {matchesLimit !== null ? ` / ${matchesLimit}` : ""}
                </Text>
                {matchesLimit !== null && (
                  <View style={[styles.usageBar, { backgroundColor: colors.surfaceMuted }]}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          backgroundColor: matchesUsed / matchesLimit > 0.9 ? colors.danger : colors.primary,
                          width: `${Math.min(100, (matchesUsed / matchesLimit) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
              <View style={styles.usageItem}>
                <Text style={[styles.usageLabel, { color: colors.textMuted }]}>AI Analyses</Text>
                <Text style={[styles.usageValue, { color: colors.text }]}>
                  {aiUsed}
                  {aiLimit !== null ? ` / ${aiLimit}` : ""}
                </Text>
                {aiLimit !== null && (
                  <View style={[styles.usageBar, { backgroundColor: colors.surfaceMuted }]}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          backgroundColor: aiUsed / aiLimit > 0.9 ? colors.danger : colors.primary,
                          width: `${Math.min(100, (aiUsed / aiLimit) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            </View>
            {subscription.tier === "free" && (
              <Text style={[styles.upgradeHint, { color: colors.textMuted }]}>
                Upgrade for unlimited matches and more features
              </Text>
            )}
          </View>

          <View style={styles.subscriptionActions}>
            <AppButton label="View Plans" onPress={() => navigation.navigate("SubscriptionPlans")} />
            {subscription.tier !== "free" && (
              <AppButton label="Manage" variant="secondary" onPress={openCustomerCenter} />
            )}
          </View>
        </AppCard>

        {/* Account Section */}
        <SettingsSection title="ACCOUNT" colors={colors}>
          <SettingsRow
            icon="email"
            label="Email"
            value={user?.email ?? "Not available"}
            onPress={() => {}}
            chevron={false}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow icon="lock" label="Reset Password" onPress={handlePasswordReset} colors={colors} />
        </SettingsSection>

        {subscription.tier !== "free" && supportsAlternateIcons ? (
          <SettingsSection title="APP ICON" colors={colors}>
            <SettingsRow
              icon="star-four-points-outline"
              label="Premium icon"
              value={appIcon === "Premium" ? "On" : "Off"}
              onPress={() => void togglePremiumIcon()}
              chevron={false}
              colors={colors}
            />
          </SettingsSection>
        ) : null}

        {/* Sync Section */}
        <SettingsSection title="SYNC" colors={colors}>
          <SettingsRow
            icon={waiting.length ? "cloud-upload-outline" : "cloud-check-outline"}
            label={
              waiting.length
                ? `${waiting.length} ${waiting.length === 1 ? "change" : "changes"} waiting`
                : "Everything is synced"
            }
            value={isSyncing || isRefreshing ? "Syncing..." : sinceLabel(lastSyncedAt)}
            onPress={() => void syncNow()}
            colors={colors}
          />
          {waiting.length ? (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.syncDetail}>
                {waiting.slice(0, 3).map((job) => (
                  <Text key={job.id} style={[styles.syncDetailText, { color: colors.textMuted }]} numberOfLines={1}>
                    {job.description}
                    {job.attempts ? ` - tried ${job.attempts} ${job.attempts === 1 ? "time" : "times"}` : ""}
                  </Text>
                ))}
                {waiting.length > 3 ? (
                  <Text style={[styles.syncDetailText, { color: colors.textMuted }]}>
                    and {waiting.length - 3} more
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="SUPPORT & POLICIES" colors={colors}>
          <SettingsRow icon="map-marker-path" label="Take the tour" onPress={() => reopen("tour")} colors={colors} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="star-four-points-outline"
            label="What's new"
            value={`Version ${APP_VERSION}`}
            onPress={() => reopen("whatsNew")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="shield-check"
            label="Privacy Policy"
            onPress={() => void openUrl(PRIVACY_URL, "Privacy Policy")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="file-document"
            label="Terms of Use"
            onPress={() => void openUrl(TERMS_URL, "Terms of Use")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="help-circle"
            label="Contact Support"
            onPress={() => void openSupportEmail()}
            colors={colors}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="DATA MANAGEMENT" colors={colors}>
          <SettingsRow icon="refresh" label="Reset Profile" onPress={startResetFlow} colors={colors} />
        </SettingsSection>

        <SettingsSection title="DANGER ZONE" colors={colors}>
          <SettingsRow icon="account-remove" label="Delete Account" onPress={startDeleteFlow} danger colors={colors} />
        </SettingsSection>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>Snookered v{APP_VERSION}</Text>

        <View style={{ height: Math.max(80, insets.bottom + 40) }} />
      </ScrollView>

      {/* Reset Profile Initial Modal */}
      <ConfirmModal
        visible={showResetModal}
        title="Reset your profile?"
        message="Every match, practice session and bit of progress goes. Your account and login stay as they are."
        confirmLabel="Continue"
        cancelLabel="Keep everything"
        icon="refresh"
        onConfirm={handleResetFromModal}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Reset Profile Code Confirmation */}
      <CodeConfirmModal
        visible={showResetConfirm}
        title="Confirm the reset"
        message="Type the code below and your profile data is wiped for good."
        code={resetCode}
        confirmLabel="Reset profile"
        cancelLabel="Cancel"
        icon="alert-circle"
        danger
        loading={isLoading}
        onCodeChange={setResetCodeInput}
        onConfirm={confirmResetProfile}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Delete Account Initial Modal */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Delete your account?"
        message="Your account and everything in it goes for good. This cannot be undone."
        confirmLabel="Continue"
        cancelLabel="Keep my account"
        icon="account-remove"
        danger
        onConfirm={handleDeleteFromModal}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Delete Account Code Confirmation */}
      <CodeConfirmModal
        visible={showDeleteConfirm}
        title="Delete account"
        message="Type the code below and your account is deleted for good."
        code={deleteCode}
        confirmLabel="Delete account"
        cancelLabel="Cancel"
        icon="alert"
        danger
        loading={isLoading}
        onCodeChange={setDeleteCodeInput}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 20 },

  // Subscription Card
  subscriptionCard: { marginBottom: 20 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  planInfo: { flex: 1 },
  planLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  planName: { fontSize: 22, fontWeight: "800" },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  usageSection: { marginBottom: 16 },
  usageRow: { flexDirection: "row", gap: 20 },
  usageItem: { flex: 1 },
  usageLabel: { fontSize: 12, marginBottom: 4 },
  usageValue: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  usageBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  usageBarFill: { height: "100%", borderRadius: 3 },
  upgradeHint: { fontSize: 12, marginTop: 12, textAlign: "center" },
  subscriptionActions: { flexDirection: "row", gap: 10, marginTop: 4 },

  // Settings Sections
  section: { marginBottom: 20 },
  syncDetail: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 4,
  },
  syncDetailText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionContent: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },

  // Settings Rows
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowValue: { fontSize: 13, marginTop: 2 },
  rowDivider: { height: 1, marginHorizontal: 14 },

  footerText: { fontSize: 12, textAlign: "center", marginTop: 20 },
});
