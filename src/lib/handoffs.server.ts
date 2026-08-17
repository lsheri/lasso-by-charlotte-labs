import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  HANDOFF_KINDS,
  NO_HANDOFF_PRESETS,
  type HandoffBlock,
  type HandoffFields,
  type HandoffItem,
  type HandoffKind,
} from "@/lib/handoffs-shared";

type Db = SupabaseClient<Database>;

/**
 * Handoff persistence. analysis_runs keeps SELECT only client policies, so
 * every write here goes through the service role client behind an explicit
 * owner check. There is no client write path to this column and there must
 * never be one.
 */

function mintItems(fields: HandoffFields[]): HandoffItem[] {
  return fields.map((f) => ({ id: crypto.randomUUID(), state: "draft" as const, fields: f }));
}

/** Store a freshly parsed block. Never throws: the answer outranks the drafts. */
export async function writeHandoffs(
  runId: string,
  presetId: string,
  kind: HandoffKind,
  fields: HandoffFields[],
): Promise<void> {
  try {
    // Second gate on the person-shaped rule. Even if a future edit gave one of
    // these presets a schema by mistake, nothing about a person flows anywhere.
    if ((NO_HANDOFF_PRESETS as readonly string[]).includes(presetId)) {
      const { logHealth } = await import("./health.server");
      void logHealth({
        kind: "anomaly",
        surface: "analysis",
        detail: "handoff_tail_on_person_shaped_preset",
        meta: { preset: presetId, kind },
      });
      return;
    }
    if (fields.length === 0) return;
    const block: HandoffBlock = { v: 1, kind, items: mintItems(fields) };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("analysis_runs")
      .update({ handoffs: block as unknown as never })
      .eq("id", runId);
    if (error) console.error("[handoffs] write failed:", error.message);
  } catch (e) {
    console.error("[handoffs] write threw:", (e as Error).message);
  }
}

export type OwnedRun = {
  id: string;
  preset: string;
  owner_id: string;
  org_id: string;
  scope_id: string | null;
  scope_type: string;
  session_id: string | null;
  block: HandoffBlock | null;
};

function parseBlock(raw: unknown): HandoffBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { v?: unknown; kind?: unknown; items?: unknown };
  if (row.v !== 1) return null;
  if (!(HANDOFF_KINDS as readonly unknown[]).includes(row.kind)) return null;
  if (!Array.isArray(row.items)) return null;
  return row as unknown as HandoffBlock;
}

/**
 * The run, only when this profile owns it. Coaches never reach this path: the
 * drafts belong to the person whose work was analysed, nobody else.
 */
export async function ownedRun(runId: string, profileId: string): Promise<OwnedRun | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("analysis_runs")
    .select("id, preset, owner_id, org_id, scope_id, scope_type, session_id, handoffs")
    .eq("id", runId)
    .maybeSingle();
  if (!data || data.owner_id !== profileId) return null;
  return { ...data, block: parseBlock(data.handoffs) };
}

async function saveBlock(runId: string, block: HandoffBlock): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("analysis_runs")
    .update({ handoffs: block as unknown as never })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function stampItem(
  runId: string,
  block: HandoffBlock,
  itemId: string,
  state: "confirmed" | "discarded",
): Promise<void> {
  const stamped: HandoffBlock = {
    ...block,
    items: block.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            state,
            ...(state === "confirmed"
              ? { confirmed_at: new Date().toISOString() }
              : { discarded_at: new Date().toISOString() }),
          }
        : item,
    ),
  };
  await saveBlock(runId, stamped);
}

/** The one line a confirmed open check reads as on the 1:1 prep page. */
export function openCheckNote(fields: {
  claim_quote: string;
  location: string;
  verdict: string;
  suggested_check: string;
}): string {
  const verdict =
    fields.verdict === "contradicted"
      ? "This claim conflicts with another part of the work or the record."
      : "This claim shows no visible verification in the record.";
  return [`"${fields.claim_quote}"`, fields.location, verdict, `Check: ${fields.suggested_check}`]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * A confirmed open check becomes a talking point the person owns. Dedupe is by
 * exact content, so a re-run of the same analysis cannot stack duplicates.
 */
export async function sendOpenCheckToOneOnOne(
  supabase: Db,
  input: { orgId: string; profileId: string; sessionId: string | null; content: string },
): Promise<{ duplicate: boolean }> {
  const { data: existing } = await supabase
    .from("one_on_one_notes")
    .select("id")
    .eq("owner_id", input.profileId)
    .eq("content", input.content)
    .limit(1)
    .maybeSingle();
  if (existing) return { duplicate: true };
  const { error } = await supabase.from("one_on_one_notes").insert({
    org_id: input.orgId,
    owner_id: input.profileId,
    source_session_id: input.sessionId,
    kind: "analysis_finding",
    content: input.content,
    talking_point: null,
  });
  if (error) throw new Error(error.message);
  return { duplicate: false };
}
