import { chatComplete, type AiMeta, type ChatMessage, type ChatResult } from "@/lib/ai.server";
import { reportAiHealth } from "@/lib/ai-health.server";
import { longQuotes, unmatchedQuotes } from "@/lib/quote-check";

/**
 * The quote promise. A quotation is a promise that these are the exact words.
 * If we cannot verify one, that is our defect and not the reader's problem, so
 * we prevent, verify, repair, then refuse. The reader is never asked to check
 * our work.
 */

export const QUOTE_RULE = `ABSOLUTE RULE ON QUOTATION: quotation marks are used ONLY around text copied character for character from the work supplied to you. Anything you restate, condense, summarise or characterise is written as plain prose with NO quotation marks of any kind. Every quotation must name the item it came from. If you are not certain of the exact wording, do not use quotation marks.`;

export type QuoteGuardResult = {
  answer: string;
  unmatchedBefore: number;
  /** 1 when a corrective turn was run, 0 otherwise. */
  repairs: number;
  /** Spans still unverifiable after repair, stripped rather than rendered. */
  suppressed: number;
  /** The spans that could not be verified even after the repair turn. */
  failedSpans: string[];
  tokensIn: number;
  tokensOut: number;
  cachedIn: number;
  costUsd: number;
  claims: number;
};

const UNVERIFIED_MARK = " (restated, not verbatim)";

/** Renders a failed span as ordinary prose, marked inline as unverified. */
function demoteQuote(answer: string, span: string): string {
  let out = answer;
  for (const [open, close] of [
    ['"', '"'],
    ["\u201C", "\u201D"],
  ] as const) {
    const needle = `${open}${span}${close}`;
    if (out.includes(needle)) out = out.split(needle).join(`${span}${UNVERIFIED_MARK}`);
  }
  return out;
}

export async function guardQuotes(
  answer: string,
  context: string,
  cutOff: boolean,
  conversation: ChatMessage[],
  meta?: AiMeta,
): Promise<QuoteGuardResult> {
  const failed = unmatchedQuotes(answer, context, cutOff);
  if (failed.length === 0) {
    return {
      answer,
      unmatchedBefore: 0,
      repairs: 0,
      suppressed: 0,
      failedSpans: [],
      tokensIn: 0,
      tokensOut: 0,
      cachedIn: 0,
      costUsd: 0,
      claims: longQuotes(answer).length,
    };
  }

  // Repair: one automatic corrective turn, invisible to the reader.
  let repaired: ChatResult | null = null;
  try {
    repaired = await chatComplete(
      [
      ...conversation,
      { role: "assistant", content: answer },
      {
        role: "user",
        content: `${QUOTE_RULE}\n\nThe following quoted spans in your last answer do not appear character for character in the work supplied:\n\n${failed
          .map((span, i) => `${i + 1}. "${span}"`)
          .join(
            "\n",
          )}\n\nRewrite the whole answer. For each span, either restore the exact wording from the source, or remove the quotation marks and restate it as your own prose. Change nothing else. Return only the corrected answer.`,
        },
      ],
      { tier: "smart", meta: meta ?? { surface: "quote_repair" } },
    );
  } catch (e) {
    console.error("[quote-guard] repair turn failed:", (e as Error).message);
  }

  let finalAnswer = answer;
  let repairs = 0;
  if (repaired && repaired.text) {
    repairs = 1;
    finalAnswer = repaired.finishReason === "length" ? answer : repaired.text;
  }

  // Refuse: whatever still cannot be verified is not rendered as a quote.
  const stillFailing = unmatchedQuotes(finalAnswer, context, false);
  for (const span of stillFailing) finalAnswer = demoteQuote(finalAnswer, span);
  if (stillFailing.length > 0) {
    console.error("[quote-guard] suppressed unverifiable quotes", {
      count: stillFailing.length,
    });
    await reportAiHealth({
      errorClass: "quote_unverified",
      surface: meta?.surface ?? "quote_repair",
      orgId: meta?.orgId,
      orgName: meta?.orgName,
      actorHash: meta?.actorHash,
      model: repaired?.model ?? null,
      note: `${stillFailing.length} span(s) unverifiable after repair`,
    });
  }

  return {
    answer: finalAnswer,
    unmatchedBefore: failed.length,
    repairs,
    suppressed: stillFailing.length,
    failedSpans: stillFailing,
    tokensIn: repaired?.tokensIn ?? 0,
    tokensOut: repaired?.tokensOut ?? 0,
    cachedIn: repaired?.cachedIn ?? 0,
    costUsd: repaired?.costUsd ?? 0,
    claims: longQuotes(finalAnswer).length,
  };
}