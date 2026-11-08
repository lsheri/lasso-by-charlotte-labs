-- LIVE-1 (8 Nov 2026): a board always shows the live version.
--
-- Adds the board's own rows to Supabase Realtime so an open board hears about
-- changes saved elsewhere (another tab, device, teammate, or Lasso) and
-- re-reads itself. Realtime only delivers a row to someone whose row-level
-- security already lets them read it (member of the board's engagement).
-- No columns change. Margin notes (workboard_annotations) are deliberately
-- left out: they can be private.
--
-- Undo: alter publication supabase_realtime drop table public.workboard_nodes, public.workboard_frames, public.workboard_links;

alter publication supabase_realtime add table public.workboard_nodes, public.workboard_frames, public.workboard_links;

-- Check (expect the three tables, nothing else from workboard_*):
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
