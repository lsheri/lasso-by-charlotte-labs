-- AUDIT-4 Q25: admin_ai_usage per profile, founder only.
--
-- Decision D2, 26 Oct 2026 (BUILD-LOG-oct26-ai-usage-person-attribution):
-- person-level AI cost is allowed, founder-facing only. ai_usage.profile_id has
-- been written since 27 Oct; until now no function read it.
--
-- What changes:
--   * New parameter p_group text default 'workspace'.
--       'workspace'  exactly today's rows and gate (support tier and up). The two
--                    appended columns are null.
--       'profile'    one row per workspace and person. FOUNDER TIER ONLY, checked
--                    in the body, separately from the workspace gate. Calls with no
--                    recorded person (rows before 27 Oct, system calls) are one row
--                    per workspace labelled 'no person recorded', so the profile
--                    view sums to the workspace view to the cent.
--       anything else raises.
--   * Appended columns: profile_id uuid, person text (profiles.display_name).
--   * In profile mode people and cost_per_person are null: they describe a
--     workspace, not a person.
--
-- Unchanged: the window (p_days), the row filter, every existing column, the
-- workspace-mode gate.
--
-- Why drop and create: adding a defaulted parameter beside the old
-- admin_ai_usage(integer) would leave two overloads, and admin_ai_usage(30)
-- would then be ambiguous and fail in the console. Nothing in the database
-- depends on it (checked 7 Nov). Run as one script: the SQL editor executes it
-- as a single implicit transaction, so the function is never absent.
--
-- Grants: restored exactly as before (postgres, authenticated, service_role;
-- no PUBLIC, no anon). The body gates are the real control.
--
-- Where this may appear: the founder console only. Never a partner, firm,
-- coach or member surface, and never PostHog. Before the first signed firm,
-- D4 (per-org switch back to hashed) decides whether profile mode stays on
-- for that firm's workspace.

drop function if exists public.admin_ai_usage(integer);

create function public.admin_ai_usage(p_days integer default 30, p_group text default 'workspace')
 returns table(
   org_id uuid, org_name text, org_type text, calls bigint, tokens_in bigint, cached_in bigint,
   tokens_out bigint, cost_usd numeric, people bigint, cost_per_person numeric,
   last_call timestamp with time zone,
   profile_id uuid, person text
 )
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_platform_admin(auth.uid(), 'support') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  if p_group is null or p_group not in ('workspace', 'profile') then
    raise exception 'p_group must be workspace or profile' using errcode = '22023';
  end if;

  if p_group = 'workspace' then
    return query
    select u.org_id,
           o.name                             as org_name,
           coalesce(o.settings->>'type', 'unknown') as org_type,
           count(*)                           as calls,
           sum(u.tokens_in)::bigint           as tokens_in,
           sum(u.cached_in)::bigint           as cached_in,
           sum(u.tokens_out)::bigint          as tokens_out,
           round(sum(u.cost_usd), 4)          as cost_usd,
           p.people,
           case when coalesce(p.people, 0) = 0 then null
                else round(sum(u.cost_usd) / p.people, 4) end as cost_per_person,
           max(u.created_at)                  as last_call,
           null::uuid                         as profile_id,
           null::text                         as person
      from public.ai_usage u
      left join public.orgs o on o.id = u.org_id
      left join lateral (
        select count(*) as people
          from public.profiles pr
         where pr.org_id = u.org_id and pr.deactivated_at is null
      ) p on true
     where u.created_at >= now() - make_interval(days => greatest(p_days, 1))
     group by u.org_id, o.name, o.settings->>'type', p.people
     order by 8 desc nulls last;
    return;
  end if;

  -- Profile mode: person-level cost. Founder tier only (D2, 26 Oct).
  if not public.is_platform_admin(auth.uid(), 'founder') then
    raise exception 'per-person cost is founder only' using errcode = '42501';
  end if;

  return query
  select u.org_id,
         o.name                             as org_name,
         coalesce(o.settings->>'type', 'unknown') as org_type,
         count(*)                           as calls,
         sum(u.tokens_in)::bigint           as tokens_in,
         sum(u.cached_in)::bigint           as cached_in,
         sum(u.tokens_out)::bigint          as tokens_out,
         round(sum(u.cost_usd), 4)          as cost_usd,
         null::bigint                       as people,
         null::numeric                      as cost_per_person,
         max(u.created_at)                  as last_call,
         u.profile_id,
         case when u.profile_id is null then 'no person recorded'
              else coalesce(nullif(pr.display_name, ''), 'unnamed person') end as person
    from public.ai_usage u
    left join public.orgs o on o.id = u.org_id
    left join public.profiles pr on pr.id = u.profile_id
   where u.created_at >= now() - make_interval(days => greatest(p_days, 1))
   group by u.org_id, o.name, o.settings->>'type', u.profile_id, pr.display_name
   order by 8 desc nulls last;
end;
$function$;

revoke all on function public.admin_ai_usage(integer, text) from public, anon;
grant execute on function public.admin_ai_usage(integer, text) to authenticated, service_role;

comment on function public.admin_ai_usage(integer, text) is
  'Founder console AI usage over p_days. p_group workspace (support tier and up): one row per '
  'workspace, as before. p_group profile (founder tier only, D2 26 Oct 2026): one row per '
  'workspace and person, with calls that recorded no person as their own row. Founder console '
  'only; never a partner, firm, coach or member surface, never PostHog. AUDIT-4 Q25, 8 Nov 2026.';
