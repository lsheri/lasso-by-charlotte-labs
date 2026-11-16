-- Share with firm (Liam, 15 Nov 2026). In a company workspace each board can be shared with the firm; existing and
-- new boards start not shared. The flag changes only through set_engagement_firm_share, which also tells the firm's
-- admins and leads. The same change closes self-join: before this, any non-coach in a workspace could add themselves
-- to any board in it by id. Now only a board's owner can (the create flow), and an invite that names a board goes
-- through join_board_from_invite, which checks the invite.

-- 1. The flag, who set it and when.
alter table public.engagements
  add column if not exists shared_with_firm boolean not null default false,
  add column if not exists shared_with_firm_at timestamptz,
  add column if not exists shared_with_firm_by uuid references public.profiles(id) on delete set null;

-- 2. A company workspace is the only kind with a firm (mirrors hasFirmView: settings.type = 'company').
create or replace function public.org_has_firm_view(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from orgs where id = p_org and settings->>'type' = 'company')
$$;

-- 3. Guard: the three columns change only inside set_engagement_firm_share. A new board may be created shared (the
-- create question), but only in a company workspace, and the stamp is written here, never taken from the client.
create or replace function public.engagements_guard_firm_share()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if new.shared_with_firm and public.org_has_firm_view(new.org_id) then
      new.shared_with_firm_at := now();
      new.shared_with_firm_by := new.owner_id;
    else
      new.shared_with_firm := false;
      new.shared_with_firm_at := null;
      new.shared_with_firm_by := null;
    end if;
    return new;
  end if;
  if (new.shared_with_firm, new.shared_with_firm_at, new.shared_with_firm_by)
     is distinct from (old.shared_with_firm, old.shared_with_firm_at, old.shared_with_firm_by)
     and coalesce(current_setting('app.firm_share_change', true), '') <> 'on' then
    raise exception 'shared_with_firm changes only through set_engagement_firm_share';
  end if;
  return new;
end;
$$;

-- Runs after engagements_set_owner (trigger names fire in order), so owner_id is known on insert.
drop trigger if exists engagements_t_guard_firm_share on public.engagements;
create trigger engagements_t_guard_firm_share
  before insert or update on public.engagements
  for each row execute function public.engagements_guard_firm_share();

-- 4. The one way to change it. The owner or an editor may turn it on or off; an admin or lead of the workspace may
-- only turn it off. Coaches and guests never. Admins and leads hear about it (not the person who did it); the owner
-- hears only when someone else turned their board off.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'invite_needs_approval', 'share_received', 'invite_decided', 'invite_accepted', 'seat_over_count',
  'board_activity', 'support_request', 'mention_received', 'sticky_assigned', 'sticky_done', 'firm_share_changed'
]::text[]));

create or replace function public.set_engagement_firm_share(p_engagement uuid, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  e record;
  me record;
  can_edit boolean;
  r record;
  payload jsonb;
begin
  select id, org_id, owner_id, title, shared_with_firm into e from engagements where id = p_engagement;
  if not found then raise exception 'board not found'; end if;
  if not public.org_has_firm_view(e.org_id) then raise exception 'firm sharing is for company workspaces'; end if;

  select p.id, p.role, p.display_name into me
    from profiles p
   where p.user_id = auth.uid() and p.org_id = e.org_id and p.deactivated_at is null and not coalesce(p.is_guest, false)
   order by (p.id = public.active_profile_id()) desc
   limit 1;
  if not found or me.role = 'coach' then raise exception 'not allowed'; end if;

  can_edit := e.owner_id = me.id or public.is_engagement_editor(p_engagement);
  if not (can_edit or (me.role in ('admin', 'lead') and not p_on)) then raise exception 'not allowed'; end if;

  if e.shared_with_firm = p_on then return p_on; end if;

  perform set_config('app.firm_share_change', 'on', true);
  update engagements
     set shared_with_firm = p_on,
         shared_with_firm_at = case when p_on then now() else null end,
         shared_with_firm_by = case when p_on then me.id else null end
   where id = p_engagement;
  perform set_config('app.firm_share_change', '', true);

  payload := jsonb_build_object('board', e.title, 'by', coalesce(me.display_name, ''), 'on', p_on);
  for r in select id from profiles
            where org_id = e.org_id and role in ('admin', 'lead') and deactivated_at is null and id <> me.id loop
    perform public.notify(r.id, e.org_id, 'firm_share_changed', 'updates', 'engagement', p_engagement,
                          'firmshare:' || p_engagement::text, payload);
  end loop;
  if e.owner_id is not null and e.owner_id <> me.id and not p_on then
    perform public.notify(e.owner_id, e.org_id, 'firm_share_changed', 'updates', 'engagement', p_engagement,
                          'firmshare-owner:' || p_engagement::text, payload);
  end if;
  return p_on;
end;
$$;

revoke all on function public.set_engagement_firm_share(uuid, boolean) from public;
grant execute on function public.set_engagement_firm_share(uuid, boolean) to authenticated;

-- 5. Close self-join: only the board's owner adds themselves directly (the create flow inserts its own membership).
create or replace function public.can_self_join_engagement(eng uuid, prof uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from engagements e join profiles p on p.id = prof
    where e.id = eng and p.org_id = e.org_id and p.user_id = auth.uid() and p.deactivated_at is null
      and e.owner_id = prof)
$$;

-- 6. An invite link that names a board: the person must have used that invite, and whoever made the invite must be
-- on the board (or own it). Same role rules as before: the invited role, never coach.
create or replace function public.join_board_from_invite(p_code text, p_engagement uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv record;
  e record;
  me uuid;
begin
  select code, org_id, invited_role, created_by, used_by, revoked_at into inv from invites where code = p_code;
  if not found or inv.revoked_at is not null then raise exception 'invite not valid'; end if;
  select id, org_id, owner_id into e from engagements where id = p_engagement;
  if not found or e.org_id <> inv.org_id then raise exception 'invite not valid for this board'; end if;
  select p.id into me from profiles p
   where p.user_id = auth.uid() and p.org_id = e.org_id and p.deactivated_at is null and p.id = inv.used_by;
  if me is null then raise exception 'invite not valid'; end if;
  if inv.invited_role = 'coach' then raise exception 'not allowed'; end if;
  if not (e.owner_id = inv.created_by
          or exists (select 1 from engagement_members m where m.engagement_id = e.id and m.profile_id = inv.created_by)) then
    raise exception 'invite not valid for this board';
  end if;
  insert into engagement_members (engagement_id, profile_id, member_role)
  values (e.id, me, inv.invited_role)
  on conflict do nothing;
end;
$$;

revoke all on function public.join_board_from_invite(text, uuid) from public;
grant execute on function public.join_board_from_invite(text, uuid) to authenticated;
