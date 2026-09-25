/**
 * Unit 2: saved Ask Lasso answers for the public demo. What an anonymous
 * visitor may receive, and the rules that make it safe. Pure.
 */

import type { ContextManifest } from "./context-manifest";
import { parseManifest } from "./context-manifest";
import { stripTurnTags, type TurnRef } from "./turn-labels";

export type DemoPreset = {
  position: number;
  question: string;
  answer: string;
  manifest: ContextManifest | null;
  turnRefs: TurnRef[];
  generatedAt: string | null;
};

export type DemoPresetRow = {
  position: number;
  question: string;
  answer: string | null;
  context_manifest: unknown;
  turn_refs: unknown;
  generated_at: string | null;
};

export const DEMO_CHAT_LINK_NOTE = "Opens the turn inside Lasso.";

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** No web addresses and no ids in words an anonymous visitor reads. */
export function publicSafeText(text: string): string {
  return stripTurnTags(text)
    .replace(/\[([^\]]*)\]\((?:https?:|\/\/)[^)]*\)/gi, "$1")
    .replace(/<(?:https?:|\/\/)[^>]*>/gi, "")
    .replace(/(?:https?:\/\/|\/\/)[^\s)\]]+/gi, "")
    .replace(UUID, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function safeManifest(raw: unknown, workIds: ReadonlySet<string>): ContextManifest | null {
  let m: ContextManifest | null = null;
  try {
    m = parseManifest(raw);
  } catch {
    m = null;
  }
  if (!m) return null;
  return {
    engagement: m.engagement ? { id: "", name: publicSafeText(m.engagement.name) } : null,
    brief_included: m.brief_included,
    firm_checks_applied: m.firm_checks_applied,
    items: m.items.map((i) => ({
      id: workIds.has(i.id) ? i.id : "",
      title: publicSafeText(i.title),
      kind: i.kind,
      detail: publicSafeText(i.detail),
    })),
    excluded: m.excluded.map((e) => ({ title: publicSafeText(e.title), reason: publicSafeText(e.reason) })),
    assembled_at: m.assembled_at,
    ...(m.scope ? { scope: m.scope } : {}),
  };
}

function safeTurnRefs(raw: unknown, workIds: ReadonlySet<string>): TurnRef[] {
  if (!Array.isArray(raw)) return [];
  const out: TurnRef[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const ref = r as Record<string, unknown>;
    const id = typeof ref["work_item_id"] === "string" ? ref["work_item_id"] : "";
    const n = typeof ref["turn_no"] === "number" ? ref["turn_no"] : Number.NaN;
    if (!workIds.has(id) || !Number.isInteger(n) || n < 1) continue;
    const label = typeof ref["label"] === "string" ? publicSafeText(ref["label"]) : `Turn ${n}`;
    out.push({ work_item_id: id, turn_no: n, label: label || `Turn ${n}` });
  }
  return out.slice(0, 12);
}

/** Only answered rows travel; turn refs only name work already on the board. */
export function publicDemoPresets(rows: readonly DemoPresetRow[], workIds: ReadonlySet<string>): DemoPreset[] {
  return rows
    .filter((r) => typeof r.answer === "string" && r.answer.trim().length > 0)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      position: r.position,
      question: publicSafeText(r.question),
      answer: publicSafeText(r.answer!),
      manifest: safeManifest(r.context_manifest, workIds),
      turnRefs: safeTurnRefs(r.turn_refs, workIds),
      generatedAt: r.generated_at,
    }));
}

/** The preset that asks for a chat link gets the in-Lasso note. */
export function isChatLinkQuestion(question: string): boolean {
  return /\blink\b/i.test(question) && /\bchat\b/i.test(question);
}
