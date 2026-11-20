/**
 * Fee terms on a statement of work (Liam, 18 Nov: "if we demo it it must be real"). The past fees panel and the
 * precedent lengths read work_items.meta.sow_facts; before this only the demo seed wrote it. Now a partner or lead
 * sets it on a SOW: Charlotte can read a suggestion from the document, code keeps only words really in it, and nothing
 * is saved until a person confirms. Code renders fees from these fields; a model never sees them afterwards.
 */

export type SowFeeBasis = "fixed" | "monthly";

export type SowTerms = {
  fee_text: string;
  fee_amount: number | null;
  fee_basis: SowFeeBasis | null;
  weeks: number | null;
  confirmed_by?: string;
  confirmed_at?: string;
};

export const SOW_TERMS_COPY = {
  menu: "Fee terms…",
  title: "Fee terms",
  helper: "Set the fee and length as the SOW states them. Admins and leads see the fee in past fees; nobody else does.",
  feeLabel: "Fee, as written",
  feePlaceholder: "$380k",
  weeksLabel: "Length in weeks",
  suggest: "Read from the document",
  suggesting: "Reading…",
  suggested: "Read from the document. Check it before saving.",
  nothingFound: "No fee or length found word for word in the document.",
  save: "Save fee terms",
  clear: "Remove fee terms",
  cancel: "Cancel",
  saved: "Fee terms saved.",
  failed: "Could not save the fee terms. Try again.",
  suggestFailed: "Could not read the document. Enter the terms yourself.",
  needFee: "Enter the fee as the SOW writes it, for example $380k or £45,000 a month.",
  badWeeks: "Enter the length as whole weeks between 1 and 260, or leave it empty.",
  longFee: "Keep the fee under 80 characters.",
} as const;

export const MAX_FEE_CHARS = 80;
export const MAX_WEEKS = 260;

