-- Undo for 20261121040000_proposal_final_versions.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Drops the record of which final proposal each Lead chose. The documents themselves stay in their owners' work.
-- Run Phase 5's undo first if its proposal_approvals table exists, because it points at this one.

drop table if exists public.proposal_final_versions;
