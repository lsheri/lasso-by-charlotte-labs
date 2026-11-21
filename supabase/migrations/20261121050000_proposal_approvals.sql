-- 21 Nov 2026, chat pill Phase 5 (D-97): the approval loop. The Lead sends the final version for approval; an Admin
-- approves it or asks for changes with one short note; approving marks the proposal as gone to the client ("Waiting on
-- the client"), and records who did. No new proposal status: that state is worked out in code from these rows.
--
-- Paste in the Supabase SQL editor, after the 4c SQL (it points at proposal_final_versions). Safe to run twice. Adds
-- only: one new table with its indexes, and one nullable column on proposals. Server only for the table: row security
-- on, no policy, no grant to signed-in or signed-out browsers.

create table if not exists public.proposal_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  final_version_id uuid not null references public.proposal_final_versions(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  decision text check (decision is null or decision = any (array['approved', 'changes_asked', 'withdrawn']::text[])),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  note text check (note is null or char_length(note) <= 1000),
  constraint proposal_approvals_decided_together check ((decision is null) = (decided_at is null))
);

-- At most one open request per proposal.
create unique index if not exists proposal_approvals_one_open
  on public.proposal_approvals (proposal_id) where decision is null;
create index if not exists proposal_approvals_org_idx on public.proposal_approvals (org_id, requested_at desc);

alter table public.proposal_approvals enable row level security;
revoke all on table public.proposal_approvals from public, anon, authenticated;
grant select, insert, update on table public.proposal_approvals to service_role;

comment on table public.proposal_approvals is
  'Approval requests for a proposal''s final version and their decisions: approved, changes asked or withdrawn, by whom, when, and an optional note to the Lead. Service role only.';

-- Who marked the proposal as gone to the client (approving does it too). Readable wherever the proposal row is.
alter table public.proposals add column if not exists sent_by uuid references public.profiles(id) on delete set null;

comment on column public.proposals.sent_by is
  'Who marked the proposal as gone to the client, or approved it, which does the same. Null when not sent.';
