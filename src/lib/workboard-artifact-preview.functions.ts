import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { artifactPreviewKind, wrapSvgArtifact } from "@/lib/workboard-file-preview";

const MAX_ARTIFACT_PREVIEW_BYTES = 1024 * 1024;

export const getWorkboardArtifactPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ html: string | null }> => {
    // Access check: the row is read under the caller's own session, so row
    // policies (owner, or member of an engagement the item sits on) decide
    // whether it comes back. Same pattern as getItemTextPane.
    const { data: item, error } = await context.supabase
      .from("work_items")
      .select("source_meta, content_ref")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (error || !item?.content_ref) return { html: null };

    const kind = artifactPreviewKind(item);
    if (!kind) return { html: null };

    // The file store does not grant teammates the object directly; the text
    // reader downloads with the server client after the same row check.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stored = await supabaseAdmin.storage.from("work-files").download(item.content_ref);
    if (stored.error || !stored.data || stored.data.size > MAX_ARTIFACT_PREVIEW_BYTES) return { html: null };
    try {
      const text = await stored.data.text();
      if (new TextEncoder().encode(text).byteLength > MAX_ARTIFACT_PREVIEW_BYTES) return { html: null };
      return { html: kind === "svg" ? wrapSvgArtifact(text) : text };
    } catch {
      return { html: null };
    }
  });