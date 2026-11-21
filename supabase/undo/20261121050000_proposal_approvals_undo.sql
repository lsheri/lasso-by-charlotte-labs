-- Undo for 20261121050000_proposal_approvals.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Drops approval requests and decisions and who marked a proposal sent. When each proposal went out (sent_at) stays,
-- so the clock still stops where it did. Dropping the tables also drops their grants and revokes.

drop table if exists public.proposal_approvals;
drop table if exists public.proposal_sent_marks;
