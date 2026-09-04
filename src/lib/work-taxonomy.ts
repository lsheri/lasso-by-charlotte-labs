/**
 * Pass 148, wave 1 of the work-per-tool dataset.
 *
 * Every value produced here belongs to a closed vocabulary or a band. No raw
 * text, no titles, no URLs, no content ever leaves these functions: a URL is
 * read only far enough to name the tool, and lengths are read only far enough
 * to name a band. Nothing here calls a model or reads what was written.
 */

import { DELIVERABLE_KINDS, deliverableKindOf, type DeliverableKind } from "./deliverable-kinds";

/** The tool a piece of work came from. Closed set, unknown is a real answer. */
export const TOOL_VENDORS = [
  "claude",
  "chatgpt",
  "gemini",
  "copilot",
  "perplexity",
  "wispr",
  "other_ai",
  "unknown",
] as const;
export type ToolVendor = (typeof TOOL_VENDORS)[number];

export const TURN_BANDS = ["1", "2-5", "6-15", "16-40", "40+"] as const;
export type TurnBand = (typeof TURN_BANDS)[number];

export const ARTIFACT_KINDS = [...DELIVERABLE_KINDS, "ai_thread", "document"] as const;
export type ArtifactKind = DeliverableKind | "ai_thread" | "document";

export const TASK_CLASSES = ["draft", "analyze", "build", "communicate", "unknown"] as const;
export type TaskClass = (typeof TASK_CLASSES)[number];

export const CAPTURE_VIAS = ["mcp_push", "extension", "upload", "manual"] as const;
export type CaptureVia = (typeof CAPTURE_VIAS)[number];

export const ROLE_ALTERNATIONS = ["balanced", "user_heavy", "assistant_heavy"] as const;
export type RoleAlternation = (typeof ROLE_ALTERNATIONS)[number];

/** Host fragments that name a tool. Matched on the hostname only. */
const HOST_VENDOR: [string, ToolVendor][] = [
  ["claude.ai", "claude"],
  ["anthropic.com", "claude"],
  ["chatgpt.com", "chatgpt"],
  ["openai.com", "chatgpt"],
  ["gemini.google.com", "gemini"],
  ["bard.google.com", "gemini"],
  ["copilot.microsoft.com", "copilot"],
  ["github.com", "copilot"],
  ["bing.com", "copilot"],
  ["perplexity.ai", "perplexity"],
];

/** Words that name a tool when they appear in a stored source or vendor field. */
const WORD_VENDOR: [string, ToolVendor][] = [
  ["claude", "claude"],
  ["anthropic", "claude"],
  ["chatgpt", "chatgpt"],
  ["openai", "chatgpt"],
  ["gpt", "chatgpt"],
  ["gemini", "gemini"],
  ["bard", "gemini"],
  ["copilot", "copilot"],
  ["perplexity", "perplexity"],
  ["wispr", "wispr"],
];

export type VendorSource = {
  /** A conversation URL. Read for its hostname only, never stored. */
  url?: string | null | undefined;
  source?: string | null | undefined;
  source_vendor?: string | null | undefined;
  source_meta?: { vendor?: string | null; url?: string | null } | null | undefined;
};

function vendorFromHost(raw: string): ToolVendor | null {
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [fragment, vendor] of HOST_VENDOR) {
    if (host === fragment || host.endsWith(`.${fragment}`)) return vendor;
  }
  return "other_ai";
}

function vendorFromWords(raw: string): ToolVendor | null {
  const value = raw.toLowerCase();
  for (const [word, vendor] of WORD_VENDOR) {
    if (value.includes(word)) return vendor;
  }
  return null;
}

/**
 * The tool behind a work item. A stored vendor speaks first, then the source
 * string, then the conversation URL's host. Anything AI-shaped we cannot name
 * is other_ai; anything else is unknown.
 */
export function vendorFromSource(input: VendorSource | string | null | undefined): ToolVendor {
  if (!input) return "unknown";
  if (typeof input === "string") {
    return (
      (input.includes("://") ? vendorFromHost(input) : null) ?? vendorFromWords(input) ?? "unknown"
    );
  }
  const candidates = [input.source_vendor, input.source_meta?.vendor, input.source];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const named = vendorFromWords(candidate);
    if (named) return named;
  }
  const url = input.url ?? input.source_meta?.url ?? null;
  if (typeof url === "string" && url.trim()) {
    const named = vendorFromHost(url.trim());
    if (named) return named;
  }
  const source = (input.source ?? "").toLowerCase();
  if (source.startsWith("mcp") || source.includes("ai")) return "other_ai";
  return "unknown";
}

