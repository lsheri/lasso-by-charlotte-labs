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

/** Internal ranking only. Never shown as a number to anybody. */
export type HitTier = "exact" | "words" | "similar";

export type RecordTurnHit = {
  work_item_id: string;
  title: string;
  vendor: string | null;
  turn_no: number;
  role: string;
  excerpt: string;
  tier: HitTier;
};

/**
 * A conversation found by what Lasso wrote about it, not by anything said in
 * it. No excerpt travels with these: a summary is never shown as a quote.
 */
export type RecordConversationHit = {
  work_item_id: string;
  title: string;
  vendor: string | null;
  date: string | null;
};

export type RecordSearchResult = {
  turns: RecordTurnHit[];
  conversations: RecordConversationHit[];
  deliverables: { work_item_id: string; title: string; type: string }[];
};


const NUMBER_QUERY = /^[\s$£€]*\d[\d\s.,]*\s*[kKmM]?[\s%]*$/;
const EXCERPT_CHARS = 160;
const MAX_TURN_HITS = 50;
const MAX_ABOUT_HITS = 15;
const SIMILAR_FLOOR = 0.3;

/**
 * One written form for a number, whatever surface it wore. "$4,200", "4200"
 * and "4.2k" all land on "4200". Nothing fuzzy happens here.
 */
