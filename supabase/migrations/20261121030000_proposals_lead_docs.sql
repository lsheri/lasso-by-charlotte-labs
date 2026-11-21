-- 21 Nov 2026, chat pill PR 4b (D-97): the person who started a proposal can send its documents to the lead. Two
-- nullable columns on proposals say which People row they were sent to and when. Changing the lead ends it, because
-- the documents open only while the row they went to is still the lead. Nothing else changes.
--
-- Paste in the Supabase SQL editor. Safe to run twice. Adds only. Writes stay server only, as for every proposals
-- column; the browser's existing read rule on proposals is unchanged.

alter table public.proposals add column if not exists lead_docs_to uuid references public.roster_contacts(id) on delete set null;
alter table public.proposals add column if not exists lead_docs_at timestamptz;

comment on column public.proposals.lead_docs_to is
  'The People row (roster_contacts) the documents were sent to. They open for that teammate only while that row is still the lead.';
comment on column public.proposals.lead_docs_at is
  'When the person who started the proposal sent its documents to the lead.';
