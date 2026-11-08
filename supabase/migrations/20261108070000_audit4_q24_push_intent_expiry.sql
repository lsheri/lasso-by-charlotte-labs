-- AUDIT-4, Q24 (8 Nov 2026). Additive plus one scheduled job.
--
-- A5 F30: a push intent that never completed stayed "intent" forever and sat
-- on the push-health tile as a push in flight (two from 28 Oct still were).
-- Rule: an intent still open after 24 hours is expired. The push did not
-- arrive; nothing user-facing waits on it. The app only completes rows in
-- ('intent', 'partial'), so an expired row stays expired even if the push
-- turns up a day late; the work still lands, the intent just records that
-- it missed its window.

alter table public.push_intents
  add column if not exists expired_at timestamp with time zone;

alter table public.push_intents
  drop constraint if exists push_intents_status_check;
alter table public.push_intents
  add constraint push_intents_status_check
  check (status = any (array['intent'::text, 'complete'::text, 'partial'::text, 'expired'::text]));

-- Hourly from pg_cron (no JWT, passes), the service role, or a platform admin.
-- An anonymous or ordinary signed-in caller is refused inside the function,
-- so the default PUBLIC execute grant exposes nothing.
create or replace function public.expire_stale_push_intents(p_older_than interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  if coalesce(auth.role(), 'postgres') not in ('service_role', 'postgres')
     and not public.is_platform_admin(auth.uid(), 'support') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  update public.push_intents
     set status = 'expired', expired_at = now()
   where status = 'intent'
     and created_at < now() - p_older_than;
  get diagnostics n = row_count;
  return n;
end;
$function$;

comment on function public.expire_stale_push_intents(interval) is
  'AUDIT-4 Q24: marks push intents still open after the window (default 24 h) as expired. Run hourly by pg_cron.';

-- Same convention as the other hourly jobs (seat-usage-hourly :07, support-grants-expiry :13).
select cron.schedule('push-intents-expiry', '37 * * * *', $$select public.expire_stale_push_intents()$$)
 where not exists (select 1 from cron.job where jobname = 'push-intents-expiry');

-- Clear the backlog once, now, under the same rule the job will apply.
select public.expire_stale_push_intents();
