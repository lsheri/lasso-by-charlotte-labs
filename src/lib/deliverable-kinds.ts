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
  "other",
] as const;

export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  proposal: "Proposal",
  deck: "Deck",
  model_or_budget: "Model or budget",
  memo_or_report: "Memo or report",
  email_or_comms: "Email or comms",
  code: "Code",
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
];

const TYPE_KIND: Record<string, DeliverableKind> = {
  deck: "deck",
  sheet: "model_or_budget",
  document: "memo_or_report",
  email: "email_or_comms",
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
