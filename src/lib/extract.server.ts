import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { MODELS, chatComplete, orgNameFor, type AiMeta } from "@/lib/ai.server";
import { reportAiHealth } from "@/lib/ai-health.server";
import { getItemText, ITEM_TEXT_COLUMNS, type TextItem } from "@/lib/item-text.server";
import { needsTextFetch, peekFormat } from "@/lib/peek-format";
import type { WorkItemRow } from "@/lib/work-types";

type Db = SupabaseClient<Database>;

/** Cheap tier on purpose: the sidecar runs on every capture. */
export const EXTRACT_MODEL = MODELS.fast;
export const EXTRACT_SCHEMA_VERSION = 1;
const MAX_SOURCE_CHARS = 60_000;

/** The subset of a work item the classifier and the text puller need. */
export type ClassifiableItem = TextItem;

export { ITEM_TEXT_COLUMNS };

/** True when this item's stored bytes are readable as text by the context layer. */
export function isReadableAsText(item: ClassifiableItem): boolean {
  return needsTextFetch(peekFormat(item as WorkItemRow));
}

/**
 * The single way text is pulled out of a work item: it delegates to the one
 * extraction layer, so the sidecar and the context assembler can never drift.
 */
export async function pullItemText(supabase: Db, item: ClassifiableItem): Promise<string> {
  const result = await getItemText(supabase, item);
  return result.text ?? "";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SYSTEM = `You compress one piece of somebody's work into a compact index card another model will read later. Be concrete and factual. Never invent. Never evaluate or grade the person. Return strict JSON with exactly these keys: summary, decisions, entities, handoff.
- summary: 2 to 4 sentences on what this is and what happened.
- decisions: what was decided or concluded, as short bullet lines separated by newlines. null if nothing was decided.
- entities: key names, projects, clients, tools and topics, comma separated.
- handoff: what this fed into or what came next. null if not inferable.
Keep the whole JSON under 1200 characters.`;

type ExtractFields = {
  summary: string;
  decisions: string | null;
  entities: string | null;
  handoff: string | null;
};

function clamp(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export const EXTRACT_SYSTEM_PROMPT = SYSTEM;

export function parseExtractJson(raw: string | null | undefined): ExtractFields | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim()) as Record<
      string,
      unknown
    >;
    const summary = clamp(parsed["summary"], 700);
    if (!summary) return null;
    return {
      summary,
      decisions: clamp(parsed["decisions"], 500),
      entities: clamp(parsed["entities"], 300),
      handoff: clamp(parsed["handoff"], 300),
    };
  } catch {
    return null;
  }
}

export function extractUserPrompt(title: string, text: string): string {
  return `TITLE: ${title}\n\nCONTENT:\n${text}\n\nReturn the JSON card.`;
}

async function generate(
  title: string,
  text: string,
  meta: AiMeta,
): Promise<{ fields: ExtractFields | null; tokensIn: number; tokensOut: number; costUsd: number }> {
  try {
    const completion = await chatComplete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: extractUserPrompt(title, text) },
      ],
      {
        tier: "fast",
        maxTokens: 700,
        responseFormat: { type: "json_object" },
        meta,
      },
    );
    return {
      fields: parseExtractJson(completion.text),
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      costUsd: completion.costUsd,
    };
  } catch (e) {
    await reportAiHealth({
      errorClass: "extract_failed",
      surface: "extract",
      orgId: meta.orgId,
      orgName: meta.orgName,
      model: EXTRACT_MODEL,
      note: (e as Error).message.slice(0, 120),
    });
    return { fields: null, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  }
}

export type PreparedExtract = {
  item: { id: string; title: string; owner_id: string; org_id: string };
  text: string;
  hash: string;
  unchanged: boolean;
};

/**
 * Everything needed to write one extract, gathered once so the sync path and
 * the batch path can never disagree about what was read or what it hashes to.
 */
export async function prepareExtract(workItemId: string): Promise<PreparedExtract | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: item } = await supabaseAdmin
    .from("work_items")
    .select(`${ITEM_TEXT_COLUMNS}, owner_id, org_id`)
    .eq("id", workItemId)
    .maybeSingle();
  if (!item) return null;

  const text = (await pullItemText(supabaseAdmin as unknown as Db, item as ClassifiableItem))
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
  if (!text) {
    await reportAiHealth({
      errorClass: "extract_empty",
      surface: "extract",
      orgId: item.org_id,
      orgName: await orgNameFor(supabaseAdmin as unknown as Db, item.org_id),
      note: "no readable text",
    });
    return null;
  }

  const hash = await sha256Hex(text);
  const { data: existing } = await supabaseAdmin
    .from("work_item_extracts")
    .select("content_hash")
    .eq("work_item_id", workItemId)
    .maybeSingle();

  return {
    item: {
      id: workItemId,
      title: item.title,
      owner_id: item.owner_id,
      org_id: item.org_id,
    },
    text,
    hash,
    unchanged: existing?.content_hash === hash,
  };
}

/** The single writer for work_item_extracts. */
export async function writeExtract(
  prepared: PreparedExtract,
  fields: ExtractFields,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("work_item_extracts").upsert(
    {
      work_item_id: prepared.item.id,
      owner_id: prepared.item.owner_id,
      org_id: prepared.item.org_id,
      summary: fields.summary,
      decisions: fields.decisions,
      entities: fields.entities,
      handoff: fields.handoff,
      source_chars: prepared.text.length,
      model: EXTRACT_MODEL,
      content_hash: prepared.hash,
      schema_version: EXTRACT_SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "work_item_id" },
  );
  if (error) {
    console.error("[extract] upsert failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Idempotent sidecar. Regenerates only when the source text changed. Never
 * throws into the caller: a capture must succeed with or without its extract.
 */
export async function ensureExtract(workItemId: string): Promise<boolean> {
  try {
    const prepared = await prepareExtract(workItemId);
    if (!prepared) return false;
    if (prepared.unchanged) return true;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta: AiMeta = {
      surface: "extract",
      orgId: prepared.item.org_id,
      orgName: await orgNameFor(supabaseAdmin as unknown as Db, prepared.item.org_id),
    };
    const { fields, tokensIn, costUsd } = await generate(
      prepared.item.title,
      prepared.text,
      meta,
    );
    if (!fields) return false;

    const { usageDims } = await import("./ai-usage");
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabaseAdmin as unknown as Db, {
      eventType: "extract.generated",
      orgId: prepared.item.org_id,
      userId: null,
      dims: { ...usageDims({ tokensIn, costUsd }), mode: "sync" },
    });

    return await writeExtract(prepared, fields);
  } catch (e) {
    console.error("[extract] ensureExtract failed:", (e as Error).message);
    return false;
  }
}

/**
 * Fire-and-forget from capture paths: awaited, but never allowed to fail them.
 * A single item is done inline so the person sees it straight away. A bulk
 * capture goes through the Batch API at half price, and anything the batch
 * refuses falls back to the inline path.
 */
export async function ensureExtracts(ids: string[]): Promise<void> {
  if (ids.length <= 1) {
    for (const id of ids) await ensureExtract(id);
    return;
  }
  try {
    const { submitExtractBatch } = await import("./extract-batch.server");
    const leftovers = await submitExtractBatch(ids);
    for (const id of leftovers) await ensureExtract(id);
  } catch (e) {
    console.error("[extract] batch submit failed, running inline:", (e as Error).message);
    for (const id of ids) await ensureExtract(id);
  }
}
