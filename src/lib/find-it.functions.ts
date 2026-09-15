import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { MIN_SNIPPET_CHARS, containsVerbatim, normalizeSnippet } from "@/lib/span-provenance-shared";

/** Where a trace is allowed to look. Never outside the person's own record. */
export type FindScope = "engagement" | "all_mine";

export type FoundSource = {
  link_id: string;
  from_item_id: string;
  relation: string;
  status: string;
  rationale: string | null;
  /** A sentence present word for word on both sides, or nothing at all. */
  quote: { text: string; turn_no: number; role: string } | null;
};

export type FindSourcesResult = { links: FoundSource[]; considered: number };

/**
 * Evidence first: a link that carries a shared sentence outranks one that does
 * not, longest sentence first. Everything else keeps its created order.
 */
export function orderByQuote<T extends { quote: { text: string } | null }>(links: T[]): T[] {
  const withQuote = links
    .filter((l) => l.quote)
    .sort((a, b) => (b.quote?.text.length ?? 0) - (a.quote?.text.length ?? 0));
  return [...withQuote, ...links.filter((l) => !l.quote)];
}

/**
 * What fed one piece of work, with the evidence attached. The quote never
 * touches the database: work_item_links keeps no quote column, so the sentence
 * is recomputed from the turns on every read and travels in the response only.
 */
export const findSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      target_item_id: string;
      scope?: FindScope | undefined;
      profile_id?: string | undefined;
    }) => {
      if (!input?.target_item_id) throw new Error("target_item_id is required");
      return {
        target_item_id: input.target_item_id,
        scope: input.scope === "all_mine" ? ("all_mine" as const) : ("engagement" as const),
        profile_id: input.profile_id ?? null,
      };
    },
  )
  .handler(async ({ data, context }): Promise<FindSourcesResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: target } = await supabase
      .from("work_items")
      .select("id, owner_id, org_id")
      .eq("id", data.target_item_id)
      .maybeSingle();
    if (!target || target.owner_id !== profile.id) {
      throw new Error("That piece of work is not yours to trace.");
    }

    const { draftLineageFor, deliverableTextFor, sharedSentenceFor } = await import(
      "@/lib/lineage.server"
    );
    const run = await draftLineageFor(supabase, {
      deliverableId: target.id,
      ownerId: profile.id,
      orgId: target.org_id,
      runnerProfileId: profile.id,
      runnerUserId: userId,
      coachMayRun: false,
      scope: data.scope,
    });

    const { data: linkRows } = await supabase
      .from("work_item_links")
      .select("id, from_item_id, relation, status, rationale")
      .eq("to_item_id", target.id)
      .eq("owner_id", profile.id)
      .neq("status", "discarded")
      .order("created_at", { ascending: true });

    const rows = linkRows ?? [];
    const deliverableText = rows.length > 0 ? await deliverableTextFor(supabase, target.id) : "";

    const links: FoundSource[] = [];
    for (const row of rows) {
      links.push({
        link_id: row.id,
        from_item_id: row.from_item_id,
        relation: String(row.relation),
        status: String(row.status),
        rationale: row.rationale ?? null,
        quote: await sharedSentenceFor(supabase, deliverableText, row.from_item_id),
      });
    }

    return { links: orderByQuote(links), considered: Math.max(run.considered, links.length) };
  });

export type SearchMode = "number" | "thread";

export type RecordTurnHit = {
  work_item_id: string;
  title: string;
  vendor: string | null;
  turn_no: number;
  role: string;
  excerpt: string;
};

export type RecordSearchResult = {
  turns: RecordTurnHit[];
  deliverables: { work_item_id: string; title: string; type: string }[];
};

const NUMBER_QUERY = /^[\d.,%$£€]+[kKmM]?$/;
const EXCERPT_CHARS = 160;

function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function excerptAround(content: string, needle: string): string {
  const at = content.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return content.slice(0, EXCERPT_CHARS);
  const start = Math.max(0, at - Math.floor((EXCERPT_CHARS - needle.length) / 2));
  return content.slice(start, start + EXCERPT_CHARS);
}

/**
 * Looks for words that were actually said. Every deliverable result is
 * confirmed against the text itself before it is returned: a full text index
 * can stem and widen, and a number that is not really there is worse than no
 * answer at all.
 */
export const searchRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { query: string; mode: SearchMode; profile_id?: string | undefined }) => {
      const query = (input?.query ?? "").trim();
      const mode: SearchMode = input?.mode === "number" ? "number" : "thread";
      if (mode === "number" && !NUMBER_QUERY.test(query)) {
        throw new Error("That does not read as a number. Try something like 4.2M or 9%.");
      }
      if (mode === "thread" && query.length < 3) {
        throw new Error("Give it three letters or more to go on.");
      }
      return { query, mode, profile_id: input.profile_id ?? null };
    },
  )
  .handler(async ({ data, context }): Promise<RecordSearchResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: mine } = await supabase
      .from("work_items")
      .select("id, title, type, source_vendor")
      .eq("owner_id", profile.id);
    const items = mine ?? [];
    if (items.length === 0) return { turns: [], deliverables: [] };
    const byId = new Map(items.map((item) => [item.id, item]));

    const { data: turnRows } = await supabase
      .from("turns")
      .select("work_item_id, turn_no, role, content")
      .in(
        "work_item_id",
        items.map((item) => item.id),
      )
      .ilike("content", `%${likeEscape(data.query)}%`)
      .order("turn_no", { ascending: true })
      .limit(50);

    const turns: RecordTurnHit[] = (turnRows ?? []).map((row) => {
      const item = byId.get(row.work_item_id);
      return {
        work_item_id: row.work_item_id,
        title: item?.title ?? "A conversation",
        vendor: item?.source_vendor ?? null,
        turn_no: row.turn_no,
        role: String(row.role),
        excerpt: excerptAround(row.content, data.query),
      };
    });

    const { data: shortlist } = await supabase
      .from("work_item_extracts")
      .select("work_item_id")
      .eq("owner_id", profile.id)
      .textSearch("search_tsv", data.query, { type: "websearch" })
      .limit(60);

    const { pullItemText } = await import("@/lib/extract.server");
    const { ITEM_TEXT_COLUMNS } = await import("@/lib/extract.server");
    const normalised = normalizeSnippet(data.query);
    const deliverables: RecordSearchResult["deliverables"] = [];
    for (const row of shortlist ?? []) {
      if (deliverables.length >= 24) break;
      const item = byId.get(row.work_item_id);
      if (!item || item.type === "ai_thread") continue;
      const { data: full } = await supabase
        .from("work_items")
        .select(ITEM_TEXT_COLUMNS)
        .eq("id", row.work_item_id)
        .maybeSingle();
      if (!full) continue;
      const text = await pullItemText(supabase, full as never);
      // A short number would fall under the verbatim helper's floor, so it is
      // confirmed by the same normalisation instead. Still exact, never fuzzy.
      const confirmed =
        normalised.length >= MIN_SNIPPET_CHARS
          ? containsVerbatim(text, data.query)
          : normalizeSnippet(text).includes(normalised);
      if (confirmed) {
        deliverables.push({
          work_item_id: item.id,
          title: item.title,
          type: String(item.type),
        });
      }
    }

    return { turns, deliverables };
  });
