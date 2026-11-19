-- Firm brain follow-up (19 Nov, Liam D-26): a board's outcome ("how it ended") may be changed only by a signed-in
-- person who has an active, non-guest profile in the board's own workspace and holds a non-coach seat on the board
-- with it. Before this, the one UPDATE policy on engagements let a guest seat change it by a direct call, and firm
-- answers read that outcome. Additive: one function and one trigger; no policy, column or row is changed. Calls with
-- no signed-in user (the service key, seeding) pass, as before.
create or replace function public.engagements_guard_outcome()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.outcome is distinct from old.outcome
     and auth.uid() is not null
     and not exists (
       select 1
         from public.engagement_members m
         join public.profiles p on p.id = m.profile_id
        where m.engagement_id = new.id
          and m.member_role <> 'coach'
          and p.user_id = auth.uid()
          and p.deactivated_at is null
          and not coalesce(p.is_guest, false)
          and p.org_id = new.org_id
     ) then
    raise exception 'outcome changes only by a member of the board''s own workspace who can edit it';
  end if;
  return new;
end;
$$;

create trigger engagements_t_guard_outcome
  before update of outcome on public.engagements
  for each row execute function public.engagements_guard_outcome();
