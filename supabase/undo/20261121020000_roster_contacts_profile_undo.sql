-- Undo for 20261121020000_roster_contacts_profile.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Drops the link from People rows to teammates' logins and puts the roster guard back as it was. People rows, their
-- details and their agreements to texts stay. The app keeps working: a teammate picked as lead simply has no link.

drop index if exists public.roster_contacts_profile_key;
alter table public.roster_contacts drop column if exists profile_id;

create or replace function public.roster_contacts_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'a roster entry stays in its workspace';
  end if;
  if not public.org_has_firm_view(new.org_id) then
    raise exception 'the roster is for company workspaces';
  end if;
  return new;
end;
$$;

revoke all on function public.roster_contacts_guard() from public, anon, authenticated;
