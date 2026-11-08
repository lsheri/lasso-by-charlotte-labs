-- IMG-1 (8 Nov 2026): a place for the AI description of a board image.
--
-- Until now Ask could not see images at all: board images are not captured as
-- work, and no model call carried an image. IMG-2 describes each image once when
-- it lands (visible text transcribed, charts and flows described) and stores it
-- here. IMG-3 lets Ask read it, labelled "AI description of an image, not the
-- image itself", the same honesty rule as renditions.
--
-- Visibility: the description is as visible as the image card (existing
-- workboard_nodes RLS). Writes: the server only. A person cannot edit what Ask
-- will read as an AI description; the guard refuses any change to these columns
-- unless it comes from the service role (or an operator in the SQL editor).
--
-- Additive: three nullable columns, one check on rows that are all null today.

alter table public.workboard_nodes
  add column if not exists image_text text null,
  add column if not exists image_text_status text null,
  add column if not exists image_text_at timestamptz null;

alter table public.workboard_nodes
  drop constraint if exists workboard_nodes_image_text_status_check,
  add constraint workboard_nodes_image_text_status_check
    check (image_text_status is null or image_text_status in ('ok', 'failed', 'skipped'));

alter table public.workboard_nodes
  drop constraint if exists workboard_nodes_image_text_only_images,
  add constraint workboard_nodes_image_text_only_images
    check ((image_text is null and image_text_status is null) or kind = 'image');

comment on column public.workboard_nodes.image_text is
  'IMG-1: AI description of a board image (visible text transcribed, charts and flows described). Written by the server only. Ask reads it labelled as an AI description, never as the image.';
comment on column public.workboard_nodes.image_text_status is
  'IMG-1: ok, failed or skipped (unsupported type or too large). Null means not described yet.';

-- Security invoker on purpose: current_user is the calling role, so a signed-in
-- person (authenticated) is refused and the server (service_role) is not.
create or replace function public.workboard_nodes_image_text_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.image_text is not null or new.image_text_status is not null or new.image_text_at is not null then
      raise exception 'image descriptions are written by Lasso only' using errcode = '42501';
    end if;
  elsif new.image_text is distinct from old.image_text
     or new.image_text_status is distinct from old.image_text_status
     or new.image_text_at is distinct from old.image_text_at then
    raise exception 'image descriptions are written by Lasso only' using errcode = '42501';
  end if;
  return new;
end $function$;

revoke execute on function public.workboard_nodes_image_text_guard() from public, anon, authenticated;

drop trigger if exists workboard_nodes_image_text_guard_trg on public.workboard_nodes;
create trigger workboard_nodes_image_text_guard_trg
  before insert or update on public.workboard_nodes
  for each row execute function public.workboard_nodes_image_text_guard();

-- Check after paste (expect 3 columns, 1 trigger, 2 constraints):
-- select column_name from information_schema.columns where table_name = 'workboard_nodes' and column_name like 'image_text%';
-- select tgname from pg_trigger where tgname = 'workboard_nodes_image_text_guard_trg';
-- select conname from pg_constraint where conname like 'workboard_nodes_image_text%';
