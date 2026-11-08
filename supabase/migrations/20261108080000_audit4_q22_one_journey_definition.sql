-- AUDIT-4 Q22: one journey definition, and it lives in the database.
--
-- admin_pilot_overview() still counted the pre-25-Oct event sets (A5 F27)
-- while PostHog's journey tile (MduSYwpo) and workspace health table
-- (2mFsBPcA) were corrected on 7 Nov. This makes the database the
-- definition; PostHog copies it.
--
-- What changes:
--   * Every step's event set is copied verbatim from MduSYwpo as of 7 Nov:
--       step 4 gains workstream_drawn / workstream_created / region_named / section_created
--       step 5 counts decisions_doc.version_recorded and document.version_recorded,
--              keeping the four retired decision.* names so October history stays
--       step 6 is reflect.message_sent and findit.searched only (question.asked removed, Q13)
--       step 7 gains link.drawn and workboard.trail_item_selected
--       step 8 gains board.invite_sent / invite_accepted / engagement.access_changed /
--              shared.board_opened
--   * Each event list is written once, in the `tagged` CTE. The all-time
--     booleans and the 28-day ladder both read from it, so they cannot drift.
--   * s1..s8 keep their names and their all-time meaning ("has ever done").
--   * Appended columns, at the end so existing readers are unaffected:
--       s3b_read_back      boolean  ever read work back from an AI tool (mcp.read)
--       read_back_28d      integer  mcp.read count in the last 28 days
--       furthest_step_28d  text     the same ladder and labels as 2mFsBPcA, last 28 days;
--                                   null when the workspace has no events in the window
--
-- Unchanged: the platform-admin gate, the row filter (pilot workspaces, not
-- preview or local, platform staff excluded), every other column.
--
-- Why drop and create: adding output columns changes the return type, which
-- create or replace cannot do. Nothing depends on this function (checked
-- 7 Nov: no views, no functions, no pg_depend rows). Run as one script: the
-- SQL editor executes it as a single implicit transaction, so the function
-- is never absent.
--
-- Grants: a recreated function gets PUBLIC execute by default. The ACL before
-- this migration was postgres, authenticated, service_role; it is restored
-- exactly. The body gate is the real control either way.
--
-- Workspaces, never people: every count here is per workspace.

drop function if exists public.admin_pilot_overview();

