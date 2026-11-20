-- 19 Nov 2026, Proposal Desk: text agreements at five firms' size (Liam: "durably built for scaling pilots to 5
-- total firms"). Four changes to message_consents and roster_contacts, and one function.
--
-- Safe to run twice: every statement is "if not exists", "if exists", "or replace", or a grant or revoke that changes
-- nothing the second time.
--
-- This file does not only add. It replaces one index: "one live agreement per number" becomes "one live agreement
-- per number in each workspace". The new index is made first and the old one dropped after, so there is never a
-- moment with no rule. No column, row or policy is removed or changed.

-- 1. One person, several firms. The same mobile number can hold a live agreement in more than one workspace, one in
-- each. (An agreement made on plain /texts, with no workspace, counts as its own place.)
create unique index if not exists message_consents_live_phone_org_idx
  on public.message_consents (phone_e164, coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

drop index if exists public.message_consents_live_phone_idx;

-- 2. Why an agreement ended: a STOP reply, the stop form on the person's own link, or a change of number.
alter table public.message_consents
  add column if not exists revoked_reason text
  check (revoked_reason is null or revoked_reason in ('stop_reply', 'stop_link', 'number_changed'));

-- 3. Proof the number is theirs. Empty until a message arrives from that number (a reply to the first text). Nothing
-- in the app can set it by typing.
alter table public.message_consents
  add column if not exists confirmed_at timestamptz;

-- 4. Changing a number. An admin or lead opens a short window on one roster person; inside it, that person's own
-- link accepts one new number. Outside it the first number stays, so a link passed on later cannot swap it.
alter table public.roster_contacts
  add column if not exists number_change_until timestamptz;

-- 5. The swap itself, in one transaction: the old agreement is ended, the new one stored with its words and time,
-- and the window closed. If any step fails, none of them happened. Called by the server only, after it has checked
-- every field; the browser roles cannot run it.
-- Answers: 'none' (no such person here, or nothing to replace), 'same' (that is already their number),
-- 'closed' (no window is open), 'replaced'.
create or replace function public.replace_text_consent(
  p_org uuid,
  p_contact uuid,
  p_phone text,
  p_name text,
  p_text text,
  p_version text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_until timestamptz;
  v_old_id uuid;
  v_old_phone text;
  v_tied integer;
begin
  select number_change_until into v_until
    from public.roster_contacts
    where id = p_contact and org_id = p_org
    for update;
  if not found then
    return 'none';
  end if;

  select id, phone_e164 into v_old_id, v_old_phone
    from public.message_consents
    where roster_contact_id = p_contact and org_id = p_org and revoked_at is null
    for update;
  if not found then
    return 'none';
  end if;
  if v_old_phone = p_phone then
    return 'same';
  end if;
  if v_until is null or v_until < now() then
    return 'closed';
  end if;

  update public.message_consents
    set revoked_at = now(), revoked_reason = 'number_changed'
    where id = v_old_id;

  -- The new number may already have agreed in this workspace without naming a person: that agreement becomes theirs.
  update public.message_consents
    set roster_contact_id = p_contact
    where phone_e164 = p_phone and org_id = p_org and revoked_at is null and roster_contact_id is null;
  get diagnostics v_tied = row_count;

  if v_tied = 0 then
    insert into public.message_consents (org_id, roster_contact_id, full_name, phone_e164, consent_text, consent_version, source)
      values (p_org, p_contact, p_name, p_phone, p_text, p_version, 'public_page');
  end if;

  update public.roster_contacts set number_change_until = null where id = p_contact;
  return 'replaced';
end;
$$;

revoke all on function public.replace_text_consent(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.replace_text_consent(uuid, uuid, text, text, text, text) to service_role;