/** Admins and leads see and set fees; the same rule Ask the firm and past fees use. */
export function canSetFees(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

const SYMBOL_OR_CODE = "(?:[$£€]|USD|GBP|EUR|AUD|CAD|NZD|CHF|SGD)";
// Basis words a SOW writes around one figure: "fixed fee of $120,000", "$120,000 fixed", "$45k per month".
const LEAD = "(?:(?:a\\s+)?(?:fixed|flat)(?:\\s+fee)?(?:\\s+of)?\\s+)?";
const TAIL = "(?:\\s*(?:fixed|flat)(?:\\s+fee)?|\\s*(?:\\/|per|a)\\s*month)?";
const FEE = new RegExp(
  `^\\s*${LEAD}(?:${SYMBOL_OR_CODE}\\s?)?(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(k|m|thousand|million)?\\s*(?:${SYMBOL_OR_CODE})?${TAIL}\\s*$`,
  "i",
);
const HAS_MONEY_MARK = new RegExp(`${SYMBOL_OR_CODE}|dollars?|pounds?|euros?`, "i");

/**
 * The fee's amount and basis when the text is one plain figure ("$380k", "£45,000 a month", "USD 90,000"). Anything
 * else (a range, a rate card, "time and materials") keeps only its text: amount and basis stay null, never guessed.
 */
export function parseFee(text: string): { fee_amount: number | null; fee_basis: SowFeeBasis | null } {
  const clean = text.trim();
  const match = FEE.exec(clean);
  if (!match || !HAS_MONEY_MARK.test(clean)) return { fee_amount: null, fee_basis: null };
  const unit = match[2]?.toLowerCase();
  const scale = unit === "m" || unit === "million" ? 1_000_000 : unit ? 1_000 : 1;
  const amount = Math.round(Number(match[1]!.replace(/,/g, "")) * scale);
  if (!Number.isFinite(amount) || amount <= 0) return { fee_amount: null, fee_basis: null };
  return { fee_amount: amount, fee_basis: /month/i.test(clean) ? "monthly" : "fixed" };
}

/** A problem to show, or null when the input can be saved. Weeks may be empty; the fee may not. */
export function validateSowTerms(input: { feeText: string; weeks: string }): string | null {
  const fee = input.feeText.trim();
  if (!fee) return SOW_TERMS_COPY.needFee;
  if (fee.length > MAX_FEE_CHARS) return SOW_TERMS_COPY.longFee;
  const weeks = input.weeks.trim();
  if (weeks && !(/^\d+$/.test(weeks) && Number(weeks) >= 1 && Number(weeks) <= MAX_WEEKS)) return SOW_TERMS_COPY.badWeeks;
  return null;
}

/** The meta.sow_facts value to store, stamped with who confirmed it and when. */
export function buildSowTerms(input: { feeText: string; weeks: string }, confirmedBy: string, now: Date = new Date()): SowTerms {
  const feeText = input.feeText.trim().replace(/\s+/g, " ");
  const weeks = input.weeks.trim();
  return { fee_text: feeText, ...parseFee(feeText), weeks: weeks ? Number(weeks) : null, confirmed_by: confirmedBy, confirmed_at: now.toISOString() };
}

/** The stored terms on an item's meta, when they look like terms. */
export function sowTermsOf(meta: unknown): SowTerms | null {
  const facts = (meta as { sow_facts?: unknown } | null)?.sow_facts;
  if (!facts || typeof facts !== "object") return null;
  const record = facts as Record<string, unknown>;
  if (typeof record["fee_text"] !== "string") return null;
  return {
    fee_text: record["fee_text"],
    fee_amount: typeof record["fee_amount"] === "number" ? record["fee_amount"] : null,
    fee_basis: record["fee_basis"] === "fixed" || record["fee_basis"] === "monthly" ? record["fee_basis"] : null,
    weeks: typeof record["weeks"] === "number" ? record["weeks"] : null,
  };
}

const squash = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/**
 * What survives of a model's suggestion: the fee only when its exact words are in the document and it carries a
 * currency mark, the length only when the document states that many weeks. Everything else is dropped.
 */
export function checkSuggestion(document: string, suggestion: { fee_text?: unknown; weeks?: unknown }): { feeText: string; weeks: string } {
  const doc = squash(document);
  const fee = typeof suggestion.fee_text === "string" ? suggestion.fee_text.trim() : "";
  const keepFee = fee.length > 0 && fee.length <= MAX_FEE_CHARS && HAS_MONEY_MARK.test(fee) && doc.includes(squash(fee));
  const weeks = typeof suggestion.weeks === "number" ? suggestion.weeks : typeof suggestion.weeks === "string" ? Number(suggestion.weeks) : NaN;
  const keepWeeks =
    Number.isInteger(weeks) && weeks >= 1 && weeks <= MAX_WEEKS && new RegExp(`\\b${weeks}[\\s-]*weeks?\\b`).test(doc);
  return { feeText: keepFee ? fee : "", weeks: keepWeeks ? String(weeks) : "" };
}

/**
 * F2 (QA of #273, 20 Nov): the money in a SOW's terms. These two fields never sit in work_items.meta, which every
 * member's browser reads; they live in work_item_fee_terms, a table only the server can read, and are put back
 * together on the server for admins and leads.
 */
export const FEE_FIELDS = ["fee_text", "fee_amount"] as const;

export type FeeFields = { fee_text: string; fee_amount: number | null };

/** The terms without their money: what may stay in meta (length, basis, who confirmed it and when). */
export function withoutFees(facts: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...facts };
  for (const key of FEE_FIELDS) delete rest[key];
  return rest;
}

/** The money out of a set of terms, or null when it carries none. */
export function feesOf(facts: Record<string, unknown>): FeeFields | null {
  if (typeof facts["fee_text"] !== "string") return null;
  return { fee_text: facts["fee_text"], fee_amount: typeof facts["fee_amount"] === "number" ? facts["fee_amount"] : null };
}

/** An item's meta with its fees put back from the protected row. The row wins over anything left in meta. */
export function metaWithFees(meta: unknown, fees: FeeFields | null | undefined): unknown {
  if (!fees || !meta || typeof meta !== "object" || Array.isArray(meta)) return meta;
  const record = meta as Record<string, unknown>;
  const facts = record["sow_facts"];
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return meta;
  return { ...record, sow_facts: { ...(facts as Record<string, unknown>), ...fees } };
}

/** True for any key path in a value that carries money from SOW terms. Used by tests that inspect what roles receive. */
export function carriesFees(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(carriesFees);
  return Object.entries(value as Record<string, unknown>).some(([key, inner]) => (FEE_FIELDS as readonly string[]).includes(key) || carriesFees(inner));
}
