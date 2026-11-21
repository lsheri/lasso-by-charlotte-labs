-- 20 Nov 2026, chat pill PR 3a (D-111): the client's due date on a proposal, read from a pasted brief in code (or left
-- empty). One nullable date column; nothing else changes. Paste in the Supabase SQL editor. Safe to run twice.
-- Who can read it: whoever can read the proposal row already (its owner, admins and leads); writes stay server only.

alter table public.proposals add column if not exists client_due_on date;

comment on column public.proposals.client_due_on is
  'The date the client wants the proposal by, as the brief said it (worked out in code). Null when the brief gave none.';
