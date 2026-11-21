-- 21 Nov 2026, chat pill PR 4a (D-97): a proposal's Lead can be a teammate with a login. A person on "People we work
-- with" (roster_contacts) can be linked to one teammate's profile in the same workspace. Texts still go only to the
-- number that person agreed with on their own link; the link adds no contact details and sends nothing.
--
-- Paste in the Supabase SQL editor. Safe to run twice. Adds only: one nullable column, one partial unique index, and a
-- new version of the roster guard that also checks the linked profile. No row changes.
--
-- Who can read it: nobody from a browser. roster_contacts stays server only (row security on, no policy, no grant to
-- anon or authenticated), so the link is read and written only by roster.server.ts after it checks the caller.

-- 1. The link. Removing the profile removes the link, never the person.
alter table public.roster_contacts
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

-- 2. One People row per teammate in a workspace.
create unique index if not exists roster_contacts_profile_key
  on public.roster_contacts (org_id, profile_id) where profile_id is not null;

-- 3. The guard, as before, plus: a linked profile is an active teammate of the same workspace (never a guest, a coach
-- or someone from another workspace).
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
  if new.profile_id is not null
     and (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id)
     and not exists (
       select 1 from public.profiles p
        where p.id = new.profile_id
          and p.org_id = new.org_id
          and not coalesce(p.is_guest, false)
          and p.role <> 'coach'
          and p.deactivated_at is null
     ) then
    raise exception 'that teammate is not an active member of this workspace';
  end if;
  return new;
end;
$$;

revoke all on function public.roster_contacts_guard() from public, anon, authenticated;

comment on column public.roster_contacts.profile_id is
  'The teammate this person is, when they have a login in the same workspace. Adds no contact details. Server only.';
