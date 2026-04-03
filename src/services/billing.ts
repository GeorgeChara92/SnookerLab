import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOfferings } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { supabase } from "../api/supabase";
import type { SubscriptionTier } from "../types";

const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "";

const PRO_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO ?? "SnookerLab Pro";
const HALF_CENTURY_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_HALF_CENTURY ?? "half_century";
const CENTURY_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_CENTURY ?? "century";
const PRO_MONTHLY_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_MONTHLY ?? "monthly";
const HALF_CENTURY_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_HALF_CENTURY ?? "half_century_monthly";
const CENTURY_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_CENTURY ?? "century_monthly";

let configuredForUserId: string | null = null;
const IS_EXPO_GO = Constants.appOwnership === "expo";

const getApiKey = () => {
  if (Platform.OS === "ios") return RC_IOS_KEY;
  if (Platform.OS === "android") return RC_ANDROID_KEY;
  return "";
};

export const getBillingUnavailableReason = () => {
  if (IS_EXPO_GO) return "Expo Go preview mode does not support native RevenueCat paywall/purchases.";
  if (!getApiKey()) return "RevenueCat API key missing for this platform.";
  return null;
};

export const isBillingConfigured = () => !getBillingUnavailableReason();

export const isUsingRevenueCatTestKey = () => getApiKey().startsWith("test_");

export const initBilling = async (appUserId: string) => {
  const apiKey = getApiKey();
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }

  if (!apiKey) {
    throw new Error("RevenueCat API key missing for this platform");
  }

  if (configuredForUserId === appUserId) return;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  await Purchases.configure({ apiKey, appUserID: appUserId });
  configuredForUserId = appUserId;
};

export const logoutBilling = async () => {
  configuredForUserId = null;
  try {
    await Purchases.logOut();
  } catch {
    // Ignore logout failures to avoid blocking sign-out.
  }
};

export const fetchCurrentOfferings = async (): Promise<PurchasesOfferings> => {
  return Purchases.getOfferings();
};

export const getBillingCustomerInfo = async (): Promise<CustomerInfo> => {
  return Purchases.getCustomerInfo();
};

export const addBillingCustomerInfoListener = (listener: (customerInfo: CustomerInfo) => void) => {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
};

const findPackageForTier = (tier: Exclude<SubscriptionTier, "free">, offerings: PurchasesOfferings) => {
  const allPackages = offerings.current?.availablePackages ?? [];

  const productHint =
    tier === "half_century" ? HALF_CENTURY_PRODUCT_ID : tier === "century" ? CENTURY_PRODUCT_ID : PRO_MONTHLY_PRODUCT_ID;

  const explicit = allPackages.find((pkg) => pkg.product.identifier === productHint || pkg.identifier === productHint);
  if (explicit) return explicit;

  const token = tier === "half_century" ? "half" : tier === "century" ? "century" : "monthly";
  const fallbackByToken = allPackages.find((pkg) => {
    const productId = pkg.product.identifier.toLowerCase();
    const packageId = pkg.identifier.toLowerCase();
    return productId.includes(token) || packageId.includes(token);
  });
  if (fallbackByToken) return fallbackByToken;

  return null;
};

export const purchaseTierMonthly = async (tier: Exclude<SubscriptionTier, "free">, offerings: PurchasesOfferings) => {
  const monthlyPackage = findPackageForTier(tier, offerings);
  if (!monthlyPackage) {
    throw new Error(`No monthly package found for tier: ${tier}`);
  }

  const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
  return customerInfo;
};

export const getTierPriceText = (tier: Exclude<SubscriptionTier, "free">, offerings: PurchasesOfferings | null) => {
  if (!offerings) return null;
  const pkg = findPackageForTier(tier, offerings);
  return pkg?.product?.priceString ?? null;
};

export const restoreBillingPurchases = async () => {
  return Purchases.restorePurchases();
};

export const hasProEntitlement = (customerInfo: CustomerInfo): boolean => {
  return tierFromCustomerInfo(customerInfo) !== "free";
};

export const tierFromCustomerInfo = (customerInfo: CustomerInfo): SubscriptionTier => {
  const activeEntitlements = customerInfo.entitlements.active;
  if (activeEntitlements[CENTURY_ENTITLEMENT_ID] || activeEntitlements[PRO_ENTITLEMENT_ID]) return "century";
  if (activeEntitlements[HALF_CENTURY_ENTITLEMENT_ID]) return "half_century";

  const keys = Object.keys(activeEntitlements).map((key) => key.toLowerCase());
  if (keys.some((key) => key.includes("century") || key.includes("snookerlab") || key.includes("pro"))) return "century";
  if (keys.some((key) => key.includes("half") || key.includes("fifty"))) return "half_century";
  return "free";
};

export const syncTierToSupabaseUser = async (tier: SubscriptionTier) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase.auth.updateUser({
    data: {
      subscription_tier: tier,
      subscription_anchor_date: nowIso,
    },
  });
  if (error) throw error;
  return data.user;
};

export const presentProPaywallIfNeeded = async () => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }
  const result = await Promise.race([
    RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Paywall timed out")), 15000)),
  ]);
  return result;
};

export const presentProPaywall = async () => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }
  const result = await Promise.race([
    RevenueCatUI.presentPaywall(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Paywall timed out")), 15000)),
  ]);
  return result;
};

export const presentCustomerCenter = async () => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }
  if (isUsingRevenueCatTestKey()) {
    throw new Error("Subscription management is unavailable in this test build.");
  }
  const result = await Promise.race([
    RevenueCatUI.presentCustomerCenter(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Customer Center timed out")), 30000)),
  ]);
  return result;
};

export const openNativeSubscriptionSettings = async () => {
  const url = Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("Could not open subscription settings URL");
  await Linking.openURL(url);
};
