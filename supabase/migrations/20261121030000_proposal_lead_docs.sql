-- 21 Nov 2026, chat pill PR 4b (D-97): the person who started a proposal can send its documents to the lead. One row
-- per proposal says which People row they went to, exactly which documents were sent (a document added later needs
-- a new send), who sent them and when. Changing the lead ends it: the documents open only while the row they went to
-- is still the lead. Stop sharing deletes the row.
--
-- Paste in the Supabase SQL editor, after the 4a SQL. Safe to run twice. Adds only: one new table. Server only: row
-- security on, no policy, no grant to signed-in or signed-out browsers, so nobody reads it from a browser (QA L3 of
-- PR 299: the earlier draft put two columns on proposals, which admins and leads could read from the browser).

create table if not exists public.proposal_lead_docs (
  proposal_id uuid primary key references public.proposals(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  contact_id uuid not null references public.roster_contacts(id) on delete cascade,
  item_ids uuid[] not null check (cardinality(item_ids) between 1 and 20),
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now()
);

alter table public.proposal_lead_docs enable row level security;
revoke all on table public.proposal_lead_docs from public, anon, authenticated;
grant select, insert, update, delete on table public.proposal_lead_docs to service_role;

comment on table public.proposal_lead_docs is
  'Which documents the person who started a proposal sent to its lead, to which People row, by whom and when. They open only for that row while it is still the lead. Service role only.';
