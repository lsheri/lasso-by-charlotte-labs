-- Step 8 (firm brain), manager tools. A lead pins up to three shared threads as a reading list on a board; an admin
-- or lead marks a placed item as an exemplar. Additive only: one helper, two tables, their guards and read rules.
-- Nothing on the engagements table changes.

-- 1. The caller's role in a company workspace, or null. Null for guests, coaches, deactivated people, people from
-- another workspace, and any workspace that is not a company. Every rule below starts here.
create or replace function public.firm_role_in(p_org uuid)
returns public.app_role
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.role
    from profiles p
   where p.user_id = auth.uid() and p.org_id = p_org and p.deactivated_at is null
     and not coalesce(p.is_guest, false) and p.role <> 'coach'
     and public.org_has_firm_view(p_org)
   order by (p.id = public.active_profile_id()) desc
   limit 1
$$;

revoke all on function public.firm_role_in(uuid) from public;
grant execute on function public.firm_role_in(uuid) to authenticated, service_role;

-- 2. Reading-list pins. board_id is the board the list sits on; thread_id is the shared engagement pinned to it.
-- Three slots per board, so a fourth pin cannot exist. Both sides cascade when a board is deleted.
create table if not exists public.board_reading_pins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  board_id uuid not null references public.engagements(id) on delete cascade,
  thread_id uuid not null references public.engagements(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  pinned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint board_reading_pins_not_self check (board_id <> thread_id),
  constraint board_reading_pins_slot_key unique (board_id, slot),
  constraint board_reading_pins_thread_key unique (board_id, thread_id)
);

create index if not exists board_reading_pins_thread_idx on public.board_reading_pins (thread_id);

-- A pin can only be written for a thread that is shared with the firm, in the same company workspace as the board.
create or replace function public.board_reading_pins_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.org_has_firm_view(new.org_id) then raise exception 'reading lists are for company workspaces'; end if;
  if not exists (select 1 from engagements b where b.id = new.board_id and b.org_id = new.org_id) then
    raise exception 'that board is not in this workspace';
  end if;
  if not exists (select 1 from engagements t
                  where t.id = new.thread_id and t.org_id = new.org_id and t.shared_with_firm and t.archived_at is null) then
    raise exception 'only a thread shared with the firm can be pinned';
  end if;
  return new;
end;
$$;

drop trigger if exists board_reading_pins_t_guard on public.board_reading_pins;
create trigger board_reading_pins_t_guard
  before insert or update on public.board_reading_pins
  for each row execute function public.board_reading_pins_guard();

-- Who reads a pin: a firm member (never a guest or coach) who is on the board or owns it, and only while the pinned
-- thread is still shared. Checked on every read, so sharing off hides the pin at once even before the cleanup runs.
create or replace function public.can_read_reading_pin(p_org uuid, p_board uuid, p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.firm_role_in(p_org) is not null
     and exists (select 1 from engagements b
                  where b.id = p_board and b.org_id = p_org
                    and (public.is_engagement_member(b.id) or public.is_my_profile(b.owner_id)))
     and exists (select 1 from engagements t
                  where t.id = p_thread and t.org_id = p_org and t.shared_with_firm and t.archived_at is null)
$$;

revoke all on function public.can_read_reading_pin(uuid, uuid, uuid) from public;
grant execute on function public.can_read_reading_pin(uuid, uuid, uuid) to authenticated, service_role;

alter table public.board_reading_pins enable row level security;

drop policy if exists board_reading_pins_read on public.board_reading_pins;
create policy board_reading_pins_read on public.board_reading_pins
  for select to authenticated
  using (public.can_read_reading_pin(org_id, board_id, thread_id));

-- No insert, update or delete policy: only the server (service role) writes. pinned_by is never granted, so no
-- member can read who pinned.
revoke all on table public.board_reading_pins from anon, authenticated;
grant select (id, org_id, board_id, thread_id, slot, created_at) on public.board_reading_pins to authenticated;

-- 3. Exemplar marks. One mark per item per board. The item must be placed on that board and must not be private.
create table if not exists public.firm_exemplars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint firm_exemplars_item_key unique (engagement_id, work_item_id)
);

create index if not exists firm_exemplars_item_idx on public.firm_exemplars (work_item_id);

create or replace function public.firm_exemplars_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from engagements e
                  where e.id = new.engagement_id and e.org_id = new.org_id and e.shared_with_firm and e.archived_at is null) then
    raise exception 'only work on a board shared with the firm can be an exemplar';
  end if;
  if not exists (select 1 from work_items w
                  where w.id = new.work_item_id and w.org_id = new.org_id and w.visibility <> 'private'
                    and exists (select 1 from work_item_tasks wt join tasks t on t.id = wt.task_id
                                 where wt.work_item_id = w.id and t.engagement_id = new.engagement_id)) then
    raise exception 'that work is not on this board';
  end if;
  return new;
end;
$$;

drop trigger if exists firm_exemplars_t_guard on public.firm_exemplars;
create trigger firm_exemplars_t_guard
  before insert or update on public.firm_exemplars
  for each row execute function public.firm_exemplars_guard();

-- Who reads a mark: any firm member, while the board is shared and the item is still placed on it and not private.
create or replace function public.can_read_exemplar(p_org uuid, p_engagement uuid, p_item uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.firm_role_in(p_org) is not null
     and exists (select 1 from engagements e
                  where e.id = p_engagement and e.org_id = p_org and e.shared_with_firm and e.archived_at is null)
     and exists (select 1 from work_items w
                  where w.id = p_item and w.org_id = p_org and w.visibility <> 'private'
                    and exists (select 1 from work_item_tasks wt join tasks t on t.id = wt.task_id
                                 where wt.work_item_id = w.id and t.engagement_id = p_engagement))
$$;

revoke all on function public.can_read_exemplar(uuid, uuid, uuid) from public;
grant execute on function public.can_read_exemplar(uuid, uuid, uuid) to authenticated, service_role;

alter table public.firm_exemplars enable row level security;

drop policy if exists firm_exemplars_read on public.firm_exemplars;
create policy firm_exemplars_read on public.firm_exemplars
  for select to authenticated
  using (public.can_read_exemplar(org_id, engagement_id, work_item_id));

-- No write policy; marked_by is never granted, so no member can read who marked.
revoke all on table public.firm_exemplars from anon, authenticated;
grant select (id, org_id, engagement_id, work_item_id, created_at) on public.firm_exemplars to authenticated;

-- 4. Sharing off: pins that point at the board and exemplar marks on it stop being readable at the next read,
-- because both read rules re-check shared_with_firm every time. The rows are kept, so they return if the board is
-- shared again (Liam's choice, 18 Nov 2026). Nothing is added to the engagements table.
