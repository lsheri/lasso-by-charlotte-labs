-- Undo for 20261120200000_make_invite_offers.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Puts back make_invite exactly as it was live on 20 Nov 2026 (Admin-only, any role), and its grants.

create or replace function public.make_invite(p_role app_role default 'em'::app_role, p_email text default null::text, p_org_id uuid default null::uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_code text; v_org uuid; v_creator uuid;
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
  v_code := encode(gen_random_bytes(6),'hex');
  insert into invites (code, org_id, invited_role, created_by, email)
    values (v_code, v_org, p_role, v_creator, lower(p_email));
  return v_code;
end $function$;

grant execute on function public.make_invite(app_role, text, uuid) to public, anon, authenticated, service_role;
