-- Step 9 (firm brain): the proposal ledger, the record behind the "value so far" line. One row per proposal event,
-- per board, with dates and counts only. No person column exists in either table, so no number can be grouped by
-- person. Fees sit in their own table that only admins and leads read.

-- 1. Events.
create table if not exists public.proposal_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  kind text not null check (kind = any (array[
    'brief_received', 'draft_completed', 'questions_sent', 'answers_received', 'sent_to_client', 'won', 'lost',
    'red_pen_run'
  ]::text[])),
  occurred_at timestamptz not null default now(),
  source_ref uuid,
  sections_total smallint check (sections_total is null or sections_total >= 0),
  sections_sourced smallint check (sections_sourced is null or sections_sourced >= 0),
  questions_prepared smallint check (questions_prepared is null or questions_prepared >= 0),
  claims_unsupported smallint check (claims_unsupported is null or claims_unsupported >= 0),
  created_at timestamptz not null default now(),
  constraint proposal_ledger_sourced_within_total check (
    sections_sourced is null or (sections_total is not null and sections_sourced <= sections_total)
  ),
  constraint proposal_ledger_counts_by_kind check (
    (kind = 'draft_completed' or (sections_total is null and sections_sourced is null and questions_prepared is null))
    and (kind = 'red_pen_run' or claims_unsupported is null)
  )
);

create index if not exists proposal_ledger_engagement_idx on public.proposal_ledger (engagement_id, occurred_at);
-- A dated step happens once per proposal; a proposal has one outcome; a draft or run is counted once.
create unique index if not exists proposal_ledger_once_idx on public.proposal_ledger (engagement_id, kind)
  where kind in ('brief_received', 'questions_sent', 'answers_received', 'sent_to_client', 'won', 'lost');
create unique index if not exists proposal_ledger_outcome_idx on public.proposal_ledger (engagement_id)
  where kind in ('won', 'lost');
create unique index if not exists proposal_ledger_source_idx on public.proposal_ledger (kind, source_ref)
  where source_ref is not null;

-- 2. Value: one current figure per proposal.
create table if not exists public.proposal_ledger_values (
  engagement_id uuid primary key references public.engagements(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);

-- 3. Rows belong to a board in the same company workspace.
create or replace function public.proposal_ledger_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.org_has_firm_view(new.org_id) then raise exception 'the proposal ledger is for company workspaces'; end if;
  if not exists (select 1 from engagements e where e.id = new.engagement_id and e.org_id = new.org_id) then
    raise exception 'that board is not in this workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_ledger_t_guard on public.proposal_ledger;
create trigger proposal_ledger_t_guard
  before insert or update on public.proposal_ledger
  for each row execute function public.proposal_ledger_guard();

drop trigger if exists proposal_ledger_values_t_guard on public.proposal_ledger_values;
create trigger proposal_ledger_values_t_guard
  before insert or update on public.proposal_ledger_values
  for each row execute function public.proposal_ledger_guard();

-- 4. Who reads. Dates and counts: the board's owner, and admins and leads while the board is shared with the firm.
-- Value: admins and leads only, on their own board or a shared one. Guests and coaches: nothing. An unshared board
-- is never counted for anyone but its owner.
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
            or (public.firm_role_in(p_org) in ('admin', 'lead') and e.shared_with_firm and e.archived_at is null))
  )
$$;

revoke all on function public.can_read_proposal_ledger(uuid, uuid, boolean) from public;
grant execute on function public.can_read_proposal_ledger(uuid, uuid, boolean) to authenticated, service_role;

alter table public.proposal_ledger enable row level security;
alter table public.proposal_ledger_values enable row level security;

drop policy if exists proposal_ledger_read on public.proposal_ledger;
create policy proposal_ledger_read on public.proposal_ledger
  for select to authenticated
  using (public.can_read_proposal_ledger(org_id, engagement_id, false));

drop policy if exists proposal_ledger_values_read on public.proposal_ledger_values;
create policy proposal_ledger_values_read on public.proposal_ledger_values
  for select to authenticated
  using (public.can_read_proposal_ledger(org_id, engagement_id, true));

-- No write policy on either table: only the server (service role) writes.
revoke all on table public.proposal_ledger from anon, authenticated;
revoke all on table public.proposal_ledger_values from anon, authenticated;
grant select on table public.proposal_ledger to authenticated;
grant select on table public.proposal_ledger_values to authenticated;
