-- 19 Nov 2026: message_consents, the record that a person agreed to receive text messages from Lasso.
-- Written by one server function (recordTextConsentFn, the public page at /texts) with the service role.
--
-- Privacy floor: this is the only table that holds a mobile number. Row security is on and there is no policy, and
-- every grant to the browser roles is taken away, so no signed-in or signed-out browser can read, add, change or
-- remove a row. Only the server's service role can. Adds only: no existing table, column or policy changes.

create table if not exists public.message_consents (
  id uuid primary key default gen_random_uuid(),
  -- The workspace whose link the person followed, when the link named one. The agreement outlives the workspace.
  org_id uuid references public.orgs(id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  -- United States and Canada only, in one form: +1 and ten digits.
  phone_e164 text not null check (phone_e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  channel text not null default 'sms' check (channel = 'sms'),
  -- The exact words beside the tick box when the person agreed, and their version.
  consent_text text not null check (char_length(consent_text) between 1 and 1000),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  source text not null default 'public_page' check (source = 'public_page'),
  agreed_at timestamptz not null default now(),
  -- Set when the person opts out (STOP). The row stays, as proof the choice was honoured.
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_consents_revoked_after_agreed check (revoked_at is null or revoked_at >= agreed_at)
);

-- One live agreement per number. A second press of the form, or a second visit, adds nothing.
create unique index if not exists message_consents_live_phone_idx
  on public.message_consents (phone_e164)
  where revoked_at is null;

create index if not exists message_consents_org_idx on public.message_consents (org_id) where org_id is not null;

alter table public.message_consents enable row level security;
-- No policy on purpose: with row security on, no policy means no rows for anon and authenticated.

revoke all on table public.message_consents from public, anon, authenticated;
grant select, insert, update on table public.message_consents to service_role;

comment on table public.message_consents is
  'Agreements to receive text messages. Holds mobile numbers: service role only, no browser access, never copied into events or logs.';
