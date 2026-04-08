import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { adapty, type AdaptyPaywall, type AdaptyPaywallProduct, type AdaptyProfile } from "react-native-adapty";
import { supabase } from "../api/supabase";
import type { SubscriptionTier } from "../types";
const ADAPTY_PUBLIC_SDK_KEY = process.env.EXPO_PUBLIC_ADAPTY_PUBLIC_SDK_KEY ?? "";
const ADAPTY_PLACEMENT_ID = process.env.EXPO_PUBLIC_ADAPTY_PLACEMENT_ID ?? "main_subscription";

const PRO_ACCESS_LEVEL_ID = process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL_PRO ?? process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO ?? "SnookerLab Pro";
const HALF_CENTURY_ACCESS_LEVEL_ID =
  process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL_HALF_CENTURY ?? process.env.EXPO_PUBLIC_RC_ENTITLEMENT_HALF_CENTURY ?? "half_century";
const CENTURY_ACCESS_LEVEL_ID =
  process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL_CENTURY ?? process.env.EXPO_PUBLIC_RC_ENTITLEMENT_CENTURY ?? "century";

const PRO_MONTHLY_PRODUCT_ID = process.env.EXPO_PUBLIC_ADAPTY_PRODUCT_MONTHLY ?? process.env.EXPO_PUBLIC_RC_PRODUCT_MONTHLY ?? "monthly";
const HALF_CENTURY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_ADAPTY_PRODUCT_HALF_CENTURY ?? process.env.EXPO_PUBLIC_RC_PRODUCT_HALF_CENTURY ?? "half_century_monthly";
const CENTURY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_ADAPTY_PRODUCT_CENTURY ?? process.env.EXPO_PUBLIC_RC_PRODUCT_CENTURY ?? "century_monthly";

const DEFAULT_HALF_CENTURY_PRICE = process.env.EXPO_PUBLIC_DEFAULT_PRICE_HALF_CENTURY ?? "$3.49";
const DEFAULT_CENTURY_PRICE = process.env.EXPO_PUBLIC_DEFAULT_PRICE_CENTURY ?? "$5.00";
type BillingOfferings = {
  paywall: AdaptyPaywall;
  products: AdaptyPaywallProduct[];
};

let configuredForUserId: string | null = null;
let isAdaptyActivated = false;
let activationPromise: Promise<void> | null = null;
let adaptyActivationCheck: Promise<boolean> | null = null;

const isActivateOnceError = (error: unknown) => {
  const message = String((error as any)?.message ?? "").toLowerCase();
  const code = String((error as any)?.adaptyCode ?? "").toLowerCase();
  const errorCode = String((error as any)?.code ?? "").toLowerCase();
  return (
    message.includes("activateonceerror") ||
    message.includes("3005") ||
    message.includes("3305") ||
    code === "3005" ||
    code === "3305"||
    errorCode === "3005" ||
    errorCode === "3305"
  );
};

const IS_EXPO_GO = Constants.appOwnership === "expo";

const getApiKey = () => ADAPTY_PUBLIC_SDK_KEY;

export const getBillingUnavailableReason = () => {
  if (IS_EXPO_GO) return "Expo Go preview mode does not support native Adapty purchases.";
  if (!getApiKey()) return "Adapty public SDK key is missing for this build.";
  return null;
};

export const isBillingConfigured = () => !getBillingUnavailableReason();

export const isUsingRevenueCatTestKey = () => !getApiKey().startsWith("public_live_");

export const initBilling = async (appUserId: string) => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }

  if (activationPromise) {
    await activationPromise;
  }

  if (adaptyActivationCheck) {
    await adaptyActivationCheck;
  }

  if (!isAdaptyActivated) {
    adaptyActivationCheck = (async () => {
      try {
        const activated = await adapty.isActivated();
        return activated;
      } catch {
        return false;
      }
    })();

    try {
      isAdaptyActivated = await adaptyActivationCheck;
    } finally {
      adaptyActivationCheck = null;
    }
  }

  if (isAdaptyActivated && configuredForUserId === appUserId) {
    return;
  }

  if (!isAdaptyActivated) {
    activationPromise = (async () => {
      try {
        await adapty.activate(getApiKey(), { customerUserId: appUserId });
      } catch (error) {
        if (isActivateOnceError(error)) {
          isAdaptyActivated = true;
          return;
        }
        throw error;
      }
    })();

    try {
      await activationPromise;
    } finally {
      activationPromise = null;
    }

    isAdaptyActivated = true;
    configuredForUserId = appUserId;
    return;
  }

  if (configuredForUserId !== appUserId) {
    await adapty.identify(appUserId);
    configuredForUserId = appUserId;
  }
};

