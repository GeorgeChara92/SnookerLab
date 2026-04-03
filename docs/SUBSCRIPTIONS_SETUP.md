# Subscription Setup (RevenueCat)

This app uses tiered limits backed by Supabase DB triggers and client purchase flow scaffolding via RevenueCat.

## Tier Limits

- Free: 12 matches, 1 tournament, 1 AI analysis per billing cycle
- Half-Century: 40 matches, 4 tournaments, 8 AI analyses per billing cycle
- Century: Unlimited matches/tournaments, 20 AI analyses per billing cycle

Billing cycle resets monthly from `subscription_anchor_date`.

## 1) Configure RevenueCat

Create entitlement in RevenueCat:

- `SnookerLab Pro`

Create one monthly product/package and attach it to current offering:

- product id: `monthly`

## 2) Configure env vars

Set in local `.env` and EAS envs:

- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
- `EXPO_PUBLIC_RC_ENTITLEMENT_PRO` (default `SnookerLab Pro`)
- `EXPO_PUBLIC_RC_PRODUCT_MONTHLY` (default `monthly`)

Current client mapping:

- If `SnookerLab Pro` entitlement is active -> app tier synced to `century`
- If inactive -> app tier synced to `free`
- `half_century` remains available as a legacy/manual tier for future product expansion

## 3) Runtime requirements

- Use development or preview builds for billing validation.
- Purchases are not expected to fully work in plain Expo Go.

## 3b) Paywall + Customer Center

The app includes:

- RevenueCat Paywall (`react-native-purchases-ui`): open from Plans screen (`Open Paywall`)
- RevenueCat Customer Center: open from Settings (`Manage Subscription`)

## 4) Server-side enforcement

Run latest `supabase/schema.sql` so triggers/functions are present. Limits are enforced on:

- `matches`
- `tournaments`
- `ai_analyses`

Over-limit inserts throw `subscription_limit_exceeded:<entity>`.

## 5) Current sync model

Purchase/restore currently updates Supabase user metadata:

- `subscription_tier`
- `subscription_anchor_date`

For production hardening, add RevenueCat webhooks -> secure backend updater so entitlement sync does not rely only on client updates.

## 6) Account settings support links

Account settings includes policy/support actions for store compliance.

Set these env vars in local `.env` and EAS:

- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
