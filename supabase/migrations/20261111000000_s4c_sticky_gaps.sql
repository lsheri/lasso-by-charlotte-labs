-- S4c (10 Nov): three gaps found by simulating stickies across boards and accounts as real users, inside
-- transactions that always rolled back (claude/TEST-nov10-stickies-across-boards-and-accounts.md).
--
-- 1. Signing with another workspace's seat. A person with seats in two workspaces could write a note on a board
--    signed by the seat that is not on that board (insert checked the login, not the seat). Now the author must
--    be a non-coach member seat of the board. All 9 existing annotations already are (checked 10 Nov).
-- 2. Rewriting who did it. The author could change done_by on its own, so a sticky could say someone else
--    marked it done. Now done_by can only ever be the person making the change.
-- 3. Asking someone who left. An open sticky kept naming a person after they were taken off the board, and
--    their "left you a sticky" row stayed in Needs you. Now leaving clears the assignee on open stickies and
--    settles those rows. Done stickies keep their history.
-- Plus: a "left you a sticky" row settles itself whenever that sticky is done (by anyone), unassigned,
-- reassigned or removed, so Needs you never holds a sticky that no longer asks anything.
--
-- Every function restates security definer and search_path.

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
    -- S4c: the author signs with their own seat on this board, never a seat from another workspace.
    if not exists (
      select 1 from public.workboards b join public.engagement_members em on em.engagement_id = b.engagement_id
       where b.id = new.workboard_id and em.profile_id = new.author_profile_id and em.member_role <> 'coach') then
      raise exception 'Write on this board as your seat on it.';
    end if;
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
  -- S4c: Lasso clears an open sticky's assignee when that person leaves the board, and nothing else.
  if coalesce(current_setting('lasso.system_write', true), '') = 'on' and new.assignee_profile_id is null
     and (to_jsonb(new) - array['assignee_profile_id','updated_at','version']) = (to_jsonb(old) - array['assignee_profile_id','updated_at','version']) then
    new.updated_at := now(); new.version := old.version + 1; return new;
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
    -- S4a/S4c: whoever marks a sticky done is the one recorded as doing it. The doer cannot be rewritten on
    -- its own either (S4c: the S4a check only looked when the done time changed).
    if new.done_by is not null and new.done_by is distinct from old.done_by and new.done_by is distinct from new.updated_by then raise exception 'Done records who marked it.'; end if;
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

-- Leaving a board ------------------------------------------------------------------------------------------
create or replace function public.clear_sticky_assignee_on_leave()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform set_config('lasso.system_write', 'on', true);
  update public.workboard_annotations a
     set assignee_profile_id = null
    from public.workboards b
   where b.id = a.workboard_id and b.engagement_id = old.engagement_id
     and a.kind = 'sticky' and a.assignee_profile_id = old.profile_id
     and a.done_at is null and a.archived_at is null;
  perform set_config('lasso.system_write', 'off', true);
  update public.notifications
     set acted_at = coalesce(acted_at, now()), read_at = coalesce(read_at, now())
   where recipient_profile_id = old.profile_id and kind = 'sticky_assigned'
     and subject_type = 'engagement' and subject_id = old.engagement_id and acted_at is null;
  return old;
end $function$;

drop trigger if exists clear_sticky_assignee_on_leave_trg on public.engagement_members;
create trigger clear_sticky_assignee_on_leave_trg
  after delete on public.engagement_members
  for each row execute function public.clear_sticky_assignee_on_leave();

-- Settling "left you a sticky" -----------------------------------------------------------------------------
create or replace function public.settle_sticky_assigned_notice()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if old.kind <> 'sticky' or old.assignee_profile_id is null then return new; end if;
  if (new.done_at is not null and old.done_at is null)
     or new.assignee_profile_id is distinct from old.assignee_profile_id
     or (new.archived_at is not null and old.archived_at is null) then
    update public.notifications
       set acted_at = coalesce(acted_at, now()), read_at = coalesce(read_at, now())
     where recipient_profile_id = old.assignee_profile_id
       and group_key = 'sticky:' || old.id || ':assigned:' || old.assignee_profile_id
       and acted_at is null;
  end if;
  return new;
end $function$;

drop trigger if exists settle_sticky_assigned_notice_trg on public.workboard_annotations;
create trigger settle_sticky_assigned_notice_trg
  after update on public.workboard_annotations
  for each row execute function public.settle_sticky_assigned_notice();

revoke all on function public.clear_sticky_assignee_on_leave() from public, anon, authenticated;
revoke all on function public.settle_sticky_assigned_notice() from public, anon, authenticated;
