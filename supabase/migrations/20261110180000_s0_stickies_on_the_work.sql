-- S0, 10 Nov 2026: stickies on the work (SCOPE-nov10-STICKIES-on-the-work). Approved by Liam 10 Nov.
-- Additive only. No row is changed, no column removed, no function replaced. Applied by the architect
-- through the Supabase connector; no Lovable agent touches schema.
--
-- A sticky is a third kind of board annotation (beside comment and highlight). It belongs to the board
-- (workboard_id), sits on a spot in a piece of work, can be assigned to someone on the board, and can be
-- marked done. Existing policies already let only the author create, edit and remove it. Marking done by
-- the assignee arrives in S4 as one security definer function, with its own migration.
--
-- PostHog and Data Portal changes this needs (owed in S2 and S4, not in this file):
--   events, additive, workboard allowlist + Data Portal catalog rows in the same unit:
--     workboard.sticky_created  {anchor_kind, work_kind, assigned, visibility}      (S2; assigned in S4)
--     workboard.sticky_removed  {anchor_kind}                                       (S2)
--     workboard.sticky_opened   {from: notification | list | pin}                   (S2; notification in S4)
--     workboard.sticky_done     {via: view | inbox}                                 (S4)
--     workboard.sticky_reopened {}                                                  (S4)
--   PostHog: event definitions with descriptions for the five; one "Stickies" tile on the workboard
--   dashboard (created, done, by anchor kind and work kind). No dimension names a person, carries a
--   duration, or counts per person.

alter table public.workboard_annotations
  add column if not exists pos_x real,
  add column if not exists pos_y real,
  add column if not exists fill text,
  add column if not exists row_key text,
  add column if not exists assignee_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists done_at timestamptz,
  add column if not exists done_by uuid references public.profiles(id) on delete set null;

comment on column public.workboard_annotations.pos_x is 'Sticky position inside its anchor, 0 to 1 from the left.';
comment on column public.workboard_annotations.pos_y is 'Sticky position inside its anchor, 0 to 1 from the top.';
comment on column public.workboard_annotations.fill is 'Sticky colour key: yellow, green (mint), blue (turquoise), pink, grey.';
comment on column public.workboard_annotations.row_key is 'Sheet row a sticky sits on, when anchor_kind = row.';
comment on column public.workboard_annotations.assignee_profile_id is 'Board member a sticky is assigned to. Board-visible stickies only.';

-- Kinds and anchors: widen the allowed lists.
alter table public.workboard_annotations drop constraint if exists workboard_annotations_kind_check;
alter table public.workboard_annotations add constraint workboard_annotations_kind_check
  check (kind = any (array['comment'::text, 'highlight'::text, 'sticky'::text]));

alter table public.workboard_annotations drop constraint if exists workboard_annotations_anchor_kind_check;
alter table public.workboard_annotations add constraint workboard_annotations_anchor_kind_check
  check (anchor_kind = any (array['turn'::text, 'section'::text, 'page'::text, 'item'::text, 'row'::text, 'media'::text]));

alter table public.workboard_annotations drop constraint if exists wa_anchor;
alter table public.workboard_annotations add constraint wa_anchor check (
  (anchor_kind = 'item'::text)
  or ((anchor_kind = 'turn'::text) and (turn_no is not null))
  or ((anchor_kind = 'section'::text) and (section_key is not null))
  or ((anchor_kind = 'page'::text) and (page_no is not null))
  or ((anchor_kind = 'row'::text) and (row_key is not null))
  or (anchor_kind = 'media'::text)
);

-- A sticky has words, a place on its anchor and a colour.
alter table public.workboard_annotations add constraint wa_sticky check (
  kind <> 'sticky'::text
  or (
    char_length(btrim(body)) > 0
    and pos_x between 0 and 1
    and pos_y between 0 and 1
    and fill = any (array['yellow'::text, 'green'::text, 'blue'::text, 'pink'::text, 'grey'::text])
  )
);
-- Only stickies carry a place, an assignee or a done mark.
alter table public.workboard_annotations add constraint wa_sticky_only check (
  kind = 'sticky'::text
  or (pos_x is null and pos_y is null and fill is null and assignee_profile_id is null and done_at is null and done_by is null)
);
-- A just-me sticky is never assigned.
alter table public.workboard_annotations add constraint wa_sticky_assignee check (
  assignee_profile_id is null or visibility = 'engagement'::text
);
-- Done is both fields or neither.
alter table public.workboard_annotations add constraint wa_sticky_done check (
  (done_at is null) = (done_by is null)
);

-- Open stickies by assignee (the "for you" read) and by piece of work (the card's corner sticky).
create index if not exists workboard_annotations_open_assignee_idx
  on public.workboard_annotations (assignee_profile_id)
  where kind = 'sticky' and done_at is null and archived_at is null;
create index if not exists workboard_annotations_open_sticky_item_idx
  on public.workboard_annotations (workboard_id, work_item_id)
  where kind = 'sticky' and done_at is null and archived_at is null;

-- Notifications: a sticky assigned to you (needs you) and your sticky marked done (updates).
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'invite_needs_approval'::text, 'share_received'::text, 'invite_decided'::text, 'invite_accepted'::text,
  'seat_over_count'::text, 'board_activity'::text, 'support_request'::text, 'mention_received'::text,
  'sticky_assigned'::text, 'sticky_done'::text
]));

alter table public.notifications drop constraint if exists notifications_subject_type_check;
alter table public.notifications add constraint notifications_subject_type_check check (subject_type = any (array[
  'board_invite'::text, 'engagement'::text, 'org'::text, 'annotation'::text
]));
