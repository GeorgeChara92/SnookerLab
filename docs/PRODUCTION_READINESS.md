# Production Readiness Checklist

This app now uses user-scoped local state (so account A and B do not share the same persisted store on one device).

## 1) Supabase setup

1. Create two Supabase projects:
   - `snookerapp-staging`
   - `snookerapp-production`
2. Run `supabase/schema.sql` in staging first.
3. Verify RLS is enabled and policies are present.
4. Create storage bucket `profile-images` and apply per-user write rules.

## 2) Environment configuration

Set these env vars per environment:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do not reuse staging credentials in production builds.

## 3) Build profiles (EAS)

This repo includes `eas.json` with:

- `development` (dev client)
- `preview` (internal testing)
- `production` (store release)

Use Dev Client and Preview builds for production-like testing before app-store submission.

## 4) Test matrix (must pass)

1. **Account isolation on same device**
   - Sign in as user A, create data.
   - Sign out, sign in as user B.
   - Confirm B does not see A data.
2. **Session persistence**
   - Force close app and reopen.
   - Confirm user data restores correctly.
3. **Cross-device behavior**
   - Sign in same account on second device.
   - Confirm data availability matches expected sync model.
4. **Tournament flow regression**
   - Knockout random draw.
   - Knockout manual pairing.
   - League table updates and completion.

## 5) Store deployment path

1. Android Internal Testing (AAB)
2. TestFlight internal/external
3. Fix critical issues
4. Promote to production

## 6) Known architecture next step

Current feature stores are local-first. For full cross-device sync, move sessions/matches/tournaments/routine scores to Supabase-backed repositories with online writes and server hydration on login.
