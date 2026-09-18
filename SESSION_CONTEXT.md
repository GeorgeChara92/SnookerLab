# SnookerApp Session Context (Handover)

Last updated: 2026-04-28

## Product Direction

- Premium-feeling snooker training app with clean, modern UX and UK English copy.
- Monetisation is now active work (no longer deferred): tiered subscriptions are being migrated to Adapty.
- Current release target is iOS first, with App Store review and TestFlight validation in progress.

## What Changed This Session

### 0) 2026-04-28 update (achievements, scoring UX, table capture refactor)

- Fixed achievement persistence behaviour so unlocked achievements remain unlocked even if source match/session data is later deleted.
- Wired break-related achievement tracking to real frame data (`highest_break_user`) instead of hardcoded placeholders.
  - `best_break` now tracks correctly.
  - `centuries` achievement requirement now tracks correctly.
- Updated profile/achievement XP and level handling to be achievement-driven (sum of unlocked `xpReward`) and aligned header level badges with current unlock state.
- Fixed "recently unlocked" ordering to respect persisted unlock sequence (`seen_achievements`) rather than static achievement array order.

Scoring and routine logging improvements:
- Reworked routine/session score entry to be scoring-type aware (`points`, `count`, `percentage`, `time`) instead of generic score presets.
- Added per-type input guidance, validation, placeholders, and quick score chips.
- Added percentage dual entry modes (direct `%` and `made/attempts`) in routine logging.
- Added max-score-aware clamping/caps and clearer scoring indicators on logging screens.
- Updated break-building routine scoring model to mostly points-based as requested, keeping exceptions where required.
- Corrected straight cueing routine max score inconsistencies and then converted requested routines to points with aligned success criteria copy.

Routine and guide content quality pass:
- Completed deep wording pass across routine and guide text to align terminology with snooker coaching language.
- Removed/rewrote generic/non-snooker phrasing while preserving drill structure and intent.

Table capture refactor status:
- Replaced old AR-targeted scan entry from live scoring with new capture flow entrypoints and modular table-capture architecture.
- Added initial manual capture modules, then adapted to current dependency constraints (Vision Camera/Skia were not available in this environment).
- Added AR-first refactor scaffolding for full-screen `ARTableCaptureScreen`:
  - world-corner capture step flow
  - mm-based table geometry model (1778 x 3569)
  - world-to-table and table-to-world conversion utilities
  - snapshot storage in mm coordinates
  - top-down restore map component using table scale
  - YOLO integration placeholder converting detection intent into AR-plane workflow (no native inference yet)

Key files touched this session:
- Achievements/XP:
  - `src/hooks/useAchievementUnlocker.ts`
  - `src/hooks/useSeenAchievements.ts`
  - `src/screens/profile/AchievementsScreen.tsx`
  - `src/screens/profile/ProfileScreen.tsx`
  - `src/components/header/GlobalHeader.tsx`
  - `src/components/profile/HeaderProfileButton.tsx`
- Scoring UX:
  - `src/screens/routines/RecordRoutineScoreScreen.tsx`
  - `src/screens/routines/RoutineDetailScreen.tsx`
  - `src/screens/sessions/ActiveSessionScreen.tsx`
  - `src/constants/routines.ts`
  - `src/features/guides/guidePlaybooks.ts`
- Table capture / AR refactor:
  - `src/screens/matches/ARTableCaptureScreen.tsx`
  - `src/screens/matches/TablePositionCaptureScreen.tsx`
  - `src/components/tableCapture/*`
  - `src/components/arTableCapture/ARTableTopDownView.tsx`
  - `src/features/tableCapture/*`
  - `src/features/arTableCapture/*`
  - `src/navigation/MatchesNavigator.tsx`
  - `src/screens/matches/LiveFrameScoringScreen.tsx`
  - `src/types/index.ts`

Platform note:
- iOS AR native bridge cannot be generated/verified from Windows; iOS prebuild and native module linking must run on macOS.

### 0) iOS AR migration and precision platform rebuild (ARKit)

- AR mode on iOS was migrated from Viro-first fallback behaviour to ARKit-native flow with Expo plugin wiring.
- Added custom iOS native bridge manager and config plugin integration so `SnookerARKitView` is available in dev/prod iOS builds.
- Implemented native SceneKit rendering for:
  - crosshair reticle point
  - black/pink/blue reference anchors
  - placed routine/scan markers with selected-marker emphasis
- Rebuilt AR feature architecture into shared layers used by both Routine AR and Scan Snooker AR:
  - confidence model
  - calibration controller
  - anchor manager
  - routine placement controller
  - marker placement controller
  - reusable AR UI shell components
- Calibration is now multi-step and precision-oriented:
  - detect plane
  - align black
  - align pink
  - align blue (third reference for tighter fit)
  - confirm lock
- Added Measure-inspired shared AR UI system:
  - minimal top chrome
  - centre precision reticle with state animations
  - contextual instruction label
  - compact bottom action bar
  - mode switcher and ball selector
- Marker editing now supports selection + fine adjustment tools (move-to-reticle and directional nudge).
- Drift/confidence handling is explicit and surfaced in UX.
- Lock haptics were removed to avoid constant vibration during state jitter.
- iOS shadow performance warning from reticle overlay was addressed by removing dynamic shadow usage on the reticle ring.

