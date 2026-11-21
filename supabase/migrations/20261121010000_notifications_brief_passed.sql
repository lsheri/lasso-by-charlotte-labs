-- 20 Nov 2026, chat pill PR 3b (D-111): a Member's pasted brief reaches the admins as a notification of kind
-- 'brief_passed'. Adds that one kind to the allowed list; every existing kind stays. Paste in the Supabase SQL editor.
-- Safe to run twice. The notice uses the existing subject type 'org', so that list is unchanged.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'invite_needs_approval', 'share_received', 'invite_decided', 'invite_accepted', 'seat_over_count', 'board_activity',
  'support_request', 'mention_received', 'sticky_assigned', 'sticky_done', 'firm_share_changed',
  'brief_passed'
]::text[]));
