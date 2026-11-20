-- 20 Nov 2026, Proposal Desk: asking a lead by text and reading the reply (Liam, Q-52: "Reply YES or NO to a real
-- text"), a way to close or archive a proposal, and a guard on workspace settings found by QA.
--
-- Safe to run twice: every statement is "if not exists", "or replace", "drop ... if exists" then create, or a grant
-- or revoke that changes nothing the second time.
--
-- This file only adds. No column, row, index or policy is removed or changed. One existing table gains one
-- column (proposals.archived_at), and the orgs table gains one trigger beside the one it has.

-- 1. One row per text the Proposal Desk sends about a proposal. No phone number is ever stored here: the row
-- names the roster person (or says "the demo number"), and the number is read from the agreements table at the
-- moment of sending. A reply is one of three words and nothing else is kept.
create table if not exists public.proposal_texts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  kind text not null check (kind = any (array['lead_ask', 'won_notice']::text[])),
  -- The roster person the text is for. Empty when it goes to a demo workspace's demo number.
  contact_id uuid,
  to_demo boolean not null default false,
  -- One id per opened preview, so a double click or a retry is the same send.
  press_id uuid not null,
  sent_by uuid references public.profiles(id) on delete set null,
  -- The sender's own id for the message, used to match delivery reports.
  provider_id text,
  status text not null default 'queued' check (status = any (array[
    'queued', 'accepted', 'sent', 'delivered', 'undelivered', 'failed', 'rejected', 'expired', 'opted_out', 'practice'
  ]::text[])),
  status_at timestamptz,
  reply text check (reply is null or reply = any (array['yes', 'no', 'stop']::text[])),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint proposal_texts_one_target check ((contact_id is not null) <> to_demo),
  constraint proposal_texts_reply_time check ((reply is null) = (replied_at is null))
);

create unique index if not exists proposal_texts_press_key on public.proposal_texts (proposal_id, kind, press_id);
create unique index if not exists proposal_texts_provider_key on public.proposal_texts (provider_id)
  where provider_id is not null;
create index if not exists proposal_texts_org_day_idx on public.proposal_texts (org_id, created_at desc);
create index if not exists proposal_texts_waiting_idx on public.proposal_texts (org_id, contact_id, created_at desc)
  where reply is null;

-- A text belongs to one workspace: its proposal, its roster person and its sender are all in that workspace, and
-- it never moves.
create or replace function public.proposal_texts_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from proposals p where p.id = new.proposal_id and p.org_id = new.org_id) then
    raise exception 'that proposal is not in this workspace';
  end if;
  if new.contact_id is not null
     and not exists (select 1 from roster_contacts r where r.id = new.contact_id and r.org_id = new.org_id) then
    raise exception 'that person is not on this workspace''s list';
  end if;
  if new.sent_by is not null
     and not exists (select 1 from profiles p where p.id = new.sent_by and p.org_id = new.org_id) then
    raise exception 'the sender is not in this workspace';
  end if;
  if tg_op = 'UPDATE' and (new.org_id <> old.org_id or new.proposal_id <> old.proposal_id
     or new.contact_id is distinct from old.contact_id or new.to_demo <> old.to_demo or new.kind <> old.kind) then
    raise exception 'a text keeps its workspace, its proposal and its recipient';
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_texts_t_guard on public.proposal_texts;
create trigger proposal_texts_t_guard
  before insert or update on public.proposal_texts
  for each row execute function public.proposal_texts_guard();

-- The server only. No page reads or writes this table directly, so there is no policy for signed-in people.
alter table public.proposal_texts enable row level security;
revoke all on public.proposal_texts from anon, authenticated;
grant all on public.proposal_texts to service_role;

-- 2. Each delivery report or reply the sender posts to us carries an id. It is kept here so the same one is never
-- acted on twice. Nothing else about the event is stored.
create table if not exists public.text_webhook_events (
  id text primary key check (char_length(id) between 1 and 200),
  received_at timestamptz not null default now()
);

create index if not exists text_webhook_events_received_idx on public.text_webhook_events (received_at desc);

alter table public.text_webhook_events enable row level security;
revoke all on public.text_webhook_events from anon, authenticated;
grant all on public.text_webhook_events to service_role;

-- 3. A proposal made by mistake can be archived by an admin. Archived proposals leave the page; nothing is deleted.
alter table public.proposals
  add column if not exists archived_at timestamptz;

-- 4. Workspace settings (QA, 19 Nov). A signed-in admin or lead may still save ordinary settings from the
-- browser, but can no longer:
--   - replace the settings with something that is not a list of settings (QA wrote a piece of text there),
--   - add, change or remove the demo marker, which switches on the typed demo number,
--   - remove the workspace's type, or change it away from company or partner (which could not be put back).
-- The server (service role) and the SQL editor have no signed-in person and are not held by this. Charlotte Labs
-- operations staff may still change a type, as before.
create or replace function public.orgs_guard_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  was jsonb;
  ops boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.settings is not distinct from old.settings then return new; end if;
  if new.settings is null or jsonb_typeof(new.settings) <> 'object' then
    raise exception 'workspace settings must stay a list of settings' using errcode = '42501';
  end if;
  was := case when jsonb_typeof(old.settings) = 'object' then old.settings else '{}'::jsonb end;
  if (new.settings -> 'demo_firm') is distinct from (was -> 'demo_firm') then
    raise exception 'the demo marker cannot be changed from here' using errcode = '42501';
  end if;
  if was ? 'type' and (new.settings -> 'type') is distinct from (was -> 'type') then
    ops := public.is_platform_admin(auth.uid(), 'ops');
    if not ops and (not (new.settings ? 'type') or (was ->> 'type') in ('company', 'partner')) then
      raise exception 'only Charlotte Labs can change this workspace''s type' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orgs_guard_settings on public.orgs;
create trigger orgs_guard_settings
  before update on public.orgs
  for each row execute function public.orgs_guard_settings();
