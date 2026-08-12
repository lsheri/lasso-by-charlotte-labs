import type { Database } from "@/integrations/supabase/types";

export type AiReadSurface = Database["public"]["Tables"]["ai_reads"]["Row"]["surface"];
export type AiReadDepth = "extract" | "full" | "catalogue" | "unreadable";
export type AiReadRole = "owner" | "coach";

export type AiReadInput = {
  workItemId: string;
  ownerId: string;
  depth: AiReadDepth;
};

/**
 * One row per item the model actually received. Written with the service role
 * (clients may only read), batched, and never allowed to fail the answer.
 */
export async function recordAiReads(
  reads: AiReadInput[],
  ctx: {
    surface: string;
    readerRole: AiReadRole;
    readerProfileId: string | null;
    messageId?: number | null;
  },
): Promise<void> {
  if (reads.length === 0) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_reads").insert(
      reads.map((read) => ({
        work_item_id: read.workItemId,
        owner_id: read.ownerId,
        reader_profile_id: ctx.readerProfileId,
        reader_role: ctx.readerRole,
        surface: ctx.surface,
        depth: read.depth,
        message_id: ctx.messageId ?? null,
      })),
    );
    if (error) console.error("[ai_reads] insert failed:", error.message);
  } catch (e) {
    console.error("[ai_reads] insert threw:", (e as Error).message);
  }
}
