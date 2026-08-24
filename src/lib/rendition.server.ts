import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * A rendition is only ever the bytes we already store. If the stored content is
 * not a pdf, the honest answer is that there is no visual, never a stand in.
 */
export type Rendition = { kind: "pdf"; url: string } | { kind: "none" };

/** The bucket the item text reader already downloads from. Nothing new. */
export const RENDITION_BUCKET = "work-files";

type Db = SupabaseClient<Database>;

function isPdf(meta: Record<string, unknown>, sourceMeta: Record<string, unknown>, ref: string) {
  const mimes = [
    meta["mime_type"],
    sourceMeta["mime_type"],
    sourceMeta["export_mime"],
    sourceMeta["mime"],
  ].filter((value): value is string => typeof value === "string");
  if (mimes.includes("application/pdf")) return true;
  return ref.toLowerCase().endsWith(".pdf");
}

/**
 * Reading the row through the CALLER'S client is the access check: row level
 * security decides, and only a readable pdf ever gets a signed url.
 */
export async function resolveRendition(
  supabase: Db,
  workItemId: string,
  sign: (path: string) => Promise<string | null>,
): Promise<Rendition> {
  const { data } = await supabase
    .from("work_items")
    .select("id, content_ref, meta, source_meta")
    .eq("id", workItemId)
    .maybeSingle();
  if (!data) return { kind: "none" };

  const row = data as unknown as Record<string, unknown>;
  const ref = typeof row["content_ref"] === "string" ? (row["content_ref"] as string) : "";
  if (!ref) return { kind: "none" };
  const meta = (row["meta"] as Record<string, unknown> | null) ?? {};
  const sourceMeta = (row["source_meta"] as Record<string, unknown> | null) ?? {};
  if (!isPdf(meta, sourceMeta, ref)) return { kind: "none" };

  const url = await sign(ref);
  return url ? { kind: "pdf", url } : { kind: "none" };
}
