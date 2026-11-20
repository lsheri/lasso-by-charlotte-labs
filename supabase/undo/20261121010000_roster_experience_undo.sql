-- Undo for supabase/migrations/20261121010000_roster_experience.sql. Not a migration: run it by hand, only to take
-- that file back. ONE PASTE. Safe to run twice: every statement is "if exists".
--
-- THIS DELETES DATA: every experience blurb and every document listed on a roster person is removed with the tables.
-- The people themselves (roster_contacts), their contact details and their text agreements are left untouched.
-- Run it only after the app code that uses these tables is no longer published: with them gone, the Experience
-- dialog says experience is not switched on.
--
-- The files themselves: Supabase does not let SQL delete stored files, and a bucket that still holds files cannot be
-- removed. Before running the last statement, open Storage in the Supabase dashboard, open roster-experience, select
-- every folder and delete it. If the bucket still holds files, the last statement stops with an error and everything
-- above it has already been undone; empty the bucket and run this file again.

drop table if exists public.roster_contact_experience_files;
drop table if exists public.roster_contact_experience;
drop function if exists public.roster_experience_guard();
delete from storage.buckets where id = 'roster-experience';
