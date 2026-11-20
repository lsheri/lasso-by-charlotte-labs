-- Undo for supabase/migrations/20261120100000_roster_contact_details.sql. Not a migration: run it by hand, only to
-- take that file back. ONE PASTE. Safe to run twice: every statement is "if exists".
--
-- THIS DELETES DATA: every mobile number, email and LinkedIn address typed for a roster person is removed with the
-- table. The people themselves (roster_contacts) and every text agreement (message_consents) are left untouched.
-- Run it only after the app code that uses the table is no longer published: with the table gone, adding a person
-- says it did not go through.

drop function if exists public.roster_number_differs(uuid);
drop function if exists public.save_roster_contact(uuid, uuid, text, text, text, text, text, text, text, integer);
drop table if exists public.roster_contact_details;
drop function if exists public.roster_contact_details_guard();
