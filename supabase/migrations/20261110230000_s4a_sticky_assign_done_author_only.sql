-- S4a (10 Nov): stickies get an assignee and a done state; comments, highlights and stickies become
-- author-only to change.
--
-- 1. Update policy: only the author changes an annotation. Org admins lose the power to rewrite or
--    remove a teammate's comment (Liam, 10 Nov: "yes that sounds right"). An admin "hide from board"
--    can come later as its own path.
-- 2. Guard: the anchor's row_key joins the fields nobody can change after the fact. A new sticky never
--    starts done. An assignee must be on the board. The one change a non-author can make is marking a
--    sticky assigned to them done or not done, and nothing else on the row moves with it.
-- 3. set_sticky_done: the assignee (or the author) marks a sticky done or reopens it. It runs past the
--    author-only update policy, so it checks who is calling itself, and the guard checks again.
--
-- Every function restates security definer and search_path (the 8 Nov finding: create or replace
-- without them silently drops them).

-- 1. Author-only update policy -----------------------------------------------------------------------
drop policy if exists workboard_annotations_update on public.workboard_annotations;
create policy workboard_annotations_update on public.workboard_annotations
  for update
  using (
    exists (select 1 from public.workboards b
             where b.id = workboard_annotations.workboard_id and public.is_engagement_member(b.engagement_id))
    and author_profile_id in (select public.my_profile_ids())
  )
  with check (
    updated_by in (select public.my_profile_ids())
    and author_profile_id in (select public.my_profile_ids())
  );

-- 2. Guard -------------------------------------------------------------------------------------------
create or replace function public.workboard_annotations_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare mine boolean; nk text; nwi uuid; nb uuid; done_only boolean;
begin
  if TG_OP = 'INSERT' then
    new.version := 1; new.created_at := now(); new.updated_at := now();
    -- S4a: a sticky starts open.
    new.done_at := null; new.done_by := null;
    if auth.uid() is null then return new; end if;
    select kind, work_item_id, workboard_id into nk, nwi, nb from public.workboard_nodes where id = new.node_id and deleted_at is null;
    if nb is distinct from new.workboard_id then raise exception 'That card is not on this workboard.'; end if;
    if new.work_item_id is distinct from nwi then raise exception 'A note must point at the source its card shows.'; end if;
    if not (new.author_profile_id = any (select public.my_profile_ids())) or new.created_by <> new.author_profile_id or new.updated_by <> new.author_profile_id then raise exception 'A note records its real author.'; end if;
    if new.assignee_profile_id is not null and not exists (
      select 1 from public.workboards b join public.engagement_members em on em.engagement_id = b.engagement_id
        join public.profiles p on p.id = em.profile_id
       where b.id = new.workboard_id and em.profile_id = new.assignee_profile_id and p.deactivated_at is null) then
      raise exception 'Assign a sticky to someone on this board.';
    end if;
    new.archived_at := null; new.archived_by := null; new.archive_reason := null; new.source_removed_at := null; new.purge_after := null; new.legal_hold := false;
    return new;
  end if;
  if old.node_id is not null and new.node_id is null and (coalesce(current_setting('lasso.system_write', true), '') = 'on' or not exists (select 1 from public.workboard_nodes where id = old.node_id)) then
    if old.work_item_id is not null and not exists (select 1 from public.work_items where id = old.work_item_id) then new.work_item_id := null; new.excerpt := null; new.source_removed_at := coalesce(old.source_removed_at, now()); end if;
    new.updated_at := now(); new.version := old.version + 1; return new;
  end if;
  if old.work_item_id is not null and new.work_item_id is null and not exists (select 1 from public.work_items where id = old.work_item_id) then
    new.excerpt := null; new.source_removed_at := coalesce(old.source_removed_at, now()); new.updated_at := now(); new.version := old.version + 1; return new;
  end if;
  if old.document_version_id is not null and new.document_version_id is null and not exists (select 1 from public.document_versions where id = old.document_version_id) then
    new.updated_at := now(); new.version := old.version + 1; return new;
  end if;
  if auth.uid() is not null then
    if new.workboard_id is distinct from old.workboard_id or new.node_id is distinct from old.node_id
       or new.work_item_id is distinct from old.work_item_id or new.kind is distinct from old.kind
       or new.anchor_kind is distinct from old.anchor_kind or new.turn_no is distinct from old.turn_no
       or new.turn_hash is distinct from old.turn_hash or new.section_key is distinct from old.section_key
       or new.page_no is distinct from old.page_no or new.row_key is distinct from old.row_key
       or new.document_version_id is distinct from old.document_version_id
       or new.source_hash is distinct from old.source_hash or new.char_start is distinct from old.char_start
       or new.char_end is distinct from old.char_end or new.text_hash is distinct from old.text_hash
       or new.excerpt is distinct from old.excerpt or new.author_profile_id is distinct from old.author_profile_id
       or new.created_by is distinct from old.created_by or new.client_key is distinct from old.client_key
       or new.created_at is distinct from old.created_at or new.parent_id is distinct from old.parent_id then
      raise exception 'A note cannot be moved or reassigned.';
    end if;
    if new.legal_hold is distinct from old.legal_hold or new.purge_after is distinct from old.purge_after or new.source_removed_at is distinct from old.source_removed_at then raise exception 'That field is kept by Lasso.'; end if;
    if not (new.updated_by = any (select public.my_profile_ids())) then raise exception 'A change records the person who made it.'; end if;
    -- S4a: whoever marks a sticky done is the one recorded as doing it.
    if new.done_at is not null and new.done_at is distinct from old.done_at and new.done_by is distinct from new.updated_by then raise exception 'Done records who marked it.'; end if;
    -- S4a: a new assignee has to be on the board.
    if new.assignee_profile_id is not null and new.assignee_profile_id is distinct from old.assignee_profile_id and not exists (
      select 1 from public.workboards b join public.engagement_members em on em.engagement_id = b.engagement_id
        join public.profiles p on p.id = em.profile_id
       where b.id = new.workboard_id and em.profile_id = new.assignee_profile_id and p.deactivated_at is null) then
      raise exception 'Assign a sticky to someone on this board.';
    end if;
    mine := old.author_profile_id = any (select public.my_profile_ids());
    if not mine then
      -- S4a: the assignee may mark the sticky done or reopen it, and change nothing else.
      done_only := old.kind = 'sticky' and old.archived_at is null
        and old.assignee_profile_id = any (select public.my_profile_ids())
        and (to_jsonb(new) - array['done_at','done_by','updated_by','updated_at','version'])
            = (to_jsonb(old) - array['done_at','done_by','updated_by','updated_at','version']);
      if done_only then
        new.updated_at := now(); new.version := old.version + 1; return new;
      end if;
      if new.body is distinct from old.body or new.visibility is distinct from old.visibility then raise exception 'Only the author may rewrite this note.'; end if;
      if old.archived_at is not null or new.archived_at is null then raise exception 'Only the author may change this note.'; end if;
      raise exception 'Only the author may remove this note.';
    else
      if old.archived_at is not null and new.archived_at is not null and (new.body is distinct from old.body or new.visibility is distinct from old.visibility) then raise exception 'Restore the note before editing it.'; end if;
      if old.archived_at is null and new.archived_at is not null and (new.archive_reason is distinct from 'author_removed' or new.archived_by is distinct from new.updated_by) then raise exception 'Removing your own note records that you removed it.'; end if;
      if old.archived_at is not null and new.archived_at is null and old.archived_by is distinct from old.author_profile_id then raise exception 'An admin removed this note; it cannot be restored here.'; end if;
    end if;
  end if;
  if old.archived_at is null and new.archived_at is not null then new.purge_after := new.archived_at + interval '30 days';
  elsif old.archived_at is not null and new.archived_at is null then new.purge_after := null; new.archived_by := null; new.archive_reason := null; end if;
  new.updated_at := now(); new.version := old.version + 1; return new;
