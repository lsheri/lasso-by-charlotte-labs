-- 19 Nov 2026, Proposal Desk: roster_contacts, the people a firm works with who have no login.
-- A name, a role or specialty, and whether they are independent or at a firm. No phone number and no email.
-- Read and written by two server functions (roster.server.ts) with the service role, for admins and leads only.
--
-- Safe to run twice: every statement is "if not exists", "or replace", "drop if exists then create", or a grant or
-- revoke that changes nothing the second time. Adds only: one new table, one new function and trigger on it, and
-- one new nullable column and index on message_consents. No existing column, policy or row changes.

-- 1. The roster.
create table if not exists public.roster_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role_title text check (role_title is null or char_length(role_title) between 1 and 120),
  affiliation text not null default 'independent' check (affiliation in ('independent', 'firm')),
  firm_name text check (firm_name is null or char_length(firm_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Someone at a firm has the firm's name; someone independent has none.
  constraint roster_contacts_firm_named check ((affiliation = 'firm') = (firm_name is not null))
);

create index if not exists roster_contacts_org_idx on public.roster_contacts (org_id, full_name);

-- 2. A roster belongs to a company workspace, and a person never moves between workspaces.
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

drop trigger if exists roster_contacts_t_guard on public.roster_contacts;
create trigger roster_contacts_t_guard
  before insert or update on public.roster_contacts
  for each row execute function public.roster_contacts_guard();

-- 3. Who reads and writes: the server only. Row security is on with no policy, and the browser roles hold no grant,
-- so no signed-in or signed-out browser can read, add, change or remove a row. The server functions check that the
-- caller is an admin or a lead of the workspace before they touch it.
alter table public.roster_contacts enable row level security;
revoke all on table public.roster_contacts from public, anon, authenticated;
grant select, insert, update on table public.roster_contacts to service_role;
revoke all on function public.roster_contacts_guard() from public, anon, authenticated;

comment on table public.roster_contacts is
  'People a firm works with who have no login. Name, role and firm only: never a phone number or an email. Service role only.';

-- 4. An agreement to texts can now say whose it is. The link an admin copies carries the person; the server checks
-- that person is in the link's workspace before it stores the tie. Removing a person keeps their agreement.
-- One live agreement per person: the first number to agree through a person's link stays theirs until it is stopped,
-- so a link passed on later cannot swap in another number.
alter table public.message_consents
  add column if not exists roster_contact_id uuid references public.roster_contacts(id) on delete set null;

create unique index if not exists message_consents_live_contact_idx
  on public.message_consents (roster_contact_id)
  where roster_contact_id is not null and revoked_at is null;
