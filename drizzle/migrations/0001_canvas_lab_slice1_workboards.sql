-- Canvas Lab Phase 3 Slice 1: durable multiuser Workboard records.
-- Additive only. No changes to existing tables, policies, or data.

create table public.workboards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  engagement_id uuid not null references public.engagements(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create unique index workboards_engagement_uq on public.workboards (engagement_id);

create table public.workboard_frames (
  id uuid primary key default gen_random_uuid(),
  workboard_id uuid not null references public.workboards(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('foundation','task','decisions','outputs','custom')),
  task_id uuid references public.tasks(id),
  label text,
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 0,
  h double precision not null default 0,
  ord integer not null default 0,
  version integer not null default 1,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workboard_id, key)
);
create index workboard_frames_board_idx on public.workboard_frames (workboard_id) where deleted_at is null;

create table public.workboard_nodes (
  id uuid primary key default gen_random_uuid(),
  workboard_id uuid not null references public.workboards(id) on delete cascade,
  frame_id uuid references public.workboard_frames(id),
  kind text not null check (kind in ('brief','work_item','decision','judgment','draft')),
  work_item_id uuid references public.work_items(id),
  decision_id uuid references public.decisions(id),
  author_profile_id uuid not null references public.profiles(id),
  title text not null default '',
  body text not null default '',
  judgment_type text check (judgment_type in ('added_constraint','corrected_ai','rejected_option','requested_evidence','changed_direction','accepted_but_rewrote')),
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 0,
  h double precision not null default 0,
  hidden boolean not null default false,
  version integer not null default 1,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workboard_nodes_shape check (
    (kind = 'brief' and work_item_id is null and decision_id is null)
    or (kind = 'work_item' and work_item_id is not null and decision_id is null)
    or (kind = 'decision' and decision_id is not null and work_item_id is null)
    or (kind in ('judgment','draft') and work_item_id is null and decision_id is null)
  )
);
create index workboard_nodes_board_idx on public.workboard_nodes (workboard_id) where deleted_at is null;
create index workboard_nodes_item_idx on public.workboard_nodes (work_item_id) where work_item_id is not null;

create table public.workboard_links (
  id uuid primary key default gen_random_uuid(),
  workboard_id uuid not null references public.workboards(id) on delete cascade,
  from_node_id uuid not null references public.workboard_nodes(id) on delete cascade,
  to_node_id uuid not null references public.workboard_nodes(id) on delete cascade,
  from_anchor text not null default 'right' check (from_anchor in ('top','right','bottom','left')),
  to_anchor text not null default 'left' check (to_anchor in ('top','right','bottom','left')),
  relation text not null check (relation in ('informed','produced','revised','cited','context')),
  author_profile_id uuid not null references public.profiles(id),
  version integer not null default 1,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workboard_links_no_self check (from_node_id <> to_node_id)
);
create unique index workboard_links_active_uq on public.workboard_links (from_node_id, to_node_id, relation) where deleted_at is null;
create index workboard_links_board_idx on public.workboard_links (workboard_id) where deleted_at is null;

create table public.workboard_revisions (
  id bigint generated always as identity primary key,
  workboard_id uuid not null references public.workboards(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('board','frame','node','link')),
  entity_id uuid not null,
  revision integer not null,
  action text not null check (action in ('create','update','archive','restore')),
  actor_profile_id uuid not null references public.profiles(id),
  at timestamptz not null default now(),
  change jsonb not null default '{}'::jsonb
);
create index workboard_revisions_board_idx on public.workboard_revisions (workboard_id, at);

-- Grants before RLS, per Data API requirements. No anon access anywhere.
grant select, insert, update on public.workboards to authenticated;
grant select, insert, update on public.workboard_frames to authenticated;
grant select, insert, update on public.workboard_nodes to authenticated;
grant select, insert, update on public.workboard_links to authenticated;
grant select on public.workboard_revisions to authenticated;
grant all on public.workboards to service_role;
grant all on public.workboard_frames to service_role;
grant all on public.workboard_nodes to service_role;
grant all on public.workboard_links to service_role;
grant all on public.workboard_revisions to service_role;

alter table public.workboards enable row level security;
alter table public.workboard_frames enable row level security;
alter table public.workboard_nodes enable row level security;
alter table public.workboard_links enable row level security;
alter table public.workboard_revisions enable row level security;

-- Non-coach engagement members (the approved shared-structure editors).
create or replace function public.is_engagement_editor(eng uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from engagement_members m
    join profiles p on p.id = m.profile_id
    where m.engagement_id = eng
      and p.user_id = auth.uid()
      and p.deactivated_at is null
      and m.member_role <> 'coach'
  )
$$;

-- workboards: members read; any member may lazy-create the one board; editors may update.
create policy workboards_select on public.workboards
  for select to authenticated
  using (public.is_engagement_member(engagement_id));
create policy workboards_insert on public.workboards
  for insert to authenticated
  with check (public.is_engagement_member(engagement_id) and created_by = any (select public.my_profile_ids()));
create policy workboards_update on public.workboards
  for update to authenticated
  using (public.is_engagement_editor(engagement_id))
  with check (public.is_engagement_editor(engagement_id));

