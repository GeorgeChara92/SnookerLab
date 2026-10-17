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
const HALF_CENTURY_ANNUAL_PRODUCT_ID =
  process.env.EXPO_PUBLIC_RC_PRODUCT_HALF_CENTURY_ANNUAL ?? "annual_half_century";
const CENTURY_ANNUAL_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_CENTURY_ANNUAL ?? "annual_century";

export type BillingPeriod = "monthly" | "annual";

export type BillingOfferings = {
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

/**
 * Signing out of Snookered deliberately does NOT sign RevenueCat out. Purchases.logOut() switches
 * to an anonymous RevenueCat user, and because a subscription belongs to the phone's Apple ID,
 * RevenueCat then moves it onto that anonymous user - so signing back in found no plans until
 * "Restore purchases" moved them back. Staying on the last account, the next sign-in simply logs
 * in (initBilling) as whoever signs in: the same person keeps their plans, someone else on this
 * phone gets the plan the phone's Apple ID paid for, exactly as a restore would.
 */
export const logoutBilling = async () => {
  configuredForUserId = null;
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

const findProductForTier = (
  tier: Exclude<SubscriptionTier, "free">,
  period: BillingPeriod,
  offerings: BillingOfferings
) => {
  const allPackages = offerings.packages;

  const productHint =
    period === "annual"
      ? tier === "half_century"
        ? HALF_CENTURY_ANNUAL_PRODUCT_ID
        : CENTURY_ANNUAL_PRODUCT_ID
      : tier === "half_century"
        ? HALF_CENTURY_PRODUCT_ID
        : tier === "century"
          ? CENTURY_PRODUCT_ID
          : PRO_MONTHLY_PRODUCT_ID;

  const explicit = allPackages.find((item) => item.product.identifier === productHint || item.identifier === productHint);
  if (explicit) return explicit;

  const token = tier === "half_century" ? "half" : "century";
  const isoPeriod = period === "annual" ? "P1Y" : "P1M";
  const fallbackByTokenAndPeriod = allPackages.find((item) => {
    const haystack = `${item.product.identifier} ${item.identifier}`.toLowerCase();
    return haystack.includes(token) && (item.product as any)?.subscriptionPeriod === isoPeriod;
  });
  if (fallbackByTokenAndPeriod) return fallbackByTokenAndPeriod;

  if (period === "monthly") {
    const looseToken = tier === "century" ? "century" : tier === "half_century" ? "half" : "monthly";
    const fallbackByToken = allPackages.find(
      (item) => item.product.identifier.toLowerCase().includes(looseToken) || item.identifier.toLowerCase().includes(looseToken)
    );
    if (fallbackByToken) return fallbackByToken;
  }

  return null;
};

/** Buys a package already found in the catalog, normalising RevenueCat's own errors into the
 * shape every purchase screen expects (a cancelled purchase is not a failure to report). */
const buyPackage = async (product: PurchasesPackage): Promise<PurchaseTierResult> => {
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

export const purchaseTier = async (
  tier: Exclude<SubscriptionTier, "free">,
  period: BillingPeriod,
  offerings: BillingOfferings
): Promise<PurchaseTierResult> => {
  const product = findProductForTier(tier, period, offerings);
  if (!product) {
    throw new Error(`No product found for tier: ${tier} (${period}). Check RevenueCat offering/packages and product IDs.`);
  }
  return buyPackage(product);
};

export type TierOffer = {
  tier: Exclude<SubscriptionTier, "free">;
  period: BillingPeriod;
  productId: string;
  /** Localised price straight from the store, e.g. "£5.00". */
  priceText: string;
  /** Numeric price in the store's local currency, for working out savings. */
  price: number;
  /** How often it bills, from the store's own period, e.g. "monthly". */
  periodLabel: string | null;
};

/** ISO 8601 subscription periods as the stores report them ("P1M"). */
const periodLabelFrom = (period?: string | null) => {
  switch (period) {
    case "P1W":
      return "weekly";
    case "P1M":
      return "monthly";
    case "P3M":
      return "quarterly";
    case "P6M":
      return "every six months";
    case "P1Y":
      return "yearly";
    default:
      return null;
  }
};

/**
 * What the store actually sells for a tier. Returns null when the offering has not loaded or
 * has no product for that tier: the UI then says so instead of showing an invented price.
 */
export const getTierOffer = (
  tier: Exclude<SubscriptionTier, "free">,
  period: BillingPeriod,
  offerings: BillingOfferings | null
): TierOffer | null => {
  if (!offerings) return null;

  const item = findProductForTier(tier, period, offerings);
  const priceText = item?.product?.priceString;
  if (!item || !priceText) return null;

  return {
    tier,
    period,
    productId: item.product.identifier,
    priceText,
    price: item.product.price,
    periodLabel: periodLabelFrom((item.product as any)?.subscriptionPeriod),
  };
};

// ---------------------------------------------------------------------------- the Coach plan
// Orthogonal to the player tier above: a coach can be on any player tier (or free) and
// separately subscribed to this, which is what actually unlocks the booking diary.

const COACH_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_COACH ?? "coach";
const COACH_MONTHLY_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_COACH_MONTHLY ?? "monthly_coach";
const COACH_ANNUAL_PRODUCT_ID = process.env.EXPO_PUBLIC_RC_PRODUCT_COACH_ANNUAL ?? "annual_coach";

const findCoachProduct = (period: BillingPeriod, offerings: BillingOfferings) => {
  const allPackages = offerings.packages;
  const productHint = period === "annual" ? COACH_ANNUAL_PRODUCT_ID : COACH_MONTHLY_PRODUCT_ID;

  const explicit = allPackages.find((item) => item.product.identifier === productHint || item.identifier === productHint);
  if (explicit) return explicit;

  const isoPeriod = period === "annual" ? "P1Y" : "P1M";
  return (
    allPackages.find((item) => {
      const haystack = `${item.product.identifier} ${item.identifier}`.toLowerCase();
      return haystack.includes("coach") && (item.product as any)?.subscriptionPeriod === isoPeriod;
    }) ?? null
  );
};

export type CoachOffer = {
  period: BillingPeriod;
  productId: string;
  priceText: string;
  price: number;
  periodLabel: string | null;
};

export const getCoachOffer = (period: BillingPeriod, offerings: BillingOfferings | null): CoachOffer | null => {
  if (!offerings) return null;

  const item = findCoachProduct(period, offerings);
  const priceText = item?.product?.priceString;
  if (!item || !priceText) return null;

  return {
    period,
    productId: item.product.identifier,
    priceText,
    price: item.product.price,
    periodLabel: periodLabelFrom((item.product as any)?.subscriptionPeriod),
  };
};

export const purchaseCoachSubscription = async (
  period: BillingPeriod,
  offerings: BillingOfferings
): Promise<PurchaseTierResult> => {
  const product = findCoachProduct(period, offerings);
  if (!product) {
    throw new Error(`No Coach product found (${period}). Check RevenueCat offering/packages and product IDs.`);
  }
  return buyPackage(product);
};

export const hasCoachEntitlement = (profile: CustomerInfo): boolean => {
  const activeEntitlements = profile.entitlements.active ?? {};
  if (activeEntitlements[COACH_ENTITLEMENT_ID]) return true;

  const activeProducts = (profile.activeSubscriptions ?? []).map((value) => value.toLowerCase());
  const coachProducts = [COACH_MONTHLY_PRODUCT_ID, COACH_ANNUAL_PRODUCT_ID].map((value) => value.toLowerCase());
  return coachProducts.some((value) => activeProducts.includes(value));
};

export const restoreBillingPurchases = async () => {
  return Purchases.restorePurchases();
};

export const hasProEntitlement = (profile: CustomerInfo): boolean => {
  return tierFromCustomerInfo(profile) !== "free";
};

export type BillingSubscriptionState = {
  tier: SubscriptionTier;
  /** False once the subscription has been cancelled but access has not yet run out. */
  willRenew: boolean;
  /** When the current period ends, ISO string, if the store reported one. */
  expiresAt: string | null;
  /** Monthly or annual, read off the active product id. Null if there is no active subscription. */
  period: BillingPeriod | null;
};

const periodFromProductIdentifier = (productIdentifier: string | null | undefined): BillingPeriod | null => {
  if (!productIdentifier) return null;
  return productIdentifier.toLowerCase().includes("annual") ? "annual" : "monthly";
};

/**
 * Tier plus renewal state. A cancelled subscription keeps its entitlement until the period
 * ends, so the app can say "Century until 21 September" rather than pretending it is already free.
 */
export const subscriptionStateFromCustomerInfo = (profile: CustomerInfo): BillingSubscriptionState => {
  const tier = tierFromCustomerInfo(profile);
  if (tier === "free") return { tier, willRenew: false, expiresAt: null, period: null };

  const active = Object.values(profile.entitlements.active ?? {});
  const latest = active
    .slice()
    .sort((a, b) => (Date.parse(b.expirationDate ?? "") || 0) - (Date.parse(a.expirationDate ?? "") || 0))[0];

  return {
    tier,
    willRenew: latest?.willRenew ?? true,
    expiresAt: latest?.expirationDate ?? null,
    period: periodFromProductIdentifier(latest?.productIdentifier),
  };
};

export const tierFromCustomerInfo = (profile: CustomerInfo): SubscriptionTier => {
  const activeProducts = (profile.activeSubscriptions ?? []).map((value) => value.toLowerCase());

  const centuryProductTokens = [CENTURY_PRODUCT_ID, PRO_MONTHLY_PRODUCT_ID, CENTURY_ANNUAL_PRODUCT_ID].map((value) =>
    value.toLowerCase()
  );
  if (centuryProductTokens.some((value) => activeProducts.includes(value))) {
    return "century";
  }

  const halfCenturyProductTokens = [HALF_CENTURY_PRODUCT_ID, HALF_CENTURY_ANNUAL_PRODUCT_ID].map((value) => value.toLowerCase());
  if (halfCenturyProductTokens.some((value) => activeProducts.includes(value))) {
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
  const centuryProducts = [CENTURY_PRODUCT_ID, PRO_MONTHLY_PRODUCT_ID, CENTURY_ANNUAL_PRODUCT_ID].map((value) =>
    value.toLowerCase()
  );
  const halfCenturyProducts = [HALF_CENTURY_PRODUCT_ID, HALF_CENTURY_ANNUAL_PRODUCT_ID].map((value) => value.toLowerCase());

  if (requestedTier === "century") {
    const purchased = result.purchasedProductIdentifier.toLowerCase();
    const selected = result.selectedProductIdentifier.toLowerCase();
    if (centuryProducts.includes(purchased) || centuryProducts.includes(selected)) {
      return "century";
    }
  }

  const resolvedFromCustomer = tierFromCustomerInfo(result.customerInfo);
  if (resolvedFromCustomer === "century") return "century";
  if (resolvedFromCustomer === "half_century") {
    if (centuryProducts.includes(result.purchasedProductIdentifier.toLowerCase())) {
      return "century";
    }
    return "half_century";
  }

  if (centuryProducts.includes(result.purchasedProductIdentifier.toLowerCase())) {
    return "century";
  }
  if (halfCenturyProducts.includes(result.purchasedProductIdentifier.toLowerCase())) {
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
  // The plan lives in the account's app_metadata, which rides in the sign-in token: refresh the
  // session so the token carries the new plan straight away, not at its next hourly refresh.
  await supabase.auth.refreshSession().catch(() => undefined);

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
