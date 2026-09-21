CREATE TABLE public.board_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  author_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.board_documents IS 'A workstream note written and read by people. Never a source: it is not a work item, so lineage, context assembly and search cannot reach it.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_documents TO authenticated;
GRANT ALL ON public.board_documents TO service_role;

ALTER TABLE public.board_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_documents_select ON public.board_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = board_documents.task_id AND public.is_engagement_member(t.engagement_id)
  ));

CREATE POLICY board_documents_insert ON public.board_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = board_documents.task_id AND public.is_engagement_editor(t.engagement_id)
    )
    AND author_profile_id IN (SELECT public.my_profile_ids())
  );

CREATE POLICY board_documents_update ON public.board_documents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = board_documents.task_id AND public.is_engagement_editor(t.engagement_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = board_documents.task_id AND public.is_engagement_editor(t.engagement_id)
  ));
