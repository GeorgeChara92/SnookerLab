import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesError, type PurchasesOfferings, type PurchasesPackage } from "react-native-purchases";
import { supabase } from "../api/supabase";
import type { SubscriptionTier } from "../types";
const RC_IOS_PUBLIC_SDK_KEY = process.env.EXPO_PUBLIC_RC_IOS_PUBLIC_SDK_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const RC_ANDROID_PUBLIC_SDK_KEY =
  process.env.EXPO_PUBLIC_RC_ANDROID_PUBLIC_SDK_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
const RC_OFFERING_ID = process.env.EXPO_PUBLIC_RC_OFFERING_ID ?? process.env.EXPO_PUBLIC_ADAPTY_PLACEMENT_ID ?? "default";

const PRO_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO ?? process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL_PRO ?? "SnookerLab Pro";
const HALF_CENTURY_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_HALF_CENTURY ?? process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL_HALF_CENTURY ?? "half_century";
const CENTURY_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_CENTURY ?? process.env.EXPO_PUBLIC_ADAPTY_ACCESS_LEVEL_CENTURY ?? "century";

const PRO_MONTHLY_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_MONTHLY ?? process.env.EXPO_PUBLIC_ADAPTY_PRODUCT_MONTHLY ?? "monthly";
const HALF_CENTURY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_RC_PRODUCT_HALF_CENTURY ?? process.env.EXPO_PUBLIC_ADAPTY_PRODUCT_HALF_CENTURY ?? "half_century_monthly";
const CENTURY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_RC_PRODUCT_CENTURY ?? process.env.EXPO_PUBLIC_ADAPTY_PRODUCT_CENTURY ?? "century_monthly";

const DEFAULT_HALF_CENTURY_PRICE = process.env.EXPO_PUBLIC_DEFAULT_PRICE_HALF_CENTURY ?? "$3.49";
const DEFAULT_CENTURY_PRICE = process.env.EXPO_PUBLIC_DEFAULT_PRICE_CENTURY ?? "$5.00";
type BillingOfferings = {
  current: PurchasesOfferings["current"];
  all: PurchasesOfferings["all"];
  packages: PurchasesPackage[];
};

type PurchaseTierResult = {
  customerInfo: CustomerInfo;
  purchasedProductIdentifier: string;
  selectedProductIdentifier: string;
};

let configuredForUserId: string | null = null;
let isPurchasesConfigured = false;
let configurePromise: Promise<void> | null = null;

const IS_EXPO_GO = Constants.appOwnership === "expo";

const getApiKey = () => {
  if (Platform.OS === "ios") return RC_IOS_PUBLIC_SDK_KEY;
  if (Platform.OS === "android") return RC_ANDROID_PUBLIC_SDK_KEY;
  return "";
};

const asPurchasesError = (error: unknown): PurchasesError | null => {
  if (!error || typeof error !== "object") return null;
  const maybeError = error as Partial<PurchasesError>;
  if (typeof maybeError.code !== "string") return null;
  return error as PurchasesError;
};

const isUserCancelledPurchaseError = (error: unknown) => {
  const purchasesError = asPurchasesError(error);
  if (!purchasesError) return false;
  return purchasesError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
};

const isPendingPurchaseError = (error: unknown) => {
  const purchasesError = asPurchasesError(error);
  if (!purchasesError) return false;
  return purchasesError.code === Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR;
};

const chooseOffering = (offerings: PurchasesOfferings) => {
  if (RC_OFFERING_ID && offerings.all[RC_OFFERING_ID]) {
    return offerings.all[RC_OFFERING_ID];
  }
  return offerings.current;
};

export const getBillingUnavailableReason = () => {
  if (IS_EXPO_GO) return "Expo Go preview mode does not support native RevenueCat purchases.";
  if (!getApiKey()) return "RevenueCat public SDK key is missing for this build.";
  return null;
};

export const isBillingConfigured = () => !getBillingUnavailableReason();

export const isUsingRevenueCatTestKey = () => {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  if (Platform.OS === "ios") return !apiKey.startsWith("appl_");
  if (Platform.OS === "android") return !apiKey.startsWith("goog_") && !apiKey.startsWith("amzn_");

  return false;
};

