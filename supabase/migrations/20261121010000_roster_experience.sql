-- 20 Nov 2026, People we work with: experience on a person (Liam, D-86: "admins will be able to write blurbs about
-- their experience and maybe upload a resume or documents about their experience as context. if wanted").
--
-- ONE PASTE. Paste this whole file once. The numbers inside (1, 2, 3...) are only notes for a reader, not separate
-- steps. Safe to run twice: every statement is "if not exists", "or replace", a trigger dropped if it exists and
-- then made, an insert that does nothing when the row is there, or a grant or revoke that changes nothing the second
-- time.
--
-- Adds only: two new tables, one new function, two triggers on the new tables, and one new private storage bucket.
-- No existing table, column, row, index, policy or bucket is changed or removed. To undo it, run
-- supabase/undo/20261121010000_roster_experience_undo.sql.
--
-- Who can see it: only the server. Both tables have row security on with no policy, and the browser roles hold no
-- grant. The bucket is private with no storage policy, so no browser can list, read or write a file in it; the
-- server hands an admin or lead a one-minute link to read one file, or a one-time link to upload one. The server
-- checks that the caller is an admin or a lead of the person's own workspace before any of that.

-- 1. The blurb. One row per roster person who has one. Plain text, up to 1500 characters.
create table if not exists public.roster_contact_experience (
  roster_contact_id uuid primary key references public.roster_contacts(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  blurb text not null check (char_length(blurb) between 1 and 1500),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roster_contact_experience_org_idx on public.roster_contact_experience (org_id);

-- 2. The documents. At most five per person, which the server enforces. The path is chosen by the server as
-- <workspace>/<person>/<fresh id>.<kind>, never from the file's own name, so a name cannot reach another folder.
create table if not exists public.roster_contact_experience_files (
  id uuid primary key,
  roster_contact_id uuid not null references public.roster_contacts(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  storage_path text not null unique check (
    char_length(storage_path) <= 200
    and storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|doc|txt|md)$'
    and split_part(storage_path, '/', 1) = org_id::text
    and split_part(storage_path, '/', 2) = roster_contact_id::text
  ),
  file_name text not null check (char_length(file_name) between 1 and 120),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now()
);

create index if not exists roster_contact_experience_files_person_idx
  on public.roster_contact_experience_files (org_id, roster_contact_id);

-- 3. Experience stays in its person's workspace: the workspace on a row is always the person's own.
create or replace function public.roster_experience_guard()
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
    raise exception 'experience stays in its person''s workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists roster_contact_experience_t_guard on public.roster_contact_experience;
create trigger roster_contact_experience_t_guard
  before insert or update on public.roster_contact_experience
  for each row execute function public.roster_experience_guard();

drop trigger if exists roster_contact_experience_files_t_guard on public.roster_contact_experience_files;
create trigger roster_contact_experience_files_t_guard
  before insert or update on public.roster_contact_experience_files
  for each row execute function public.roster_experience_guard();

-- 4. Server only.
alter table public.roster_contact_experience enable row level security;
alter table public.roster_contact_experience_files enable row level security;
revoke all on table public.roster_contact_experience from public, anon, authenticated;
revoke all on table public.roster_contact_experience_files from public, anon, authenticated;
grant select, insert, update, delete on table public.roster_contact_experience to service_role;
grant select, insert, update, delete on table public.roster_contact_experience_files to service_role;
revoke all on function public.roster_experience_guard() from public, anon, authenticated;

comment on table public.roster_contact_experience is
  'A short experience blurb on a roster person, written by an admin or lead. Context for picking a lead; never a score. Service role only.';
comment on table public.roster_contact_experience_files is
  'Resumes and experience documents on a roster person, in the private roster-experience bucket. Service role only.';

-- 5. The private bucket. 10 MB a file; PDF, Word and plain text only. No storage policy is made, so only the
-- server's own key can reach it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'roster-experience',
  'roster-experience',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do nothing;
