import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { MODELS, chatComplete, orgNameFor, type AiMeta } from "@/lib/ai.server";
import {
  clientPromptLine,
  isHandLabelled,
  NO_TAGS,
  parseTagReply,
  tagAskFor,
  tagKeysAsked,
  tagPromptLines,
  validateExtractedTags,
  type ExtractedTags,
  type TagAsk,
  type TagContext,
} from "@/lib/extract-tags-shared";
import { logHealth, logHealthOncePerDay } from "@/lib/health.server";
import { getItemText, ITEM_TEXT_COLUMNS, type TextItem } from "@/lib/item-text.server";
import { needsTextFetch, peekFormat } from "@/lib/peek-format";
import type { WorkItemRow } from "@/lib/work-types";

type Db = SupabaseClient<Database>;

/** Cheap tier on purpose: the sidecar runs on every capture. */
export const EXTRACT_MODEL = MODELS.fast;
export const EXTRACT_SCHEMA_VERSION = 1;
/**
 * KEY-3: output ceiling for the card. 700 was sized for gpt-4.1-mini; Haiku
 * writes longer and hit it on 3 of 9 preview calls (6 Nov), cutting the JSON
 * mid-object so the card was lost. The prompt still asks for under 1,200
 * characters (about 350 tokens) and clamp() trims every field, so this is
 * headroom, not a bigger card. Haiku output at $0.50/MTok: 1,500 tokens is
 * under $0.001 per extract at worst.
 */
export const EXTRACT_MAX_TOKENS = 1500;
const MAX_SOURCE_CHARS = 60_000;
/** A capture request stops opening files after this, and says so. */
const BATCH_BUDGET_MS = 60_000;

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

const HEAD = `You compress one piece of somebody's work into a compact index card another model will read later. Be concrete and factual. Never invent. Never evaluate or grade the person. Return strict JSON with exactly these keys: `;
const CARD_KEYS = "summary, decisions, entities, handoff";
const CARD_LINES = `- summary: 2 to 4 sentences on what this is and what happened. At most 600 characters.
- decisions: what was decided or concluded, as at most 5 short bullet lines separated by newlines. At most 450 characters. null if nothing was decided.
- entities: key names, projects, clients, tools and topics, comma separated. At most 250 characters.
- handoff: what this fed into or what came next. At most 250 characters. null if not inferable.`;
const TAIL = `Keep the whole JSON under 1200 characters. Stop after the closing brace.`;
const SYSTEM = `${HEAD}${CARD_KEYS}.\n${CARD_LINES}\n${TAIL}`;

/**
 * The card prompt, plus one line per firm brain tag this item is asked for (Firm Brain Build Spec, step 5: the same
 * call, a few more output tokens). With no tags asked it is the card prompt exactly as it was.
 */
export function extractSystemPrompt(ask: TagAsk): string {
  const keys = tagKeysAsked(ask);
  if (!keys.length) return SYSTEM;
  return `${HEAD}${CARD_KEYS}, ${keys.join(", ")}.\n${CARD_LINES}\n${tagPromptLines(ask).join("\n")}\n${TAIL}`;
}

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

export function extractUserPrompt(title: string, text: string, brief?: string | null, client?: string | null): string {
  // The engagement's brief rides along only on the item that carries the situation, so the model reads both.
  const briefBlock = brief ? `ENGAGEMENT BRIEF:\n${brief}\n\n` : "";
  // The client's name rides along on every tagged item: without it an interview with the client's market reads
  // like one with the client's own staff. One short line, never the brief (cost).
  const clientLine = clientPromptLine(client);
  const clientBlock = clientLine ? `${clientLine}\n\n` : "";
  return `TITLE: ${title}\n\n${clientBlock}${briefBlock}CONTENT:\n${text}\n\nReturn the JSON card.`;
}

/**
 * What the tags need for one item, or null when it could not be worked out: then the call asks for the card only.
 * client is the name of the board's client, or null when the item is on no board or the board names none.
 */
export type Tagging = { context: TagContext; brief: string | null; client?: string | null };

export type ExtractGeneration = {
  fields: ExtractFields | null;
  /** The tags that survived the checks, or null when none were asked for or the card could not be read. */
  tags: ExtractedTags | null;
  ask: TagAsk;
  /** The model's reply as it came back, for the demo tag check only. Never stored. */
  reply: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/** The one model call per captured item: the index card and, when asked, the firm brain tags. */
export async function generateExtract(
  title: string,
  text: string,
  meta: AiMeta,
  tagging: Tagging | null = null,
): Promise<ExtractGeneration> {
  const ask = tagging ? tagAskFor(tagging.context, tagging.context.carrier) : NO_TAGS;
  try {
    const completion = await chatComplete(
      [
        { role: "system", content: extractSystemPrompt(ask) },
        { role: "user", content: extractUserPrompt(title, text, tagging?.brief, tagging?.client) },
      ],
      {
        tier: "fast",
        maxTokens: EXTRACT_MAX_TOKENS,
        responseFormat: { type: "json_object" },
        meta,
      },
    );
    const fields = parseExtractJson(completion.text);
    return {
      fields,
      // One reply, two readers: the card decides whether the reply counts, and the tags are checked on their own.
      tags: fields && tagging ? validateExtractedTags(parseTagReply(completion.text), tagging.context) : null,
      ask,
      reply: completion.text ?? null,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      costUsd: completion.costUsd,
    };
  } catch (e) {
    void logHealth({
      kind: "error",
      surface: "extract",
      orgId: meta.orgId,
      model: EXTRACT_MODEL,
      detail: (e as Error).message,
      meta: { reason: "extract_failed" },
    });
    return { fields: null, tags: null, ask, reply: null, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  }
}

/**
 * The tag context for one item, or null when it could not be read. Never throws: a board that will not load must not
 * cost the item its card, and an item with no context keeps whatever tags it already had.
 */
async function taggingFor(item: PreparedExtract["item"]): Promise<Tagging | null> {
  if (!item.type || isHandLabelled(item.source_meta)) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadTagContext } = await import("./extract-tags.server");
    return await loadTagContext(supabaseAdmin as unknown as Db, { ...item, type: item.type });
  } catch (e) {
    console.error("[extract] tag context failed:", (e as Error).message);
    return null;
  }
}

