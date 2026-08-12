import { supabase } from "@/integrations/supabase/client";
import type { ParsedConversation } from "@/lib/import-parsers";
import { serializeConversation } from "@/lib/import-parsers";
import type { ImportVendor } from "@/lib/import-vendors";
import { VENDORS } from "@/lib/import-vendors";
import { sha256 } from "@/lib/parse-thread";

const BATCH = 15;

export type CommitResult = {
  session_id: string;
  imported: number;
  duplicates: number;
  ts_precision_mix: Record<string, number>;
};

/**
 * Writes ONLY the conversations handed to it. Unselected conversations never
 * reach this function, so they never reach the network.
 */
export async function commitImport(opts: {
  profileId: string;
  orgId: string;
  vendor: ImportVendor;
  selected: ParsedConversation[];
  onProgress?: (percent: number) => void;
}): Promise<CommitResult> {
  const { profileId, orgId, vendor, selected, onProgress } = opts;

  const existing = await supabase
    .from("work_items")
    .select("orig_conversation_id")
    .eq("owner_id", profileId)
    .eq("source_vendor", vendor);
  if (existing.error) throw new Error(existing.error.message);
  const seen = new Set(
    (existing.data ?? [])
      .map((row) => row.orig_conversation_id)
      .filter((id): id is string => Boolean(id)),
  );

  const fresh = selected.filter((c) => !seen.has(c.orig_id));
  const duplicates = selected.length - fresh.length;

  const stamps = fresh
    .flatMap((c) => [c.first_ts, c.last_ts])
    .filter((t): t is string => Boolean(t))
    .sort();

  const mix = { source: 0, capture: 0 };
  for (const conv of fresh) {
    if (conv.first_ts) mix.source += 1;
    else mix.capture += 1;
  }

  const session = await supabase
    .from("import_sessions")
    .insert({
      owner_id: profileId,
      org_id: orgId,
      vendor,
      vendor_tier: VENDORS[vendor].tier,
      range_start: stamps[0] ?? null,
      range_end: stamps[stamps.length - 1] ?? null,
      selected_count: selected.length,
      duplicate_count: duplicates,
      ts_precision_mix: mix,
    })
    .select("id")
    .maybeSingle();
  if (session.error || !session.data) {
    throw new Error(session.error?.message ?? "Could not start the import.");
  }
  const sessionId = session.data.id;
  const fidelity = vendor === "copilot" ? "summary" : "verbatim";
  let imported = 0;

  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const rows = await Promise.all(
      batch.map(async (conv) => ({
        owner_id: profileId,
        org_id: orgId,
        type: "ai_thread" as const,
        source: `import:${vendor}`,
        source_vendor: vendor,
        orig_conversation_id: conv.orig_id,
        import_session_id: sessionId,
        content_fidelity: fidelity,
        title: conv.title.slice(0, 200) || "Untitled conversation",
        visibility: "unmapped" as const,
        content_hash: await sha256(serializeConversation(conv)),
        ts_precision: (conv.first_ts ? "source" : "capture") as "source" | "capture",
        created_at_source: conv.created_at ?? conv.first_ts,
        meta: {
          orig_id: conv.orig_id,
          imported: true,
          warnings: conv.warnings,
          models: conv.models,
        },
      })),
    );

    const inserted = await supabase
      .from("work_items")
      .insert(rows)
      .select("id, orig_conversation_id");
    if (inserted.error) throw new Error(inserted.error.message);

    const byOrigId = new Map(
      (inserted.data ?? []).map((row) => [row.orig_conversation_id ?? "", row.id]),
    );

    const turnRows = (
      await Promise.all(
        batch.map(async (conv) => {
          const workItemId = byOrigId.get(conv.orig_id);
          if (!workItemId) return [];
          return Promise.all(
            conv.turns.map(async (turn) => ({
              work_item_id: workItemId,
              turn_no: turn.turn_no,
              role: turn.role,
              content: turn.content,
              content_hash: await sha256(turn.content),
              ts: turn.ts,
              ts_precision: (turn.ts ? "source" : "capture") as "source" | "capture",
            })),
          );
        }),
      )
    ).flat();

    if (turnRows.length > 0) {
      const turnsInsert = await supabase.from("turns").insert(turnRows);
      if (turnsInsert.error) throw new Error(turnsInsert.error.message);
    }

    imported += batch.length;
    onProgress?.(Math.round((Math.min(i + BATCH, fresh.length) / Math.max(fresh.length, 1)) * 100));
  }

  return { session_id: sessionId, imported, duplicates, ts_precision_mix: mix };
}
