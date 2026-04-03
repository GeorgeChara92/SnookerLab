# AI Coach Setup

## 1) Apply database schema

Run `supabase/schema.sql` in Supabase SQL Editor.

This sets up:

- `public.ai_analyses`
- row-level security for user-owned analysis data
- server-enforced subscription limits for monthly usage

## 2) Configure private clip storage

Create a private storage bucket:

- `ai-videos`

Then ensure storage policies from `supabase/schema.sql` are applied so authenticated users can upload/read only their own clip paths.

Recommended object path:

- `${user_id}/${timestamp-random}.mp4`

## 3) Runtime flow

The app creates a real analysis pipeline (no demo fallback path):

1. User picks or records a clip (required length: 10-20 seconds).
2. Client uploads the clip to `ai-videos`.
3. Client inserts `pending` row in `ai_analyses`.
4. Client marks `processing` and calls Edge Function `ai-analyze-clip`.
5. Edge Function performs analysis and writes structured `report_json` plus final status.
6. On failure, analysis is marked `failed` with `error_message`.

## 4) Edge Function configuration

Function source:

- `supabase/functions/ai-analyze-clip/index.ts`

Required secrets:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default is `gpt-4o-mini`)

Deploy:

```bash
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase functions deploy ai-analyze-clip
```

## 5) Limits and guardrails

Current protections:

- clip duration validation in app (10-20 seconds)
- server-side monthly limits by subscription tier
- private storage + signed playback URLs

## Common errors

- `Bucket not found`
  - Create `ai-videos` or rerun schema/policy setup.
- `new row violates row-level security policy`
  - Re-apply storage and table RLS policies from `supabase/schema.sql`.
