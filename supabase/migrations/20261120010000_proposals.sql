-- 20 Nov 2026: the Proposal Desk's first tables. A proposal exists before any board does (Liam, D-37: the team board
-- is made on the win), so it needs a row of its own, and the salesperson's context documents need a place to wait.
--
-- Adds only: three tables, their guard functions and one read function. No existing table, column, policy or
-- function changes. Safe to run twice.
--
-- Privacy floors:
--   * Company workspaces only, by the same check the proposal ledger uses.
--   * A proposal is read by its owner (the person who started it) and by admins and leads of that workspace.
--     Guests, coaches, deactivated people and people in another workspace read nothing.
--   * proposal_context_items lists which of the owner's work items belong to a proposal. Listing an item here opens
--     nothing: the item's own row rules still decide who can read its contents.
--   * No write policy on either table. Only the server (service role) writes, after checking the caller in code.
--   * No person is scored, ranked or counted. owner_id says whose proposal it is and nothing else.

-- 1. Proposals.
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  notes text check (notes is null or char_length(notes) <= 8000),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  -- When the brief came in. The turnaround goal counts from here.
  received_at timestamptz not null default now(),
  -- When the proposal went out to the client. Stops the turnaround clock.
  sent_at timestamptz,
  status text not null default 'open' check (status = any (array['open', 'won', 'lost']::text[])),
  decided_at timestamptz,
  -- The team board. Empty until the win makes it.
  engagement_id uuid references public.engagements(id) on delete set null,
  -- The lead picked for this proposal: a roster_contacts id. No foreign key, so this file does not depend on the
  -- roster file being run first; the server checks the contact is in the same workspace before writing it.
  lead_contact_id uuid,
  created_at timestamptz not null default now(),
  constraint proposals_sent_after_received check (sent_at is null or sent_at >= received_at),
  constraint proposals_decided_with_status check ((status = 'open') = (decided_at is null)),
  constraint proposals_board_only_when_won check (engagement_id is null or status = 'won')
);

create index if not exists proposals_org_status_idx on public.proposals (org_id, status, received_at desc);
create index if not exists proposals_owner_idx on public.proposals (owner_id);
-- One proposal per board: a board is made by exactly one win.
create unique index if not exists proposals_engagement_key on public.proposals (engagement_id)
  where engagement_id is not null;

-- 2. The salesperson's context documents and notes, in the order they should land on the board.
create table if not exists public.proposal_context_items (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  position smallint not null default 0 check (position >= 0),
  added_at timestamptz not null default now(),
  primary key (proposal_id, work_item_id)
);

create index if not exists proposal_context_items_item_idx on public.proposal_context_items (work_item_id);

-- 3. Guard: a proposal belongs to a company workspace, and its client, owner and board are in that same workspace.
create or replace function public.proposals_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.org_has_firm_view(new.org_id) then raise exception 'proposals are for company workspaces'; end if;
  if not exists (select 1 from clients c where c.id = new.client_id and c.org_id = new.org_id) then
    raise exception 'that client is not in this workspace';
  end if;
  if not exists (
    select 1 from profiles p
     where p.id = new.owner_id and p.org_id = new.org_id and not coalesce(p.is_guest, false) and p.role <> 'coach'
  ) then
    raise exception 'the owner is not a member of this workspace';
  end if;
  if new.engagement_id is not null
     and not exists (select 1 from engagements e where e.id = new.engagement_id and e.org_id = new.org_id) then
    raise exception 'that board is not in this workspace';
  end if;
  if tg_op = 'UPDATE' and (new.org_id <> old.org_id or new.owner_id <> old.owner_id) then
    raise exception 'a proposal keeps its workspace and its owner';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_t_guard on public.proposals;
create trigger proposals_t_guard
  before insert or update on public.proposals
  for each row execute function public.proposals_guard();

-- A context item must be a work item in the proposal's workspace that belongs to the proposal's owner.
create or replace function public.proposal_context_items_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from proposals p join work_items w on w.id = new.work_item_id
     where p.id = new.proposal_id and w.org_id = p.org_id and w.owner_id = p.owner_id
  ) then
    raise exception 'that work is not the proposal owner''s, or is in another workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_context_items_t_guard on public.proposal_context_items;
create trigger proposal_context_items_t_guard
  before insert or update on public.proposal_context_items
  for each row execute function public.proposal_context_items_guard();

-- 4. Who reads: the owner, and admins and leads of the same company workspace.
create or replace function public.can_read_proposal(p_org uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.firm_role_in(p_org) is not null
     and (public.is_my_profile(p_owner) or public.firm_role_in(p_org) in ('admin', 'lead'))
$$;

revoke all on function public.can_read_proposal(uuid, uuid) from public;
grant execute on function public.can_read_proposal(uuid, uuid) to authenticated, service_role;

alter table public.proposals enable row level security;
alter table public.proposal_context_items enable row level security;

drop policy if exists proposals_read on public.proposals;
create policy proposals_read on public.proposals
  for select to authenticated
  using (public.can_read_proposal(org_id, owner_id));

drop policy if exists proposal_context_items_read on public.proposal_context_items;
create policy proposal_context_items_read on public.proposal_context_items
  for select to authenticated
  using (exists (
    select 1 from public.proposals p
     where p.id = proposal_id and public.can_read_proposal(p.org_id, p.owner_id)
  ));

-- No write policy on either table: only the server (service role) writes.
revoke all on table public.proposals from anon, authenticated;
revoke all on table public.proposal_context_items from anon, authenticated;
grant select on table public.proposals to authenticated;
grant select on table public.proposal_context_items to authenticated;

-- 5. Demo workspaces only (Liam, D-50): the one cell number a demo's "Text the lead" goes to, typed by an admin of a
-- demo workspace with a tick that the person agreed. Real workspaces never have a row here: their people agree
-- themselves on /texts (message_consents). Same protections as message_consents: row security on, no policy, no
-- grant to the browser roles, so only the server's service role can read or write it. The number is never returned
-- to a browser, never put in an event and never logged.
create table if not exists public.demo_text_recipients (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  -- United States and Canada only, in one form: +1 and ten digits.
  phone_e164 text not null check (phone_e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  -- The admin ticked that this person agreed to receive the text. A row cannot exist without it.
  person_agreed boolean not null check (person_agreed),
  -- Who entered it and when. Never the number.
  set_by uuid references public.profiles(id) on delete set null,
  set_at timestamptz not null default now()
);

create or replace function public.demo_text_recipients_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from orgs o where o.id = new.org_id and o.settings->>'type' = 'company' and o.settings ? 'demo_firm'
  ) then
    raise exception 'a typed number is for demo workspaces only';
  end if;
  return new;
end;
$$;

drop trigger if exists demo_text_recipients_t_guard on public.demo_text_recipients;
create trigger demo_text_recipients_t_guard
  before insert or update on public.demo_text_recipients
  for each row execute function public.demo_text_recipients_guard();

alter table public.demo_text_recipients enable row level security;
-- No policy on purpose: with row security on, no policy means no rows for anon and authenticated.
revoke all on table public.demo_text_recipients from public, anon, authenticated;
grant select, insert, update, delete on table public.demo_text_recipients to service_role;

comment on table public.demo_text_recipients is
  'Demo workspaces only: the one number a demo text goes to. Holds a mobile number: service role only, no browser access, never copied into events or logs.';
