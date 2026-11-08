-- PINS-1 (8 Nov 2026): a pinned answer remembers its chat, in the database.
--
-- Until now the link from an answer card to the chat it came from lived only in
-- one browser's localStorage (lasso.ask-draft.pins), so it was lost on another
-- device and invisible to the board. This adds the link as a column.
--
-- Rule (Liam, 7 Nov): the card is visible to everyone on the board (existing
-- workboard_nodes RLS); the chat behind it opens only for its owner. That second
-- half is already enforced: chat_sessions and chat_messages RLS is owner-only.
-- A teammate who sees chat_session_id still reads nothing.
--
-- The guard keeps the link honest: only an answer card can carry it, and only
-- when the chat belongs to the card's author, so "Pinned from {author}'s chat"
-- is always true. Answer cards are already editable by their author only.
--
-- Additive: nullable column, no backfill (old pins live in browsers this cannot
-- reach; the app writes the column the next time a pin is touched).

alter table public.workboard_nodes
  add column if not exists chat_session_id uuid null
  references public.chat_sessions(id) on delete set null;

create index if not exists workboard_nodes_chat_session_id_idx
  on public.workboard_nodes (chat_session_id)
  where chat_session_id is not null;

comment on column public.workboard_nodes.chat_session_id is
  'PINS-1: the chat a kept answer came from. Visible to the board; the chat itself opens only for its owner (chat_sessions RLS). Guarded: answer cards only, and only the author''s own chat.';

create or replace function public.workboard_nodes_chat_link_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.chat_session_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.chat_session_id is not distinct from old.chat_session_id then
    return new;
  end if;
  if new.kind <> 'answer' then
    raise exception 'only an answer card can link to a chat' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.chat_sessions s
     where s.id = new.chat_session_id and s.profile_id = new.author_profile_id
  ) then
    raise exception 'an answer card can only link to its author''s own chat' using errcode = '42501';
  end if;
  return new;
end $function$;

-- Trigger functions are not callable through the API; keep it that way explicitly.
revoke execute on function public.workboard_nodes_chat_link_guard() from public, anon, authenticated;

drop trigger if exists workboard_nodes_chat_link_guard_trg on public.workboard_nodes;
create trigger workboard_nodes_chat_link_guard_trg
  before insert or update of chat_session_id, author_profile_id, kind on public.workboard_nodes
  for each row execute function public.workboard_nodes_chat_link_guard();

-- Check after paste (expect: 1 row for the column, 1 for the trigger):
-- select column_name from information_schema.columns where table_name='workboard_nodes' and column_name='chat_session_id';
-- select tgname from pg_trigger where tgname='workboard_nodes_chat_link_guard_trg';