export const initBilling = async (appUserId: string) => {
  const unavailableReason = getBillingUnavailableReason();
  if (unavailableReason) {
    throw new Error(unavailableReason);
  }

  if (configurePromise) {
    await configurePromise;
  }

  const sdkConfigured = isPurchasesConfigured || (await Purchases.isConfigured().catch(() => false));
  isPurchasesConfigured = sdkConfigured;

  if (!sdkConfigured) {
    configurePromise = (async () => {
      Purchases.configure({ apiKey: getApiKey(), appUserID: appUserId });
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);
      configuredForUserId = appUserId;
      isPurchasesConfigured = true;
    })();

    try {
      await configurePromise;
    } finally {
      configurePromise = null;
    }
    return;
  }

  if (!configuredForUserId) {
    configuredForUserId = await Purchases.getAppUserID().catch(() => null);
  }

  if (configuredForUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredForUserId = appUserId;
  }
};

export const logoutBilling = async () => {
  configuredForUserId = null;
  if (!isPurchasesConfigured) {
    isPurchasesConfigured = await Purchases.isConfigured().catch(() => false);
  }
  if (!isPurchasesConfigured) return;

  try {
    await Purchases.logOut();
  } catch {
    // Ignore logout failures to avoid blocking sign-out.
  }
};

export const fetchCurrentOfferings = async (): Promise<BillingOfferings> => {
  const offerings = await Purchases.getOfferings();
  const current = chooseOffering(offerings);
  return {
    current,
    all: offerings.all,
    packages: current?.availablePackages ?? [],
  };
};

export const getBillingCustomerInfo = async (): Promise<CustomerInfo> => {
  return Purchases.getCustomerInfo();
};

export const addBillingCustomerInfoListener = (listener: (profile: CustomerInfo) => void) => {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
};

const findProductForTier = (tier: Exclude<SubscriptionTier, "free">, offerings: BillingOfferings) => {
  const allPackages = offerings.packages;

  const productHint =
    tier === "half_century" ? HALF_CENTURY_PRODUCT_ID : tier === "century" ? CENTURY_PRODUCT_ID : PRO_MONTHLY_PRODUCT_ID;

  const explicit = allPackages.find((item) => item.product.identifier === productHint || item.identifier === productHint);
  if (explicit) return explicit;

  const token = tier === "half_century" ? "half" : tier === "century" ? "century" : "monthly";
  const fallbackByToken = allPackages.find(
    (item) => item.product.identifier.toLowerCase().includes(token) || item.identifier.toLowerCase().includes(token)
  );
  if (fallbackByToken) return fallbackByToken;

  return null;
};

export const purchaseTierMonthly = async (
  tier: Exclude<SubscriptionTier, "free">,
  offerings: BillingOfferings
): Promise<PurchaseTierResult> => {
  const product = findProductForTier(tier, offerings);
  if (!product) {
    throw new Error(`No product found for tier: ${tier}. Check RevenueCat offering/packages and product IDs.`);
  }

  try {
    const result = await Purchases.purchasePackage(product);
    const synced = await Purchases.syncPurchasesForResult().catch(() => null);
    const latestCustomerInfo = synced?.customerInfo ?? (await Purchases.getCustomerInfo().catch(() => result.customerInfo));
    return {
      customerInfo: latestCustomerInfo,
      purchasedProductIdentifier: result.productIdentifier,
      selectedProductIdentifier: product.product.identifier,
    };
  } catch (error) {
    if (isUserCancelledPurchaseError(error)) {
      const cancelError = new Error("Purchase cancelled by user") as Error & { userCancelled?: boolean };
      cancelError.userCancelled = true;
      throw cancelError;
    }

    if (isPendingPurchaseError(error)) {
      throw new Error("Purchase is pending. Please verify the subscription status in a moment.");
    }

    throw error;
  }
};

