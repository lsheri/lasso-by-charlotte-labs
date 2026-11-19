-- Step 8 (firm brain): the most common question kinds across the firm, for admins and leads. No table. It reads the
-- firm_ask.asked events already recorded (no question text, no profile id) and counts distinct askers per kind.
-- A kind asked by fewer than five people never leaves this function. It returns a band, never an exact count, and
-- the window is fixed, so two calls cannot be subtracted to find one person.
create or replace function public.firm_common_question_kinds(p_org uuid)
returns table (question_source text, question_kind text, askers_band text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with asked as (
    select e.actor_hash, s.src, s.knd
      from events e
      cross join lateral (values ('topic'::text, e.dims->>'topic'), ('starter'::text, e.dims->>'starter')) as s(src, knd)
     where public.firm_role_in(p_org) in ('admin', 'lead')
       and e.org_id = p_org
       and e.event_type = 'firm_ask.asked'
       and e.environment = 'production'
       and e.ts >= now() - interval '90 days'
       and e.actor_hash is not null
       and coalesce(s.knd, '') not in ('', 'none')
  ), counted as (
    select a.src, a.knd, count(distinct a.actor_hash) as askers
      from asked a
     group by a.src, a.knd
    having count(distinct a.actor_hash) >= 5
  )
  select c.src, c.knd,
         case when c.askers < 10 then '5 to 9' when c.askers < 25 then '10 to 24' else '25 or more' end
    from counted c
   order by (c.askers >= 25) desc, (c.askers >= 10) desc, c.src, c.knd
$$;

revoke all on function public.firm_common_question_kinds(uuid) from public;
grant execute on function public.firm_common_question_kinds(uuid) to authenticated;
