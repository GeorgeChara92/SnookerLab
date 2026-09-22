# iOS Release + Web Expansion Plan

This document captures the production checklist and practical next steps to publish SnookerLab to the iOS App Store from a Windows workflow, plus an approach for adding a web surface without cluttering the app root.

## 1) High-Priority Product/Code Improvements

### 1.1 Auth deep-link completion (required)

- Current redirect URL is set to `snookerlab://auth/callback`.
- Add explicit deep-link handling in app bootstrap/navigation for auth callbacks.
- Add an in-app **Set New Password** screen for recovery links.
- Verify end-to-end flows:
  - register -> confirm email -> sign in
  - forgot password -> email link -> open app -> set new password

### 1.2 Account deletion completeness (required)

- `delete-account` function currently deletes auth user.
- Add storage cleanup before user delete:
  - remove user objects from `ai-videos`
  - remove profile image objects if still present
- Keep confirmation-code flow in app to reduce accidental deletion.

### 1.3 Subscription source of truth hardening (recommended)

- Move entitlement sync from client-only updates to server-backed updates.
- Implement RevenueCat webhook handler -> Supabase function -> user tier sync.
- Keep DB trigger limits as final enforcement layer.

### 1.4 Performance/maintainability cleanup (recommended)

- Consolidate repeated `loadRoutines()` and user hydration calls.
- Keep one idempotent hydration path per authenticated user session.

### 1.5 Production diagnostics (recommended)

- Add crash reporting (Sentry).
- Add core analytics events:
  - paywall viewed
  - purchase attempt/success/failure
  - AI analysis started/completed/failed
  - account deletion started/completed

## 2) iOS App Store Release Checklist (Windows + EAS)

### 2.1 App Store Connect

1. Create app record with bundle id `com.georgechara.snookerlab`.
2. Complete app metadata: description, screenshots, support URL, privacy policy URL.
3. Complete pricing, age rating, and app privacy declarations.
4. For subscriptions: configure products/groups and ensure agreements/tax/banking are active.

### 2.2 Environment + Secrets

Set in EAS and production runtime:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- `EXPO_PUBLIC_AUTH_REDIRECT_URL` (recommended: `snookerlab://auth/callback`)
- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_SUPPORT_EMAIL`

Supabase function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for `delete-account`)
- `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`)

### 2.3 Supabase/Auth Configuration

1. Add allowed redirect URLs:
   - `snookerlab://auth/callback`
2. Deploy required functions:
   - `ai-analyze-clip`
   - `delete-account`
3. Verify RLS and subscription limit triggers in `supabase/schema.sql`.

### 2.4 Build + Submit from Windows

1. Build iOS in cloud:
   - `eas build -p ios --profile production`
2. Submit build:
   - `eas submit -p ios --profile production`
3. Distribute through TestFlight (internal first, then external).

### 2.5 TestFlight Exit Criteria

- Sign up + email confirmation works.
- Forgot password + deep-link recovery works.
- Subscription purchase/restore/manage works.
- AI analysis full flow works (10-20s clips, completion to feedback).
- In-app account deletion fully removes account/data.
- No blocking crashes in top 20 user paths.

### 2.6 App Review Readiness

- In-app account deletion is discoverable in Account Settings.
- Privacy policy and Terms are reachable in-app and on listing.
- Reviewer notes include test credentials and purchase test guidance if needed.

## 3) Web Expansion Strategy (Without Root Clutter)

Yes, this app can be expanded for web.

Because this is Expo React Native, you can support web in two practical ways:

### Option A: Keep single codebase with Expo web (fastest)

- Use Expo web target for shared screens/components.
- Host on Vercel/Netlify/Cloudflare Pages.
- Good for auth pages, legal pages, lightweight dashboard.

### Option B: Separate marketing/legal web app (cleanest structure)

- Keep mobile app as-is.
- Create a separate web package/app for:
  - Privacy policy
  - Terms
  - Support/deletion instructions
  - optional download landing page
- Best if you want stricter separation and cleaner app repo boundaries.

## 4) Recommended Repo Layout (Monorepo style, low clutter)

If adding web in the same repository, keep root tidy with dedicated folders:

```text
/apps
  /mobile        (current Expo app)
  /web           (Next.js or Expo web app)
/packages
  /ui            (shared design system, optional)
  /config        (eslint/tsconfig shared, optional)
/docs
```

If you do not want to restructure now, keep current mobile app in place and add a lightweight separate web repo first for legal/support URLs.

## 5) Mobile Redirect URL Plan

Use public web URLs for legal/support pages:

- `https://snookeredapp.com/privacy`
- `https://snookeredapp.com/terms`
- `https://snookeredapp.com/support`

For auth callbacks, continue using deep links:

- `snookerlab://auth/callback`

This gives app-store-compliant web URLs while preserving mobile-native auth behavior.

## 6) Suggested Next Execution Order

1. Implement deep-link auth callback + set-new-password screen.
2. Add storage cleanup in `delete-account` function.
3. Deploy functions and verify secrets.
4. Publish legal/support web pages (can be minimal first).
5. Run TestFlight production checklist.
6. Submit for App Review.