export function canonicalizeNumber(raw: string): string | null {
  const cleaned = raw.trim().replace(/[$£€%\s]/g, "");
  const match = /^(\d[\d,]*(?:\.\d+)?)([kKmM]?)$/.exec(cleaned);
  if (!match) return null;
  const digits = (match[1] ?? "").replace(/,/g, "");
  if (!digits) return null;
  const suffix = (match[2] ?? "").toLowerCase();
  let value = Number(digits);
  if (!Number.isFinite(value)) return null;
  if (suffix === "k") value *= 1_000;
  if (suffix === "m") value *= 1_000_000;
  const text = value.toString();
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

/** Surface forms worth asking the database for, so the index can be used. */
export function surfaceFormsFor(canonical: string): string[] {
  const forms = new Set<string>([canonical]);
  const value = Number(canonical);
  if (Number.isFinite(value)) {
    forms.add(value.toLocaleString("en-US"));
    if (value >= 1_000 && value % 100 === 0) {
      const k = value / 1_000;
      forms.add(`${Number(k.toFixed(2))}k`);
    }
    if (value >= 1_000_000) {
      const m = value / 1_000_000;
      forms.add(`${Number(m.toFixed(2))}m`);
    }
  }
  return [...forms];
}

const NUMBER_TOKEN = /[$£€]?\d[\d,.]*\s?[kKmM]?/g;

/** True only when the text really carries that number, in some written form. */
export function contentHasNumber(content: string, canonical: string): boolean {
  for (const token of content.match(NUMBER_TOKEN) ?? []) {
    if (canonicalizeNumber(token) === canonical) return true;
  }
  return false;
}

export function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

export function allWordsPresent(content: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const haystack = content.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function trigramsOf(value: string): Set<string> {
  const padded = `  ${value.toLowerCase().trim().replace(/\s+/g, " ")} `;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) grams.add(padded.slice(i, i + 3));
  return grams;
}

/** The same shape of comparison the database index uses, for ordering only. */
export function trigramSimilarity(a: string, b: string): number {
  const left = trigramsOf(a);
  const right = trigramsOf(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * A typo breaks at most one part of a word, so each long word offers three
 * short probes taken from its start, middle and end. One of them survives the
 * mistake, and the trigram index makes these cheap to look up.
 */
export function trigramProbes(query: string): string[] {
  const probes = new Set<string>();
  for (const word of queryWords(query)) {
    if (word.length < 5) continue;
    const middle = Math.max(0, Math.floor((word.length - 4) / 2));
    for (const start of [0, middle, word.length - 4]) {
      const probe = word.slice(start, start + 4);
      if (probe.length === 4) probes.add(probe);
    }
  }
  return [...probes];
}

/** The closest any one word in the text comes to any one word of the query. */
export function bestWordSimilarity(content: string, query: string): number {
  const asked = queryWords(query);
  if (asked.length === 0) return 0;
  const said = content.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
  let best = 0;
  for (const word of said) {
    for (const target of asked) {
      const score = trigramSimilarity(word, target);
      if (score > best) best = score;
    }
  }
  return best;
}

const TIER_ORDER: Record<HitTier, number> = { exact: 0, words: 1, similar: 2 };

export function rankThreadHits<T extends { tier: HitTier }>(hits: T[]): T[] {
  return [...hits].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

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
      .select("id, title, type, source_vendor, work_date, captured_at")
      .eq("owner_id", profile.id);
    const items = mine ?? [];
    if (items.length === 0) return { turns: [], conversations: [], deliverables: [] };

    const byId = new Map(items.map((item) => [item.id, item]));
    const itemIds = items.map((item) => item.id);

    const canonical = data.mode === "number" ? canonicalizeNumber(data.query) : null;
    const words = data.mode === "thread" ? queryWords(data.query) : [];

    type TurnRow = { work_item_id: string; turn_no: number; role: string; content: string };
    const seen = new Set<string>();
    const collected: { row: TurnRow; tier: HitTier; needle: string }[] = [];

    const take = (rows: TurnRow[] | null, tier: HitTier, needle: string) => {
      for (const row of rows ?? []) {
        const key = `${row.work_item_id}-${row.turn_no}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push({ row, tier, needle });
      }
    };

    const turnsLike = async (pattern: string, limit: number) => {
      const { data: rows } = await supabase
        .from("turns")
        .select("work_item_id, turn_no, role, content")
        .in("work_item_id", itemIds)
        .ilike("content", `%${likeEscape(pattern)}%`)
        .order("turn_no", { ascending: true })
        .limit(limit);
      return (rows ?? []) as TurnRow[];
    };

    /** One lookup, several short probes, so a misspelling still pulls rows back. */
    const turnsProbed = async (probes: string[], limit: number) => {
      if (probes.length === 0) return [] as TurnRow[];
      const { data: rows } = await supabase
        .from("turns")
        .select("work_item_id, turn_no, role, content")
        .in("work_item_id", itemIds)
        .or(probes.map((probe) => `content.ilike.%${likeEscape(probe)}%`).join(","))
        .order("turn_no", { ascending: true })
        .limit(limit);
      return (rows ?? []) as TurnRow[];
    };

    if (data.mode === "number" && canonical) {
      // Ask for every surface form, then confirm the number is truly there.
      for (const form of surfaceFormsFor(canonical)) {
        if (collected.length >= MAX_TURN_HITS) break;
        const rows = (await turnsLike(form, MAX_TURN_HITS)).filter((row) =>
          contentHasNumber(row.content, canonical),
        );
        take(rows, "exact", form);
      }
    } else if (data.mode === "thread") {
      take(await turnsLike(data.query, MAX_TURN_HITS), "exact", data.query);

      if (collected.length < MAX_TURN_HITS && words.length > 0) {
        const longest = [...words].sort((a, b) => b.length - a.length)[0] ?? data.query;
        const wordRows = (await turnsLike(longest, 200)).filter((row) =>
          allWordsPresent(row.content, words),
        );
        take(wordRows, "words", longest);

        if (collected.length < MAX_TURN_HITS) {
          // Closest matches are worked out in the app, so they need nothing
          // special from the database. If the lookup ever fails, this tier
          // simply does not appear and the other two still answer.
          try {
            const probes = trigramProbes(data.query);
            const fallback = longest.slice(0, Math.max(3, Math.ceil(longest.length * 0.6)));
            const candidates =
              probes.length > 0 ? await turnsProbed(probes, 50) : await turnsLike(fallback, 200);
            const similarRows = candidates
              .map((row) => ({
                row,
                score: Math.max(
                  trigramSimilarity(row.content.slice(0, 400), data.query),
                  bestWordSimilarity(row.content, data.query),
                ),
              }))
              .filter((entry) => entry.score >= SIMILAR_FLOOR)
              .sort((a, b) => b.score - a.score)
              .map((entry) => entry.row);
            take(similarRows, "similar", longest);
          } catch {
            // Silent on purpose: exact and all-words results still render.
          }
        }

      }
    }

    const turns: RecordTurnHit[] = rankThreadHits(collected)
      .slice(0, MAX_TURN_HITS)
      .map(({ row, tier, needle }) => {
        const item = byId.get(row.work_item_id);
        return {
          work_item_id: row.work_item_id,
          title: item?.title ?? "A conversation",
          vendor: item?.source_vendor ?? null,
          turn_no: row.turn_no,
          role: String(row.role),
          excerpt: excerptAround(row.content, needle),
          tier,
        };
      });

    // What a conversation was about, from Lasso's own summary of it. Only
    // conversations, and only ones no turn already answered for.
    const conversations: RecordConversationHit[] = [];
    if (data.mode === "thread") {
      const alreadyShown = new Set(turns.map((hit) => hit.work_item_id));
      const threadIds = items
        .filter((item) => item.type === "ai_thread" && !alreadyShown.has(item.id))
        .map((item) => item.id);
      if (threadIds.length > 0) {
        try {
          const { data: aboutRows } = await supabase
            .from("work_item_extracts")
            .select("work_item_id")
            .eq("owner_id", profile.id)
            .in("work_item_id", threadIds)
            .textSearch("search_tsv", data.query, { type: "websearch" })
            .limit(MAX_ABOUT_HITS);
          for (const row of aboutRows ?? []) {
            const item = byId.get(row.work_item_id);
            if (!item) continue;
            conversations.push({
              work_item_id: item.id,
              title: item.title,
              vendor: item.source_vendor ?? null,
              date: item.work_date ?? item.captured_at ?? null,
            });
          }
        } catch {
          // Silent on purpose: the turn results still answer.
        }
      }
    }



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
      const confirmed = canonical
        ? contentHasNumber(text, canonical)
        : normalised.length >= MIN_SNIPPET_CHARS
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

    return { turns, conversations, deliverables };
  });

