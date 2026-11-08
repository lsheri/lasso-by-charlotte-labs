-- VID-1 (8 Nov 2026): a dropped video stays on the board as a playable card.
--
-- A video card is like an image card: a file in the work-files bucket plus a
-- rectangle. Nothing is read from it: no description, no work item, Ask never
-- sees it. The image_text columns stay image-only (existing check).
--
-- Also closes the IMG-4 leftover: a card's "create" history entry no longer
-- copies the (always empty at creation) image description columns.
--
-- Paste in the SQL editor, then merge the PR. Checks at the bottom.

alter table public.workboard_nodes drop constraint workboard_nodes_kind_check;
alter table public.workboard_nodes add constraint workboard_nodes_kind_check
  check (kind = any (array['brief','work_item','decision','judgment','draft','shape','text','mark','answer','sticky','image','video']));

alter table public.workboard_nodes drop constraint workboard_nodes_shape;
alter table public.workboard_nodes add constraint workboard_nodes_shape check (
  (kind = 'brief' and work_item_id is null and decision_id is null)
  or (kind = 'work_item' and work_item_id is not null and decision_id is null)
  or (kind = 'decision' and decision_id is not null and work_item_id is null)
  or (kind = any (array['judgment','draft','shape','text','mark','answer','sticky','image','video']) and work_item_id is null and decision_id is null)
);

create or replace function public.workboard_row_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.workboard_revisions (workboard_id, entity_kind, entity_id, revision, action, actor_profile_id, change)
  values (
    new.workboard_id, TG_ARGV[0], new.id, new.version, 'create', new.created_by,
    case when TG_ARGV[0] = 'node'
      then jsonb_build_object('after', to_jsonb(new) - array['image_text', 'image_text_status', 'image_text_at'])
      else jsonb_build_object('after', to_jsonb(new))
    end
  );
  return new;
end
$function$;

-- Clean the create entries written since IMG-4 (the columns were null there).
update public.workboard_revisions
   set change = jsonb_build_object('after', (change->'after') - array['image_text', 'image_text_status', 'image_text_at'])
 where entity_kind = 'node' and action = 'create' and change->'after' ? 'image_text';

-- Checks (expect: 'video' in the list, 0):
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'workboard_nodes_kind_check';
-- select count(*) from public.workboard_revisions where entity_kind = 'node' and (change->'before' ? 'image_text' or change->'after' ? 'image_text');
