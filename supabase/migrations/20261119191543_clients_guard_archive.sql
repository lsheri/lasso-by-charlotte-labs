-- Firm brain follow-up (19 Nov, Liam D-30): a folder can be archived or restored only by a signed-in person with an
-- active, non-guest profile in the folder's workspace. Before this, archive_container and unarchive_container let a
-- guest profile do it. Additive: one function and one trigger; no policy, column or row is changed. Calls with no
-- signed-in user (the service key, seeding) pass, as before.
create or replace function public.clients_guard_archive()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and auth.uid() is not null
     and not public.is_org_insider(old.org_id) then
    raise exception 'only a member of the workspace can archive or restore a folder';
  end if;
  return new;
end;
$$;

create trigger clients_t_guard_archive
  before update of archived_at on public.clients
  for each row execute function public.clients_guard_archive();
