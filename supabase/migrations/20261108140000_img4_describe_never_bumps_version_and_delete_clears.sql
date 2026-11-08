-- IMG-4 (8 Nov 2026): an image description never makes a board look stale, and
-- a deleted image leaves nothing behind for Ask to read.
--
-- Bug (VERIFIED 8 Nov): the server writes an image's description onto its card
-- row a few seconds after the drop. workboard_row_touch bumped the card's
-- version on that write, so a delete sent with the version the board loaded was
-- refused ("A newer version of this record was saved"). The board had already
-- removed the image file, so "Load latest" brought back a live card with no
-- file: a blank ghost (card 9ded233d on "D8 - Liam Plan"), whose 788-character
-- description Ask would still read. The same write also copied the full
-- description into workboard_revisions.
--
-- 1. workboard_row_touch: a node update that changes only the image description
--    columns is system metadata: no version bump, no updated_at, no revision.
--    Revisions of nodes never carry the description columns.
-- 2. workboard_nodes_image_text_guard: archiving an image clears its
--    description in the same write (allowed for the person deleting). A restore
--    leaves it empty; Ask re-describes it on next read.
-- 3. Cleanup: remove description copies already in workboard_revisions, and
--    archive the ghost card on "D8 - Liam Plan" (its file is already gone).
--
-- Run as one script. Check queries at the bottom.

create or replace function public.workboard_row_touch()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
  declare
    v_action text;
    v_image_cols text[] := array['image_text', 'image_text_status', 'image_text_at'];
  begin
    -- IMG-4: a description-only write is system metadata, never a user edit.
    if TG_ARGV[0] = 'node'
       and (to_jsonb(new) - v_image_cols) = (to_jsonb(old) - v_image_cols) then
      return new;
    end if;
    new.updated_at := now();
    new.version := old.version + 1;
    if coalesce(current_setting('lasso.system_write', true), '') = 'on' then return new; end if;
    if old.deleted_at is null and new.deleted_at is not null then v_action := 'archive';
    elsif old.deleted_at is not null and new.deleted_at is null then v_action := 'restore';
    else v_action := 'update'; end if;
    insert into public.workboard_revisions (workboard_id, entity_kind, entity_id, revision, action, actor_profile_id, change)
    values (
      new.workboard_id, TG_ARGV[0], new.id, new.version, v_action, new.updated_by,
      case when TG_ARGV[0] = 'node'
        then jsonb_build_object('before', to_jsonb(old) - v_image_cols, 'after', to_jsonb(new) - v_image_cols)
        else jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      end
    );
    return new;
  end
$function$;

create or replace function public.workboard_nodes_image_text_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- IMG-4: deleting an image deletes its description in the same write.
  if tg_op = 'UPDATE' and new.kind = 'image' and old.deleted_at is null and new.deleted_at is not null then
    new.image_text := null;
    new.image_text_status := null;
    new.image_text_at := null;
    return new;
  end if;
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.image_text is not null or new.image_text_status is not null or new.image_text_at is not null then
      raise exception 'image descriptions are written by Lasso only' using errcode = '42501';
    end if;
  elsif new.image_text is distinct from old.image_text
     or new.image_text_status is distinct from old.image_text_status
     or new.image_text_at is distinct from old.image_text_at then
    raise exception 'image descriptions are written by Lasso only' using errcode = '42501';
  end if;
  return new;
end $function$;

-- 3a. No description copies in history.
update public.workboard_revisions
   set change = jsonb_build_object(
     'before', (change->'before') - array['image_text', 'image_text_status', 'image_text_at'],
     'after', (change->'after') - array['image_text', 'image_text_status', 'image_text_at'])
 where entity_kind = 'node'
   and (change->'before' ? 'image_text' or change->'after' ? 'image_text');

-- 3b. Clear descriptions already left on deleted images.
update public.workboard_nodes
   set image_text = null, image_text_status = null, image_text_at = null
 where kind = 'image' and deleted_at is not null and image_text_status is not null;

-- 3c. Archive the ghost: a live image card whose file is gone.
update public.workboard_nodes n
   set deleted_at = now(), updated_by = n.author_profile_id
 where n.id = '9ded233d-2eba-4193-9392-8c8dece4aff9'
   and n.deleted_at is null
   and not exists (select 1 from storage.objects o where o.bucket_id = 'work-files' and o.name = (n.body::jsonb ->> 'path'));

-- Checks (expect 0, 0, 0):
-- select count(*) from public.workboard_revisions where entity_kind = 'node' and (change->'before' ? 'image_text' or change->'after' ? 'image_text');
-- select count(*) from public.workboard_nodes where kind = 'image' and deleted_at is not null and image_text is not null;
-- select count(*) from public.workboard_nodes n where n.kind = 'image' and n.deleted_at is null and not exists (select 1 from storage.objects o where o.bucket_id = 'work-files' and o.name = (n.body::jsonb ->> 'path'));
