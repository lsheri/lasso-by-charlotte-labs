import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { UpstreamRecord } from "@/lib/span-provenance.server";
import {
  sectionsFromText,
  type AnchorSection,
  type SpanLocator,
} from "@/lib/span-provenance-shared";

type Db = SupabaseClient<Database>;

/** Nothing larger than this is handed to a model for one span question. */
const PER_ITEM_CHARS = 24_000;
const MAX_UPSTREAM = 24;
const MAX_TURNS = 300;

/**
 * Where a Drive import actually keeps its viewer link. Production writes it to
 * meta; older imports left it on source_meta, so both are read, meta first.
 */
export function webViewLinkOf(item: {
  meta?: Record<string, unknown> | null;
  source_meta?: Record<string, unknown> | null;
}): string | null {
  const fromMeta = item.meta?.["web_view_link"];
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  const legacy = item.source_meta?.["web_view_link"];
  return typeof legacy === "string" && legacy.length > 0 ? legacy : null;
}

export type AuditItem = {
  id: string;
  title: string;
  type: string;
  source: string;
  source_vendor: string | null;
  source_meta: Record<string, unknown> | null;
  /** The item's own meta, where Drive imports keep web_view_link. */
  meta: Record<string, unknown> | null;
  date_line: string;
  /** Extracted text for documents, numbered turns for conversations. */
  text: string | null;
  text_status: string;
  text_note: string | null;
  turns: { id: string; turn_no: number; role: string; content: string }[];
};

export const AUDIT_ITEM_COLUMNS =
  "id, title, type, source, source_vendor, source_meta, meta, content_ref, content_hash, captured_at, created_at_source, work_date, ts_precision, owner_id, org_id";

/** The engagement this deliverable is mapped into, when it is mapped at all. */
export async function engagementForItem(supabase: Db, itemId: string): Promise<string | null> {
  const { data } = await supabase
    .from("work_item_tasks")
    .select("tasks(engagement_id)")
    .eq("work_item_id", itemId)
    .limit(1);
  const row = (data ?? [])[0] as { tasks: { engagement_id: string } | null } | undefined;
  return row?.tasks?.engagement_id ?? null;
}

function numberedTurns(
  turns: { turn_no: number; role: string; content: string }[],
): string {
  return turns
    .map((turn) => `TURN ${turn.turn_no} ${turn.role.toUpperCase()}:\n${turn.content}`)
    .join("\n\n")
    .slice(0, PER_ITEM_CHARS);
}

/**
 * One item as the audit view and the model both see it: its turns when it is a
 * conversation, its extracted text when it is a document, and a date line at
 * the precision the source actually supplies.
 */
export async function loadAuditItem(supabase: Db, row: Record<string, unknown>): Promise<AuditItem> {
  const { datePrecisionLine } = await import("./reflect-context.server");
  const id = row["id"] as string;
  const dateLine = datePrecisionLine(row as never);

  const { data: turnRows } = await supabase
    .from("turns")
    .select("id, turn_no, role, content")
    .eq("work_item_id", id)
    .order("turn_no", { ascending: true })
    .limit(MAX_TURNS);
  const turns = (turnRows ?? []).map((turn) => ({
    id: turn.id,
    turn_no: turn.turn_no,
    role: String(turn.role),
    content: turn.content,
  }));

  if (turns.length > 0) {
    return {
      id,
      title: row["title"] as string,
      type: String(row["type"]),
      source: String(row["source"] ?? ""),
      source_vendor: (row["source_vendor"] as string | null) ?? null,
      source_meta: (row["source_meta"] as Record<string, unknown> | null) ?? null,
      meta: (row["meta"] as Record<string, unknown> | null) ?? null,
      date_line: dateLine,
      text: numberedTurns(turns),
      text_status: "ok",
      text_note: null,
      turns,
    };
  }

  const { getItemText } = await import("./item-text.server");
  const result = await getItemText(supabase, row as never);
  return {
    id,
    title: row["title"] as string,
    type: String(row["type"]),
    source: String(row["source"] ?? ""),
    source_vendor: (row["source_vendor"] as string | null) ?? null,
    source_meta: (row["source_meta"] as Record<string, unknown> | null) ?? null,
    meta: (row["meta"] as Record<string, unknown> | null) ?? null,
    date_line: dateLine,
    text: result.text ? result.text.slice(0, PER_ITEM_CHARS) : null,
    text_status: result.status,
    text_note: result.note ?? null,
    turns: [],
  };
}

export type SpanScope = {
  anchorTitle: string;
  anchorText: string;
  upstream: UpstreamRecord[];
};

/**
 * What a span question is allowed to read: the engagement's OTHER items, oldest
 * first, resolved through the caller's own client so sharing decides the set.
 */
export async function loadSpanScope(
  supabase: Db,
  anchorId: string,
  ownerId: string,
): Promise<SpanScope> {
  const { data: anchorRow } = await supabase
    .from("work_items")
    .select(AUDIT_ITEM_COLUMNS)
    .eq("id", anchorId)
    .maybeSingle();
  if (!anchorRow) throw new Error("That item is not available to you.");
  const anchor = await loadAuditItem(supabase, anchorRow as unknown as Record<string, unknown>);

  const items = await loadUpstreamItems(supabase, anchorId, ownerId);
  return {
    anchorTitle: anchor.title,
    anchorText: anchor.text ?? "",
    upstream: items
      .filter((item) => item.text)
      .slice(0, MAX_UPSTREAM)
      .map((item) => ({
        id: item.id,
        title: item.title,
        text: item.text as string,
        turns: item.turns.map((turn) => ({ id: turn.id, turn_no: turn.turn_no })),
      })),
  };
}

/** The engagement's other items, oldest first, each loaded for reading. */
export async function loadUpstreamItems(
  supabase: Db,
  anchorId: string,
  ownerId: string,
): Promise<AuditItem[]> {
  const engagementId = await engagementForItem(supabase, anchorId);
  if (!engagementId) return [];
  const { engagementItemIds } = await import("./analysis-scope.server");
  const ids = (await engagementItemIds(supabase, ownerId, engagementId)).filter(
    (id) => id !== anchorId,
  );
  if (ids.length === 0) return [];
  const { data } = await supabase.from("work_items").select(AUDIT_ITEM_COLUMNS).in("id", ids);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const sorted = rows.sort((a, b) => {
    const key = (row: Record<string, unknown>) =>
      String(row["work_date"] ?? row["captured_at"] ?? "").slice(0, 10);
    return key(a).localeCompare(key(b));
  });
  const loaded: AuditItem[] = [];
  for (const row of sorted.slice(0, MAX_UPSTREAM)) {
    loaded.push(await loadAuditItem(supabase, row));
  }
  return loaded;
}

/** The section a locator points at, falling back to the whole text honestly. */
export function sectionFor(anchorText: string, locator: SpanLocator): AnchorSection {
  const sections = sectionsFromText(anchorText);
  const found = sections.find((section) => section.index === locator.index) ?? sections[0] ?? null;
  return (
    found ?? {
      unit: "section",
      index: locator.index,
      label: `Section ${locator.index}`,
      text: anchorText,
    }
  );
}