-- frames: members read; editors manage shared structure.
create policy workboard_frames_select on public.workboard_frames
  for select to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_member(b.engagement_id)));
create policy workboard_frames_insert on public.workboard_frames
  for insert to authenticated
  with check (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id)) and created_by = any (select public.my_profile_ids()) and updated_by = any (select public.my_profile_ids()));
create policy workboard_frames_update on public.workboard_frames
  for update to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id)))
  with check (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id)));

-- nodes: members read; members author their own; author or editor may mutate a row.
create policy workboard_nodes_select on public.workboard_nodes
  for select to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_member(b.engagement_id)));
create policy workboard_nodes_insert on public.workboard_nodes
  for insert to authenticated
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_member(b.engagement_id))
    and author_profile_id = any (select public.my_profile_ids())
    and created_by = any (select public.my_profile_ids())
    and updated_by = any (select public.my_profile_ids())
  );
create policy workboard_nodes_update on public.workboard_nodes
  for update to authenticated
  using (
    author_profile_id = any (select public.my_profile_ids())
    or exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
  )
  with check (
    author_profile_id = any (select public.my_profile_ids())
    or exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
  );

-- links: members read; members author their own; author or editor may mutate.
create policy workboard_links_select on public.workboard_links
  for select to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_member(b.engagement_id)));
create policy workboard_links_insert on public.workboard_links
  for insert to authenticated
  with check (
    exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_member(b.engagement_id))
    and author_profile_id = any (select public.my_profile_ids())
    and created_by = any (select public.my_profile_ids())
    and updated_by = any (select public.my_profile_ids())
  );
create policy workboard_links_update on public.workboard_links
  for update to authenticated
  using (
    author_profile_id = any (select public.my_profile_ids())
    or exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
  )
  with check (
    author_profile_id = any (select public.my_profile_ids())
    or exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_editor(b.engagement_id))
  );

-- revisions: members read; written only by the security-definer trigger.
create policy workboard_revisions_select on public.workboard_revisions
  for select to authenticated
  using (exists (select 1 from public.workboards b where b.id = workboard_id and public.is_engagement_member(b.engagement_id)));

-- Author-only prose guard: nobody rewrites another person's card content,
-- identity, or canonical reference. Editors may still move, hide, archive, restore.
create or replace function public.workboard_nodes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
       new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.judgment_type is distinct from old.judgment_type
       or new.author_profile_id is distinct from old.author_profile_id
       or new.workboard_id is distinct from old.workboard_id
       or new.work_item_id is distinct from old.work_item_id
       or new.decision_id is distinct from old.decision_id
       or new.kind is distinct from old.kind
     )
     and not (old.author_profile_id = any (select public.my_profile_ids())) then
    raise exception 'Only the author may rewrite this card.';
  end if;
  return new;
end
$$;

create trigger workboard_nodes_guard_trg
  before update on public.workboard_nodes
  for each row execute function public.workboard_nodes_guard();

-- Atomic revision behavior: every create writes one revision row; every update
-- bumps version, refreshes updated_at, and writes one revision row in the same
-- transaction. Security definer so the append-only table needs no insert policy.
create or replace function public.workboard_row_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workboard_revisions (workboard_id, entity_kind, entity_id, revision, action, actor_profile_id, change)
  values (new.workboard_id, TG_ARGV[0], new.id, new.version, 'create', new.created_by, jsonb_build_object('after', to_jsonb(new)));
  return new;
end
$$;

create or replace function public.workboard_row_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_action text;
begin
  new.updated_at := now();
  new.version := old.version + 1;
  if old.deleted_at is null and new.deleted_at is not null then
    v_action := 'archive';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'restore';
  else
    v_action := 'update';
  end if;
  insert into public.workboard_revisions (workboard_id, entity_kind, entity_id, revision, action, actor_profile_id, change)
  values (new.workboard_id, TG_ARGV[0], new.id, new.version, v_action, new.updated_by, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return new;
end
$$;

create trigger workboard_frames_create_trg
  before insert on public.workboard_frames
  for each row execute function public.workboard_row_create('frame');
create trigger workboard_frames_touch_trg
  before update on public.workboard_frames
  for each row execute function public.workboard_row_touch('frame');
create trigger workboard_nodes_create_trg
  before insert on public.workboard_nodes
  for each row execute function public.workboard_row_create('node');
create trigger workboard_nodes_touch_trg
  before update on public.workboard_nodes
  for each row execute function public.workboard_row_touch('node');
create trigger workboard_links_create_trg
  before insert on public.workboard_links
  for each row execute function public.workboard_row_create('link');
create trigger workboard_links_touch_trg
  before update on public.workboard_links
  for each row execute function public.workboard_row_touch('link');

-- Board row: version bump and revision on update (create revision needs id, handled by app read of created row).
create or replace function public.workboards_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  insert into public.workboard_revisions (workboard_id, entity_kind, entity_id, revision, action, actor_profile_id, change)
  values (new.id, 'board', new.id, new.version, 'update', new.created_by, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return new;
end
$$;

create trigger workboards_touch_trg
  before update on public.workboards
  for each row execute function public.workboards_touch();