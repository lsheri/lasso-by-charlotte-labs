import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkArtifact } from "@/lib/work-artifact-shared";

export type WorkArtifactResult = {
  runId: string;
  createdAt: string;
  artifact: WorkArtifact;
} | null;

/** The stored artifact, if there is one, under the reader's own access. */
export const getWorkArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { anchor_id: string }) => {
    if (!input?.anchor_id) throw new Error("anchor_id is required");
    return { anchor_id: input.anchor_id };
  })
  .handler(async ({ data, context }): Promise<WorkArtifactResult> => {
    const { readWorkArtifact } = await import("./work-artifact.server");
    return await readWorkArtifact(context.supabase, data.anchor_id);
  });

/** Build or rebuild the artifact. Owner of the deliverable only. */
export const runWorkArtifactRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { anchor_id: string }) => {
    if (!input?.anchor_id) throw new Error("anchor_id is required");
    return { anchor_id: input.anchor_id };
  })
  .handler(async ({ data, context }): Promise<WorkArtifactResult> => {
    const { runWorkArtifact } = await import("./work-artifact.server");
    return await runWorkArtifact(context.supabase, context.userId, {
      anchorId: data.anchor_id,
    });
  });