create function public.admin_pilot_overview()
 returns table(
   org_id uuid, org_name text, org_type text, code text, account_stage text, stage text,
   started_on date, decision_on date, days_in integer, days_to_decision integer,
   goal text, next_step text, annual_value_usd integer, members integer, seats integer,
   last_email_status text, last_active timestamp with time zone, active_days_7d integer,
   first_ai_capture timestamp with time zone,
   s1_showed_up boolean, s2_captured boolean, s3_ai_capture boolean, s4_organized boolean,
   s5_judgment boolean, s6_asked boolean, s7_traced boolean, s8_shared boolean,
   problems_7d integer, updated_at timestamp with time zone,
   s3b_read_back boolean, read_back_28d integer, furthest_step_28d text
 )
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not a platform admin' using errcode = '42501';
  end if;

  return query
  with pilots as (select * from public.pilot_accounts),
  staff as (
    select p.id from public.profiles p
      join public.platform_admins a on a.user_id = p.user_id and a.disabled_at is null
  ),
  -- The journey definition. One list per step; mirrored by PostHog MduSYwpo and 2mFsBPcA.
  tagged as (
    select e.org_id, e.ts, e.profile_id,
           e.event_type in ('presence.active', 'workboard.opened', 'home.opened') as k1,
           e.event_type in ('workitem.captured', 'artifact.captured') as k2,
           coalesce(e.event_type = 'workitem.captured' and e.dims->>'channel' = 'mcp', false) as k3,
           e.event_type = 'mcp.read' as k3b,
           e.event_type in ('container.created', 'workboard.node_created', 'container.reparented',
                            'workitem.mapped', 'workboard.work_added', 'workboard.workstream_drawn',
                            'workboard.workstream_created', 'workboard.region_named',
                            'workboard.section_created') as k4,
           e.event_type in ('decisions_doc.version_recorded', 'document.version_recorded',
                            'decision.drafted', 'decision.confirmed', 'decision.edited',
                            'decision.resolved') as k5,
           e.event_type in ('reflect.message_sent', 'findit.searched') as k6,
           e.event_type in ('link.drafted', 'link.reviewed', 'link.drawn', 'span_link.created',
                            'workboard.trail_item_selected') as k7,
           e.event_type in ('board.share_link', 'coach.joined', 'board.invite_sent',
                            'board.invite_accepted', 'engagement.access_changed',
                            'shared.board_opened') as k8,
           e.event_type in ('client.error', 'workboard.save_failed') as kp,
           e.ts > now() - interval '28 days' as w28
      from public.events e
     where e.org_id in (select pilots.org_id from pilots)
       and e.environment is distinct from 'preview'
       and e.environment is distinct from 'local'
       and (e.profile_id is null or e.profile_id not in (select staff.id from staff))
  ),
  ev as (
    select t.org_id,
           max(t.ts) filter (where t.profile_id is not null) as last_active,
           count(distinct date_trunc('day', t.ts))
             filter (where t.profile_id is not null and t.ts > now() - interval '7 days') as active_days_7d,
           min(t.ts) filter (where t.k3) as first_ai,
           bool_or(t.k1) as s1, bool_or(t.k2) as s2, bool_or(t.k3) as s3, bool_or(t.k3b) as s3b,
           bool_or(t.k4) as s4, bool_or(t.k5) as s5, bool_or(t.k6) as s6,
           bool_or(t.k7) as s7, bool_or(t.k8) as s8,
           count(*) filter (where t.kp and t.ts > now() - interval '7 days') as problems,
           count(*) filter (where t.k3b and t.w28) as read_back_28d,
           case
             when bool_or(t.k8  and t.w28) then '8 · Shared'
             when bool_or(t.k7  and t.w28) then '7 · Traced to source'
             when bool_or(t.k6  and t.w28) then '6 · Asked'
             when bool_or(t.k5  and t.w28) then '5 · Judgment'
             when bool_or(t.k4  and t.w28) then '4 · Organized'
             when bool_or(t.k3b and t.w28) then '3b · AI read-back'
             when bool_or(t.k3  and t.w28) then '3 · AI capture'
             when bool_or(t.k2  and t.w28) then '2 · Captured'
             when bool_or(t.w28)           then '1 · Showed up'
           end as furthest_28d
      from tagged t
     group by t.org_id
  ),
  mem as (
    select p.org_id, count(*) filter (where p.deactivated_at is null) as members
      from public.profiles p
     where p.org_id in (select pilots.org_id from pilots)
       and p.id not in (select staff.id from staff)
     group by p.org_id
  ),
  ent as (
    select distinct on (e.org_id) e.org_id, e.seats from public.entitlements e
     where e.status = 'active' order by e.org_id, e.created_at desc
  ),
  mail as (
    select distinct on (m.org_id) m.org_id, m.status from public.outbound_emails m
     where m.org_id is not null order by m.org_id, m.created_at desc
  )
  select o.id, o.name, coalesce(o.settings->>'type', 'unset'),
         left(encode(sha256(convert_to(o.id::text, 'UTF8')), 'hex'), 6),
         public.account_stage(o.id),
         pi.stage, pi.started_on, pi.decision_on,
         (current_date - pi.started_on)::int,
         case when pi.decision_on is null then null else (pi.decision_on - current_date)::int end,
         pi.goal, pi.next_step, pi.annual_value_usd,
         coalesce(mem.members, 0)::int, ent.seats, mail.status,
         ev.last_active, coalesce(ev.active_days_7d, 0)::int, ev.first_ai,
         coalesce(ev.s1, false), coalesce(ev.s2, false), coalesce(ev.s3, false), coalesce(ev.s4, false),
         coalesce(ev.s5, false), coalesce(ev.s6, false), coalesce(ev.s7, false), coalesce(ev.s8, false),
         coalesce(ev.problems, 0)::int,
         pi.updated_at,
         coalesce(ev.s3b, false), coalesce(ev.read_back_28d, 0)::int, ev.furthest_28d
    from pilots pi
    join public.orgs o on o.id = pi.org_id
    left join ev   on ev.org_id   = pi.org_id
    left join mem  on mem.org_id  = pi.org_id
    left join ent  on ent.org_id  = pi.org_id
    left join mail on mail.org_id = pi.org_id
   order by (pi.stage in ('active', 'paused')) desc, pi.decision_on asc nulls last, o.name;
end;
$function$;

revoke all on function public.admin_pilot_overview() from public, anon;
grant execute on function public.admin_pilot_overview() to authenticated, service_role;

comment on function public.admin_pilot_overview() is
  'Founder console pilot overview. Platform admins only (gated in the body). The journey '
  'definition: the step event lists in the tagged CTE are the source of truth; PostHog '
  'insights MduSYwpo (journey) and 2mFsBPcA (workspace health) copy them. s1..s8 and '
  's3b_read_back are all-time; read_back_28d and furthest_step_28d use the last 28 days. '
  'Per workspace, never per person. AUDIT-4 Q22, 8 Nov 2026.';
