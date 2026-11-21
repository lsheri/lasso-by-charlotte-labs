-- Undo for 20261121030000_proposals_lead_docs.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Drops the two columns. Leads can no longer open documents (the app says sending works once the update is in);
-- proposals, their documents and everything else stay.

alter table public.proposals drop column if exists lead_docs_at;
alter table public.proposals drop column if exists lead_docs_to;