/** 1 · 2-5 · 6-15 · 16-40 · 40+. Counts never leave as exact values. */
export function turnBand(count: number): TurnBand {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n <= 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 15) return "6-15";
  if (n <= 40) return "16-40";
  return "40+";
}

export type TaxonomyItem = {
  type?: string | null | undefined;
  meta?: unknown;
};

/** Work item types that map onto a deliverable kind without being asked. */
const TYPE_ARTIFACT: Record<string, ArtifactKind> = {
  ai_thread: "ai_thread",
  deck: "deck",
  sheet: "model_or_budget",
  email: "email_or_comms",
  document: "document",
  code: "code",
  image: "creative_or_design",
};

/** A chosen deliverable kind wins; the item type is the fallback. */
export function artifactKindFromItem(item: TaxonomyItem | null | undefined): ArtifactKind | "other" {
  if (!item) return "other";
  const kind = deliverableKindOf(item.meta);
  if (kind) return kind;
  const type = (item.type ?? "").toLowerCase();
  return TYPE_ARTIFACT[type] ?? "other";
}

/**
 * The coarse shape of the work, from the kind and type fields only.
 *
 *   proposal, memo_or_report, document  -> draft
 *   model_or_budget, sheet              -> analyze
 *   code, creative_or_design            -> build
 *   deck, email_or_comms                -> communicate
 *   ai_thread, other, unknown           -> unknown
 *
 * A conversation is deliberately unknown: what a person was doing in a chat is
 * not something a type field can answer, and nothing here reads content.
 */
const ARTIFACT_TASK: Record<ArtifactKind | "other", TaskClass> = {
  proposal: "draft",
  memo_or_report: "draft",
  document: "draft",
  model_or_budget: "analyze",
  code: "build",
  creative_or_design: "build",
  deck: "communicate",
  email_or_comms: "communicate",
  ai_thread: "unknown",
  other: "unknown",
};

export function taskClassForItem(item: TaxonomyItem | null | undefined): TaskClass {
  return ARTIFACT_TASK[artifactKindFromItem(item)] ?? "unknown";
}

/** Who did most of the talking, by turn count. Even-ish is balanced. */
export function roleAlternation(userTurns: number, assistantTurns: number): RoleAlternation {
  const user = Math.max(0, userTurns);
  const assistant = Math.max(0, assistantTurns);
  const total = user + assistant;
  if (total === 0) return "balanced";
  const share = user / total;
  if (share >= 0.65) return "user_heavy";
  if (share <= 0.35) return "assistant_heavy";
  return "balanced";
}

/** The shortest thing a coarse proxy can count as a nudge rather than a task. */
export const REVISION_TURN_CHARS = 200;

/**
 * A coarse proxy for a revision loop: a short user turn after position 3 that
 * follows an assistant turn. Lengths and roles only, never what was said.
 */
export function hasRevisionLoop(
  turns: readonly { role: string; length: number }[],
): boolean {
  for (let i = 1; i < turns.length; i += 1) {
    const turn = turns[i]!;
    const prior = turns[i - 1]!;
    const position = i + 1;
    if (position <= 3) continue;
    if (turn.role !== "user") continue;
    if (prior.role !== "assistant") continue;
    if (turn.length < REVISION_TURN_CHARS) return true;
  }
  return false;
}

/** The whole thread.shape payload, from counts and lengths alone. */
export function threadShapeDims(turns: readonly { role: string; length: number }[]): {
  turn_band: TurnBand;
  role_alternation: RoleAlternation;
  has_revision_loop: boolean;
} {
  const user = turns.filter((t) => t.role === "user").length;
  const assistant = turns.filter((t) => t.role === "assistant").length;
  return {
    turn_band: turnBand(turns.length),
    role_alternation: roleAlternation(user, assistant),
    has_revision_loop: hasRevisionLoop(turns),
  };
}
