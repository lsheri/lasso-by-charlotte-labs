-- GRANTS (7 Nov night): no admin function is callable by PUBLIC or anon.
--
-- 18 SECURITY DEFINER admin_* functions held execute for PUBLIC and/or anon (a function
-- gets PUBLIC execute by default when created). Checked 8 Nov:
--   * 16 check is_platform_admin(auth.uid()) first, so a signed-out caller was refused.
--     Hygiene only.
--   * admin_set_clients_enabled checks the caller's workspace role; a signed-out caller has
--     none, so it failed. Hygiene only.
--   * admin_log has NO gate: it inserts into admin_actions with whatever action, target and
--     payload it is given. Any signed-out caller with the public anon key could write a
--     forged row into the admin audit trail. This revoke closes that.
--
-- authenticated and service_role keep execute exactly as before, so the founder console
-- and the app are unaffected. admin_log is called from inside other SECURITY DEFINER
-- functions, which run as their owner, so revoking anon does not affect those calls.
-- Run as one script. Revokes are refused by the automated apply: paste by hand.

revoke execute on function public.admin_ai_cost_reconciliation(integer, text) from public, anon;
revoke execute on function public.admin_ai_cost_record_billed(date, text, numeric, text) from public, anon;
revoke execute on function public.admin_approve_request(uuid, uuid, text, integer, boolean) from public, anon;
revoke execute on function public.admin_create_workspace(text, text, integer, text, text, timestamp with time zone, text, text[], boolean, text, integer) from public, anon;
revoke execute on function public.admin_decide_request(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_entitlement_summary() from public, anon;
revoke execute on function public.admin_institutions() from public, anon;
revoke execute on function public.admin_key_overview() from public, anon;
revoke execute on function public.admin_log(text, text, uuid, text, jsonb) from public, anon;
revoke execute on function public.admin_mint_key(text, text, uuid, uuid, text, integer, integer, timestamp with time zone, text) from public, anon;
revoke execute on function public.admin_outbound_emails(uuid) from public, anon;
revoke execute on function public.admin_push_intents_open(integer) from public, anon;
revoke execute on function public.admin_revoke_key(text, text) from public, anon;
revoke execute on function public.admin_send_admin_link(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_set_clients_enabled(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_seats(uuid, integer, text) from public, anon;
revoke execute on function public.admin_workspace_activity() from public, anon;
revoke execute on function public.admin_workspaces() from public, anon;

-- Check, expect zero rows:
-- select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'admin\_%'
--    and (p.proacl::text like '%anon=X%' or p.proacl::text like '{=X%' or p.proacl::text like '%,=X%');