export const getTierPriceText = (tier: Exclude<SubscriptionTier, "free">, offerings: BillingOfferings | null) => {
  if (offerings) {
    const product = findProductForTier(tier, offerings);
    if (product?.product?.priceString) {
      return product.product.priceString;
    }
  }
  if (tier === "half_century") return DEFAULT_HALF_CENTURY_PRICE;
  if (tier === "century") return DEFAULT_CENTURY_PRICE;
  return null;
};

export const restoreBillingPurchases = async () => {
  return Purchases.restorePurchases();
};

export const hasProEntitlement = (profile: CustomerInfo): boolean => {
  return tierFromCustomerInfo(profile) !== "free";
};

export const tierFromCustomerInfo = (profile: CustomerInfo): SubscriptionTier => {
  const activeProducts = (profile.activeSubscriptions ?? []).map((value) => value.toLowerCase());

  const centuryProductTokens = [CENTURY_PRODUCT_ID, PRO_MONTHLY_PRODUCT_ID].map((value) => value.toLowerCase());
  if (centuryProductTokens.some((value) => activeProducts.includes(value))) {
    return "century";
  }

  const halfCenturyProductToken = HALF_CENTURY_PRODUCT_ID.toLowerCase();
  if (activeProducts.includes(halfCenturyProductToken)) {
    return "half_century";
  }

  const activeEntitlements = profile.entitlements.active ?? {};
  const activeEntitlementValues = Object.values(activeEntitlements);

  if (activeEntitlements[CENTURY_ENTITLEMENT_ID] || activeEntitlements[PRO_ENTITLEMENT_ID]) {
    return "century";
  }
  if (activeEntitlements[HALF_CENTURY_ENTITLEMENT_ID]) {
    return "half_century";
  }

  const entitlementTokens = activeEntitlementValues.map((item) => `${item.identifier} ${item.productIdentifier}`.toLowerCase());

  if (entitlementTokens.some((value) => value.includes("century") || value.includes("snookerlab") || value.includes("pro"))) {
    return "century";
  }
  if (entitlementTokens.some((value) => value.includes("half") || value.includes("fifty"))) {
    return "half_century";
  }

  return "free";
};

export const resolveTierFromPurchaseResult = (
  result: PurchaseTierResult,
  requestedTier: Exclude<SubscriptionTier, "free">
): SubscriptionTier => {
  if (requestedTier === "century") {
    const centuryProducts = [CENTURY_PRODUCT_ID, PRO_MONTHLY_PRODUCT_ID].map((value) => value.toLowerCase());
    const purchased = result.purchasedProductIdentifier.toLowerCase();
    const selected = result.selectedProductIdentifier.toLowerCase();
    if (centuryProducts.includes(purchased) || centuryProducts.includes(selected)) {
      return "century";
    }
  }

  const resolvedFromCustomer = tierFromCustomerInfo(result.customerInfo);
  if (resolvedFromCustomer === "century") return "century";
  if (resolvedFromCustomer === "half_century") {
    if (result.purchasedProductIdentifier === CENTURY_PRODUCT_ID || result.purchasedProductIdentifier === PRO_MONTHLY_PRODUCT_ID) {
      return "century";
    }
    return "half_century";
  }

  if (result.purchasedProductIdentifier === CENTURY_PRODUCT_ID || result.purchasedProductIdentifier === PRO_MONTHLY_PRODUCT_ID) {
    return "century";
  }
  if (result.purchasedProductIdentifier === HALF_CENTURY_PRODUCT_ID) {
    return "half_century";
  }

  return requestedTier;
};

/**
 * Asks the server to re-check this user's entitlements with RevenueCat and store the result.
 * The tier lives in app_metadata, which the client cannot write, so this is the only way it
 * changes. Returns the refreshed auth user (or null if the session has gone).
 */
export const syncSubscriptionWithServer = async () => {
  const { error } = await supabase.functions.invoke("sync-subscription", { body: {} });
  if (error) throw error;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  return data.user;
};

export const presentProPaywallIfNeeded = async () => {
  throw new Error("RevenueCat paywall UI is not wired yet in this build.");
};

export const presentProPaywall = async () => {
  throw new Error("RevenueCat paywall UI is not wired yet in this build.");
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
