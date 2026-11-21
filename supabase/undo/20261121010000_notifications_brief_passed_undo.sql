-- Undo for 20261121010000_notifications_brief_passed.sql. Paste in the Supabase SQL editor. Safe to run twice.
-- Removes any 'brief_passed' notices (the old list cannot hold them), then puts back the list exactly as it was live
-- on 20 Nov 2026. Members' "Tell the admins" then says plainly that it did not reach them.

delete from public.notifications where kind = 'brief_passed';
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'invite_needs_approval', 'share_received', 'invite_decided', 'invite_accepted', 'seat_over_count', 'board_activity',
  'support_request', 'mention_received', 'sticky_assigned', 'sticky_done', 'firm_share_changed'
]::text[]));
