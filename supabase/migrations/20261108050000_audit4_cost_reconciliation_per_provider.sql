-- AUDIT-4, Q9 + Q23 (8 Nov 2026). Additive.
--
-- A3 F14/F29: the cost reconciliation compared the OpenAI bill feed against
-- the WHOLE ai_usage ledger. Since the 6 Nov switch to Anthropic the ledger
-- is almost all Claude and the OpenAI feed is almost zero, so the console and
-- the health check have reported a ~$10/day "gap" that is two providers, not
-- an error. Ops health also called the OpenAI feed "dark" because nothing
-- uses OpenAI any more.
--
-- Changes:
--   1. ai_costs_daily gains provider (openai|anthropic) and source
--      (openai_usage_api|manual). Existing rows are openai / openai_usage_api.
--   2. ai_provider_of_model(model) maps a model name to its billed provider.
--   3. admin_ai_cost_reconciliation(p_days, p_provider default 'openai')
--      compares each provider's bill against that provider's ledger rows only,
--      and returns the provider on each row. Same gate, same grants.
--   4. admin_ai_cost_record_billed(day, provider, amount, note) lets the
--      founder enter the Anthropic monthly amount by hand until a feed exists.
--   5. admin_ops_health.cost_sync judges darkness per provider: a feed is dark
--      only when it is stale AND that provider's ledger shows spend.

alter table public.ai_costs_daily
  add column if not exists provider text not null default 'openai',
  add column if not exists source text not null default 'openai_usage_api',
  add column if not exists note text;

alter table public.ai_costs_daily
  drop constraint if exists ai_costs_daily_provider_check;
alter table public.ai_costs_daily
  add constraint ai_costs_daily_provider_check
  check (provider = any (array['openai'::text, 'anthropic'::text]));

alter table public.ai_costs_daily
  drop constraint if exists ai_costs_daily_source_check;
alter table public.ai_costs_daily
  add constraint ai_costs_daily_source_check
  check (source = any (array['openai_usage_api'::text, 'manual'::text]));

create or replace function public.ai_provider_of_model(p_model text)
returns text
language sql
immutable
as $$
  select case
    when p_model like 'claude%' then 'anthropic'
    when p_model like 'gpt%' or p_model like 'o1%' or p_model like 'o3%' or p_model like 'o4%' then 'openai'
    else 'other'
  end;
$$;

-- The signature changes (a defaulted provider argument and a provider column
-- on each row), so the old function is dropped rather than replaced.
drop function if exists public.admin_ai_cost_reconciliation(integer);

