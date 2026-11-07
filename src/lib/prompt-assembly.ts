/**
 * Message ORDER only. Not one byte of prompt text lives here: every string is
 * passed in by the caller. Keeping the ordering pure makes prefix stability
 * testable without a database or a model.
 */
import type { RecordDocument } from "./ai.server";

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string; documents?: RecordDocument[] };

/** The one-line acknowledgement that closes the record turn so history can follow it. */
export const RECORD_ACK = "I have read the record above and will cite it by item and turn.";

/**
 * Chat, TOTAL-1 order: the stable system prompts, then the record as the
 * first user turn (preamble text plus one citable document per item, with
 * the cache breakpoint on its last block), a fixed assistant acknowledgement,
 * then the running history, then anything that changes per question (the
 * earlier-reads note) folded into the question turn. The record is the same
 * bytes on every question about the same read set, so it is a cache hit from
 * the second question on; nothing that changes per turn sits in front of it.
 */
export function buildReflectConversation(input: {
  prompts: ChatTurn[];
  historyMessages: ChatTurn[];
  scopeMode: string;
  context: string;
  message: string;
  documents?: RecordDocument[];
  preamble?: string;
  perQuestionNote?: string | null;
}): ChatTurn[] {
  const heading = `THE PERSON'S RECORDED WORK (scope: ${input.scopeMode}):`;
  const record: ChatTurn =
    input.documents && input.documents.length > 0
      ? { role: "user", content: `${heading}\n\n${input.preamble ?? ""}`.trimEnd(), documents: input.documents }
      : { role: "user", content: `${heading}\n\n${input.context}` };
  const question = input.perQuestionNote ? `${input.perQuestionNote}\n\n${input.message}` : input.message;
  return [
    ...input.prompts,
    record,
    { role: "assistant", content: RECORD_ACK },
    ...input.historyMessages,
    { role: "user", content: question },
  ];
}

/**
 * Analysis: the firm's checks are their own message rather than being glued to
 * the preset prompt, so the preset prefix is identical on every run.
 */
export function buildAnalysisConversation(input: {
  systemPrompt: string;
  presetPrompt: string;
  checksBlock: string | null;
  heading: string;
  context: string;
  kindLine: string;
  tailInstruction: string | null;
  openingMessage: string;
}): ChatTurn[] {
  return [
    { role: "system", content: input.systemPrompt },
    { role: "system", content: input.presetPrompt },
    ...(input.checksBlock ? [{ role: "system" as const, content: input.checksBlock }] : []),
    {
      role: "system",
      content: `${input.heading}:\n\n${input.context}${input.kindLine}`,
    },
    ...(input.tailInstruction
      ? [{ role: "system" as const, content: input.tailInstruction }]
      : []),
    { role: "user", content: input.openingMessage },
  ];
}