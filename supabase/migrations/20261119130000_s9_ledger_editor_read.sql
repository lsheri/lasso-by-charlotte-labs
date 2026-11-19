-- Step 9 follow-up (firm brain): an admin or lead who can edit a board that is not shared with the firm may read the
-- proposal ledger rows and value for it, so a value she saves can be read back. One clause is added to the read rule;
-- no table, column, policy or grant changes. Guests, coaches and other workspaces still read nothing.
create or replace function public.can_read_proposal_ledger(p_org uuid, p_engagement uuid, p_fee boolean)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from engagements e
     where e.id = p_engagement and e.org_id = p_org
       and public.firm_role_in(p_org) is not null
       and (not p_fee or public.firm_role_in(p_org) in ('admin', 'lead'))
       and (public.is_my_profile(e.owner_id)
            or (public.firm_role_in(p_org) in ('admin', 'lead') and e.shared_with_firm and e.archived_at is null)
            or (public.firm_role_in(p_org) in ('admin', 'lead')
                and exists (select 1 from engagement_members m join profiles p on p.id = m.profile_id
                             where m.engagement_id = e.id and p.user_id = auth.uid() and p.org_id = p_org
                               and p.deactivated_at is null and not coalesce(p.is_guest, false)
                               and m.member_role <> 'coach')))
  )
$$;

revoke all on function public.can_read_proposal_ledger(uuid, uuid, boolean) from public;
revoke all on function public.can_read_proposal_ledger(uuid, uuid, boolean) from anon;
grant execute on function public.can_read_proposal_ledger(uuid, uuid, boolean) to authenticated, service_role;