export const logoutBilling = async () => {
  configuredForUserId = null;
  if (!isAdaptyActivated) return;
  try {
    await adapty.logout();
  } catch {
    // Ignore logout failures to avoid blocking sign-out.
  }
};

export const fetchCurrentOfferings = async (): Promise<BillingOfferings> => {
  const paywall = await adapty.getPaywall(ADAPTY_PLACEMENT_ID);
  const products = await adapty.getPaywallProducts(paywall);
  return { paywall, products };
};

export const getBillingCustomerInfo = async (): Promise<AdaptyProfile> => {
  return adapty.getProfile();
};

export const addBillingCustomerInfoListener = (listener: (profile: AdaptyProfile) => void) => {
  const subscription = adapty.addEventListener("onLatestProfileLoad", listener);
  return () => {
    subscription.remove();
  };
};

const findProductForTier = (tier: Exclude<SubscriptionTier, "free">, offerings: BillingOfferings) => {
  const allProducts = offerings.products;

  const productHint =
    tier === "half_century" ? HALF_CENTURY_PRODUCT_ID : tier === "century" ? CENTURY_PRODUCT_ID : PRO_MONTHLY_PRODUCT_ID;

  const explicit = allProducts.find((item) => item.vendorProductId === productHint);
  if (explicit) return explicit;

  const token = tier === "half_century" ? "half" : tier === "century" ? "century" : "monthly";
  const fallbackByToken = allProducts.find((item) => item.vendorProductId.toLowerCase().includes(token));
  if (fallbackByToken) return fallbackByToken;

  return null;
};

export const purchaseTierMonthly = async (tier: Exclude<SubscriptionTier, "free">, offerings: BillingOfferings) => {
  const product = findProductForTier(tier, offerings);
  if (!product) {
    throw new Error(`No product found for tier: ${tier}. Check Adapty placement and product IDs.`);
  }

  const result = await adapty.makePurchase(product);

  if (result.type === "success") return result.profile;
  if (result.type === "user_cancelled") {
    const cancelError = new Error("Purchase cancelled by user") as Error & { userCancelled?: boolean };
    cancelError.userCancelled = true;
    throw cancelError;
  }

  throw new Error("Purchase is pending. Please verify the subscription status in a moment.");
};

export const getTierPriceText = (tier: Exclude<SubscriptionTier, "free">, offerings: BillingOfferings | null) => {
  if (offerings) {
    const product = findProductForTier(tier, offerings);
    if (product?.price?.localizedString) {
      return product.price.localizedString;
    }
  }
  if (tier === "half_century") return DEFAULT_HALF_CENTURY_PRICE;
  if (tier === "century") return DEFAULT_CENTURY_PRICE;
  return null;
};

export const restoreBillingPurchases = async () => {
  return adapty.restorePurchases();
};

export const hasProEntitlement = (profile: AdaptyProfile): boolean => {
  return tierFromCustomerInfo(profile) !== "free";
};

export const tierFromCustomerInfo = (profile: AdaptyProfile): SubscriptionTier => {
  const activeAccessLevels = Object.values(profile.accessLevels ?? {}).filter((level) => level.isActive);

  if (profile.accessLevels?.[CENTURY_ACCESS_LEVEL_ID]?.isActive || profile.accessLevels?.[PRO_ACCESS_LEVEL_ID]?.isActive) {
    return "century";
  }
  if (profile.accessLevels?.[HALF_CENTURY_ACCESS_LEVEL_ID]?.isActive) {
    return "half_century";
  }

  const accessLevelTokens = activeAccessLevels.map((level) => `${level.id} ${level.vendorProductId}`.toLowerCase());

  if (accessLevelTokens.some((value) => value.includes("century") || value.includes("snookerlab") || value.includes("pro"))) {
    return "century";
  }
  if (accessLevelTokens.some((value) => value.includes("half") || value.includes("fifty"))) {
    return "half_century";
  }

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
  throw new Error("Adapty paywall UI is not wired yet in this build.");
};

export const presentProPaywall = async () => {
  throw new Error("Adapty paywall UI is not wired yet in this build.");
};

export const presentCustomerCenter = async () => {
  return openNativeSubscriptionSettings();
};

export const openNativeSubscriptionSettings = async () => {
  const url =
    Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("Could not open subscription settings URL");
  await Linking.openURL(url);
};
