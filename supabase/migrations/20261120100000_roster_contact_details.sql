-- 20 Nov 2026, People we work with: contact details for a roster person (Liam: "profiles cant be added from an admin
-- without number and email. i'd like linkedin as well").
--
-- ONE PASTE. Paste this whole file once. The numbers inside (1, 2, 3...) are only notes for a reader, not separate
-- steps. Safe to run twice: every statement is "if not exists", "or replace", a trigger dropped if it exists and
-- then made, or a grant or revoke that changes nothing the second time.
--
-- Adds only: one new table, three new functions and one trigger on the new table. No existing table, column, row,
-- index or policy is changed or removed. To undo it, run supabase/undo/20261120100000_roster_contact_details_undo.sql.
--
-- What it does NOT do: a number here is contact information typed by an admin or a lead. It is never an agreement
-- to texts. Texts still go only to the number a person entered themselves on their own /texts link
-- (message_consents). Nothing in the sending code reads this table.

-- 1. The details. One row per roster person, and only for a person who has both a number and an email: people added
-- before this have no row, and the app marks them as needing details. The same number or email may sit on several
-- people (a shared office line, a demo), so neither is unique.
create table if not exists public.roster_contact_details (
  roster_contact_id uuid primary key references public.roster_contacts(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  linkedin_url text check (
    linkedin_url is null
    or (char_length(linkedin_url) <= 200 and linkedin_url ~ '^https://([a-z0-9-]+\.)?linkedin\.com/[^[:space:]]+$')
  ),
  -- When Lasso last emailed this person their own text agreement link. Empty until an admin or lead asks for it.
  invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roster_contact_details_org_idx on public.roster_contact_details (org_id);

-- 2. Details stay in their person's workspace: the workspace on a details row is always the person's own.
create or replace function public.roster_contact_details_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.roster_contacts c
    where c.id = new.roster_contact_id and c.org_id = new.org_id
  ) then
    raise exception 'contact details stay in their person''s workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists roster_contact_details_t_guard on public.roster_contact_details;
create trigger roster_contact_details_t_guard
  before insert or update on public.roster_contact_details
  for each row execute function public.roster_contact_details_guard();

-- 3. Who reads and writes: the server only. Row security is on with NO policy, and the browser roles (anon,
-- authenticated) hold no grant, so no signed-in or signed-out browser can read, add, change or remove a row.
-- The server functions check that the caller is an admin or a lead of the workspace before they touch it.
alter table public.roster_contact_details enable row level security;
revoke all on table public.roster_contact_details from public, anon, authenticated;
grant select, insert, update on table public.roster_contact_details to service_role;
revoke all on function public.roster_contact_details_guard() from public, anon, authenticated;

comment on table public.roster_contact_details is
  'Mobile number, email and LinkedIn address of a roster person, typed by an admin or lead. Contact information only: never an agreement to texts. Service role only.';

-- 4. Adding or correcting a person, in one transaction, so a person is never added without their details.
-- p_id null adds; an id corrects that person, only inside p_org.
-- p_email null leaves the details alone (an older person with none stays as they are).
-- p_phone null keeps the number already stored.
-- Answers: the person's id, or 'missing' (not in this workspace), 'full' (the list is at p_max), 'details' (an add,
-- or a first set of details, without both a number and an email). Nothing is written before any of those answers.
create or replace function public.save_roster_contact(
  p_org uuid,
  p_id uuid,
  p_name text,
  p_role text,
  p_affiliation text,
  p_firm text,
  p_phone text,
  p_email text,
  p_linkedin text,
  p_max integer
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_has boolean;
begin
  if p_id is null then
    if p_phone is null or p_email is null then
      return 'details';
    end if;
    if (select count(*) from public.roster_contacts where org_id = p_org) >= p_max then
      return 'full';
    end if;
    insert into public.roster_contacts (org_id, full_name, role_title, affiliation, firm_name)
      values (p_org, p_name, p_role, p_affiliation, p_firm)
      returning id into v_id;
    insert into public.roster_contact_details (roster_contact_id, org_id, phone_e164, email, linkedin_url)
      values (v_id, p_org, p_phone, p_email, p_linkedin);
    return v_id::text;
  end if;

  select id into v_id
    from public.roster_contacts
    where id = p_id and org_id = p_org
    for update;
  if not found then
    return 'missing';
  end if;

  select true into v_has from public.roster_contact_details where roster_contact_id = v_id;
  if p_email is not null and v_has is not true and p_phone is null then
    return 'details';
  end if;

  update public.roster_contacts
    set full_name = p_name, role_title = p_role, affiliation = p_affiliation, firm_name = p_firm, updated_at = now()
    where id = v_id;

  if p_email is not null then
    if v_has then
      update public.roster_contact_details
        set phone_e164 = coalesce(p_phone, phone_e164), email = p_email, linkedin_url = p_linkedin, updated_at = now()
        where roster_contact_id = v_id;
    else
      insert into public.roster_contact_details (roster_contact_id, org_id, phone_e164, email, linkedin_url)
        values (v_id, p_org, p_phone, p_email, p_linkedin);
    end if;
  end if;
  return v_id::text;
end;
$$;

revoke all on function public.save_roster_contact(uuid, uuid, text, text, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.save_roster_contact(uuid, uuid, text, text, text, text, text, text, text, integer) to service_role;

-- 5. People whose own agreed number is not the number on file. The comparison happens here, in the database, so
-- neither number leaves it: the answer is only which people differ. Texts use the agreed number, always.
create or replace function public.roster_number_differs(p_org uuid)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.roster_contact_id
    from public.roster_contact_details d
    join public.message_consents m
      on m.roster_contact_id = d.roster_contact_id and m.org_id = d.org_id and m.revoked_at is null
    where d.org_id = p_org and m.phone_e164 <> d.phone_e164;
$$;

revoke all on function public.roster_number_differs(uuid) from public, anon, authenticated;
grant execute on function public.roster_number_differs(uuid) to service_role;
