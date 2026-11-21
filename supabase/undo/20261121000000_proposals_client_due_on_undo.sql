-- Undo for 20261121000000_proposals_client_due_on.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Drops the due date column and any dates in it. The app makes proposals without it (it retries without the column).

alter table public.proposals drop column if exists client_due_on;
