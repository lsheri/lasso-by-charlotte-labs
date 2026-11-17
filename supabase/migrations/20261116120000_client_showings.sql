-- Shown to client (Liam, 16 Nov 2026, firm brain phase 1). A board's owner or an editor marks a deliverable as put in
-- front of the client, with the date, an optional occasion and the item's content hash at that moment, so the exact
-- version the client saw is known even after the deck changes. Marks change only through mark_client_showing and
-- unmark_client_showing; board members read them. Additive only: a new table, two functions and two analysis presets.

-- 1. The marks.
create table if not exists public.client_showings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  shown_on date not null default current_date,
  occasion text check (occasion is null or char_length(occasion) between 1 and 120),
  content_hash text,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_showings_engagement_idx on public.client_showings (engagement_id);
create index if not exists client_showings_item_idx on public.client_showings (work_item_id);

alter table public.client_showings enable row level security;

-- Anyone on the board reads its marks (members, plus the owner). Nothing writes directly: no insert, update or
-- delete policy exists, so the two functions below are the only way in.
drop policy if exists client_showings_read on public.client_showings;
create policy client_showings_read on public.client_showings
  for select to authenticated
  using (
    public.is_engagement_member(engagement_id)
    or exists (
      select 1 from public.engagements e join public.profiles p on p.id = e.owner_id
       where e.id = client_showings.engagement_id and p.user_id = auth.uid() and p.deactivated_at is null
    )
  );

-- 2. The caller's role on a board: the owner or an editor, in a company workspace, never a coach or a guest.
create or replace function public.client_showing_actor(p_engagement uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  e record;
  me record;
begin
  select id, org_id, owner_id into e from engagements where id = p_engagement;
  if not found then raise exception 'board not found'; end if;
  if not public.org_has_firm_view(e.org_id) then raise exception 'shown to client is for company workspaces'; end if;
  select p.id, p.role into me
    from profiles p
   where p.user_id = auth.uid() and p.org_id = e.org_id and p.deactivated_at is null and not coalesce(p.is_guest, false)
   order by (p.id = public.active_profile_id()) desc
   limit 1;
  if not found or me.role = 'coach' then raise exception 'not allowed'; end if;
  if not (e.owner_id = me.id or public.is_engagement_editor(p_engagement)) then raise exception 'not allowed'; end if;
  return me.id;
end;
$$;

revoke all on function public.client_showing_actor(uuid) from public;

-- 3. Mark: the item must be placed on this board. The content hash is read here, never taken from the client.
create or replace function public.mark_client_showing(
  p_engagement uuid,
  p_item uuid,
  p_shown_on date default current_date,
  p_occasion text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor uuid;
  item record;
  new_id uuid;
  clean_occasion text := nullif(btrim(coalesce(p_occasion, '')), '');
begin
  actor := public.client_showing_actor(p_engagement);
  if p_shown_on is null or p_shown_on > current_date + 1 then raise exception 'date not valid'; end if;
  if clean_occasion is not null and char_length(clean_occasion) > 120 then raise exception 'occasion too long'; end if;
  select w.id, w.org_id, w.content_hash into item
    from work_items w
   where w.id = p_item
     and exists (
       select 1 from work_item_tasks wt join tasks t on t.id = wt.task_id
        where wt.work_item_id = w.id and t.engagement_id = p_engagement
     );
  if not found then raise exception 'that work is not on this board'; end if;
  insert into client_showings (org_id, engagement_id, work_item_id, shown_on, occasion, content_hash, marked_by)
  values (item.org_id, p_engagement, p_item, p_shown_on, clean_occasion, item.content_hash, actor)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.mark_client_showing(uuid, uuid, date, text) from public;
grant execute on function public.mark_client_showing(uuid, uuid, date, text) to authenticated;

-- 4. Unmark: the same people who may mark.
create or replace function public.unmark_client_showing(p_showing uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  eng uuid;
begin
  select engagement_id into eng from client_showings where id = p_showing;
  if not found then return; end if;
  perform public.client_showing_actor(eng);
  delete from client_showings where id = p_showing;
end;
$$;

revoke all on function public.unmark_client_showing(uuid) from public;
grant execute on function public.unmark_client_showing(uuid) to authenticated;

-- 5. Red pen and partner read record their runs like every other analysis (phase 1 PR 2 and PR 3). Widening the
-- allowed list only adds two values; every existing preset stays valid.
alter table public.analysis_runs drop constraint if exists ar_preset_chk;
alter table public.analysis_runs add constraint ar_preset_chk check (preset = any (array[
  'ai_fluency_4d', 'decision_origin', 'assumptions', 'working_the_model', 'what_fed_this', 'what_recurs', 'trace',
  'verification', 'still_on_brief', 'firm_checks', 'how_this_was_made', 'span_provenance', 'work_artifact',
  'archive_search', 'verification_thread', 'decision_origin_thread', 'red_pen', 'partner_read'
]::text[]));