/** Stores the tags after the card is written. Never throws and never fails the extract. */
async function storeTags(item: PreparedExtract["item"], tags: ExtractedTags, ask: TagAsk): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { storeItemTags } = await import("./extract-tags.server");
    const stored = await storeItemTags(supabaseAdmin as unknown as Db, item, tags, ask);
    if (!stored) throw new Error("no row written");
  } catch (e) {
    console.error("[extract] tags not stored:", (e as Error).message);
    void logHealth({
      kind: "error",
      surface: "extract",
      orgId: item.org_id,
      ownerId: item.owner_id,
      detail: "extract_tags_not_stored",
      meta: { work_item_id: item.id, reason: "tags_not_stored" },
    });
  }
}

export type PreparedExtract = {
  item: {
    id: string;
    title: string;
    owner_id: string;
    org_id: string;
    /** For the firm brain tags: absent on a lean read, and then no tags are asked for. */
    type?: string | undefined;
    visibility?: string | null | undefined;
    work_date?: string | null | undefined;
    meta?: unknown;
    source_meta?: unknown;
  };
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
    .select(`${ITEM_TEXT_COLUMNS}, owner_id, org_id, visibility, work_date`)
    .eq("id", workItemId)
    .maybeSingle();
  if (!item) return null;

  const text = (await pullItemText(supabaseAdmin as unknown as Db, item as ClassifiableItem))
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
  if (!text) {
    // AUDIT-1: one row per item per day, not one per extract attempt.
    void logHealthOncePerDay(`extract:${workItemId}:no_readable_text`, {
      kind: "empty_context",
      surface: "extract",
      orgId: item.org_id,
      ownerId: item.owner_id,
      detail: "no_readable_text",
      meta: { work_item_id: workItemId, source_chars: 0, reason: "no_readable_text" },
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
      type: item.type,
      visibility: item.visibility,
      work_date: item.work_date,
      meta: item.meta,
      source_meta: item.source_meta,
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
      profileId: prepared.item.owner_id,
      orgName: await orgNameFor(supabaseAdmin as unknown as Db, prepared.item.org_id),
    };
    const tagging = await taggingFor(prepared.item);
    const { fields, tags, ask, tokensIn, costUsd } = await generateExtract(prepared.item.title, prepared.text, meta, tagging);
    if (!fields) {
      // The model answered but the card could not be read back. Say so out
      // loud: a silent false here is how a file ends up with no extract and
      // no explanation.
      await logHealth({
        kind: "error",
        surface: "extract",
        orgId: prepared.item.org_id,
        ownerId: prepared.item.owner_id,
        model: EXTRACT_MODEL,
        detail: "extract_card_unparsable",
        meta: {
          work_item_id: prepared.item.id,
          reason: "unparsable_json",
          source_chars: prepared.text.length,
        },
      });
      return false;
    }

    const { usageDims } = await import("./ai-usage");
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabaseAdmin as unknown as Db, {
      eventType: "extract.generated",
      orgId: prepared.item.org_id,
      userId: null,
      profileId: prepared.item.owner_id,
      dims: { ...usageDims({ tokensIn, costUsd }), mode: "sync" },
    });

    const written = await writeExtract(prepared, fields);
    // Tags go on only after the card is stored, so an item never has tags from a reply its card did not come from.
    if (written && tags) await storeTags(prepared.item, tags, ask);
    return written;
  } catch (e) {
    console.error("[extract] ensureExtract failed:", (e as Error).message);
    await logHealth({
      kind: "error",
      surface: "extract",
      detail: (e as Error).message,
      meta: { work_item_id: workItemId, reason: "ensure_extract_threw" },
    });
    return false;
  }
}

/**
 * Fire-and-forget from capture paths: awaited, but never allowed to fail them.
 * Every extract runs through the normal synchronous API, so work captured in
 * the morning is readable the same morning.
 */
export async function ensureExtracts(ids: string[]): Promise<void> {
  // One bad file must never take the rest of the batch with it, and the batch
  // must never outlive the request that asked for it.
  const started = Date.now();
  for (const id of ids) {
    if (Date.now() - started > BATCH_BUDGET_MS) {
      await logHealth({
        kind: "anomaly",
        surface: "extract",
        detail: "batch_budget_exhausted",
        meta: { work_item_id: id, reason: "batch_budget_exhausted" },
      });
      break;
    }
    try {
      await ensureExtract(id);
    } catch (e) {
      console.error("[extract] batch item failed:", id, (e as Error).message);
      await logHealth({
        kind: "error",
        surface: "extract",
        detail: (e as Error).message,
        meta: { work_item_id: id, reason: "batch_item_threw" },
      });
    }
  }
}
