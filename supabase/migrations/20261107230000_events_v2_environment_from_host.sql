-- AUDIT-1b (7 Nov 2026): events_v2 stamps environment from the request host,
-- the same four values events uses, so a preview question stops being called
-- production. Additive: the check only widens. Existing rows keep their value
-- ("production" everywhere, which was the bug). qa stays for the QA probe.
alter table public.events_v2
  drop constraint if exists events_v2_environment_check;
alter table public.events_v2
  add constraint events_v2_environment_check
  check (environment = any (array['production'::text, 'preview'::text, 'local'::text, 'unknown'::text, 'staging'::text, 'test'::text, 'qa'::text]));