create or replace function public.admin_ai_cost_reconciliation(
  p_days integer default 14,
  p_provider text default 'openai'
)
returns table(
  provider text,
  day date,
  billed_usd numeric,
  estimated_usd numeric,
  difference_usd numeric,
  pct_off numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_platform_admin(auth.uid(), 'support') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  return query
  with providers as (
    select unnest(case when p_provider is null
                       then array['openai'::text, 'anthropic'::text]
                       else array[p_provider] end) as pv
  ),
  days as (
    select generate_series(
             (current_date - greatest(p_days, 1))::date,
             current_date,
             interval '1 day'
           )::date as d
  ),
  grid as (
    select providers.pv, days.d from providers cross join days
  ),
  billed as (
    select c.provider as pv, c.day as d, sum(c.amount_usd) as usd
      from public.ai_costs_daily c group by c.provider, c.day
  ),
  est as (
    select public.ai_provider_of_model(u.model) as pv,
           (u.created_at at time zone 'utc')::date as d,
           sum(u.cost_usd) as usd
      from public.ai_usage u group by 1, 2
  )
  select grid.pv,
         grid.d,
         round(coalesce(billed.usd, 0), 4),
         round(coalesce(est.usd, 0), 4),
         round(coalesce(billed.usd, 0) - coalesce(est.usd, 0), 4),
         case when coalesce(billed.usd, 0) = 0 then null
              else round(100 * (coalesce(est.usd, 0) - billed.usd) / billed.usd, 1) end
    from grid
    left join billed on billed.pv = grid.pv and billed.d = grid.d
    left join est    on est.pv    = grid.pv and est.d    = grid.d
   order by grid.pv, grid.d desc;
end;
$function$;

grant execute on function public.admin_ai_cost_reconciliation(integer, text) to authenticated, service_role;

-- Founder-entered billed amount for a provider with no feed (Anthropic today).
-- One row per day; a monthly invoice goes on the last day of the month with
-- the note saying so. Upsert, so a correction overwrites.
create or replace function public.admin_ai_cost_record_billed(
  p_day date,
  p_provider text,
  p_amount_usd numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_platform_admin(auth.uid(), 'support') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_provider not in ('openai', 'anthropic') then
    raise exception 'unknown provider %', p_provider using errcode = '22023';
  end if;

  insert into public.ai_costs_daily (day, openai_project_id, project_label, provider, source, amount_usd, currency, input_tokens, output_tokens, note, fetched_at)
  values (p_day, p_provider || ':manual', p_provider || ' (entered by hand)', p_provider, 'manual', p_amount_usd, 'usd', 0, 0, p_note, now())
  on conflict (day, openai_project_id) do update
    set amount_usd = excluded.amount_usd,
        note = excluded.note,
        fetched_at = now();
end;
$function$;

grant execute on function public.admin_ai_cost_record_billed(date, text, numeric, text) to authenticated, service_role;

-- Ops health: darkness is per provider. The top-level keys keep their old
-- meaning for the console (OpenAI feed), plus by_provider.
create or replace function public.admin_ops_health()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not public.is_platform_admin(auth.uid(), 'support') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  with ledger as (
    select public.ai_provider_of_model(u.model) as pv,
           round(coalesce(sum(u.cost_usd) filter (where u.created_at >= now() - interval '2 days'), 0), 4) as usd_last_2,
           round(coalesce(sum(u.cost_usd) filter (where u.created_at >= now() - interval '7 days'), 0), 4) as usd_last_7
      from public.ai_usage u group by 1
  ),
  feed as (
    select c.provider as pv,
           max(c.day) filter (where c.source = 'openai_usage_api') as last_feed_day,
           max(c.day) as last_any_day,
           round(coalesce(sum(c.amount_usd) filter (where c.day >= current_date - 7), 0), 4) as usd_last_7,
           count(*) filter (where c.source = 'manual' and c.day >= current_date - 45) as manual_rows_45
      from public.ai_costs_daily c group by 1
  ),
  per as (
    select p.pv,
           feed.last_feed_day,
           feed.last_any_day,
           coalesce(feed.usd_last_7, 0) as billed_usd_last_7,
           coalesce(feed.manual_rows_45, 0) as manual_rows_45,
           coalesce(ledger.usd_last_2, 0) as ledger_usd_last_2,
           coalesce(ledger.usd_last_7, 0) as ledger_usd_last_7,
           case p.pv when 'openai' then 'openai_usage_api' else 'none' end as feed_kind,
           -- dark = the feed is stale AND the ledger says this provider was used
           (p.pv = 'openai'
             and coalesce(ledger.usd_last_2, 0) > 0
             and (feed.last_feed_day is null or (current_date - feed.last_feed_day) > 1)) as is_dark
      from (values ('openai'), ('anthropic')) as p(pv)
      left join feed   on feed.pv   = p.pv
      left join ledger on ledger.pv = p.pv
  )
  select jsonb_build_object(
    'checked_at', now(),
    'cost_sync', (
      select jsonb_build_object(
        'last_day', (select last_feed_day from per where pv = 'openai'),
        'days_stale', (select current_date - last_feed_day from per where pv = 'openai'),
        'usd_last_7', (select billed_usd_last_7 from per where pv = 'openai'),
        'is_dark', (select bool_or(is_dark) from per),
        'by_provider', (select jsonb_object_agg(pv, jsonb_build_object(
            'feed', feed_kind,
            'last_feed_day', last_feed_day,
            'last_any_day', last_any_day,
            'days_stale', case when last_feed_day is null then null else current_date - last_feed_day end,
            'billed_usd_last_7', billed_usd_last_7,
            'ledger_usd_last_2', ledger_usd_last_2,
            'ledger_usd_last_7', ledger_usd_last_7,
            'manual_rows_45', manual_rows_45,
            'is_dark', is_dark,
            'note', case
              when pv = 'anthropic' then 'no bill feed; enter the invoice with admin_ai_cost_record_billed'
              when is_dark then 'ledger shows spend but the feed has not updated'
              when ledger_usd_last_2 = 0 then 'quiet: no spend on this provider in 2 days'
              else 'ok' end
          )) from per)
      )
    ),
    'events', (select jsonb_build_object('pending', count(*), 'oldest_pending', min(server_ts),
        'minutes_behind', case when count(*)=0 then 0 else round(extract(epoch from (now()-min(server_ts)))/60.0) end)
      from public.events where egressed_at is null and egress_skipped_reason is null and org_id is not null),
    'emails', (select jsonb_build_object(
        'by_status', coalesce(jsonb_object_agg(status, n), '{}'::jsonb),
        'stuck', coalesce((select count(*) from public.outbound_emails where status='failed' and attempts>=5),0),
        'waiting', coalesce((select count(*) from public.outbound_emails where status in ('queued','sending')),0))
      from (select status, count(*) as n from public.outbound_emails group by status) t),
    'sweep', (select jsonb_build_object('last_at', max(created_at),
        'minutes_since', round(extract(epoch from (now()-max(created_at)))/60.0),
        'runs_last_hour', (select count(*) from public.sweep_runs where created_at > now() - interval '1 hour'))
      from public.sweep_runs)
  ) into v;
  return v;
end; $function$;