Key files:
- `plugins/with-snooker-arkit.js`
- `plugins/ios/SnookerARKitViewManager.m`
- `src/features/arkit/SnookerARKitView.ios.tsx`
- `src/features/arkit/SnookerARKitView.tsx`
- `src/features/ar/SnookerTableCalibrationController.ts`
- `src/features/ar/snookerTableCalibration.ts`
- `src/features/ar/SnookerMarkerPlacementController.ts`
- `src/features/ar/RoutineARPlacementController.ts`
- `src/features/ar/ui/ARReticle.tsx`
- `src/screens/routines/ARRoutineSetupARKitScreen.tsx`
- `src/screens/matches/SnookerScanARKitScreen.tsx`

### 1) Dashboard redesign (luxury editorial direction)

- `DashboardHomeScreen` was rebuilt with a premium editorial flow and updated section order.
- Removed the previous weekly focus/readiness hero.
- New order: hero -> quick actions -> practice sessions this week -> session notes -> recommended routines -> recent routines.
- Weekly chart is now Monday-based (Mon-Sun) and renamed to **Practice Sessions This Week**.
- Hero background orbs are subtle red accents to reference snooker reds.
- Quick action changed from Record to **AI Coach**.
- Text/copy across dashboard was refreshed to feel less generic and more on-brand.

Key file:
- `src/screens/dashboard/DashboardHomeScreen.tsx`

### 2) Avatar/header updates

- Header profile button premium shell/badge experiment was reverted per request.
- Added new premium avatar presets, then removed two by request:
  - removed: `baize-architect`, `pro-circuit`
- Remaining added premium presets include: `triple-crown`, `masters-room`, `champion-seal`, `spotlight-table`.

Key files:
- `src/components/profile/HeaderProfileButton.tsx`
- `src/constants/profileAvatars.ts`
- `src/components/profile/SnookerPresetAvatar.tsx`

### 3) Billing migration: RevenueCat -> Adapty

- Billing service was replaced to use `react-native-adapty`.
- RevenueCat packages removed.
- Adapty plugin added to Expo config.
- Subscription and settings UI wording updated from "Customer Center" to store-native subscription management.
- Tier mapping kept as app tiers (`free`, `half_century`, `century`) based on Adapty access levels and product IDs.

Key files:
- `src/services/billing.ts`
- `src/screens/profile/SubscriptionPlansScreen.tsx`
- `src/screens/profile/SettingsScreen.tsx`
- `src/navigation/AppNavigator.tsx`
- `.env.example`
- `app.json`
- `package.json`

### 4) Adapty init/race hardening and diagnostics

- Added activation guards (`activationPromise`, `isActivated` checks, `activateOnceError` handling).
- Added richer warning logs for billing init (`message`, `detail`, `adaptyCode`) to debug live issues.

Current known billing state:
- Placement issue was fixed (`main_subscription` now exists).
- Current blocker seen in logs: `#1000 noProductIDsFound` (StoreKit cannot resolve product IDs yet).
- This points to App Store Connect/Adapty product readiness and first-submission workflow, not SDK install.

## Store/Release Status (important)

- EAS `preview` and `production` environments now include Adapty variables.
- A new iOS build was triggered and App Store review submission flow is underway.
- App metadata/privacy fields were being completed in App Store Connect.
- Subscriptions are configured as auto-renewables:
  - `century_monthly`
  - `half_century_monthly`
  - `monthly`

## Configuration Changes

- App name changed from `SnookerApp` -> `Snooker Lab`.
- iPad support disabled for now (`ios.supportsTablet = false`) to avoid iPad screenshot requirements.
- Keep app version at `1.0.0` for now; production builds auto-increment build number via EAS.

Key file:
- `app.json`

## Auth/Account Supporting Changes Present in Repo

- Additional auth flow improvements are in current working state/commit set (including update password and auth error helper usage).

Key files:
- `src/screens/auth/UpdatePasswordScreen.tsx`
- `src/utils/authErrors.ts`
- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/ForgotPasswordScreen.tsx`
- `src/screens/auth/ConfirmEmailScreen.tsx`
- `src/navigation/AuthNavigator.tsx`
- `src/store/authStore.ts`

## Git State Snapshot

- Previous latest pushed commit before this AR session:
  - `ca33cca` - "Migrate billing to Adapty and refine premium app flow"

## Recommended Start Steps Next Session

1. Check App Store review result for first binary + subscriptions.
2. Re-test subscriptions in TestFlight/sandbox after Apple propagation.
3. If `noProductIDsFound` persists:
   - verify Adapty placement `main_subscription` contains exact iOS product IDs
   - verify products are fully actionable in App Store Connect (agreements/metadata/pricing/availability)
   - verify sandbox tester account and storefront
4. Once product fetch works, complete end-to-end checks:
   - price load
   - purchase success path
   - restore path
   - tier sync to Supabase

## Notes

- Do not change access level IDs to product IDs.
  - Access levels: `half_century`, `century`
  - Product IDs: `half_century_monthly`, `century_monthly`, `monthly`
- App Store review metadata should remain accurate to actual data collection and auth flows.
