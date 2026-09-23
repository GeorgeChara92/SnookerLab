-- Why a coach analysis failed, in the words of whatever threw.
--
-- error_message is what the player reads; it is deliberately the same friendly sentence for
-- every unexpected failure. failure_detail keeps the underlying reason so a failure can still
-- be diagnosed after the edge function logs have aged out. Written only by the function.

alter table public.ai_analyses add column if not exists failure_detail text;

comment on column public.ai_analyses.failure_detail is
  'Developer-facing reason the analysis failed (exception name and message, truncated). Null on success.';
