# SnookerApp Session Context (Handover)

Last updated: 2026-04-02

## Product Direction

- Build a premium-feeling snooker training app with strong core functionality first.
- Keep the app free for now; paid tier/paywall work is deferred.
- Design target: professional, clean, minimal, high quality.
- Language preference: UK English throughout the app copy.

## Major Work Completed

### 1) Practice Routines rebuilt as a video-first experience

- Replaced old routines with a curated catalogue of **25** structured routines.
- Added richer routine content: name, category, difficulty, summary, setup, steps, scoring, improvements.
- Added YouTube metadata support:
  - `youtube_video_id`, `youtube_url`, `youtube_title`, `youtube_channel`
  - optional alternative video fields: `youtube_alt_video_id`, `youtube_alt_url`, `youtube_alt_title`, `youtube_alt_channel`
- Routine cards show YouTube thumbnail and play affordance.
- Routine detail supports:
  - primary/alternative video switcher
  - inline playback via `react-native-webview`
  - open in YouTube action
  - video title/channel display

Key files:
- `src/constants/routines.ts`
- `src/types/index.ts`
- `src/components/routines/RoutineCard.tsx`
- `src/screens/routines/RoutineDetailScreen.tsx`
- `src/utils/youtube.ts`

### 2) Foundations section and Shaun Murphy channel integration

- Top category is now **The Foundations**.
- Foundations routines include core basics (stance, bridge, sighting, potting).
- Added/raised Shaun Murphy Snooker videos where appropriate, including in selected non-foundation routines.

### 3) Sessions data model and preset workflow

- Sessions are preset-based and log results by date.
- Routine score/session migrations were set to wipe old local data for clean rollout.
- Session setup screen redesigned to be more premium and easier to use:
  - cleaner layout and hierarchy
  - grouped routines by category
  - search routines/categories
  - selected routines summary
  - sticky save action

Key files:
- `src/store/sessionsStore.ts`
- `src/screens/sessions/SessionSetupScreen.tsx`
- `src/screens/sessions/SessionsHomeScreen.tsx`
- `src/screens/sessions/SessionTemplateDetailScreen.tsx`
- `src/screens/sessions/ActiveSessionScreen.tsx`

### 4) Matches UX improvements

- Opponent history now has **Add Match Against This Opponent**.
- `NewMatch` accepts optional prefilled opponent name.
- Label update: "Overall Frames" -> **"Total Points"** in match summaries.

Key files:
- `src/types/index.ts` (NewMatch route params)
- `src/screens/matches/OpponentMatchesScreen.tsx`
- `src/screens/matches/NewMatchScreen.tsx`
- `src/screens/matches/MatchesListScreen.tsx`

### 5) App-wide UI quality and theming foundation

- Added system-aware light/dark theme tokens and hook.
- Wired navigation theme to system mode.
- Added reusable UI primitives:
  - `AppButton`
  - `AppCard`
- Standardised stack header/content styling with shared stack options.
- Improved auth flows (login/register/forgot password): validation, loading states, cleaner hierarchy.
- Tab bar made safer for modern iPhones with bottom safe-area handling.

Key files:
- `src/constants/theme.ts`
- `src/hooks/useAppTheme.ts`
- `src/navigation/AppNavigator.tsx`
- `src/navigation/MainTabNavigator.tsx`
- `src/navigation/stackOptions.ts`
- `src/components/ui/AppButton.tsx`
- `src/components/ui/AppCard.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/RegisterScreen.tsx`
- `src/screens/auth/ForgotPasswordScreen.tsx`

### 6) Practice categories now collapsible

- Practice category sections are collapsible to reduce overwhelm.
- Added **Expand all** / **Collapse all** actions.
- Added smooth open/close animation via `LayoutAnimation`.

Key file:
- `src/screens/routines/RoutinesListScreen.tsx`

## Important Fixes and Decisions

- Fixed duplicate navigation screen-name warning by renaming profile stack screen:
  - `Profile` -> `ProfileHome` in profile stack params/screen.
- Removed unstable icon package usage that caused Metro resolution issues.
- Root cause of theme not switching: `app.json` had `"userInterfaceStyle": "light"`.
  - Changed to `"automatic"`.

Key file:
- `app.json`

## Current Behaviour Snapshot

- System light/dark mode is implemented and should respond to device appearance.
- Practice routines use structured categories, collapsible sections, and video-first cards/details.
- Sessions can be created as category-aware presets with searchable routine selection.
- Matches can be added directly from opponent history with opponent prefilled.

## Recommended Start Steps Next Session

1. Run app with clean cache: `npx expo start -c`.
2. Quick QA pass on device:
   - Toggle iOS Light/Dark and confirm full-screen consistency.
   - Test Practice category expand/collapse + expand/collapse all animations.
   - Test Add Match from opponent history and verify prefilled opponent.
   - Test session preset create/edit flow with grouped routine selection.
3. Continue premium polish on remaining screens with any hardcoded legacy colours/copy.

## Open Follow-ups (Good Next Tasks)

- Final pass for full token-based styling consistency across every screen/component.
- Optional chevron rotation animation on routine category headers.
- Name normalisation in matches (avoid duplicate opponent histories due to case/spacing).
- Continue UK English copy sweep for any remaining US spellings.

## Notes for Future Work

- Keep functionality-first priority before monetisation UI.
- Keep auth stable and avoid regressions in sessions/matches while polishing visuals.
- Preserve YouTube compliance approach (embed/open YouTube, no video downloading/rehosting).