end $function$;

-- 3. set_sticky_done ---------------------------------------------------------------------------------
-- The assignee marks it done (or reopens it). With no assignee, the author does. Returns the new
-- version, or null when the sticky moved on (wrong version, removed, or not the caller's to mark).
create or replace function public.set_sticky_done(p_annotation uuid, p_done boolean, p_expected_version integer)
 returns table(id uuid, version integer, done_at timestamptz, done_by uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare r record; me uuid;
begin
  select a.id, a.workboard_id, a.kind, a.author_profile_id, a.assignee_profile_id, a.archived_at, a.version, a.done_at
    into r from public.workboard_annotations a where a.id = p_annotation;
  if not found or r.kind <> 'sticky' or r.archived_at is not null or r.version <> p_expected_version then return; end if;
  if not exists (select 1 from public.workboards b where b.id = r.workboard_id and public.is_engagement_member(b.engagement_id)) then return; end if;
  -- The assignee marks it; the author can always close their own sticky. The assignee's seat wins.
  select x.pid into me from (select public.my_profile_ids() as pid) x
   where x.pid = r.assignee_profile_id or x.pid = r.author_profile_id
   order by (x.pid = r.assignee_profile_id) desc nulls last
   limit 1;
  if me is null then return; end if;
  if p_done and r.done_at is not null then return; end if;
  if not p_done and r.done_at is null then return; end if;
  return query
    update public.workboard_annotations a
       set done_at = case when p_done then now() else null end,
           done_by = case when p_done then me else null end,
           updated_by = me
     where a.id = p_annotation and a.version = p_expected_version
     returning a.id, a.version, a.done_at, a.done_by;
end $function$;

revoke all on function public.set_sticky_done(uuid, boolean, integer) from public, anon;
grant execute on function public.set_sticky_done(uuid, boolean, integer) to authenticated;
