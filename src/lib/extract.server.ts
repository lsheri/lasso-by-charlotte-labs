import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getItemText, ITEM_TEXT_COLUMNS, type TextItem } from "@/lib/item-text.server";
import { needsTextFetch, peekFormat } from "@/lib/peek-format";
import type { WorkItemRow } from "@/lib/work-types";

type Db = SupabaseClient<Database>;

/** Cheap tier on purpose: the sidecar runs on every capture. */
export const EXTRACT_MODEL = "google/gemini-2.5-flash";
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

async function generate(title: string, text: string): Promise<ExtractFields | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `TITLE: ${title}\n\nCONTENT:\n${text}\n\nReturn the JSON card.` },
      ],
    }),
  });
  if (!response.ok) {
    console.error(`[extract] gateway ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return null;
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = payload.choices?.[0]?.message?.content?.trim();
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

/**
 * Idempotent sidecar. Regenerates only when the source text changed. Never
 * throws into the caller: a capture must succeed with or without its extract.
 */
export async function ensureExtract(workItemId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("work_items")
      .select(`${ITEM_TEXT_COLUMNS}, owner_id, org_id`)
      .eq("id", workItemId)
      .maybeSingle();
    if (!item) return false;

    const text = (await pullItemText(supabaseAdmin as unknown as Db, item as ClassifiableItem))
      .trim()
      .slice(0, MAX_SOURCE_CHARS);
    if (!text) return false;

    const hash = await sha256Hex(text);
    const { data: existing } = await supabaseAdmin
      .from("work_item_extracts")
      .select("id, content_hash")
      .eq("work_item_id", workItemId)
      .maybeSingle();
    if (existing?.content_hash === hash) return true;

    const fields = await generate(item.title, text);
    if (!fields) return false;

    const { error } = await supabaseAdmin.from("work_item_extracts").upsert(
      {
        work_item_id: workItemId,
        owner_id: item.owner_id,
        org_id: item.org_id,
        summary: fields.summary,
        decisions: fields.decisions,
        entities: fields.entities,
        handoff: fields.handoff,
        source_chars: text.length,
        model: EXTRACT_MODEL,
        content_hash: hash,
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
  } catch (e) {
    console.error("[extract] ensureExtract failed:", (e as Error).message);
    return false;
  }
}

/** Fire-and-forget from capture paths: awaited, but never allowed to fail them. */
export async function ensureExtracts(ids: string[]): Promise<void> {
  for (const id of ids) await ensureExtract(id);
}
