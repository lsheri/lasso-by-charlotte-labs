/**
 * Span level provenance: the shared, browser safe half. Sectioning, snippet
 * anchoring and the reuse key all live here so the pane a person reads and the
 * server that validates a claim agree on what a span actually is.
 */

export type SpanUnit = "slide" | "section" | "paragraph";
export type SpanStatus = "exact" | "paraphrase" | "unsourced";
export type SpanVerification = "found" | "none_in_record";

export type SpanLocator = {
  unit: SpanUnit;
  index: number;
  /** The selected text itself. Authoritative: offsets are only advisory. */
  snippet: string;
  /** Which occurrence of the snippet inside the section, 1 based. */
  occurrence: number;
  start?: number | undefined;
  end?: number | undefined;
};

/** Anything shorter than this is not a span, it is a stray click. */
export const MIN_SNIPPET_CHARS = 8;
export const MAX_SNIPPET_CHARS = 2000;

/** Whitespace and case are presentation. Wording is the promise. */
export function normalizeSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Did the model quote something that is actually there? Verbatim, allowing only
 * for the whitespace a reader would never notice.
 */
export function containsVerbatim(haystack: string, needle: string): boolean {
  const n = normalizeSnippet(needle);
  if (n.length < MIN_SNIPPET_CHARS) return false;
  return normalizeSnippet(haystack).includes(n);
}

export type AnchorSection = {
  unit: "slide" | "section";
  /** Slide number when the extraction genuinely knows it, else 1 based order. */
  index: number;
  label: string;
  text: string;
};

const SLIDE_HEADING = /^##\s+Slide\s+(\d+)\s*$/gm;

/**
 * The structure the stored text actually has. Slide numbers are used ONLY when
 * the extraction carried slide boundaries; otherwise the sections are numbered
 * honestly as sections and nothing pretends to be a slide.
 */
export function sectionsFromText(text: string): AnchorSection[] {
  const body = (text ?? "").trim();
  if (!body) return [];

  SLIDE_HEADING.lastIndex = 0;
  const heads: { index: number; at: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = SLIDE_HEADING.exec(body)) !== null) {
    heads.push({ index: Number(match[1]), at: match.index, end: match.index + match[0].length });
  }
  if (heads.length > 0) {
    return heads
      .map((head, i) => {
        const next = heads[i + 1]?.at ?? body.length;
        return {
          unit: "slide" as const,
          index: head.index,
          label: `Slide ${head.index}`,
          text: body.slice(head.end, next).trim(),
        };
      })
      .filter((section) => section.text.length > 0);
  }

  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part, i) => ({
      unit: "section" as const,
      index: i + 1,
      label: `Section ${i + 1}`,
      text: part,
    }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Re anchoring: find the nth occurrence of a snippet inside a section, tolerant
 * of the whitespace a re extraction may have changed. Returns -1 when the text
 * no longer contains it, which is how a stitch lands in "Previously asked"
 * rather than being guessed into the wrong place.
 */
export function findSnippetOffset(
  sectionText: string,
  snippet: string,
  occurrence = 1,
): { start: number; end: number } | null {
  const trimmed = (snippet ?? "").trim();
  if (trimmed.length === 0) return null;
  const pattern = trimmed
    .split(/\s+/)
    .map((token) => escapeRegExp(token))
    .join("\\s+");
  const rx = new RegExp(pattern, "gi");
  let seen = 0;
  let found: RegExpExecArray | null;
  while ((found = rx.exec(sectionText)) !== null) {
    seen += 1;
    if (seen === Math.max(1, occurrence)) {
      return { start: found.index, end: found.index + found[0].length };
    }
    if (found.index === rx.lastIndex) rx.lastIndex += 1;
  }
  return null;
}

/** How many times the snippet appears in this text, whitespace tolerant. */
export function countOccurrences(text: string, snippet: string): number {
  const trimmed = (snippet ?? "").trim();
  if (trimmed.length === 0) return 0;
  const pattern = trimmed
    .split(/\s+/)
    .map((token) => escapeRegExp(token))
    .join("\\s+");
  const rx = new RegExp(pattern, "gi");
  let count = 0;
  let found: RegExpExecArray | null;
  while ((found = rx.exec(text)) !== null) {
    count += 1;
    if (found.index === rx.lastIndex) rx.lastIndex += 1;
  }
  return count;
}

/** The label a person reads on a stitch. Never a score, never a count. */
export function spanStatusLabel(status: SpanStatus): string {
  if (status === "exact") return "Exact match";
  if (status === "paraphrase") return "Paraphrase";
  return "No source in the record";
}

export function spanVerificationLine(
  verification: SpanVerification,
  note: string | null | undefined,
): string {
  return verification === "found" && note
    ? `Verified against ${note}`
    : "No verification shown in the record after this";
}

/** Hash of the normalized snippet, so the reuse key is about wording, not layout. */
export async function snippetHash(snippet: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeSnippet(snippet));
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * One question about one span over one set of upstream work is one run. The
 * snippet hash and the sorted upstream ids are both part of what makes it that
 * run and not another.
 */
export function spanIdempotencyKey(input: {
  anchorId: string;
  unit: SpanUnit;
  index: number;
  snippetHash: string;
  upstreamIds: readonly string[];
}): string {
  const upstream = [...input.upstreamIds].sort().join(",");
  return `span_provenance:${input.anchorId}:${input.unit}:${input.index}:${input.snippetHash}:with:${upstream}`;
}
