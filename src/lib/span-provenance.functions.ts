import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_SNIPPET_CHARS,
  MIN_SNIPPET_CHARS,
  type SpanLocator,
  type SpanStatus,
  type SpanVerification,
} from "@/lib/span-provenance-shared";

export type AuditPaneItem = {
  id: string;
  title: string;
  type: string;
  source: string;
  source_vendor: string | null;
  source_url: string | null;
  date_line: string;
  text: string | null;
  text_status: string;
  text_note: string | null;
  turns: { id: string; turn_no: number; role: string; content: string }[];
};

export type AuditStitch = {
  id: string;
  locator: SpanLocator;
  question: string | null;
  quote: string | null;
  status: SpanStatus;
  verification: SpanVerification;
  verification_note: string | null;
  to_item_id: string | null;
  to_item_title: string | null;
  to_item_url: string | null;
  to_turn_id: string | null;
  to_turn_no: number | null;
  asked_by: string;
  asked_by_name: string | null;
  created_at: string;
};

export type SpanAudit = {
  anchor: AuditPaneItem;
  /** True when the viewer owns the anchor: owner actions, never coach actions. */
  canEdit: boolean;
  viewerProfileId: string | null;
  upstream: AuditPaneItem[];
  stitches: AuditStitch[];
  /** Document level links already confirmed or proposed, read only here. */
  baseline: { id: string; title: string }[];
};

function validLocator(raw: unknown): SpanLocator {
  const input = (raw ?? {}) as Record<string, unknown>;
  const unit = input["unit"];
  if (unit !== "slide" && unit !== "section" && unit !== "paragraph") {
    throw new Error("That selection could not be placed.");
  }
  const snippet = typeof input["snippet"] === "string" ? input["snippet"].trim() : "";
  if (snippet.length < MIN_SNIPPET_CHARS) throw new Error("Select a little more text to ask about.");
  const index = Number(input["index"]);
  const occurrence = Number(input["occurrence"] ?? 1);
  return {
    unit,
    index: Number.isFinite(index) ? index : 1,
    snippet: snippet.slice(0, MAX_SNIPPET_CHARS),
    occurrence: Number.isFinite(occurrence) && occurrence > 0 ? occurrence : 1,
    ...(Number.isFinite(Number(input["start"])) ? { start: Number(input["start"]) } : {}),
    ...(Number.isFinite(Number(input["end"])) ? { end: Number(input["end"]) } : {}),
  };
}

/**
 * Everything the provenance audit view reads in one trip: the deliverable's own
 * text, the engagement's other work oldest first, the span links already asked,
 * and the document level links that exist today.
 */
export const getSpanAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id };
  })
  .handler(async ({ data, context }): Promise<SpanAudit> => {
    const supabase = context.supabase;
    const { AUDIT_ITEM_COLUMNS, loadAuditItem, loadUpstreamItems } = await import(
      "./span-audit.server"
    );
    const { data: anchorRow } = await supabase
      .from("work_items")
      .select(AUDIT_ITEM_COLUMNS)
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (!anchorRow) throw new Error("That item is not available to you.");
    const row = anchorRow as unknown as Record<string, unknown>;
    const ownerId = row["owner_id"] as string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    const anchor = await loadAuditItem(supabase, row);
    const upstream = await loadUpstreamItems(supabase, data.work_item_id, ownerId);

    const { data: linkRows } = await supabase
      .from("span_links")
      .select(
        "id, locator, question, quote, status, verification, verification_note, to_item_id, to_turn_id, asked_by, created_at",
      )
      .eq("from_item_id", data.work_item_id)
      .order("created_at", { ascending: true });

    const turnById = new Map(
      upstream.flatMap((item) => item.turns.map((turn) => [turn.id, turn.turn_no] as const)),
    );
    const titleById = new Map(upstream.map((item) => [item.id, item.title] as const));
    const urlById = new Map(
      upstream.map(
        (item) =>
          [item.id, (item.source_meta?.["url"] as string | undefined) ?? null] as const,
      ),
    );

    const askerIds = Array.from(new Set((linkRows ?? []).map((link) => link.asked_by)));
    const { data: askers } = askerIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", askerIds)
      : { data: [] as { id: string; display_name: string }[] };
    const askerName = new Map((askers ?? []).map((a) => [a.id, a.display_name] as const));

    const { data: baselineRows } = await supabase
      .from("work_item_links")
      .select("from_item_id, status")
      .eq("to_item_id", data.work_item_id);
    const baselineIds = (baselineRows ?? [])
      .filter((link) => link.status !== "discarded")
      .map((link) => link.from_item_id);
    const baseline = baselineIds
      .map((id) => ({ id, title: titleById.get(id) ?? "" }))
      .filter((entry) => entry.title.length > 0);

    const pane = (item: (typeof upstream)[number]): AuditPaneItem => ({
      id: item.id,
      title: item.title,
      type: item.type,
      source: item.source,
      source_vendor: item.source_vendor,
      source_url: (item.source_meta?.["url"] as string | undefined) ?? null,
      date_line: item.date_line,
      text: item.text,
      text_status: item.text_status,
      text_note: item.text_note,
      turns: item.turns,
    });

    return {
      anchor: pane(anchor),
      canEdit: Boolean(profile && profile.id === ownerId),
      viewerProfileId: profile?.id ?? null,
      upstream: upstream.map(pane),
      stitches: (linkRows ?? []).map((link) => ({
        id: link.id,
        locator: link.locator as unknown as SpanLocator,
        question: link.question,
        quote: link.quote,
        status: link.status as SpanStatus,
        verification: link.verification as SpanVerification,
        verification_note: link.verification_note,
        to_item_id: link.to_item_id,
        to_item_title: link.to_item_id ? (titleById.get(link.to_item_id) ?? null) : null,
        to_item_url: link.to_item_id ? (urlById.get(link.to_item_id) ?? null) : null,
        to_turn_id: link.to_turn_id,
        to_turn_no: link.to_turn_id ? (turnById.get(link.to_turn_id) ?? null) : null,
        asked_by: link.asked_by,
        asked_by_name: askerName.get(link.asked_by) ?? null,
        created_at: link.created_at,
      })),
      baseline,
    };
  });

/**
 * "Where did this come from?" One span, one question, one validated answer,
 * written through the single server side write path.
 */
export const askSpanProvenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; locator: unknown; question?: string }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return {
      work_item_id: input.work_item_id,
      locator: validLocator(input.locator),
      question: typeof input.question === "string" ? input.question.slice(0, 300) : "",
    };
  })
  .handler(async ({ data, context }) => {
    const { runSpanProvenance } = await import("./span-provenance.server");
    return runSpanProvenance(context.supabase, context.userId, {
      workItemId: data.work_item_id,
      locator: data.locator,
      question: data.question,
    });
  });
