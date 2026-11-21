-- Undo for 20261121030000_proposal_lead_docs.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Drops the record of documents sent to leads. Leads can no longer open documents (the app says sending works once
-- the update is in); proposals, their documents and everything else stay.

drop table if exists public.proposal_lead_docs;
