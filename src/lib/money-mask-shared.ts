/**
 * 20 Nov 2026, D-91 (Liam: "hide money from Members everywhere"): the one place that knows what a money figure looks
 * like. Members never receive a money figure in any server answer: SOW summaries, document text, previews and public
 * share links are passed through here on the server before they leave. Admins and leads read them unchanged.
 *
 * The pattern started as the firm canvas's withoutMoney (QA M2: "45 000 €", "1.2 million", ¥, ₹ lakh, "3.5MM",
 * "€1.200.000", "US$ 45,000", "A$80k") and adds the formats the next QA pass found: "2,5 Mio €", "1.5 Mrd €",
 * "CHF 1'200'000", "kr 50 000" and lakh grouping ("₹12,50,000"). A bare "5m" stays: it is as often a count
 * ("Top 5m customers") as a sum.
 */

import { withoutFees } from "./firm-corpus-shared";
import { isDeliverableType } from "./lineage-shared";

/** Who reads money: admins and leads, as everywhere else. Members (stored as em) and coaches do not. */
export function seesMoney(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

// A symbol, with or without a country prefix ("$45k", "US$ 45,000", "A$80k", "¥5,000,000", "₹40 lakh"), or a short
// currency word written like a symbol ("kr 50 000", "Rs 12,50,000", "Fr. 900", "R 450 000" is left to codes).
const SYMBOL = "(?:(?:\\b(?:US|AU|A|CA|C|NZ|HK|SG|S|NT|R|MX))?[$£€¥₹₩₽₪₦₺฿]|\\b(?:kr|Rs|Fr|zł)\\.?(?=\\s?\\d))";
const SYMBOL_AFTER = "(?:[$£€¥₹₩₽₪₦₺฿]|\\b(?:kr|zł)(?![\\p{L}]))";
const CODES = "USD|GBP|EUR|AUD|CAD|NZD|CHF|SGD|JPY|INR|CNY|RMB|HKD|SEK|NOK|DKK|ZAR|BRL|MXN|AED|SAR|PLN";
const WORDS = "dollars?|pounds?|euros?|yen|rupees?|francs?|kronor|kroner|krona|krone";
// Thousands by comma, dot, space, narrow space or apostrophe ("1'200'000"); lakh grouping ("12,50,000", "1,20,00,000");
// or a plain number with an optional decimal ("2,5", "1.5").
const SEP = "[,.\\u00A0\\u202F '’]";
const NUMBER =
  "(?:(?<![\\d.,'’])\\d{1,2}(?:,\\d{2})+,\\d{3}(?:\\.\\d+)?(?![\\d])" +
  `|(?<![\\d.,'’])\\d{1,3}(?:${SEP}\\d{3})+(?:[.,]\\d+)?(?![\\d])` +
  "|(?<![\\d.,'’])\\d+(?:[.,]\\d+)?)";
const SCALE = "(?:\\s?(?:k|m|mm|mn|bn|b|million|billion|thousand|lakhs?|crores?|mio\\.?|mrd\\.?|md|tsd\\.?|mil)(?![\\p{L}]))";
const SCALE_WORD = "(?:million|billion|thousand|lakhs?|crores?|mm|mn|bn|mio|mrd)(?![\\p{L}])";
const PER = "(?:\\s?(?:/|per|a)\\s?(?:month|mo|week|wk|year|yr|day|hour|hr)\\b)?";

const MONEY_PARTS = [
  `${SYMBOL}\\s?${NUMBER}${SCALE}?${PER}`,
  `\\b(?:${CODES})\\s?${NUMBER}${SCALE}?${PER}`,
  `${NUMBER}${SCALE}?\\s?(?:${SYMBOL_AFTER}|\\b(?:${CODES}|${WORDS})\\b)${PER}`,
  `${NUMBER}\\s?${SCALE_WORD}${PER}`,
  `${NUMBER}\\s?k\\b${PER}`,
];
const MONEY = new RegExp(MONEY_PARTS.join("|"), "giu");

/** The mark left where a figure was, in text a Member reads. */
export const MONEY_WITHHELD = "[amount withheld]";

/** True when the text holds a money figure. */
export function hasMoney(text: string): boolean {
  MONEY.lastIndex = 0;
  const found = MONEY.test(text);
  MONEY.lastIndex = 0;
  return found;
}

/** Every money figure replaced by a mark: for running text (summaries, document bodies, previews). */
export function maskMoney(text: string, mark: string = MONEY_WITHHELD): string {
  return text.replace(MONEY, mark);
}

/** Every money figure taken out, with the punctuation tidied: for titles and short labels. */
export function withoutMoney(text: string): string {
  return text
    .replace(MONEY, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:·-]+|[\s,;:·-]+$/g, "")
    .trim();
}

/** A document or summary as a Member may read it: a proposal's Fees section withheld, and every figure masked. */
export function moneyFreeText(text: string): string {
  return maskMoney(withoutFees(text));
}

/** The text for this reader: unchanged for admins and leads, money free for everyone else. Null stays null. */
export function textFor<T extends string | null | undefined>(text: T, role: string | null | undefined): T {
  if (typeof text !== "string" || seesMoney(role)) return text;
  return moneyFreeText(text) as T;
}

const SOW_TITLE = /\b(sow|statement of work|scope of work|engagement letter)\b/i;

/**
 * A statement of work, as the firm brain reads one: a deliverable with fee terms set, or whose title says it is one.
 * Its summary and its document reach a Member with money removed.
 */
export function isSowItem(item: { type?: string | null; title?: string | null; meta?: unknown }): boolean {
  if (!item.type || !isDeliverableType(item.type)) return false;
  const meta = item.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? (item.meta as Record<string, unknown>) : {};
  return Boolean(meta["sow_facts"] && typeof meta["sow_facts"] === "object") || SOW_TITLE.test(item.title ?? "");
}

/** Shown instead of the original file when a Member opens a SOW: they read its text, with figures withheld. */
export const SOW_TEXT_ONLY = "This statement of work opens as text for you, with figures withheld.";

type ExtractText = { summary?: string | null; decisions?: string | null; handoff?: string | null };
type WithExtracts = { type?: string | null; title?: string | null; meta?: unknown; work_item_extracts?: ExtractText[] | ExtractText | null };

/**
 * A row as a Member may receive it: when it is a SOW, its extract's summary, decisions and handoff are money free.
 * Every other row, and every row for admins and leads, comes back as it was.
 */
export function rowForReader<T extends WithExtracts>(row: T, reads: boolean): T {
  if (reads || !isSowItem(row) || !row.work_item_extracts) return row;
  const clean = (extract: ExtractText): ExtractText => ({
    ...extract,
    ...(typeof extract.summary === "string" ? { summary: moneyFreeText(extract.summary) } : {}),
    ...(typeof extract.decisions === "string" ? { decisions: moneyFreeText(extract.decisions) } : {}),
    ...(typeof extract.handoff === "string" ? { handoff: moneyFreeText(extract.handoff) } : {}),
  });
  const extracts = row.work_item_extracts;
  return { ...row, work_item_extracts: Array.isArray(extracts) ? extracts.map(clean) : clean(extracts) };
}
