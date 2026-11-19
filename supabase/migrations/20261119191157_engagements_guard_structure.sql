-- Firm brain follow-up (19 Nov, Liam D-29): for a signed-in person, a board can never be moved to another workspace,
-- and its owner and its archived state can be changed only by someone with an active, non-guest profile in the
-- board's own workspace (the rule the archive functions already state, minus guests). Before this, the one UPDATE
-- policy on engagements let a guest seat do all three by a direct call, and archive_container let a guest archive
-- any board in the workspace. Additive: one function and one trigger; no policy, column or row is changed. Calls
-- with no signed-in user (the service key, seeding) pass, as before.
create or replace function public.engagements_guard_structure()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'a board cannot be moved to another workspace';
  end if;
  if (new.owner_id is distinct from old.owner_id or new.archived_at is distinct from old.archived_at)
     and not public.is_org_insider(old.org_id) then
    raise exception 'only a member of the board''s own workspace can change its owner or archive it';
  end if;
  return new;
end;
$$;

create trigger engagements_t_guard_structure
  before update of org_id, owner_id, archived_at on public.engagements
  for each row execute function public.engagements_guard_structure();
