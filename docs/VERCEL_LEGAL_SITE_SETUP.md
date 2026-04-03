# Vercel Setup for Legal + Support Site

This project now includes a lightweight static site at:

- `apps/legal-site`

Routes:

- `/` home
- `/privacy`
- `/terms`
- `/support`
- `/email-confirmed`

Compatibility rewrites are also configured for:

- `/auth/confirm`
- `/auth/callback`

## 1) Deploy on Vercel

1. Create a new Vercel project from this repository.
2. Set **Root Directory** to `apps/legal-site`.
3. Framework preset: **Other** (no build required).
4. Build command: leave empty.
5. Output directory: leave empty.
6. Deploy.

`apps/legal-site/vercel.json` already handles clean routes and rewrites.

## 2) Configure domain

Suggested domain:

- `https://snooker-lab.vercel.app`

Then verify:

- `https://snooker-lab.vercel.app/privacy`
- `https://snooker-lab.vercel.app/terms`
- `https://snooker-lab.vercel.app/support`

## 3) Wire mobile app URLs

Set these in your mobile app envs (local + EAS):

- `EXPO_PUBLIC_PRIVACY_URL=https://snooker-lab.vercel.app/privacy`
- `EXPO_PUBLIC_TERMS_URL=https://snooker-lab.vercel.app/terms`
- `EXPO_PUBLIC_AUTH_CONFIRM_REDIRECT_URL=https://snooker-lab.vercel.app/email-confirmed`

If you want support to open the support page instead of email, add:

- `EXPO_PUBLIC_SUPPORT_URL=https://snooker-lab.vercel.app/support`

## 4) Supabase Auth redirect URLs

In Supabase Auth URL configuration, allow both:

- `https://snooker-lab.vercel.app/email-confirmed` (email confirmation success page)
- `snookerlab://auth/callback` (mobile auth deep-link callback)

## 5) Store listing alignment

Use the same live URLs in App Store Connect and Play Console privacy/support fields.
