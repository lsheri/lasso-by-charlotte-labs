/**
 * The kind of thing a deliverable is, in the owner's own words. A fixed
 * vocabulary stored on work_items.meta.deliverable_kind, written through the
 * ordinary item update path under the owner's own row level policies.
 */

export const DELIVERABLE_KINDS = [
  "proposal",
  "deck",
  "model_or_budget",
  "memo_or_report",
  "email_or_comms",
  "code",
  "creative_or_design",
  "other",
] as const;

export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  proposal: "Proposal",
  deck: "Deck",
  model_or_budget: "Model or budget",
  memo_or_report: "Memo or report",
  email_or_comms: "Email or comms",
  code: "Code or implementation",
  creative_or_design: "Creative or design",
  other: "Other",
};

export function deliverableKindLabel(kind: DeliverableKind): string {
  return DELIVERABLE_KIND_LABELS[kind];
}

export function deliverableKindOf(meta: unknown): DeliverableKind | null {
  const value = (meta ?? null) as { deliverable_kind?: unknown } | null;
  const kind = value?.deliverable_kind;
  if (typeof kind !== "string") return null;
  return (DELIVERABLE_KINDS as readonly string[]).includes(kind) ? (kind as DeliverableKind) : null;
}

/**
 * Pass 139: the small glyph every shipped card wears. Named shapes, not emoji,
 * so the mapping can be pinned in a test and the icon drawn in one family.
 */
export type DeliverableGlyph = "document" | "deck" | "sheet" | "envelope" | "code" | "pen";

const KIND_GLYPH: Record<DeliverableKind, DeliverableGlyph> = {
  proposal: "document",
  deck: "deck",
  model_or_budget: "sheet",
  memo_or_report: "document",
  email_or_comms: "envelope",
  code: "code",
  creative_or_design: "pen",
  other: "document",
};

const TYPE_GLYPH: Record<string, DeliverableGlyph> = {
  deck: "deck",
  sheet: "sheet",
  email: "envelope",
  document: "document",
  code: "code",
  image: "pen",
};

/** Kind wins; the work item type is the fallback; unknown is a document. */
export function deliverableGlyph(
  meta: unknown,
  type: string | null | undefined,
): DeliverableGlyph {
  const kind = deliverableKindOf(meta);
  if (kind) return KIND_GLYPH[kind];
  return TYPE_GLYPH[(type ?? "").toLowerCase()] ?? "document";
}

/** The tag word for a glyph, used when no deliverable kind was chosen. */
const GLYPH_TAG: Record<DeliverableGlyph, string> = {
  document: "Document",
  deck: "Deck",
  sheet: "Sheet",
  envelope: "Email",
  code: "Code",
  pen: "Creative",
};

/**
 * The metadata tag on a shipped card. A chosen kind speaks first; without one
 * the work item type decides (a deck is a Deck, never a memo); anything else
 * is a Document.
 */
export function deliverableTag(meta: unknown, type: string | null | undefined): string {
  const kind = deliverableKindOf(meta);
  if (kind) return deliverableKindLabel(kind);
  return GLYPH_TAG[deliverableGlyph(null, type)];
}

type SuggestInput = {
  title?: string | null | undefined;
  type?: string | null | undefined;
  /** File name or mime, when the record has one. */
  fileHint?: string | null | undefined;
  /** Brief text or brief titles, used only as extra keywords. */
  briefText?: string | null | undefined;
};

const EXTENSION_KIND: Record<string, DeliverableKind> = {
  pptx: "deck",
  ppt: "deck",
  key: "deck",
  fig: "creative_or_design",
  psd: "creative_or_design",
  ai: "creative_or_design",
  indd: "creative_or_design",
  sketch: "creative_or_design",
  xlsx: "model_or_budget",
  xls: "model_or_budget",
  csv: "model_or_budget",
  numbers: "model_or_budget",
  docx: "memo_or_report",
  doc: "memo_or_report",
  md: "memo_or_report",
  pdf: "memo_or_report",
  eml: "email_or_comms",
  msg: "email_or_comms",
  ts: "code",
  tsx: "code",
  js: "code",
  py: "code",
  sql: "code",
};

const KEYWORD_KIND: [RegExp, DeliverableKind][] = [
  [/\b(proposal|sow|statement of work|scope of work|bid|tender|pitch)\b/, "proposal"],
  [/\b(deck|slides?|presentation|readout|steerco)\b/, "deck"],
  [/\b(model|budget|forecast|pricing|cashflow|valuation|p&l|financials?)\b/, "model_or_budget"],
  [/\b(memo|report|note|analysis|findings|summary|paper)\b/, "memo_or_report"],
  [/\b(email|e-mail|comms|newsletter|announcement|letter)\b/, "email_or_comms"],
  [/\b(code|repo|script|migration|api|component)\b/, "code"],
  [
    /\b(creative|design|brand|branding|identity|logo|artwork|copy|campaign|storyboard|mockup|wireframe)\b/,
    "creative_or_design",
  ],
];

const TYPE_KIND: Record<string, DeliverableKind> = {
  deck: "deck",
  sheet: "model_or_budget",
  document: "memo_or_report",
  email: "email_or_comms",
  image: "creative_or_design",
};

/**
 * A deterministic first guess, never a model call. Extension wins, then words
 * in the title, then words carried in from the brief, then the item type.
 */
export function suggestDeliverableKind(input: SuggestInput): DeliverableKind | null {
  const file = (input.fileHint ?? "").toLowerCase();
  const title = (input.title ?? "").toLowerCase();
  const extension = /\.([a-z0-9]+)\s*$/.exec(file)?.[1] ?? /\.([a-z0-9]+)\s*$/.exec(title)?.[1];
  if (extension && EXTENSION_KIND[extension]) return EXTENSION_KIND[extension];

  for (const [pattern, kind] of KEYWORD_KIND) {
    if (pattern.test(title)) return kind;
  }
  const brief = (input.briefText ?? "").toLowerCase();
  if (brief) {
    for (const [pattern, kind] of KEYWORD_KIND) {
      if (pattern.test(brief)) return kind;
    }
  }
  const type = (input.type ?? "").toLowerCase();
  return TYPE_KIND[type] ?? null;
}
