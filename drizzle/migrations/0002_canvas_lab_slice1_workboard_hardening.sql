-- Canvas Lab Phase 3 Slice 1 hardening. Additive only.
-- 1) Coaches become SELECT-only on every workboard table.
-- 2) Actor, tenant, and identity fields can no longer be spoofed or reassigned.
-- 3) Authored judgment prose, archive, and restore stay with their author.
-- 4) Idempotency keys so a lost response cannot duplicate a card.

alter table public.workboard_nodes add column if not exists client_key text;

create unique index if not exists workboard_nodes_client_key_uq
  on public.workboard_nodes (workboard_id, client_key)
  where client_key is not null and deleted_at is null;
create unique index if not exists workboard_nodes_work_ref_uq
  on public.workboard_nodes (workboard_id, work_item_id)
  where work_item_id is not null and deleted_at is null;
create unique index if not exists workboard_nodes_decision_ref_uq
  on public.workboard_nodes (workboard_id, decision_id)
  where decision_id is not null and deleted_at is null;
create unique index if not exists workboard_nodes_brief_uq
  on public.workboard_nodes (workboard_id)
  where kind = 'brief' and deleted_at is null;

-- ---------------------------------------------------------------- policies

drop policy if exists workboards_insert on public.workboards;
create policy workboards_insert on public.workboards
  for insert to authenticated
  with check (
    public.is_engagement_editor(engagement_id)
    and created_by = any (select public.my_profile_ids())
    and org_id = (select e.org_id from public.engagements e where e.id = engagement_id)
  );

drop policy if exists workboards_update on public.workboards;
create policy workboards_update on public.workboards
  for update to authenticated
  using (public.is_engagement_editor(engagement_id))
  with check (public.is_engagement_editor(engagement_id));

drop policy if exists workboard_frames_update on public.workboard_frames;
create policy workboard_frames_update on public.workboard_frames
  for update to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id)))
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
    and updated_by = any (select public.my_profile_ids())
  );

drop policy if exists workboard_nodes_insert on public.workboard_nodes;
create policy workboard_nodes_insert on public.workboard_nodes
  for insert to authenticated
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
    and author_profile_id = any (select public.my_profile_ids())
    and created_by = any (select public.my_profile_ids())
    and updated_by = any (select public.my_profile_ids())
  );

-- Editors arrange shared canonical reference cards. Authored judgment and
-- draft rows answer only to their author, archive and restore included.
drop policy if exists workboard_nodes_update on public.workboard_nodes;
create policy workboard_nodes_update on public.workboard_nodes
  for update to authenticated
  using (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
    and (
      kind in ('brief','work_item','decision')
      or author_profile_id = any (select public.my_profile_ids())
    )
  )
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
    and updated_by = any (select public.my_profile_ids())
    and (
      kind in ('brief','work_item','decision')
      or author_profile_id = any (select public.my_profile_ids())
    )
  );

drop policy if exists workboard_links_insert on public.workboard_links;
create policy workboard_links_insert on public.workboard_links
  for insert to authenticated
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
    and author_profile_id = any (select public.my_profile_ids())
    and created_by = any (select public.my_profile_ids())
    and updated_by = any (select public.my_profile_ids())
  );

drop policy if exists workboard_links_update on public.workboard_links;
create policy workboard_links_update on public.workboard_links
  for update to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id)))
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
    and updated_by = any (select public.my_profile_ids())
  );

-- ---------------------------------------------------------------- guards
-- Every guard yields to service_role maintenance, which has no auth.uid().

create or replace function public.workboards_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if TG_OP = 'INSERT' then
    if new.org_id is distinct from (select e.org_id from public.engagements e where e.id = new.engagement_id) then
      raise exception 'This workboard does not belong to that engagement.';
    end if;
    if not (new.created_by = any (select public.my_profile_ids())) then
      raise exception 'A workboard records its real author.';
    end if;
    return new;
  end if;
  if new.org_id is distinct from old.org_id
     or new.engagement_id is distinct from old.engagement_id
     or new.created_by is distinct from old.created_by then
    raise exception 'A workboard cannot be reassigned.';
  end if;
  return new;
end
$$;

create trigger workboards_guard_trg
  before insert or update on public.workboards
  for each row execute function public.workboards_guard();

create or replace function public.workboard_frames_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.workboard_id is distinct from old.workboard_id
     or new.key is distinct from old.key
     or new.created_by is distinct from old.created_by then
    raise exception 'A workstream cannot be reassigned.';
  end if;
  if not (new.updated_by = any (select public.my_profile_ids())) then
    raise exception 'A change records the person who made it.';
  end if;
  return new;
end
$$;

create trigger workboard_frames_guard_trg
  before update on public.workboard_frames
  for each row execute function public.workboard_frames_guard();

-- Replaces the Slice 1 prose guard: same author-only prose rule, plus
-- author-only archive and restore for authored cards, actor honesty, and
-- no identity or key reassignment.
create or replace function public.workboard_nodes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare mine boolean;
begin
  if auth.uid() is null then return new; end if;
  mine := old.author_profile_id = any (select public.my_profile_ids());

  if new.workboard_id is distinct from old.workboard_id
     or new.author_profile_id is distinct from old.author_profile_id
     or new.created_by is distinct from old.created_by
     or new.client_key is distinct from old.client_key
     or new.kind is distinct from old.kind
     or new.work_item_id is distinct from old.work_item_id
     or new.decision_id is distinct from old.decision_id then
    raise exception 'A card cannot be reassigned.';
  end if;

  if not (new.updated_by = any (select public.my_profile_ids())) then
    raise exception 'A change records the person who made it.';
  end if;

  if not mine then
    if new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.judgment_type is distinct from old.judgment_type then
      raise exception 'Only the author may rewrite this card.';
    end if;
    if old.kind in ('judgment','draft') and new.deleted_at is distinct from old.deleted_at then
      raise exception 'Only the author may archive this card.';
    end if;
  end if;
  return new;
end
$$;

create or replace function public.workboard_links_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.workboard_id is distinct from old.workboard_id
     or new.from_node_id is distinct from old.from_node_id
     or new.to_node_id is distinct from old.to_node_id
     or new.author_profile_id is distinct from old.author_profile_id
     or new.created_by is distinct from old.created_by then
    raise exception 'A relationship cannot be reassigned.';
  end if;
  if not (new.updated_by = any (select public.my_profile_ids())) then
    raise exception 'A change records the person who made it.';
  end if;
  return new;
end
$$;

create trigger workboard_links_guard_trg
  before update on public.workboard_links
  for each row execute function public.workboard_links_guard();