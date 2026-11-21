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
const SEP = "[,.\\u00A0\\u202F\\u2009 '’]";
const NUMBER =
  "(?:(?<![\\d.,'’])\\d{1,2}(?:,\\d{2})+,\\d{3}(?:\\.\\d+)?(?![\\d])" +
  `|(?<![\\d.,'’])\\d{1,3}(?:${SEP}\\d{3})+(?:[.,]\\d+)?(?![\\d])` +
  "|(?<![\\d.,'’])\\d+(?:[.,]\\d+)?)";
const SCALE = "(?:\\s?(?:k|m|mm|mn|bn|b|million|billion|thousand|lakhs?|crores?|mio\\.?|mrd\\.?|md|tsd\\.?|mil)(?![\\p{L}]))";
const SCALE_WORD = "(?:million|billion|thousand|lakhs?|crores?|mm|mn|bn|mio|mrd)(?![\\p{L}])";
const PER = "(?:\\s?(?:/|per|a)\\s?(?:month|mo|week|wk|year|yr|day|hour|hr)\\b)?";

// QA M1 (PR 281): a scale word or a bare "k" with no currency is a count ("2 million users", "10k employees", "4k video"),
// never money, unless a fee word sits right before or after it ("a fee of 1.2 million", "120k retainer"). The same
// fee words make a bare grouped figure money ("Fees: 290,000", "day rate 1,200").
// 21 Nov 2026 (QA H1 of PR 299): "pay", "exceed", "cap", "total" and "investment" join, so "They pay 45 thousand",
// "not to exceed 60k" and "Investment: 120k" read as money.
const FEE_WORD = "(?:fees?|retainer|budgets?|price[ds]?|pricing|costs?|rate|charged?|honorar(?:ium)?|paid|pay|payment|exceed|cap|total|investment)";
const AFTER_FEE_WORD = `(?<=\\b${FEE_WORD}\\b[^.\\n\\d]{0,15})`;
const BEFORE_FEE_WORD = `(?=\\s?${FEE_WORD}\\b)`;
const STRICT_FEE_WORD = "(?:fees?|retainer|price[ds]?|day rate|honorar(?:ium)?)";
const AFTER_STRICT_FEE_WORD = `(?<=\\b${STRICT_FEE_WORD}\\b[^.\\n\\d]{0,15})`;
const GROUPED = "(?:(?<![\\d.,'’])\\d{1,2}(?:,\\d{2})+,\\d{3}(?![\\d])" + `|(?<![\\d.,'’])\\d{1,3}(?:${SEP}\\d{3})+(?:[.,]\\d+)?(?![\\d]))`;

// QA H1 of PR 299: the formats a Member lead still saw in a brief or an RFP.
// A range: "$50-60k", "50 to 60k" after a fee word, "45-50 thousand dollars".
const RANGE = `${NUMBER}\\s?(?:[-\u2013\u2014]|to)\\s?${NUMBER}`;
// Spelled numbers before a scale: "forty thousand", "one hundred and twenty thousand".
const NUM_WORD =
  "(?:a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|and)";
const SPELLED = `\\b${NUM_WORD}(?:[\\s-]+${NUM_WORD})*\\s+(?:thousand|million|billion)\\b`;
const PER_REQUIRED = "(?:\\s?(?:/|per|a)\\s?(?:month|mo|week|wk|year|yr|day|hour|hr)\\b)";

