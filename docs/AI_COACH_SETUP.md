# AI Coach Setup (Test Mode -> Production)

## 1) Run SQL migration

In Supabase SQL Editor, run the updated `supabase/schema.sql`.

This creates:

- `public.ai_analyses`
- RLS policy `ai_analyses_own`
- DB-level daily rate limit trigger (`8 analyses / 24h / user`)

## 2) Create storage bucket

Create private bucket:

- `ai-videos`

If you created the bucket manually, still run the storage policy SQL from `supabase/schema.sql` so authenticated users can write to their own folder.

Recommended path convention:

- `${user_id}/${timestamp-random}.mp4`

## 3) Current runtime behavior

The app now calls Edge Function `ai-analyze-clip` from `runAnalysis`.

Flow:

1. Upload video to `ai-videos` (or use `demo://` fallback path).
2. Insert row in `ai_analyses` with `pending`.
3. Client switches to `processing` and invokes Edge Function.
4. Edge Function runs LLM analysis and writes `feedback`, `recommendations`, `status=completed`.
5. Structured output is persisted in `report_json` for clean frontend rendering.
6. If Edge Function call fails in app, store falls back to `runDemoAnalysis` to keep UX unblocked.

Failure states:

- Edge Function writes `status=failed` with `error_message` when server-side analysis errors.

## 4) Edge Function setup

Function file:

- `supabase/functions/ai-analyze-clip/index.ts`

Required Supabase secrets:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`)

Deploy commands:

```bash
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase functions deploy ai-analyze-clip
```

Recommended first model:

- `gpt-4o-mini` (good quality/cost for initial rollout)

If you need stronger reasoning later, raise model tier only after validating usage and cost profiles.

## 5) Cost safety

Current protections:

- Client soft limit (`8/day`) in upload screen.
- Server hard limit (`8/day`) via Postgres trigger.

## Common errors

- `Bucket not found`
  - Create `ai-videos` bucket or rerun `supabase/schema.sql`.
- `new row violates row-level security policy`
  - Storage RLS policies are missing. Rerun `supabase/schema.sql` to apply `storage.objects` policies for `ai-videos`.

Recommended next protections:

- Edge Function rate-limit by IP + user id.
- Optional subscription tier limits.
- Clip duration guardrail (e.g. 15s–75s).
