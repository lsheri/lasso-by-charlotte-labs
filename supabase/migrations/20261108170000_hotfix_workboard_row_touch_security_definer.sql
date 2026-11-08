-- HOTFIX (8 Nov 2026, 12:35 PT): board edits stopped saving after the IMG-4 paste.
--
-- IMG-4 replaced public.workboard_row_touch() with `create or replace` but did
-- not restate SECURITY DEFINER, so Postgres reset it to SECURITY INVOKER. The
-- function writes each edit's history row into workboard_revisions; running as
-- the signed-in user, that insert is refused by workboard_revisions' row-level
-- security ("new row violates row-level security policy"), so every update to
-- a card, section or link has failed since 19:35 UTC. Creates were unaffected
-- (workboard_row_create is still SECURITY DEFINER).
--
-- This restores SECURITY DEFINER without touching the function body.

alter function public.workboard_row_touch() security definer;

-- Check (expect true, true):
-- select proname, prosecdef from pg_proc where proname in ('workboard_row_touch', 'workboard_row_create');