const MONEY_PARTS = [
  `${SYMBOL}\\s?${RANGE}${SCALE}?${PER}`,
  `${AFTER_FEE_WORD}${RANGE}${SCALE}?${PER}`,
  `${RANGE}${SCALE}?\\s?\\(?(?:${SYMBOL_AFTER}|\\b(?:${CODES}|${WORDS})\\b)\\)?${PER}`,
  `${SPELLED}\\s?(?:${SYMBOL_AFTER}|\\b(?:${CODES}|${WORDS})\\b)${PER}`,
  `${AFTER_FEE_WORD}${SPELLED}${PER}`,
  // A scale with a period is a price ("45 thousand a month", "10k per month"); a figure with a slash rate is one too.
  `${NUMBER}\\s?(?:${SCALE_WORD}|k\\b)${PER_REQUIRED}`,
  `${AFTER_FEE_WORD}${NUMBER}${PER_REQUIRED}`,
  `${GROUPED}\\s?/\\s?(?:day|hour|hr)\\b`,
  `${SYMBOL}\\s?${NUMBER}${SCALE}?${PER}`,
  `\\b(?:${CODES})\\s?${NUMBER}${SCALE}?${PER}`,
  `${NUMBER}${SCALE}?\\s?\\(?(?:${SYMBOL_AFTER}|\\b(?:${CODES}|${WORDS})\\b)\\)?${PER}`,
  `${AFTER_FEE_WORD}${NUMBER}\\s?(?:${SCALE_WORD}|k\\b)${PER}`,
  `${NUMBER}\\s?(?:${SCALE_WORD}|k\\b)${PER}${BEFORE_FEE_WORD}`,
  `${AFTER_STRICT_FEE_WORD}${GROUPED}${PER}`,
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

/** The line put where a money section was, in a document a Member reads. */
export const MONEY_SECTION_WITHHELD = "[pricing withheld]";

// A line that opens a money section, in any heading style: "## Fees", "FEES", "Pricing and payment", "Budget:",
// "4. Commercials". Short (up to 8 words), and the money word is its first word after any numbering.
const MONEY_HEADING = /^\s*(?:#{1,6}\s*)?(?:[\d.)\s]+)?(?:fees?|pricing|prices?|investment|commercials?|budgets?|payments?|costs?|rates?|compensation|financials?)\b[^\n.!?]{0,60}:?\s*$/i;
const ANY_HEADING = /^\s*(?:#{1,6}\s+\S|[A-Z][A-Za-z0-9&/ ,'-]{1,60}:?\s*$)/;

/**
 * 21 Nov 2026 (QA H1 of PR 299): a whole document as a Member may read it. Every money-headed section is withheld,
 * from its heading to the next blank line followed by another heading (or the next markdown heading), so a bare price
 * table ("Discovery: 18,000") goes with it; then every figure left is masked. For whole documents and briefs, where a
 * price table can sit with no currency on any line.
 */
export function moneyFreeDocument(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let hiding = false;
  let blank = false;
  for (const line of lines) {
    if (MONEY_HEADING.test(line) && line.trim().split(/\s+/).length <= 8) {
      if (!hiding) out.push(line.trim().replace(/:$/, ""), MONEY_SECTION_WITHHELD);
      hiding = true;
      blank = false;
      continue;
    }
    if (hiding) {
      const isHeading = /^\s*#{1,6}\s+\S/.test(line) || (blank && ANY_HEADING.test(line) && line.trim().split(/\s+/).length <= 8);
      if (!isHeading) {
        blank = line.trim() === "";
        continue;
      }
      hiding = false;
      out.push("");
    }
    out.push(line);
  }
  return maskMoney(withoutFees(out.join("\n")));
}

/** The mark left where a number was, in a brief or document a Member lead reads. */
export const NUMBER_WITHHELD = "[number withheld]";

// A heading over money, in any style: "## Fees", "Section 5. Fees", "4) Costs and expenses", "Day rates:", "BUDGET".
const NUMBERS_HEADING =
  /^\s*(?:#{1,6}\s*)?(?:(?:section|part|schedule|appendix)\s+[\w.]+[.:)]?\s*)?(?:[\d.)\s]+)?(?:fees?|costs?|cost\s+table|prices?|pricing|budgets?|rates?|day\s+rates?|expenses?|commercials?|investment|payments?|compensation|financials?)\b[^\n.!?]{0,60}:?\s*$/i;
const NUMBERS_ANY_HEADING = (line: string) =>
  /^\s*#{1,6}\s+\S/.test(line) || /^\s*(?:section|part|schedule|appendix)\s+[\w.]+[.:)]?\s+\S/i.test(line) || /^\s*[A-Z][A-Za-z0-9&/ ,'-]{1,60}:?\s*$/.test(line);
// Spelled amounts: "one hundred and twenty thousand", "fifteen hundred", "a million".
const SPELLED_AMOUNT = new RegExp(`\\b${NUM_WORD}(?:[\\s-]+${NUM_WORD})*\\s+(?:hundred|thousand|million|billion)\\b(?:[\\s-]+(?:and\\s+)?${NUM_WORD}(?:[\\s-]+${NUM_WORD})*)?`, "gi");
// Dates and times stay: 2026-11-21, 21/11/2026, 21.11.26, 10:30, Q4 2026, FY26.
const DATE_LIKE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|\b\d{1,2}:\d{2}\b/g;
// Any number with three or more digits (separators allowed), with an optional decimal and scale; or a short number
// with a scale ("120 to 150 thousand", "2.5m").
const BIG_NUMBER = new RegExp(
  `(?<![\\w.,'’])(?:\\d{1,3}(?:${SEP}\\d{3})+|\\d{3,})(?:[.,]\\d+)?(?:\\s?(?:k|m|mm|bn|thousand|million|billion)(?![\\p{L}]))?(?![\\d])` +
    `|(?<![\\w.,'’])\\d{1,2}(?:[.,]\\d+)?\\s?(?:k|m|mm|bn|thousand|million|billion)(?![\\p{L}])`,
  "giu",
);
/** A plain year stays a year: 1900 to 2099, standing alone or after Q1-Q4, FY or a month. */
const isYear = (value: string) => /^(?:19|20)\d{2}$/.test(value);
// QA of PR 300: a "year" with money words around it is a price ("costs 1950", "1999 per day", "2000 each"), and a
// small figure right after a money word is one too ("fees of 99 each", "rate 85").
const MONEY_WORDS = "(?:fees?|costs?|cost|price[sd]?|pricing|rates?|budgets?|charged?|charges|pays?|paid|payment|total|expenses?|investment|value|worth|spend|£|\\$|€)";
const PRICE_BEFORE = new RegExp(`\\b${MONEY_WORDS}\\b[^.\\n\\d]{0,15}$|[£$€]\\s?$|\\b(?:is|are|at)\\s$`, "i");
const PRICE_AFTER = /^\s?(?:\/|per\b|each\b|a\s+(?:day|month|week|year|hour)\b|ex\b|plus\b|\+\s?VAT|VAT\b|net\b|gross\b|in fees)/i;
const SMALL_AFTER_MONEY = new RegExp(`(\\b${MONEY_WORDS}\\b[^.\\n\\d]{0,15})(\\d{1,2}(?:[.,]\\d+)?)(?![\\d%])`, "gi");

/**
 * 21 Nov 2026 (QA H1b of PR 299, Liam's rule "Members never see money"): the blunt form for a whole brief or document a
 * Member lead reads. Every money-headed section goes whole; then every number of three or more digits, every number
 * with a scale and every spelled-out amount is withheld, whatever the currency or none. Years, dates, times and short
 * counts ("3 workshops", "Week 3") stay. Admins and Leads never get this text.
 */
export function numbersWithheld(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let hiding = false;
  let blank = false;
  for (const line of lines) {
    // A heading carries no figure of its own ("Day rate: 950" is a line to mask, not a section to hide).
    const plain = line.replace(/(?:section|part|schedule|appendix)\s+[\w.]+/i, "");
    if (NUMBERS_HEADING.test(line) && !/\d/.test(plain) && line.trim().split(/\s+/).length <= 9) {
      if (!hiding) out.push(line.trim().replace(/:$/, ""), MONEY_SECTION_WITHHELD);
      hiding = true;
      blank = false;
      continue;
    }
    if (hiding) {
      const isHeading = /^\s*#{1,6}\s+\S/.test(line) || (blank && NUMBERS_ANY_HEADING(line) && line.trim().split(/\s+/).length <= 9);
      if (!isHeading) {
        blank = line.trim() === "";
        continue;
      }
      hiding = false;
      out.push("");
    }
    out.push(line);
  }
  return numbersWithheldInline(out.join("\n"));
}

/** The number part of numbersWithheld alone, for a title or a single line: no section is hidden. */
export function numbersWithheldInline(text: string): string {
  let body = maskMoney(text, NUMBER_WITHHELD);
  // Dates and times are set aside so their digits are never read as amounts.
  const kept: string[] = [];
  body = body.replace(DATE_LIKE, (match) => `\u0000${kept.push(match) - 1}\u0000`);
  body = body.replace(SPELLED_AMOUNT, NUMBER_WITHHELD);
  body = body.replace(BIG_NUMBER, (match: string, offset: number, whole: string) => {
    if (!isYear(match)) return NUMBER_WITHHELD;
    const before = whole.slice(Math.max(0, offset - 20), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 12);
    // A bare cell in a table ("| Discovery | 2000 |") is a figure, not a year (QA of PR 300).
    const cell = /\|\s*$/.test(before) && /^\s*(?:\||$)/m.test(after);
    return cell || PRICE_BEFORE.test(before) || PRICE_AFTER.test(after) ? NUMBER_WITHHELD : match;
  });
  body = body.replace(SMALL_AFTER_MONEY, (_m, lead: string) => `${lead}${NUMBER_WITHHELD}`);
  return body.replace(/\u0000(\d+)\u0000/g, (_m, index: string) => kept[Number(index)] ?? "");
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
  // A list is not fee terms (QA L3): the SQL rule reads jsonb_typeof = 'object', and so does this.
  const facts = meta["sow_facts"];
  return Boolean(facts && typeof facts === "object" && !Array.isArray(facts)) || SOW_TITLE.test(item.title ?? "");
}

/**
 * QA H2 (PR 281): a proposal states the firm's fee. Liam, D-93: proposals count as firm money. This one line holds that
 * rule; the SQL files carry the same rule on one marked line.
 */
export const PROPOSALS_ARE_FIRM_MONEY = true;

// D-93: a title that starts with "Proposal" ("[Proposal] ...", "Copy of ... Proposal") is a proposal, always, whatever
// else it says ("Proposal: Strategic review and options" is still the firm's proposal).
const PROPOSAL_LEADING = /^\W*(?:copy of\s+)*\[?proposal\b/i;
// QA of PR 281 (open Medium): other titles people give a firm's own proposal: "external proposal figures", "Draft
// proposal - Acme", "Acme proposal v3", "Re: Proposal", "1. Proposal", "diagnostic-proposal-final". These count only when
// the title is not about a proposal (notes, a review, comments): "Partner review notes on proposal draft v1" is not.
const PROPOSAL_WIDER = new RegExp(
  [
    "\\bproposal[-_ ](?:draft|final)\\b",
    "\\b(?:draft|external|final|signed|our)\\s+proposal\\b",
    "\\bproposal\\s+(?:v\\d+|figures|pricing|fees?|budget)\\b",
    "^\\W*(?:re:\\s*|\\d+[.)]\\s*)proposal\\b",
  ].join("|"),
  "i",
);
const NOT_THE_PROPOSAL = /\b(?:notes?|review|feedback|comments?)\b/i;

/** A proposal document: the proposal desk marks it, or its title starts with "Proposal" ("[Proposal] ...", "Proposal draft: ..."). */
export function isProposalItem(item: { type?: string | null; title?: string | null; meta?: unknown }): boolean {
  if (!item.type || !isDeliverableType(item.type)) return false;
  const meta = item.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? (item.meta as Record<string, unknown>) : {};
  const title = item.title ?? "";
  return meta["deliverable_kind"] === "proposal" || PROPOSAL_LEADING.test(title) || (PROPOSAL_WIDER.test(title) && !NOT_THE_PROPOSAL.test(title));
}

/** An item holding the firm's own money: a SOW, and a proposal while PROPOSALS_ARE_FIRM_MONEY is on. */
export function isFirmMoneyItem(item: { type?: string | null; title?: string | null; meta?: unknown }): boolean {
  return isSowItem(item) || (PROPOSALS_ARE_FIRM_MONEY && isProposalItem(item));
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
  if (reads || !isFirmMoneyItem(row) || !row.work_item_extracts) return row;
  const clean = (extract: ExtractText): ExtractText => ({
    ...extract,
    ...(typeof extract.summary === "string" ? { summary: moneyFreeText(extract.summary) } : {}),
    ...(typeof extract.decisions === "string" ? { decisions: moneyFreeText(extract.decisions) } : {}),
    ...(typeof extract.handoff === "string" ? { handoff: moneyFreeText(extract.handoff) } : {}),
  });
  const extracts = row.work_item_extracts;
  return { ...row, work_item_extracts: Array.isArray(extracts) ? extracts.map(clean) : clean(extracts) };
}
