-- 20 Nov 2026, chat pill build Phase 2 (PR 288, QA of PR 288 H1). Paste in the Supabase SQL editor. Safe to run twice.
--
-- What is live today (read 20 Nov): make_invite is Admin-only (founder decision 19 Aug): only an active admin of the
-- workspace may mint, and leads cannot. The repo's only copy (20260810180341) was older and let leads mint; this file
-- puts the live definition in the repo and adds one thing to it.
--
-- What it adds: the role must be one the workspace offers, the same rule as the invite dialog and the createInvite
-- server function (member-roles-shared.ts invitableRoles):
--   Member (em) and Coach: every workspace.
--   Lead: company workspaces only (orgs.has_firm_view).
--   Admin: business workspaces only (orgs.shows_admin_role).
-- So an admin calling make_invite from the browser cannot mint a Lead invite in a workspace without proposals.
-- Coach stays allowed here: the invite dialog's coach invites are minted through this same function.
--
-- It also stops signed-out callers from calling it at all (they were already refused inside, as they have no user).
-- Undo: supabase/undo/20261120200000_make_invite_offers_undo.sql puts back exactly the live definition and grants.

create or replace function public.make_invite(p_role app_role default 'em'::app_role, p_email text default null::text, p_org_id uuid default null::uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_code text; v_org uuid; v_creator uuid; v_firm boolean; v_admin boolean;
begin
  if p_org_id is not null then
    v_org := p_org_id;
  else
    select org_id into v_org from profiles
      where user_id = auth.uid() and role = 'admin';
    if (select count(*) from profiles where user_id = auth.uid() and role = 'admin') > 1 then
      raise exception 'multiple orgs: specify p_org_id';
    end if;
  end if;
  -- Admin-only by founder decision Aug 19: invites are workspace admission and
  -- are administered by org admins. Leads keep console read/resend/revoke but
  -- cannot mint. Engagement sharing with existing coaches is unaffected.
  select id into v_creator from profiles
    where user_id = auth.uid() and org_id = v_org and role = 'admin' and deactivated_at is null;
  if v_creator is null then raise exception 'not permitted'; end if;
  -- 20 Nov 2026: only a role this workspace offers. Lead where proposals live, Admin in business workspaces.
  select has_firm_view, shows_admin_role into v_firm, v_admin from orgs where id = v_org;
  if (p_role = 'lead' and not coalesce(v_firm, false)) or (p_role = 'admin' and not coalesce(v_admin, false)) then
    raise exception 'that role is not offered in this workspace' using errcode = '42501';
  end if;
  v_code := encode(gen_random_bytes(6),'hex');
  insert into invites (code, org_id, invited_role, created_by, email)
    values (v_code, v_org, p_role, v_creator, lower(p_email));
  return v_code;
end $function$;

revoke execute on function public.make_invite(app_role, text, uuid) from public, anon;
grant execute on function public.make_invite(app_role, text, uuid) to authenticated, service_role;
