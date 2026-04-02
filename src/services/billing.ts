import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOfferings } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { supabase } from "../api/supabase";
import type { SubscriptionTier } from "../types";

const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "";

const PRO_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO ?? "SnookerLab Pro";
const PRO_MONTHLY_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_MONTHLY ?? "monthly";

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

const findMonthlyPackage = (offerings: PurchasesOfferings) => {
  const allPackages = offerings.current?.availablePackages ?? [];

  const explicit = allPackages.find(
    (pkg) => pkg.product.identifier === PRO_MONTHLY_PRODUCT_ID || pkg.identifier === PRO_MONTHLY_PRODUCT_ID
  );
  if (explicit) return explicit;

  return (
    allPackages.find((pkg) => {
      const productId = pkg.product.identifier.toLowerCase();
      const packageId = pkg.identifier.toLowerCase();
      return (
        productId.includes("monthly") ||
        packageId.includes("monthly") ||
        productId.includes("pro") ||
        packageId.includes("pro")
      );
    }) ?? null
  );
};

export const purchaseProMonthly = async (offerings: PurchasesOfferings) => {
  const monthlyPackage = findMonthlyPackage(offerings);
  if (!monthlyPackage) {
    throw new Error("No monthly package found in current RevenueCat offering");
  }

  const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
  return customerInfo;
};

export const restoreBillingPurchases = async () => {
  return Purchases.restorePurchases();
};

export const hasProEntitlement = (customerInfo: CustomerInfo): boolean => {
  const activeEntitlements = customerInfo.entitlements.active;
  if (activeEntitlements[PRO_ENTITLEMENT_ID]) return true;

  const keys = Object.keys(activeEntitlements).map((key) => key.toLowerCase());
  return keys.some((key) => key.includes("snookerlab") || key.includes("pro"));
};

export const tierFromCustomerInfo = (customerInfo: CustomerInfo): SubscriptionTier => {
  return hasProEntitlement(customerInfo) ? "century" : "free";
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
  return RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID });
};

export const presentProPaywall = async () => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }
  return RevenueCatUI.presentPaywall();
};

export const presentCustomerCenter = async () => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }
  return RevenueCatUI.presentCustomerCenter();
};
