CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS turns_content_trgm_idx ON public.turns USING gin (content gin_trgm_ops);