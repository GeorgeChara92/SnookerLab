# Deploying the subscription security changes

The subscription tier used to live in `auth.users.raw_user_meta_data`, which any signed-in user
can rewrite from the app with `supabase.auth.updateUser({ data: ... })`. Anyone could therefore
grant themselves the Century tier and bypass every server-side limit.

The tier now lives in `raw_app_meta_data`, which only the service role can write. It is set from
RevenueCat's servers (webhook), or by the app asking the server to re-check (`sync-subscription`).

**Apply these steps in order.** Until step 1 runs, everyone reads as the free tier, because
`get_subscription_tier` looks in a field that isn't populated yet.

## 1. Run the migration

Supabase dashboard → SQL Editor → paste the contents of
`supabase/migrations/20260920_0001_subscription_tier_app_metadata.sql` → Run.

It is idempotent, wrapped in a transaction, and it:

- copies each user's existing tier and anchor date into `app_metadata`;
- removes the user-writable copies, so there is one source of truth;
- reads the tier and anchor from `app_metadata` in `get_subscription_tier` / `get_subscription_anchor`;
- stamps `created_at` from the server clock on insert and freezes it on update, so rows can't be
  backdated into an earlier billing period to dodge the monthly limit;
- revokes `execute` on the subscription helpers from `anon` and `authenticated` (they were callable
  by anyone holding the app's anon key, which could read any user's tier and usage by user id);
- limits the `ai-videos` bucket to 100 MB and video MIME types.

Verify afterwards, in the SQL editor:

```sql
select count(*) filter (where raw_app_meta_data ? 'subscription_tier') as in_app_metadata,
       count(*) filter (where raw_user_meta_data ? 'subscription_tier') as still_user_writable
from auth.users;
```

Expect `in_app_metadata` = the number of users and `still_user_writable` = 0.

## 2. Add the function secrets

Dashboard → Edge Functions → Secrets. Add:

| Secret | Where it comes from |
| --- | --- |
| `REVENUECAT_SECRET_API_KEY` | RevenueCat → Project Settings → API keys → **secret** key (starts `sk_`). Never the public key, and never in a `EXPO_PUBLIC_` variable. |
| `REVENUECAT_WEBHOOK_SECRET` | Any long random string you generate; you paste the same value into RevenueCat in step 4. |
| `REVENUECAT_PROJECT_ID` | Optional. The `projects/<id>` segment of the RevenueCat dashboard URL. Defaults to `2c1d0f01`, so only set it if the project changes. |

Both functions call the RevenueCat **v2** API (`/v2/projects/{project_id}/customers/...`), so the
secret key must be a V2 key. A V1 key returns 401 and the functions answer `sync_failed`.

Optional, only if your product identifiers change:
`RC_CENTURY_IDS` and `RC_HALF_CENTURY_IDS` (comma-separated). The defaults cover
`century`, `century_monthly`, `monthly` and `half_century`, `half_century_monthly`.

## 3. Deploy the two new functions

Dashboard → Edge Functions → Deploy a new function, then paste each file:

| Function | File | JWT verification |
| --- | --- | --- |
| `sync-subscription` | `supabase/functions/sync-subscription/index.ts` | **On** (the caller is the signed-in user) |
| `revenuecat-webhook` | `supabase/functions/revenuecat-webhook/index.ts` | **Off** (RevenueCat can't send a Supabase JWT; the shared secret authenticates it) |

Also redeploy these two, which changed:

- `ai-analyze-clip` — now claims the row `pending` → `processing` in a single statement, so the
  same analysis can't be re-run repeatedly to burn OpenAI credit, and caps user notes at 1200
  characters before they reach the prompt.
- `delete-account` — now deletes the user's uploaded clips from storage. Table rows cascade from
  `auth.users`, but storage objects don't, so videos were being left behind after account deletion
  (a GDPR problem and a breach of Apple's account-deletion rule).

## 4. Point RevenueCat at the webhook

RevenueCat → Project Settings → Integrations → Webhooks:

- URL: `https://hqwmnzrksivkervvnmwa.supabase.co/functions/v1/revenuecat-webhook`
- Authorization header: the exact value you stored as `REVENUECAT_WEBHOOK_SECRET`

Send a test event and check Edge Function logs for `revenuecat-webhook applied`.

## 5. Check it end to end

1. Sign in on the phone and open Subscription Plans. The app calls `sync-subscription`, and the
   tier shown should match the store.
2. In the SQL editor, confirm the tier landed in `app_metadata` for that user.
3. Try to forge a tier from the app (or any REST client) with
   `supabase.auth.updateUser({ data: { subscription_tier: 'century' } })`. The call still succeeds
   — that field is just ordinary user metadata now — but limits and the displayed tier must not
   change, because nothing reads it any more.

## Status (applied 20 Sep 2026)

Done on the live project:

- migration run and verified: 5/5 users on `app_metadata`, 0 still user-writable; helper functions
  no longer executable by `anon`/`authenticated`; `created_at` freeze triggers in place; `ai-videos`
  limited to 100 MB of video;
- `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_SECRET` set;
- all five functions deployed, `sync-subscription` with JWT verification on and
  `revenuecat-webhook` with it off;
- webhook configured in RevenueCat for production and sandbox, all events; test delivery returned
  200 with no errors in the function logs.

Left to check on a device: open Subscription Plans while signed in, then confirm the tier in
`app_metadata` matches the store.

## Still open

- **Deleting a row gives quota back.** Usage counts live rows, so deleting a match frees a slot in
  the monthly allowance. A separate append-only usage ledger would fix this properly.
- **The AI coach never sees the video.** `ai-analyze-clip` sends the model text only, with the
  clip's URL inside the prompt, so the "analysis" is generated from the tags and notes. It needs
  frame extraction before it can honestly be sold as clip analysis.
