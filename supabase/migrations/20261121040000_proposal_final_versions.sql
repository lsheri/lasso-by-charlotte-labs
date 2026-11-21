-- 21 Nov 2026, chat pill PR 4c (D-97): the Lead decides the final proposal. Each choice is a new row; the latest one
-- counts, so the Admin approves exactly the version the Lead chose (Phase 5). Which document and version, who chose
-- it and when. No words are copied: the document stays a work item with its own rules.
--
-- Paste in the Supabase SQL editor. Safe to run twice. Adds only: one new table and its index. Server only, like
-- proposals' writes: row security on, no policy, no grant to signed-in or signed-out browsers.

create table if not exists public.proposal_final_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  document_version_id uuid references public.document_versions(id) on delete set null,
  chosen_by uuid references public.profiles(id) on delete set null,
  chosen_at timestamptz not null default now()
);

create index if not exists proposal_final_versions_proposal_idx
  on public.proposal_final_versions (proposal_id, chosen_at desc);

alter table public.proposal_final_versions enable row level security;
revoke all on table public.proposal_final_versions from public, anon, authenticated;
grant select, insert on table public.proposal_final_versions to service_role;

comment on table public.proposal_final_versions is
  'The final proposal a Lead chose: document and version, who and when. A new row per choice; the latest counts. Service role only.';
