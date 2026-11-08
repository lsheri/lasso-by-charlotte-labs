-- AUDIT-4, Q8 (8 Nov 2026). Additive.
--
-- A3 F13: ai_usage had no environment, so a cost per question could not be
-- split between production and the preview, and no record of which context
-- mode answered (inline read set vs catalogue). Both are stamped by the app
-- from this migration on; older rows stay null and are reported as such.
--
-- Apply BEFORE merging the matching app change: the insert names these
-- columns, and a failed usage insert is swallowed (accounting never blocks an
-- answer), so merging first would silently lose cost rows.

alter table public.ai_usage
  add column if not exists environment text,
  add column if not exists context_mode text;

alter table public.ai_usage
  drop constraint if exists ai_usage_environment_check;
alter table public.ai_usage
  add constraint ai_usage_environment_check
  check (environment is null or environment = any (array['production'::text, 'preview'::text, 'local'::text, 'unknown'::text]));

alter table public.ai_usage
  drop constraint if exists ai_usage_context_mode_check;
alter table public.ai_usage
  add constraint ai_usage_context_mode_check
  check (context_mode is null or context_mode = any (array['inline'::text, 'catalogue'::text]));

create index if not exists ai_usage_environment_created_at_idx
  on public.ai_usage (environment, created_at desc);

comment on column public.ai_usage.environment is
  'Which world served the call, from the request host (production, preview, local, unknown). Null before 8 Nov 2026.';
comment on column public.ai_usage.context_mode is
  'How an Ask answer assembled its context: inline (read set in the prompt) or catalogue (index plus fetches). Null for prime, intent and extract, and before 8 Nov 2026.';
