-- Q21: the founder console's workspace activity stops counting preview and local events.
--
-- admin_workspace_activity read every row of public.events, so 31% of its last-30-day
-- activity (1,671 of 5,308 events, measured 8 Nov) was the founder testing on preview
-- hosts (A5 F26). admin_pilot_overview and admin_account_view already exclude preview
-- and local; this applies the same rule, word for word, so the three agree.
--
-- Rows with environment 'unknown' or null (written before 30 Sep, when stamping began)
-- are kept, as in the other two functions: unknown is not evidence of preview.
--
-- Same signature and return type, so create or replace. Body otherwise unchanged.
-- Grants are unchanged by create or replace (PUBLIC and anon currently hold execute;
-- the body's platform-admin gate is the control). Tightening them is the GRANTS item.

create or replace function public.admin_workspace_activity()
 returns table(org_id uuid, org_name text, org_type text, ent_plan text, members_active integer, events_total bigint, events_30d bigint, actors_30d bigint, first_event timestamp with time zone, last_event timestamp with time zone, days_quiet integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;

  return query
  with ev as (
    select e.org_id,
           count(*) as total,
           count(*) filter (where e.ts > now() - interval '30 days') as recent,
           count(distinct e.actor_hash) filter (where e.ts > now() - interval '30 days') as actors,
           min(e.ts) as first_ts,
           max(e.ts) as last_ts
      from public.events e
     where e.org_id is not null
       -- Q21: same rule as admin_pilot_overview and admin_account_view.
       and e.environment is distinct from 'preview'
       and e.environment is distinct from 'local'
     group by e.org_id
  ),
  ent as (
    select distinct on (e.org_id) e.org_id, e.plan
      from public.entitlements e where e.status = 'active'
     order by e.org_id, e.created_at desc
  )
  select o.id, o.name, coalesce(o.settings->>'type','unset'), ent.plan,
         (select count(*) from public.profiles p where p.org_id = o.id and p.deactivated_at is null)::integer,
         coalesce(ev.total, 0), coalesce(ev.recent, 0), coalesce(ev.actors, 0),
         ev.first_ts, ev.last_ts,
         case when ev.last_ts is null then null
              else (current_date - ev.last_ts::date) end::integer
    from public.orgs o
    left join ev on ev.org_id = o.id
    left join ent on ent.org_id = o.id
   order by coalesce(ev.recent, 0) desc, coalesce(ev.total, 0) desc;
end $function$;

comment on function public.admin_workspace_activity() is
  'Founder console workspace activity. Platform admins only (gated in the body). Excludes events from preview and local hosts, the same rule as admin_pilot_overview and admin_account_view (Q21, 8 Nov 2026).';
